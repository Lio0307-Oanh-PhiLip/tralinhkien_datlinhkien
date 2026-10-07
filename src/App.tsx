import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import logoIcon from './assets/icon.svg';
import {
  LabelConfig,
  DEFAULT_LABEL_CONFIG,
  LabelItem,
} from './types/label';
import {
  readExcelFile,
  exportToExcel,
  downloadSampleExcel,
} from './utils/excelHelper';
import { downloadPrintableHtmlFile, openPrintWindow, generatePrintableHtml } from './utils/printHelper';
import { LabelCard } from './components/LabelCard';
import { DataTable } from './components/DataTable';
import { CustomPrintQueueTab } from './components/CustomPrintQueueTab';
import { SettingsModal } from './components/SettingsModal';
import { PrinterGuideModal } from './components/PrinterGuideModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShortageManager } from './components/ShortageManager';
import { DeviceIotManager } from './components/DeviceIotManager';
import { AdminCloudDashboard } from './components/AdminCloudDashboard';
import { AuthGate } from './components/AuthGate';
import { QuotaExceededBanner } from './components/QuotaExceededBanner';
import { UpdateProgressModal } from './components/UpdateProgressModal';
import { ContextMenu } from './components/ContextMenu';
import { SidebarNav } from './components/SidebarNav';
import { OverviewDashboard } from './components/OverviewDashboard';
import { AiChatbot, AiNavigationTarget } from './components/AiChatbot';
import { DraggableAiWidget } from './components/DraggableAiWidget';
import { SystemNotificationCenter } from './components/SystemNotificationCenter';
import { MobileAppInstallModal } from './components/MobileAppInstallModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { GitHubUpdateNotifier } from './components/GitHubUpdateNotifier';
import { Github } from 'lucide-react';
import { updateTaskbarTitleNotice, sendDesktopNotification } from './utils/taskbarNotification';
import { ShortageBookingItem } from './types/shortage';
import { DeviceIotBookingItem } from './types/deviceIot';
import { TechnicianItem } from './types/technician';
import { subscribeToTechnicians } from './services/technicianService';
import {
  INITIAL_SHORTAGE_DATA,
  checkOverdue7Days,
  checkSvdPending3Days,
  checkSvdMultiDayAppointmentProgress,
  checkStep1AgingWarning,
  checkStep2AgingWarning,
  checkStep3AgingWarning,
  getActiveShortageWarningTickets,
} from './utils/shortageHelper';
import {
  loadLocalDeviceIotBookings,
  saveLocalDeviceIotBookings,
} from './utils/deviceIotHelper';
import {
  getUserStorageKey,
  getUserReadNotificationIds,
  saveUserReadNotificationIds,
  generateSystemNotifications,
  getUserSeenWarningIds,
  saveUserSeenWarningIds,
  loadAndSyncUserReadNotifs,
} from './utils/userNotificationManager';
import {
  subscribeToDeviceIots,
  pullLatestDeviceIotsFromCloud,
  saveDeviceIotToCloud,
  deleteDeviceIotFromCloud,
  clearAllDeviceIotsFromCloud,
  batchSyncDeviceIotsToCloud,
} from './services/firebaseDeviceIotService';
import { subscribeToQuotaExceeded, isQuotaExceededState, setQuotaExceededState } from './lib/firebase';
import {
  subscribeToShortages,
  pullLatestShortagesFromCloud,
  saveShortageToCloud,
  deleteShortageFromCloud,
  clearAllShortagesFromCloud,
  batchSyncShortagesToCloud,
  notifyShortagesSignal,
  notifyCatalogSignal,
  updateUserSession,
  subscribeToUserStatus,
  subscribeToUsers,
  UserSessionData,
  testFirestoreConnection,
  subscribeToCatalogLabels,
  saveBulkCatalogLabelsToCloud,
  fetchCatalogLabelsFromCloud,
  saveLocalCatalogCache,
  saveCatalogLabelToCloud,
  deleteCatalogLabelFromCloud,
  trackAppVisit,
  subscribeToAnalytics,
  setUserPresence,
  apiFetch,
  deduplicateLabelItems,
  subscribeToRemoteAppVersion,
  publishAppVersionToCloud,
  mergeTwoShortageItems,
  deduplicateShortages,
  saveLocalShortagesCache,
  getLocalShortagesCache,
  getLocalCatalogCache,
} from './services/firebaseShortageService';
import { LinkSyncModal } from './components/LinkSyncModal';
import { FastBackupRestoreModal } from './components/FastBackupRestoreModal';
import {
  Printer,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Sliders,
  HelpCircle,
  Eye,
  Table as TableIcon,
  Layers,
  CheckCircle2,
  Link2,
  AlertCircle,
  FileText,
  FileJson,
  ExternalLink,
  FileCode,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  RotateCcw,
  Boxes,
  ClipboardList,
  ShieldCheck,
  Cloud,
  LogOut,
  LogIn,
  Lock,
  User as UserIcon,
  RefreshCw,
  Zap,
  Maximize2,
  Minimize2,
  PhoneCall,
  Smartphone,
  Bell,
  ChevronDown as ChevronDownIcon,
  Sparkles,
} from 'lucide-react';

const INITIAL_ITEMS: LabelItem[] = [
  {
    id: 'item-init-1',
    code: '621033000403',
    name: 'Nắp Pin Find X8 Pro (Trắng)',
    model: 'Find X8 Pro',
    category: 'Vỏ',
    location: 'A-01',
    quantity: 1,
    selected: true,
  },
  {
    id: 'item-init-2',
    code: '621033000404',
    name: 'Màn Hình Oppo Find X8',
    model: 'Find X8',
    category: 'Màn',
    location: 'B-04',
    quantity: 1,
    selected: true,
  },
  {
    id: 'item-init-3',
    code: '621033000405',
    name: 'Pin Oppo Reno 11 Pro 5G',
    model: 'Reno 11 Pro',
    category: 'Pin',
    location: 'C-02',
    quantity: 1,
    selected: true,
  },
];

const STORAGE_KEYS = {
  ITEMS: 'label_studio_items_v1',
  CONFIG: 'label_studio_config',
  LAST_SAVED: 'label_studio_last_saved_time',
  SHORTAGE_BOOKINGS: 'label_studio_shortage_bookings_v1',
  DEVICE_IOT_BOOKINGS: 'label_studio_device_iot_bookings_v1',
  CURRENT_USER: 'label_studio_current_user_v1',
};

