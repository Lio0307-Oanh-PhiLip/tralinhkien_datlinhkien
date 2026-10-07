#!/usr/bin/env bash
# ====================================================================
# Script Đóng Gói Ứng Dụng OPPO Label Studio Sang Định Dạng Linux AppImage
# ====================================================================

set -e

echo "🚀 Bắt đầu quá trình đóng gói OPPO Label Studio sang AppImage..."

# 1. Kiểm tra Node.js & npm
if ! command -v npm &> /dev/null; then
    echo "❌ Lỗi: Chưa tìm thấy npm. Vui lòng cài đặt Node.js trước khi chạy script."
    exit 1
fi

echo "📦 1/3. Cài đặt các gói phụ thuộc..."
npm install

echo "🎨 Chuẩn bị icon chất lượng cao từ thiết kế OPPO Label Studio..."
node generate_all_icons.cjs

echo "🔨 2/3. Biên dịch mã nguồn giao diện web (Vite production build)..."
npm run build

echo "🎁 3/3. Đóng gói electron thành file thực thi độc lập Linux AppImage..."
npx electron-builder --linux AppImage --config electron-builder.json

echo "===================================================================="
echo "✅ HOÀN TẤT ĐÓNG GÓI APPIMAGE THÀNH CÔNG!"
echo "📁 File AppImage nằm tại thư mục: ./release/"
echo "💡 Cách chạy trên Linux:"
echo "   chmod +x ./release/*.AppImage"
echo "   ./release/*.AppImage"
echo "===================================================================="
