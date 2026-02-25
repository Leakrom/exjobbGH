@echo off
setlocal
set PORT=8080
set PID=

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  set PID=%%a
  goto :found
)

echo No server found listening on port %PORT%.
goto :end

:found
echo Stopping server on port %PORT% (PID %PID%)...
taskkill /PID %PID% /F >nul 2>&1
if errorlevel 1 (
  echo Could not stop PID %PID%. Try closing the server window manually.
) else (
  echo Server stopped.
)

:end
echo.
echo Press any key to close this window.
pause >nul
endlocal
