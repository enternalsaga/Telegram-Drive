@echo off
setlocal

rem Launches the Telegram Drive desktop app in Tauri dev mode.
rem Frontend edits hot-reload; Rust edits trigger a rebuild and restart.

rem Work from the repository root, wherever this file is launched from.
cd /d "%~dp0app" || (
    echo Could not find the "app" folder next to this script.
    goto :fail
)

rem rustup installs cargo here but does not always put it on PATH.
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)

where cargo >nul 2>&1 || (
    echo cargo was not found. Install Rust from https://rustup.rs and reopen this window.
    goto :fail
)
where npm >nul 2>&1 || (
    echo npm was not found. Install Node.js 20 or newer and reopen this window.
    goto :fail
)

if not exist "node_modules" (
    echo Installing frontend dependencies, this runs only once...
    call npm install || goto :fail
)

rem Vite binds port 1420. Without this check a second instance fails deep inside
rem Vite with a stack trace that hides the real cause.
set "NETSTAT=%SystemRoot%\System32\netstat.exe"
set "FINDSTR=%SystemRoot%\System32\findstr.exe"
"%NETSTAT%" -ano | "%FINDSTR%" "LISTENING" | "%FINDSTR%" ":1420" >nul 2>&1
if not errorlevel 1 (
    echo Port 1420 is already in use, so Telegram Drive is most likely running already.
    echo Close that window, or stop the process holding the port:
    rem cmd cannot parse a for /f command that opens with a quote, and these
    rem System32 paths contain no spaces, so they are used bare here.
    for /f "tokens=5" %%p in ('%NETSTAT% -ano ^| %FINDSTR% "LISTENING" ^| %FINDSTR% ":1420"') do echo     taskkill /PID %%p /F
    goto :fail
)

echo Starting Telegram Drive. The first launch compiles Rust and can take several minutes.
call npm run tauri dev || goto :fail

endlocal
exit /b 0

:fail
echo.
echo Startup failed. The error above explains why.
pause
endlocal
exit /b 1
