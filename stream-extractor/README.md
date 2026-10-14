# Stream Extractor Worker

A tiny standalone service that runs a **real headless Chromium** to open
JS/Cloudflare‑gated embed providers (vidlink.pro, vidsrc.xyz, 2embed,
multiembed) and captures the **actual playable `.m3u8` / `.mp4` request** their
player makes. A plain HTTP client can't get these URLs (the providers hide them
behind a Cloudflare JS challenge + client‑side obfuscation); a real browser can.

Your MovieBuzz API calls this worker, gets back a raw stream URL, and feeds it
into **your own player** through `/api/streaming/embed-proxy`. Nothing is stored.

## API

```
GET /health
GET /extract?type=movie&imdbId=tt25433734&tmdbId=1068452
GET /extract?type=series&imdbId=tt...&tmdbId=...&season=1&episode=3
```

Response:

```json
{ "url": "https://cdn.../index.m3u8", "referer": "https://vidlink.pro/", "provider": "vidlink", "kind": "hls" }
```

- `404` if no provider yielded a playable URL.
- Results are cached in memory for `CACHE_TTL_MS` (default 20 min) so repeat
  plays don't relaunch the browser.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `CHROME_PATH` | `/usr/bin/chromium` | Path to Chromium binary |
| `NAV_TIMEOUT` | `25000` | ms to wait for page navigation |
| `WAIT_FOR_MEDIA` | `14000` | ms to wait for a media request after load |
| `CACHE_TTL_MS` | `1200000` | in‑memory result cache TTL |

## Run locally

```bash
npm install
# install Chromium locally, then point CHROME_PATH at it, e.g.:
CHROME_PATH="/usr/bin/chromium" npm start
# Windows example:
# $env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm start
curl "http://localhost:8080/extract?type=movie&imdbId=tt25433734&tmdbId=1068452"
```

## Deploy (free / low‑cost container host)

This image is built for a small container. Chromium peaks around **300–500 MB
RAM**, so use a host with **≥ 512 MB (1 GB recommended)**:

- **Render** – create a *Docker* web service, point it at this folder.
- **Fly.io** – `flyctl launch` from this folder (Dockerfile detected).
- **Railway / Koyeb / any Docker host**.

Then set the public URL on your **main API server**:

```
STREAM_EXTRACTOR_URL=https://your-extractor.onrender.com
```

That's the only wiring needed — `embedProviderService.ts` automatically uses the
headless provider when `STREAM_EXTRACTOR_URL` is set.

## Notes / caveats

- Free providers change and add protections often; the provider list in
  `src/index.js` (`buildEmbedTargets`) is intentionally easy to edit.
- MP4 captures play perfectly through the byte‑range proxy. HLS captures work
  only if their segment URLs are absolute and don't themselves require the
  browser; if an HLS source stalls, prefer providers that yield MP4.
- This is best‑effort by nature. For guaranteed reliability, a paid source API
  or self‑hosted files are the robust alternatives.
