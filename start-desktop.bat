@echo off
setlocal

rem Opens the built Telegram Drive app directly, with no dev server.
rem Build it, or rebuild after code changes, with:
rem     cd app ^&^& npm run tauri build -- --no-bundle

set "APP_EXE=%~dp0app\src-tauri\target\release\app.exe"

if not exist "%APP_EXE%" (
    echo No release build found at:
    echo     %APP_EXE%
    echo Build it once with: cd app ^&^& npm run tauri build -- --no-bundle
    pause
    exit /b 1
)

start "" "%APP_EXE%"
endlocal
