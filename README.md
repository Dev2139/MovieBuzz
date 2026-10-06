# CineStream — Authorized Movie & TV Series Streaming Platform

**CineStream** is a complete, production-quality streaming web application built using the **MERN Stack** (MongoDB, Express.js, React.js, Node.js, TypeScript, Tailwind CSS, React Router, TanStack Query, Axios, Mongoose).

The platform is designed exclusively for **movies and TV series that the platform operator has the legal right to distribute**, sourcing media from an existing Telegram channel while providing a completely standalone, premium web user experience without requiring website users to interact with Telegram or hold a Telegram account.

---

## 🌟 Key Features

### 1. No Mandatory User Login (Anonymous Playback)
- **Zero Login Wall**: Visitors can instantly browse the hero banner, catalog, search, filter, view detailed movie and TV series pages, select seasons/episodes, stream video, and download authorized files without an account.
- **LocalStorage Playback Tracking**: Anonymous playback progress (content ID, episode ID, timestamp position, percentage watched) is automatically saved to browser `localStorage`.
- **Continue Watching**: When anonymous users return, a "Continue Watching" row renders directly on the homepage with progress indicators.

### 2. Optional Accounts & Seamless Migration
- **Optional Registration**: Users can register to sync watch history across devices.
- **Automated Data Migration (`/api/users/migrate-local-data`)**: Upon registration or login, all anonymous local playback progress, watchlist items, and favorites are automatically merged into their MongoDB account without duplicates.

### 3. Telegram Media Provider & Storage Abstraction Architecture
- **Clean Storage Abstraction (`MediaProvider` Interface)**:
  ```typescript
  interface MediaProvider {
    getContent(): Promise<Content[]>;
    getMedia(mediaId: string): Promise<Media>;
    getStreamUrl(mediaId: string): Promise<string>;
    getDownloadUrl(mediaId: string): Promise<string>;
  }
  ```
- **Backend Isolation**: Private Telegram credentials are kept strictly on the Node.js backend and NEVER exposed to React or frontend `VITE_*` environment variables.
- **Mock Media Provider**: Operates out of the box with sample high-definition open-source video streams (1080p, 720p, 480p) when Telegram API credentials are not configured.

### 4. Admin Telegram Import & Review Workflow
- **Admin Review Queue (`/admin/telegram`)**: Telegram posts are imported into a review queue with status (`PENDING`, `REVIEWED`, `IMPORTED`, `IGNORED`).
- **Telegram Caption Parser (`telegramParser.ts`)**: Automatically extracts Title, Season, Episode, Year, Quality (1080p/720p/480p/4K), and Language from channel captions.
- **Human-in-the-loop Publishing**: Admins can correct detected metadata, assign cover posters, map to movies or series episodes, and publish to the live catalog.

### 5. Content Architecture (Movies, Series, Seasons, Episodes)
- **Conceptual Hierarchy**:
  ```text
  Content (Movie or Series)
  └── Series
       ├── Season 1
       │    ├── Episode 1 (1080p, 720p, 480p Media)
       │    ├── Episode 2
       │    └── Episode 3
       └── Season 2
  ```

### 6. Custom Video Player Component
- **HTML5 Player**: Built-in dark UI with play/pause, scrub bar, time display, volume control, playback speed (0.5x to 2x), quality switcher, picture-in-picture, fullscreen, keyboard shortcuts (`Space`, `F`, `M`, `Left/Right arrows`).
- **Throttled Sync**: Saves position every 5 seconds to `localStorage` (for guests) or MongoDB `/api/users/history` (for logged-in users).

---

## 📁 Project Structure

```text
movie-platform/
│
├── client/                      # React Frontend (Vite + TS + Tailwind CSS)
│   ├── src/
│   │   ├── components/          # Navbar, Footer, VideoPlayer, MediaCard, HeroBanner, etc.
│   │   ├── context/             # AuthContext (Auth state & data migration)
│   │   ├── pages/               # HomePage, MoviesPage, SeriesPage, ContentDetailPage, WatchPage, SearchPage, AdminDashboardPage, AdminTelegramPage
│   │   ├── services/            # Axios API Service
│   │   ├── types/               # TypeScript interfaces
│   │   ├── utils/               # LocalStorage management
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
│
├── server/                      # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── config/              # MongoDB connection
│   │   ├── controllers/         # Auth, Content, Series, Media, Search, User, Admin
│   │   ├── middleware/          # JWT Auth & Admin Protection
│   │   ├── models/              # User, Content, Season, Episode, Media, WatchHistory, TelegramImport
│   │   ├── routes/              # Express API Routes
│   │   ├── services/telegram/   # MediaProvider Interface, MockMediaProvider, TelegramClient, TelegramImporter, Parser
│   │   ├── seed/                # Database seed script
│   │   └── server.ts
│   ├── tsconfig.json
│   └── package.json
│
├── .env.example
├── README.md
└── package.json
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18+ or v20+
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017/cinestream`) or MongoDB Atlas URI.

---

### Step 1: Install Dependencies

Run from the repository root:

```bash
# Install Server dependencies
cd server
npm install

# Install Client dependencies
cd ../client
npm install
```

---

### Step 2: Configure Environment Variables

Create `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/cinestream
JWT_SECRET=cinestream_super_secret_jwt_key_2026
CLIENT_URL=http://localhost:5173

# Optional Production Telegram API Credentials
# TELEGRAM_CHANNEL_ID=@AuthorizedCinemaChannel
# TELEGRAM_API_ID=your_api_id
# TELEGRAM_API_HASH=your_api_hash
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

---

### Step 3: Seed Database

Populate MongoDB with 10 movies, 5 TV series, 30+ season episodes, multi-quality media streams, sample admin & user accounts, and pending Telegram channel posts:

```bash
cd server
npm run seed
```

**Default Credentials:**
- **Admin**: `admin@cinestream.com` / `admin123`
- **Test User**: `user@cinestream.com` / `user123`

---

### Step 4: Run Development Servers

In terminal 1 (Backend):
```bash
npm run dev:server
```
*(Server runs at `http://localhost:5000`)*

In terminal 2 (Frontend):
```bash
npm run dev:client
```
*(Client runs at `http://localhost:5173`)*

---

## 🔒 Security & Privacy

- **JWT Tokens & HTTP-Only Cookies**: Secure authentication for account features.
- **Helmet & CORS**: Hardened HTTP security headers.
- **Sanitized Inputs**: Defense against Mongo injection attacks.
- **Storage Credential Shielding**: Private storage tokens and channel IDs remain on the server.
