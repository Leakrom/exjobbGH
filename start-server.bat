@echo off
cd /d "%~dp0"
echo Starting local game server...
node server.js
if errorlevel 1 (
  echo.
  echo Could not start server. Make sure Node.js is installed and available in PATH.
)
echo.
echo Press any key to close this window.
pause >nul
