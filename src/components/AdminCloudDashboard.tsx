import React, { useState, useEffect, useMemo, useRef } from 'react';
import { readExcelFile } from '../utils/excelHelper';
import {
  UserSessionData,
  ActivityLogData,
  subscribeToUsers,
  subscribeToActivityLogs,
  updateUserSession,
  approveUserSession,
  deleteUserSession,
  updateMasterAdminPin,
  batchSyncShortagesToCloud,
  subscribeToCatalogLabels,
  saveBulkCatalogLabelsToCloud,
  deleteCatalogLabelFromCloud,
  clearCatalogLabelsOnCloud,
  deduplicateLabelItems,
  publishAppVersionToCloud,
  subscribeToRemoteAppVersion,
  deleteShortageFromCloud,
  rejectShortageCancel,
  recordActivityLog,
} from '../services/firebaseShortageService';
import {
  deleteDeviceIotFromCloud,
  rejectDeviceIotCancel,
} from '../services/firebaseDeviceIotService';
import { ShortageBookingItem } from '../types/shortage';
import { DeviceIotBookingItem } from '../types/deviceIot';
import { LabelItem } from '../types/label';
import { TechnicianItem } from '../types/technician';
import {
  subscribeToTechnicians,
  fetchTechniciansFromCloud,
  adminCreateTechnician,
  adminUpdateTechnician,
  adminDeleteTechnician,
  adminApproveTechnician,
  adminRejectTechnician,
  batchImportTechnicians,
} from '../services/technicianService';
import * as XLSX from 'xlsx';
import {
  Users,
  ShieldCheck,
  Activity,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Laptop,
  Smartphone,
  Check,
  User,
  Key,
  Database,
  ExternalLink,
  X,
  FileSpreadsheet,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Edit3,
  Trash2,
  Copy,
  Search,
  ShieldAlert,
  Share2,
  Download,
  Package,
  UploadCloud,
  Tags,
  Layers,
  Eye,
  Terminal,
  Monitor,
  Globe,
  Zap,
  AlertTriangle,
  Filter,
  Boxes,
  Phone,
  Wrench,
  UserPlus,
} from 'lucide-react';

interface AdminCloudDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status?: 'pending' | 'approved' | 'rejected';
  };
  onUpdateCurrentUser: (user: {
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status?: 'pending' | 'approved' | 'rejected';
  }) => void;
  bookings: ShortageBookingItem[];
  deviceIotBookings?: DeviceIotBookingItem[];
  onUpdateShortageBookings?: (bookings: ShortageBookingItem[]) => void;
  onUpdateDeviceIotBookings?: (bookings: DeviceIotBookingItem[]) => void;
  cloudSynced: boolean;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
  currentLabelItems?: LabelItem[];
  onApplyCatalogLabels?: (items: LabelItem[]) => void;
  totalVisitsCount?: number;
  onlineUsersCount?: number;
  initialTab?: 'approval' | 'cancels' | 'technicians' | 'catalog' | 'logs' | 'profile' | 'links' | 'quota';
}

const DEV_APP_URL = 'https://ais-dev-25zqqhfhavqkf7k3te25ij-670519460440.asia-southeast1.run.app';
const SHARED_APP_URL = 'https://ais-pre-25zqqhfhavqkf7k3te25ij-670519460440.asia-southeast1.run.app';

