@echo off
setlocal
cd /d "%~dp0"

set PORT=8080
set PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  set PID=%%a
  goto :kill_old
)
goto :start_new

:kill_old
echo Found existing server on port %PORT% (PID %PID%). Stopping it...
taskkill /PID %PID% /F >nul 2>&1
timeout /t 1 /nobreak >nul

:start_new
echo Starting local game server in a new window...
start "Game Server" cmd /k "cd /d %~dp0 && node server.js"

echo Waiting for server to start...
timeout /t 2 /nobreak >nul

echo Opening game in browser...
start "" "http://127.0.0.1:8080/game.html"

echo Done.
endlocal
