@echo off
setlocal
cd /d "%~dp0"
title StudyForge - Tunnel
if not exist node_modules ( echo Run SETUP-AND-RUN-WINDOWS.bat first. & pause & exit /b 1 )
call npx expo start --tunnel -c
echo Expo stopped. If unexpected, send the output to ChatGPT.
pause
endlocal
