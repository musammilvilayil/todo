@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title StudyForge AI PWA - Netlify Deploy

echo.
echo ========================================================
echo   STUDYFORGE 3.0 - AI PERSONAL PLANNER PWA

echo ========================================================
echo.
echo This deploys the PWA + secure AI function to:
echo   https://studyforge-pwa.netlify.app
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  goto :fail
)
where npx >nul 2>nul
if errorlevel 1 goto :fail

if not exist "pwa\index.html" (
  echo ERROR: pwa\index.html is missing. Run git pull first.
  goto :fail
)
if not exist "netlify\functions\plan.mts" (
  echo ERROR: AI planning function is missing. Run git pull first.
  goto :fail
)

echo [1/3] Checking Netlify login...
call npx -y netlify-cli@latest status >nul 2>nul
if errorlevel 1 (
  echo Netlify login is needed once. A browser will open.
  call npx -y netlify-cli@latest login
  if errorlevel 1 goto :fail
)

echo.
echo [2/3] Checking StudyForge site link...
if exist ".netlify\state.json" (
  echo Project already linked locally. Skipping relink.
) else (
  call npx -y netlify-cli@latest link --id d1747533-ba7c-428b-a920-658319c6a272
  if errorlevel 1 goto :fail
)

echo.
echo [3/3] Deploying PWA + AI function to production...
call npx -y netlify-cli@latest deploy --prod --dir pwa --functions netlify/functions --message "StudyForge 3 AI Planner"
if errorlevel 1 goto :fail

echo.
echo ========================================================
echo   DEPLOY COMPLETE

echo   Open on iPhone Safari:
echo   https://studyforge-pwa.netlify.app

echo   Then: Share -^> Add to Home Screen

echo ========================================================
echo.
pause
exit /b 0

:fail
echo.
echo ========================================================
echo   DEPLOY STOPPED WITH AN ERROR

echo   Keep this window open and send only the error above.
echo   Never send your Gemini API key.
echo ========================================================
echo.
pause
exit /b 1
