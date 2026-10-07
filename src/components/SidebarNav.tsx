import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Smartphone,
  ShieldCheck,
  Zap,
  Sliders,
  HelpCircle,
  Download,
  Plus,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  PhoneCall,
  User,
  LogOut,
  LogIn,
  KeyRound,
  Sparkles,
  Layers,
  Printer,
  FileText,
  ExternalLink,
  Tag,
  Settings,
  History,
  AlertTriangle,
  Eye,
  Cloud,
  Table as TableIcon,
  Trash2,
  FileJson,
  Lock,
} from 'lucide-react';

export interface SidebarNavProps {
  mainMode: 'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot';
  onChangeMainMode: (mode: 'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot') => void;
  activeSubId?: string;
  onSelectSubItem?: (id: string, mode?: 'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot') => void;
  activeTab?: 'editor' | 'preview' | 'split' | 'custom_print' | 'holds';
  onChangeActiveTab?: (tab: 'editor' | 'preview' | 'split' | 'custom_print') => void;
  customPrintCount?: number;
  labelsCount?: number;
  totalWarningsCount?: number;
  shortageCount: number;
  deviceIotCount: number;
  isAdmin: boolean;
  currentUser?: {
    name: string;
    username?: string;
    role: 'admin' | 'staff' | string;
    status?: string;
  };
  onOpenAdminModal: () => void;
  onOpenUpdateModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenGuideModal: () => void;
  onOpenFastBackupRestore?: () => void;
  onLoadCatalogFromCloud: () => void;
  onSyncLabelsToCloud?: () => void;
  onUploadCatalogFileToCloud?: () => void;
  catalogCount: number;
  isSyncingCatalog?: boolean;
  onAddNewRow?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pendingRequestsCount?: number;
  hasUpdate?: boolean;
  onLogout?: () => void;
  onOpenLoginModal?: () => void;
  onOpenMobileAppModal?: () => void;
  hasNewShortageRegistration?: boolean;
  hasNewDeviceRegistration?: boolean;
  hasNewNotificationChange?: boolean;
  hasNewWarningsNotice?: boolean;
}

interface SubChildMenuItemDef {
  id: string;
  title: string;
  icon?: React.ElementType;
  iconColor?: string;
  badge?: number | string;
  badgeColor?: string;
  action?: () => void;
  mode?: 'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot';
}

interface ChildMenuItemDef {
  id: string;
  title: string;
  icon?: React.ElementType;
  iconColor?: string;
  badge?: number | string;
  badgeColor?: string;
  hasNotice?: boolean;
  action?: () => void;
  mode?: 'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot';
  isAdminOnly?: boolean;
  subItems?: SubChildMenuItemDef[];
}

