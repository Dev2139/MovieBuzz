# MovieBuzz Mobile (Flutter Frontend App)

MovieBuzz Mobile is a high-performance cross-platform Flutter mobile client for the MovieBuzz cinema platform. It connects directly to the existing MovieBuzz backend server and MongoDB database without requiring any changes to the existing web app or server.

---

## 📱 Features

1. **Cinema-Grade Dark UI**:
   - Modern Netflix-grade aesthetic matching the MovieBuzz brand palette (`#09090B`, `#E50914`, `#121218`).
   - Clean Inter typography using `google_fonts`.
   - Shimmer skeleton loaders and smooth card animations.

2. **Home Feed**:
   - Dynamic Hero Banner with featured movies and web series.
   - Continue Watching row with watch progress bars and resume playback.
   - Quick genre chip filtering.
   - Trending Movies & Popular Web Series carousels.

3. **Movies & Web Series Exploration**:
   - Grid catalogues with real-time sorting (Most Popular, Top Rated, Latest Released).
   - Genre filter chips.

4. **Rich Detail View**:
   - High-resolution backdrop trailer/hero header.
   - Rating, genres, release year, cast, and storyline synopsis.
   - **Movies**: Available stream qualities (1080p, 720p, 480p).
   - **Series**: Season selector dropdown and episode list with thumbnails, durations, and descriptions.

5. **Integrated Video Player**:
   - Streaming video playback powered by `video_player`.
   - Auto-resume playback from last saved timestamp.
   - Periodic watch progress sync with MovieBuzz server (every 10s) and offline local storage.
   - 10s rewind & fast forward, playback speed selector (0.75x - 2.0x), seeking bar.

6. **Instant Search**:
   - Real-time debounced search for movies and web series.
   - Filter search results by All, Movies, or Series.
   - Quick suggestion chips for popular genres.

7. **My Library (Watchlist & Favorites)**:
   - Synchronized with user account on the backend.
   - Offline fallback using `shared_preferences`.

8. **Watch History**:
   - Visual progress indicators showing percentage completed.
   - One-tap resume playback.

9. **Community Requests Leaderboard**:
   - Upvote requested movies and series.
   - Submit new movie / series requests with title, year, notes, and type.

10. **Authentication & Profile**:
    - Sign in / Register with JWT tokens stored securely.
    - CineCoins loyalty rewards balance display.
    - Configurable Backend Server URL in settings (easily switch between Android Emulator `10.0.2.2:5000`, local Wi-Fi IP `192.168.x.x:5000`, or deployed cloud backend).

---

## 🚀 How to Run

### 1. Ensure the MovieBuzz Server is Running
In the root directory, start the server:
```bash
cd ../server
npm run dev
```
(Server will be running on `http://localhost:5000`)

### 2. Run the Flutter Mobile App
In this `mobile` directory:

#### Run on Windows Desktop:
```bash
flutter run -d windows
```

#### Run on Android Emulator:
```bash
flutter run -d android
```
*(On Android Emulator, the app connects to your computer's server via `http://10.0.2.2:5000/api` automatically).*

#### Run on a Physical Android Phone:
Connect your phone via USB (with USB debugging enabled) or over Wi-Fi:
```bash
flutter run
```
*Note: In the app's Profile -> "Backend API Server Configuration", enter your computer's local Wi-Fi IP address (e.g., `http://192.168.1.100:5000/api`).*

#### Build Release APK:
```bash
flutter build apk --release
```
The APK will be generated at `build/app/outputs/flutter-apk/app-release.apk`.
