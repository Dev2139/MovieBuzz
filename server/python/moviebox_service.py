import asyncio
import base64
import json
import re
import logging
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

from movie_box.v3.http_client import MovieBoxHttpClient
from movie_box.v3.core import (
    SearchV2,
    ItemDetails,
    SeasonDetails,
    DownloadableFilesDetail,
    DownloadableCaptionFileDetails,
)
from movie_box.v3.constants import SubjectType, CustomResolutionType

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("moviebox_service")

PORT = int(os.getenv("MOVIEBOX_PORT", "5055"))

def is_deprecation_notice_url(url: str) -> bool:
    """Identify and filter out 21-second upgrade announcement / placeholder video URLs."""
    if not url:
        return True
    lower = url.lower()
    return (
        "b164fbfb4347792950bdfbfb563d39d9" in lower
        or "1c7de0bd3393702d9191801f15f88f8d" in lower
        or "9a0461bc39da389663bf3dbb17091d3f" in lower
        or "/notice.mp4" in lower
        or ("macdn.aoneroom.com" in lower and "/other/" in lower)
    )

def decode_b64_padded(s: str) -> bytes | None:
    padding = (4 - len(s) % 4) % 4
    if padding > 0:
        s += "=" * padding
    try:
        return base64.b64decode(s.encode("ascii"))
    except Exception:
        return None

def resolve_dash_manifest_from_policy(sign_cookie: str) -> tuple[str, str] | None:
    """
    Decodes urlprefix or CloudFront-Policy from sign_cookie.
    Returns (manifest_url, base_url) if resolved.
    """
    if not sign_cookie:
        return None
    for part in sign_cookie.split(";"):
        trimmed = part.strip()
        if "urlprefix=" in trimmed:
            idx = trimmed.find("urlprefix=")
            prefix_part = trimmed[idx + len("urlprefix="):]
            b64_token = prefix_part.split(":")[0].strip()
            normalized = b64_token.replace("-", "+").replace("_", "/")
            decoded = decode_b64_padded(normalized)
            if decoded:
                try:
                    url_str = decoded.decode("utf-8")
                    base = url_str.rstrip("*").rstrip("/")
                    if base and (base.startswith("http://") or base.startswith("https://")) and "/dash/" in base:
                        return f"{base}/index.mpd", f"{base}/"
                except Exception:
                    pass
        if "CloudFront-Policy=" in trimmed:
            idx = trimmed.find("CloudFront-Policy=")
            policy_raw = trimmed[idx + len("CloudFront-Policy="):].strip()
            normalized = policy_raw.replace("-", "+").replace("_", "=").replace("~", "/")
            decoded = decode_b64_padded(normalized)
            if decoded:
                try:
                    js = json.loads(decoded)
                    res = js.get("Statement", [{}])[0].get("Resource", "")
                    base = res.rstrip("*").rstrip("/")
                    if base and (base.startswith("http://") or base.startswith("https://")) and "/dash/" in base:
                        return f"{base}/index.mpd", f"{base}/"
                except Exception:
                    pass
    return None

# Global asyncio event loop running on a dedicated worker thread
_loop = None
_client = None

def get_event_loop():
    global _loop
    return _loop

async def _init_client():
    global _client
    _client = MovieBoxHttpClient()
    await _client.__aenter__()
    logger.info("MovieBoxHttpClient initialized successfully.")

async def _close_client():
    global _client
    if _client:
        await _client.__aexit__()
        _client = None

def _start_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_init_client())
    loop.run_forever()

class MovieBoxHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        logger.info("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), format % args))

    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/health":
            self._send_json(200, {"status": "ok", "service": "moviebox-bridge", "port": PORT})
            return

        future = asyncio.run_coroutine_threadsafe(self.handle_async(path, query), _loop)
        try:
            status_code, data = future.result(timeout=30.0)
            self._send_json(status_code, data)
        except Exception as e:
            logger.exception("Error handling request %s: %s", path, e)
            self._send_json(500, {"error": str(e), "path": path})

    async def handle_async(self, path: str, query: dict):
        global _client
        if not _client:
            return 503, {"error": "Client not ready"}

        if path == "/search":
            q = query.get("q", [""])[0].strip()
            if not q:
                return 400, {"error": "Query parameter 'q' is required"}
            raw_type = query.get("type", ["all"])[0].lower()
            subject_type = SubjectType.ALL
            if raw_type in ("movie", "movies"):
                subject_type = SubjectType.MOVIES
            elif raw_type in ("series", "tv"):
                subject_type = SubjectType.TV_SERIES

            searcher = SearchV2(_client, query=q, subject_type=subject_type)
            try:
                res = await searcher.get_content()
                items = res.get("items", [])
                formatted = []
                for it in items:
                    formatted.append({
                        "subjectId": str(it.get("subjectId", "")),
                        "title": it.get("title", ""),
                        "releaseDate": str(it.get("releaseDate", "")),
                        "subjectType": it.get("subjectType", 1),
                        "cover": it.get("cover", {}).get("url", "") if isinstance(it.get("cover"), dict) else "",
                        "score": it.get("score", 0),
                        "genres": it.get("genre", []),
                        "description": it.get("description", ""),
                    })
                return 200, {"query": q, "results": formatted, "count": len(formatted)}
            except Exception as e:
                logger.warning("Search failed for '%s': %s", q, e)
                return 200, {"query": q, "results": [], "count": 0, "warning": str(e)}

        elif path == "/item":
            subject_id = query.get("id", [""])[0].strip()
            if not subject_id:
                return 400, {"error": "Query parameter 'id' is required"}
            fetcher = ItemDetails(_client, include_seasons=True)
            res = await fetcher.get_content(subject_id)
            return 200, res

        elif path == "/seasons":
            subject_id = query.get("id", [""])[0].strip()
            if not subject_id:
                return 400, {"error": "Query parameter 'id' is required"}
            fetcher = SeasonDetails(_client)
            res = await fetcher.get_content(subject_id)
            return 200, res

        elif path == "/sources":
            subject_id = query.get("id", [""])[0].strip()
            if not subject_id:
                return 400, {"error": "Query parameter 'id' is required"}

            se = query.get("se", [""])[0].strip()
            ep = query.get("ep", [""])[0].strip()

            season_num = int(se) if (se and se.isdigit()) else 0
            ep_num = int(ep) if (ep and ep.isdigit()) else 0

            sources = []
            seen_dash_urls = set()

            # 1. Fetch play-info for target subject (and dubs if needed) to get genuine DASH MPD manifests
            target_ids = [subject_id]
            # If movie has alternative dubs that provide higher quality streams, also discover them
            try:
                details_res = await _client.get_from_api("/wefeed-mobile-bff/subject-api/get", params={"subjectId": subject_id})
                dubs = details_res.get("dubs", [])
                for d in dubs:
                    did = str(d.get("subjectId", "")).strip()
                    if did and did not in target_ids:
                        target_ids.append(did)
            except Exception as e:
                logger.debug("Could not query dubs for %s: %s", subject_id, e)

            for tid in target_ids[:3]:
                try:
                    play_params = {"subjectId": tid, "se": season_num, "ep": ep_num}
                    play_res = await _client.get_from_api("/wefeed-mobile-bff/subject-api/play-info", params=play_params)
                    streams = play_res.get("streams", [])
                    title_name = play_res.get("title", "")

                    for s in streams:
                        cookie = s.get("signCookie", "")
                        dash_info = resolve_dash_manifest_from_policy(cookie)
                        raw_url = s.get("url", "")
                        resolutions_str = str(s.get("resolutions") or "1080")
                        res_parts = [r.strip() for r in resolutions_str.split(",") if r.strip()]
                        primary_res = int(res_parts[0]) if (res_parts and res_parts[0].isdigit()) else 1080

                        stream_id = str(s.get("id", ""))
                        codec = s.get("codecName", "hevc")
                        size = s.get("size", 0)
                        duration = s.get("duration", 0)

                        if dash_info:
                            manifest_url, base_url = dash_info
                            if manifest_url not in seen_dash_urls:
                                seen_dash_urls.add(manifest_url)
                                sources.append({
                                    "resourceId": stream_id or f"dash-{primary_res}",
                                    "resolution": primary_res,
                                    "quality": f"{primary_res}p",
                                    "codecName": codec,
                                    "size": size,
                                    "duration": duration,
                                    "format": "DASH",
                                    "dashManifestUrl": manifest_url,
                                    "dashBaseUrl": base_url,
                                    "signCookie": cookie,
                                    "resourceLink": manifest_url,
                                    "season": season_num,
                                    "episode": ep_num,
                                    "title": title_name,
                                    "isDash": True,
                                })

                        # If there is a legitimate non-deprecation direct MP4 stream
                        if raw_url and not is_deprecation_notice_url(raw_url):
                            sources.append({
                                "resourceId": stream_id or f"direct-{primary_res}",
                                "resolution": primary_res,
                                "quality": f"{primary_res}p",
                                "codecName": codec,
                                "size": size,
                                "duration": duration,
                                "format": "MP4",
                                "resourceLink": raw_url,
                                "season": season_num,
                                "episode": ep_num,
                                "title": title_name,
                                "isDash": False,
                            })
                except Exception as e:
                    logger.warning("Error fetching play-info for %s: %s", tid, e)

            # 2. Also check /resource endpoint for any direct files, filtering out deprecation notice placeholders
            try:
                params = {"subjectId": subject_id, "page": 1, "perPage": 20}
                if season_num > 0:
                    params["se"] = season_num
                if ep_num > 0:
                    params["ep"] = ep_num

                res = await _client.get_from_api("/wefeed-mobile-bff/subject-api/resource", params=params)
                vids = res.get("list", [])
                for v in vids:
                    rlink = v.get("resourceLink", "")
                    if is_deprecation_notice_url(rlink):
                        # Filter out fake 21-second upgrade announcement video!
                        continue

                    if season_num > 0 and v.get("se") is not None and int(v.get("se")) != season_num:
                        continue
                    if ep_num > 0 and v.get("ep") is not None and int(v.get("ep")) != ep_num:
                        continue

                    sources.append({
                        "resourceId": str(v.get("resourceId", "")),
                        "resolution": v.get("resolution", 1080),
                        "quality": f"{v.get('resolution', 1080)}p",
                        "codecName": v.get("codecName", "h264"),
                        "size": v.get("size", 0),
                        "duration": v.get("duration", 0),
                        "format": "MP4",
                        "resourceLink": rlink,
                        "sourceUrl": v.get("sourceUrl", ""),
                        "season": v.get("se", 0),
                        "episode": v.get("ep", 0),
                        "title": v.get("title", ""),
                        "isDash": False,
                    })
            except Exception as e:
                logger.warning("Error fetching resource list for %s: %s", subject_id, e)

            # Sort sources: highest resolution first, non-retran first, highest bitrate and size first
            def source_sort_key(s):
                res = int(s.get("resolution") or 0)
                title = str(s.get("title") or "").lower()
                manifest = str(s.get("dashManifestUrl") or "")
                
                bitrate = 0
                m_match = re.search(r'_h265_(\d+)', manifest)
                if m_match:
                    bitrate = int(m_match.group(1))
                
                is_retran = 1 if "retran" in title else 0
                size = int(s.get("size") or 0)
                return (res, -is_retran, bitrate, size)

            sources.sort(key=source_sort_key, reverse=True)
            return 200, {"subjectId": subject_id, "sources": sources, "count": len(sources)}

        elif path == "/captions":
            subject_id = query.get("id", [""])[0].strip()
            resource_id = query.get("resourceId", [""])[0].strip()
            if not subject_id or not resource_id:
                return 400, {"error": "Both 'id' and 'resourceId' parameters are required"}

            params = {"subjectId": subject_id, "resourceId": resource_id}
            res = await _client.get_from_api("/wefeed-mobile-bff/subject-api/get-ext-captions", params=params)
            captions = []
            for c in res.get("extCaptions", []):
                captions.append({
                    "id": str(c.get("id", "")),
                    "lan": c.get("lan", "en"),
                    "lanName": c.get("lanName", "English"),
                    "url": c.get("url", ""),
                    "size": c.get("size", 0),
                })
            return 200, {"subjectId": subject_id, "resourceId": resource_id, "captions": captions}

        return 404, {"error": "Endpoint not found"}

def main():
    global _loop
    _loop = asyncio.new_event_loop()
    t = threading.Thread(target=_start_loop, args=(_loop,), daemon=True)
    t.start()

    server = HTTPServer(("127.0.0.1", PORT), MovieBoxHandler)
    logger.info("MovieBox Bridge Server running on http://127.0.0.1:%d", PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down MovieBox Bridge Server...")
    finally:
        server.server_close()
        if _loop:
            asyncio.run_coroutine_threadsafe(_close_client(), _loop).result(timeout=5.0)
            _loop.call_soon_threadsafe(_loop.stop)

if __name__ == "__main__":
    main()
