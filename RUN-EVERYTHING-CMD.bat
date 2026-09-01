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
echo   5. Start Expo Go in Tunnel mode
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 22 LTS, reopen Command Prompt, then run this again.
  goto :fail
)

echo Node version:
node -v
echo npm version:
npm -v
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

echo   If Expo asks to install @expo/ngrok, type Y and Enter.
echo   Then scan the NEW QR code with Expo Go on the iPhone.
echo ========================================================
echo.

call npx expo start --tunnel -c
if errorlevel 1 goto :fail

goto :end

:fail
echo.
echo ========================================================
echo   STUDYFORGE STOPPED WITH AN ERROR

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
