@echo off
setlocal enabledelayedexpansion

echo =========================================================================
echo    HCM4 OPPO - DONG GOI VA BIEN DICH FILE APK CHO ANDROID
echo =========================================================================
echo.

:: Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI NGHIEP TRONG] May tinh chua cai dat Node.js!
    echo Vui long truy cap https://nodejs.org/ va tai ban LTS ve cai dat.
    pause
    exit /b 1
)

:: Tu dong run node build-apk.js
node build-apk.js

if %errorlevel% neq 0 (
    echo.
    echo [THONG BAO] Neus may tinh chua co Java JDK 17+, vui long mo Android Studio:
    echo     1. Chay lenh: npx cap open android
    echo     2. Tren Android Studio, chon Menu: Build -^> Build Bundle(s) / APK(s) -^> Build APK(s)
    echo.
)

pause