export default function App() {
  useEffect(() => {
    document.title = 'HCM4 tra linh kiện in tem & đặt chờ linh kiện';
  }, []);

  // Navigation Mode: 'overview' for Executive Dashboard, 'labels' for 3x2 Label Studio, 'shortage' for Part Shortage Workflow, 'device_iot' for Device & IOT Workflow, 'ai_chatbot' for Gemini AI Chatbot
  const [mainMode, setMainMode] = useState<'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot'>(() => {
    try {
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (search.includes('ai') || hash.includes('ai') || search.includes('chat') || hash.includes('chat')) {
        return 'ai_chatbot';
      }
      if (search.includes('overview') || hash.includes('overview')) {
        return 'overview';
      }
      if (search.includes('device') || search.includes('iot') || hash.includes('device') || hash.includes('iot')) {
        return 'device_iot';
      }
      if (search.includes('shortage') || hash.includes('shortage')) {
        return 'shortage';
      }
    } catch (e) {
      console.warn('URL parsing error:', e);
    }
    return 'labels';
  });

  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);
  const [isGitHubUpdateModalOpen, setIsGitHubUpdateModalOpen] = useState(false);

  // Cloud Sync, Admin & Analytics states
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<'approval' | 'cancels' | 'technicians' | 'catalog' | 'logs' | 'profile' | 'links' | 'quota'>('approval');
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [usersList, setUsersList] = useState<UserSessionData[]>([]);
  const [techniciansList, setTechniciansList] = useState<TechnicianItem[]>([]);
  const [cloudSynced, setCloudSynced] = useState(true);
  const [quotaErrorDetail, setQuotaErrorDetail] = useState<string | null>(null);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [totalVisitsCount, setTotalVisitsCount] = useState<number>(() => {
    return parseInt(localStorage.getItem('oppo_app_total_visits') || '1280', 10);
  });
  const [onlineUsersCount, setOnlineUsersCount] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Deep Navigation targets from Notification Center (Bell)
  const [shortageTargetNavigation, setShortageTargetNavigation] = useState<{
    subTab?: string;
    statusFilter?: string;
    warningBranch?: 'all' | 'overdue_7' | 'step1' | 'step2' | 'step3' | 'svd' | 'cancel' | 'edit';
    searchTerm?: string;
    ticketId?: string;
    ticketNumber?: string;
    nonce: number;
  } | null>(null);

  const [deviceTargetNavigation, setDeviceTargetNavigation] = useState<{
    subTab?: string;
    statusFilter?: string;
    searchTerm?: string;
    nonce: number;
  } | null>(null);

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Fullscreen error:', err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen error:', err);
        });
      }
    }
  }, []);

  const handleRefreshData = async () => {
    setIsRefreshingData(true);
    try {
      // 1. Refresh Shortages from Cloud Firestore & PostgreSQL
      const latestShortages = await pullLatestShortagesFromCloud(true);
      let shortagesCount = 0;
      if (latestShortages && latestShortages.length > 0) {
        const deduplicated = deduplicateShortages(latestShortages);
        setShortageBookings(deduplicated);
        saveLocalShortagesCache(deduplicated);
        try {
          localStorage.setItem(STORAGE_KEYS.SHORTAGE_BOOKINGS, JSON.stringify(deduplicated));
        } catch (e) {}
        shortagesCount = deduplicated.length;
      }

      // 2. Refresh Tab 1 Master Label Catalog synced from Admin
      const latestCatalog = await fetchCatalogLabelsFromCloud();
      if (latestCatalog && latestCatalog.length > 0) {
        setCloudCatalogLabels(latestCatalog);
        handleItemsChange(latestCatalog);
        saveLocalCatalogCache(latestCatalog);
        try {
          localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(latestCatalog));
        } catch (e) {
          console.warn('Storage quota notice:', e);
        }
      }

      // 3. Broadcast real-time signals so all connected clients sync immediately
      await notifyShortagesSignal(currentUser?.name || 'Admin', shortagesCount);
      await notifyCatalogSignal(currentUser?.name || 'Admin', latestCatalog ? latestCatalog.length : 0);

      setCloudSynced(true);
      showToast(
        `🔄 Đã khôi phục & đồng bộ dữ liệu Cloud thành công! (${shortagesCount} đơn đăng ký chờ linh kiện)`,
        'success'
      );
    } catch (err) {
      console.warn('Manual refresh error:', err);
      showToast('Đã xảy ra lỗi khi làm mới dữ liệu từ Cloud', 'error');
    } finally {
      setIsRefreshingData(false);
    }
  };

  // Force clean cache refresh for Windows Desktop / PWA / Installed Apps
  const handleForceUpdateWindowsApp = async () => {
    setIsRefreshingData(true);
    showToast('Đang xóa bộ nhớ đệm & nạp lại bản cập nhật mới nhất...', 'info');
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in window) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
    } catch (e) {
      console.warn('Cache clear notice:', e);
    }
    setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.reloadWindow) {
        (window as any).electronAPI.reloadWindow();
      } else {
        window.location.reload();
      }
    }, 400);
  };

  // Subscribe to global Quota Exceeded events
  useEffect(() => {
    if (isQuotaExceededState()) {
      setQuotaErrorDetail('Hệ thống đã chủ động chuyển hướng (Smart Routing) sang cơ chế lưu trữ đám mây Cloud SQL PostgreSQL không giới hạn.');
      setCloudSynced(false);
    }
    const unsub = subscribeToQuotaExceeded((errDetail) => {
      setQuotaErrorDetail(errDetail);
      setCloudSynced(false);
    });
    return () => unsub();
  }, []);

  // Check if running inside Electron / AppImage environment
  const isElectronEnvironment = typeof window !== 'undefined' && Boolean(
    (window as any).electronAPI?.isElectron ||
    navigator.userAgent.toLowerCase().includes('electron')
  );

  // Current logged in / active user identity (Strict Authentication & Approval Gate)
  // - AppImage / Electron: Always requires login on fresh app launch
  // - Web: Requires password on first login, auto log out after 2 hours (7200000ms) of inactivity
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status?: 'pending' | 'approved' | 'rejected';
  } | null>(() => {
    try {
      // Web / Electron: Always require login on fresh app launch / new tab (via sessionStorage)
      const sessionActive = sessionStorage.getItem('oppo_web_session_active') === 'true';
      if (!sessionActive) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem('oppo_last_active_time');
        return null;
      }

      const isElectron = typeof window !== 'undefined' && Boolean(
        (window as any).electronAPI?.isElectron ||
        navigator.userAgent.toLowerCase().includes('electron')
      );

      // Rule 2: Web platform - Check 2-hour inactivity expiration
      const INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours
      const lastActiveTime = parseInt(localStorage.getItem('oppo_last_active_time') || '0', 10);
      if (!isElectron && lastActiveTime > 0 && Date.now() - lastActiveTime > INACTIVITY_LIMIT_MS) {
        console.warn('Web session expired due to 2 hours of inactivity');
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem('oppo_last_active_time');
        return null;
      }

      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          // Security guard 1: Known restricted staff usernames or demo staff accounts MUST strictly be role 'staff'
          if (
            parsed.username === 'nhanvien' ||
            parsed.username === 'staff' ||
            parsed.username === 'kythuat' ||
            parsed.uid?.startsWith('staff-demo')
          ) {
            parsed.role = 'staff';
          }

          // Security guard 2: Admin role requires explicit window session verification via Master PIN
          const isSessionVerifiedAdmin = 
            sessionStorage.getItem('oppo_admin_session_verified') === 'true' ||
            localStorage.getItem('oppo_admin_session_verified') === 'true';
          if (parsed.role === 'admin' && !isSessionVerifiedAdmin) {
            console.warn('Security guard: Unverified persistent Admin session detected. Demoting to staff role for safety.');
            parsed.role = 'staff';
          }

          // Refresh active timestamp for Web
          localStorage.setItem('oppo_last_active_time', Date.now().toString());
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading saved user identity:', e);
    }
    return null;
  });

  // Login Modal state - defaults to true if not logged in
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => !currentUser);
  const isAdmin = currentUser?.role === 'admin';

  // Auto-open login modal whenever user is unauthenticated
  useEffect(() => {
    if (!currentUser) {
      setIsAuthModalOpen((prev) => (!prev ? true : prev));
    }
  }, [currentUser]);

  // Heartbeat presence loop & page unload cleanup
  useEffect(() => {
    if (!currentUser?.uid) return;
    const sendHeartbeat = () => {
      setUserPresence(currentUser.uid, true);
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    const handleBeforeUnload = () => {
      setUserPresence(currentUser.uid, false);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.uid]);

  // Track app visit count (once per session) & subscribe to real-time analytics
  useEffect(() => {
    const hasRecordedSession = sessionStorage.getItem('oppo_session_visit_recorded');
    if (!hasRecordedSession) {
      sessionStorage.setItem('oppo_session_visit_recorded', 'true');
      trackAppVisit().then((visits) => {
        if (visits) setTotalVisitsCount(visits);
      });
    }

    const unsubAnalytics = subscribeToAnalytics((data) => {
      if (data) {
        if (data.totalVisits) setTotalVisitsCount(data.totalVisits);
        if (data.onlineCount) setOnlineUsersCount(data.onlineCount);
      }
    });

    return () => unsubAnalytics();
  }, []);

  // Client App Version & Build Constants
  const CLIENT_APP_VERSION = '2.5.3';
  const CLIENT_BUILD_ID = 'build-v253-part-autosuggest-sync';

  // OTA Live Code Auto-Update Detection
  const [hasNewCodeUpdate, setHasNewCodeUpdate] = useState(false);
  const [serverVersionInfo, setServerVersionInfo] = useState<string>('2.5.3');
  const [serverBuildId, setServerBuildId] = useState<string>('build-v253-part-autosuggest-sync');
  const [updateReleaseNotes, setUpdateReleaseNotes] = useState<string>('');
  const [updateWindowsUrl, setUpdateWindowsUrl] = useState<string>('');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isMobileAppModalOpen, setIsMobileAppModalOpen] = useState(false);

  // Broadcast app version to Cloud Firestore only once per build across boots
  useEffect(() => {
    if (isQuotaExceededState()) return;
    const broadcastKey = 'oppo_version_broadcast_build-v253';
    if (localStorage.getItem(broadcastKey) === 'true') return;
    localStorage.setItem(broadcastKey, 'true');

    publishAppVersionToCloud(
      {
        version: '2.5.3',
        buildId: 'build-v253-part-autosuggest-sync',
        releaseNotes: '• Tự động gợi ý & điền Tên linh kiện khi nhập Mã LK trong phiếu chờ\n• Sửa triệt để lỗi đồng bộ chậm giữa các máy tính (Real-time Signal Broadcast)\n• Tải dữ liệu chuẩn từ Cloud bỏ qua Cache local',
        releaseDate: new Date().toLocaleDateString('vi-VN'),
        forceUpdate: true,
      },
      'Hệ thống OP-Studio'
    ).catch(() => {});
  }, []);

  // Check if user just updated and show success toast
  useEffect(() => {
    try {
      const updatedVer = sessionStorage.getItem('label_studio_update_success_banner');
      if (updatedVer) {
        sessionStorage.removeItem('label_studio_update_success_banner');
        setTimeout(() => {
          showToast(`Đã cập nhật thành công lên phiên bản v${updatedVer}! Hệ thống đang chạy bản mới nhất.`, 'success');
        }, 600);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // 1. Listen to Real-time Cloud Firestore version document updates
  useEffect(() => {
    const unsubVersion = subscribeToRemoteAppVersion((info) => {
      if (info && info.version) {
        const acknowledgedBuildId = localStorage.getItem('label_studio_acknowledged_build_id');
        const targetBuildId = info.buildId || `build-v${info.version}`;
        setServerVersionInfo(info.version);
        setServerBuildId(targetBuildId);
        if (info.releaseNotes) setUpdateReleaseNotes(info.releaseNotes);
        if (info.windowsDownloadUrl) setUpdateWindowsUrl(info.windowsDownloadUrl);

        if (
          (info.version !== CLIENT_APP_VERSION || targetBuildId !== CLIENT_BUILD_ID) &&
          targetBuildId !== acknowledgedBuildId
        ) {
          setHasNewCodeUpdate(true);
          if (info.forceUpdate) {
            setIsUpdateModalOpen(true);
          }
        } else {
          setHasNewCodeUpdate(false);
        }
      }
    });

    return () => unsubVersion();
  }, []);

  // 2. Poll REST API /api/version for backend version matching
  useEffect(() => {
    const checkVersion = async (isManual = false) => {
      try {
        const res = await apiFetch('/api/version');
        if (res.ok) {
          const data = await res.json();
          if (data && data.buildId) {
            const acknowledgedBuildId = localStorage.getItem('label_studio_acknowledged_build_id');
            const targetBuildId = data.buildId;
            setServerVersionInfo(data.version || '2.5.3');
            setServerBuildId(targetBuildId);

            // If server has a different build than current client AND hasn't been acknowledged/installed
            if (targetBuildId !== CLIENT_BUILD_ID && targetBuildId !== acknowledgedBuildId) {
              setHasNewCodeUpdate(true);
              if (isManual) {
                setIsUpdateModalOpen(true);
              }
            } else if (isManual) {
              showToast(`Bạn đang sử dụng phiên bản mới nhất (v${CLIENT_APP_VERSION})!`, 'success');
            }
          }
        } else if (isManual) {
          showToast('Máy chủ phản hồi: ' + res.status + '. Đang duy trì chế độ Ngoại tuyến cục bộ an toàn.', 'info');
        }
      } catch (e) {
        if (isManual) {
          showToast('Không thể kết nối máy chủ Cloud. Hệ thống đang chạy Ngoại Tuyến (Offline) hoàn chỉnh.', 'info');
        }
      }
    };

    // Check on startup and every 30s
    checkVersion();
    const interval = setInterval(() => checkVersion(false), 30000);

    const handleManualCheck = () => {
      checkVersion(true);
    };
    window.addEventListener('trigger-check-ota-update', handleManualCheck);

    return () => {
      clearInterval(interval);
      window.removeEventListener('trigger-check-ota-update', handleManualCheck);
    };
  }, []);

  // Listen to all users to count pending approval requests, calculate online users & enforce lock status in real time
  useEffect(() => {
    const unsub = subscribeToUsers((users) => {
      setUsersList(users);
      const pending = users.filter((u) => u.status === 'pending');
      setPendingRequestsCount(pending.length);

      // Only count unique users who are actively online
      const activeOnlineUsers = users.filter((u) => Boolean(u.online));
      const uniqueActiveKeys = new Set(activeOnlineUsers.map((u) => (u.username || u.uid).toLowerCase()));
      const calculatedCount = Math.max(currentUser ? 1 : 0, uniqueActiveKeys.size);
      setOnlineUsersCount(calculatedCount);

      // Real-time account status security guard
      if (currentUser?.uid) {
        const dbUser = users.find(
          (u) =>
            u.uid === currentUser.uid ||
            (u.username && currentUser.username && u.username.toLowerCase() === currentUser.username.toLowerCase())
        );
        if (dbUser) {
          if (dbUser.status === 'rejected') {
            console.warn('Real-time security: Account locked in Cloud. Force logging out...');
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            localStorage.removeItem('oppo_pending_auth_uid');
            sessionStorage.removeItem('oppo_admin_session_verified');
            localStorage.removeItem('oppo_admin_session_verified');
            setCurrentUser(null);
            showToast('Tài khoản của bạn đã bị khóa hoặc từ chối bởi Quản trị viên!', 'error');
          }
        }
      }
    });
    return () => unsub();
  }, [currentUser?.uid, currentUser?.username]);

  // Subscribe to Technicians in real time
  useEffect(() => {
    const unsubTech = subscribeToTechnicians((techs) => {
      setTechniciansList(techs);
    });
    return () => unsubTech();
  }, []);

  // Window unload presence cleanup
  useEffect(() => {
    if (!currentUser?.uid) return;
    const handleUnload = () => {
      setUserPresence(currentUser.uid, false);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [currentUser?.uid]);

  // Inactivity tracking & 2-Hour auto-logout for Web / User Session
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours (7,200,000 ms)

  useEffect(() => {
    if (!currentUser) return;

    // Record activity timestamp on user interaction (throttled)
    let lastRecorded = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      lastActiveTimestampRef.current = now;
      if (now - lastRecorded > 10000) {
        // Update storage every 10s to avoid unnecessary I/O
        lastRecorded = now;
        localStorage.setItem('oppo_last_active_time', now.toString());
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Inactivity check interval every 30 seconds
    const inactivityInterval = setInterval(() => {
      const now = Date.now();
      const lastStored = parseInt(localStorage.getItem('oppo_last_active_time') || '0', 10);
      const effectiveLastActive = Math.max(lastActiveTimestampRef.current, lastStored);

      if (now - effectiveLastActive > INACTIVITY_TIMEOUT_MS) {
        console.warn('Auto logout triggered: No user interaction for 2 hours.');
        if (currentUser?.uid) {
          setUserPresence(currentUser.uid, false);
        }
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem('oppo_last_active_time');
        localStorage.removeItem('oppo_pending_auth_uid');
        sessionStorage.removeItem('oppo_admin_session_verified');
        localStorage.removeItem('oppo_admin_session_verified');
        sessionStorage.removeItem('oppo_electron_session_active');
        setCurrentUser(null);
        showToast('⏰ Phiên làm việc đã hết hạn sau 2 giờ không tương tác. Vui lòng đăng nhập lại!', 'info');
      }
    }, 30000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      clearInterval(inactivityInterval);
    };
  }, [currentUser]);

  // Save current user to localStorage and update Cloud Presence
  const handleUpdateCurrentUser = (user: {
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status?: 'pending' | 'approved' | 'rejected';
  }) => {
    setCurrentUser(user);
    try {
      const now = Date.now().toString();
      localStorage.setItem('oppo_last_active_time', now);
      sessionStorage.setItem('oppo_web_session_active', 'true');
      if (isElectronEnvironment) {
        sessionStorage.setItem('oppo_electron_session_active', 'true');
      }
      if (user.role === 'admin') {
        sessionStorage.setItem('oppo_admin_session_verified', 'true');
        localStorage.setItem('oppo_admin_session_verified', 'true');
      } else {
        sessionStorage.removeItem('oppo_admin_session_verified');
        localStorage.removeItem('oppo_admin_session_verified');
      }
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      updateUserSession({
        uid: user.uid,
        displayName: user.name,
        username: user.username,
        role: user.role,
        status: user.status || (user.role === 'admin' || user.username === 'admin' ? 'approved' : 'pending'),
      });
    } catch (e) {
      console.warn('Failed to save current user:', e);
    }
  };

  // Logout handler
  const handleLogout = () => {
    if (currentUser?.uid) {
      setUserPresence(currentUser.uid, false);
    }
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem('oppo_last_active_time');
    localStorage.removeItem('oppo_pending_auth_uid');
    sessionStorage.removeItem('oppo_admin_session_verified');
    localStorage.removeItem('oppo_admin_session_verified');
    sessionStorage.removeItem('oppo_electron_session_active');
    sessionStorage.removeItem('oppo_web_session_active');
    setCurrentUser(null);
    showToast('Đã đăng xuất khỏi tài khoản thành công', 'info');
    setIsAuthModalOpen(true);
  };

  // Shortage bookings state (instant load from local cache or pre-bundled database snapshot)
  const [shortageBookings, setShortageBookings] = useState<ShortageBookingItem[]>(() => {
    return getLocalShortagesCache();
  });

  // Calculate live total warnings count for SidebarNav & Alerts Hub (100% unified with KPI cards & Warning list)
  const appTotalWarningsCount = useMemo(() => {
    return getActiveShortageWarningTickets(shortageBookings, currentUser?.role === 'admin').length;
  }, [shortageBookings, currentUser?.role]);

  // Active Sub Item for Left Sidebar independent selection
  const [activeSubId, setActiveSubId] = useState<string>(() => {
    if (mainMode === 'shortage') return 'shortage-main';
    if (mainMode === 'device_iot') return 'device-main';
    return 'labels-split';
  });

  // Device & IOT bookings state (Tab 3: Đặt Chờ Máy & IOT)
  const [deviceIotBookings, setDeviceIotBookings] = useState<DeviceIotBookingItem[]>(() => {
    return loadLocalDeviceIotBookings();
  });

  // Per-user storage key for notifications and warning acknowledgements
  const currentUserStorageKey = useMemo(() => {
    return getUserStorageKey(currentUser);
  }, [currentUser]);

  // Read notification IDs for current logged-in user
  const [userReadNotificationIds, setUserReadNotificationIds] = useState<Set<string>>(() => {
    return getUserReadNotificationIds(getUserStorageKey(currentUser));
  });

  // Seen warning ticket IDs for current user
  const [userSeenWarningIds, setUserSeenWarningIds] = useState<Set<string>>(() => {
    return getUserSeenWarningIds(getUserStorageKey(currentUser));
  });

  // Load and sync user read status from Firestore database across devices
  useEffect(() => {
    loadAndSyncUserReadNotifs(currentUserStorageKey, ({ readIds, seenWarningIds }) => {
      setUserReadNotificationIds((prev) => {
        if (prev.size === readIds.size && Array.from(readIds).every((id) => prev.has(id))) {
          return prev;
        }
        return readIds;
      });
      setUserSeenWarningIds((prev) => {
        if (prev.size === seenWarningIds.size && Array.from(seenWarningIds).every((id) => prev.has(id))) {
          return prev;
        }
        return seenWarningIds;
      });
    });
  }, [currentUserStorageKey]);

  const handleUpdateReadNotificationIds = useCallback((newIds: Set<string>) => {
    setUserReadNotificationIds(newIds);
    saveUserReadNotificationIds(currentUserStorageKey, newIds);
  }, [currentUserStorageKey]);

  // Notice states for new shortage & device registrations
  const [hasNewShortageRegistration, setHasNewShortageRegistration] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`app_has_new_shortage_notice_${getUserStorageKey(currentUser)}`) === 'true';
    } catch {
      return false;
    }
  });

  const [hasNewDeviceRegistration, setHasNewDeviceRegistration] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`app_has_new_device_notice_${getUserStorageKey(currentUser)}`) === 'true';
    } catch {
      return false;
    }
  });

  const prevShortageCountRef = useRef<number>(0);
  const prevDeviceIotCountRef = useRef<number>(0);
  const prevWarningCountRef = useRef<number>(0);
  const prevPendingRequestsCountRef = useRef<number>(-1);
  const isInitialDataSyncRef = useRef<boolean>(true);

  // Sync shortage & device registration notices when state changes
  useEffect(() => {
    if (isInitialDataSyncRef.current) {
      if (shortageBookings.length > 0) prevShortageCountRef.current = shortageBookings.length;
      if (deviceIotBookings.length > 0) prevDeviceIotCountRef.current = deviceIotBookings.length;
      const timer = setTimeout(() => {
        isInitialDataSyncRef.current = false;
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Check if new shortage bookings were registered
    if (shortageBookings.length > prevShortageCountRef.current) {
      if (mainMode !== 'shortage') {
        setHasNewShortageRegistration(true);
        try {
          localStorage.setItem(`app_has_new_shortage_notice_${currentUserStorageKey}`, 'true');
        } catch (e) {}
      }
      const latest = shortageBookings[0] || shortageBookings[shortageBookings.length - 1];
      if (latest) {
        sendDesktopNotification(
          'HCM4 - Linh Kiện Đặt Chờ Mới!',
          `Model: ${latest.model || 'Mã máy'} | Linh kiện: ${latest.partName || 'Linh kiện đặt chờ'}`
        );
      }
    }
    prevShortageCountRef.current = shortageBookings.length;

    // Check if new device bookings were registered
    if (deviceIotBookings.length > prevDeviceIotCountRef.current) {
      if (mainMode !== 'device_iot') {
        setHasNewDeviceRegistration(true);
        try {
          localStorage.setItem(`app_has_new_device_notice_${currentUserStorageKey}`, 'true');
        } catch (e) {}
      }
      const latest = deviceIotBookings[0] || deviceIotBookings[deviceIotBookings.length - 1];
      if (latest) {
        sendDesktopNotification(
          'HCM4 - Đặt Chờ Máy & IOT Mới!',
          `Model: ${latest.deviceModel || 'Mã máy'} | IMEI/SN: ${latest.imeiOrIot || 'Thiết bị mới'}`
        );
      }
    }
    prevDeviceIotCountRef.current = deviceIotBookings.length;
  }, [shortageBookings, deviceIotBookings, mainMode, currentUserStorageKey]);

  // Active system notifications generated with per-user isRead status
  const activeSystemNotifications = useMemo(() => {
    return generateSystemNotifications(
      usersList,
      techniciansList,
      shortageBookings,
      deviceIotBookings,
      hasNewCodeUpdate,
      serverVersionInfo,
      CLIENT_APP_VERSION,
      userReadNotificationIds,
      currentUser?.role || 'staff'
    );
  }, [
    usersList,
    techniciansList,
    shortageBookings,
    deviceIotBookings,
    hasNewCodeUpdate,
    serverVersionInfo,
    userReadNotificationIds,
    currentUser?.role,
  ]);

  // Live unread badge count for System Notification Bell (only unread items for this user)
  const liveNotificationsBadgeCount = useMemo(() => {
    return activeSystemNotifications.filter((n) => !n.isRead).length;
  }, [activeSystemNotifications]);

  // Current warning ticket IDs (100% unified with getActiveShortageWarningTickets)
  const currentWarningTicketIds = useMemo(() => {
    return new Set(getActiveShortageWarningTickets(shortageBookings, currentUser?.role === 'admin').map((b) => b.id));
  }, [shortageBookings, currentUser?.role]);
  const currentWarningTicketIdsRef = useRef(currentWarningTicketIds);
  useEffect(() => {
    currentWarningTicketIdsRef.current = currentWarningTicketIds;
  }, [currentWarningTicketIds]);

  // When active warnings increase or arrive, trigger native OS desktop notification
  // so Windows 11 immediately paints the red/coral alert container around the taskbar icon (Hình 2)!
  useEffect(() => {
    if (!currentUser) return;
    const count = currentWarningTicketIds.size;
    if (isInitialDataSyncRef.current) {
      prevWarningCountRef.current = count;
      return;
    }

    if (count > prevWarningCountRef.current) {
      sendDesktopNotification(
        `HCM4 - Cảnh Báo Tiến Độ (${count})`,
        `Có ${count} phiếu linh kiện cần kiểm tra và xử lý tiến độ gấp!`,
        'hcm4-shortage-warnings'
      );
    }
    prevWarningCountRef.current = count;
  }, [currentWarningTicketIds.size, currentUser]);

  // When a new user account request arrives (pendingRequestsCount increases),
  // trigger native Windows notification and taskbar attention alert ONLY FOR ADMIN!
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (prevPendingRequestsCountRef.current === -1) {
      prevPendingRequestsCountRef.current = pendingRequestsCount;
      return;
    }

    if (pendingRequestsCount > prevPendingRequestsCountRef.current) {
      const pendingUsers = usersList.filter((u) => u.status === 'pending');
      const latestUser = pendingUsers[pendingUsers.length - 1];
      const requesterName = latestUser?.displayName || latestUser?.username || 'Nhân viên';

      sendDesktopNotification(
        `HCM4 - Yêu Cầu Cấp Tài Khoản Mới! (${pendingRequestsCount})`,
        `${requesterName} vừa gửi yêu cầu cấp tài khoản. Nhấn để duyệt trong Quản trị!`,
        'hcm4-user-approval'
      );
    }
    prevPendingRequestsCountRef.current = pendingRequestsCount;
  }, [pendingRequestsCount, usersList, currentUser?.role]);

  // Step 2a: Multi-part or single-part tickets where parts are not yet fully requested or received
  const partialPartsStep2aCount = useMemo(() => {
    return shortageBookings.filter((b) => b.status === 'chua_xin_du_lk').length;
  }, [shortageBookings]);

  // SVD multi-day appointment reminders & 3-day pending warnings
  const svdRemindersCount = useMemo(() => {
    return shortageBookings.filter((b) => {
      if (b.status === 'da_hoan_tat' || b.status === 'da_bo_mau') return false;
      const progress = checkSvdMultiDayAppointmentProgress(b);
      const pending3 = checkSvdPending3Days(b);
      return progress.hasReminder || pending3.isSvdPending3Days;
    }).length;
  }, [shortageBookings]);

  // Overdue 7 days tickets
  const overdue7DaysCount = useMemo(() => {
    return shortageBookings.filter((b) => {
      if (b.status === 'da_hoan_tat' || b.status === 'da_bo_mau') return false;
      return checkOverdue7Days(b).isOverdue;
    }).length;
  }, [shortageBookings]);

  // Step 1: Newly created shortage bookings waiting to request parts
  const step1ShortagesCount = useMemo(() => {
    return shortageBookings.filter((b) => b.status === 'da_tao_phieu').length;
  }, [shortageBookings]);

  // Step 3: Stocked parts waiting to call customer
  const stockedShortagesCount = useMemo(() => {
    return shortageBookings.filter((b) => b.status === 'da_nhap_kho').length;
  }, [shortageBookings]);

  // Count of unread warning tickets for current user (not yet seen)
  const unreadWarningTicketCount = useMemo(() => {
    let count = 0;
    for (const id of currentWarningTicketIds) {
      if (!userSeenWarningIds.has(id)) {
        count++;
      }
    }
    return count;
  }, [currentWarningTicketIds, userSeenWarningIds]);

  // Count of unread pending account approval requests for admin
  const unreadPendingAccountCount = useMemo(() => {
    if (currentUser?.role !== 'admin') return 0;
    const pendingUsers = usersList.filter((u) => u.status === 'pending');
    return pendingUsers.filter((u) => !userReadNotificationIds.has(`user-pending-${u.uid || u.username}`)).length;
  }, [currentUser?.role, usersList, userReadNotificationIds]);

  // Check if there are any unread warnings for this user
  const hasNewWarningsNotice = useMemo(() => {
    return unreadWarningTicketCount > 0;
  }, [unreadWarningTicketCount]);

  // Mark all current warnings as seen for this user
  const handleMarkWarningsAsSeen = useCallback(() => {
    const currentIds = currentWarningTicketIdsRef.current;
    if (currentIds.size === 0) return;
    setUserSeenWarningIds((prev) => {
      let hasNew = false;
      const allSeen = new Set(prev);
      currentIds.forEach((id) => {
        if (!allSeen.has(id)) {
          allSeen.add(id);
          hasNew = true;
        }
      });
      if (!hasNew) return prev;
      saveUserSeenWarningIds(currentUserStorageKey, allSeen);
      return allSeen;
    });
  }, [currentUserStorageKey]);

  // When user is viewing the shortage warnings tab, automatically mark them as seen
  useEffect(() => {
    if (mainMode === 'shortage' && activeSubId === 'shortage-warnings' && unreadWarningTicketCount > 0) {
      handleMarkWarningsAsSeen();
    }
  }, [mainMode, activeSubId, unreadWarningTicketCount, handleMarkWarningsAsSeen]);

  // Clear new registration notices when user opens the respective module
  useEffect(() => {
    if (mainMode === 'shortage') {
      setHasNewShortageRegistration(false);
      try {
        localStorage.removeItem(`app_has_new_shortage_notice_${currentUserStorageKey}`);
      } catch (e) {}
    }
    if (mainMode === 'device_iot') {
      setHasNewDeviceRegistration(false);
      try {
        localStorage.removeItem(`app_has_new_device_notice_${currentUserStorageKey}`);
      } catch (e) {}
    }
  }, [mainMode, currentUserStorageKey]);

  // Dynamically flash Windows Taskbar Title, Taskbar App Badge & Favicon Icon ONLY when UNREAD notices/warnings are present
  useEffect(() => {
    if (!currentUser) {
      updateTaskbarTitleNotice(false);
      return;
    }
    let totalUnreadBadge = unreadWarningTicketCount + unreadPendingAccountCount;
    let noticeMsg = '';

    if (unreadPendingAccountCount > 0 && unreadWarningTicketCount > 0) {
      noticeMsg = `${unreadPendingAccountCount} yêu cầu tài khoản & ${unreadWarningTicketCount} cảnh báo mới!`;
    } else if (unreadPendingAccountCount > 0) {
      noticeMsg = `${unreadPendingAccountCount} yêu cầu cấp tài khoản mới!`;
    } else if (unreadWarningTicketCount > 0) {
      noticeMsg = `${unreadWarningTicketCount} cảnh báo tiến độ mới!`;
    } else if (hasNewShortageRegistration) {
      totalUnreadBadge = Math.max(totalUnreadBadge, 1);
      noticeMsg = 'Linh kiện mới đăng ký!';
    } else if (hasNewDeviceRegistration) {
      totalUnreadBadge = Math.max(totalUnreadBadge, 1);
      noticeMsg = 'Máy & IOT mới đăng ký!';
    } else if (liveNotificationsBadgeCount > 0) {
      totalUnreadBadge = Math.max(totalUnreadBadge, liveNotificationsBadgeCount);
      noticeMsg = `${liveNotificationsBadgeCount} thông báo mới!`;
    }

    if (totalUnreadBadge > 0) {
      updateTaskbarTitleNotice(true, noticeMsg, totalUnreadBadge);
    } else {
      updateTaskbarTitleNotice(false);
    }
  }, [
    currentUser,
    hasNewShortageRegistration,
    hasNewDeviceRegistration,
    unreadPendingAccountCount,
    unreadWarningTicketCount,
    liveNotificationsBadgeCount,
  ]);

  // Update handlers for Device & IOT bookings
  const deviceIotBookingsRef = useRef(deviceIotBookings);
  useEffect(() => {
    deviceIotBookingsRef.current = deviceIotBookings;
  }, [deviceIotBookings]);

  const handleUpdateDeviceIotBookings = useCallback(
    (newItems: DeviceIotBookingItem[]) => {
      const currentItems = deviceIotBookingsRef.current;
      const oldMap = new Map<string, DeviceIotBookingItem>();
      currentItems.forEach((item) => {
        if (item.id) oldMap.set(item.id, item);
      });

      const newMap = new Map<string, DeviceIotBookingItem>();
      newItems.forEach((item) => {
        if (item.id) newMap.set(item.id, item);
      });

      // 1. Find new or modified items to sync to Cloud
      const itemsToSync: DeviceIotBookingItem[] = [];
      newItems.forEach((newItem) => {
        if (!newItem.id) return;
        const oldItem = oldMap.get(newItem.id);
        if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
          itemsToSync.push(newItem);
        }
      });

      // 3. Update local React state
      setDeviceIotBookings(newItems);
      saveLocalDeviceIotBookings(newItems);
      try {
        localStorage.setItem('label_studio_device_iot_initialized', 'true');
      } catch (e) {}

      // 4. Sync added or modified items
      if (itemsToSync.length > 0) {
        batchSyncDeviceIotsToCloud(itemsToSync).catch((err) => {
          console.warn('Sync device_iots to cloud notice:', err);
        });
      }
    },
    []
  );

  // 1. Global Real-time synchronization for Shortages & Catalog Labels & Device/IOT (Unconditional - runs on App Boot)
  useEffect(() => {
    testFirestoreConnection();

    // Initial proactive pull from Cloud Firestore & PostgreSQL
    pullLatestShortagesFromCloud()
      .then((items) => {
        if (Array.isArray(items)) {
          setShortageBookings(items);
          setCloudSynced(true);
        }
      })
      .catch((err) => {
        console.warn('Initial cloud shortages pull notice:', err);
      });

    // Proactive pull for Device & IOT
    pullLatestDeviceIotsFromCloud()
      .then((items) => {
        if (Array.isArray(items)) {
          setDeviceIotBookings(items);
          saveLocalDeviceIotBookings(items);
        }
      })
      .catch((err) => {
        console.warn('Initial cloud device_iots pull notice:', err);
      });

    // Subscribe to real-time changes in Device & IOT
    const unsubDeviceIot = subscribeToDeviceIots((cloudItems) => {
      if (Array.isArray(cloudItems)) {
        setDeviceIotBookings(cloudItems);
      }
    });

    // Subscribe to real-time changes across all connected PC / Web devices
    const unsubscribe = subscribeToShortages(
      (cloudItems) => {
        if (Array.isArray(cloudItems)) {
          const deduplicated = deduplicateShortages(cloudItems);
          setShortageBookings(deduplicated);
          saveLocalShortagesCache(deduplicated);
          try {
            localStorage.setItem(STORAGE_KEYS.SHORTAGE_BOOKINGS, JSON.stringify(deduplicated));
          } catch (e) {
            console.warn('LocalStorage save notice:', e);
          }
          setCloudSynced(true);
        }
      },
      (err) => {
        console.warn('Firestore subscription using local data:', err);
        setCloudSynced(false);
      }
    );

    // Subscribe to real-time changes in Label Catalog
    const unsubCatalog = subscribeToCatalogLabels(
      (cloudCatalog) => {
        if (cloudCatalog && cloudCatalog.length > 0) {
          const cleanCatalog = deduplicateLabelItems(cloudCatalog);
          setCloudCatalogLabels(cleanCatalog);
          setItems((prevItems) => {
            // Create a lookup map of previous items to preserve local selected checkbox ticks
            const prevItemsMap = new Map(prevItems.map((item) => [item.id, item]));

            // Create a Set of cloud IDs for O(1) lookup
            const cloudIdSet = new Set(cleanCatalog.map((c) => c.id));

            // Map cleanCatalog and preserve the local `selected` state if the item already exists locally
            const mergedCatalog = cleanCatalog.map((cloudItem) => {
              const localItem = prevItemsMap.get(cloudItem.id);
              if (localItem) {
                return {
                  ...cloudItem,
                  selected: localItem.selected !== undefined ? localItem.selected : (cloudItem.selected !== undefined ? cloudItem.selected : true)
                };
              }
              return {
                ...cloudItem,
                selected: cloudItem.selected !== undefined ? cloudItem.selected : true
              };
            });

            // Preserve local unsaved items (IDs starting with 'item-' or 'label-from-') that are not in the cloud yet
            const localUnsavedItems = prevItems.filter(
              (item) => (item.id.startsWith('item-') || item.id.startsWith('label-from-')) && !cloudIdSet.has(item.id)
            );
            
            // Keep the merged list of items
            const finalCatalog = [...mergedCatalog, ...localUnsavedItems];

            if (prevItems.length !== finalCatalog.length) {
              return finalCatalog;
            }

            let hasChanged = false;
            for (let i = 0; i < prevItems.length; i++) {
              if (
                prevItems[i].id !== finalCatalog[i].id ||
                prevItems[i].selected !== finalCatalog[i].selected ||
                prevItems[i].quantity !== finalCatalog[i].quantity
              ) {
                hasChanged = true;
                break;
              }
            }

            if (hasChanged) {
              return finalCatalog;
            }
            return prevItems;
          });
          saveLocalCatalogCache(cleanCatalog);
          try {
            localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(cleanCatalog));
          } catch (e) {
            console.warn('Storage quota notice:', e);
          }
        }
      },
      (err) => {
        console.warn('Catalog subscription warning:', err);
      }
    );

    return () => {
      unsubscribe();
      unsubCatalog();
      unsubDeviceIot();
    };
  }, []);

  // 2. User Session Presence & Security Status Tracking
  useEffect(() => {
    if (!currentUser) return;

    updateUserSession({
      uid: currentUser.uid,
      displayName: currentUser.name,
      username: currentUser.username,
      role: currentUser.role,
      status: currentUser.status || (currentUser.role === 'admin' || currentUser.username === 'admin' ? 'approved' : 'pending'),
    });

    // Listen to changes in current user's profile/approval status from Admin
    const unsubUser = subscribeToUserStatus(currentUser.uid, (remoteUser) => {
      if (remoteUser) {
        setCurrentUser((prev) => {
          if (!prev) return null;
          if (
            prev.name !== remoteUser.displayName ||
            prev.role !== remoteUser.role ||
            prev.username !== remoteUser.username ||
            prev.status !== remoteUser.status
          ) {
            const updated = {
              uid: prev.uid,
              name: remoteUser.displayName || prev.name,
              role: remoteUser.role || prev.role,
              username: remoteUser.username || prev.username,
              status: remoteUser.status || (remoteUser.role === 'admin' || remoteUser.username === 'admin' ? 'approved' : 'pending'),
            };
            try {
              localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updated));
            } catch (err) {
              console.warn(err);
            }
            return updated;
          }
          return prev;
        });
      }
    });

    return () => {
      unsubUser();
    };
  }, [currentUser?.uid]);

  const [cloudCatalogLabels, setCloudCatalogLabels] = useState<LabelItem[]>([]);
  const [isSyncingCatalogToCloud, setIsSyncingCatalogToCloud] = useState(false);

  // Handler to update shortage bookings (Sync to both Cloud and local cache)
  const shortageBookingsRef = useRef(shortageBookings);
  useEffect(() => {
    shortageBookingsRef.current = shortageBookings;
  }, [shortageBookings]);

  const handleUpdateShortageBookings = useCallback(
    (newBookings: ShortageBookingItem[]) => {
      // Find what changed compared to the current shortageBookings state
      const currentShortages = shortageBookingsRef.current;
      const oldMap = new Map<string, ShortageBookingItem>();
      currentShortages.forEach((item) => {
        if (item.id) oldMap.set(item.id, item);
      });

      const newMap = new Map<string, ShortageBookingItem>();
      newBookings.forEach((item) => {
        if (item.id) newMap.set(item.id, item);
      });

      const authorName = currentUser?.name || 'Nhân viên';

      // 1. Find modified or new items to sync to Cloud
      const itemsToSync: ShortageBookingItem[] = [];
      newBookings.forEach((newItem) => {
        if (!newItem.id) return;
        const oldItem = oldMap.get(newItem.id);
        if (!oldItem) {
          // New booking added
          itemsToSync.push(newItem);
        } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
          // Fields modified
          itemsToSync.push(newItem);
        }
      });

      // 3. Update local React state instantly with stable sorting
      const sortedBookings = deduplicateShortages(newBookings);
      setShortageBookings(sortedBookings);
      saveLocalShortagesCache(sortedBookings);
      try {
        localStorage.setItem(STORAGE_KEYS.SHORTAGE_BOOKINGS, JSON.stringify(sortedBookings));
        localStorage.setItem('label_studio_shortage_initialized', 'true');
      } catch (e) {
        console.warn('Failed to save shortage bookings locally:', e);
      }

      // 4. Sync added or modified items to Cloud
      if (itemsToSync.length > 0) {
        if (itemsToSync.length > 5) {
          // Bulk sync for large updates
          batchSyncShortagesToCloud(itemsToSync, authorName).catch((err) => {
            console.warn('Batch sync to cloud error:', err);
          });
        } else {
          // Sync individually
          itemsToSync.forEach((item) => {
            saveShortageToCloud(item, authorName).catch((err) => {
              console.warn('Background sync error for item:', item.ticketNumber, err);
            });
          });
        }
      }
    },
    [currentUser?.name]
  );

  // Auto-save shortage bookings to localStorage as offline fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.SHORTAGE_BOOKINGS, JSON.stringify(shortageBookings));
      } catch (e) {
        console.warn('Failed to auto-save shortage bookings:', e);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [shortageBookings]);
  // Initialize items from localStorage or pre-bundled catalog database (5,730 items)
  const [items, setItems] = useState<LabelItem[]>(() => {
    return getLocalCatalogCache();
  });

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_SAVED);
  });

  const [config, setConfig] = useState<LabelConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (saved) {
      try {
        return { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_LABEL_CONFIG;
      }
    }
    return DEFAULT_LABEL_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'split' | 'custom_print' | 'holds'>('split');

  // Keep activeSubId synchronized with activeTab when in labels mode
  useEffect(() => {
    if (mainMode === 'labels') {
      if (activeTab === 'split') setActiveSubId((prev) => (prev !== 'labels-split' ? 'labels-split' : prev));
      else if (activeTab === 'editor') setActiveSubId((prev) => (prev !== 'labels-editor' ? 'labels-editor' : prev));
      else if (activeTab === 'custom_print') setActiveSubId((prev) => (prev !== 'labels-custom-print' ? 'labels-custom-print' : prev));
      else if (activeTab === 'preview') setActiveSubId((prev) => (prev !== 'labels-preview' ? 'labels-preview' : prev));
    }
  }, [activeTab, mainMode]);
  const [customPrintItems, setCustomPrintItems] = useState<LabelItem[]>(() => {
    try {
      const saved = localStorage.getItem('oppo_custom_print_queue_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load custom print items from localStorage:', e);
    }
    return [];
  });

  // Selected custom print items & accurate label quantity calculations
  const selectedCustomPrintItems = useMemo(() => {
    return customPrintItems.filter((i) => i.selected !== false);
  }, [customPrintItems]);

  const totalCustomQueueLabels = useMemo(() => {
    return customPrintItems.reduce((acc, i) => acc + Math.max(1, i.quantity || 1), 0);
  }, [customPrintItems]);

  const totalSelectedCustomLabels = useMemo(() => {
    return selectedCustomPrintItems.reduce((acc, i) => acc + Math.max(1, i.quantity || 1), 0);
  }, [selectedCustomPrintItems]);

  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await readExcelFile(file);
      if (imported && imported.length > 0) {
        const updated = [...imported, ...items];
        handleItemsChange(updated);
        showToast(`🎉 Nhập thành công ${imported.length} tem linh kiện từ file Excel!`, 'success');
      } else {
        showToast('⚠️ Không tìm thấy dữ liệu tem linh kiện phù hợp trong file Excel', 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('❌ Lỗi khi đọc file Excel, vui lòng kiểm tra định dạng file', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleExportExcel = () => {
    if (items.length === 0) {
      showToast('⚠️ Danh mục linh kiện hiện đang trống', 'info');
      return;
    }
    const filename = `danh_sach_tem_linh_kien_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportToExcel(items, filename);
    showToast(`📥 Đã xuất thành công ${items.length} tem ra file Excel!`, 'success');
  };

  const handleDownloadSampleExcel = () => {
    downloadSampleExcel();
    showToast('📄 Đã tải file Excel mẫu chuẩn (3x2in) thành công!', 'success');
  };
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [previewPageSize, setPreviewPageSize] = useState<number | 'all'>(30);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [printPreviewState, setPrintPreviewState] = useState<{
    isOpen: boolean;
    items: LabelItem[];
    title?: string;
  }>({
    isOpen: false,
    items: [],
    title: '',
  });

  const handleOpenPrintPreview = (targetItems: LabelItem[], customTitle?: string) => {
    if (!targetItems || targetItems.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 linh kiện trong bảng để in!', 'error');
      return;
    }
    setPrintPreviewState({
      isOpen: true,
      items: targetItems,
      title: customTitle || `Xem Trước & Cấu Hình In ${targetItems.length} Tem`,
    });
  };
  const [isLinkSyncModalOpen, setIsLinkSyncModalOpen] = useState(false);
  const [isFastBackupRestoreOpen, setIsFastBackupRestoreOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Global listener for fast JSON restore broadcast event
  useEffect(() => {
    const handleDataRestored = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (Array.isArray(detail.shortages)) {
        setShortageBookings(detail.shortages);
      }
      if (Array.isArray(detail.deviceIot)) {
        setDeviceIotBookings(detail.deviceIot);
      }
      if (Array.isArray(detail.catalog)) {
        setItems(detail.catalog);
      }
      setCloudSynced(true);
    };
    window.addEventListener('oppo_data_restored_event', handleDataRestored);
    return () => window.removeEventListener('oppo_data_restored_event', handleDataRestored);
  }, []);

  // Auto-save customPrintItems locally (Strictly local, NEVER syncs or modifies cloud catalog)
  useEffect(() => {
    try {
      localStorage.setItem('oppo_custom_print_queue_items', JSON.stringify(customPrintItems));
    } catch (e) {
      console.warn('Failed to save custom print items locally:', e);
    }
  }, [customPrintItems]);

  // Auto-save items to localStorage whenever they change (Debounced to keep UI ultra smooth for thousands of items)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
        const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        localStorage.setItem(STORAGE_KEYS.LAST_SAVED, now);
        setLastSavedTime(now);
      } catch (e) {
        console.warn('Failed to auto-save items to localStorage (Quota or error):', e);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [items]);

  // Preview Pagination Calculations
  const previewTotalPages = previewPageSize === 'all' ? 1 : Math.max(1, Math.ceil(items.length / previewPageSize));

  const paginatedPreviewItems = React.useMemo(() => {
    if (previewPageSize === 'all') return items;
    const start = (previewPage - 1) * previewPageSize;
    return items.slice(start, start + previewPageSize);
  }, [items, previewPage, previewPageSize]);

  // Focus and jump to specific label
  const handleFocusItem = useCallback((id: string) => {
    setFocusedItemId(id);
    if (activeTab === 'editor') {
      setActiveTab('split');
    }

    if (previewPageSize !== 'all') {
      const itemIdx = items.findIndex((i) => i.id === id);
      if (itemIdx !== -1) {
        const targetPage = Math.floor(itemIdx / previewPageSize) + 1;
        if (targetPage !== previewPage) {
          setPreviewPage(targetPage);
        }
      }
    }

    setTimeout(() => {
      const cardEl = document.getElementById(`label-card-${id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      const rowEl = document.getElementById(`table-row-${id}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 70);
  }, [activeTab, items, previewPage, previewPageSize]);

  // Single target item if user clicks "In riêng tem này", or null for all
  const [singlePrintItem, setSinglePrintItem] = useState<LabelItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selected items filtering
  const selectedItems = useMemo(() => {
    return items.filter((i) => i.selected !== false);
  }, [items]);

  const isPartialSelection = items.length > 0 && selectedItems.length > 0 && selectedItems.length < items.length;
  const isNoSelection = items.length > 0 && selectedItems.length === 0;

  // The actual items targeted for all batch printing actions
  const itemsToPrint = useMemo(() => {
    return selectedItems;
  }, [selectedItems]);

  // Compute all expanded items according to their quantity for selected items
  const allMultipliedItems = useMemo(() => {
    const multiplied: LabelItem[] = [];
    itemsToPrint.forEach((item: LabelItem) => {
      const count = config.respectQuantity ? Math.max(1, item.quantity || 1) : 1;
      for (let i = 0; i < count; i++) {
        multiplied.push(item);
      }
    });
    return multiplied;
  }, [itemsToPrint, config.respectQuantity]);

  // Actual list rendered in the pure print media container
  const activePrintList = singlePrintItem ? [singlePrintItem] : allMultipliedItems;

  // Total label count to be printed
  const totalLabelCount = useMemo(() => {
    return itemsToPrint.reduce(
      (sum: number, item: LabelItem) => sum + (config.respectQuantity ? Math.max(1, item.quantity || 1) : 1),
      0
    );
  }, [itemsToPrint, config.respectQuantity]);

  // Save config to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }, [config]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3000);
  };

  // Stock check button visibility state (syncs with localStorage)
  const [showStockCheckButton, setShowStockCheckButton] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('label_show_stock_check_btn');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleShowStockCheckButton = () => {
    const nextVal = !showStockCheckButton;
    setShowStockCheckButton(nextVal);
    try {
      localStorage.setItem('label_show_stock_check_btn', String(nextVal));
    } catch {}
    showToast(
      nextVal
        ? 'Đã bật hiển thị nút check tồn kho GCSM'
        : 'Đã ẩn nút check tồn kho GCSM (chỉ hiện khi rê chuột vào mã)',
      'info'
    );
  };

  // Reset to default sample
  const handleResetToDefault = () => {
    setItems(INITIAL_ITEMS);
    setSinglePrintItem(null);
    showToast('Đã khôi phục dữ liệu mẫu ban đầu!', 'info');
  };

  // Update items in state and trigger auto-save
  const handleItemsChange = useCallback((newItems: LabelItem[], isFieldChange?: boolean) => {
    // If current user is Admin, auto-sync local changes (edits or deletions) to Cloud Firestore and Cloud SQL!
    if (currentUser?.role === 'admin') {
      // 1. Detect deletion
      if (newItems.length < items.length) {
        const deletedItem = items.find((oldItem) => !newItems.some((newItem) => newItem.id === oldItem.id));
        if (deletedItem) {
          deleteCatalogLabelFromCloud(deletedItem.id, currentUser.name || 'Admin')
            .then(() => {
              console.log('Successfully auto-deleted label from cloud:', deletedItem.code || deletedItem.id);
            })
            .catch((err) => {
              console.error('Failed to auto-delete label from cloud:', err);
            });
        }
      }
      // 2. Detect field/cell edit
      else if (isFieldChange) {
        let editedItemIndex = -1;
        const editedItem = newItems.find((newItem, idx) => {
          const oldItem = items.find((o) => o.id === newItem.id);
          const hasChanged = oldItem && JSON.stringify(oldItem) !== JSON.stringify(newItem);
          if (hasChanged) {
            editedItemIndex = idx;
          }
          return hasChanged;
        });

        if (editedItem && editedItemIndex !== -1) {
          // Avoid saving completely blank rows that haven't been configured yet
          if (editedItem.code?.trim() || editedItem.name?.trim()) {
            // Generate safe ID from code or name to see if ID should change
             const code = (editedItem.code || '').trim().toLowerCase();
            const name = (editedItem.name || '').trim().toLowerCase();
            let newSafeId = editedItem.id;
            if (code) {
              newSafeId = `code_${code.replace(/[\/\s#?.-]/g, '_')}`;
            } else if (name) {
              newSafeId = `name_${name.replace(/[\/\s#?.-]/g, '_')}`;
            }

            const oldId = editedItem.id;
            if (newSafeId !== oldId) {
              // Update ID locally in newItems array first
              editedItem.id = newSafeId;
              newItems[editedItemIndex] = { ...editedItem, id: newSafeId };
            }

            saveCatalogLabelToCloud(newItems[editedItemIndex], currentUser.name || 'Admin')
              .then(() => {
                console.log('Successfully auto-saved edited label to cloud:', editedItem.code);
                // ONLY delete the old document AFTER the new one is successfully written to prevent temporary row disappearance!
                if (newSafeId !== oldId && oldId && !oldId.startsWith('temp_') && !oldId.startsWith('item-')) {
                  deleteCatalogLabelFromCloud(oldId, currentUser.name || 'Admin')
                    .then(() => console.log('Deleted stale old label ID document:', oldId))
                    .catch((err) => console.error('Failed to delete stale document:', err));
                }
              })
              .catch((err) => {
                console.error('Failed to auto-save edited label to cloud:', err);
              });
          }
        }
      }
    }

    setItems(newItems);
    setSinglePrintItem(null);
    saveLocalCatalogCache(newItems);
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(newItems));
    } catch (e) {
      console.warn('Storage quota notice:', e);
    }
  }, [currentUser, items]);

  // Sync current items to Cloud Catalog (Admin)
  const handleSyncLabelsToCloud = async () => {
    if (items.length === 0) {
      showToast('Bàn làm việc in tem hiện đang trống!', 'error');
      return;
    }
    setIsSyncingCatalogToCloud(true);
    const cleanList = deduplicateLabelItems(items);
    try {
      const processed = await saveBulkCatalogLabelsToCloud(cleanList, currentUser?.name || 'Admin', (synced, total) => {
        if (total > 500 && synced % 900 === 0) {
          showToast(`Đang đồng bộ ${synced}/${total} tem lên Cloud...`, 'info');
        }
      });
      if (processed && processed.length > 0) {
        handleItemsChange(processed);
      }
      showToast(`Đã đồng bộ thành công ${processed?.length || cleanList.length} tem độc nhất lên Cloud Firestore!`, 'success');
    } catch (err: any) {
      console.error('Error syncing catalog to cloud:', err);
      showToast('Lỗi khi đồng bộ tem lên Cloud', 'error');
    } finally {
      setIsSyncingCatalogToCloud(false);
    }
  };

  // Load master catalog items from Cloud
  const handleLoadCatalogFromCloud = async () => {
    try {
      showToast('Đang kết nối Cloud để lấy danh mục tem mới nhất từ Admin...', 'info');
      const cloudItems = await fetchCatalogLabelsFromCloud();
      if (cloudItems.length === 0) {
        showToast('Chưa có danh mục tem mẫu nào được Admin lưu trên Cloud!', 'info');
        return;
      }
      const cleanItems = deduplicateLabelItems(cloudItems);
      setCloudCatalogLabels(cleanItems);
      handleItemsChange(cleanItems);
      saveLocalCatalogCache(cleanItems);
      try {
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(cleanItems));
      } catch (e) {
        console.warn('Storage quota notice:', e);
      }
      showToast(`Đã tải ${cleanItems.length} linh kiện mẫu do Admin đồng bộ trên Cloud!`, 'success');
    } catch (err: any) {
      console.error('Error fetching catalog from cloud:', err);
      showToast('Lỗi khi tải tem từ Cloud', 'error');
    }
  };

  // Trigger upload file dialog for Admin Cloud Catalog
  const handleUploadCatalogFileToCloud = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    } else {
      const tempInput = document.createElement('input');
      tempInput.type = 'file';
      tempInput.accept = '.xlsx, .xls, .csv, .tsv, .txt, .json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel';
      tempInput.style.display = 'none';
      tempInput.onchange = (e: any) => {
        handleExcelUpload(e);
        document.body.removeChild(tempInput);
      };
      document.body.appendChild(tempInput);
      tempInput.click();
    }
  };

  // Handle Excel / Catalog File Upload
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      showToast('Đang đọc file và nạp danh sách linh kiện...', 'info');
      const imported = await readExcelFile(file);
      if (imported.length === 0) {
        showToast('Không tìm thấy dữ liệu hợp lệ trong file.', 'error');
        return;
      }
      const deduplicated = deduplicateLabelItems(imported);
      handleItemsChange(deduplicated);
      setActiveTab('editor');
      setMainMode('labels');

      // If user is Admin, auto sync directly to Cloud Firestore as master catalog
      if (currentUser?.role === 'admin') {
        setIsSyncingCatalogToCloud(true);
        try {
          const authorName = currentUser.name || 'Admin';
          const processed = await saveBulkCatalogLabelsToCloud(deduplicated, authorName, (synced, total) => {
            if (total > 500 && synced % 900 === 0) {
              showToast(`Đang đồng bộ ${synced}/${total} tem lên Cloud...`, 'info');
            }
          });
          const finalList = processed && processed.length > 0 ? processed : deduplicated;
          saveLocalCatalogCache(finalList);
          setCloudCatalogLabels(finalList);
          await notifyCatalogSignal(authorName, finalList.length);
          showToast(
            `🚀 Đã tải lên và đồng bộ thành công ${finalList.length} linh kiện mẫu lên Cloud Firestore!`,
            'success'
          );
        } catch (cloudErr) {
          console.warn('Auto cloud sync warning:', cloudErr);
          showToast(`Đã nạp ${deduplicated.length} tem vào bảng dữ liệu thành công!`, 'success');
        } finally {
          setIsSyncingCatalogToCloud(false);
        }
      } else {
        if (deduplicated.length < imported.length) {
          showToast(`Đã nhập ${deduplicated.length} linh kiện từ file Excel (đã tự động loại bỏ ${imported.length - deduplicated.length} tem trùng lặp)!`, 'success');
        } else {
          showToast(`Đã nhập thành công ${deduplicated.length} linh kiện từ file Excel!`, 'success');
        }
      }
    } catch (err: any) {
      console.error('Excel upload error:', err);
      showToast('Lỗi đọc file: ' + (err?.message || 'Định dạng không hợp lệ'), 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Add new blank row
  const handleAddNewRow = () => {
    const newItem: LabelItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      code: '',
      name: '',
      model: '',
      category: '',
      location: '',
      quantity: 1,
      selected: true,
    };
    handleItemsChange([...items, newItem]);
    setActiveTab('editor');
    setMainMode('labels');
    setFocusedItemId(newItem.id);
    showToast('Đã thêm 1 dòng tem mới vào bảng dữ liệu', 'info');
    setTimeout(() => {
      const rowEl = document.getElementById(`table-row-${newItem.id}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 80);
  };

  // Direct print using standard Windows Print Dialog (Bỏ qua bảng view, mở thẳng bảng in Windows mặc định)
  const handleDirectNativePrint = async (
    targetItems: LabelItem[],
    customTitle?: string,
    forceRespectQuantity?: boolean
  ) => {
    if (!targetItems || targetItems.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 linh kiện trong bảng để in!', 'error');
      return;
    }

    const shouldRespectQuantity =
      forceRespectQuantity !== undefined
        ? forceRespectQuantity
        : activeTab === 'custom_print' || config.respectQuantity;

    const effectiveConfig = shouldRespectQuantity
      ? { ...config, respectQuantity: true }
      : config;

    const count = targetItems.reduce(
      (sum, item) => sum + (shouldRespectQuantity ? Math.max(1, item.quantity || 1) : 1),
      0
    );

    // Safeguard: Prevent browser and Windows Spooler freeze if attempting to print huge batch (>100 labels) at once
    if (count > 100) {
      showToast(
        `⚠️ Danh sách có ${count} tem. Mở bảng xem trước để chọn số lượng in an toàn tránh làm treo ứng dụng!`,
        'info'
      );
      setPrintPreviewState({
        isOpen: true,
        items: targetItems.slice(0, 100),
        title: customTitle || `Xem trước ${count} tem cần in (Tối đa 100 tem/lần in)`,
      });
      return;
    }

    showToast(`⚡ Đang chuẩn bị in ${count} tem — Mở bảng in Windows...`, 'info');

    try {
      const hasElectron = Boolean(typeof window !== 'undefined' && (window as any).electronAPI?.printHtml);
      const printableHtml = await generatePrintableHtml(targetItems, effectiveConfig, false);

      if (hasElectron && (window as any).electronAPI?.printHtml) {
        // Trên ứng dụng Desktop: Gọi thẳng hộp thoại in tiêu chuẩn của Windows (silent: false)
        const result = await (window as any).electronAPI.printHtml({
          html: printableHtml,
          options: {
            silent: false, // Hiển thị bảng in Windows mặc định
            printBackground: true,
            margins: {
              marginType: 'none',
            },
          },
        });

        if (result && result.success !== false) {
          showToast(`Đã mở bảng in Windows cho ${count} tem!`, 'success');
        } else {
          showToast(result?.error || 'Đã gửi lệnh in', 'info');
        }
      } else {
        // Trên trình duyệt Web: Mở cửa sổ in tiêu chuẩn trực tiếp
        await openPrintWindow(targetItems, effectiveConfig, customTitle || `In ${count} Tem`);
        showToast(`Đã mở bảng in cho ${count} tem!`, 'success');
      }
    } catch (err: any) {
      console.error('Lỗi khi kích hoạt lệnh in Windows:', err);
      showToast('Không thể mở bảng in: ' + (err?.message || 'Lỗi không xác định'), 'error');
    }
  };

  // Intelligent context-aware print handler (Ctrl+P / Shortcut / In tem)
  const handleSmartPrintShortcut = useCallback(() => {
    // Context 1: Shortage Manager (Tab Đặt chờ linh kiện)
    if (mainMode === 'shortage') {
      window.dispatchEvent(new CustomEvent('trigger-shortage-print'));
      return;
    }

    // Context 2: Device & IoT Manager
    if (mainMode === 'device_iot') {
      showToast('Vui lòng chọn tab "Đặt chờ linh kiện" hoặc "In tem linh kiện 3x2 inch" để in tem!', 'info');
      return;
    }

    // Context 3: Custom Print Queue Tab (Hàng chờ in tem theo yêu cầu / file Excel)
    if (activeTab === 'custom_print') {
      if (selectedCustomPrintItems.length === 0) {
        if (customPrintItems.length === 0) {
          showToast('Hàng chờ in tem theo yêu cầu đang trống. Vui lòng thêm linh kiện hoặc dán mã cần in!', 'info');
        } else {
          showToast('Vui lòng tích chọn ít nhất 1 linh kiện trong hàng chờ in theo yêu cầu!', 'error');
        }
        return;
      }
      handleDirectNativePrint(
        selectedCustomPrintItems,
        `In ${totalSelectedCustomLabels} Tem Chỉ Định (Theo yêu cầu)`,
        true
      );
      return;
    }

    // Context 4: Master Label Studio (Bảng dữ liệu linh kiện 3x2)
    // If user has specific items checked (isPartialSelection)
    if (selectedItems.length > 0 && isPartialSelection) {
      if (selectedItems.length > 100) {
        showToast(
          `⚠️ Đang chọn ${selectedItems.length} tem. Đã mở bảng xem trước để chọn in an toàn tránh nghẽn máy in!`,
          'info'
        );
        setPrintPreviewState({
          isOpen: true,
          items: selectedItems.slice(0, 100),
          title: `Xem trước ${selectedItems.length} tem đã chọn`,
        });
        return;
      }
      handleDirectNativePrint(
        selectedItems,
        `In ${totalLabelCount} Tem Đã Chọn (${selectedItems.length}/${items.length} mã)`
      );
      return;
    }

    // If entire catalog or all items selected by default (> 50 items)
    if (items.length > 50) {
      showToast(
        `⚠️ Danh mục có ${items.length} tem. Vui lòng tick chọn vào các tem cần in, hoặc xem trước trong bảng in an toàn!`,
        'info'
      );
      setPrintPreviewState({
        isOpen: true,
        items: items.slice(0, 50),
        title: `Xem trước tem danh mục (50/${items.length} tem)`,
      });
      return;
    }

    if (itemsToPrint.length > 0) {
      handleDirectNativePrint(itemsToPrint, `In ${totalLabelCount} Tem`);
      return;
    }

    showToast('Vui lòng chọn ít nhất 1 linh kiện trong bảng để in!', 'error');
  }, [
    mainMode,
    activeTab,
    selectedItems,
    items,
    customPrintItems,
    selectedCustomPrintItems,
    totalSelectedCustomLabels,
    isPartialSelection,
    totalLabelCount,
    itemsToPrint,
    showToast,
  ]);

  // 100% Print Trigger -> Kích hoạt bảng in Windows mặc định ngay lập tức
  const triggerNativePrint = (targetItem?: LabelItem) => {
    if (targetItem) {
      handleDirectNativePrint([targetItem], `In Tem: ${targetItem.model || targetItem.code}`);
    } else {
      handleSmartPrintShortcut();
    }
  };

  // Print all or selected items -> Mở thẳng bảng in Windows
  const handlePrintAll = () => {
    handleSmartPrintShortcut();
  };

  // Print selected items -> Mở thẳng bảng in Windows
  const handlePrintSelected = (selected: LabelItem[]) => {
    if (selected.length === 0) {
      showToast('Chưa chọn tem nào để in!', 'error');
      return;
    }
    const count = selected.reduce(
      (sum, item) => sum + (config.respectQuantity ? Math.max(1, item.quantity || 1) : 1),
      0
    );
    handleDirectNativePrint(selected, `In ${count} Tem Đã Chọn`);
  };

  // Print single item (Always prints exactly 1 copy) -> Mở thẳng bảng in Windows
  const handlePrintSingle = (singleItem: LabelItem) => {
    const itemToPrint: LabelItem = { ...singleItem, quantity: 1 };
    handleDirectNativePrint([itemToPrint], `In Tem: ${singleItem.model || singleItem.code}`);
  };

  // Print test item -> Mở thẳng bảng in Windows
  const handlePrintTest = () => {
    const testItem: LabelItem = {
      id: 'test-item',
      code: '621033000403',
      name: 'Nắp Pin Find X8 Pro (Trắng)',
      model: 'Find X8 Pro',
      category: 'Vỏ',
      location: 'A-01',
      quantity: 1,
    };
    handleDirectNativePrint([testItem], 'In Thử 1 Tem Chuẩn 3x2 inch');
  };

  // Update single item directly from label preview
  const handleUpdateSingleItem = (updated: LabelItem) => {
    handleItemsChange(items.map((i) => (i.id === updated.id ? updated : i)), true);
  };

  // Open standalone HTML in new tab with auto-print
  const handleOpenPrintTab = async () => {
    if (itemsToPrint.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 linh kiện trong bảng để in!', 'error');
      return;
    }
    try {
      showToast('Đang kết xuất trang in độc lập...', 'info');
      const html = await generatePrintableHtml(itemsToPrint, config, true);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const newWin = window.open(url, '_blank');
      if (!newWin) {
        // Fallback for popups
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener,noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('Lỗi mở trang in:', e);
      showToast('Không thể mở trang in mới.', 'error');
    }
  };

  // Download standalone printable HTML file (Offline print)
  const handleDownloadHtmlFile = async () => {
    if (itemsToPrint.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 linh kiện để xuất file in!', 'error');
      return;
    }
    try {
      await downloadPrintableHtmlFile(itemsToPrint, config);
      showToast('Đã tải file HTML in tem về máy!', 'success');
    } catch (e) {
      console.error('Lỗi tải file in HTML:', e);
      showToast('Lỗi khi tạo file in HTML.', 'error');
    }
  };

  // Global hotkeys (Ctrl+P to print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleSmartPrintShortcut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSmartPrintShortcut]);

  // Listen for trigger-smart-print from Electron native menu
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onTriggerPrint) {
      const cleanup = (window as any).electronAPI.onTriggerPrint(() => {
        handleSmartPrintShortcut();
      });
      return cleanup;
    }
  }, [handleSmartPrintShortcut]);

  // Handle send from Shortage Manager to Label Studio
  const handleSendShortageToLabelStudio = (labelItem: LabelItem) => {
    const newItems = [labelItem, ...items];
    setItems(newItems);
    setMainMode('labels');
    setFocusedItemId(labelItem.id);
    showToast(`Đã chuyển linh kiện "${labelItem.name}" sang bàn làm việc in tem 3x2!`, 'success');
  };

  // =========================================================================
  // ZERO-TRUST MANDATORY AUTHENTICATION BARRIER
  // =========================================================================
  // If user is unauthenticated (currentUser is null):
  // 1. Completely lock down the application and DO NOT render any sensitive
  //    workstations, print queues, shortage data, or sidebars in DOM/memory.
  // 2. AuthGate is presented as an inescapable, full-screen authentication barrier.
  // 3. User CANNOT close or bypass the login prompt to access the system.
  if (!currentUser) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-4 relative select-none">
        {/* Ambient background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-950 to-slate-950 pointer-events-none" />

        {/* Blocking Mandatory AuthGate - Notice: NO onClose prop passed! */}
        <AuthGate
          currentUser={null}
          onLoginSuccess={(user) => {
            handleUpdateCurrentUser(user);
            setIsAuthModalOpen(false);
          }}
          onShowToast={showToast}
          hasUpdate={hasNewCodeUpdate}
          latestVersion={serverVersionInfo}
          onTriggerUpdate={() => {
            setIsUpdateModalOpen(true);
          }}
        />

        {/* Security badge and app status */}
        <div className="mt-4 text-center z-10 space-y-1">
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>OPPO Label Studio v{CLIENT_APP_VERSION}</span>
            <span>•</span>
            <span>Bảo mật hệ thống HCM4</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Hệ thống bảo mật: Bắt buộc xác thực tài khoản để truy cập dữ liệu
          </p>
        </div>

        {/* Live OTA Cloud Update Modal if triggered from login */}
        {isUpdateModalOpen && (
          <UpdateProgressModal
            isOpen={isUpdateModalOpen}
            onClose={() => setIsUpdateModalOpen(false)}
            targetVersion={serverVersionInfo}
            targetBuildId={serverBuildId}
            releaseNotes={updateReleaseNotes}
            windowsDownloadUrl={updateWindowsUrl}
            onUpdateComplete={() => {
              setIsUpdateModalOpen(false);
              handleForceUpdateWindowsApp();
            }}
          />
        )}

        {/* Toast alerts */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] max-w-xl w-[calc(100%-2rem)] sm:w-auto shadow-2xl pointer-events-auto">
            <div
              className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-3 border shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2 duration-150 ${
                toastMessage.type === 'success'
                  ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/60 shadow-emerald-950/40'
                  : toastMessage.type === 'error'
                  ? 'bg-slate-900/95 text-rose-300 border-rose-500/60 shadow-rose-950/40'
                  : 'bg-slate-900/95 text-sky-300 border-sky-500/60 shadow-sky-950/40'
              }`}
            >
              <span>{toastMessage.text}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f4f6f9] text-stone-900 flex font-sans">
      {/* Hidden File Input for Excel / Catalog Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleExcelUpload}
        accept=".xlsx, .xls, .csv, .tsv, .txt, .json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Live OTA Cloud Update Notification Banner */}
      {hasNewCodeUpdate && (
        <div className="no-print fixed top-0 left-0 right-0 bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md z-50 border-b border-amber-500/30">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-amber-500 text-stone-950 font-bold text-[10px] rounded">MỚI</span>
            <span className="text-stone-200">Có bản cập nhật mới (v{serverVersionInfo}) từ Cloud Server. Bấm nút bên cạnh để cập nhật.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(true)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-current text-stone-950" />
              <span>Cập Nhật Ngay</span>
            </button>
            <button
              type="button"
              onClick={() => setHasNewCodeUpdate(false)}
              className="text-stone-400 hover:text-white px-1.5 py-0.5 text-xs rounded hover:bg-white/10 cursor-pointer"
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* G-CSM Multi-level Sidebar Menu */}
      <SidebarNav
        mainMode={mainMode}
        onChangeMainMode={(mode) => {
          setMainMode(mode);
          if (mode === 'shortage') {
            setHasNewShortageRegistration(false);
            try {
              localStorage.setItem('app_has_new_shortage_notice', 'false');
            } catch (e) {}
            if (!activeSubId || !activeSubId.startsWith('shortage-')) {
              setActiveSubId('shortage-main');
            }
          } else if (mode === 'device_iot') {
            setHasNewDeviceRegistration(false);
            try {
              localStorage.setItem('app_has_new_device_notice', 'false');
            } catch (e) {}
            if (!activeSubId || !activeSubId.startsWith('device-')) {
              setActiveSubId('device-main');
            }
          } else if (mode === 'overview') {
            setActiveSubId('overview-main');
          } else if (mode === 'labels') {
            if (activeTab === 'split') setActiveSubId('labels-split');
            else if (activeTab === 'editor') setActiveSubId('labels-editor');
            else if (activeTab === 'custom_print') setActiveSubId('labels-custom-print');
            else if (activeTab === 'preview') setActiveSubId('labels-preview');
            else setActiveSubId('labels-split');
          }
        }}
        activeSubId={activeSubId}
        onSelectSubItem={(subId, mode) => {
          setActiveSubId(subId);
          if (mode) setMainMode(mode);
          if (subId.startsWith('shortage-') || mode === 'shortage') {
            setHasNewShortageRegistration(false);
            try {
              localStorage.setItem('app_has_new_shortage_notice', 'false');
            } catch (e) {}
          }
          if (subId.startsWith('device-') || mode === 'device_iot') {
            setHasNewDeviceRegistration(false);
            try {
              localStorage.setItem('app_has_new_device_notice', 'false');
            } catch (e) {}
          }
          if (subId === 'overview-main' || subId === 'overview') {
            setMainMode('overview');
          } else if (subId === 'labels-split') {
            setMainMode('labels');
            setActiveTab('split');
          } else if (subId === 'labels-editor') {
            setMainMode('labels');
            setActiveTab('editor');
          } else if (subId === 'labels-[#custom_print]' || subId === 'labels-custom-print') {
            setMainMode('labels');
            setActiveTab('custom_print');
          } else if (subId === 'labels-preview') {
            setMainMode('labels');
            setActiveTab('preview');
          } else if (subId === 'labels-main') {
            setMainMode('labels');
          } else if (subId.startsWith('shortage-')) {
            setMainMode('shortage');
          } else if (subId.startsWith('device-')) {
            setMainMode('device_iot');
          }
        }}
        activeTab={activeTab}
        onChangeActiveTab={(tab) => {
          setActiveTab(tab);
          setMainMode('labels');
          if (tab === 'split') setActiveSubId('labels-split');
          else if (tab === 'editor') setActiveSubId('labels-editor');
          else if (tab === 'custom_print') setActiveSubId('labels-custom-print');
          else if (tab === 'preview') setActiveSubId('labels-preview');
        }}
        customPrintCount={totalCustomQueueLabels}
        labelsCount={items.length}
        totalWarningsCount={appTotalWarningsCount}
        shortageCount={shortageBookings.length}
        deviceIotCount={deviceIotBookings.length}
        isAdmin={currentUser?.role === 'admin'}
        currentUser={currentUser || undefined}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        onOpenGuideModal={() => setIsGuideOpen(true)}
        onOpenFastBackupRestore={currentUser?.role === 'admin' ? () => setIsFastBackupRestoreOpen(true) : undefined}
        onLoadCatalogFromCloud={handleLoadCatalogFromCloud}
        onSyncLabelsToCloud={handleSyncLabelsToCloud}
        onUploadCatalogFileToCloud={handleUploadCatalogFileToCloud}
        catalogCount={cloudCatalogLabels.length}
        isSyncingCatalog={isSyncingCatalogToCloud}
        onAddNewRow={handleAddNewRow}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        pendingRequestsCount={currentUser?.role === 'admin' ? pendingRequestsCount : 0}
        hasUpdate={hasNewCodeUpdate}
        onLogout={handleLogout}
        onOpenLoginModal={() => setIsAuthModalOpen(true)}
        onOpenMobileAppModal={() => setIsMobileAppModalOpen(true)}
        hasNewShortageRegistration={hasNewShortageRegistration}
        hasNewDeviceRegistration={hasNewDeviceRegistration}
        hasNewNotificationChange={liveNotificationsBadgeCount > 0}
        hasNewWarningsNotice={hasNewWarningsNotice}
      />

      {/* Right Side Workstation Layout */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#f4f6f9]">
        {/* Top Header / G-CSM Topbar */}
        <header className="no-print bg-white border-b border-stone-200 h-[56px] px-4 flex items-center justify-between shrink-0 shadow-2xs z-30">
          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-2 overflow-hidden text-xs">
            <span className="text-stone-400 font-medium hidden sm:inline">Trang chủ</span>
            <span className="text-stone-300 hidden sm:inline">/</span>
            <span className="text-stone-500 font-medium truncate">
              {mainMode === 'overview' && 'Báo cáo toàn hệ thống'}
              {mainMode === 'labels' && 'Quản lý kho linh kiện'}
              {mainMode === 'shortage' && 'Quản lý đặt chờ linh kiện'}
              {mainMode === 'device_iot' && 'Quản lý máy & IOT'}
            </span>
            <span className="text-stone-300">/</span>
            <span className="text-emerald-700 font-bold truncate">
              {mainMode === 'overview' && 'Tổng Quan Báo Cáo & Thống Kê Toàn Hệ Thống'}
              {mainMode === 'labels' && (
                activeTab === 'split' ? 'In tem kho 3x2 / Chia đôi màn hình' :
                activeTab === 'editor' ? 'In tem kho 3x2 / Bảng dữ liệu' :
                activeTab === 'custom_print' ? 'In tem kho 3x2 / Bảng dữ liệu cần in' :
                'In tem kho 3x2 / Xem trước tem in'
              )}
              {mainMode === 'shortage' && (
                activeSubId === 'shortage-warnings' ? 'Cảnh Báo & Nhắc Nhở Tiến Độ Chờ Linh Kiện' :
                activeSubId === 'shortage-check-dup' ? 'Tra cứu & Phân tích trùng linh kiện' :
                activeSubId === 'shortage-holds' ? 'Gọi đặt trước / Đặt giữ SVD' :
                'Danh sách phiếu đặt chờ linh kiện'
              )}
              {mainMode === 'device_iot' && (
                activeSubId === 'device-warnings' ? 'Cảnh báo & Nhắc nhở thiết bị' :
                activeSubId === 'device-check-dup' ? 'Tra cứu & Check trùng thiết bị' :
                activeSubId === 'device-holds' ? 'Thiết bị lưu kho & Đặt giữ' :
                'Danh sách máy & IOT'
              )}
            </span>
          </div>

          {/* Quick Actions & Header Tools */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* System links */}
            <div className="hidden xl:flex items-center gap-2 text-xs text-stone-500 border-r border-stone-200 pr-2.5 font-medium">
              <a
                href="https://oln-cs.myoppo.com/main/#/index"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-600 hover:font-bold cursor-pointer transition-colors"
                title="Mở cổng O-Learning"
              >
                O-Learning
              </a>
              <span className="text-stone-300">|</span>
              <a
                href="https://gkm-portal-sg.oppo.com/service/home"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-600 hover:font-bold cursor-pointer transition-colors"
                title="Mở cổng GKM"
              >
                GKM
              </a>
            </div>

            {/* Realtime Stats */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-medium text-stone-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span className="text-emerald-700 font-bold font-mono">{onlineUsersCount} Online</span>
              <span className="text-stone-300">|</span>
              <span className="font-mono text-stone-600">{totalVisitsCount.toLocaleString('vi-VN')} lượt xem</span>
            </div>

            {/* App Android Install & Mobile Sync Button */}
            <PWAInstallButton
              onOpenMobileModal={() => setIsMobileAppModalOpen(true)}
              variant="header"
            />

            {/* GitHub Release Auto Update Button */}
            <button
              type="button"
              onClick={() => setIsGitHubUpdateModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
              title="Kiểm tra & Tải bản cập nhật ứng dụng tự động (.exe & .deb) từ GitHub Releases"
            >
              <Github className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Cập nhật GitHub</span>
            </button>

            {/* Quick JSON Backup / Restore Button */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsFastBackupRestoreOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-900 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                title="Sao lưu toàn hệ thống hoặc khôi phục siêu tốc dữ liệu từ file JSON khi chuyển tài khoản hoặc đổi máy"
              >
                <FileJson className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Sao Lưu / Khôi Phục</span>
                <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded text-[10px] font-black shadow-2xs">JSON</span>
              </button>
            )}

            {/* Notification Bell with Dynamic Notification Center Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationCenterOpen((prev) => !prev)}
                className={`relative p-1.5 rounded-lg transition-all cursor-pointer ${
                  isNotificationCenterOpen
                    ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400'
                    : liveNotificationsBadgeCount > 0
                    ? 'bg-rose-100 text-rose-800 ring-2 ring-rose-400/80 animate-pulse shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
                title="Trung tâm thông báo & Cảnh báo hệ thống"
              >
                <Bell className={`w-4 h-4 ${liveNotificationsBadgeCount > 0 ? 'text-rose-600 animate-bounce' : ''}`} />
                {liveNotificationsBadgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-mono text-[9px] font-black px-1 rounded-full min-w-[16px] h-4 flex items-center justify-center shadow-xs animate-in zoom-in-50 duration-150">
                    {liveNotificationsBadgeCount > 99 ? '99+' : liveNotificationsBadgeCount}
                  </span>
                )}
              </button>

              {/* System Notification Center Popover */}
              <SystemNotificationCenter
                isOpen={isNotificationCenterOpen}
                onClose={() => setIsNotificationCenterOpen(false)}
                currentUser={currentUser}
                usersList={usersList}
                techniciansList={techniciansList}
                shortageBookings={shortageBookings}
                deviceIotBookings={deviceIotBookings}
                hasNewCodeUpdate={hasNewCodeUpdate}
                serverVersion={serverVersionInfo}
                clientVersion={CLIENT_APP_VERSION}
                userReadNotificationIds={userReadNotificationIds}
                onUpdateReadIds={handleUpdateReadNotificationIds}
                onOpenAdminModal={() => {
                  setIsAdminModalOpen(true);
                  setIsNotificationCenterOpen(false);
                }}
                onOpenAdminTab={(tab) => {
                  setAdminInitialTab(tab);
                  setIsAdminModalOpen(true);
                  setIsNotificationCenterOpen(false);
                }}
                onNavigateToMode={(mode, subTab, details) => {
                  setMainMode(mode);
                  if (mode === 'shortage') {
                    if (subTab === 'warnings') {
                      setActiveSubId('shortage-warnings');
                    } else if (subTab === 'holds') {
                      setActiveSubId('shortage-holds');
                    } else if (subTab === 'check-dup') {
                      setActiveSubId('shortage-check-dup');
                    } else {
                      setActiveSubId('shortage-main');
                    }

                    setShortageTargetNavigation({
                      subTab,
                      statusFilter: details?.statusFilter,
                      warningBranch: details?.warningBranch,
                      searchTerm: details?.targetSearch || details?.ticketNumber,
                      ticketId: details?.ticketId,
                      nonce: Date.now(),
                    });
                  } else if (mode === 'device_iot') {
                    setActiveSubId('device-main');
                    setDeviceTargetNavigation({
                      subTab,
                      statusFilter: details?.statusFilter,
                      searchTerm: details?.targetSearch || details?.ticketNumber,
                      nonce: Date.now(),
                    });
                  }
                  setIsNotificationCenterOpen(false);
                }}
                onOpenUpdateModal={() => {
                  setIsUpdateModalOpen(true);
                  setIsNotificationCenterOpen(false);
                }}
                onShowToast={showToast}
                onRefreshData={() => {
                  pullLatestShortagesFromCloud()
                    .then((items) => {
                      if (Array.isArray(items)) setShortageBookings(items);
                    })
                    .catch(() => {});
                  pullLatestDeviceIotsFromCloud()
                    .then((items) => {
                      if (Array.isArray(items)) setDeviceIotBookings(items);
                    })
                    .catch(() => {});
                  showToast('Đã làm mới dữ liệu thông báo từ Cloud!', 'success');
                }}
              />
            </div>

            {/* User Profile Pill & Login / Logout */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-stone-200 shrink-0">
              {currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentUser.role === 'admin') setIsAdminModalOpen(true);
                      else setIsAuthModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1 bg-stone-100 hover:bg-stone-200/80 rounded-lg transition-colors cursor-pointer"
                    title={`Đang đăng nhập: ${currentUser.name}. Bấm để đổi tài khoản`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 ${
                      currentUser.role === 'admin' ? 'bg-purple-600' : 'bg-emerald-600'
                    }`}>
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="hidden lg:flex flex-col text-left">
                      <span className="text-xs font-bold text-stone-800 leading-tight max-w-[120px] truncate">
                        {currentUser.name}
                      </span>
                      <span className="text-[9px] font-mono text-stone-500 leading-none">
                        {currentUser.role === 'admin' ? 'Quản trị viên' : 'KTV Phú Lâm'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Đăng xuất khỏi hệ thống"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  title="Đăng nhập hệ thống"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Workspace Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 custom-scrollbar flex flex-col gap-4">
          {quotaErrorDetail && (
            <QuotaExceededBanner
              errorDetails={quotaErrorDetail}
              onDismiss={() => {
                setQuotaErrorDetail(null);
                setQuotaExceededState(false);
                showToast('Đang thử kết nối lại với Cloud Firestore...', 'info');
                setTimeout(() => {
                  window.location.reload();
                }, 400);
              }}
            />
          )}

          {/* Top Floating Notification Toast */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] max-w-xl w-[calc(100%-2rem)] sm:w-auto shadow-2xl pointer-events-auto">
            <div
              className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-3 border shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2 duration-150 ${
                toastMessage.type === 'success'
                  ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/60 shadow-emerald-950/40'
                  : toastMessage.type === 'error'
                  ? 'bg-slate-900/95 text-rose-300 border-rose-500/60 shadow-rose-950/40'
                  : 'bg-slate-900/95 text-sky-300 border-sky-500/60 shadow-sky-950/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                {toastMessage.type === 'info' && <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />}
                <span className="leading-snug">{toastMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Overview / Device & IOT / Shortage / Label Studio Workspace Views */}
        {mainMode === 'overview' ? (
          <OverviewDashboard
            shortageBookings={shortageBookings}
            deviceIotBookings={deviceIotBookings}
            catalogLabels={items.length > 0 ? items : cloudCatalogLabels}
            customPrintItems={customPrintItems}
            techniciansList={techniciansList}
            usersList={usersList}
            currentUser={currentUser || undefined}
            onNavigateToMode={(mode, subId, tab) => {
              setMainMode(mode);
              if (subId) setActiveSubId(subId);
              if (tab) setActiveTab(tab);
            }}
            onShowToast={showToast}
            onRefreshCloudData={async () => {
              setIsRefreshingData(true);
              try {
                const [cloudShortages, cloudIots] = await Promise.all([
                  pullLatestShortagesFromCloud().catch(() => null),
                  pullLatestDeviceIotsFromCloud().catch(() => null),
                ]);
                if (cloudShortages && cloudShortages.length > 0) {
                  setShortageBookings(cloudShortages);
                }
                if (cloudIots && cloudIots.length > 0) {
                  setDeviceIotBookings(cloudIots);
                }
                showToast('Đã làm mới dữ liệu toàn hệ thống từ Cloud thành công!', 'success');
              } catch (err) {
                console.error('Refresh data error:', err);
                showToast('Có lỗi khi làm mới dữ liệu từ Cloud.', 'error');
              } finally {
                setIsRefreshingData(false);
              }
            }}
            cloudSynced={cloudSynced}
            isRefreshing={isRefreshingData}
          />
        ) : mainMode === 'device_iot' ? (
          <DeviceIotManager
            activeSubId={activeSubId}
            onSelectSubId={setActiveSubId}
            bookings={deviceIotBookings}
            onUpdateBookings={handleUpdateDeviceIotBookings}
            onShowToast={showToast}
            currentUser={currentUser || undefined}
            cloudSynced={cloudSynced}
            onOpenAdminModal={currentUser?.role === 'admin' ? () => setIsAdminModalOpen(true) : undefined}
            onOpenFastBackupRestore={currentUser?.role === 'admin' ? () => setIsFastBackupRestoreOpen(true) : undefined}
            targetNavigation={deviceTargetNavigation}
          />
        ) : mainMode === 'ai_chatbot' ? (
          <div className="w-full">
            <AiChatbot
              catalogLabels={items.length > 0 ? items : cloudCatalogLabels}
              shortageBookings={shortageBookings}
              deviceIotBookings={deviceIotBookings}
              techniciansList={techniciansList}
              items={items}
              onNavigateTarget={(target) => {
                setMainMode(target.tab);
                if (target.tab === 'shortage') {
                  const targetSub = target.subTab || 'shortage-main';
                  setActiveSubId(targetSub);
                  setShortageTargetNavigation({
                    subTab: targetSub,
                    statusFilter: target.statusFilter,
                    warningBranch: target.warningBranch,
                    searchTerm: target.searchTerm,
                    ticketNumber: target.ticketNumber,
                    nonce: Date.now(),
                  });
                } else if (target.tab === 'device_iot') {
                  const targetSub = target.subTab || 'device-main';
                  setActiveSubId(targetSub);
                  setDeviceTargetNavigation({
                    subTab: targetSub,
                    statusFilter: target.statusFilter,
                    searchTerm: target.searchTerm,
                    nonce: Date.now(),
                  });
                } else if (target.tab === 'labels') {
                  if (target.subTab === 'catalog') {
                    setActiveSubId('labels-catalog');
                    setActiveTab('split');
                  } else {
                    setActiveSubId(target.subTab || 'labels-split');
                  }
                }
              }}
              workspaceContext={{
                labelsCount: items.length,
                catalogCount: cloudCatalogLabels.length,
                shortageCount: shortageBookings.length,
                pendingBookingsCount: shortageBookings.filter((b) => b.status === 'da_tao_phieu').length,
                techniciansCount: techniciansList.length,
                currentUser: currentUser ? { name: currentUser.name, role: currentUser.role } : undefined,
              }}
            />
          </div>
        ) : mainMode === 'shortage' ? (
          <ShortageManager
            activeSubId={activeSubId}
            onSelectSubId={setActiveSubId}
            bookings={shortageBookings}
            catalogLabels={items.length > 0 ? items : cloudCatalogLabels}
            onUpdateBookings={handleUpdateShortageBookings}
            onSendToLabelStudio={handleSendShortageToLabelStudio}
            onShowToast={showToast}
            onOpenAdminModal={currentUser?.role === 'admin' ? () => setIsAdminModalOpen(true) : undefined}
            onOpenFastBackupRestore={currentUser?.role === 'admin' ? () => setIsFastBackupRestoreOpen(true) : undefined}
            cloudSynced={cloudSynced}
            currentUser={currentUser}
            isAdmin={currentUser?.role === 'admin'}
            targetNavigation={shortageTargetNavigation}
          />
        ) : (
          <>

        {/* Global Print & View Toolbar */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Active View Title & Badge Indicator */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 font-bold text-sm text-stone-800 bg-stone-100/90 px-3 py-1.5 rounded-lg border border-stone-200">
              {activeTab === 'editor' && <TableIcon className="w-4 h-4 text-emerald-600 shrink-0" />}
              {activeTab === 'split' && <Layers className="w-4 h-4 text-emerald-600 shrink-0" />}
              {activeTab === 'custom_print' && <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />}
              {activeTab === 'preview' && <Eye className="w-4 h-4 text-emerald-600 shrink-0" />}
              <span>
                {activeTab === 'editor' && 'Bảng dữ liệu'}
                {activeTab === 'split' && 'Chia đôi màn hình'}
                {activeTab === 'custom_print' && 'Bảng dữ liệu cần in'}
                {activeTab === 'preview' && 'Xem trước tem in'}
              </span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 text-xs font-mono font-bold rounded-full border border-emerald-300 shadow-2xs">
              {activeTab === 'custom_print'
                ? selectedCustomPrintItems.length === customPrintItems.length || selectedCustomPrintItems.length === 0
                  ? `${totalCustomQueueLabels} tem`
                  : `${totalSelectedCustomLabels} / ${totalCustomQueueLabels} tem`
                : `${activeTab === 'preview' ? totalLabelCount : items.length} tem`}
            </span>
          </div>

          {/* Context-aware Functional Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {(activeTab === 'editor' || activeTab === 'split') && (
              <div className="flex items-center gap-1.5 border-r border-stone-200 pr-2 mr-1">
                <button
                  type="button"
                  onClick={() => setIsLinkSyncModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 hover:from-indigo-800 hover:to-blue-800 text-white shadow-2xs cursor-pointer transition-all hover:shadow-xs active:scale-95"
                  title="Tự động đồng bộ & cập nhật danh sách mã linh kiện mới từ Link Share Gemini / Google Sheet"
                >
                  <Link2 className="w-3.5 h-3.5 text-indigo-200" />
                  <span>🔗 Cập nhật mã từ Link</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-extrabold bg-emerald-500 text-white shadow-2xs">
                    NEW
                  </span>
                </button>
              </div>
            )}
            {activeTab === 'custom_print' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCustomPrintItems.length === 0) {
                      showToast('Vui lòng tích chọn ít nhất 1 linh kiện trong bảng để mở tab in!', 'error');
                      return;
                    }
                    openPrintWindow(selectedCustomPrintItems, { ...config, respectQuantity: true }, 'In Danh Sách Tem Chỉ Định (Excel)');
                  }}
                  disabled={selectedCustomPrintItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-40 cursor-pointer transition-colors"
                  title="Mở các tem được chọn trong tab mới"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mở tab in riêng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedCustomPrintItems.length === 0) {
                      showToast('Vui lòng tích chọn ít nhất 1 linh kiện trong bảng để tải file HTML!', 'error');
                      return;
                    }
                    downloadPrintableHtmlFile(selectedCustomPrintItems, { ...config, respectQuantity: true });
                  }}
                  disabled={selectedCustomPrintItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 disabled:opacity-40 cursor-pointer transition-colors"
                  title="Tải file HTML in danh sách các tem được chọn"
                >
                  <FileCode className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Tải file in (.html)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintTest}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 cursor-pointer transition-colors"
                  title="In 1 tem thử nghiệm để căn chỉnh máy in"
                >
                  <Printer className="w-3.5 h-3.5 text-neutral-600" />
                  <span>In thử 1 tem</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedCustomPrintItems.length === 0) {
                      showToast('Vui lòng tích chọn ít nhất 1 linh kiện trong bảng để in!', 'error');
                      return;
                    }
                    handleDirectNativePrint(
                      selectedCustomPrintItems,
                      `In ${totalSelectedCustomLabels} Tem Chỉ Định (Excel)`,
                      true
                    );
                  }}
                  disabled={selectedCustomPrintItems.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all hover:shadow-md"
                  title={
                    selectedCustomPrintItems.length === 0
                      ? 'Chưa chọn tem nào để in'
                      : `In ${totalSelectedCustomLabels} tem được chọn`
                  }
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {customPrintItems.length === 0
                      ? 'Chưa có tem cần in'
                      : selectedCustomPrintItems.length === 0
                      ? 'Chưa chọn tem để in'
                      : selectedCustomPrintItems.length === customPrintItems.length
                      ? `In ${totalCustomQueueLabels} tem trong hàng đợi`
                      : `In ${totalSelectedCustomLabels} tem đã chọn (${selectedCustomPrintItems.length}/${customPrintItems.length} mã)`}
                  </span>
                  {selectedCustomPrintItems.length > 0 && (
                    <span className="bg-emerald-800 text-emerald-100 text-[11px] px-1.5 py-0.5 rounded-full font-mono font-normal">
                      Ctrl+P
                    </span>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleOpenPrintTab}
                  disabled={items.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-40 cursor-pointer transition-colors"
                  title="Mở toàn bộ tem trong tab mới có sẵn nút in trực tiếp"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mở tab in riêng</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadHtmlFile}
                  disabled={items.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 disabled:opacity-40 cursor-pointer transition-colors"
                  title="Tải file HTML in tem chuẩn để mở bằng trình duyệt in offline bất cứ lúc nào"
                >
                  <FileCode className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Tải file in (.html)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintTest}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 cursor-pointer transition-colors"
                  title="In 1 tem thử nghiệm để căn chỉnh máy in"
                >
                  <Printer className="w-3.5 h-3.5 text-neutral-600" />
                  <span>In thử 1 tem</span>
                </button>

                {/* Quick Toggle for Quantity Multiplication */}
                <label
                  title={
                    config.respectQuantity
                      ? 'Đang BẬT: Sẽ in nhân bản theo số lượng từng mục trong bảng (x2, x3...)'
                      : 'Đang TẮT: Mỗi mã linh kiện chỉ in đúng 1 tem duy nhất'
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors select-none ${
                    config.respectQuantity
                      ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-2xs'
                      : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={config.respectQuantity}
                    onChange={(e) => setConfig((prev) => ({ ...prev, respectQuantity: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="whitespace-nowrap">
                    {config.respectQuantity ? 'In theo SL (x2, x3...)' : 'In 1 tem / mã'}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handlePrintAll}
                  disabled={itemsToPrint.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all hover:shadow-md"
                  title="Kích hoạt hộp thoại in tem ngay lập tức"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {isNoSelection
                      ? 'Chưa chọn tem nào'
                      : isPartialSelection
                      ? `In ${totalLabelCount} tem đã chọn (${selectedItems.length}/${items.length} mã)`
                      : `In tất cả ${totalLabelCount} tem`}
                  </span>
                  <span className="bg-emerald-800 text-emerald-100 text-[11px] px-1.5 py-0.5 rounded-full font-mono font-normal">
                    Ctrl+P
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Layouts based on Active Tab */}
        {activeTab === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Data Table (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              <DataTable
                items={items}
                focusedItemId={focusedItemId}
                onFocusItem={handleFocusItem}
                onUpdateItems={handleItemsChange}
                onPrintSelected={handlePrintSelected}
                onAddNewRow={handleAddNewRow}
                isAdmin={currentUser?.role === 'admin'}
                shortageBookings={shortageBookings}
                onNavigateToShortage={(ticket?: string) => {
                  setMainMode('shortage');
                }}
              />
            </div>

            {/* Right Column: Live Label Preview (6 cols) */}
            <div className="lg:col-span-6 bg-white rounded-xl border border-neutral-200 p-4 shadow-xs flex flex-col min-h-[500px]">
              <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-neutral-200 gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <h2 className="font-bold text-sm text-neutral-900">
                    Bản Xem Trước ({config.widthInch}" x {config.heightInch}")
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId =
                          items.find((i) => i.selected)?.id ||
                          (focusedItemId && items.some((i) => i.id === focusedItemId) && focusedItemId) ||
                          paginatedPreviewItems[0]?.id ||
                          items[0]?.id;
                        if (targetId) handleFocusItem(targetId);
                      }}
                      className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 cursor-pointer flex items-center gap-1 shadow-2xs transition-colors"
                      title="Tìm và xem vị trí tem của dòng đang được tick chọn"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        Xem vị trí tem
                        {(() => {
                          const targetItem =
                            items.find((i) => i.selected) ||
                            (focusedItemId ? items.find((i) => i.id === focusedItemId) : null);
                          if (targetItem) {
                            const idx = items.findIndex((i) => i.id === targetItem.id);
                            return idx !== -1 ? ` (#${idx + 1})` : '';
                          }
                          return '';
                        })()}
                      </span>
                    </button>
                  )}

                  {/* Preview Page Selector */}
                  {items.length > 30 && (
                    <div className="flex items-center gap-1">
                      <select
                        value={previewPageSize}
                        onChange={(e) => {
                          const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                          setPreviewPageSize(val);
                          setPreviewPage(1);
                        }}
                        className="text-[11px] py-0.5 px-1 bg-white border border-neutral-300 rounded focus:outline-none"
                      >
                        <option value={15}>15 tem/trang</option>
                        <option value={30}>30 tem/trang</option>
                        <option value={60}>60 tem/trang</option>
                        <option value={120}>120 tem/trang</option>
                        <option value="all">Tất cả ({items.length})</option>
                      </select>

                      {previewPageSize !== 'all' && previewTotalPages > 1 && (
                        <div className="inline-flex items-center border border-neutral-300 bg-white rounded">
                          <button
                            type="button"
                            onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                            disabled={previewPage === 1}
                            className="px-1.5 py-0.5 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <span className="px-1.5 text-[11px] font-semibold text-neutral-700">
                            {previewPage}/{previewTotalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                            disabled={previewPage === previewTotalPages}
                            className="px-1.5 py-0.5 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-neutral-500 font-medium">
                    {isPartialSelection ? (
                      <span>
                        <strong className="text-blue-700">{selectedItems.length}/{items.length}</strong> loại đã chọn • <strong className="text-neutral-900">{totalLabelCount}</strong> bản in
                      </span>
                    ) : (
                      <span>
                        <strong>{items.length}</strong> loại • <strong>{totalLabelCount}</strong> bản in
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center">
                  <FileText className="w-12 h-12 stroke-[1.2] mb-2 text-neutral-300" />
                  <p className="font-medium text-neutral-600 text-sm">Chưa có tem nào</p>
                  <p className="text-xs text-neutral-400 max-w-xs mt-1">
                    Nhập dữ liệu vào ô bên trái hoặc tải file Excel để xem trước tem tức thì.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-5 justify-center items-start overflow-y-auto max-h-[calc(100vh-250px)] min-h-[450px] p-2 bg-neutral-50/60 rounded-lg border border-neutral-100">
                    {paginatedPreviewItems.map((item, idx) => (
                      <LabelCard
                        key={item.id}
                        item={item}
                        config={config}
                        index={previewPageSize === 'all' ? idx : (previewPage - 1) * previewPageSize + idx}
                        isFocused={item.id === focusedItemId}
                        onSelectFocus={handleFocusItem}
                        onPrintSingle={handlePrintSingle}
                        onUpdateItem={handleUpdateSingleItem}
                        onDelete={(id) => {
                          handleItemsChange(items.filter((i) => i.id !== id));
                        }}
                        isAdmin={currentUser?.role === 'admin'}
                        showStockCheckButton={showStockCheckButton}
                      />
                    ))}
                  </div>

                  {/* Preview bottom pagination if multiple pages */}
                  {previewPageSize !== 'all' && previewTotalPages > 1 && (
                    <div className="flex items-center justify-between px-2 pt-2 border-t border-neutral-100 text-xs text-neutral-500">
                      <span>
                        Đang xem trang <strong>{previewPage} / {previewTotalPages}</strong> ({paginatedPreviewItems.length} tem hiển thị)
                      </span>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                          disabled={previewPage === 1}
                          className="px-2 py-0.5 text-xs bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
                        >
                          Trang trước
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                          disabled={previewPage === previewTotalPages}
                          className="px-2 py-0.5 text-xs bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
                        >
                          Trang sau
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="flex flex-col gap-4">
            <DataTable
              items={items}
              focusedItemId={focusedItemId}
              onFocusItem={handleFocusItem}
              onUpdateItems={handleItemsChange}
              onPrintSelected={handlePrintSelected}
              onAddNewRow={handleAddNewRow}
              isAdmin={currentUser?.role === 'admin'}
              shortageBookings={shortageBookings}
              onNavigateToShortage={(ticket?: string) => {
                setMainMode('shortage');
              }}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs flex flex-col">
            <div className="flex flex-wrap items-center justify-between pb-3 mb-5 border-b border-neutral-200 gap-3">
              <div>
                <h2 className="font-bold text-base text-neutral-900">
                  Danh Sách Tem In Khổ {config.widthInch}" x {config.heightInch}" ({config.widthMm} x {config.heightMm}mm)
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Kiểm tra trực quan mã QR, mã vạch và vị trí chữ trước khi bấm in.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId =
                        items.find((i) => i.selected)?.id ||
                        (focusedItemId && items.some((i) => i.id === focusedItemId) && focusedItemId) ||
                        paginatedPreviewItems[0]?.id ||
                        items[0]?.id;
                      if (targetId) handleFocusItem(targetId);
                    }}
                    className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
                    title="Tìm và xem vị trí tem của dòng đang được tick chọn"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      Xem vị trí tem
                      {(() => {
                        const targetItem =
                          items.find((i) => i.selected) ||
                          (focusedItemId ? items.find((i) => i.id === focusedItemId) : null);
                        if (targetItem) {
                          const idx = items.findIndex((i) => i.id === targetItem.id);
                          return idx !== -1 ? ` (#${idx + 1})` : '';
                        }
                        return '';
                      })()}
                    </span>
                  </button>
                )}

                {/* Preview Page Selector */}
                {items.length > 30 && (
                  <div className="flex items-center gap-1">
                    <select
                      value={previewPageSize}
                      onChange={(e) => {
                        const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setPreviewPageSize(val);
                        setPreviewPage(1);
                      }}
                      className="text-xs py-1 px-2 bg-white border border-neutral-300 rounded-lg focus:outline-none"
                    >
                      <option value={24}>24 tem/trang</option>
                      <option value={48}>48 tem/trang</option>
                      <option value={96}>96 tem/trang</option>
                      <option value="all">Tất cả ({items.length})</option>
                    </select>

                    {previewPageSize !== 'all' && previewTotalPages > 1 && (
                      <div className="inline-flex items-center border border-neutral-300 bg-white rounded-lg">
                        <button
                          type="button"
                          onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                          disabled={previewPage === 1}
                          className="p-1 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-xs font-semibold text-neutral-700">
                          {previewPage} / {previewTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                          disabled={previewPage === previewTotalPages}
                          className="p-1 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                  {isPartialSelection
                    ? `Đã chọn ${selectedItems.length}/${items.length} mã (${totalLabelCount} tem)`
                    : `Tổng ${totalLabelCount} tem`}
                </span>
                <button
                  type="button"
                  onClick={handlePrintAll}
                  disabled={itemsToPrint.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>
                    {isPartialSelection
                      ? `In ${totalLabelCount} tem đã chọn`
                      : `In tất cả (${totalLabelCount} tem)`}
                  </span>
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                <p className="text-sm">Chưa có tem nào để hiển thị.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-6 justify-center items-start p-4 bg-neutral-50/80 rounded-xl border border-neutral-200">
                  {config.template === 'split_horizontal' ? (
                    Array.from({ length: Math.ceil(paginatedPreviewItems.length / 2) }).map((_, i) => {
                      const topItem = paginatedPreviewItems[i * 2];
                      const bottomItem = paginatedPreviewItems[i * 2 + 1];
                      const idx = previewPageSize === 'all' ? i * 2 : (previewPage - 1) * previewPageSize + i * 2;
                      return (
                        <LabelCard
                          key={`${topItem.id}-${bottomItem?.id || 'single'}`}
                          item={topItem}
                          itemBottom={bottomItem}
                          config={config}
                          index={idx}
                          isFocused={topItem.id === focusedItemId || bottomItem?.id === focusedItemId}
                          onSelectFocus={handleFocusItem}
                          onPrintSingle={handlePrintSingle}
                          onUpdateItem={handleUpdateSingleItem}
                          onDelete={(id) => {
                            handleItemsChange(items.filter((i) => i.id !== id));
                          }}
                          isAdmin={currentUser?.role === 'admin'}
                          showStockCheckButton={showStockCheckButton}
                        />
                      );
                    })
                  ) : (
                    paginatedPreviewItems.map((item, idx) => (
                      <LabelCard
                        key={item.id}
                        item={item}
                        config={config}
                        index={previewPageSize === 'all' ? idx : (previewPage - 1) * previewPageSize + idx}
                        isFocused={item.id === focusedItemId}
                        onSelectFocus={handleFocusItem}
                        onPrintSingle={handlePrintSingle}
                        onUpdateItem={handleUpdateSingleItem}
                        onDelete={(id) => {
                          handleItemsChange(items.filter((i) => i.id !== id));
                        }}
                        isAdmin={currentUser?.role === 'admin'}
                        showStockCheckButton={showStockCheckButton}
                      />
                    ))
                  )}
                </div>

                {previewPageSize !== 'all' && previewTotalPages > 1 && (
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-600">
                    <span>
                      Đang xem trang <strong>{previewPage} / {previewTotalPages}</strong> ({paginatedPreviewItems.length} tem trên trang này)
                    </span>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                        disabled={previewPage === 1}
                        className="px-3 py-1 bg-white border border-neutral-300 rounded font-medium hover:bg-neutral-100 disabled:opacity-40 cursor-pointer"
                      >
                        Trang trước
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                        disabled={previewPage === previewTotalPages}
                        className="px-3 py-1 bg-white border border-neutral-300 rounded font-medium hover:bg-neutral-100 disabled:opacity-40 cursor-pointer"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'custom_print' && (
          <div className="flex flex-col gap-4">
            <CustomPrintQueueTab
              customItems={customPrintItems}
              setCustomItems={setCustomPrintItems}
              masterItems={items.length >= cloudCatalogLabels.length && items.length > 0 ? items : (cloudCatalogLabels.length > 0 ? cloudCatalogLabels : items)}
              config={config}
              onOpenPrintTab={(targetList) => {
                openPrintWindow(targetList, { ...config, respectQuantity: true }, 'In Danh Sách Tem Chỉ Định');
              }}
              onDownloadHtml={(targetList) => {
                downloadPrintableHtmlFile(targetList, { ...config, respectQuantity: true });
              }}
              onDirectPrint={(targetList) => {
                handleDirectNativePrint(targetList, 'In Danh Sách Tem Chỉ Định', true);
              }}
            />
          </div>
        )}
        </>
        )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onChangeConfig={setConfig}
      />

      {/* Visual Print Preview & Direct Print Modal (Khắc phục lỗi xem trước Windows App) */}
      {printPreviewState.isOpen && (
        <ErrorBoundary
          fallbackTitle="Lỗi hiển thị bảng xem trước in"
          isModal={true}
          onReset={() => setPrintPreviewState({ isOpen: false, items: [], title: '' })}
        >
          <PrintPreviewModal
            isOpen={true}
            onClose={() => setPrintPreviewState((prev) => ({ ...prev, isOpen: false }))}
            items={printPreviewState.items || []}
            config={config}
            title={printPreviewState.title}
            onOpenSettings={() => {
              setPrintPreviewState((prev) => ({ ...prev, isOpen: false }));
              setIsSettingsOpen(true);
            }}
          />
        </ErrorBoundary>
      )}

      {/* Authentication & Login / Switch Account Modal */}
      {isAuthModalOpen && (
        <AuthGate
          currentUser={currentUser}
          onLoginSuccess={(user) => {
            handleUpdateCurrentUser(user);
            setIsAuthModalOpen(false);
          }}
          onShowToast={showToast}
          hasUpdate={hasNewCodeUpdate}
          latestVersion={serverVersionInfo}
          onTriggerUpdate={() => {
            setIsAuthModalOpen(false);
            setIsUpdateModalOpen(true);
          }}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}

      {/* Admin & Cloud Sync Management Dashboard */}
      {isAdminModalOpen && (
        <AdminCloudDashboard
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          currentUser={
            currentUser || {
              name: 'Quản Trị Viên',
              role: 'admin',
              uid: 'admin-temp',
              username: 'admin',
              status: 'approved',
            }
          }
          onUpdateCurrentUser={handleUpdateCurrentUser}
          bookings={shortageBookings}
          deviceIotBookings={deviceIotBookings}
          onUpdateShortageBookings={handleUpdateShortageBookings}
          onUpdateDeviceIotBookings={handleUpdateDeviceIotBookings}
          cloudSynced={cloudSynced}
          onShowToast={showToast}
          currentLabelItems={items}
          onApplyCatalogLabels={(cloudItems) => handleItemsChange(cloudItems)}
          totalVisitsCount={totalVisitsCount}
          onlineUsersCount={onlineUsersCount}
          initialTab={adminInitialTab}
        />
      )}

      {/* Printer Calibration & Setting Guide */}
      <PrinterGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* OTA Live Code Auto-Update Modal */}
      <UpdateProgressModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        targetVersion={serverVersionInfo}
        targetBuildId={serverBuildId}
        releaseNotes={updateReleaseNotes}
        windowsDownloadUrl={updateWindowsUrl}
        onUpdateComplete={() => {
          setIsUpdateModalOpen(false);
          handleForceUpdateWindowsApp();
        }}
      />

      {/* Auto-Sync Share Link Modal */}
      <LinkSyncModal
        isOpen={isLinkSyncModalOpen}
        onClose={() => setIsLinkSyncModalOpen(false)}
        currentItems={items}
        onAddItems={(newItems) => {
          const updated = [...newItems, ...items];
          handleItemsChange(updated, true);
        }}
        onShowToast={showToast}
      />

      {/* Fast Full JSON Backup & Restore Modal */}
      <FastBackupRestoreModal
        isOpen={isFastBackupRestoreOpen}
        onClose={() => setIsFastBackupRestoreOpen(false)}
        currentUser={currentUser}
        onShowToast={showToast}
        shortages={shortageBookings}
        deviceIot={deviceIotBookings}
        catalogLabels={items}
        onRestored={(_result) => {
          setIsFastBackupRestoreOpen(false);
          setCloudSynced(true);
        }}
      />

      {/* Mobile Android PWA & APK Sync Modal */}
      <MobileAppInstallModal
        isOpen={isMobileAppModalOpen}
        onClose={() => setIsMobileAppModalOpen(false)}
        currentUser={currentUser}
        onShowToast={showToast}
      />

      {/* Draggable Floating Gemini AI Assistant Widget (Freely movable with mouse across screen) */}
      {mainMode !== 'ai_chatbot' && (
        <DraggableAiWidget
          isOpen={isFloatingChatOpen}
          onToggleOpen={(open) => setIsFloatingChatOpen(open)}
          catalogLabels={items.length > 0 ? items : cloudCatalogLabels}
          shortageBookings={shortageBookings}
          deviceIotBookings={deviceIotBookings}
          items={items}
          techniciansList={techniciansList}
          currentUser={currentUser}
          onNavigateTarget={(target) => {
            setMainMode(target.tab);
            if (target.tab === 'shortage') {
              const targetSub = target.subTab || 'shortage-main';
              setActiveSubId(targetSub);
              setShortageTargetNavigation({
                subTab: targetSub,
                statusFilter: target.statusFilter,
                warningBranch: target.warningBranch,
                searchTerm: target.searchTerm,
                ticketNumber: target.ticketNumber,
                nonce: Date.now(),
              });
            } else if (target.tab === 'device_iot') {
              const targetSub = target.subTab || 'device-main';
              setActiveSubId(targetSub);
              setDeviceTargetNavigation({
                subTab: targetSub,
                statusFilter: target.statusFilter,
                searchTerm: target.searchTerm,
                nonce: Date.now(),
              });
            } else if (target.tab === 'labels') {
              if (target.subTab === 'catalog') {
                setActiveSubId('labels-catalog');
                setActiveTab('split');
              } else {
                setActiveSubId(target.subTab || 'labels-split');
              }
            }
          }}
        />
      )}

      {/* Context Menu on Right-Click with Quick Actions & Scroll to Top */}
      <ContextMenu
        currentTab={mainMode}
        activeSubId={activeSubId}
        totalWarningsCount={appTotalWarningsCount}
        onSelectTab={(tab, subId) => {
          setMainMode(tab);
          if (tab === 'shortage') {
            const targetSub = subId || 'shortage-main';
            setActiveSubId(targetSub);
            setShortageTargetNavigation({
              subTab: targetSub,
              statusFilter: 'all',
              searchTerm: '',
              nonce: Date.now(),
            });
          } else if (tab === 'device_iot') {
            const targetSub = subId || 'device-main';
            setActiveSubId(targetSub);
            setDeviceTargetNavigation({
              subTab: targetSub,
              statusFilter: 'all',
              searchTerm: '',
              nonce: Date.now(),
            });
          } else if (tab === 'labels') {
            setActiveSubId(subId || 'labels-split');
          }
        }}
        onRefreshData={handleRefreshData}
        onToggleFullscreen={toggleFullScreen}
        isFullscreen={isFullscreen}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        isAdmin={currentUser?.role === 'admin'}
        onShowToast={showToast}
      />

      {/* PURE PRINT MEDIA CONTAINER (Only visible in @media print) - lazy rendered or limited when not actually printing */}
      <div className="print-container">
        {config.template === 'split_horizontal' ? (
          Array.from({ length: Math.ceil(Math.min(activePrintList.length, 100) / 2) }).map((_, i) => {
            const topItem = activePrintList[i * 2];
            const bottomItem = activePrintList[i * 2 + 1];
            return (
              <LabelCard
                key={`print-split-${topItem.id}-${i}`}
                item={topItem}
                itemBottom={bottomItem}
                config={config}
                index={i * 2}
                isPrintMode={true}
              />
            );
          })
        ) : (
          activePrintList.slice(0, 100).map((item, idx) => (
            <LabelCard
              key={`print-${item.id}-${idx}-${singlePrintItem?.id || 'all'}`}
              item={item}
              config={config}
              index={idx}
              isPrintMode={true}
            />
          ))
        )}
      </div>
      {/* GitHub Auto-Update Notifier Banner & Modal */}
      <GitHubUpdateNotifier
        isOpenModal={isGitHubUpdateModalOpen}
        onCloseModal={() => setIsGitHubUpdateModalOpen(false)}
        autoCheckOnMount={true}
      />
    </div>
  );
}
