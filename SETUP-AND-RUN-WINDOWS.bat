@echo off
setlocal
cd /d "%~dp0"
title StudyForge - Clean Setup
echo.
echo ================================================
echo   STUDYFORGE CLEAN BUILD - SF-GH-20260901
echo ================================================
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
echo Installing minimal Expo SDK 54 dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail
echo.
echo Starting Expo Tunnel mode...
echo If asked to install @expo/ngrok, type Y and press Enter.
call npx expo start --tunnel -c
if errorlevel 1 goto :fail
goto :end
:fail
echo.
echo STUDYFORGE STOPPED WITH AN ERROR
echo The window will stay open. Send the lines above to ChatGPT.
pause
exit /b 1
:end
pause
endlocal
