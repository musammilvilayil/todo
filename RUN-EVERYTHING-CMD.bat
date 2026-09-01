@echo off
setlocal
cd /d "%~dp0"
title StudyForge - Run Everything

echo.
echo ========================================================
echo   STUDYFORGE - RUN EVERYTHING FROM COMMAND PROMPT
echo ========================================================
echo.
echo This will:
echo   1. Check Node.js
echo   2. Install/update dependencies
echo   3. Run Expo Doctor
echo   4. Test the iOS JavaScript bundle
echo   5. Start Expo Go (Tunnel first, LAN fallback)
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 22 LTS, reopen Command Prompt, then run this again.
  goto :fail
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found.
  echo Reinstall Node.js, reopen Command Prompt, then run this again.
  goto :fail
)

echo Node version:
node -v
echo npm version:
call npm -v
if errorlevel 1 goto :fail
echo.

echo [1/4] Installing/updating project dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

echo.
echo [2/4] Running Expo Doctor...
call npx -y expo-doctor@latest
if errorlevel 1 goto :fail

echo.
echo [3/4] Testing iOS JavaScript bundle...
if exist .studyforge-ios-check rmdir /s /q .studyforge-ios-check
call npx expo export --platform ios --output-dir .studyforge-ios-check
if errorlevel 1 goto :fail
if exist .studyforge-ios-check rmdir /s /q .studyforge-ios-check

echo.
echo ========================================================
echo   ALL CHECKS PASSED - STARTING STUDYFORGE
echo ========================================================
echo.
echo Trying Tunnel mode first...
echo If Expo asks to install @expo/ngrok, type Y and Enter.
echo.
call npx expo start --tunnel -c
if not errorlevel 1 goto :end

echo.
echo Tunnel could not connect. Falling back to LAN mode...
echo Make sure iPhone and PC are on the SAME Wi-Fi.
echo If Windows Firewall asks, allow Node.js on Private networks.
echo.
call npx expo start --lan -c
if errorlevel 1 goto :fail

goto :end

:fail
echo.
echo ========================================================
echo   STUDYFORGE STOPPED WITH AN ERROR
echo.
echo   Do not close this window yet.
echo   Send the error lines above to ChatGPT.
echo ========================================================
echo.
pause
exit /b 1

:end
echo.
echo Expo stopped normally.
pause
endlocal
