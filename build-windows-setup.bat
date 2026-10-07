@echo off
title Build OPPO Label Studio - Setup Installer (.exe)
echo ====================================================================
echo  Building OPPO Label Studio Setup Installer (.exe)...
echo ====================================================================

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / npm not found on your system.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [1/3] Installing dependencies...
call npm install

echo.
echo [2/3] Generating Windows Icons and Building Web App...
call node generate_all_icons.cjs
call npm run build

echo.
echo [3/3] Packaging NSIS Installer Setup (.exe)...
call npx electron-builder --win nsis --config electron-builder.json
if %errorlevel% neq 0 (
    echo [ERROR] Packaging failed.
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo  SETUP INSTALLER CREATED SUCCESSFULLY!
echo  Location: release\OPPO-Label-Studio-Setup-1.0.0.exe
echo ====================================================================
echo.
pause
