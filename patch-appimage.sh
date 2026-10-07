#!/bin/bash
set -e

echo "========================================================="
echo " CÔNG CỤ THAY ĐỔI ICON TRỰC TIẾP CHO APPIMAGE (SIÊU TỐC)"
echo "========================================================="

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Sử dụng: ./patch-appimage.sh <Đường_dẫn_file_AppImage_cũ> <Đường_dẫn_file_Icon_mới.png>"
    echo "Ví dụ: ./patch-appimage.sh 'OPPO Label Studio.AppImage' 'new-icon.png'"
    exit 1
fi

APPIMAGE_PATH="$1"
NEW_ICON="$2"

if [ ! -f "$APPIMAGE_PATH" ]; then
    echo "❌ Không tìm thấy file AppImage: $APPIMAGE_PATH"
    exit 1
fi

if [ ! -f "$NEW_ICON" ]; then
    echo "❌ Không tìm thấy file Icon: $NEW_ICON"
    exit 1
fi

echo "📥 1. Đang tải công cụ AppImageTool (chỉ tải 1 lần)..."
if [ ! -f "appimagetool-x86_64.AppImage" ]; then
    wget -q --show-progress https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
    chmod +x appimagetool-x86_64.AppImage
fi

echo "📦 2. Đang giải nén AppImage cũ..."
rm -rf squashfs-root
chmod +x "$APPIMAGE_PATH"
"$APPIMAGE_PATH" --appimage-extract > /dev/null

echo "🎨 3. Đang tiêm Icon mới vào AppImage..."
# Cập nhật icon ở mọi ngóc ngách trong AppImage
cp -f "$NEW_ICON" squashfs-root/.DirIcon
cp -f "$NEW_ICON" squashfs-root/oppo-label-studio.png
cp -f "$NEW_ICON" squashfs-root/usr/share/icons/hicolor/0x0/apps/oppo-label-studio.png 2>/dev/null || true
cp -f "$NEW_ICON" squashfs-root/usr/share/icons/hicolor/512x512/apps/oppo-label-studio.png 2>/dev/null || true
cp -f "$NEW_ICON" squashfs-root/usr/share/icons/hicolor/256x256/apps/oppo-label-studio.png 2>/dev/null || true
cp -f "$NEW_ICON" squashfs-root/resources/icon.png 2>/dev/null || true
cp -f "$NEW_ICON" squashfs-root/resources/app/icon.png 2>/dev/null || true

# Tìm và đè tất cả các file ảnh png khác đóng vai trò icon (nếu có)
find squashfs-root -name "oppo-label-studio.png" -exec cp -f "$NEW_ICON" {} \;
find squashfs-root -name "icon.png" -exec cp -f "$NEW_ICON" {} \;

echo "🏗️ 4. Đang đóng gói lại thành AppImage mới..."
NEW_APPIMAGE_NAME="OPPO_Label_Studio_Patched.AppImage"
export ARCH=x86_64
./appimagetool-x86_64.AppImage squashfs-root "$NEW_APPIMAGE_NAME" > /dev/null

echo "🧹 5. Đang dọn dẹp file tạm..."
rm -rf squashfs-root

echo "========================================================="
echo "✅ HOÀN TẤT! Đã tạo ra file AppImage mới có Icon chuẩn:"
echo "👉 $NEW_APPIMAGE_NAME"
echo "Bạn có thể gửi file này cho bất kỳ ai, Icon sẽ tự động hoạt động!"
echo "========================================================="
