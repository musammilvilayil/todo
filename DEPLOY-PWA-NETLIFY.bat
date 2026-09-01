@echo off
setlocal
cd /d "%~dp0"
title StudyForge PWA - Netlify Deploy

echo.
echo ========================================================
echo   STUDYFORGE PWA - FREE STANDALONE HOME SCREEN VERSION
echo ========================================================
echo.
echo This deploys the PWA folder to:
echo   https://studyforge-pwa.netlify.app
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js, reopen Command Prompt, then run again.
  goto :fail
)

where npx >nul 2>nul
if errorlevel 1 (
  echo ERROR: npx was not found.
  goto :fail
)

if not exist "pwa\index.html" (
  echo ERROR: pwa\index.html is missing.
  echo Run git pull first.
  goto :fail
)

echo [1/3] Checking Netlify login...
call npx -y netlify-cli@latest status >nul 2>nul
if errorlevel 1 (
  echo.
  echo Netlify login is needed once.
  echo A browser window will open. Sign in and authorize the CLI.
  echo.
  call npx -y netlify-cli@latest login
  if errorlevel 1 goto :fail
)

echo.
echo [2/3] Linking StudyForge PWA site...
call npx -y netlify-cli@latest link --id d1747533-ba7c-428b-a920-658319c6a272
if errorlevel 1 goto :fail

echo.
echo [3/3] Deploying production PWA...
call npx -y netlify-cli@latest deploy --prod --dir pwa --message "StudyForge PWA"
if errorlevel 1 goto :fail

echo.
echo ========================================================
echo   DEPLOY COMPLETE

echo   Open on iPhone Safari:
echo   https://studyforge-pwa.netlify.app

echo   Then: Share -^> Add to Home Screen

echo   After first online load, core features work offline.
echo ========================================================
echo.
pause
exit /b 0

:fail
echo.
echo ========================================================
echo   DEPLOY STOPPED WITH AN ERROR

echo   Keep this window open and send the error above.
echo ========================================================
echo.
pause
exit /b 1
