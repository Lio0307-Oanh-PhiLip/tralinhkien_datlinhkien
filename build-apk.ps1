# Script Build APK cho PowerShell
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "   HCM4 OPPO - DONG GOI VA BIEN DICH FILE APK CHO ANDROID (PowerShell)" -ForegroundColor Cyan
Write-Host "=========================================================================`n"

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[LỖI CRITICAL] Chưa cài đặt Node.js trên máy tính!" -ForegroundColor Red
    Write-Host "Vui lòng tải Node.js tại https://nodejs.org/"
    Read-Host -Prompt "Nhấn Enter để thoát"
    exit
}

node build-apk.js