interface MenuItemDef {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeColor?: string;
  hasNotice?: boolean;
  action?: () => void;
  mode?: 'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot';
  children?: ChildMenuItemDef[];
  isAdminOnly?: boolean;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  mainMode,
  onChangeMainMode,
  activeSubId,
  onSelectSubItem,
  activeTab,
  onChangeActiveTab,
  customPrintCount = 0,
  labelsCount = 0,
  totalWarningsCount = 0,
  shortageCount,
  deviceIotCount,
  isAdmin,
  currentUser,
  onOpenAdminModal,
  onOpenUpdateModal,
  onOpenSettingsModal,
  onOpenGuideModal,
  onOpenFastBackupRestore,
  onLoadCatalogFromCloud,
  onSyncLabelsToCloud,
  onUploadCatalogFileToCloud,
  catalogCount,
  isSyncingCatalog,
  onAddNewRow,
  isCollapsed,
  onToggleCollapse,
  pendingRequestsCount = 0,
  hasUpdate = false,
  onLogout,
  onOpenLoginModal,
  onOpenMobileAppModal,
  hasNewShortageRegistration = false,
  hasNewDeviceRegistration = false,
  hasNewNotificationChange = false,
  hasNewWarningsNotice = false,
}) => {
  // Flyout Popover state for collapsed sidebar hover preview
  const [flyoutGroup, setFlyoutGroup] = useState<{
    group: MenuItemDef;
    top: number;
  } | null>(null);
  const [userFlyout, setUserFlyout] = useState<{ top: number } | null>(null);
  const flyoutTimeoutRef = useRef<any>(null);
  const userFlyoutTimeoutRef = useRef<any>(null);

  const handleGroupMouseEnter = (group: MenuItemDef, e: React.MouseEvent) => {
    if (!isCollapsed) return;
    if (flyoutTimeoutRef.current) {
      clearTimeout(flyoutTimeoutRef.current);
      flyoutTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyoutGroup({
      group,
      top: rect.top,
    });
  };

  const handleGroupMouseLeave = () => {
    if (!isCollapsed) return;
    flyoutTimeoutRef.current = setTimeout(() => {
      setFlyoutGroup(null);
    }, 200);
  };

  const handleFlyoutMouseEnter = () => {
    if (flyoutTimeoutRef.current) {
      clearTimeout(flyoutTimeoutRef.current);
      flyoutTimeoutRef.current = null;
    }
  };

  const handleFlyoutMouseLeave = () => {
    flyoutTimeoutRef.current = setTimeout(() => {
      setFlyoutGroup(null);
    }, 200);
  };

  const handleUserMouseEnter = (e: React.MouseEvent) => {
    if (!isCollapsed) return;
    if (userFlyoutTimeoutRef.current) {
      clearTimeout(userFlyoutTimeoutRef.current);
      userFlyoutTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setUserFlyout({ top: rect.top });
  };

  const handleUserMouseLeave = () => {
    if (!isCollapsed) return;
    userFlyoutTimeoutRef.current = setTimeout(() => {
      setUserFlyout(null);
    }, 200);
  };

  const handleUserFlyoutMouseEnter = () => {
    if (userFlyoutTimeoutRef.current) {
      clearTimeout(userFlyoutTimeoutRef.current);
      userFlyoutTimeoutRef.current = null;
    }
  };

  const handleUserFlyoutMouseLeave = () => {
    userFlyoutTimeoutRef.current = setTimeout(() => {
      setUserFlyout(null);
    }, 200);
  };

  // Close flyouts on collapse change
  useEffect(() => {
    setFlyoutGroup(null);
    setUserFlyout(null);
  }, [isCollapsed]);

  // Accordion state for expanded parent items & sub-branches
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({
    'work-order': true,
    'spare-parts': true,
    'labels-main': true,
    'cloud-catalog-group': true,
    'part-shortage': true,
    'shortage-main': true,
    'device-iot': true,
    'system-admin': false,
  });

  // Resizable sidebar state with min/max bounds (240px - 500px, default 290px)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sidebar_custom_width');
      const parsed = saved ? parseInt(saved, 10) : 290;
      return !isNaN(parsed) && parsed >= 240 && parsed <= 500 ? parsed : 290;
    } catch {
      return 290;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  const handleStartResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(240, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setSidebarWidth((curr) => {
          try {
            localStorage.setItem('sidebar_custom_width', curr.toString());
          } catch {
            // ignore
          }
          return curr;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Define G-CSM Multi-level Menu Items
  const menuTree: MenuItemDef[] = [
    {
      id: 'overview',
      title: 'Tổng Quan',
      icon: LayoutDashboard,
      mode: 'overview',
      action: () => {
        onChangeMainMode('overview');
        if (onSelectSubItem) onSelectSubItem('overview-main', 'overview');
      },
    },
    {
      id: 'spare-parts',
      title: 'Quản lý linh kiện & In tem',
      icon: Tag,
      children: [
        {
          id: 'labels-main',
          title: 'In tem kho 3x2 (Labels)',
          icon: Printer,
          subItems: [
            {
              id: 'labels-editor',
              title: 'Bảng dữ liệu',
              icon: TableIcon,
              mode: 'labels',
              action: () => {
                onChangeMainMode('labels');
                if (onChangeActiveTab) onChangeActiveTab('editor');
                if (onSelectSubItem) onSelectSubItem('labels-editor', 'labels');
              },
            },
            {
              id: 'labels-split',
              title: 'Chia đôi màn hình',
              icon: Layers,
              mode: 'labels',
              action: () => {
                onChangeMainMode('labels');
                if (onChangeActiveTab) onChangeActiveTab('split');
                if (onSelectSubItem) onSelectSubItem('labels-split', 'labels');
              },
            },
            {
              id: 'labels-custom-print',
              title: 'Bảng dữ liệu cần in',
              icon: FileSpreadsheet,
              mode: 'labels',
              badge: customPrintCount > 0 ? customPrintCount : undefined,
              badgeColor: 'bg-emerald-600 text-white font-bold',
              action: () => {
                onChangeMainMode('labels');
                if (onChangeActiveTab) onChangeActiveTab('custom_print');
                if (onSelectSubItem) onSelectSubItem('labels-custom-print', 'labels');
              },
            },
            {
              id: 'labels-preview',
              title: 'Xem trước tem in',
              icon: Eye,
              mode: 'labels',
              badge: (labelsCount || catalogCount) > 0 ? (labelsCount || catalogCount) : undefined,
              badgeColor: 'bg-emerald-600 text-white font-bold',
              action: () => {
                onChangeMainMode('labels');
                if (onChangeActiveTab) onChangeActiveTab('preview');
                if (onSelectSubItem) onSelectSubItem('labels-preview', 'labels');
              },
            },
          ],
        },
      ],
    },
    {
      id: 'part-shortage',
      title: 'Đặt chờ linh kiện',
      icon: ClipboardList,
      badge: hasNewShortageRegistration ? 'MỚI' : hasNewWarningsNotice ? 'CẢNH BÁO' : shortageCount > 0 ? shortageCount : undefined,
      badgeColor: hasNewShortageRegistration
        ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 text-stone-950 font-black animate-pulse shadow-md border border-amber-300'
        : hasNewWarningsNotice
        ? 'bg-rose-500 text-white font-black animate-pulse shadow-md'
        : 'bg-emerald-600 text-white',
      hasNotice: Boolean(hasNewShortageRegistration || hasNewWarningsNotice),
      children: [
        {
          id: 'shortage-main',
          title: 'Phiếu đặt chờ linh kiện',
          icon: FileText,
          iconColor: hasNewShortageRegistration ? 'text-amber-300 animate-bounce' : 'text-emerald-400',
          mode: 'shortage',
          badge: hasNewShortageRegistration ? 'MỚI' : shortageCount > 0 ? shortageCount : undefined,
          badgeColor: hasNewShortageRegistration
            ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-stone-950 font-black animate-pulse'
            : 'bg-emerald-600 text-white font-bold',
          hasNotice: hasNewShortageRegistration,
          action: () => {
            onChangeMainMode('shortage');
            if (onSelectSubItem) onSelectSubItem('shortage-main', 'shortage');
          },
        },
        {
          id: 'shortage-warnings',
          title: 'Cảnh báo & Nhắc nhở',
          icon: AlertTriangle,
          iconColor: hasNewWarningsNotice ? 'text-rose-400 animate-pulse' : 'text-amber-400',
          mode: 'shortage',
          badge: totalWarningsCount && totalWarningsCount > 0 ? totalWarningsCount : undefined,
          badgeColor: hasNewWarningsNotice
            ? 'bg-rose-500 text-white font-bold animate-pulse'
            : 'bg-stone-700/80 text-amber-300 font-bold',
          hasNotice: Boolean(hasNewWarningsNotice),
          action: () => {
            onChangeMainMode('shortage');
            if (onSelectSubItem) onSelectSubItem('shortage-warnings', 'shortage');
          },
        },
        {
          id: 'shortage-check-dup',
          title: 'Tra cứu & Check trùng',
          icon: Layers,
          iconColor: 'text-fuchsia-400',
          mode: 'shortage',
          action: () => {
            onChangeMainMode('shortage');
            if (onSelectSubItem) onSelectSubItem('shortage-check-dup', 'shortage');
          },
        },
        {
          id: 'shortage-holds',
          title: 'Gọi đặt / SVD',
          icon: PhoneCall,
          iconColor: 'text-purple-400',
          mode: 'shortage',
          action: () => {
            onChangeMainMode('shortage');
            if (onSelectSubItem) onSelectSubItem('shortage-holds', 'shortage');
          },
        },
      ],
    },
    {
      id: 'device-iot',
      title: 'Đặt chờ máy & IOT',
      icon: Smartphone,
      badge: hasNewDeviceRegistration ? 'MỚI' : deviceIotCount > 0 ? deviceIotCount : undefined,
      badgeColor: hasNewDeviceRegistration
        ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 text-stone-950 font-black animate-pulse shadow-md border border-amber-300'
        : 'bg-emerald-600 text-white',
      hasNotice: hasNewDeviceRegistration,
      children: [
        {
          id: 'device-main',
          title: 'Phiếu đặt chờ máy & IOT',
          icon: Smartphone,
          iconColor: hasNewDeviceRegistration ? 'text-amber-300 animate-bounce' : 'text-emerald-400',
          mode: 'device_iot',
          badge: hasNewDeviceRegistration ? 'MỚI' : deviceIotCount > 0 ? deviceIotCount : undefined,
          badgeColor: hasNewDeviceRegistration
            ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-stone-950 font-black animate-pulse'
            : 'bg-emerald-600 text-white font-bold',
          hasNotice: hasNewDeviceRegistration,
          action: () => {
            onChangeMainMode('device_iot');
            if (onSelectSubItem) onSelectSubItem('device-main', 'device_iot');
          },
        },
      ],
    },
    {
      id: 'ai-assistant',
      title: 'Trợ lý AI Gemini',
      icon: Sparkles,
      badge: 'AI',
      badgeColor: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black shadow-xs',
      mode: 'ai_chatbot',
      action: () => {
        onChangeMainMode('ai_chatbot');
        if (onSelectSubItem) onSelectSubItem('ai-assistant-main', 'ai_chatbot');
      },
    },
    {
      id: 'system-admin',
      title: 'Quản trị & Cấu hình',
      icon: Settings,
      hasNotice: Boolean((isAdmin && pendingRequestsCount > 0) || hasUpdate),
      badge: (isAdmin && pendingRequestsCount > 0) ? `${pendingRequestsCount} chờ` : hasUpdate ? 'MỚI' : undefined,
      badgeColor: 'bg-gradient-to-r from-amber-500 to-rose-500 text-stone-950 font-black animate-pulse shadow-xs',
      children: [
        {
          id: 'admin-cloud',
          title: 'Quản trị Cloud & Phê duyệt',
          icon: ShieldCheck,
          badge: (isAdmin && pendingRequestsCount > 0) ? `${pendingRequestsCount} chờ` : undefined,
          badgeColor: 'bg-amber-500 text-stone-950 font-black animate-pulse',
          hasNotice: isAdmin && pendingRequestsCount > 0,
          isAdminOnly: true,
          action: onOpenAdminModal,
        },
        {
          id: 'admin-login',
          title: 'Đăng nhập / Đổi tài khoản',
          icon: LogIn,
          action: onOpenLoginModal,
        },
        {
          id: 'admin-logout',
          title: 'Đăng xuất tài khoản',
          icon: LogOut,
          badge: currentUser ? 'Thoát' : undefined,
          badgeColor: 'bg-rose-950 text-rose-300 border border-rose-800',
          action: onLogout,
        },
        {
          id: 'app-update',
          title: 'Cập nhật App Windows (OTA)',
          icon: Zap,
          badge: hasUpdate ? 'MỚI' : undefined,
          badgeColor: 'bg-amber-500 text-stone-950 font-bold',
          action: onOpenUpdateModal,
        },
        {
          id: 'app-mobile',
          title: 'App Android & Đồng bộ ĐT',
          icon: Smartphone,
          badge: 'APK',
          badgeColor: 'bg-emerald-500 text-stone-950 font-black',
          action: onOpenMobileAppModal,
        },
        {
          id: 'app-settings',
          title: 'Cấu hình mẫu tem & Máy in',
          icon: Sliders,
          action: onOpenSettingsModal,
        },
        {
          id: 'app-guide',
          title: 'Hướng dẫn in chuẩn lề',
          icon: HelpCircle,
          action: onOpenGuideModal,
        },
      ],
    },
  ];

  return (
    <aside
      style={{
        width: isCollapsed ? 68 : sidebarWidth,
        minWidth: isCollapsed ? 68 : 240,
        maxWidth: isCollapsed ? 68 : 500,
        transition: isResizing ? 'none' : 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      className={`no-print select-none bg-[#1c202b] text-stone-300 flex flex-col shrink-0 border-r border-[#2a2f3d] z-40 relative ${
        isResizing ? 'select-none' : ''
      }`}
    >
      {/* Top Brand & Status Header */}
      <div className="h-[58px] px-3.5 flex items-center justify-between border-b border-[#2a2f3d] bg-[#161922] shrink-0 gap-2">
        <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-white text-[11px] tracking-tight shadow-sm shrink-0 border border-emerald-400/30">
            HCM
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 flex-nowrap">
                <span
                  className="font-extrabold text-[13.5px] text-white tracking-wide font-sans whitespace-nowrap"
                  title="HCM4-Phú Lâm"
                >
                  HCM4-Phú Lâm
                </span>
                <span className="px-1.5 py-0.2 text-[9.5px] font-bold bg-rose-600 text-white rounded tracking-normal shrink-0 shadow-xs whitespace-nowrap">
                  by@philip
                </span>
              </div>
              <span
                className="text-[10px] text-stone-400 truncate whitespace-nowrap font-medium"
                title="OPPO Experience & Service Store Phú Lâm"
              >
                OPPO Experience & Service Store Phú Lâm
              </span>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 text-stone-400 hover:text-white hover:bg-[#2a2f3d] rounded-md transition-colors cursor-pointer shrink-0"
          title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {isCollapsed ? (
            <PanelLeft className="w-4 h-4 text-emerald-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-stone-400" />
          )}
        </button>
      </div>

      {/* Navigation Tree Content */}
      <div className="flex-1 overflow-y-auto py-2 px-2 custom-scrollbar space-y-1">
        {menuTree.map((group) => {
          if (group.isAdminOnly && !isAdmin) return null;

          const isGroupActive =
            (group.mode && group.mode === mainMode) ||
            Boolean(
              group.children?.some(
                (child) =>
                  child.mode === mainMode ||
                  child.id === activeSubId ||
                  child.subItems?.some((s) => s.mode === mainMode || s.id === activeSubId)
              )
            );
          const isExpanded = expandedKeys[group.id];

          // Top level item without children
          if (!group.children || group.children.length === 0) {
            return (
              <div
                key={group.id}
                onMouseEnter={(e) => handleGroupMouseEnter(group, e)}
                onMouseLeave={handleGroupMouseLeave}
                className="relative"
              >
                <button
                  type="button"
                  onClick={group.action}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer group/item ${
                    isGroupActive
                      ? 'bg-[#059669] text-white font-extrabold shadow-md'
                      : group.hasNotice
                      ? 'bg-gradient-to-r from-amber-500/25 via-rose-500/15 to-amber-500/25 text-amber-200 border border-amber-500/60 shadow-lg shadow-amber-500/20 animate-pulse'
                      : 'text-stone-200 hover:bg-[#283145] hover:text-white hover:translate-x-1'
                  }`}
                  title={isCollapsed ? undefined : group.title}
                >
                  <div className="relative flex items-center">
                    <group.icon
                      className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                        isGroupActive
                          ? 'text-white scale-110'
                          : group.hasNotice
                          ? 'text-amber-300 animate-bounce drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                          : 'text-stone-400 group-hover/item:text-emerald-400 group-hover/item:scale-110'
                      }`}
                    />
                    {group.hasNotice && isCollapsed && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-20">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-[#1a1f2c]"></span>
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">{group.title}</span>
                  )}
                  {!isCollapsed && group.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                        group.badgeColor || 'bg-stone-700 text-stone-200'
                      }`}
                    >
                      {group.badge}
                    </span>
                  )}
                </button>
              </div>
            );
          }

          // Parent item with children (Accordion)
          return (
            <div
              key={group.id}
              onMouseEnter={(e) => handleGroupMouseEnter(group, e)}
              onMouseLeave={handleGroupMouseLeave}
              className="space-y-0.5 relative"
            >
              <button
                type="button"
                onClick={() => {
                  if (isCollapsed) {
                    onToggleCollapse();
                  }
                  toggleExpand(group.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer group/parent ${
                  isGroupActive
                    ? 'text-emerald-400 font-extrabold bg-[#222838]/80'
                    : group.hasNotice
                    ? 'bg-gradient-to-r from-amber-500/25 via-rose-500/15 to-amber-500/25 text-amber-200 border border-amber-500/60 shadow-lg shadow-amber-500/20 animate-pulse font-bold'
                    : 'text-stone-200 hover:bg-[#283145] hover:text-emerald-300 hover:font-bold hover:translate-x-1'
                }`}
                title={isCollapsed ? undefined : group.title}
              >
                <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                  <div className="relative flex items-center">
                    <group.icon
                      className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                        isGroupActive
                          ? 'text-emerald-400 scale-110'
                          : group.hasNotice
                          ? 'text-amber-300 animate-bounce drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                          : 'text-stone-400 group-hover/parent:text-emerald-400 group-hover/parent:scale-110'
                      }`}
                    />
                    {group.hasNotice && isCollapsed && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-20">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-[#1a1f2c]"></span>
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <span className="truncate text-left">{group.title}</span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {group.badge !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                          group.badgeColor || 'bg-stone-700 text-stone-200'
                        }`}
                      >
                        {group.badge}
                      </span>
                    )}
                    <span
                      className="p-1 -mr-1 rounded text-stone-400 group-hover/parent:text-emerald-300 transition-colors"
                      title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover/parent:text-emerald-400 shrink-0" />
                      )}
                    </span>
                  </div>
                )}
              </button>

              {/* Expanded Children Items */}
              {isExpanded && !isCollapsed && (
                <div className="pl-6 space-y-0.5 border-l border-stone-700/50 ml-4 py-0.5">
                  {group.children.map((child) => {
                    if (child.isAdminOnly && !isAdmin) return null;

                    const hasSubItems = Boolean(child.subItems && child.subItems.length > 0);
                    const isSubExpanded = Boolean(expandedKeys[child.id]);
                    const isAnySubActive =
                      hasSubItems &&
                      (child.subItems!.some((sub) => activeSubId === sub.id) ||
                        (mainMode === 'labels' &&
                          child.id === 'labels-main' &&
                          (activeSubId?.startsWith('labels-') || activeSubId === 'labels-main')));

                    const isChildActive = !hasSubItems
                      ? activeSubId
                        ? child.id === activeSubId
                        : child.mode === mainMode
                      : false;

                    if (hasSubItems) {
                      return (
                        <div key={child.id} className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              toggleExpand(child.id);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer group/child ${
                              isAnySubActive
                                ? 'text-emerald-300 bg-[#242c3f] font-bold border border-emerald-500/40 shadow-xs'
                                : 'text-stone-300 hover:bg-[#2e374d] hover:text-white hover:font-bold hover:translate-x-1'
                            }`}
                            title={child.title}
                          >
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                              {child.icon && (
                                <child.icon
                                  className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                                    isAnySubActive
                                      ? 'text-emerald-400 scale-110'
                                      : 'text-stone-400 group-hover/child:text-emerald-300 group-hover/child:scale-110'
                                  }`}
                                />
                              )}
                              <span className="truncate text-left">{child.title}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {child.badge !== undefined && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                                    child.badgeColor || 'bg-stone-800 text-stone-200'
                                  }`}
                                >
                                  {child.badge}
                                </span>
                              )}
                              <span
                                className="p-0.5 rounded text-stone-400 group-hover/child:text-emerald-300 transition-colors"
                                title={isSubExpanded ? 'Thu gọn' : 'Mở rộng'}
                              >
                                {isSubExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover/child:text-emerald-300 shrink-0" />
                                )}
                              </span>
                            </div>
                          </button>

                          {/* Secondary Sub-branches (Phân nhánh thứ cấp) */}
                          {isSubExpanded && (
                            <div className="pl-3.5 space-y-0.5 border-l-2 border-emerald-500/30 ml-3.5 my-1">
                              {child.subItems!.map((sub) => {
                                const isSubActive =
                                  activeSubId === sub.id ||
                                  (sub.id === 'labels-split' && activeTab === 'split' && mainMode === 'labels') ||
                                  (sub.id === 'labels-editor' && activeTab === 'editor' && mainMode === 'labels') ||
                                  (sub.id === 'labels-custom-print' && activeTab === 'custom_print' && mainMode === 'labels') ||
                                  (sub.id === 'labels-preview' && activeTab === 'preview' && mainMode === 'labels');

                                const SubIcon = sub.icon;

                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => {
                                      if (sub.mode) {
                                        onChangeMainMode(sub.mode);
                                      }
                                      if (onSelectSubItem) {
                                        onSelectSubItem(sub.id, sub.mode);
                                      }
                                      if (sub.action) {
                                        sub.action();
                                      }
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-200 cursor-pointer group/subitem ${
                                      isSubActive
                                        ? 'bg-[#059669] text-white font-bold shadow-xs'
                                        : 'text-stone-300 hover:bg-[#2e374d] hover:text-emerald-200 hover:font-bold hover:translate-x-1'
                                    }`}
                                    title={sub.title}
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      {SubIcon && (
                                        <SubIcon
                                          className={`w-3.5 h-3.5 shrink-0 transition-all duration-200 ${
                                            isSubActive
                                              ? 'text-white scale-110 drop-shadow-xs'
                                              : sub.iconColor
                                              ? `${sub.iconColor} group-hover/subitem:scale-110`
                                              : 'text-stone-400 group-hover/subitem:text-emerald-300 group-hover/subitem:scale-110'
                                          }`}
                                        />
                                      )}
                                      <span className="truncate text-left">{sub.title}</span>
                                    </div>

                                    {sub.badge !== undefined && (
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-bold ${
                                          sub.badgeColor ||
                                          (isSubActive ? 'bg-emerald-800 text-white' : 'bg-stone-800 text-stone-200')
                                        }`}
                                      >
                                        {sub.badge}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => {
                          if (child.mode) {
                            onChangeMainMode(child.mode);
                          }
                          if (onSelectSubItem) {
                            onSelectSubItem(child.id, child.mode);
                          }
                          if (child.action) {
                            child.action();
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer group/child ${
                          isChildActive
                            ? 'bg-[#059669] text-white font-bold shadow-xs'
                            : child.hasNotice
                            ? 'bg-amber-500/20 text-amber-200 font-bold border border-amber-500/50 shadow-xs animate-pulse'
                            : 'text-stone-300 hover:bg-[#2e374d] hover:text-emerald-200 hover:font-bold hover:translate-x-1'
                        }`}
                        title={child.title}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {child.icon && (
                            <child.icon
                              className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                                isChildActive
                                  ? 'text-white scale-110 drop-shadow-xs'
                                  : child.hasNotice
                                  ? 'text-amber-300 animate-bounce drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                                  : child.iconColor
                                  ? `${child.iconColor} group-hover/child:scale-110`
                                  : 'text-stone-400 group-hover/child:text-emerald-300 group-hover/child:scale-110'
                              }`}
                            />
                          )}
                          <span className="truncate text-left">{child.title}</span>
                        </div>

                        {child.badge !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                              child.badgeColor || 'bg-stone-800 text-stone-200'
                            }`}
                          >
                            {child.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User Info & Footer Status */}
      <div className="p-2.5 border-t border-[#2a2f3d] bg-[#161922] shrink-0">
        {!isCollapsed ? (
          currentUser ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="flex items-center gap-2 overflow-hidden text-left hover:bg-[#222838] p-1 rounded-lg transition-colors cursor-pointer flex-1 group"
                  title="Bấm để đổi tài khoản hoặc đăng nhập lại"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                      isAdmin ? 'bg-purple-600' : 'bg-emerald-600'
                    }`}
                  >
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] text-stone-400 truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                      {isAdmin ? 'Quản trị viên' : 'KTV Phú Lâm'}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenSettingsModal}
                    className="p-1.5 text-stone-400 hover:text-amber-400 hover:bg-[#282d3c] rounded cursor-pointer transition-colors"
                    title="Cấu hình hệ thống"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-rose-950/60 rounded cursor-pointer transition-colors"
                      title="Đăng xuất khỏi tài khoản"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Backup / Restore JSON button */}
              {isAdmin && onOpenFastBackupRestore && (
                <button
                  type="button"
                  onClick={onOpenFastBackupRestore}
                  className="w-full flex items-center justify-between py-1.5 px-2 bg-gradient-to-r from-indigo-950/40 to-purple-950/40 hover:from-indigo-900/60 hover:to-purple-900/60 text-indigo-200 hover:text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer border border-indigo-700/40 mt-1 mb-1"
                  title="Sao lưu hoặc khôi phục dữ liệu siêu tốc từ JSON khi chuyển tài khoản"
                >
                  <span className="flex items-center gap-1.5">
                    <FileJson className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Sao Lưu / Khôi Phục</span>
                  </span>
                  <span className="px-1.5 py-0.2 bg-indigo-500/30 text-indigo-300 rounded text-[9px] font-mono border border-indigo-400/30">
                    JSON
                  </span>
                </button>
              )}

              {/* Quick Action Buttons: Đăng nhập / Đổi tài khoản & Đăng xuất */}
              <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#252a38]">
                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#202534] hover:bg-[#293042] text-stone-200 hover:text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer border border-[#2e3649]"
                  title="Đăng nhập tài khoản khác / Quản trị viên"
                >
                  <LogIn className="w-3 h-3 text-emerald-400" />
                  <span>Đổi tài khoản</span>
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 hover:text-rose-100 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border border-rose-900/40"
                    title="Đăng xuất khỏi hệ thống"
                  >
                    <LogOut className="w-3 h-3 text-rose-400" />
                    <span>Đăng xuất</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-rose-950/50 border border-rose-800/40 flex items-center justify-center font-bold text-xs text-rose-300 shrink-0">
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-rose-300">Yêu cầu đăng nhập</span>
                  <span className="text-[10px] text-stone-400">Bắt buộc xác thực</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập hệ thống</span>
              </button>
              {onOpenFastBackupRestore && (
                <button
                  type="button"
                  onClick={onOpenFastBackupRestore}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#202534] hover:bg-[#293042] text-indigo-300 hover:text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer border border-[#2e3649]"
                  title="Khôi phục siêu tốc dữ liệu từ file JSON"
                >
                  <FileJson className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Khôi phục từ bản sao lưu JSON</span>
                </button>
              )}
            </div>
          )
        ) : (
          <div
            onMouseEnter={handleUserMouseEnter}
            onMouseLeave={handleUserMouseLeave}
            className="flex flex-col items-center gap-2 relative"
          >
            <button
              type="button"
              onClick={onOpenLoginModal}
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white cursor-pointer ${
                isAdmin ? 'bg-purple-600' : currentUser ? 'bg-emerald-600' : 'bg-stone-700'
              }`}
              title={currentUser ? `Đang đăng nhập: ${currentUser.name}. Bấm để đổi tài khoản` : 'Bấm để đăng nhập'}
            >
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
            </button>
            {currentUser && onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="p-1 text-stone-400 hover:text-rose-400 rounded cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="p-1 text-emerald-400 hover:text-emerald-300 rounded cursor-pointer"
                title="Đăng nhập"
              >
                <LogIn className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Draggable Resize Edge Handle (Desktop / Mouse) */}
      {!isCollapsed && (
        <div
          onMouseDown={handleStartResize}
          onDoubleClick={() => {
            setSidebarWidth(290);
            try {
              localStorage.setItem('sidebar_custom_width', '290');
            } catch {
              // ignore
            }
          }}
          className={`absolute top-0 right-0 w-2.5 h-full cursor-col-resize z-50 group select-none flex items-center justify-center -mr-1 transition-colors ${
            isResizing ? 'bg-emerald-500/30' : 'hover:bg-emerald-500/20'
          }`}
          title="Kéo chuột sang trái/phải để thu hẹp hoặc mở rộng thanh menu (Nhấp đúp để đặt lại chuẩn 290px)"
        >
          <div
            className={`w-[2px] rounded-full transition-all ${
              isResizing
                ? 'bg-emerald-400 h-24 shadow-sm'
                : 'bg-stone-600/50 group-hover:bg-emerald-400 group-hover:h-16 h-10'
            }`}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING FLYOUT POPOVER ON HOVER IN COLLAPSED MODE                        */}
      {/* ========================================================================= */}
      {isCollapsed && flyoutGroup && (
        <div
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
          style={{
            position: 'fixed',
            left: 74,
            top: Math.max(12, Math.min(window.innerHeight - 440, flyoutGroup.top - 6)),
            zIndex: 9999,
          }}
          className="w-72 bg-[#181d28]/95 backdrop-blur-md text-stone-200 border border-[#333e54] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-3 animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* Arrow notch pointer */}
          <div
            style={{
              position: 'absolute',
              left: -6,
              top: Math.max(14, Math.min(380, flyoutGroup.top - Math.max(12, Math.min(window.innerHeight - 440, flyoutGroup.top - 6)) + 12)),
            }}
            className="w-3 h-3 bg-[#181d28] border-l border-t border-[#333e54] rotate-[-45deg]"
          />

          {/* Flyout Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-[#2a3449]">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600/30 to-teal-800/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
                <flyoutGroup.group.icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-white text-xs truncate">
                  {flyoutGroup.group.title}
                </span>
                <span className="text-[10px] text-stone-400 font-medium truncate">
                  {flyoutGroup.group.children ? `${flyoutGroup.group.children.length} nhóm tác vụ` : 'Menu chính'}
                </span>
              </div>
            </div>

            {flyoutGroup.group.badge !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 ${
                  flyoutGroup.group.badgeColor || 'bg-emerald-600 text-white'
                }`}
              >
                {flyoutGroup.group.badge}
              </span>
            )}
          </div>

          {/* Flyout Body (Direct Action or Sub-items) */}
          {!flyoutGroup.group.children || flyoutGroup.group.children.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                flyoutGroup.group.action?.();
                setFlyoutGroup(null);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              <div className="flex items-center gap-2">
                <flyoutGroup.group.icon className="w-4 h-4" />
                <span>Mở trang {flyoutGroup.group.title}</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-0.5">
              {flyoutGroup.group.children.map((child) => {
                if (child.isAdminOnly && !isAdmin) return null;

                const hasSubItems = Boolean(child.subItems && child.subItems.length > 0);

                if (hasSubItems) {
                  return (
                    <div key={child.id} className="space-y-1 bg-[#131722]/60 p-1.5 rounded-xl border border-[#252f44]">
                      <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-emerald-400">
                        <div className="flex items-center gap-1.5">
                          {child.icon && <child.icon className="w-3.5 h-3.5 text-emerald-400" />}
                          <span>{child.title}</span>
                        </div>
                        {child.badge !== undefined && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-stone-800 text-stone-300">
                            {child.badge}
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        {child.subItems!.map((sub) => {
                          const isSubActive =
                            activeSubId === sub.id ||
                            (sub.id === 'labels-split' && activeTab === 'split' && mainMode === 'labels') ||
                            (sub.id === 'labels-editor' && activeTab === 'editor' && mainMode === 'labels') ||
                            (sub.id === 'labels-custom-print' && activeTab === 'custom_print' && mainMode === 'labels') ||
                            (sub.id === 'labels-preview' && activeTab === 'preview' && mainMode === 'labels');

                          const SubIcon = sub.icon;

                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                if (sub.mode) onChangeMainMode(sub.mode);
                                if (onSelectSubItem) onSelectSubItem(sub.id, sub.mode);
                                if (sub.action) sub.action();
                                setFlyoutGroup(null);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                                isSubActive
                                  ? 'bg-[#059669] text-white font-bold shadow-xs'
                                  : 'text-stone-300 hover:bg-[#252f44] hover:text-white hover:font-bold'
                              }`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                {SubIcon && (
                                  <SubIcon
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      isSubActive
                                        ? 'text-white'
                                        : sub.iconColor || 'text-stone-400'
                                    }`}
                                  />
                                )}
                                <span className="truncate text-left">{sub.title}</span>
                              </div>

                              {sub.badge !== undefined && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                    sub.badgeColor || (isSubActive ? 'bg-emerald-800 text-white' : 'bg-stone-800 text-stone-200')
                                  }`}
                                >
                                  {sub.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const isChildActive = activeSubId ? child.id === activeSubId : child.mode === mainMode;

                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => {
                      if (child.mode) onChangeMainMode(child.mode);
                      if (onSelectSubItem) onSelectSubItem(child.id, child.mode);
                      if (child.action) child.action();
                      setFlyoutGroup(null);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                      isChildActive
                        ? 'bg-[#059669] text-white font-bold shadow-xs'
                        : 'text-stone-200 bg-[#141824]/50 hover:bg-[#252f44] hover:text-white hover:font-bold border border-transparent hover:border-[#333e54]'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {child.icon && (
                        <child.icon
                          className={`w-4 h-4 shrink-0 ${
                            isChildActive
                              ? 'text-white'
                              : child.iconColor || 'text-stone-400'
                          }`}
                        />
                      )}
                      <span className="truncate text-left font-medium">{child.title}</span>
                    </div>

                    {child.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          child.badgeColor || 'bg-stone-800 text-stone-200'
                        }`}
                      >
                        {child.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* USER PROFILE FLYOUT POPOVER ON HOVER IN COLLAPSED MODE */}
      {isCollapsed && userFlyout && (
        <div
          onMouseEnter={handleUserFlyoutMouseEnter}
          onMouseLeave={handleUserFlyoutMouseLeave}
          style={{
            position: 'fixed',
            left: 74,
            top: Math.max(12, userFlyout.top - 160),
            zIndex: 9999,
          }}
          className="w-68 bg-[#181d28]/95 backdrop-blur-md text-stone-200 border border-[#333e54] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-3 animate-in fade-in zoom-in-95 duration-150 select-none space-y-2.5"
        >
          {/* Arrow notch pointer */}
          <div
            style={{
              position: 'absolute',
              left: -6,
              bottom: 24,
            }}
            className="w-3 h-3 bg-[#181d28] border-l border-t border-[#333e54] rotate-[-45deg]"
          />

          {currentUser ? (
            <>
              <div className="flex items-center gap-2.5 pb-2 border-b border-[#2a3449]">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-md ${
                    isAdmin ? 'bg-purple-600' : 'bg-emerald-600'
                  }`}
                >
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-white truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {isAdmin ? 'Quản trị viên hệ thống' : 'KTV Phú Lâm'}
                  </span>
                </div>
              </div>

              {isAdmin && onOpenFastBackupRestore && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenFastBackupRestore();
                    setUserFlyout(null);
                  }}
                  className="w-full flex items-center justify-between py-1.5 px-2.5 bg-gradient-to-r from-indigo-950/40 to-purple-950/40 hover:from-indigo-900/60 hover:to-purple-900/60 text-indigo-200 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border border-indigo-700/40"
                >
                  <span className="flex items-center gap-1.5">
                    <FileJson className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Sao Lưu / Khôi Phục</span>
                  </span>
                  <span className="px-1.5 py-0.2 bg-indigo-500/30 text-indigo-300 rounded text-[9px] font-mono">
                    JSON
                  </span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#252a38]">
                <button
                  type="button"
                  onClick={() => {
                    onOpenLoginModal?.();
                    setUserFlyout(null);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-[#202534] hover:bg-[#293042] text-stone-200 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-[#2e3649]"
                >
                  <LogIn className="w-3 h-3 text-emerald-400" />
                  <span>Đổi tài khoản</span>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setUserFlyout(null);
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-rose-900/40"
                  >
                    <LogOut className="w-3 h-3 text-rose-400" />
                    <span>Đăng xuất</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2 text-center py-1">
              <span className="text-xs font-bold text-stone-300 block">Chưa đăng nhập hệ thống</span>
              <button
                type="button"
                onClick={() => {
                  onOpenLoginModal?.();
                  setUserFlyout(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập ngay</span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
