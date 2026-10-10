import asyncio
import json
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

            params = {"subjectId": subject_id, "page": 1, "perPage": 20}
            if se:
                params["se"] = int(se)
            if ep:
                params["ep"] = int(ep)

            res = await _client.get_from_api("/wefeed-mobile-bff/subject-api/resource", params=params)
            vids = res.get("list", [])
            sources = []
            for v in vids:
                # If series episode is requested, filter matching episode if provided
                if se and v.get("se") is not None and int(v.get("se")) != int(se):
                    continue
                if ep and v.get("ep") is not None and int(v.get("ep")) != int(ep):
                    continue

                sources.append({
                    "resourceId": str(v.get("resourceId", "")),
                    "resolution": v.get("resolution", 1080),
                    "quality": f"{v.get('resolution', 1080)}p",
                    "codecName": v.get("codecName", "h264"),
                    "size": v.get("size", 0),
                    "duration": v.get("duration", 0),
                    "resourceLink": v.get("resourceLink", ""),
                    "sourceUrl": v.get("sourceUrl", ""),
                    "season": v.get("se", 0),
                    "episode": v.get("ep", 0),
                    "title": v.get("title", ""),
                })
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
