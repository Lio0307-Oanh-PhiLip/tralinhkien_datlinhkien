const fs = require('fs');

const b64 = fs.readFileSync('./public/icon.png', 'base64');

const shellScript = `#!/bin/bash
# ==============================================================================
# OPPO Label Studio - Linux Taskbar & Desktop Icon Auto-Installer
# ==============================================================================
set -e
echo "🚀 [OPPO Label Studio] Đang cài đặt Icon tem in linh kiện và phím tắt Desktop Linux..."

HOME_DIR="\${HOME:-/root}"
APP_DIR="\${HOME_DIR}/.local/share/applications"
ICON_DIR="\${HOME_DIR}/.local/share/icons/hicolor/512x512/apps"
BIN_DIR="\${HOME_DIR}/.local/bin"
DESKTOP_DIR="\${HOME_DIR}/Desktop"
DESKTOP_DIR_VN="\${HOME_DIR}/Màn hình nền"

# 1. Tạo thư mục
mkdir -p "\${APP_DIR}" "\${ICON_DIR}" "\${BIN_DIR}"

# 2. Giải mã và lưu Icon
echo "📥 Cài đặt icon tem in linh kiện độ nét cao..."
ICON_BASE64="${b64}"
echo "\$ICON_BASE64" | base64 -d > "\${ICON_DIR}/oppo-label-studio.png"

# 3. Tạo script khởi chạy thông minh (Wrapper Script)
# Script này sẽ tự động tìm file AppImage mỗi khi bạn click vào biểu tượng!
WRAPPER_SCRIPT="\${BIN_DIR}/run-oppo-label-studio.sh"
cat << 'EOF' > "\$WRAPPER_SCRIPT"
#!/bin/bash
# Tìm file AppImage trên toàn bộ thư mục của người dùng (Downloads, Desktop, v.v.)
APP_PATH=\$(find "\$HOME" -maxdepth 5 -name "*OPPO*Label*.AppImage" 2>/dev/null | head -n 1)

if [ -n "\$APP_PATH" ] && [ -f "\$APP_PATH" ]; then
    # Cấp quyền thực thi và chạy
    chmod +x "\$APP_PATH"
    exec "\$APP_PATH" "\$@"
else
    # Nếu không tìm thấy, thử báo lỗi
    if command -v zenity >/dev/null 2>&1; then
        zenity --error --text="Không tìm thấy file OPPO Label Studio AppImage. Vui lòng tải về và để ngoài Desktop hoặc thư mục Downloads."
    else
        echo "Lỗi: Không tìm thấy file AppImage."
    fi
    exit 1
fi
EOF
chmod +x "\$WRAPPER_SCRIPT"

# 4. Tạo file .desktop (Lối tắt)
DESKTOP_PATH="\${APP_DIR}/oppo-label-studio.desktop"
cat << EOF > "\$DESKTOP_PATH"
[Desktop Entry]
Version=1.0
Type=Application
Name=OPPO Label Studio
GenericName=Trình In Tem Linh Kiện Khổ 3x2 inch
Comment=OPPO Label Studio - Barcode & QR Thermal Label Printer
Exec="\${WRAPPER_SCRIPT}" %U
Icon=\${ICON_DIR}/oppo-label-studio.png
Terminal=false
Categories=Office;Utility;Printing;
StartupWMClass=oppo-label-studio
StartupNotify=true
EOF
chmod +x "\$DESKTOP_PATH"

# Copy ra ngoài màn hình chính (Desktop)
if [ -d "\$DESKTOP_DIR" ]; then
    cp "\$DESKTOP_PATH" "\${DESKTOP_DIR}/oppo-label-studio.desktop"
    chmod +x "\${DESKTOP_DIR}/oppo-label-studio.desktop"
fi
if [ -d "\$DESKTOP_DIR_VN" ]; then
    cp "\$DESKTOP_PATH" "\${DESKTOP_DIR_VN}/oppo-label-studio.desktop"
    chmod +x "\${DESKTOP_DIR_VN}/oppo-label-studio.desktop"
fi

# 5. Cập nhật hệ thống
echo "🔄 Cập nhật bộ nhớ đệm Icon hệ thống..."
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "\${APP_DIR}" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "\${HOME_DIR}/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo "=========================================================================="
echo "✅ HOÀN TẤT CÀI ĐẶT ICON VÀ LỐI TẮT!"
echo "✨ Lối tắt OPPO Label Studio đã được cấu hình tự động tìm AppImage."
echo "💡 Hãy ra màn hình Desktop, click đúp vào biểu tượng để chạy."
echo "=========================================================================="
`

fs.writeFileSync('install-linux-icon.sh', shellScript);
fs.writeFileSync('public/install-linux-icon.sh', shellScript);
console.log('Script rewritten successfully.');
