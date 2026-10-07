import React, { useState, useEffect } from 'react';
import {
  UserSessionData,
  requestUserAccess,
  authenticateUser,
  checkMasterAdminPasscode,
  subscribeToUserStatus,
  updateUserSession,
  checkCloudConnectionDetails,
  CloudConnectionStatus,
  forceFullCloudSync,
} from '../services/firebaseShortageService';
import {
  ShieldCheck,
  Lock,
  Unlock,
  User,
  Key,
  Clock,
  CheckCircle2,
  AlertCircle,
  Laptop,
  ArrowRight,
  RefreshCw,
  LogOut,
  Sparkles,
  ShieldAlert,
  Printer,
  Eye,
  EyeOff,
  Cloud,
  Database,
  Wifi,
  X,
  FileJson,
  Zap,
  UploadCloud,
  Package,
  Smartphone,
  Tag,
} from 'lucide-react';
import {
  parseBackupJson,
  executeFastRestore,
  ParsedBackup,
  RestoreResult,
} from '../services/backupRestoreService';

interface AuthGateProps {
  currentUser: {
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status?: 'pending' | 'approved' | 'rejected';
  } | null;
  onLoginSuccess: (user: {
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status: 'approved';
  }) => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
  hasUpdate?: boolean;
  latestVersion?: string;
  onTriggerUpdate?: () => void;
  onClose?: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  currentUser,
  onLoginSuccess,
  onShowToast,
  hasUpdate = false,
  latestVersion,
  onTriggerUpdate,
  onClose,
}) => {
  // Security guard: Modal can ONLY be closed if user is already authenticated
  // Unauthenticated users CANNOT dismiss or close the login gate!
  const canClose = Boolean(currentUser && onClose);

  const [authMode, setAuthMode] = useState<'login' | 'request' | 'admin' | 'restore'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states - Fast JSON Restore
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<ParsedBackup | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');

  // Form states - Request / Register
  const [reqFullName, setReqFullName] = useState('');
  const [reqUsername, setReqUsername] = useState('');
  const [reqPassword, setReqPassword] = useState('');
  const [reqConfirmPassword, setReqConfirmPassword] = useState('');
  const [showReqPassword, setShowReqPassword] = useState(false);
  const [reqRole, setReqRole] = useState<'staff' | 'admin'>('staff');

  // Handle keyboard shortcut: Escape key closes modal ONLY if user is already authenticated
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (canClose && onClose) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canClose, onClose]);

  // Form states - Login
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('oppo_remember_me') !== 'false';
  });
  const [loginUsername, setLoginUsername] = useState(() => {
    return localStorage.getItem('oppo_remember_me') !== 'false' ? (localStorage.getItem('oppo_saved_username') || '') : '';
  });
  const [loginPassword, setLoginPassword] = useState(() => {
    return localStorage.getItem('oppo_remember_me') !== 'false' ? (localStorage.getItem('oppo_saved_password') || '') : '';
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form states - Admin Master login
  const [adminPasscode, setAdminPasscode] = useState('');
  const [showAdminPasscode, setShowAdminPasscode] = useState(false);

  // Pending user session from current storage or request
  const [pendingUid, setPendingUid] = useState<string | null>(() => {
    if (currentUser && currentUser.status === 'pending') {
      return currentUser.uid;
    }
    return localStorage.getItem('oppo_pending_auth_uid');
  });

  const [liveUserStatus, setLiveUserStatus] = useState<UserSessionData | null>(null);

  // Cloud connection test state
  const [cloudStatus, setCloudStatus] = useState<CloudConnectionStatus | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);

  const runCloudCheck = async (showNotice = false) => {
    setIsCheckingCloud(true);
    try {
      const status = await checkCloudConnectionDetails();
      setCloudStatus(status);
      if (showNotice) {
        if (status.connected) {
          const syncRes = await forceFullCloudSync();
          onShowToast(`🟢 ${syncRes.message} (Ping: ${status.latencyMs}ms)`, 'success');
        } else {
          onShowToast(`🔴 Không thể kết nối Cloud! Đang ở chế độ Offline.`, 'error');
        }
      }
    } catch (e) {
      console.warn('Cloud connection check error:', e);
    } finally {
      setIsCheckingCloud(false);
    }
  };

  useEffect(() => {
    runCloudCheck(false);
    // Periodic check every 60s when active, plus window focus / online event
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        runCloudCheck(false);
      }
    }, 60000);

    const handleOnline = () => runCloudCheck(false);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Clear error message when switching tabs
  useEffect(() => {
    setErrorMessage(null);
  }, [authMode]);

  // Subscribe to real-time status changes if waiting for approval
  useEffect(() => {
    if (!pendingUid) return;

    const unsub = subscribeToUserStatus(pendingUid, (user) => {
      if (user) {
        setLiveUserStatus(user);
        if (user.status === 'approved') {
          onShowToast(`🎉 Tài khoản "${user.displayName}" (@${user.username || 'user'}) đã được Admin phê duyệt thành công!`, 'success');
          localStorage.removeItem('oppo_pending_auth_uid');
          onLoginSuccess({
            name: user.displayName,
            role: user.role,
            uid: user.uid,
            username: user.username,
            status: 'approved',
          });
        } else if (user.status === 'rejected') {
          onShowToast(`Tài khoản "${user.displayName}" đã bị Quản trị viên từ chối cấp quyền.`, 'error');
        }
      }
    });

    return () => unsub();
  }, [pendingUid, onLoginSuccess, onShowToast]);

  // Handle staff / user login with mandatory password verification
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const u = loginUsername.trim();
    const p = loginPassword.trim();

    if (!u) {
      setErrorMessage('Vui lòng nhập Tên truy cập (Username)');
      return;
    }
    if (!p) {
      setErrorMessage('Vui lòng nhập Mật khẩu tài khoản (Bắt buộc)');
      return;
    }

    setLoading(true);
    try {
      const result = await authenticateUser(u, p);
      if (!result.success) {
        if (result.status === 'pending' && result.user) {
          setPendingUid(result.user.uid);
          setLiveUserStatus(result.user);
          localStorage.setItem('oppo_pending_auth_uid', result.user.uid);
          onShowToast('Tài khoản đang trong hàng đợi chờ Admin phê duyệt', 'info');
        } else {
          setErrorMessage(result.message);
          onShowToast(result.message, 'error');
        }
        return;
      }

      if (result.user && result.status === 'approved') {
        if (rememberMe) {
          localStorage.setItem('oppo_remember_me', 'true');
          localStorage.setItem('oppo_saved_username', u);
          localStorage.setItem('oppo_saved_password', p);
        } else {
          localStorage.removeItem('oppo_remember_me');
          localStorage.removeItem('oppo_saved_username');
          localStorage.removeItem('oppo_saved_password');
        }

        if (result.user.role === 'admin') {
          sessionStorage.setItem('oppo_admin_session_verified', 'true');
          localStorage.setItem('oppo_admin_session_verified', 'true');
        } else {
          sessionStorage.removeItem('oppo_admin_session_verified');
          localStorage.removeItem('oppo_admin_session_verified');
        }
        const approvedUser = {
          name: result.user.displayName,
          role: result.user.role,
          uid: result.user.uid,
          username: result.user.username,
          status: 'approved' as const,
        };
        updateUserSession({
          uid: approvedUser.uid,
          displayName: approvedUser.name,
          username: approvedUser.username,
          role: approvedUser.role,
          status: approvedUser.status,
        });
        localStorage.removeItem('oppo_pending_auth_uid');
        onShowToast(`Đăng nhập thành công: ${approvedUser.name} (${approvedUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'})`, 'success');
        onLoginSuccess(approvedUser);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Lỗi hệ thống khi đăng nhập. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Request / Register Account submission
  const handleSendAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reqFullName.trim()) {
      setErrorMessage('Vui lòng nhập Họ và tên');
      return;
    }
    const cleanUsername = reqUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMessage('Tên truy cập (Username) phải từ 3 ký tự trở lên (chữ, số hoặc dấu gạch dưới)');
      return;
    }
    if (!reqPassword || reqPassword.trim().length < 4) {
      setErrorMessage('Mật khẩu bắt buộc phải có ít nhất 4 ký tự');
      return;
    }
    if (reqPassword !== reqConfirmPassword) {
      setErrorMessage('Xác nhận mật khẩu không trùng khớp. Vui lòng kiểm tra lại!');
      return;
    }

    setLoading(true);
    const canonicalUid = cleanUsername === 'admin' ? 'admin-master' : `user_${cleanUsername}`;

    try {
      const res = await requestUserAccess({
        uid: canonicalUid,
        displayName: reqFullName.trim(),
        username: cleanUsername,
        password: reqPassword.trim(),
        role: reqRole,
      });

      if (!res.success) {
        setErrorMessage(res.message);
        onShowToast(res.message, 'error');
        // If account is already existing/approved, prepopulate login tab
        if (res.message.includes('đã tồn tại')) {
          setLoginUsername(cleanUsername);
          setTimeout(() => {
            setAuthMode('login');
          }, 1500);
        }
        return;
      }

      setPendingUid(canonicalUid);
      setLiveUserStatus({
        uid: canonicalUid,
        displayName: reqFullName.trim(),
        username: cleanUsername,
        role: reqRole,
        status: 'pending',
        lastActive: new Date().toISOString(),
        online: true,
      });
      localStorage.setItem('oppo_pending_auth_uid', canonicalUid);
      onShowToast('Đã gửi thông tin đăng ký lên hệ thống. Vui lòng chờ Admin duyệt!', 'success');
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Lỗi khi gửi yêu cầu đăng ký, vui lòng kiểm tra kết nối');
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Master PIN login
  const handleAdminMasterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!adminPasscode.trim()) {
      setErrorMessage('Vui lòng nhập Mã PIN Quản trị tối cao');
      return;
    }

    if (checkMasterAdminPasscode(adminPasscode)) {
      sessionStorage.setItem('oppo_admin_session_verified', 'true');
      localStorage.setItem('oppo_admin_session_verified', 'true');
      const adminUser = {
        name: 'Quản Trị Viên (Admin Master)',
        role: 'admin' as const,
        uid: 'admin-master',
        username: 'admin',
        status: 'approved' as const,
      };
      updateUserSession({
        uid: adminUser.uid,
        displayName: adminUser.name,
        username: adminUser.username,
        role: adminUser.role,
        status: adminUser.status,
      });
      localStorage.removeItem('oppo_pending_auth_uid');
      onShowToast('Xác thực Quản Trị Viên thành công! Toàn quyền hệ thống.', 'success');
      onLoginSuccess(adminUser);
    } else {
      setErrorMessage('Mã PIN Quản trị không chính xác! Vui lòng thử lại.');
      onShowToast('Mã PIN Quản trị không chính xác!', 'error');
    }
  };

  // Cancel waiting / reset
  const handleCancelPending = () => {
    setPendingUid(null);
    setLiveUserStatus(null);
    localStorage.removeItem('oppo_pending_auth_uid');
  };

  // Handle file select for JSON restore
  const handleSelectRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setRestoreError(null);
    setRestoreResult(null);

    try {
      const text = await file.text();
      const parsed = parseBackupJson(text);
      setParsedBackup(parsed);
    } catch (err: any) {
      console.error(err);
      setRestoreError(err?.message || 'File JSON không hợp lệ');
      setParsedBackup(null);
    }
    e.target.value = '';
  };

  // Execute JSON restore
  const handleExecuteRestore = async () => {
    if (!parsedBackup) {
      onShowToast('Vui lòng chọn file sao lưu JSON hợp lệ trước', 'error');
      return;
    }
    setRestoreLoading(true);
    setRestoreError(null);

    try {
      const res = await executeFastRestore({
        parsed: parsedBackup,
        mode: restoreMode,
        authorName: 'Khôi phục trước đăng nhập',
      });
      setRestoreResult(res);
      onShowToast(res.message, 'success');
    } catch (err: any) {
      console.error(err);
      setRestoreError(err?.message || 'Lỗi khi khôi phục dữ liệu');
      onShowToast(`Lỗi khi khôi phục: ${err?.message || 'Vui lòng kiểm tra lại file'}`, 'error');
    } finally {
      setRestoreLoading(false);
    }
  };

  // SCREEN 2: PENDING APPROVAL SCREEN
  if (pendingUid && (!currentUser || currentUser.status !== 'approved')) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 text-center p-6 sm:p-8 space-y-6">
          {/* Animated Hourglass Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-8 h-8 animate-spin" style={{ animationDuration: '8s' }} />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Đang Chờ Quản Trị Viên Phê Duyệt
            </span>
            <h3 className="text-xl font-black text-neutral-900">
              Tài Khoản Đã Đăng Ký Thành Công
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed max-w-xs mx-auto">
              Thông tin của bạn đã được lưu trên Cloud. Màn hình sẽ <strong>tự động mở khóa ngay tức thì</strong> khi Quản trị viên (Admin) phê duyệt.
            </p>
          </div>

          {/* User Info Box */}
          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Họ và tên:</span>
              <span className="font-bold text-neutral-900">{liveUserStatus?.displayName || reqFullName || 'Nhân sự'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Tên truy cập:</span>
              <span className="font-mono font-bold text-indigo-900">@{liveUserStatus?.username || reqUsername || 'user'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Quyền hạn yêu cầu:</span>
              <span className="font-semibold text-neutral-800">
                {liveUserStatus?.role === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên Kỹ thuật / Kho'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200">
              <span className="text-neutral-500">Mã định danh (UID):</span>
              <span className="font-mono text-[10px] text-neutral-400 truncate max-w-[140px]">{pendingUid}</span>
            </div>
          </div>

          {/* Admin Override & Cancel */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setPendingUid(null);
                localStorage.removeItem('oppo_pending_auth_uid');
                setAuthMode('admin');
              }}
              className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Tôi là Admin (Mở khóa bằng Mã PIN Master)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleCancelPending();
                setAuthMode('login');
              }}
              className="w-full py-2 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Đăng nhập bằng tài khoản khác / Hủy
            </button>

            {canClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-1.5 px-4 text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // SCREEN 1: LOGIN / REGISTER REQUEST / ADMIN PIN
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="relative px-6 py-6 bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 text-white text-center space-y-2 border-b border-emerald-900/50">
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Đóng cửa sổ và tiếp tục phiên làm việc hiện tại"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto text-emerald-300 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            {!currentUser ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-400/40 text-[10px] font-bold uppercase tracking-wider mb-2">
                <Lock className="w-3 h-3" />
                <span>Yêu cầu đăng nhập bắt buộc</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider mb-2">
                <User className="w-3 h-3" />
                <span>Đang đăng nhập: {currentUser.name}</span>
              </div>
            )}
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              Hệ Thống In Tem & Quản Lý Linh Kiện OPPO
            </h2>
            <p className="text-xs text-emerald-200/80 mt-1">
              Bắt buộc xác thực tài khoản & mật khẩu để truy cập dữ liệu
            </p>
          </div>
        </div>

        {/* Windows / Cloud App Live Update Notice */}
        {hasUpdate && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-between border-b border-amber-600/30">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-slate-950 text-amber-300 rounded-full font-black text-[10px] animate-bounce">NEW</span>
              <span>🚀 Đã có bản cập nhật ứng dụng Windows mới (v{latestVersion || 'Mới'})!</span>
            </div>
            {onTriggerUpdate && (
              <button
                type="button"
                onClick={onTriggerUpdate}
                className="px-3 py-1 bg-slate-950 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>⚡ Cập Nhật Ngay</span>
              </button>
            )}
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex items-center border-b border-neutral-200 bg-neutral-50/80 text-xs font-bold p-1 gap-1">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'login'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Đăng Nhập</span>
          </button>

          <button
            type="button"
            onClick={() => setAuthMode('request')}
            className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'request'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Đăng Ký / Cấp Quyền</span>
          </button>

          <button
            type="button"
            onClick={() => setAuthMode('admin')}
            className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'admin'
                ? 'bg-neutral-900 text-amber-400 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin Master PIN</span>
          </button>


        </div>

        {/* Live Cloud Connection Status Bar */}
        <div className="mx-6 mt-3.5 p-3 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center justify-center shrink-0">
              <span className={`w-3 h-3 rounded-full ${cloudStatus?.connected ? 'bg-emerald-500' : 'bg-rose-500'} animate-ping opacity-75 absolute`}></span>
              <span className={`w-2.5 h-2.5 rounded-full ${cloudStatus?.connected ? 'bg-emerald-400' : 'bg-rose-500'} relative`}></span>
            </div>
            <div className="truncate space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-white text-[11px] sm:text-xs">
                <Cloud className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">
                  {cloudStatus?.connected ? 'Cloud Firebase: Đã Kết Nối Trực Tiếp' : 'Trạng Thái Cloud: Ngoại Tuyến (Offline)'}
                </span>
                {cloudStatus?.connected && (
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-mono text-[10px] shrink-0 border border-emerald-500/30">
                    {cloudStatus.latencyMs}ms
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                Firestore DB ID: <span className="font-mono text-slate-300">{cloudStatus?.databaseId || 'ai-studio-remixremixtrnhin...'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => runCloudCheck(true)}
            disabled={isCheckingCloud}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shrink-0 border border-indigo-400/30 flex items-center gap-1 shadow-2xs"
            title="Kiểm tra tín hiệu kết nối trực tiếp đến Cloud Firestore"
          >
            <RefreshCw className={`w-3 h-3 ${isCheckingCloud ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isCheckingCloud ? 'Đang thử...' : 'Kết Nối Cloud'}</span>
          </button>
        </div>

        {/* Error Message Box */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in duration-100">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-7 space-y-4">
          {/* TAB 1: LOGIN */}
          {authMode === 'login' && (
            <form onSubmit={handleUserLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Tên truy cập (Username / Mã NV):
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="VD: nv_kho_01 hoặc duyktsg"
                  className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800 flex items-center justify-between">
                  <span>Mật khẩu tài khoản (Bắt buộc):</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Bắt buộc nhập mật khẩu</span>
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full p-3 pr-10 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs py-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      setRememberMe(e.target.checked);
                      if (!e.target.checked) {
                        localStorage.removeItem('oppo_remember_me');
                        localStorage.removeItem('oppo_saved_username');
                        localStorage.removeItem('oppo_saved_password');
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-bold text-neutral-700">Ghi nhớ tài khoản & mật khẩu</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Đăng Nhập Vào Hệ Thống</span>
              </button>

              <div className="text-center pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('request')}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer underline decoration-dotted"
                >
                  Chưa có tài khoản? Bấm vào đây để Đăng ký và tạo mật khẩu
                </button>


              </div>
            </form>
          )}

          {/* TAB 2: REGISTER / REQUEST ACCESS */}
          {authMode === 'request' && (
            <form onSubmit={handleSendAccessRequest} className="space-y-3.5">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Điền thông tin và <strong>mật khẩu</strong> của bạn. Sau khi gửi, Quản trị viên (Admin) sẽ duyệt tài khoản để bạn đăng nhập.
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Họ và tên của bạn:
                </label>
                <input
                  type="text"
                  required
                  value={reqFullName}
                  onChange={(e) => setReqFullName(e.target.value)}
                  placeholder="VD: Trần Văn Minh (Kỹ Thuật)"
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Tên truy cập mong muốn (Username):
                </label>
                <input
                  type="text"
                  required
                  value={reqUsername}
                  onChange={(e) => setReqUsername(e.target.value)}
                  placeholder="VD: nv_minh hoặc oppo_sg_02"
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-mono font-bold text-indigo-950 focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-800">
                    Mật khẩu (Bắt buộc):
                  </label>
                  <div className="relative">
                    <input
                      type={showReqPassword ? 'text' : 'password'}
                      required
                      value={reqPassword}
                      onChange={(e) => setReqPassword(e.target.value)}
                      placeholder="Ít nhất 4 ký tự..."
                      className="w-full p-2.5 pr-8 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowReqPassword(!showReqPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    >
                      {showReqPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-800">
                    Xác nhận mật khẩu:
                  </label>
                  <input
                    type={showReqPassword ? 'text' : 'password'}
                    required
                    value={reqConfirmPassword}
                    onChange={(e) => setReqConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu..."
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Bộ phận / Vai trò mong muốn:
                </label>
                <select
                  value={reqRole}
                  onChange={(e) => setReqRole(e.target.value as 'staff' | 'admin')}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-900 focus:border-indigo-600 outline-none"
                >
                  <option value="staff">Kỹ thuật viên / Kho linh kiện (Không được xóa dữ liệu gốc)</option>
                  <option value="admin">Quản trị viên (Admin - Cần phê duyệt)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Gửi Đăng Ký Cho Admin Duyệt</span>
              </button>
            </form>
          )}

          {/* TAB 3: ADMIN MASTER PIN */}
          {authMode === 'admin' && (
            <form onSubmit={handleAdminMasterLogin} className="space-y-4">
              <div className="p-3.5 bg-neutral-900 text-white rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <Key className="w-4 h-4" />
                  <span>Xác thực Quản Trị Viên Tối Cao (Master Admin Passcode)</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Dành riêng cho chủ hệ thống (Admin) để mở khóa toàn bộ quyền Quản trị, duyệt nhân sự, và cấu hình Cloud.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Nhập Mã PIN Quản trị viên:
                </label>
                <div className="relative">
                  <input
                    type={showAdminPasscode ? 'text' : 'password'}
                    required
                    autoFocus
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="Nhập mã PIN Quản trị viên..."
                    className="w-full p-3 pr-10 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-mono font-bold text-neutral-900 focus:bg-white focus:border-neutral-900 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPasscode(!showAdminPasscode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  >
                    {showAdminPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-amber-400 font-black text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Mở Khóa Toàn Quyền Quản Trị</span>
              </button>
            </form>
          )}

          {/* TAB 4: FAST JSON RESTORE */}
          {authMode === 'restore' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl text-xs text-indigo-950 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  Chọn file sao lưu <strong>.JSON</strong> để nạp lại dữ liệu nguyên vẹn 100%. Toàn bộ phiếu linh kiện, máy & IOT và tem in sẽ được khôi phục và đồng bộ lên Cloud chỉ trong <strong>0.3 giây</strong>!
                </span>
              </div>

              {/* Drop / File Selector */}
              <div className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl p-5 text-center transition-all cursor-pointer">
                <label className="cursor-pointer block space-y-2">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleSelectRestoreFile}
                    className="hidden"
                  />
                  <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto shadow-inner">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-stone-800 text-xs">
                      {restoreFile ? restoreFile.name : 'Bấm vào đây để chọn file sao lưu .JSON'}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">
                      {restoreFile
                        ? `${(restoreFile.size / 1024).toFixed(1)} KB — Bấm để đổi file khác`
                        : 'Hỗ trợ bản sao lưu Toàn Hệ Thống hoặc riêng từng phân hệ'}
                    </p>
                  </div>
                </label>
              </div>

              {restoreError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Lỗi đọc file:</span>
                    <p className="mt-0.5">{restoreError}</p>
                  </div>
                </div>
              )}

              {parsedBackup && (
                <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/50 border border-indigo-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-indigo-950 uppercase tracking-wider text-[11px]">
                      Dữ liệu nhận diện trong file:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-black text-[10px] shadow-2xs">
                      {parsedBackup.type === 'FULL_SYSTEM'
                        ? '🌟 Toàn bộ hệ thống'
                        : parsedBackup.type === 'SHORTAGES'
                        ? '📦 Đặt chờ linh kiện'
                        : parsedBackup.type === 'DEVICE_IOT'
                        ? '📱 Đặt chờ máy & IOT'
                        : '🏷️ Danh mục tem'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white rounded-xl p-2 border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] text-stone-500 block">Linh kiện</span>
                      <strong className="text-blue-700 font-bold text-sm">{parsedBackup.counts.shortages}</strong>
                    </div>
                    <div className="bg-white rounded-xl p-2 border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] text-stone-500 block">Máy & IOT</span>
                      <strong className="text-amber-700 font-bold text-sm">{parsedBackup.counts.deviceIot}</strong>
                    </div>
                    <div className="bg-white rounded-xl p-2 border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] text-stone-500 block">Mã tem</span>
                      <strong className="text-emerald-700 font-bold text-sm">{parsedBackup.counts.catalog}</strong>
                    </div>
                  </div>

                  {/* Mode radio */}
                  <div className="flex items-center justify-between text-xs pt-1 px-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={restoreMode === 'merge'}
                        onChange={() => setRestoreMode('merge')}
                        className="text-indigo-600"
                      />
                      <span className="font-bold text-stone-800 text-[11px]">Gộp thông minh (Khuyên dùng)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={restoreMode === 'replace'}
                        onChange={() => setRestoreMode('replace')}
                        className="text-rose-600"
                      />
                      <span className="font-bold text-stone-800 text-[11px]">Ghi đè tất cả</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={restoreLoading}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 mt-1"
                  >
                    {restoreLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang đồng bộ siêu tốc lên Cloud...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>⚡ Bắt Đầu Khôi Phục & Đồng Bộ Siêu Tốc</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {restoreResult && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 font-black text-emerald-950 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Khôi Phục Thành Công Trong {restoreResult.durationMs}ms!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    {restoreResult.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Quay lại Đăng Nhập để vào làm việc ngay
                  </button>
                </div>
              )}

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-bold cursor-pointer underline decoration-dotted"
                >
                  ← Quay lại Đăng Nhập
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200 text-center text-[11px] text-neutral-600 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 mx-auto sm:mx-0">
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-semibold text-neutral-800">Dữ liệu OPPO Live Cloud Sync</span>
          </div>
          <div className="flex items-center gap-2 mx-auto sm:mx-0 font-mono text-[10px] text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${cloudStatus?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              <strong className={cloudStatus?.connected ? 'text-emerald-700' : 'text-rose-600'}>
                {cloudStatus?.connected ? `Firestore Live (${cloudStatus.latencyMs}ms)` : 'Ngoại Tuyến (Offline)'}
              </strong>
            </span>
            <span>•</span>
            <span>Lần kiểm tra: {cloudStatus?.lastChecked || 'Vừa xong'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

