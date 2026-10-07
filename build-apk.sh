#!/usr/bin/env bash
set -e

echo "========================================================================="
echo "   HCM4 OPPO - DONG GOI VA BUILD FILE APK CHO ANDROID (LINUX / MAC)"
echo "========================================================================="
echo ""

if [ ! -d "node_modules" ]; then
    echo "[0/3] Đang tự động chạy npm install..."
    npm install
fi

echo "[1/3] Đang biên dịch Web App..."
npm run build

echo ""
echo "[2/3] Đang đồng bộ mã nguồn vào Android..."
npx cap sync android

echo ""
echo "[3/3] Đang biên dịch file APK với Gradle..."
cd android
if [ -f "./gradlew" ]; then
    chmod +x ./gradlew
    ./gradlew assembleDebug
    echo ""
    echo "========================================================================="
    echo " [THÀNH CÔNG] File APK đã được tạo tại:"
    echo "android/app/build/outputs/apk/debug/app-debug.apk"
    echo "========================================================================="
else
    echo "Chưa tìm thấy gradlew, bạn có thể chạy: npx cap open android"
fi
