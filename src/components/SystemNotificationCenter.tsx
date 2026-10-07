import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Smartphone,
  Layers,
  PhoneCall,
  Info,
  Trash2,
  Eye,
  ShieldAlert,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { ShortageBookingItem } from '../types/shortage';
import { DeviceIotBookingItem } from '../types/deviceIot';
import { TechnicianItem } from '../types/technician';
import { UserSessionData, approveUserSession } from '../services/firebaseShortageService';
import { adminApproveTechnician, adminRejectTechnician } from '../services/technicianService';
import {
  checkOverdue7Days,
  checkSvdPending3Days,
  checkStep1AgingWarning,
  checkStep2AgingWarning,
  checkStep3AgingWarning,
} from '../utils/shortageHelper';
import {
  getUserStorageKey,
  getUserReadNotificationIds,
  saveUserReadNotificationIds,
  generateSystemNotifications,
} from '../utils/userNotificationManager';

export interface SystemNotificationItem {
  id: string;
  type: 'admin_user' | 'admin_tech' | 'admin_cancel_shortage' | 'admin_cancel_device' | 'admin_edit_shortage' | 'shortage_warning' | 'shortage_stocked' | 'device_warning' | 'system_ota' | 'system_info';
  category: 'admin' | 'warning' | 'system';
  title: string;
  description: string;
  timestamp: string;
  timestampMillis: number;
  priority: 'urgent' | 'warning' | 'info';
  isRead: boolean;
  metadata?: {
    uid?: string;
    username?: string;
    techId?: string;
    ticketId?: string;
    ticketNumber?: string;
    customerName?: string;
    customerPhone?: string;
    model?: string;
    partName?: string;
    reason?: string;
    requesterName?: string;
    actionUrl?: string;
    targetTab?: string;
    targetMode?: 'labels' | 'shortage' | 'device_iot';
    targetFilter?: string;
    targetSearch?: string;
    warningBranch?: 'all' | 'overdue_7' | 'step1' | 'step2' | 'step3' | 'svd' | 'cancel' | 'edit';
  };
}

export interface NotificationTargetDetails {
  ticketNumber?: string;
  ticketId?: string;
  statusFilter?: string;
  warningBranch?: 'all' | 'overdue_7' | 'step1' | 'step2' | 'step3' | 'svd' | 'cancel' | 'edit';
  targetSearch?: string;
}

interface SystemNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status?: 'pending' | 'approved' | 'rejected';
  } | null;
  usersList: UserSessionData[];
  techniciansList: TechnicianItem[];
  shortageBookings: ShortageBookingItem[];
  deviceIotBookings: DeviceIotBookingItem[];
  hasNewCodeUpdate: boolean;
  serverVersion: string;
  clientVersion: string;
  userReadNotificationIds?: Set<string>;
  onUpdateReadIds?: (newIds: Set<string>) => void;
  onOpenAdminModal?: () => void;
  onOpenAdminTab?: (tabName: 'approval' | 'cancels' | 'technicians' | 'catalog' | 'logs' | 'profile' | 'links' | 'quota') => void;
  onNavigateToMode?: (
    mode: 'labels' | 'shortage' | 'device_iot',
    subTab?: string,
    details?: NotificationTargetDetails
  ) => void;
  onOpenUpdateModal?: () => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
  onRefreshData?: () => void;
}

