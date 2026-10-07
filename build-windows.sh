#!/usr/bin/env bash
# ====================================================================
# Script Đóng Gói Ứng Dụng OPPO Label Studio Cho Windows (Setup & Portable)
# ====================================================================

set -e

echo "🚀 Bắt đầu quá trình đóng gói OPPO Label Studio cho Windows (.exe)..."

# 1. Kiểm tra Node.js & npm
if ! command -v npm &> /dev/null; then
    echo "❌ Lỗi: Chưa tìm thấy npm. Vui lòng cài đặt Node.js trước khi chạy script."
    exit 1
fi

echo "📦 1/3. Cài đặt các gói phụ thuộc..."
npm install

echo "🎨 Chuẩn bị icon chuẩn Windows (.ico & đa kích thước taskbar)..."
node generate_all_icons.cjs

echo "🔨 2/3. Biên dịch mã nguồn giao diện web (Vite production build)..."
npm run build

echo "🎁 3/3. Đóng gói file cài đặt (NSIS Setup .exe) và bản chạy ngay (Portable .exe)..."
npx electron-builder --win nsis portable --config electron-builder.json

echo "===================================================================="
echo "✅ HOÀN TẤT ĐÓNG GÓI WINDOWS THÀNH CÔNG!"
echo "📁 Các file EXE đã được tạo tại thư mục: ./release/"
echo ""
echo "📌 1. Bản Cài Đặt (Setup EXE - Có Icon Taskbar & Start Menu):"
echo "   👉 ./release/OPPO-Label-Studio-Setup-1.0.0.exe"
echo ""
echo "📌 2. Bản Portable (Chạy Ngay Không Cần Cài Đặt):"
echo "   👉 ./release/OPPO-Label-Studio-Portable-1.0.0.exe"
echo "===================================================================="
