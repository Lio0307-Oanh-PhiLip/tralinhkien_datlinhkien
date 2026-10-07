import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Download,
  CheckCircle2,
  Share2,
  ShieldCheck,
  RefreshCw,
  Zap,
  Globe,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  X,
  Info,
  QrCode,
  Wifi,
  HardDrive,
  Users,
  KeyRound,
  FileCheck,
  ArrowRight,
  ShieldAlert,
  Terminal,
  Code2,
  Play,
  FolderDown,
  FileCode,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface MobileAppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status?: 'pending' | 'approved' | 'rejected';
  } | null;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
}

export const MobileAppInstallModal: React.FC<MobileAppInstallModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShowToast,
}) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, triggerInstall } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'cli' | 'install' | 'qrcode' | 'auth' | 'sync' | 'apk_guide'>('cli');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 260,
        margin: 1.5,
        color: {
          dark: '#064e3b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Error generating QR code:', err));
    }
  }, [currentUrl]);

  if (!isOpen) return null;

  const pwaBuilderUrl = currentUrl
    ? `https://www.pwabuilder.com/reportcard?url=${encodeURIComponent(currentUrl)}`
    : 'https://www.pwabuilder.com/';

  const handleCopyUrl = () => {
    if (navigator.clipboard && currentUrl) {
      navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      onShowToast('Đã sao chép liên kết ứng dụng vào bộ nhớ tạm!', 'success');
      setTimeout(() => setCopiedUrl(false), 3000);
    }
  };

  const handleCopyCmd = (cmd: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(cmd);
      setCopiedCmd(key);
      onShowToast('Đã sao chép dòng lệnh vào bộ nhớ tạm!', 'success');
      setTimeout(() => setCopiedCmd(null), 3000);
    }
  };

  const handleDownloadBuildScript = () => {
    const scriptContent = `@echo off
setlocal enabledelayedexpansion

echo =========================================================================
echo    HCM4 OPPO - DONG GOI VA BIEN DICH FILE APK CHO ANDROID
echo =========================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI NGHIEP TRONG] May tinh chua cai dat Node.js!
    echo Vui long truy cap https://nodejs.org/ va tai ban LTS ve cai dat truoc.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\\" (
    echo [0/4] Phat hien chua co thu vien node_modules.
    echo       Dang tu dong chay 'npm install' de cai dat thu vien (co the mat 1-2 phut)...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [LOI] Khong the cai dat thu vien bang npm install! Vui long kiem tra ket noi mang.
        pause
        exit /b %errorlevel%
    )
    echo.
    echo [OK] Da cai dat xong thu vien!
    echo.
)

if not exist "node_modules\\.bin\\vite.cmd" if not exist "node_modules\\.bin\\vite" (
    echo [0/4] Dang bo sung cac goi Vite va Capacitor...
    call npm install
)

echo [1/4] Dang bien dich Web Application (Vite Build)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Bien dich web that bai! Dang thu cai dat lai thu vien roi thu lai...
    call npm install
    call npm run build
    if %errorlevel% neq 0 (
        echo [LOI] Khong the bien dich Web.
        pause
        exit /b %errorlevel%
    )
)

echo.
echo [2/4] Dang dong bo ma nguon vao project Android (Capacitor Sync)...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [LOI] Dong bo Capacitor that bai!
    pause
    exit /b %errorlevel%
)

echo.
echo [3/4] Dang bien dich ma nguon Android thanh file APK (Gradlew Build)...
cd android
if exist "gradlew.bat" (
    call gradlew.bat assembleDebug
    if %errorlevel% neq 0 (
        echo.
        echo -------------------------------------------------------------------------
        echo [THONG BAO] May tinh cua ban chua co Java JDK 17+ hoac Android SDK.
        echo Ban co the mo du an bang Android Studio de tao APK de dang:
        echo     1. Chay lenh: npx cap open android
        echo     2. Tren Android Studio, chon Menu: Build -^> Build Bundle(s) / APK(s) -^> Build APK(s)
        echo     3. File APK se duoc tao tai: android\\app\\build\\outputs\\apk\\debug\\app-debug.apk
        echo -------------------------------------------------------------------------
        cd ..
        pause
        exit /b 0
    )
) else (
    echo [LOI] Khong tim thay file gradlew.bat trong thu muc android!
    cd ..
    pause
    exit /b 1
)

cd ..
echo.
echo =========================================================================
echo  [THANH CONG] File APK da duoc tao tai:
echo  android\\app\\build\\outputs\\apk\\debug\\app-debug.apk
echo =========================================================================
echo.
echo Ban co the chep file app-debug.apk nay gui qua Zalo de cai len moi dien thoai Android!
echo.
pause
`;
    const blob = new Blob([scriptContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'build-apk.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('Đã tải xuống file build-apk.bat đã tích hợp tự động sửa lỗi Vite!', 'success');
  };

  const handleDirectInstall = async () => {
    const result = await triggerInstall();
    if (result === 'accepted') {
      onShowToast('Đã bắt đầu cài đặt ứng dụng về điện thoại Android của bạn!', 'success');
      onClose();
    } else if (result === 'dismissed') {
      onShowToast('Đã hủy thao tác cài đặt.', 'info');
    } else {
      onShowToast('Trình duyệt chưa sẵn sàng mở popup, vui lòng làm theo hướng dẫn 3 bước bên dưới hoặc quét mã QR.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white text-stone-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-stone-900 to-emerald-950 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">Ứng Dụng Điện Thoại Android</h3>
                <span className="bg-emerald-500 text-stone-950 font-mono text-[10px] font-black px-2 py-0.5 rounded-full">
                  PWA & WebAPK
                </span>
              </div>
              <p className="text-xs text-stone-300 font-medium">
                Cài đặt trực tiếp, đồng bộ Real-time 2 chiều & xác thực bảo mật
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800/80 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-stone-100 px-4 py-2 border-b border-stone-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cli'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Chạy Lệnh Build APK (Code)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('install')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'install'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Cài Đặt WebAPK Android</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qrcode')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'qrcode'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Quét Mã QR Điện Thoại</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'auth'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-purple-50 hover:text-purple-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Đồng Bộ Tài Khoản & Bảo Mật</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sync'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-teal-50 hover:text-teal-800'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Đồng Bộ Dữ Liệu Real-time</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('apk_guide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'apk_guide'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-blue-50 hover:text-blue-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tạo File APK Độc Lập</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm bg-stone-50/50">
          {/* TAB 0: Chạy Lệnh Build APK trực tiếp từ Code */}
          {activeTab === 'cli' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-amber-950 font-black text-sm">
                    <Terminal className="w-5 h-5 text-amber-600" />
                    <span>Dự Án Android Native & Capacitor Đã Tích Hợp Sẵn!</span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-amber-600 text-white font-mono text-[10px] font-bold rounded-full">
                    Capacitor Native APK
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                  Toàn bộ mã nguồn thư mục <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-bold">/android</code> đã được khởi tạo hoàn chỉnh cùng đầy đủ quyền hạn (Camera quét mã vạch, Internet, Bộ nhớ). Bạn có thể biên dịch ra file <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-bold">app-debug.apk</code> hoặc <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-bold">app-release.apk</code> bằng các lệnh bên dưới.
                </p>
              </div>

              {/* Quick 1-Click Batch File Download */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h5 className="font-black text-xs text-stone-900 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-emerald-600" />
                    <span>File Script Tự Động Build APK 1-Click (Windows Batch)</span>
                  </h5>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Tải file <code className="font-mono text-emerald-700 font-bold">build-apk.bat</code> về thư mục dự án và nhấp đúp chuột để tự động sinh file APK.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBuildScript}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <FolderDown className="w-4 h-4" />
                  <span>Tải build-apk.bat</span>
                </button>
              </div>

              {/* Commands List */}
              <div className="space-y-3">
                <h5 className="font-black text-xs text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-600" />
                  <span>Các lệnh chạy từ Terminal / Command Prompt:</span>
                </h5>

                {/* Command 0: npm install */}
                <div className="bg-amber-950/90 text-amber-100 p-3.5 rounded-2xl border border-amber-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300">
                      ⚠️ BƯỚC 1 (Bắt buộc nếu mới tải mã nguồn về máy): Cài đặt thư viện
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCmd('npm install', 'cmd0')}
                      className="px-2 py-1 bg-amber-900/80 hover:bg-amber-800 text-amber-200 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedCmd === 'cmd0' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd === 'cmd0' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-amber-300 overflow-x-auto p-1 bg-black/40 rounded-lg">
                    npm install
                  </pre>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Khắc phục triệt để lỗi <code>'vite' is not recognized</code> bằng cách tải đầy đủ thư mục <code>node_modules</code> về máy tính.
                  </p>
                </div>

                {/* Command 1 */}
                <div className="bg-stone-900 text-stone-100 p-3.5 rounded-2xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-400">
                      BƯỚC 2: Chạy lệnh 1-Dòng biên dịch tự động xuất file APK
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCmd('npm run build:apk', 'cmd1')}
                      className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedCmd === 'cmd1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd === 'cmd1' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-emerald-400 overflow-x-auto p-1 bg-stone-950/60 rounded-lg">
                    npm run build:apk
                  </pre>
                  <p className="text-[11px] text-stone-400">
                    &rarr; Tự động chạy <code className="text-stone-300 font-mono">vite build</code> &rarr; đồng bộ vào Android &rarr; chạy Gradle xuất file APK.
                  </p>
                </div>

                {/* Command 2: Manual PowerShell / CMD execution */}
                <div className="bg-stone-900 text-stone-100 p-3.5 rounded-2xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-400">
                      Chạy trực tiếp Gradle trong PowerShell hoặc CMD:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCmd('cd android; .\\gradlew.bat assembleDebug', 'cmd2_ps')}
                      className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedCmd === 'cmd2_ps' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd === 'cmd2_ps' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-emerald-400 overflow-x-auto p-1 bg-stone-950/60 rounded-lg">
                    cd android{'\n'}
                    .\gradlew.bat assembleDebug
                  </pre>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    👉 <em>Lưu ý PowerShell trên Windows:</em> Cần có <code className="text-amber-300 font-mono">.\</code> trước <code className="text-amber-300 font-mono">gradlew.bat</code> (VD: <code className="text-emerald-300 font-mono">.\gradlew.bat assembleDebug</code>).
                  </p>
                </div>

                {/* Command 3 */}
                <div className="bg-stone-900 text-stone-100 p-3.5 rounded-2xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-400">
                      Mở trong Android Studio (Nhấn Build APK)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCmd('npx cap open android', 'cmd2')}
                      className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedCmd === 'cmd2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd === 'cmd2' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-emerald-400 overflow-x-auto p-1 bg-stone-950/60 rounded-lg">
                    npx cap open android
                  </pre>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    &rarr; Mở Android Studio &rarr; chọn Menu <strong>Build &rarr; Build Bundle(s) / APK(s) &rarr; Build APK(s)</strong>.
                  </p>
                </div>

                {/* Output Location */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Vị trí file APK xuất ra sau khi build:</span>
                  </div>
                  <div className="p-2 bg-stone-100 rounded-xl font-mono text-[11px] text-stone-800 select-all break-all border border-stone-200">
                    android/app/build/outputs/apk/debug/app-debug.apk
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Bạn chỉ cần copy file <code className="font-bold text-stone-700">app-debug.apk</code> này gửi qua Zalo / Google Drive và cài đặt trực tiếp lên mọi điện thoại Android!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: Cài đặt App Android qua WebAPK có chữ ký Google Play */}
          {activeTab === 'install' && (
            <div className="space-y-4">
              {/* Highlight Install Action */}
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-stone-900 text-sm">
                        {isInstalled ? 'Ứng dụng đã cài đặt trên thiết bị' : 'Cài đặt App Android (Ký số WebAPK)'}
                      </h4>
                      <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-md">
                        Đủ điều kiện cài đặt
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      Khi cài qua Android Chrome/Samsung Internet, Google Play Services tự động cấp <strong>chữ ký số hợp lệ (WebAPK)</strong>, chạy toàn màn hình, có icon ứng dụng độc lập, quét camera mã vạch và nhận thông báo mượt mà.
                    </p>
                  </div>
                </div>

                {isInstallable && !isInstalled && (
                  <button
                    type="button"
                    onClick={handleDirectInstall}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>CÀI ĐẶT 1 CHẠM</span>
                  </button>
                )}
              </div>

              {/* Step by step installation */}
              <div className="bg-white p-4.5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                <h5 className="font-black text-xs uppercase tracking-wider text-stone-800 flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-600" />
                  <span>3 Bước cài đặt nhanh trên điện thoại Android (Chrome / Cốc Cốc / Edge):</span>
                </h5>

                <ol className="space-y-2.5 text-xs text-stone-700">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="text-stone-900">Mở link trên điện thoại:</strong> Mở link web app trên trình duyệt Google Chrome hoặc Cốc Cốc (hoặc quét mã QR ở tab bên cạnh).
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="text-stone-900">Bấm biểu tượng Menu (dấu 3 chấm ⋮):</strong> Ở góc trên bên phải thanh công cụ trình duyệt điện thoại.
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <strong className="text-stone-900">Chọn "Cài đặt ứng dụng" (Install App)</strong> hoặc <strong className="text-stone-900">"Thêm vào Màn hình chính"</strong>. Điện thoại sẽ tự động sinh file APK có chữ ký số và gắn icon app vào màn hình chính.
                    </div>
                  </li>
                </ol>

                {/* Share Link box */}
                <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex-1 bg-stone-100 px-3 py-2 rounded-xl text-xs font-mono text-stone-700 truncate w-full border border-stone-200">
                    {currentUrl}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="w-full sm:w-auto px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Đã sao chép' : 'Sao chép link gửi qua Zalo'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Quét mã QR mở app trên điện thoại */}
          {activeTab === 'qrcode' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center gap-5">
                {qrDataUrl && (
                  <div className="bg-white p-3 rounded-2xl border border-emerald-300 shadow-md shrink-0 flex flex-col items-center">
                    <img
                      src={qrDataUrl}
                      alt="QR Code Mobile App"
                      className="w-48 h-48 rounded-xl object-contain"
                    />
                    <span className="text-[10px] font-bold text-stone-500 mt-2">Mã QR truy cập tức thì</span>
                  </div>
                )}

                <div className="space-y-2.5 text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-900 font-black text-xs rounded-lg">
                    <QrCode className="w-4 h-4 text-emerald-700" />
                    <span>Quét để mở trực tiếp trên Camera / Zalo</span>
                  </div>
                  <h4 className="text-sm font-black text-stone-900">
                    Dùng Camera điện thoại Android hoặc Quét QR trên Zalo
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    1. Mở ứng dụng <strong>Camera</strong> hoặc tính năng <strong>Quét mã QR trong Zalo</strong> trên điện thoại Android.<br />
                    2. Hướng ống kính vào mã QR bên trái.<br />
                    3. Bấm vào liên kết xuất hiện trên màn hình để mở ngay ứng dụng.<br />
                    4. Bấm <strong>Menu 3 chấm ⋮ &rarr; Cài đặt ứng dụng</strong> để lưu app về máy.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Xác thực & Tài khoản Toàn Hệ Thống */}
          {activeTab === 'auth' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                <div className="flex items-center gap-2.5 text-purple-900 font-black text-sm mb-1">
                  <KeyRound className="w-5 h-5 text-purple-600" />
                  <span>Đồng Bộ Tài Khoản Toàn Hệ Thống (PC, Web & Mobile App)</span>
                </div>
                <p className="text-xs text-purple-800 leading-relaxed">
                  Tất cả tài khoản người dùng được lưu trữ tập trung tại <strong>Cloud Firestore</strong>. Bất kỳ tài khoản nào đã tạo và được phê duyệt đều đăng nhập được trên <strong>Web, Phần mềm PC Windows và App Android</strong> mà không cần tạo lại.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Tài khoản Quản trị viên (Admin)</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Tài khoản Admin có toàn quyền phê duyệt tài khoản mới, xóa/sửa phiếu, khóa quyền truy cập từ xa cho nhân viên đã nghỉ việc trên điện thoại.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Tài khoản Nhân viên / KTV</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Sau khi đăng ký trên điện thoại, tài khoản ở trạng thái <em>Chờ duyệt</em>. Khi Admin bấm Duyệt trên máy tính, app trên điện thoại sẽ tự động mở khóa tức thì.
                  </p>
                </div>
              </div>

              {currentUser && (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                    <div>
                      <div className="font-bold text-stone-900">
                        Đang đăng nhập: {currentUser.name} ({currentUser.role === 'admin' ? 'Quản trị viên' : 'Kỹ thuật viên / Nhân viên'})
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                        Mã tài khoản Cloud: {currentUser.uid}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-600 text-white font-black rounded-lg text-[10px] tracking-wide">
                    ĐÃ ĐỒNG BỘ TOÀN HỆ THỐNG
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Đồng bộ trực tiếp Real-time */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl">
                <div className="flex items-center gap-2.5 text-teal-900 font-black text-sm mb-1">
                  <Zap className="w-5 h-5 text-teal-600" />
                  <span>Cơ chế Đồng bộ trực tiếp Hai chiều (Cloud Firestore Live Listeners)</span>
                </div>
                <p className="text-xs text-teal-800 leading-relaxed">
                  Tất cả thao tác trên điện thoại Android (thêm phiếu thiếu linh kiện, lưu thiết bị IoT, chuyển bước trạng thái, ghi chú cuộc gọi, quét mã QR/Barcode) đều được truyền trực tiếp tức thì lên Cloud Firestore.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <Wifi className="w-4 h-4 text-emerald-600" />
                    <span>Khi có mạng Internet (4G/5G/Wifi)</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Dữ liệu cập nhật real-time trong &lt; 0.5s cho toàn bộ nhân viên và quản trị viên khác đang mở máy tính hoặc điện thoại.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <HardDrive className="w-4 h-4 text-blue-600" />
                    <span>Khi mất mạng tạm thời (Offline Mode)</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Hệ thống lưu trữ trên bộ nhớ đệm an toàn của thiết bị di động (LocalStorage & IndexedDB) và tự động đồng bộ lên Cloud ngay khi có mạng trở lại.
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-2">
                <h5 className="font-black text-xs text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Các phân hệ được đồng bộ tự động 100%:</span>
                </h5>
                <ul className="text-xs text-stone-700 space-y-1.5 list-disc list-inside">
                  <li><strong>Phiếu đặt chờ linh kiện</strong> (Đủ 4 bước: Chờ linh kiện, SVD, Đã nhập kho, Hoàn tất).</li>
                  <li><strong>Quản lý Máy & Thiết bị IoT</strong> (Tiếp nhận, Chờ linh kiện, Gửi đi, Đã trả khách).</li>
                  <li><strong>Danh mục linh kiện & Danh bạ Kỹ thuật viên</strong> trực thuộc trung tâm.</li>
                  <li><strong>Nhật ký hoạt động & Phê duyệt tài khoản người dùng</strong>.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 5: Đóng gói APK / TWA */}
          {activeTab === 'apk_guide' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <div className="flex items-center gap-2.5 text-blue-900 font-black text-sm mb-1">
                  <Layers className="w-5 h-5 text-blue-600" />
                  <span>Xuất file cài đặt APK độc lập có chứng chỉ chữ ký số (PWABuilder / TWA)</span>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Nếu bạn cần phân phối file cài đặt định dạng <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono font-bold">.apk</code> kèm chữ ký số đầy đủ để chia sẻ file qua Zalo, Telegram hoặc Google Drive:
                </p>
              </div>

              <div className="bg-white p-4.5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
                <h5 className="font-black text-xs text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  <span>Tạo file APK có ký số tự động 1-Click qua PWABuilder:</span>
                </h5>

                <div className="p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-200 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="text-stone-900 text-xs block font-black">
                        PWABuilder Android Package (Microsoft & Google Chuẩn)
                      </strong>
                      <span className="text-xs text-stone-600 mt-1 block leading-relaxed">
                        Hệ thống đã chuẩn bị sẵn Web Manifest, Service Worker và bộ Icon HD. Bạn chỉ cần mở công cụ, chọn <strong>Package for Android</strong> và tải gói APK / AAB có chữ ký số xác nhận về máy.
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <a
                      href={pwaBuilderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                    >
                      <span>TẠO FILE APK NGAY</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="px-3.5 py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Sao chép URL
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1">
                  <div className="font-bold text-stone-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Lợi thế của chuẩn WebAPK so với file APK thủ công:</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    - Khi cài đặt qua trình duyệt (tab "Cài Đặt WebAPK Android"), điện thoại sẽ tạo app APK trực tiếp có chữ ký số Google Play, tự động cập nhật phiên bản mới mà không cần gỡ ra cài lại file APK thủ công mỗi khi có bản vá.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-stone-100 px-5 py-3 border-t border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-medium text-[11px]">Android PWA Ready • Standalone UI</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
