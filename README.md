# StudyForge

StudyForge has two versions in this repo:

- **Native Expo version** for development/testing in Expo Go.
- **PWA version** in `pwa/` for free iPhone Home Screen use without Apple Developer, Mac, Metro or laptop server.

**Native version:** `2.3.0`  
**Build:** `SF-GH-20260901-BAT`

## Free iPhone Home Screen PWA

The PWA is designed to be hosted at:

`https://studyforge-pwa.netlify.app`

A Netlify site with that name has already been created. To publish/update it securely from Windows, run:

```bat
git pull
call DEPLOY-PWA-NETLIFY.bat
```

The first run may open a browser for a one-time Netlify CLI login. No Netlify token is stored in this public repository.

After deployment:

1. Open `https://studyforge-pwa.netlify.app` in **Safari** on iPhone.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Open StudyForge once while online so the offline cache is populated.

The Home Screen version opens in standalone mode and does not need Expo Go, Metro, the laptop, or the same Wi-Fi after it has been cached.

### PWA features

- Study / Light / Off Day schedules
- MERN + Digital Marketing daily flow
- 5 Namaz tracking and optional location-based prayer-time refresh
- Tasks & assessments
- Learning materials
- Focus timer
- Progress dashboard
- Protected 10 PM personal time
- Offline-first service worker cache
- LocalStorage persistence on the iPhone
- Battery Care charging planner
- 80 / 85 / 90 / 100 maximum target choices
- Light Day and Off Day lower charging targets
- Travel / long-day 100% override
- Manual Battery Health and Cycle Count history
- Charging-time estimate and suggested unplug time
- Tomorrow-morning charging recommendation

### Battery Care on the web

iPhone Safari does **not** expose live battery percentage or charging state to normal web apps. The PWA therefore uses a quick manual battery update for current percentage/charging state, then recalculates charging recommendations. The native Expo build can use `expo-battery` for live readings.

## Fresh native Expo install from Windows

Run these commands one by one:

```bat
cd /d "%USERPROFILE%\Downloads"
if exist StudyForge rmdir /s /q StudyForge
git clone https://github.com/musammilvilayil/todo.git StudyForge
cd /d "%USERPROFILE%\Downloads\StudyForge"
call RUN-EVERYTHING-CMD.bat
```

Do not combine the `if exist` line with `&&`; when the folder does not exist, CMD can stop the rest of that chain.

## Native Expo run

`RUN-EVERYTHING-CMD.bat` checks Node/npm, installs dependencies, runs Expo Doctor, tests the iOS bundle, then starts Expo. The Windows launchers try Tunnel first and fall back to LAN when tunnel connectivity fails.

The native version includes live `expo-battery` support, location prayer refresh, local notifications, tasks, learning materials, focus timer and progress tracking.

## Important iPhone limitations

A normal iOS app or PWA cannot physically stop charging at 80%, change the iPhone system Charge Limit, directly read Battery Health %, or directly read Cycle Count. Battery Health and Cycle Count are manual logs in StudyForge.

The Battery Care Planner is intended to improve charging habits through planning and reminders, not to guarantee a particular Battery Health result.
