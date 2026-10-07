import React, { useState } from 'react';
import { X, Printer, AlertTriangle, Terminal, Package, Copy, Check, Sparkles, Monitor } from 'lucide-react';
import iconPng from '../assets/icon.png';

interface PrinterGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrinterGuideModal: React.FC<PrinterGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'printer' | 'appimage' | 'linux_icon'>('linux_icon');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 1500);
  };

  const linuxIconFixCmd = `curl -sSL ${window.location.origin}/install-linux-icon.sh | bash`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-neutral-200">
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2">
            {activeTab === 'linux_icon' ? (
              <Sparkles className="w-5 h-5 text-emerald-600" />
            ) : activeTab === 'printer' ? (
              <Printer className="w-5 h-5 text-blue-600" />
            ) : (
              <Package className="w-5 h-5 text-indigo-600" />
            )}
            <h3 className="font-bold text-neutral-900 text-sm">
              {activeTab === 'linux_icon'
                ? 'Sửa Icon Taskbar Linux (Xóa Icon Bánh Răng)'
                : activeTab === 'printer'
                ? 'Hướng Dẫn Cài Đặt Máy In Chuẩn Khổ 3x2 inch'
                : 'Đóng Gói Desktop App (Windows & Linux)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-neutral-200 bg-neutral-100/70 text-xs font-semibold px-4 pt-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('linux_icon')}
            className={`pb-2 px-3 border-b-2 cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'linux_icon'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md shadow-2xs'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sửa Icon Taskbar Linux</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('printer')}
            className={`pb-2 px-3 border-b-2 cursor-pointer transition-all shrink-0 ${
              activeTab === 'printer'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-md shadow-2xs'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Cài đặt máy in tem 3x2
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appimage')}
            className={`pb-2 px-3 border-b-2 cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'appimage'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-md shadow-2xs'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Đóng gói Desktop (Win / Linux)</span>
          </button>
        </div>

        {activeTab === 'linux_icon' ? (
          <div className="p-5 space-y-4 text-xs text-neutral-700 leading-relaxed max-h-[70vh] overflow-y-auto">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex gap-3 items-start">
              <div className="w-10 h-10 rounded-xl bg-white border border-emerald-300 p-1 shrink-0 flex items-center justify-center shadow-xs">
                <img src={iconPng} alt="OPPO Icon" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <p className="font-bold text-emerald-950 text-sm">
                  Cài Đặt Icon Tem Linh Kiện Chuẩn Cho Linux Taskbar
                </p>
                <p className="text-emerald-800 text-[11px] mt-0.5 leading-relaxed">
                  Trên các hệ điều hành Linux (XFCE, Ubuntu, Debian, Mint), thanh tác vụ (Taskbar) bắt buộc cần file <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-emerald-900">.desktop</code> và bộ nhớ đệm Icon hệ thống để hiển thị icon đẹp mắt thay vì icon bánh răng mặc định.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-900 text-white rounded-xl space-y-2 border border-neutral-800 shadow-md">
              <div className="flex items-center justify-between text-neutral-300">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" />
                  <span>Chạy lệnh 1 dòng trên Terminal (Tự động 100% trong 1 giây):</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(linuxIconFixCmd, 'linux_fix_cmd')}
                  className="inline-flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors"
                >
                  {copiedCmd === 'linux_fix_cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd === 'linux_fix_cmd' ? 'Đã chép lệnh' : 'Sao chép lệnh'}</span>
                </button>
              </div>
              <div className="bg-black/60 text-emerald-300 font-mono p-3 rounded-lg text-xs overflow-x-auto select-all border border-neutral-800">
                <code>{linuxIconFixCmd}</code>
              </div>
            </div>

            <div className="space-y-2 border border-neutral-200 rounded-xl p-3 bg-neutral-50/70">
              <h4 className="font-bold text-neutral-900 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-blue-600" />
                <span>Lệnh trên thực hiện những gì cho máy tính của bạn?</span>
              </h4>
              <ul className="space-y-1.5 text-neutral-600 text-[11px] list-disc list-inside">
                <li>Tự động đăng ký icon tem in chất lượng cao 512x512 vào <code className="font-mono text-neutral-800">~/.local/share/icons/hicolor</code>.</li>
                <li>Tự động tạo lối tắt chuẩn <code className="font-mono text-neutral-800">oppo-label-studio.desktop</code> trong danh sách ứng dụng và Màn hình chính (Desktop).</li>
                <li>Đồng bộ hóa tên cửa sổ X11 với Taskbar, biến icon bánh răng thành icon tem OPPO chuyên nghiệp ngay lập tức!</li>
              </ul>
            </div>
          </div>
        ) : activeTab === 'printer' ? (
          <div className="p-5 space-y-4 text-xs text-neutral-700 leading-relaxed max-h-[70vh] overflow-y-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">
                  Để tem in ra không bị lệch lề hoặc nhảy trang trắng:
                </p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Khi hộp thoại In của trình duyệt hiện lên, vui lòng kiểm tra 4 thông số sau:
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 p-2 bg-neutral-50 rounded border border-neutral-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  1
                </span>
                <div>
                  <strong className="text-neutral-900">Máy in đích (Destination):</strong>
                  <p className="text-neutral-600">Chọn đúng máy in mã vạch (Xprinter, Zebra, TSC, Godex, HPRT, Brother...).</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 bg-neutral-50 rounded border border-neutral-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  2
                </span>
                <div>
                  <strong className="text-neutral-900">Khổ giấy (Paper Size):</strong>
                  <p className="text-neutral-600">Chọn khổ <span className="font-mono font-bold text-blue-700">3" x 2"</span> hoặc <span className="font-mono font-bold text-blue-700">76mm x 51mm</span> (hoặc kích thước tem bạn đã đặt trong Driver máy in).</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 bg-neutral-50 rounded border border-neutral-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  3
                </span>
                <div>
                  <strong className="text-neutral-900">Lề (Margins):</strong>
                  <p className="text-neutral-600">Chọn <span className="font-bold text-red-600">Không có (None)</span> hoặc <span className="font-bold text-neutral-800">Tối thiểu (Minimum)</span> để nội dung nằm trọn trong con tem.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 bg-neutral-50 rounded border border-neutral-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  4
                </span>
                <div>
                  <strong className="text-neutral-900">Tùy chọn khác (Options):</strong>
                  <p className="text-neutral-600">
                    • <strong>Tắt</strong> mục <span className="underline">Đầu trang và chân trang (Headers and footers)</span>.<br />
                    • <strong>Bật</strong> mục <span className="underline">Đồ họa nền (Background graphics)</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4 text-xs text-neutral-700 leading-relaxed max-h-[70vh] overflow-y-auto">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              <p className="font-bold text-indigo-950">
                📦 Đóng gói ứng dụng Desktop độc lập (Windows .exe & Linux .AppImage)
              </p>
              <p className="text-indigo-800 text-[11px] mt-1 leading-relaxed">
                Ứng dụng đã được tích hợp đầy đủ Icon tem nhãn chuẩn cho Windows Taskbar và Linux Desktop, liên kết tự động cơ sở dữ liệu Cloud PostgreSQL / Firestore và chế độ Auto-Update OTA.
              </p>
            </div>

            {/* SECTION 1: WINDOWS */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between font-bold text-blue-950">
                <span className="flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  <span>1. Đóng gói cho Windows (.exe Setup & Portable)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('npm run build:win', 'win_cmd')}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                >
                  {copiedCmd === 'win_cmd' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd === 'win_cmd' ? 'Đã chép' : 'Sao chép lệnh'}</span>
                </button>
              </div>
              <div className="bg-neutral-900 text-emerald-400 font-mono p-2.5 rounded-lg text-[11px] overflow-x-auto">
                <code>npm run build:win</code>
              </div>
              <div className="space-y-1 text-[11px] text-neutral-700 bg-white p-2.5 rounded-lg border border-blue-100">
                <p>
                  👉 <strong>Bản Cài Đặt (Setup):</strong> <code className="font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded">release/OPPO-Label-Studio-Setup-1.0.0.exe</code> (Tự động ghim Icon Taskbar & Start Menu).
                </p>
                <p>
                  👉 <strong>Bản Chạy Ngay (Portable):</strong> <code className="font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">release/OPPO-Label-Studio-Portable-1.0.0.exe</code> (Mở trực tiếp trên USB/Máy tính).
                </p>
                <p className="text-neutral-500 mt-1">
                  💡 <em>Người dùng Windows cũng có thể chạy trực tiếp tập lệnh <code className="font-mono text-neutral-800 font-bold">build-windows.bat</code> hoặc <code className="font-mono text-neutral-800 font-bold">./build-windows.sh</code>.</em>
                </p>
              </div>
            </div>

            {/* SECTION 2: LINUX */}
            <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between font-bold text-orange-950">
                <span className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-orange-600" />
                  <span>2. Đóng gói cho Linux (.AppImage Ubuntu/Debian/Mint/Arch)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('npm run build:linux', 'linux_cmd')}
                  className="inline-flex items-center gap-1 text-[11px] text-orange-700 hover:text-orange-900 font-semibold cursor-pointer"
                >
                  {copiedCmd === 'linux_cmd' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd === 'linux_cmd' ? 'Đã chép' : 'Sao chép lệnh'}</span>
                </button>
              </div>
              <div className="bg-neutral-900 text-emerald-400 font-mono p-2.5 rounded-lg text-[11px] overflow-x-auto">
                <code>npm run build:linux</code>
              </div>
              <p className="text-[11px] text-neutral-600">
                👉 Cấp quyền và chạy: <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-mono text-orange-800">chmod +x release/*.AppImage && ./release/*.AppImage</code>
              </p>
            </div>

            {/* SECTION 3: MULTI-PLATFORM */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between font-bold text-emerald-950">
                <span>3. Đóng gói tất cả nền tảng 1 lượt (Linux + Windows Setup + Portable)</span>
                <button
                  type="button"
                  onClick={() => handleCopy('npm run build:all', 'all_cmd')}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
                >
                  {copiedCmd === 'all_cmd' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd === 'all_cmd' ? 'Đã chép' : 'Sao chép lệnh'}</span>
                </button>
              </div>
              <div className="bg-neutral-900 text-emerald-400 font-mono p-2 rounded-lg text-[11px] overflow-x-auto">
                <code>npm run build:all</code>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-[11px] text-neutral-600 space-y-1">
              <div className="font-semibold text-neutral-900 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-neutral-700" />
                <span>Chạy thử ứng dụng trên môi trường phát triển (Electron Dev):</span>
              </div>
              <p className="font-mono text-neutral-800 bg-white p-1.5 rounded border border-neutral-200">
                npm run electron:dev
              </p>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors"
          >
            Đã hiểu, đóng hộp thoại
          </button>
        </div>
      </div>
    </div>
  );
};

