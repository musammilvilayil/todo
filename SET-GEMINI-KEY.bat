@echo off
setlocal
cd /d "%~dp0"
title StudyForge - Configure Gemini

echo.
echo ========================================================
echo   STUDYFORGE 3.0 - CONFIGURE GEMINI SECURELY

echo ========================================================
echo.
echo Your Gemini API key will be stored in Netlify environment variables.
echo It will NOT be written into this repo or the public PWA files.
echo.

where node >nul 2>nul
if errorlevel 1 goto :fail
where npx >nul 2>nul
if errorlevel 1 goto :fail

call npx -y netlify-cli@latest status >nul 2>nul
if errorlevel 1 (
  echo Netlify login is required once. A browser will open.
  call npx -y netlify-cli@latest login
  if errorlevel 1 goto :fail
)

call npx -y netlify-cli@latest link --id d1747533-ba7c-428b-a920-658319c6a272
if errorlevel 1 goto :fail

echo.
set /p GEMINI_API_KEY=Paste your Gemini API key here and press Enter: 
if "%GEMINI_API_KEY%"=="" goto :fail

call npx -y netlify-cli@latest env:set GEMINI_API_KEY "%GEMINI_API_KEY%"
if errorlevel 1 goto :fail
set "GEMINI_API_KEY="

echo.
echo Setting default model: gemini-3.7-flash
call npx -y netlify-cli@latest env:set GEMINI_MODEL "gemini-3.7-flash"
if errorlevel 1 goto :fail

echo.
echo ========================================================
echo   GEMINI CONFIGURED

echo   Now run: DEPLOY-PWA-NETLIFY.bat

echo ========================================================
pause
exit /b 0

:fail
set "GEMINI_API_KEY="
echo.
echo Gemini setup stopped. Keep this window open and send the error above.
pause
exit /b 1
