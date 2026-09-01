# StudyForge

Native Expo study planner for MERN + Digital Marketing with schedule-aware iPhone Battery Care.

**Version:** `2.3.0`  
**Build:** `SF-GH-20260901-BAT`

## Run from Windows to iPhone

1. Install Node.js 22 LTS (recommended).
2. Install Expo Go on the iPhone.
3. Clone/download this repo.
4. Double-click `SETUP-AND-RUN-WINDOWS.bat`.
5. If asked for `@expo/ngrok`, press `Y`.
6. Scan the tunnel QR with Expo Go.

After setup, use `RUN-WINDOWS.bat`.

## Core StudyForge features

- MERN + Digital Marketing daily schedule
- Study / Light / Off Day
- 5 Namaz + location-based prayer time refresh
- Native local notifications
- Protected 10 PM chat/personal time
- Tasks & assessments
- Learning materials
- Focus timer
- Progress dashboard
- Persistent local storage

## Battery Care Planner

The Today screen now contains a live Battery Care card powered by `expo-battery`.

It includes:

- Live battery percentage
- Charging / unplugged / full state
- iOS Low Power Mode indicator
- Default 80% maximum care target
- Dynamic targets:
  - Study Day: up to the selected maximum (80% by default)
  - Light Day: 70% by default
  - Off Day: 60% by default
- Smart `Plug in now`, `Top-up`, `No charge needed`, and `Unplug around ...` charging to-dos
- Estimated minutes to target
- Tomorrow-morning plug-in time based on the next StudyForge day mode
- Local reminder near the estimated unplug time
- Local morning charging reminder
- Monthly reminder to manually log Battery Health
- Charging-session history
- Learned charging speed from tracked sessions
- Healthy-unplug tracking
- Low-battery event tracking
- One-day `Travel / long day` 100% override
- Manual Battery Health % log
- Manual Cycle Count log
- User-selectable maximum target: 80 / 85 / 90 / 100
- User-selectable low-battery top-up threshold: 25 / 30 / 35

## Important iPhone limitations

StudyForge can read current battery level, charging state, and Low Power Mode on a physical iPhone through Expo Battery.

A normal iOS app cannot:

- physically stop the charger at 80%
- change the iPhone's system Charge Limit
- directly read Battery Health %
- directly read Cycle Count
- guarantee background battery-threshold detection while the app is fully terminated

So Battery Health and Cycle Count are manual logs, while charging targets are recommendations/reminders.

The goal is not to reduce app performance. The Battery Care Planner is designed to help avoid unnecessary deep discharges, unnecessary long periods at very high charge, and unnecessary full charging on lighter days.

## Stability

This project deliberately avoids the previous dependency problems:

- no PowerShell setup
- no `expo-font`
- no `@expo/vector-icons`
- no blur/gradient native modules
- no npm overrides
- no `expo install --fix`

Battery support uses `expo-battery ~10.0.8`, compatible with the Expo SDK 54 project.
