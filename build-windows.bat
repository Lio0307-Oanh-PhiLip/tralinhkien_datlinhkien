@echo off
title Build OPPO Label Studio for Windows
echo ====================================================================
echo  Starting OPPO Label Studio Windows Packaging (.exe)...
echo ====================================================================

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / npm not found on your system.
    echo Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [1/3] Installing dependencies (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Generating Windows Icons and Building Vite App...
call node generate_all_icons.cjs
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Vite build failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Packaging Windows Setup (.exe) and Portable (.exe)...
call npx electron-builder --win nsis portable --config electron-builder.json
if %errorlevel% neq 0 (
    echo [ERROR] electron-builder packaging failed.
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo  BUILD SUCCESSFUL!
echo  Check your executables in: release\
echo.
echo  1. Installer Setup: release\OPPO-Label-Studio-Setup-1.0.0.exe
echo  2. Portable Exe:    release\OPPO-Label-Studio-Portable-1.0.0.exe
echo ====================================================================
echo.
pause
