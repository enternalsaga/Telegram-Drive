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

rem Vite binds port 1420, and a previous run can outlive its terminal. Reclaim
rem the port rather than failing deep inside Vite with an unhelpful stack trace.
rem Only whatever is listening on 1420 is stopped, which for this project is the
rem dev server named by devUrl in tauri.conf.json.
set "NETSTAT=%SystemRoot%\System32\netstat.exe"
set "FINDSTR=%SystemRoot%\System32\findstr.exe"
set "TASKKILL=%SystemRoot%\System32\taskkill.exe"
set "TIMEOUT=%SystemRoot%\System32\timeout.exe"
"%NETSTAT%" -ano | "%FINDSTR%" "LISTENING" | "%FINDSTR%" ":1420" >nul 2>&1
if not errorlevel 1 (
    echo Port 1420 is still held by an earlier run. Stopping it:
    rem cmd cannot parse a for /f command that opens with a quote, and these
    rem System32 paths contain no spaces, so they are used bare here.
    for /f "tokens=5" %%p in ('%NETSTAT% -ano ^| %FINDSTR% "LISTENING" ^| %FINDSTR% ":1420"') do (
        echo     stopping PID %%p
        "%TASKKILL%" /PID %%p /T /F >nul 2>&1
    )
    rem Windows frees a listening socket slightly after the process exits.
    "%TIMEOUT%" /t 2 /nobreak >nul 2>&1
    "%NETSTAT%" -ano | "%FINDSTR%" "LISTENING" | "%FINDSTR%" ":1420" >nul 2>&1
    if not errorlevel 1 (
        echo Port 1420 is still in use after stopping those processes.
        echo Something outside this project is holding it; close it and try again.
        goto :fail
    )
    echo     port released
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