export const SystemNotificationCenter: React.FC<SystemNotificationCenterProps> = ({
  isOpen,
  onClose,
  currentUser,
  usersList,
  techniciansList,
  shortageBookings,
  deviceIotBookings,
  hasNewCodeUpdate,
  serverVersion,
  clientVersion,
  userReadNotificationIds,
  onUpdateReadIds,
  onOpenAdminModal,
  onOpenAdminTab,
  onNavigateToMode,
  onOpenUpdateModal,
  onShowToast,
  onRefreshData,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'admin' | 'warning' | 'system'>('all');
  const userKey = useMemo(() => getUserStorageKey(currentUser), [currentUser]);

  const [localReadIds, setLocalReadIds] = useState<Set<string>>(() => {
    return getUserReadNotificationIds(getUserStorageKey(currentUser));
  });

  // Effective read IDs: prefer parent prop if passed, otherwise local
  const effectiveReadIds = userReadNotificationIds || localReadIds;

  useEffect(() => {
    setLocalReadIds(getUserReadNotificationIds(userKey));
  }, [userKey]);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync readIds to user-specific localStorage and parent
  const saveReadIds = (newSet: Set<string>) => {
    setLocalReadIds(newSet);
    saveUserReadNotificationIds(userKey, newSet);
    if (onUpdateReadIds) {
      onUpdateReadIds(newSet);
    }
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Generate dynamic, live notification items based on actual system state
  const notifications = useMemo<SystemNotificationItem[]>(() => {
    return generateSystemNotifications(
      usersList,
      techniciansList,
      shortageBookings,
      deviceIotBookings,
      hasNewCodeUpdate,
      serverVersion,
      clientVersion,
      effectiveReadIds,
      currentUser?.role || 'staff'
    );
  }, [
    usersList,
    techniciansList,
    shortageBookings,
    deviceIotBookings,
    hasNewCodeUpdate,
    serverVersion,
    clientVersion,
    effectiveReadIds,
    currentUser?.role,
  ]);

  // Filtered notifications by tab
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    return notifications.filter((n) => n.category === activeCategory);
  }, [notifications, activeCategory]);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Mark all as read handler
  const handleMarkAllAsRead = () => {
    const allIds = new Set(effectiveReadIds);
    notifications.forEach((n) => allIds.add(n.id));
    saveReadIds(allIds);
    onShowToast('Đã đánh dấu tất cả thông báo là đã đọc!', 'success');
  };

  // Mark single as read
  const handleMarkSingleAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const allIds = new Set(effectiveReadIds);
    allIds.add(id);
    saveReadIds(allIds);
  };

  // Admin Quick Action: Approve User
  const handleQuickApproveUser = async (uid: string, username?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(`user-${uid}`);
    try {
      await approveUserSession(uid, { status: 'approved', username }, currentUser?.name || 'Admin');
      onShowToast(`Đã duyệt thành công tài khoản @${username || uid}!`, 'success');
      handleMarkSingleAsRead(`user-pending-${uid}`);
    } catch (err: any) {
      onShowToast(`Lỗi duyệt tài khoản: ${err?.message || 'Thất bại'}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Admin Quick Action: Reject User
  const handleQuickRejectUser = async (uid: string, username?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(`user-${uid}`);
    try {
      await approveUserSession(uid, { status: 'rejected', username }, currentUser?.name || 'Admin');
      onShowToast(`Đã từ chối tài khoản @${username || uid}!`, 'info');
      handleMarkSingleAsRead(`user-pending-${uid}`);
    } catch (err: any) {
      onShowToast(`Lỗi từ chối tài khoản: ${err?.message || 'Thất bại'}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Admin Quick Action: Approve Tech
  const handleQuickApproveTech = async (techDocId: string, techName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(`tech-${techDocId}`);
    try {
      await adminApproveTechnician(techDocId, currentUser?.name || 'Admin');
      onShowToast(`Đã duyệt thành công Kỹ thuật viên ${techName}!`, 'success');
      handleMarkSingleAsRead(`tech-pending-${techDocId}`);
    } catch (err: any) {
      onShowToast(`Lỗi duyệt KTV: ${err?.message || 'Thất bại'}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle notification item click
  const handleNotificationClick = (item: SystemNotificationItem) => {
    handleMarkSingleAsRead(item.id);

    if (item.type === 'system_ota') {
      if (onOpenUpdateModal) onOpenUpdateModal();
      onClose();
      return;
    }

    const details: NotificationTargetDetails = {
      ticketNumber: item.metadata?.ticketNumber,
      ticketId: item.metadata?.ticketId,
      statusFilter: item.metadata?.targetFilter,
      warningBranch: item.metadata?.warningBranch,
      targetSearch: item.metadata?.targetSearch || item.metadata?.ticketNumber,
    };

    // If it's an admin-specific approval without target mode (like user or tech approval)
    if (item.category === 'admin' && !item.metadata?.targetMode) {
      if (currentUser?.role !== 'admin') {
        onShowToast('Chỉ Quản trị viên (Admin) mới có quyền xử lý yêu cầu này!', 'info');
        return;
      }
      if (onOpenAdminModal) onOpenAdminModal();
      if (item.metadata?.targetTab && onOpenAdminTab) {
        onOpenAdminTab(item.metadata.targetTab as any);
      }
      onClose();
      return;
    }

    // Direct navigation to exact category or ticket
    if (item.metadata?.targetMode) {
      if (onNavigateToMode) {
        onNavigateToMode(item.metadata.targetMode, item.metadata.targetTab, details);
      }
      onClose();
      return;
    }

    // Fallback for admin tab
    if (item.category === 'admin') {
      if (onOpenAdminModal) onOpenAdminModal();
      if (item.metadata?.targetTab && onOpenAdminTab) {
        onOpenAdminTab(item.metadata.targetTab as any);
      }
      onClose();
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      id="system-notification-center"
      className="absolute top-12 right-0 sm:right-2 w-[92vw] sm:w-[480px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-stone-200/90 z-[9999] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 text-stone-800 font-sans"
      style={{
        transformOrigin: 'top right',
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 px-4 py-3.5 text-white flex items-center justify-between border-b border-stone-700/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm tracking-tight text-white">Trung Tâm Thông Báo</h3>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-400 font-medium">
              Cảnh báo tiến độ & Yêu cầu Quản trị hệ thống
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onRefreshData && (
            <button
              type="button"
              onClick={onRefreshData}
              className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              title="Làm mới thông báo từ Cloud"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1 px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer border border-stone-700/50"
              title="Đánh dấu tất cả là đã đọc"
            >
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Đọc hết</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer ml-1"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Categories Tabs Filter */}
      <div className="bg-stone-50 px-3 py-2 border-b border-stone-200 flex items-center justify-between gap-1 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeCategory === 'all'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
          }`}
        >
          <span>Tất cả</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
            activeCategory === 'all' ? 'bg-stone-700 text-amber-300' : 'bg-stone-200 text-stone-700'
          }`}>
            {notifications.length}
          </span>
        </button>

        {currentUser?.role === 'admin' && (
          <button
            type="button"
            onClick={() => setActiveCategory('admin')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'admin'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Yêu cầu QTV</span>
            {notifications.filter((n) => n.category === 'admin').length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeCategory === 'admin' ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800'
              }`}>
                {notifications.filter((n) => n.category === 'admin').length}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveCategory('warning')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeCategory === 'warning'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-stone-600 hover:bg-amber-50 hover:text-amber-700'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Cảnh báo</span>
          {notifications.filter((n) => n.category === 'warning').length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeCategory === 'warning' ? 'bg-amber-800 text-amber-100' : 'bg-amber-100 text-amber-800'
            }`}>
              {notifications.filter((n) => n.category === 'warning').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('system')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeCategory === 'system'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-stone-600 hover:bg-blue-50 hover:text-blue-700'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Hệ thống</span>
        </button>
      </div>

      {/* Notifications List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-stone-100 max-h-[55vh] min-h-[220px] bg-stone-50/40">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-stone-500">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="font-bold text-stone-800 text-sm">Không có thông báo mới!</p>
            <p className="text-xs text-stone-500 mt-1 max-w-xs">
              Mọi yêu cầu phê duyệt và tiến độ linh kiện đang được xử lý hoàn hảo.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isUserItem = item.type === 'admin_user';
            const isTechItem = item.type === 'admin_tech';
            const isCancelItem = item.type === 'admin_cancel_shortage' || item.type === 'admin_cancel_device';
            const isUrgent = item.priority === 'urgent';

            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-3.5 transition-all cursor-pointer relative group flex gap-3 items-start ${
                  !item.isRead
                    ? isUrgent
                      ? 'bg-rose-50/60 hover:bg-rose-50/90 border-l-4 border-l-rose-600'
                      : 'bg-amber-50/50 hover:bg-amber-50/80 border-l-4 border-l-amber-500'
                    : 'bg-white hover:bg-stone-50/80 opacity-90 hover:opacity-100'
                }`}
              >
                {/* Icon Badge */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                    item.category === 'admin'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : item.category === 'warning'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  {item.category === 'admin' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : item.category === 'warning' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : item.type === 'system_ota' ? (
                    <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                  ) : (
                    <Info className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <h4
                      className={`text-xs font-bold leading-snug line-clamp-1 ${
                        !item.isRead ? 'text-stone-900 font-black' : 'text-stone-700'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-stone-600 font-mono shrink-0 whitespace-nowrap bg-stone-200/60 px-1.5 py-0.5 rounded">
                      {item.timestamp}
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-2 mb-2 font-normal">
                    {item.description}
                  </p>

                  {/* Inline Action Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-200/50">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Admin Quick Action for Pending User */}
                      {isUserItem && currentUser?.role === 'admin' && item.metadata?.uid && (
                        <>
                          <button
                            type="button"
                            disabled={processingId === `user-${item.metadata.uid}`}
                            onClick={(e) =>
                              handleQuickApproveUser(item.metadata!.uid!, item.metadata!.username, e)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-black transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Duyệt User</span>
                          </button>
                          <button
                            type="button"
                            disabled={processingId === `user-${item.metadata.uid}`}
                            onClick={(e) =>
                              handleQuickRejectUser(item.metadata!.uid!, item.metadata!.username, e)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <UserX className="w-3 h-3" />
                            <span>Từ chối</span>
                          </button>
                        </>
                      )}

                      {/* Admin Quick Action for Pending Technician */}
                      {isTechItem && currentUser?.role === 'admin' && item.metadata?.uid && (
                        <button
                          type="button"
                          disabled={processingId === `tech-${item.metadata.uid}`}
                          onClick={(e) =>
                            handleQuickApproveTech(
                              item.metadata!.uid!,
                              item.metadata!.requesterName || 'KTV',
                              e
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[11px] font-black transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          <span>Duyệt KTV</span>
                        </button>
                      )}

                      {/* Admin Quick Action for Cancellations */}
                      {isCancelItem && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {currentUser?.role === 'admin' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenAdminModal) onOpenAdminModal();
                                if (onOpenAdminTab) onOpenAdminTab('cancels');
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              <span>Tab Duyệt Hủy</span>
                            </button>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded transition-colors">
                            <span>Xem chi tiết phiếu</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      )}

                      {/* Action for OTA Update */}
                      {item.type === 'system_ota' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenUpdateModal) onOpenUpdateModal();
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-md text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Nạp Bản Cập Nhật Ngay</span>
                        </button>
                      )}

                      {/* Generic navigate button if target exists */}
                      {!isUserItem && !isTechItem && !isCancelItem && item.type !== 'system_ota' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 border border-amber-300/50 rounded-md text-[11px] font-bold transition-all shadow-2xs group-hover:border-amber-500">
                          <span>Xem chi tiết</span>
                          <ChevronRight className="w-3 h-3 text-amber-700" />
                        </span>
                      )}
                    </div>

                    {/* Mark as read tick */}
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkSingleAsRead(item.id, e)}
                        className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded transition-colors cursor-pointer"
                        title="Đánh dấu đã đọc"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info & Admin Links */}
      <div className="bg-stone-100 px-4 py-2.5 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-medium text-[11px]">Real-time Cloud Active</span>
        </div>

        {currentUser?.role === 'admin' ? (
          <button
            type="button"
            onClick={() => {
              if (onOpenAdminModal) onOpenAdminModal();
              onClose();
            }}
            className="flex items-center gap-1 text-purple-700 hover:text-purple-900 font-bold hover:underline cursor-pointer text-[11px]"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Mở Quản Trị Hệ Thống</span>
          </button>
        ) : (
          <span className="text-[11px] text-stone-500 font-mono">
            HCM4 • v{clientVersion}
          </span>
        )}
      </div>
    </div>
  );
};
