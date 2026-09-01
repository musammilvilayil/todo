@echo off
setlocal
cd /d "%~dp0"
title StudyForge 2.3 - Battery Care Setup
echo.
echo =====================================================
echo   STUDYFORGE 2.3 - BATTERY CARE - SF-GH-20260901-BAT
echo =====================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 22 LTS and run this file again.
  pause
  exit /b 1
)
echo Node version:
node -v
echo.
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
if exist .expo rmdir /s /q .expo
echo Installing Expo SDK 54 + Battery Care dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail
echo.
echo Verifying battery module...
call npm ls expo-battery
if errorlevel 1 goto :fail
echo.
echo Trying Expo Tunnel mode first...
echo If asked to install @expo/ngrok, type Y and press Enter.
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
echo STUDYFORGE STOPPED WITH AN ERROR
echo The window will stay open. Send the lines above to ChatGPT.
pause
exit /b 1

:end
echo.
echo Expo stopped normally.
pause
endlocal
