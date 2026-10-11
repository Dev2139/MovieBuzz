# CineStream 100% Free Video Streaming via Cloudflare Worker

This Cloudflare Worker handles all video streaming directly from upstream CDNs to your viewers, completely bypassing your servers.

### Benefits
- **$0.00 Cost**: 100% Free forever (uses Cloudflare's free tier).
- **Unlimited Bandwidth**: Cloudflare does not charge for bandwidth.
- **Your Laptop Stays OFF**: Runs 24/7 on Cloudflare's edge network in 300+ global cities.
- **Lightning Fast**: Automatically caches video chunks (`.m4s`) on Cloudflare's edge CDN.

---

## 🚀 Easy 2-Minute Setup

### Method 1: Using the Cloudflare Web Dashboard (Easiest - No CLI needed)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) and create a free account (no credit card required).
2. On the left sidebar, click **Workers & Pages** -> **Create application** -> **Create Worker**.
3. Give it a name like `cinestream-proxy` and click **Deploy**.
4. Click **Edit code**.
5. Delete the starter code and paste the entire contents of [`src/index.ts`](./src/index.ts) into the editor.
6. Click **Deploy** (top right).
7. Copy your worker's public URL (e.g. `https://cinestream-proxy.YOUR-SUBDOMAIN.workers.dev`).

---

### Method 2: Using the Terminal (Wrangler)

Run these commands from this folder:

```bash
cd cloudflare-stream-worker
npm install
npx wrangler login
npx wrangler deploy
```

It will output your public URL:
`https://cinestream-stream-proxy.YOUR-SUBDOMAIN.workers.dev`

---

## 🔗 Connect Worker to CineStream Backend

Open `server/.env` and add:

```env
CLOUDFLARE_STREAM_PROXY_URL=https://cinestream-stream-proxy.YOUR-SUBDOMAIN.workers.dev
```

That's it! Now:
- Your backend and database only handle fast, tiny JSON queries (< 10 KB).
- All gigabytes of video streaming flow through Cloudflare's edge network for free!
