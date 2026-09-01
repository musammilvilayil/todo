@echo off
setlocal
cd /d "%~dp0"
title StudyForge - Quick Run
if not exist node_modules (
  echo Run SETUP-AND-RUN-WINDOWS.bat first.
  pause
  exit /b 1
)

echo Trying Expo Tunnel mode...
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
echo StudyForge could not start in Tunnel or LAN mode.
echo Send the output above to ChatGPT.
pause
exit /b 1

:end
echo.
echo Expo stopped.
pause
endlocal
