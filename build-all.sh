#!/usr/bin/env bash
# ====================================================================
# Script Đóng Gói OPPO Label Studio Cho Cả 2 Hệ Điều Hành (Linux & Windows)
# ====================================================================

set -e

echo "🚀 Bắt đầu quá trình đóng gói OPPO Label Studio Đa Nền Tảng (Windows & Linux)..."

# 1. Kiểm tra Node.js & npm
if ! command -v npm &> /dev/null; then
    echo "❌ Lỗi: Chưa tìm thấy npm. Vui lòng cài đặt Node.js trước khi chạy script."
    exit 1
fi

echo "📦 1/3. Cài đặt các gói phụ thuộc..."
npm install

echo "🎨 Chuẩn bị icon chuẩn định dạng cho Linux & Windows..."
node generate_all_icons.cjs

echo "🔨 2/3. Biên dịch mã nguồn giao diện web (Vite build)..."
npm run build

echo "🎁 3/3. Đóng gói cho cả Linux AppImage và Windows Setup/Portable..."
npx electron-builder -wl --config electron-builder.json

echo "===================================================================="
echo "✅ HOÀN TẤT ĐÓNG GÓI TẤT CẢ CÁC BẢN THÀNH CÔNG!"
echo "📁 Thư mục xuất file: ./release/"
echo ""
echo "🐧 LINUX:"
echo "   👉 ./release/*.AppImage"
echo ""
echo "🪟 WINDOWS:"
echo "   👉 ./release/OPPO-Label-Studio-Setup-1.0.0.exe (Bản cài đặt)"
echo "   👉 ./release/OPPO-Label-Studio-Portable-1.0.0.exe (Bản chạy ngay)"
echo "===================================================================="