export const AdminCloudDashboard: React.FC<AdminCloudDashboardProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateCurrentUser,
  bookings,
  deviceIotBookings = [],
  onUpdateShortageBookings,
  onUpdateDeviceIotBookings,
  cloudSynced,
  onShowToast,
  currentLabelItems = [],
  onApplyCatalogLabels,
  totalVisitsCount = 1280,
  onlineUsersCount = 1,
  initialTab = 'approval',
}) => {
  const [usersList, setUsersList] = useState<UserSessionData[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogData[]>([]);
  const [catalogLabels, setCatalogLabels] = useState<LabelItem[]>([]);
  const [activeTab, setActiveTab] = useState<'approval' | 'cancels' | 'technicians' | 'catalog' | 'logs' | 'profile' | 'links' | 'quota'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [catalogSyncProgress, setCatalogSyncProgress] = useState<{ synced: number; total: number } | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [userFilterStatus, setUserFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  // Technicians master list state
  const [technicians, setTechnicians] = useState<TechnicianItem[]>([]);
  const [techSearchTerm, setTechSearchTerm] = useState('');
  const [techFilterStatus, setTechFilterStatus] = useState<'all' | 'active' | 'pending' | 'rejected'>('all');
  const [isAddTechModalOpen, setIsAddTechModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<TechnicianItem | null>(null);
  const [deletingTechConfirm, setDeletingTechConfirm] = useState<TechnicianItem | null>(null);
  const [techFormId, setTechFormId] = useState('');
  const [techFormName, setTechFormName] = useState('');
  const [techFormPhone, setTechFormPhone] = useState('');
  const [techFormDept, setTechFormDept] = useState('Kỹ thuật Phần cứng');
  const [techFormNote, setTechFormNote] = useState('');
  const [techFormStatus, setTechFormStatus] = useState<'active' | 'pending' | 'rejected'>('active');
  const [isSavingTech, setIsSavingTech] = useState(false);
  const techExcelInputRef = useRef<HTMLInputElement>(null);

  // Cancellation search & filter state
  const [cancelSearchTerm, setCancelSearchTerm] = useState('');
  const [cancelModuleFilter, setCancelModuleFilter] = useState<'all' | 'shortage' | 'device_iot'>('all');
  const [processingCancelId, setProcessingCancelId] = useState<string | null>(null);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<UserSessionData | null>(null);
  const [deletingUserConfirm, setDeletingUserConfirm] = useState<UserSessionData | null>(null);
  const [isConfirmClearCatalogModalOpen, setIsConfirmClearCatalogModalOpen] = useState(false);
  const [deletingCatalogItemConfirm, setDeletingCatalogItemConfirm] = useState<LabelItem | null>(null);
  const [editFormName, setEditFormName] = useState('');
  const [editFormUsername, setEditFormUsername] = useState('');
  const [editFormPassword, setEditFormPassword] = useState('');
  const [editFormRole, setEditFormRole] = useState<'admin' | 'staff'>('staff');
  const [editFormStatus, setEditFormStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');

  // Edit personal profile state
  const [inputName, setInputName] = useState(currentUser.name);
  const [inputUsername, setInputUsername] = useState(currentUser.username || '');
  const [inputRole, setInputRole] = useState<'admin' | 'staff'>(currentUser.role);

  // Master Admin PIN state
  const [newMasterPin, setNewMasterPin] = useState('');
  const [confirmMasterPin, setConfirmMasterPin] = useState('');
  const [isChangingMasterPin, setIsChangingMasterPin] = useState(false);

  // Version release management state
  const [publishVersion, setPublishVersion] = useState('2.5.3');
  const [publishBuildId, setPublishBuildId] = useState('build-v253-win-release');
  const [publishReleaseNotes, setPublishReleaseNotes] = useState(
    'Cập nhật tối ưu hóa tự động phát hiện bản mới cho ứng dụng Windows PC & đồng bộ cơ sở dữ liệu Cloud Firestore thời gian thực.'
  );
  const [publishWinUrl, setPublishWinUrl] = useState('');
  const [isPublishingVersion, setIsPublishingVersion] = useState(false);

  useEffect(() => {
    const unsub = subscribeToRemoteAppVersion((info) => {
      if (info && info.version) {
        setPublishVersion(info.version);
        if (info.buildId) setPublishBuildId(info.buildId);
        if (info.releaseNotes) setPublishReleaseNotes(info.releaseNotes);
        if (info.windowsDownloadUrl) setPublishWinUrl(info.windowsDownloadUrl);
      }
    });
    return () => unsub();
  }, []);

  const [isSyncingTechs, setIsSyncingTechs] = useState(false);

  useEffect(() => {
    const unsub = subscribeToTechnicians((list) => {
      setTechnicians(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (activeTab === 'technicians') {
      fetchTechniciansFromCloud()
        .then((list) => {
          if (Array.isArray(list) && list.length > 0) {
            setTechnicians(list);
          }
        })
        .catch(() => {});
    }
  }, [activeTab]);

  const handleSyncTechsNow = async () => {
    setIsSyncingTechs(true);
    try {
      const list = await fetchTechniciansFromCloud();
      setTechnicians(list);
      onShowToast(`Đã đồng bộ ${list.length} kỹ thuật viên từ Cloud thành công!`, 'success');
    } catch (err) {
      onShowToast('Lỗi khi đồng bộ danh sách KTV từ Cloud!', 'error');
    } finally {
      setIsSyncingTechs(false);
    }
  };

  const handlePublishNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishVersion.trim() || !publishBuildId.trim()) {
      onShowToast('Vui lòng nhập đầy đủ phiên bản và mã Build ID!', 'error');
      return;
    }
    setIsPublishingVersion(true);
    try {
      const ok = await publishAppVersionToCloud(
        {
          version: publishVersion.trim(),
          buildId: publishBuildId.trim(),
          releaseNotes: publishReleaseNotes.trim(),
          windowsDownloadUrl: publishWinUrl.trim(),
          releaseDate: new Date().toLocaleDateString('vi-VN'),
        },
        currentUser.name || 'Admin'
      );
      if (ok) {
        onShowToast(`🚀 Đã phát hành bản cập nhật v${publishVersion.trim()} tới toàn bộ ứng dụng Windows & Web!`, 'success');
      } else {
        onShowToast('Không thể phát hành bản cập nhật. Kiểm tra kết nối Cloud!', 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi khi phát hành bản cập nhật: ' + err?.message, 'error');
    } finally {
      setIsPublishingVersion(false);
    }
  };

  const handleSaveMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterPin.trim()) {
      onShowToast('Vui lòng nhập Mã PIN Quản trị tối cao mới!', 'error');
      return;
    }
    if (newMasterPin.trim().length < 4) {
      onShowToast('Mã PIN mới phải từ 4 ký tự trở lên!', 'error');
      return;
    }
    if (newMasterPin.trim() !== confirmMasterPin.trim()) {
      onShowToast('Mã PIN xác nhận không trùng khớp. Vui lòng kiểm tra lại!', 'error');
      return;
    }

    setIsChangingMasterPin(true);
    try {
      await updateMasterAdminPin(newMasterPin.trim(), currentUser.name);
      onShowToast('🎉 Đã đổi thành công Mã PIN Quản trị tối cao mới! Mọi mã PIN cũ lập tức bị vô hiệu hóa.', 'success');
      setNewMasterPin('');
      setConfirmMasterPin('');
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Lỗi khi cập nhật Mã PIN Quản trị', 'error');
    } finally {
      setIsChangingMasterPin(false);
    }
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!isOpen) return;

    const unsubUsers = subscribeToUsers((users) => setUsersList(users));
    const unsubLogs = subscribeToActivityLogs((logs) => setActivityLogs(logs));
    const unsubCatalog = subscribeToCatalogLabels((items) => setCatalogLabels(items));

    return () => {
      unsubUsers();
      unsubLogs();
      unsubCatalog();
    };
  }, [isOpen]);

  // Memoized cancellation items
  const shortageCancelList = useMemo(() => {
    return (bookings || []).filter((b) => Boolean(b.cancelRequested));
  }, [bookings]);

  const deviceIotCancelList = useMemo(() => {
    return (deviceIotBookings || []).filter((b) => Boolean(b.cancelRequested));
  }, [deviceIotBookings]);

  const totalCancelRequests = shortageCancelList.length + deviceIotCancelList.length;

  // Combined and filtered cancel requests
  const filteredCancelRequests = useMemo(() => {
    const term = cancelSearchTerm.trim().toLowerCase();
    const list: Array<{
      id: string;
      moduleType: 'shortage' | 'device_iot';
      moduleLabel: string;
      ticketNumber: string;
      customerName: string;
      customerPhone: string;
      itemName: string;
      itemDetail: string;
      cancelRequestedBy: string;
      cancelRequestedAt: string;
      cancelReason: string;
      rawShortage?: ShortageBookingItem;
      rawDeviceIot?: DeviceIotBookingItem;
    }> = [];

    if (cancelModuleFilter === 'all' || cancelModuleFilter === 'shortage') {
      shortageCancelList.forEach((b) => {
        list.push({
          id: b.id,
          moduleType: 'shortage',
          moduleLabel: 'Đặt Chờ Linh Kiện',
          ticketNumber: b.ticketNumber || `TICKET-${b.id.slice(-6)}`,
          customerName: b.customerName || '',
          customerPhone: b.customerPhone || '',
          itemName: b.partName || 'Linh kiện',
          itemDetail: `${b.model || 'Thiết bị'} • Mã LK: ${b.partCode || 'N/A'}${b.partsList && b.partsList.length > 0 ? ` (${b.partsList.length} linh kiện)` : ''}`,
          cancelRequestedBy: b.cancelRequestedBy || 'Nhân viên',
          cancelRequestedAt: b.cancelRequestedAt || '',
          cancelReason: b.cancelReason || 'Nhân viên yêu cầu hủy phiếu',
          rawShortage: b,
        });
      });
    }

    if (cancelModuleFilter === 'all' || cancelModuleFilter === 'device_iot') {
      deviceIotCancelList.forEach((b) => {
        list.push({
          id: b.id,
          moduleType: 'device_iot',
          moduleLabel: 'Đặt Chờ Máy & IOT',
          ticketNumber: b.ticketNumber || `IOT-${b.id.slice(-6)}`,
          customerName: b.customerName || '',
          customerPhone: b.customerPhone || '',
          itemName: b.deviceName || b.deviceModel || 'Thiết bị',
          itemDetail: `${b.deviceCategory === 'iot' ? 'IOT / Phụ kiện' : 'Máy / Smartphone'} • IMEI: ${b.imeiOrIot || 'N/A'}`,
          cancelRequestedBy: b.cancelRequestedBy || 'Nhân viên',
          cancelRequestedAt: b.cancelRequestedAt || '',
          cancelReason: b.cancelReason || 'Nhân viên yêu cầu hủy phiếu',
          rawDeviceIot: b,
        });
      });
    }

    if (!term) return list;

    return list.filter((item) => {
      return (
        item.ticketNumber.toLowerCase().includes(term) ||
        item.customerName.toLowerCase().includes(term) ||
        item.customerPhone.toLowerCase().includes(term) ||
        item.itemName.toLowerCase().includes(term) ||
        item.itemDetail.toLowerCase().includes(term) ||
        item.cancelRequestedBy.toLowerCase().includes(term) ||
        item.cancelReason.toLowerCase().includes(term)
      );
    });
  }, [shortageCancelList, deviceIotCancelList, cancelModuleFilter, cancelSearchTerm]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(SHARED_APP_URL);
    setCopiedLink(true);
    onShowToast('Đã sao chép liên kết người dùng vào bộ nhớ tạm!', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;

    const updated = {
      uid: currentUser.uid,
      name: inputName.trim(),
      username: inputUsername.trim() || `user_${currentUser.uid.slice(-4)}`,
      role: inputRole,
      status: currentUser.status || 'approved',
    };
    onUpdateCurrentUser(updated);
    updateUserSession({
      uid: currentUser.uid,
      displayName: inputName.trim(),
      username: inputUsername.trim(),
      role: inputRole,
      status: currentUser.status || 'approved',
    });
    onShowToast(`Đã lưu danh tính: ${inputName.trim()} (${inputRole === 'admin' ? 'Quản trị viên' : 'Nhân viên'})`, 'success');
  };

  const handleQuickApprove = async (user: UserSessionData) => {
    try {
      await approveUserSession(
        user.uid,
        {
          status: 'approved',
          displayName: user.displayName,
          username: user.username || `nv_${user.uid.slice(-4)}`,
          role: user.role || 'staff',
        },
        currentUser.name
      );
      onShowToast(`Đã phê duyệt tài khoản: ${user.displayName || user.uid}`, 'success');
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi phê duyệt tài khoản', 'error');
    }
  };

  const handleQuickReject = async (user: UserSessionData) => {
    try {
      await approveUserSession(
        user.uid,
        {
          status: 'rejected',
          displayName: user.displayName,
          username: user.username,
          role: user.role,
        },
        currentUser.name
      );
      onShowToast(`Đã khóa / từ chối tài khoản: ${user.displayName || user.uid}`, 'info');
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi cập nhật trạng thái', 'error');
    }
  };

  const handleOpenEditUser = (user: UserSessionData) => {
    setEditingUser(user);
    setEditFormName(user.displayName || '');
    setEditFormUsername(user.username || `nv_${user.uid.slice(-4)}`);
    setEditFormPassword(user.password || '');
    setEditFormRole(user.role || 'staff');
    setEditFormStatus(user.status || 'approved');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updates: any = {
        displayName: editFormName.trim(),
        username: editFormUsername.trim(),
        role: editFormRole,
        status: editFormStatus,
      };
      if (editFormPassword.trim()) {
        updates.password = editFormPassword.trim();
      }

      await approveUserSession(
        editingUser.uid,
        updates,
        currentUser.name
      );
      onShowToast(`Đã cập nhật tài khoản: ${editFormName.trim()} (@${editFormUsername.trim()})`, 'success');
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi lưu thông tin người dùng', 'error');
    }
  };

  const handleDeleteUser = (user: UserSessionData) => {
    setDeletingUserConfirm(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUserConfirm) return;
    const target = deletingUserConfirm;
    setDeletingUserConfirm(null);
    try {
      await deleteUserSession(target.uid, currentUser.name);
      setUsersList((prev) => prev.filter((u) => u.uid !== target.uid));
      onShowToast(`Đã xóa vĩnh viễn tài khoản: ${target.displayName || target.uid}`, 'info');
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi xóa người dùng khỏi Cloud', 'error');
    }
  };

  const handleForceSyncAll = async () => {
    setIsSyncing(true);
    try {
      await batchSyncShortagesToCloud(bookings);
      onShowToast(`Đã đồng bộ ${bookings.length} phiếu đặt chờ lên đám mây Cloud Firestore thành công!`, 'success');
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi đồng bộ lên Cloud, vui lòng kiểm tra kết nối mạng', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Catalog Cloud Handlers
  const catalogFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadNewCatalogFileToCloud = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSyncingCatalog(true);
      onShowToast(`Đang đọc file '${file.name}' và nạp dữ liệu tem lên Cloud...`, 'info');
      const imported = await readExcelFile(file);
      if (!imported || imported.length === 0) {
        onShowToast('❌ Không tìm thấy dữ liệu tem linh kiện phù hợp trong file Excel!', 'error');
        return;
      }

      const deduplicated = deduplicateLabelItems(imported);
      const authorName = currentUser?.name || 'Admin';

      setCatalogSyncProgress({ synced: 0, total: deduplicated.length });
      const processed = await saveBulkCatalogLabelsToCloud(
        deduplicated,
        authorName,
        (synced, total) => {
          setCatalogSyncProgress({ synced, total });
        }
      );

      const finalList = processed && processed.length > 0 ? processed : deduplicated;
      setCatalogLabels(finalList);

      if (onApplyCatalogLabels) {
        onApplyCatalogLabels(finalList);
      }

      onShowToast(`🎉 Đã nạp và đồng bộ thành công ${finalList.length} tem từ file '${file.name}' lên Cloud!`, 'success');
      recordActivityLog({
        action: 'Tải file tem mới lên Cloud',
        userName: authorName,
        details: `Đã tải file Excel '${file.name}' với ${finalList.length} tem lên Cloud Catalog.`,
        timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
      }).catch(() => {});
    } catch (err: any) {
      console.error('Lỗi khi nạp file tem lên Cloud:', err);
      onShowToast('❌ Lỗi khi đọc file Excel hoặc tải lên Cloud. Vui lòng kiểm tra định dạng file.', 'error');
    } finally {
      setIsSyncingCatalog(false);
      setCatalogSyncProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeduplicateWorkspace = () => {
    if (currentLabelItems.length === 0) {
      onShowToast('Bàn làm việc in tem hiện đang trống!', 'info');
      return;
    }
    const cleanList = deduplicateLabelItems(currentLabelItems);
    const diff = currentLabelItems.length - cleanList.length;
    if (onApplyCatalogLabels) {
      onApplyCatalogLabels(cleanList);
    }
    if (diff > 0) {
      onShowToast(`Đã lọc sạch thành công! Đã xóa ${diff} tem trùng lặp, giữ lại ${cleanList.length} tem độc nhất.`, 'success');
    } else {
      onShowToast(`Bàn làm việc không có tem trùng lặp (Tổng ${cleanList.length} tem).`, 'info');
    }
  };

  const handleSyncCurrentLabelsToCloud = async () => {
    if (currentLabelItems.length === 0) {
      onShowToast('Bàn làm việc in tem hiện đang trống, không có tem để đồng bộ lên Cloud!', 'error');
      return;
    }
    setIsSyncingCatalog(true);
    const cleanList = deduplicateLabelItems(currentLabelItems);
    setCatalogSyncProgress({ synced: 0, total: cleanList.length });
    try {
      const processed = await saveBulkCatalogLabelsToCloud(
        cleanList,
        currentUser.name || 'Admin',
        (synced, total) => {
          setCatalogSyncProgress({ synced, total });
        }
      );
      if (onApplyCatalogLabels && processed && processed.length > 0) {
        onApplyCatalogLabels(processed);
      }
      setCatalogLabels(processed);
      onShowToast(`Đã đồng bộ sạch sẽ ${processed.length} tem độc nhất lên Cloud Firestore thành công!`, 'success');
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi đồng bộ tem lên Cloud', 'error');
    } finally {
      setIsSyncingCatalog(false);
      setCatalogSyncProgress(null);
    }
  };

  const handleApplyCatalogToWorkspace = () => {
    if (catalogLabels.length === 0) {
      onShowToast('Danh mục tem Cloud đang trống!', 'error');
      return;
    }
    const cleanCatalog = deduplicateLabelItems(catalogLabels);
    if (onApplyCatalogLabels) {
      onApplyCatalogLabels(cleanCatalog);
      onShowToast(`Đã tải ${cleanCatalog.length} tem từ Cloud vào bàn làm việc in tem!`, 'success');
    }
  };

  const handleOpenDeleteCatalogItem = (item: LabelItem) => {
    setDeletingCatalogItemConfirm(item);
  };

  const handleConfirmDeleteCatalogItem = async () => {
    if (!deletingCatalogItemConfirm) return;
    const item = deletingCatalogItemConfirm;
    try {
      await deleteCatalogLabelFromCloud(item.id, currentUser.name || 'Admin');
      setCatalogLabels((prev) => prev.filter((i) => i.id !== item.id));
      onShowToast(`Đã xóa tem "${item.name}" khỏi Cloud!`, 'success');
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi xóa tem khỏi Cloud', 'error');
    } finally {
      setDeletingCatalogItemConfirm(null);
    }
  };

  const handleOpenClearAllCatalog = () => {
    setIsConfirmClearCatalogModalOpen(true);
  };

  const handleConfirmClearAllCatalog = async () => {
    setIsConfirmClearCatalogModalOpen(false);
    setIsSyncingCatalog(true);
    try {
      await clearCatalogLabelsOnCloud(currentUser.name || 'Admin', (deleted, total) => {
        setCatalogSyncProgress({ synced: deleted, total });
      });
      setCatalogLabels([]);
      onShowToast('Đã xóa sạch toàn bộ danh mục tem trên Cloud!', 'success');
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi xóa danh mục trên Cloud', 'error');
    } finally {
      setIsSyncingCatalog(false);
      setCatalogSyncProgress(null);
    }
  };

  const handleApproveCancelRequest = async (item: {
    id: string;
    moduleType: 'shortage' | 'device_iot';
    ticketNumber: string;
    cancelRequestedBy: string;
    rawShortage?: ShortageBookingItem;
    rawDeviceIot?: DeviceIotBookingItem;
  }) => {
    setProcessingCancelId(item.id);
    try {
      if (item.moduleType === 'shortage') {
        await deleteShortageFromCloud(item.id, item.ticketNumber, currentUser.name);
        if (onUpdateShortageBookings) {
          onUpdateShortageBookings(bookings.filter((b) => b.id !== item.id));
        }
      } else {
        await deleteDeviceIotFromCloud(item.id);
        if (onUpdateDeviceIotBookings) {
          onUpdateDeviceIotBookings(deviceIotBookings.filter((b) => b.id !== item.id));
        }
      }
      onShowToast(
        `Đã phê duyệt hủy và xóa phiếu ${item.ticketNumber} (Yêu cầu bởi: ${item.cancelRequestedBy})`,
        'success'
      );
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi phê duyệt hủy phiếu', 'error');
    } finally {
      setProcessingCancelId(null);
    }
  };

  const handleRejectCancelRequest = async (item: {
    id: string;
    moduleType: 'shortage' | 'device_iot';
    ticketNumber: string;
    cancelRequestedBy: string;
    rawShortage?: ShortageBookingItem;
    rawDeviceIot?: DeviceIotBookingItem;
  }) => {
    setProcessingCancelId(item.id);
    try {
      if (item.moduleType === 'shortage') {
        await rejectShortageCancel(item.id, item.ticketNumber, currentUser.name);
        if (onUpdateShortageBookings) {
          onUpdateShortageBookings(
            bookings.map((b) =>
              b.id === item.id
                ? { ...b, cancelRequested: false, cancelReason: '', cancelRequestedBy: '', cancelRequestedAt: '' }
                : b
            )
          );
        }
      } else {
        await rejectDeviceIotCancel(item.id, item.ticketNumber, currentUser.name);
        if (onUpdateDeviceIotBookings) {
          onUpdateDeviceIotBookings(
            deviceIotBookings.map((b) =>
              b.id === item.id
                ? { ...b, cancelRequested: false, cancelReason: '', cancelRequestedBy: '', cancelRequestedAt: '' }
                : b
            )
          );
        }
      }
      onShowToast(
        `Đã bác bỏ yêu cầu hủy phiếu ${item.ticketNumber} (Giữ lại phiếu trong hệ thống)`,
        'info'
      );
    } catch (err) {
      console.error(err);
      onShowToast('Lỗi khi bác bỏ yêu cầu hủy', 'error');
    } finally {
      setProcessingCancelId(null);
    }
  };

  // Technicians management handlers
  const handleOpenAddTech = () => {
    const nextNum = technicians.length + 1;
    const padNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    setTechFormId(`KTV${padNum}`);
    setTechFormName('');
    setTechFormPhone('');
    setTechFormDept('Kỹ thuật Phần cứng');
    setTechFormNote('');
    setTechFormStatus('active');
    setEditingTech(null);
    setIsAddTechModalOpen(true);
  };

  const handleOpenEditTech = (tech: TechnicianItem) => {
    setEditingTech(tech);
    setTechFormId(tech.techId);
    setTechFormName(tech.name);
    setTechFormPhone(tech.phone || '');
    setTechFormDept(tech.department || 'Kỹ thuật Phần cứng');
    setTechFormNote(tech.note || '');
    setTechFormStatus(tech.status);
    setIsAddTechModalOpen(true);
  };

  const handleSaveTechForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techFormName.trim() || !techFormId.trim()) {
      onShowToast('Vui lòng điền đầy đủ Tên KTV và Mã/ID kỹ thuật!', 'error');
      return;
    }
    setIsSavingTech(true);
    try {
      if (editingTech) {
        await adminUpdateTechnician(editingTech.id, {
          techId: techFormId.trim().toUpperCase(),
          name: techFormName.trim(),
          phone: techFormPhone.trim(),
          department: techFormDept.trim(),
          note: techFormNote.trim(),
          status: techFormStatus,
        });
        onShowToast(`Đã cập nhật KTV [${techFormName.trim()}] thành công!`, 'success');
      } else {
        await adminCreateTechnician({
          techId: techFormId.trim().toUpperCase(),
          name: techFormName.trim(),
          phone: techFormPhone.trim(),
          department: techFormDept.trim(),
          note: techFormNote.trim(),
          approvedBy: currentUser.name || 'Admin',
        });
        onShowToast(`Đã thêm KTV [${techFormName.trim()}] vào danh sách chính thức!`, 'success');
      }
      setIsAddTechModalOpen(false);
      setEditingTech(null);
    } catch (err: any) {
      onShowToast(err?.message || 'Có lỗi khi lưu KTV', 'error');
    } finally {
      setIsSavingTech(false);
    }
  };

  const handleApproveTechRequest = async (tech: TechnicianItem) => {
    try {
      await adminApproveTechnician(tech.id, currentUser.name || 'Admin');
      onShowToast(`Đã phê duyệt KTV [${tech.name}] (${tech.techId}) vào danh sách!`, 'success');
    } catch (err) {
      onShowToast('Lỗi khi phê duyệt KTV', 'error');
    }
  };

  const handleRejectTechRequest = async (tech: TechnicianItem) => {
    try {
      await adminRejectTechnician(tech.id, currentUser.name || 'Admin');
      onShowToast(`Đã từ chối yêu cầu KTV [${tech.name}]!`, 'info');
    } catch (err) {
      onShowToast('Lỗi khi từ chối KTV', 'error');
    }
  };

  const handleConfirmDeleteTech = async () => {
    if (!deletingTechConfirm) return;
    try {
      await adminDeleteTechnician(deletingTechConfirm.id);
      onShowToast(`Đã xóa KTV [${deletingTechConfirm.name}] khỏi hệ thống!`, 'success');
      setDeletingTechConfirm(null);
    } catch (err) {
      onShowToast('Lỗi khi xóa KTV', 'error');
    }
  };

  const handleDownloadTechExcelTemplate = () => {
    const templateData = [
      {
        'Mã KTV': 'D01975928',
        'Họ Và Tên': 'VÕ MINH KHÁ',
        'Bộ Phận / Vị Trí': 'CX',
        'Số Điện Thoại': '0901234567',
        'Ghi Chú': 'Kỹ thuật viên chính thức',
      },
      {
        'Mã KTV': 'D05392993',
        'Họ Và Tên': 'HỒ THANH DUY',
        'Bộ Phận / Vị Trí': 'Kỹ thuật Phần cứng',
        'Số Điện Thoại': '0901234568',
        'Ghi Chú': 'Kỹ thuật viên chính thức',
      },
      {
        'Mã KTV': 'D07624349',
        'Họ Và Tên': 'PHÙNG VINH HIỂN',
        'Bộ Phận / Vị Trí': 'Kỹ thuật Phần cứng',
        'Số Điện Thoại': '0901234569',
        'Ghi Chú': 'Kỹ thuật viên chính thức',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSach_KTV');
    XLSX.writeFile(wb, 'Mau_Nhap_Danh_Sach_Ky_Thuat_Vien.xlsx');
  };

  const handleImportTechExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (!jsonData || jsonData.length === 0) {
          onShowToast('File Excel rỗng hoặc không đúng định dạng!', 'error');
          return;
        }

        const parsedTechs: Array<{
          techId: string;
          name: string;
          department?: string;
          phone?: string;
          note?: string;
        }> = [];

        jsonData.forEach((row: any) => {
          const techId =
            row['Mã KTV'] ||
            row['Ma KTV'] ||
            row['ID KTV'] ||
            row['Mã kỹ thuật'] ||
            row['techId'] ||
            row['Code'] ||
            '';
          const name =
            row['Họ Và Tên'] ||
            row['Họ và Tên'] ||
            row['Họ tên'] ||
            row['Tên KTV'] ||
            row['Tên kỹ thuật viên'] ||
            row['name'] ||
            '';
          const department =
            row['Bộ Phận / Vị Trí'] ||
            row['Bộ phận'] ||
            row['Vị trí'] ||
            row['Phòng ban'] ||
            row['department'] ||
            'Kỹ thuật / CS';
          const phone =
            row['Số Điện Thoại'] ||
            row['SĐT'] ||
            row['Phone'] ||
            row['phone'] ||
            '';
          const note =
            row['Ghi Chú'] ||
            row['Ghi chú'] ||
            row['Note'] ||
            row['note'] ||
            '';

          if (techId && name) {
            parsedTechs.push({
              techId: String(techId).trim(),
              name: String(name).trim(),
              department: String(department).trim(),
              phone: String(phone).trim(),
              note: String(note).trim(),
            });
          }
        });

        if (parsedTechs.length === 0) {
          onShowToast(
            'Không tìm thấy KTV hợp lệ trong file Excel (Yêu cầu cột "Mã KTV" và "Họ Và Tên")!',
            'error'
          );
          return;
        }

        const res = await batchImportTechnicians(parsedTechs);
        onShowToast(
          `Đã nhập thành công ${res.successCount} Kỹ thuật viên từ file Excel!`,
          'success'
        );
      } catch (err: any) {
        console.error(err);
        onShowToast(`Lỗi khi đọc file Excel: ${err.message || 'File không đúng cấu trúc'}`, 'error');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const pendingTechnicians = useMemo(() => {
    return technicians.filter((t) => t.status === 'pending');
  }, [technicians]);

  const pendingTechCount = useMemo(() => {
    return pendingTechnicians.length;
  }, [pendingTechnicians]);

  const filteredTechnicians = useMemo(() => {
    const term = techSearchTerm.trim().toLowerCase();
    return technicians.filter((t) => {
      const matchFilter = techFilterStatus === 'all' || t.status === techFilterStatus;
      if (!matchFilter) return false;
      if (!term) return true;
      return (
        t.name.toLowerCase().includes(term) ||
        t.techId.toLowerCase().includes(term) ||
        (t.department && t.department.toLowerCase().includes(term)) ||
        (t.phone && t.phone.includes(term)) ||
        (t.requestedBy && t.requestedBy.toLowerCase().includes(term))
      );
    });
  }, [technicians, techFilterStatus, techSearchTerm]);

  // Filtered users list
  const filteredUsers = usersList.filter((user) => {
    const matchStatus = userFilterStatus === 'all' || user.status === userFilterStatus;
    const matchSearch =
      !userSearchTerm.trim() ||
      user.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.uid.toLowerCase().includes(userSearchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pendingCount = usersList.filter((u) => u.status === 'pending').length;

  if (!isOpen || currentUser.role !== 'admin') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-neutral-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white">Quản Trị Hệ Thống & Phê Duyệt User</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Firebase Cloud Live
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Duyệt tài khoản, chỉ định tên truy cập và đồng bộ thời gian thực cho tất cả máy tính
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 pt-3 border-b border-neutral-200 bg-neutral-50/80 text-xs shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('approval')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'approval'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Phê Duyệt & Quản Lý User ({usersList.length || 1})</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                {pendingCount} chờ
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancels')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'cancels'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Yêu Cầu Hủy Phiếu</span>
            {totalCancelRequests > 0 ? (
              <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                {totalCancelRequests} yêu cầu
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-600">
                0
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('technicians')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'technicians'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Wrench className="w-4 h-4 text-emerald-600" />
            <span>Kỹ Thuật Viên ({technicians.length})</span>
            {pendingTechCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                {pendingTechCount} chờ duyệt
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'catalog'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Tags className="w-4 h-4 text-indigo-600" />
            <span>Đồng Bộ Tem Kho Cloud ({catalogLabels.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'links'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>Link Người Dùng & Đóng Gói</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'logs'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Nhật ký thao tác ({activityLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Danh tính của bạn</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quota')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'quota'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Dung Lượng Miễn Phí</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: USER APPROVAL & ACCOUNT MANAGEMENT */}
          {activeTab === 'approval' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                <div className="space-y-1">
                  <h4 className="font-black text-neutral-900 text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-indigo-600" />
                    <span>Duyệt Quyền Truy Cập & Phân Quyền Nhân Sự</span>
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Admin có thể duyệt tài khoản, đặt <strong>Tên truy cập (Username)</strong>, phân quyền <strong>Admin / Kỹ thuật viên</strong> hoặc khóa truy cập.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleForceSyncAll}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                    title="Đẩy toàn bộ phiếu từ máy này lên Cloud để các máy khác cập nhật ngay"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Đồng bộ toàn bộ phiếu</span>
                  </button>
                </div>
              </div>

              {/* Live Traffic & User Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Đang Online</div>
                    <div className="text-base font-black text-emerald-950 font-mono">{onlineUsersCount} thiết bị</div>
                  </div>
                </div>

                <div className="bg-sky-50 border border-sky-200/80 p-3 rounded-xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
                    <Eye className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">Lượt Truy Cập</div>
                    <div className="text-base font-black text-sky-950 font-mono">{totalVisitsCount.toLocaleString('vi-VN')}</div>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200/80 p-3 rounded-xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Tổng User</div>
                    <div className="text-base font-black text-indigo-950 font-mono">{usersList.length || 1} tài khoản</div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Chờ Duyệt</div>
                    <div className="text-base font-black text-amber-950 font-mono">{pendingCount} yêu cầu</div>
                  </div>
                </div>
              </div>

              {/* Alert: Pending Cancellation Requests from staff */}
              {totalCancelRequests > 0 && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-rose-950">
                          CÓ {totalCancelRequests} PHIẾU YÊU CẦU HỦY TỪ NHÂN VIÊN ĐANG CHỜ ADMIN DUYỆT
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-200 text-rose-800">
                          {totalCancelRequests}
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 mt-0.5">
                        Bao gồm <strong>{shortageCancelList.length}</strong> phiếu Đặt chờ linh kiện và <strong>{deviceIotCancelList.length}</strong> phiếu Máy & IOT.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('cancels')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <span>Xem & Duyệt Hủy Ngay</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Master Admin PIN Change Card */}
              <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-5 text-white border border-purple-500/30 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-800/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-400/30 shrink-0">
                      <Key className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                        <span>Quản Lý Mã PIN Quản Trị Tối Cao (Master Admin PIN)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                          Bảo mật tối cao
                        </span>
                      </h4>
                      <p className="text-xs text-purple-200/80">
                        Đổi mật khẩu / mã PIN cấp Master. Khi đổi thành công, mã PIN cũ lập tức hết tác dụng trên toàn hệ thống.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveMasterPin} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-200 mb-1">Mã PIN Master mới:</label>
                    <input
                      type="password"
                      required
                      value={newMasterPin}
                      onChange={(e) => setNewMasterPin(e.target.value)}
                      placeholder="Nhập mã PIN mới (>= 4 ký tự)..."
                      className="w-full p-2 bg-black/40 border border-purple-500/40 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-purple-400 focus:bg-black/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-200 mb-1">Xác nhận PIN mới:</label>
                    <input
                      type="password"
                      required
                      value={confirmMasterPin}
                      onChange={(e) => setConfirmMasterPin(e.target.value)}
                      placeholder="Nhập lại mã PIN mới..."
                      className="w-full p-2 bg-black/40 border border-purple-500/40 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-purple-400 focus:bg-black/60"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isChangingMasterPin}
                      className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border border-purple-400/30"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isChangingMasterPin ? 'Đang lưu Cloud...' : 'Cập Nhật Mã PIN Master'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên hiển thị, username, UID..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs focus:border-indigo-600 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setUserFilterStatus('all')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                      userFilterStatus === 'all' ? 'bg-white text-neutral-900 shadow-2xs font-bold' : 'text-neutral-600'
                    }`}
                  >
                    Tất cả ({usersList.length || 1})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilterStatus('pending')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                      userFilterStatus === 'pending'
                        ? 'bg-amber-500 text-white shadow-2xs font-bold'
                        : 'text-amber-700 hover:bg-amber-100/50'
                    }`}
                  >
                    Chờ duyệt ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilterStatus('approved')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                      userFilterStatus === 'approved' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-emerald-700'
                    }`}
                  >
                    Đã duyệt
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilterStatus('rejected')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                      userFilterStatus === 'rejected' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-rose-700'
                    }`}
                  >
                    Đã khóa
                  </button>
                </div>
              </div>

              {/* Users Table / Card Grid */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-100/80 border-b border-neutral-200 text-neutral-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Người dùng / Thiết bị</th>
                      <th className="py-2.5 px-3">Tên truy cập (Username)</th>
                      <th className="py-2.5 px-3">Vai trò</th>
                      <th className="py-2.5 px-3">Trạng thái duyệt</th>
                      <th className="py-2.5 px-3">Hoạt động gần nhất</th>
                      <th className="py-2.5 px-3 text-right">Thao tác Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-neutral-400">
                          Không tìm thấy người dùng nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const isCurrent = user.uid === currentUser.uid;
                        const isPending = user.status === 'pending';
                        const isApproved = user.status === 'approved' || (user.role === 'admin' || user.username === 'admin' || user.uid === 'admin-master');
                        const isRejected = user.status === 'rejected';

                        return (
                          <tr
                            key={user.uid}
                            className={`hover:bg-neutral-50/80 transition-colors ${
                              isPending ? 'bg-amber-50/30' : isRejected ? 'bg-rose-50/20' : ''
                            }`}
                          >
                            {/* User Name & Device */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 ${
                                    user.role === 'admin' ? 'bg-purple-900' : 'bg-slate-800'
                                  }`}
                                >
                                  {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                                    <span>{user.displayName || 'Chưa đặt tên'}</span>
                                    {isCurrent && (
                                      <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">
                                        Máy của bạn
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono mt-0.5">
                                    <Laptop className="w-3 h-3 text-neutral-400" />
                                    <span>{user.device || 'PC / Web'}</span>
                                    <span>•</span>
                                    <span className="text-neutral-400 truncate max-w-[90px]">{user.uid}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Username */}
                            <td className="py-3 px-3">
                              <div className="font-mono font-bold text-indigo-950 bg-neutral-100 px-2 py-1 rounded inline-block">
                                {user.username || `@${user.uid.slice(-6)}`}
                              </div>
                            </td>

                            {/* Role */}
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  user.role === 'admin'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : 'bg-neutral-100 text-neutral-800'
                                }`}
                              >
                                {user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Kỹ thuật viên'}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              {isPending ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-700 animate-spin" />
                                  <span>Chờ duyệt</span>
                                </span>
                              ) : isApproved ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Đã phê duyệt</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                  <Lock className="w-3 h-3 text-rose-700" />
                                  <span>Đã khóa / Từ chối</span>
                                </span>
                              )}
                            </td>

                            {/* Last active */}
                            <td className="py-3 px-3 text-neutral-500 font-mono text-[11px]">
                              {user.lastActive || 'Vừa xong'}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {isPending && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickApprove(user)}
                                      className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer transition-colors"
                                      title="Phê duyệt quyền truy cập ngay"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickReject(user)}
                                      className="p-1.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold cursor-pointer transition-colors"
                                      title="Từ chối yêu cầu"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(user)}
                                  className="p-1.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium cursor-pointer transition-colors"
                                  title="Chỉnh sửa Tên truy cập, vai trò và trạng thái"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-neutral-700" />
                                </button>

                                {isApproved && !isCurrent && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickReject(user)}
                                    className="p-1.5 rounded hover:bg-rose-50 text-neutral-400 hover:text-rose-600 cursor-pointer transition-colors"
                                    title="Khóa tài khoản này"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {isRejected && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickApprove(user)}
                                    className="p-1.5 rounded hover:bg-emerald-50 text-neutral-400 hover:text-emerald-600 cursor-pointer transition-colors"
                                    title="Mở khóa tài khoản"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {!isCurrent && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(user)}
                                    className="p-1.5 rounded hover:bg-rose-50 text-neutral-400 hover:text-rose-600 cursor-pointer transition-colors"
                                    title="Xóa tài khoản khỏi danh sách"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: CANCELLATION REQUESTS MANAGEMENT */}
          {activeTab === 'cancels' && (
            <div className="space-y-4">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 p-4 sm:p-5 rounded-2xl text-white border border-rose-800/50 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-800/40 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-300 flex items-center justify-center border border-rose-500/40 shrink-0">
                      <AlertTriangle className="w-5 h-5 text-rose-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm sm:text-base text-white tracking-wide">
                          Trung Tâm Xử Lý & Duyệt Yêu Cầu Hủy Phiếu
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/30 text-rose-200 border border-rose-400/40">
                          {totalCancelRequests} yêu cầu chờ duyệt
                        </span>
                      </div>
                      <p className="text-xs text-rose-200/80 mt-0.5">
                        Khi nhân viên kỹ thuật gửi yêu cầu xóa phiếu, phiếu sẽ được giữ an toàn tại đây chờ Quản trị viên (Admin) xem xét và phê duyệt xóa vĩnh viễn hoặc bác bỏ.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick stats mini-row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-rose-200">Tổng yêu cầu chờ xử lý:</span>
                    <span className="text-sm font-black font-mono text-white">{totalCancelRequests}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-indigo-200">Đặt chờ linh kiện:</span>
                    <span className="text-sm font-black font-mono text-indigo-300">{shortageCancelList.length}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-orange-200">Đặt chờ máy & IOT:</span>
                    <span className="text-sm font-black font-mono text-orange-300">{deviceIotCancelList.length}</span>
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setCancelModuleFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      cancelModuleFilter === 'all'
                        ? 'bg-neutral-900 text-white shadow-xs'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    Tất Cả ({totalCancelRequests})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelModuleFilter('shortage')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      cancelModuleFilter === 'shortage'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    Đặt Chờ Linh Kiện ({shortageCancelList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelModuleFilter('device_iot')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      cancelModuleFilter === 'device_iot'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-orange-50 hover:bg-orange-100 text-orange-800'
                    }`}
                  >
                    Đặt Chờ Máy & IOT ({deviceIotCancelList.length})
                  </button>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cancelSearchTerm}
                    onChange={(e) => setCancelSearchTerm(e.target.value)}
                    placeholder="Tìm số phiếu, nhân viên, khách, lý do..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
                  />
                  {cancelSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setCancelSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Requests List */}
              {filteredCancelRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-neutral-900 text-sm">
                      {totalCancelRequests === 0
                        ? 'Không có yêu cầu hủy phiếu nào đang chờ duyệt'
                        : 'Không tìm thấy yêu cầu phù hợp với bộ lọc'}
                    </h5>
                    <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                      {totalCancelRequests === 0
                        ? 'Toàn bộ phiếu trên hệ thống đang ở trạng thái hợp lệ. Khi nhân viên gửi yêu cầu hủy phiếu, thông tin sẽ lập tức hiển thị tại đây.'
                        : 'Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc chọn bộ lọc "Tất Cả".'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCancelRequests.map((item) => {
                    const isProcessing = processingCancelId === item.id;
                    const isShortage = item.moduleType === 'shortage';

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-rose-200/90 shadow-sm p-4 hover:border-rose-300 transition-all space-y-3"
                      >
                        {/* Top info row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                isShortage
                                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                  : 'bg-orange-100 text-orange-900 border border-orange-200'
                              }`}
                            >
                              {item.moduleLabel}
                            </span>
                            <span className="font-mono font-black text-xs text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                              {item.ticketNumber}
                            </span>
                            {item.customerName && (
                              <span className="text-xs font-bold text-neutral-800">
                                {item.customerName}
                              </span>
                            )}
                            {item.customerPhone && (
                              <span className="text-xs text-neutral-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-neutral-400" />
                                {item.customerPhone}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Gửi lúc: {item.cancelRequestedAt || 'Hôm nay'}</span>
                          </div>
                        </div>

                        {/* Content & Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Part / Device description */}
                          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/80 space-y-1">
                            <div className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                              Thông Tin Phiếu & Thiết Bị
                            </div>
                            <div className="font-bold text-xs text-neutral-900">{item.itemName}</div>
                            <div className="text-[11px] text-neutral-600">{item.itemDetail}</div>
                          </div>

                          {/* Cancellation Requester & Reason */}
                          <div className="bg-rose-50/80 p-3 rounded-xl border border-rose-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-bold uppercase text-rose-800 tracking-wider flex items-center gap-1">
                                <User className="w-3 h-3 text-rose-600" />
                                <span>Nhân Viên Yêu Cầu Hủy:</span>
                              </div>
                              <span className="text-xs font-black text-rose-950 bg-rose-200/80 px-2 py-0.5 rounded">
                                {item.cancelRequestedBy || 'Kỹ thuật viên'}
                              </span>
                            </div>
                            <div className="pt-0.5">
                              <div className="text-[10px] font-bold text-rose-900">Lý do hủy phiếu:</div>
                              <div className="text-xs font-medium text-rose-950 bg-white/90 p-2 rounded-lg border border-rose-200/60 mt-0.5 leading-relaxed">
                                {item.cancelReason || 'Nhân viên yêu cầu hủy phiếu'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Admin Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleRejectCancelRequest(item)}
                            className="px-3.5 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-bold text-xs cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5 text-neutral-500" />
                            <span>Bác Bỏ Yêu Cầu (Giữ Phiếu)</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleApproveCancelRequest(item)}
                            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {isProcessing ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>Phê Duyệt Hủy & Xóa Vĩnh Viễn</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {activeTab === 'technicians' && (
            <div className="space-y-4">
              {/* Header Action Banner */}
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 p-4 sm:p-5 rounded-2xl text-white border border-indigo-700/60 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-indigo-800/60 pb-3.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30 shrink-0 mt-0.5 shadow-xs">
                      <Wrench className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        <span>Danh Sách Kỹ Thuật Viên & Phê Duyệt</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                          {technicians.filter((t) => t.status === 'active').length} KTV chính thức
                        </span>
                      </h3>
                      <p className="text-xs text-indigo-200/90 leading-relaxed">
                        Quản lý danh sách Kỹ thuật tạo phiếu và Kỹ thuật xử lý. Admin có toàn quyền <strong>Thêm, Sửa, Xóa</strong>. Nhân viên đề xuất KTV mới phải thông qua Admin phê duyệt.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                    <input
                      type="file"
                      ref={techExcelInputRef}
                      onChange={handleImportTechExcel}
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleSyncTechsNow}
                      disabled={isSyncingTechs}
                      className="px-3 py-2 bg-indigo-800/80 hover:bg-indigo-700 text-indigo-100 border border-indigo-600/80 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Đồng bộ danh sách Kỹ Thuật Viên từ Cloud SQL & Firestore"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-indigo-300 ${isSyncingTechs ? 'animate-spin' : ''}`} />
                      <span>{isSyncingTechs ? 'Đang đồng bộ...' : 'Đồng Bộ Ngay'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTechExcelTemplate}
                      className="px-3 py-2 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-100 border border-indigo-700/80 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      title="Tải file Excel mẫu danh sách Kỹ Thuật Viên"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Tải Mẫu Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => techExcelInputRef.current?.click()}
                      className="px-3 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 border border-emerald-600/80 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      title="Nhập file Excel danh sách Kỹ Thuật Viên"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Nhập File Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAddTech}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ Thêm KTV Mới</span>
                    </button>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
                    <span className="text-indigo-200 text-[11px]">Tổng số KTV:</span>
                    <strong className="text-white font-bold text-sm">{technicians.length}</strong>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
                    <span className="text-emerald-300 text-[11px]">KTV đang hoạt động:</span>
                    <strong className="text-emerald-400 font-bold text-sm">
                      {technicians.filter((t) => t.status === 'active').length}
                    </strong>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
                    <span className="text-amber-300 text-[11px]">Đang chờ Admin duyệt:</span>
                    <strong className="text-amber-400 font-bold text-sm">
                      {pendingTechCount}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Pending Requests Section */}
              {pendingTechnicians.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Đề Xuất Kỹ Thuật Viên Mới Cần Admin Duyệt ({pendingTechnicians.length})</span>
                    </h4>
                    <span className="text-[11px] text-amber-700 font-medium">
                      Nhân viên đã gửi yêu cầu
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pendingTechnicians.map((tech) => (
                      <div
                        key={tech.id}
                        className="bg-white rounded-xl border border-amber-300 p-3.5 shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                                {tech.techId}
                              </span>
                              <h5 className="font-bold text-sm text-neutral-900">{tech.name}</h5>
                            </div>
                            <div className="text-xs text-neutral-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              {tech.department && <span>Phòng: <strong>{tech.department}</strong></span>}
                              {tech.phone && <span>SĐT: <strong>{tech.phone}</strong></span>}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse shrink-0">
                            Chờ duyệt
                          </span>
                        </div>

                        {tech.note && (
                          <div className="text-xs bg-neutral-50 p-2 rounded-lg border border-neutral-200 text-neutral-700 italic">
                            "{tech.note}"
                          </div>
                        )}

                        <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1 border-t border-neutral-100">
                          <span>Đề xuất bởi: <strong className="text-neutral-700">{tech.requestedBy || 'Nhân viên'}</strong></span>
                          <span>{tech.requestedAt ? new Date(tech.requestedAt).toLocaleDateString('vi-VN') : ''}</span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleRejectTechRequest(tech)}
                            className="flex-1 py-1.5 px-3 bg-neutral-100 hover:bg-rose-50 text-neutral-700 hover:text-rose-700 border border-neutral-200 hover:border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Từ Chối</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveTechRequest(tech)}
                            className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Phê Duyệt Ngay</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Master List Section */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={techSearchTerm}
                      onChange={(e) => setTechSearchTerm(e.target.value)}
                      placeholder="Tìm theo tên, mã KTV, SĐT..."
                      className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:border-indigo-600 focus:bg-white outline-none"
                    />
                    {techSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setTechSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
                    {(['all', 'active', 'pending', 'rejected'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setTechFilterStatus(st)}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                          techFilterStatus === st
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                        }`}
                      >
                        {st === 'all' && `Tất cả (${technicians.length})`}
                        {st === 'active' && `Chính thức (${technicians.filter((t) => t.status === 'active').length})`}
                        {st === 'pending' && `Chờ duyệt (${pendingTechCount})`}
                        {st === 'rejected' && `Từ chối (${technicians.filter((t) => t.status === 'rejected').length})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Technicians Table */}
                <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-700 font-bold">
                        <th className="p-3">Mã KTV</th>
                        <th className="p-3">Họ Và Tên</th>
                        <th className="p-3">Bộ Phận / Vị Trí</th>
                        <th className="p-3">Số Điện Thoại</th>
                        <th className="p-3">Trạng Thái</th>
                        <th className="p-3">Ghi Chú</th>
                        <th className="p-3 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredTechnicians.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-neutral-500">
                            Không tìm thấy kỹ thuật viên nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        filteredTechnicians.map((tech) => (
                          <tr key={tech.id} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-neutral-200 text-neutral-900 border border-neutral-300 uppercase">
                                {tech.techId}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-neutral-900">{tech.name}</div>
                              {tech.requestedBy && (
                                <div className="text-[10px] text-neutral-500">
                                  Đề xuất: {tech.requestedBy}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-neutral-700 font-medium">
                              {tech.department || '—'}
                            </td>
                            <td className="p-3 text-neutral-700 font-mono">
                              {tech.phone || '—'}
                            </td>
                            <td className="p-3">
                              {tech.status === 'active' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ Chính thức
                                </span>
                              )}
                              {tech.status === 'pending' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                  Chờ duyệt
                                </span>
                              )}
                              {tech.status === 'rejected' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  Từ chối
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-neutral-600 max-w-xs truncate">
                              {tech.note || '—'}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {tech.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveTechRequest(tech)}
                                    className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                                    title="Phê duyệt KTV này"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTech(tech)}
                                  className="p-1.5 bg-neutral-100 text-neutral-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors cursor-pointer"
                                  title="Chỉnh sửa thông tin KTV"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingTechConfirm(tech)}
                                  className="p-1.5 bg-neutral-100 text-neutral-700 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                                  title="Xóa KTV này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              {/* Header Action Banner */}
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 p-4 sm:p-5 rounded-2xl text-white border border-indigo-700/60 shadow-lg space-y-4">
                {/* Header Title Block */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-indigo-800/60 pb-3.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30 shrink-0 mt-0.5 shadow-xs">
                      <Tags className="w-5 h-5 text-indigo-300" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-black text-sm sm:text-base text-white tracking-wide">
                          Đồng Bộ Danh Mục Tem Kho Cloud (In Tem 3x2)
                        </h4>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          {catalogLabels.length} tem trên Cloud
                        </span>
                      </div>
                      <p className="text-xs text-indigo-200/90 leading-relaxed">
                        Admin xuất bản danh mục linh kiện chuẩn lên Cloud. Toàn bộ máy tính/nhân viên mở link sẽ tự động nhận danh mục này.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Clean Responsive Action Buttons Grid */}
                <input
                  type="file"
                  ref={catalogFileInputRef}
                  onChange={handleUploadNewCatalogFileToCloud}
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  className="hidden"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => catalogFileInputRef.current?.click()}
                    disabled={isSyncingCatalog}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md border border-emerald-400/40 text-center min-h-[42px]"
                    title="Tải file Excel tem mới (.xlsx, .xls, .csv) và đồng bộ trực tiếp lên Cloud Catalog"
                  >
                    <UploadCloud className={`w-4 h-4 shrink-0 ${isSyncingCatalog ? 'animate-bounce' : ''}`} />
                    <span className="text-center leading-tight text-[11px] sm:text-xs min-w-0">Tải file tem mới lên Cloud</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeduplicateWorkspace}
                    disabled={currentLabelItems.length === 0 || isSyncingCatalog}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-300 hover:text-amber-200 font-bold text-xs rounded-xl transition-all cursor-pointer border border-amber-400/30 shadow-xs text-center min-h-[42px]"
                    title="Loại bỏ toàn bộ tem trùng mã hoặc trùng tên trên bàn làm việc"
                  >
                    <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-center leading-tight text-[11px] sm:text-xs min-w-0">Lọc sạch tem trùng lặp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncCurrentLabelsToCloud}
                    disabled={isSyncingCatalog}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md border border-indigo-400/40 text-center min-h-[42px]"
                    title="Đẩy tất cả tem đang có trên bàn làm việc in tem lên Cloud"
                  >
                    <UploadCloud className={`w-4 h-4 shrink-0 ${isSyncingCatalog ? 'animate-bounce' : ''}`} />
                    <span className="text-center leading-tight text-[11px] sm:text-xs min-w-0">
                      {catalogSyncProgress && isSyncingCatalog
                        ? `Đang đẩy: ${catalogSyncProgress.synced}/${catalogSyncProgress.total}...`
                        : `Đẩy ${currentLabelItems.length} tem lên Cloud`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyCatalogToWorkspace}
                    disabled={catalogLabels.length === 0 || isSyncingCatalog}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md border border-teal-400/40 text-center min-h-[42px]"
                    title="Tải toàn bộ tem từ Cloud vào bàn làm việc in tem"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span className="text-center leading-tight text-[11px] sm:text-xs min-w-0">Tải {catalogLabels.length} tem về làm việc</span>
                  </button>

                  {catalogLabels.length > 0 && (
                    <button
                      type="button"
                      onClick={handleOpenClearAllCatalog}
                      disabled={isSyncingCatalog}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 bg-rose-950/80 hover:bg-rose-900 disabled:opacity-40 text-rose-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer border border-rose-800/50 shadow-xs text-center min-h-[42px]"
                      title="Xóa sạch danh mục tem trên Cloud"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="text-center leading-tight text-[11px] sm:text-xs min-w-0">
                        {isSyncingCatalog && catalogSyncProgress ? 'Đang xử lý...' : 'Xóa sạch Cloud'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search & Info bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catalogSearchTerm}
                    onChange={(e) => setCatalogSearchTerm(e.target.value)}
                    placeholder="Tìm tem Cloud theo mã, tên linh kiện, model, phân loại, vị trí..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs focus:border-indigo-600 outline-none"
                  />
                </div>
                <div className="text-xs text-neutral-500 flex items-center gap-2 font-medium">
                  <span>Bàn làm việc: <strong>{currentLabelItems.length}</strong> tem</span>
                  <span>•</span>
                  <span>Cloud Database: <strong>{catalogLabels.length}</strong> tem</span>
                </div>
              </div>

              {/* Catalog Table */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-100/80 text-neutral-600 font-bold border-b border-neutral-200">
                      <th className="py-2.5 px-3">Mã Linh Kiện</th>
                      <th className="py-2.5 px-3">Tên Linh Kiện</th>
                      <th className="py-2.5 px-3">Model / Dòng máy</th>
                      <th className="py-2.5 px-3">Phân loại</th>
                      <th className="py-2.5 px-3">Vị trí kệ</th>
                      <th className="py-2.5 px-3 text-center">SL</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {catalogLabels.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-neutral-400">
                          <div className="flex flex-col items-center gap-2">
                            <Tags className="w-8 h-8 text-neutral-300" />
                            <p className="font-semibold text-neutral-600">Chưa có tem nào được lưu trên Cloud Catalog</p>
                            <p className="text-[11px] text-neutral-400 max-w-sm">
                              Hãy nhấn nút <strong>"Đẩy {currentLabelItems.length} tem bàn làm việc lên Cloud"</strong> ở trên để lưu trữ danh mục linh kiện mẫu chuẩn cho toàn bộ nhân viên.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      catalogLabels
                        .filter((item) => {
                          if (!catalogSearchTerm.trim()) return true;
                          const term = catalogSearchTerm.toLowerCase();
                          return (
                            item.code.toLowerCase().includes(term) ||
                            item.name.toLowerCase().includes(term) ||
                            (item.model && item.model.toLowerCase().includes(term)) ||
                            (item.category && item.category.toLowerCase().includes(term)) ||
                            (item.location && item.location.toLowerCase().includes(term))
                          );
                        })
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-indigo-50/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-950">
                              {item.code || '-'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-neutral-900">
                              {item.name || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-neutral-600">
                              {item.model || '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {item.category ? (
                                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-[10px] font-bold">
                                  {item.category}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                              {item.location || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              {item.quantity || 1}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteCatalogItem(item)}
                                className="p-1 rounded hover:bg-rose-50 text-neutral-400 hover:text-rose-600 cursor-pointer transition-colors"
                                title="Xóa tem này khỏi Cloud"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: USER LINK & APP PACKAGING GUIDE */}
          {activeTab === 'links' && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 text-xs text-indigo-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-indigo-900 text-sm">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>Quản Lý Đường Dẫn & Hướng Dẫn Đóng Gói Desktop App</span>
                </div>
                <p className="text-indigo-800 leading-relaxed">
                  Cung cấp đường dẫn ứng dụng cho nhân sự hoặc thực thi đóng gói lại phần mềm thành file chạy độc lập cho Windows (.exe) và Linux (.AppImage) với đầy đủ cấu hình bảo mật Cloud mới nhất.
                </p>
              </div>

              {/* Active Direct Live URL Card */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 rounded-2xl text-white space-y-3 shadow-md border border-emerald-500/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm sm:text-base text-white">Link Trực Tiếp Đang Chạy (Live Development Link)</h4>
                      <span className="text-[11px] text-emerald-300 font-semibold">
                        🟢 Đang hoạt động ngay lập tức - Mở được ngay trên mọi trình duyệt
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/50 border border-emerald-500/30 p-2 rounded-xl">
                  <input
                    type="text"
                    readOnly
                    value={DEV_APP_URL}
                    className="w-full bg-transparent text-xs text-emerald-200 font-mono outline-none px-2 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(DEV_APP_URL);
                      onShowToast('Đã sao chép Link trực tiếp!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </button>

                  <a
                    href={DEV_APP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Mở trong tab mới"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Public Shared URL Card & Activation Guide */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl text-white space-y-3 shadow-md border border-indigo-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-indigo-300" />
                    <h4 className="font-black text-sm sm:text-base">Link Chia Sẻ Công Khai (Shared App Link)</h4>
                  </div>
                </div>

                <p className="text-xs text-indigo-200 leading-relaxed">
                  Để kích hoạt link chia sẻ công khai cho nhân viên mà không cần tài khoản AI Studio:
                  <br />
                  👉 Nhấn nút <strong>"Share" (Chia sẻ)</strong> hoặc <strong>"Deploy"</strong> ở góc trên bên phải màn hình AI Studio.
                </p>

                <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-2 rounded-xl">
                  <input
                    type="text"
                    readOnly
                    value={SHARED_APP_URL}
                    className="w-full bg-transparent text-xs text-white font-mono outline-none px-2 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Đã sao chép' : 'Sao chép Link'}</span>
                  </button>
                </div>
              </div>

              {/* Live OTA Version Publishing Management Card */}
              <div className="p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-indigo-800 text-white space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3">
                  <div className="flex items-center gap-2 font-black text-sm text-amber-300">
                    <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
                    <span>Phát Hành Cập Nhật Trực Tuyến Tức Thì (Live Windows OTA Update)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                    Cloud Firestore Real-time
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Khi bạn phát hành phiên bản mới ở đây, <strong>mọi ứng dụng Windows đóng gói .exe & Web client</strong> đang mở trên các máy tính nhân viên sẽ <strong>lập tức nhận được thông báo cập nhật nổi (Notification Bar)</strong> kèm ghi chú và nút "Cập Nhật Ngay"!
                </p>

                <form onSubmit={handlePublishNewVersion} className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Số Phiên Bản Mới (Version):
                      </label>
                      <input
                        type="text"
                        value={publishVersion}
                        onChange={(e) => setPublishVersion(e.target.value)}
                        placeholder="2.5.3"
                        className="w-full bg-slate-800/90 border border-slate-700 text-amber-300 font-mono font-bold text-xs rounded-lg px-3 py-2 outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Mã Nhận Diện Build (Build ID):
                      </label>
                      <input
                        type="text"
                        value={publishBuildId}
                        onChange={(e) => setPublishBuildId(e.target.value)}
                        placeholder="build-v253-win-release"
                        className="w-full bg-slate-800/90 border border-slate-700 text-sky-300 font-mono font-bold text-xs rounded-lg px-3 py-2 outline-none focus:border-sky-400"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Ghi Chú Bản Cập Nhật (Release Notes):
                    </label>
                    <textarea
                      rows={2}
                      value={publishReleaseNotes}
                      onChange={(e) => setPublishReleaseNotes(e.target.value)}
                      placeholder="Mô tả các tính năng mới hoặc sửa lỗi trong bản cập nhật này..."
                      className="w-full bg-slate-800/90 border border-slate-700 text-slate-200 text-xs rounded-lg p-2.5 outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Link Tải File Cài Đặt Windows .exe (Tùy chọn - Direct Download Link):
                    </label>
                    <input
                      type="url"
                      value={publishWinUrl}
                      onChange={(e) => setPublishWinUrl(e.target.value)}
                      placeholder="https://example.com/OPPO-Label-Studio-Setup-2.5.3.exe"
                      className="w-full bg-slate-800/90 border border-slate-700 text-emerald-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPublishingVersion}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Zap className={`w-4 h-4 fill-current ${isPublishingVersion ? 'animate-spin' : ''}`} />
                    <span>{isPublishingVersion ? 'Đang Phát Hành Cập Nhật...' : '🚀 PHÁT HÀNH BẢN CẬP NHẬT TỚI TOÀN BỘ MÁY WINDOWS'}</span>
                  </button>
                </form>
              </div>

              {/* Packaging update guide */}
              <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                  <div className="flex items-center gap-2 text-neutral-900 font-black text-sm">
                    <Package className="w-5 h-5 text-indigo-600" />
                    <span>Hướng Dẫn Đóng Gói & Cập Nhật Ứng Dụng Đã Tạo Trước Đó</span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                    Electron & PWA
                  </span>
                </div>

                <div className="space-y-4 text-xs text-neutral-700 leading-relaxed">
                  {/* OPTION 1: PWA */}
                  <div className="p-4 bg-white rounded-xl border border-neutral-200 space-y-2 shadow-2xs">
                    <div className="font-bold text-neutral-900 text-xs flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                        1
                      </span>
                      <span className="text-sm font-bold text-indigo-900">
                        Phương Án 1: Chạy Trực Tiếp Web / PWA (Khuyên Dùng - Tự Động Cập Nhật 100%)
                      </span>
                    </div>
                    <p className="text-neutral-600 text-xs pl-8 leading-relaxed">
                      Gửi đường dẫn <strong>{SHARED_APP_URL}</strong> cho nhân viên. Người dùng chỉ cần mở bằng Chrome hoặc Microsoft Edge, sau đó nhấn vào biểu tượng <strong>"Cài đặt ứng dụng" (Install PWA)</strong> trên thanh địa chỉ để ghim phần mềm ra màn hình chính (Desktop).
                      <br />
                      <span className="text-emerald-700 font-semibold inline-block mt-1">
                        ✓ Ưu điểm: Tự động đồng bộ mọi cập nhật mã nguồn & tính năng mới từ Cloud mà không cần đóng gói lại file.
                      </span>
                    </p>
                  </div>

                  {/* OPTION 2: WINDOWS PACKAGING */}
                  <div className="p-4 bg-white rounded-xl border border-neutral-200 space-y-3 shadow-2xs">
                    <div className="font-bold text-neutral-900 text-xs flex items-center gap-2 border-b border-neutral-100 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                        2
                      </span>
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-neutral-900">
                          Phương Án 2: Đóng Gói Cho Máy Tính Windows (.exe Installer & Portable)
                        </span>
                      </div>
                    </div>

                    <div className="pl-8 space-y-2 text-xs">
                      <p className="text-neutral-700">
                        Mở Terminal hoặc Command Prompt tại thư mục dự án trên máy Windows của bạn và thực thi:
                      </p>

                      <div className="bg-neutral-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto space-y-1">
                        <div className="text-slate-400"># Bước 1: Build mã nguồn frontend & server mới nhất</div>
                        <div>npm run build</div>
                        <br />
                        <div className="text-slate-400"># Bước 2: Đóng gói ra bộ cài Windows .exe (NSIS Installer & Portable)</div>
                        <div>npm run dist:win</div>
                      </div>

                      <div className="space-y-1.5 pt-1 text-[11px]">
                        <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Kết quả thu được trong thư mục <code>release/</code>:</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-1 text-neutral-600">
                          <li>
                            <strong className="text-neutral-800 font-mono">OPPO Label Studio Setup 1.0.0.exe</strong> (Bộ cài đặt tự động tạo Shortcut trên Desktop & Start Menu).
                          </li>
                          <li>
                            <strong className="text-neutral-800 font-mono">OPPO Label Studio 1.0.0.exe</strong> (Phiên bản Portable - Nhấp đúp chạy ngay không cần cài đặt).
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* OPTION 3: LINUX PACKAGING */}
                  <div className="p-4 bg-white rounded-xl border border-neutral-200 space-y-3 shadow-2xs">
                    <div className="font-bold text-neutral-900 text-xs flex items-center gap-2 border-b border-neutral-100 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                        3
                      </span>
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-bold text-neutral-900">
                          Phương Án 3: Đóng Gói Cho Linux Desktop (.AppImage / Ubuntu / Debian / Mint / Arch)
                        </span>
                      </div>
                    </div>

                    <div className="pl-8 space-y-2 text-xs">
                      <p className="text-neutral-700">
                        Mở Terminal tại thư mục dự án trên hệ điều hành Linux và thực thi:
                      </p>

                      <div className="bg-neutral-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto space-y-1">
                        <div className="text-slate-400"># Cách 1 (Khuyên dùng): Chạy script đóng gói tự động</div>
                        <div>npm run build:linux</div>
                        <div className="text-slate-400 mt-1"># (Hoặc lệnh tương đương: npm run dist:linux hoặc ./build-appimage.sh)</div>
                      </div>

                      <div className="space-y-1.5 pt-1 text-[11px]">
                        <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Cấp quyền và chạy ứng dụng trên Linux:</span>
                        </div>
                        <div className="bg-neutral-100 p-2 rounded-lg font-mono text-[11px] text-neutral-800">
                          chmod +x release/*.AppImage && ./release/*.AppImage
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECURITY NOTICE */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-950">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Lưu Ý Bảo Mật Quan Trọng Khi Đóng Gói Lại:</span>
                    </div>
                    <p className="leading-relaxed text-amber-800">
                      Mọi bản build đóng gói mới từ lần này sẽ <strong>loại bỏ hoàn toàn tài khoản demo `admin123` và nút 1-Click</strong>. Người dùng sẽ bắt buộc phải xác thực bằng tài khoản hợp lệ đã được Admin phê duyệt hoặc Mã PIN Quản Trị Viên mới có thể mở khóa hệ thống.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-bold text-neutral-900 text-sm">Nhật Ký Thao Tác (Audit Trail)</h4>
                <p className="text-xs text-neutral-500">
                  Ghi nhận mọi thao tác: Tạo phiếu, Duyệt user, Xin linh kiện, Nhập kho, Gọi khách hàng theo thời gian thực.
                </p>
              </div>

              <div className="space-y-2">
                {activityLogs.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-500">
                    Chưa có nhật ký nào được ghi nhận gần đây. Mọi thay đổi về trạng thái phiếu và phê duyệt sẽ tự động hiển thị ở đây.
                  </div>
                ) : (
                  activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-white rounded-xl border border-neutral-200 text-xs flex items-center justify-between gap-3 hover:bg-neutral-50/50"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900">{log.userName}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {log.action}
                          </span>
                          {log.ticketNumber && (
                            <span className="font-mono font-bold text-[11px] bg-neutral-900 text-white px-1.5 py-0.2 rounded">
                              {log.ticketNumber}
                            </span>
                          )}
                        </div>
                        {log.details && (
                          <div className="text-[11px] text-neutral-600">
                            {log.details}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0 text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-300" />
                        <span>{log.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: USER PROFILE / IDENTITY */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
              <div>
                <h4 className="font-bold text-neutral-900 text-sm">Cài đặt danh tính tài khoản của bạn</h4>
                <p className="text-xs text-neutral-500">
                  Thông tin này sẽ được lưu trên máy của bạn và gửi lên hệ thống Cloud để nhận diện nhân sự.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Tên hiển thị (Họ và Tên):
                </label>
                <input
                  type="text"
                  required
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                  placeholder="VD: Nguyễn Văn Tuấn (Kỹ Thuật)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Tên truy cập (Username / Mã nhân viên):
                </label>
                <input
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-indigo-950 focus:bg-white focus:border-indigo-600 outline-none"
                  placeholder="VD: oppo_sg_01"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Vai trò trong hệ thống:
                </label>
                <select
                  value={inputRole}
                  onChange={(e) => setInputRole(e.target.value as 'admin' | 'staff')}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-900 focus:border-indigo-600 outline-none"
                >
                  <option value="admin">Quản trị viên (Admin) - Toàn quyền phê duyệt & quản lý</option>
                  <option value="staff">Kỹ thuật viên / Kho (Staff) - Đặt chờ linh kiện & In tem</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Lưu Danh Tính
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: FREE TIER & QUOTA EXPLANATION */}
          {activeTab === 'quota' && (
            <div className="space-y-4 text-xs text-neutral-700">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Dung lượng Miễn phí Vĩnh viễn (Firebase Spark Plan)</span>
                </div>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  Google Cloud cung cấp gói miễn phí vĩnh viễn (Free Tier) hoàn toàn đủ cho nhu cầu hoạt động của trung tâm bảo hành và cửa hàng với dưới 10 nhân sự:
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="text-[11px] font-semibold text-neutral-500">Lượt đọc / xem dữ liệu</div>
                  <div className="text-xl font-black text-neutral-900 mt-1">50,000 / ngày</div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Miễn phí 100%</div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="text-[11px] font-semibold text-neutral-500">Lượt ghi / tạo / sửa phiếu</div>
                  <div className="text-xl font-black text-neutral-900 mt-1">20,000 / ngày</div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Miễn phí 100%</div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="text-[11px] font-semibold text-neutral-500">Dung lượng lưu trữ</div>
                  <div className="text-xl font-black text-neutral-900 mt-1">1 GB Data</div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Đủ &gt; 100.000 phiếu</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-neutral-500 flex items-center gap-1.5 text-[11px]">
            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
            <span>Trạng thái Cloud: <strong>Đã kết nối & Đồng bộ trực tiếp</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* EDIT USER POPUP MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
              <h4 className="font-black text-sm text-neutral-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>Chỉnh Sửa Quyền & Tên Truy Cập User</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Tên hiển thị:</label>
                <input
                  type="text"
                  required
                  value={editFormName}
                  onChange={(e) => setEditFormName(e.target.value)}
                  className="w-full p-2 border border-neutral-300 rounded font-semibold focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Tên truy cập (Username / Mã NV):</label>
                <input
                  type="text"
                  required
                  value={editFormUsername}
                  onChange={(e) => setEditFormUsername(e.target.value)}
                  className="w-full p-2 border border-neutral-300 rounded font-mono font-bold text-indigo-950 focus:border-indigo-600 outline-none"
                  placeholder="VD: nv_kho_01"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1 flex items-center justify-between">
                  <span>Mật khẩu tài khoản (Đổi / Đặt lại):</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Bắt buộc &gt;= 4 ký tự</span>
                </label>
                <input
                  type="text"
                  value={editFormPassword}
                  onChange={(e) => setEditFormPassword(e.target.value)}
                  className="w-full p-2 border border-neutral-300 rounded font-mono font-semibold text-neutral-900 focus:border-indigo-600 outline-none bg-amber-50/50"
                  placeholder="Nhập mật khẩu mới cho user..."
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Vai trò:</label>
                <select
                  value={editFormRole}
                  onChange={(e) => setEditFormRole(e.target.value as 'admin' | 'staff')}
                  className="w-full p-2 border border-neutral-300 rounded font-semibold focus:border-indigo-600 outline-none"
                >
                  <option value="staff">Kỹ thuật viên / Kho (Staff)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Trạng thái phê duyệt:</label>
                <select
                  value={editFormStatus}
                  onChange={(e) => setEditFormStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
                  className="w-full p-2 border border-neutral-300 rounded font-semibold focus:border-indigo-600 outline-none"
                >
                  <option value="approved">✅ Đã phê duyệt (Cho phép truy cập)</option>
                  <option value="pending">⏳ Chờ duyệt (Tạm giữ)</option>
                  <option value="rejected">⛔ Từ chối / Khóa truy cập</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded cursor-pointer shadow-xs"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete User Confirmation Modal */}
      {deletingUserConfirm && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 animate-in zoom-in-95 duration-150 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-bold text-neutral-900 text-base">Xác Nhận Xóa Tài Khoản</h4>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản{' '}
                <strong className="text-neutral-900 font-bold">
                  {deletingUserConfirm.displayName || deletingUserConfirm.uid}
                </strong>{' '}
                ({deletingUserConfirm.username ? `@${deletingUserConfirm.username}` : deletingUserConfirm.uid})?
              </p>
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                Người dùng này sẽ bị hủy quyền truy cập ngay lập tức.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeletingUserConfirm(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Catalog Confirmation Modal */}
      {isConfirmClearCatalogModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 animate-in zoom-in-95 duration-150 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-bold text-neutral-900 text-base">Cảnh Báo: Xóa Sạch Cloud</h4>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Bạn có chắc chắn muốn xóa <strong className="text-rose-600 font-bold">TOÀN BỘ {catalogLabels.length} tem linh kiện</strong> mẫu trên cơ sở dữ liệu Cloud không?
              </p>
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                Hành động này sẽ xóa vĩnh viễn trên Cloud và không thể hoàn tác.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsConfirmClearCatalogModalOpen(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAllCatalog}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Xác Nhận Xóa Sạch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Catalog Item Confirmation Modal */}
      {deletingCatalogItemConfirm && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 animate-in zoom-in-95 duration-150 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-bold text-neutral-900 text-base">Xóa Tem Linh Kiện Khỏi Cloud</h4>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Bạn có chắc chắn muốn xóa tem linh kiện{' '}
                <strong className="text-neutral-900 font-bold">
                  {deletingCatalogItemConfirm.name}
                </strong>{' '}
                ({deletingCatalogItemConfirm.code || deletingCatalogItemConfirm.id}) khỏi Cloud?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeletingCatalogItemConfirm(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCatalogItem}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Xóa Tem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Technician Modal */}
      {isAddTechModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm">
                  {editingTech ? 'Chỉnh Sửa Kỹ Thuật Viên' : 'Thêm Kỹ Thuật Viên Mới'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTechModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTechForm} className="p-4 sm:p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Tên Kỹ Thuật Viên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={techFormName}
                  onChange={(e) => setTechFormName(e.target.value)}
                  placeholder="VD: VÕ TẤN ĐẠT, CX Huy..."
                  className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Mã / ID Kỹ Thuật <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={techFormId}
                    onChange={(e) => setTechFormId(e.target.value)}
                    placeholder="VD: KTV01, CX01..."
                    className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs font-bold text-indigo-700 uppercase font-mono focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Số Điện Thoại
                  </label>
                  <input
                    type="text"
                    value={techFormPhone}
                    onChange={(e) => setTechFormPhone(e.target.value)}
                    placeholder="VD: 0901234567"
                    className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Bộ Phận / Vị Trí
                  </label>
                  <input
                    type="text"
                    value={techFormDept}
                    onChange={(e) => setTechFormDept(e.target.value)}
                    placeholder="VD: Kỹ thuật phần cứng, CS..."
                    className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Trạng Thái
                  </label>
                  <select
                    value={techFormStatus}
                    onChange={(e) => setTechFormStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs font-semibold focus:border-indigo-600 outline-none bg-white"
                  >
                    <option value="active">Chính thức (Active)</option>
                    <option value="pending">Chờ duyệt (Pending)</option>
                    <option value="rejected">Từ chối (Rejected)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Ghi Chú
                </label>
                <textarea
                  rows={2}
                  value={techFormNote}
                  onChange={(e) => setTechFormNote(e.target.value)}
                  placeholder="Ghi chú thêm về KTV..."
                  className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:border-indigo-600 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddTechModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingTech}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingTech && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingTech ? 'Cập Nhật' : 'Lưu KTV'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Technician Confirmation Modal */}
      {deletingTechConfirm && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 animate-in zoom-in-95 duration-150 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-bold text-neutral-900 text-base">Xóa Kỹ Thuật Viên</h4>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Bạn có chắc chắn muốn xóa KTV{' '}
                <strong className="text-neutral-900 font-bold">
                  {deletingTechConfirm.name}
                </strong>{' '}
                ({deletingTechConfirm.techId}) khỏi danh sách hệ thống không?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeletingTechConfirm(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTech}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
