@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title StudyForge - Configure Gemini Securely

echo.
echo ========================================================
echo   STUDYFORGE 3.0 - CONFIGURE GEMINI SECURELY
echo ========================================================
echo.
echo The key is stored only in Netlify as a production secret.
echo It is NOT written into this repo or the public PWA bundle.
echo Do NOT paste the key into ChatGPT, screenshots, logs, or messages.
echo.

where node >nul 2>nul
if errorlevel 1 goto :fail
where npx >nul 2>nul
if errorlevel 1 goto :fail
where powershell >nul 2>nul
if errorlevel 1 goto :fail

call npx -y netlify-cli@latest status >nul 2>nul
if errorlevel 1 (
  echo Netlify login is required once. A browser will open.
  call npx -y netlify-cli@latest login
  if errorlevel 1 goto :fail
)

call npx -y netlify-cli@latest link --id d1747533-ba7c-428b-a920-658319c6a272 >nul
if errorlevel 1 goto :fail

echo.
echo Paste your NEW Gemini API key below.
echo For privacy, nothing will appear while you type or paste.
for /f "usebackq delims=" %%K in (`powershell -NoProfile -Command "$s=Read-Host 'Gemini API key' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"`) do set "GEMINI_API_KEY=%%K"
if not defined GEMINI_API_KEY goto :fail

echo.
echo Saving key as a Netlify production secret...
call npx -y netlify-cli@latest env:set GEMINI_API_KEY "%GEMINI_API_KEY%" --context production --secret >nul 2>nul
if errorlevel 1 goto :fail
set "GEMINI_API_KEY="

echo.
echo Gemini model is already configured by StudyForge.
echo.
echo ========================================================
echo   GEMINI CONFIGURED SECURELY
echo   Next: call DEPLOY-PWA-NETLIFY.bat
echo ========================================================
echo.
pause
exit /b 0

:fail
set "GEMINI_API_KEY="
echo.
echo ========================================================
echo   GEMINI SETUP STOPPED WITH AN ERROR
echo   Run this file again after: git pull
echo   Send only the error text. Never send your API key.
echo ========================================================
echo.
pause
exit /b 1
