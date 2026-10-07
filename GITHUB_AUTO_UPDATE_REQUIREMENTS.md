# 🚀 HƯỚNG DẪN TỰ ĐỘNG CẬP NHẬT GITHUB RELEASE (.EXE & .DEB)

Hệ thống đã được tích hợp bộ tự động phát hiện và thông báo bản cập nhật từ **GitHub Releases** dành cho các bản đóng gói chạy trên Windows (`.exe`) và Linux (`.deb` / `.AppImage`).

---

## 📋 1. Cấu Trúc Đóng Gói Và Phát Hành

- **Mã nguồn ứng dụng**: `philiptrinh30/oppo-label-studio`
- **Windows Target**: `.exe` (NSIS Setup & Portable)
- **Linux Target**: `.deb` (Gói Debian/Ubuntu chuẩn) & `.AppImage`
- **Tự động đăng tải**: Tích hợp với **GitHub Actions** trong file `.github/workflows/release.yml`.

---

## 🛠️ 2. Quy Trình Tạo Bản Cập Nhật Mới (Release)

Khi có tính năng mới hoặc nâng cấp hệ thống:

### Bước 1: Cập nhật phiên bản trong `package.json`
```json
{
  "version": "1.0.1"
}
```

### Bước 2: Push code và Tag lên GitHub
```bash
git add .
git commit -m "Nâng cấp hệ thống v1.0.1: Bổ sung bước 3a Nhập kho chưa đủ LK"
git tag v1.0.1
git push origin main --tags
```

### Bước 3: GitHub Actions Tự Động Đóng Gói
- GitHub Workflow (`.github/workflows/release.yml`) sẽ tự động được kích hoạt.
- Build ứng dụng và đóng gói ra các file:
  - `OPPO-Label-Studio-Setup-1.0.1.exe`
  - `OPPO-Label-Studio-1.0.1.deb`
  - `OPPO-Label-Studio-1.0.1.AppImage`
- Tự động tạo một Release mới trên GitHub với đầy đủ các file đính kèm trên.

---

## 🔔 3. Cơ Chế Tự Động Thông Báo Trên Ứng Dụng (Client Auto-Update Notifier)

- **Khi mở ứng dụng**: Hệ thống tự động gửi request đến `https://api.github.com/repos/philiptrinh30/oppo-label-studio/releases/latest`.
- **Nếu phát hiện tag phiên bản mới hơn phiên bản hiện tại**:
  1. Hiển thị **Thanh thông báo nổi (Banner Notification)** ở góc dưới màn hình.
  2. Bấm nút **"Cập nhật GitHub"** trên thanh tiêu đề để mở Hộp thoại chi tiết.
  3. Cung cấp đường dẫn **Tải trực tiếp file `.exe` (Windows)** và **`.deb` (Linux)**.
  4. Hiển thị nội dung mô tả nâng cấp (Changelog / Release Notes).

---

## 💻 4. Các Lệnh Build Đóng Gói Thủ Công

Nếu muốn đóng gói thủ công trên máy cục bộ:
- **Build gói `.deb` (Linux)**:
  ```bash
  npm run build:deb
  ```
- **Build gói `.exe` (Windows)**:
  ```bash
  npm run build:win
  ```
- **Build tất cả định dạng (`.exe` + `.deb` + `.AppImage`)**:
  ```bash
  npm run build:all
  ```
