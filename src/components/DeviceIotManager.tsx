import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  DeviceIotBookingItem,
  DeviceIotStatus,
  DeviceIotFlowType,
  DeviceIotCategory,
  DeviceIotCallSubStatus,
  DEVICE_IOT_STATUS_CONFIG,
  DEVICE_IOT_FLOW_CONFIG,
  DEVICE_IOT_CATEGORY_CONFIG,
} from '../types/deviceIot';
import {
  formatDateTimeVi,
  formatDateVi,
  formatLoanTimeVi,
  generateDeviceIotTicketNumber,
  generateLoanTicketNumber,
  exportDeviceIotToExcel,
  downloadSampleDeviceIotExcel,
  parseDeviceIotExcelFile,
} from '../utils/deviceIotHelper';
import { DateTimePicker, formatViDateTime } from './DateTimePicker';
import { generateQrDataUrl } from '../utils/barcodeHelper';
import { PaginationControl } from './PaginationControl';
import { CustomerCallModal, CALL_SUBSTATUS_CONFIG } from './CustomerCallModal';
import { TicketNoteModal } from './TicketNoteModal';
import { ExcelActionMenu } from './ExcelActionMenu';
import { DateRangeFilter, DateFilterState, AvailableMonthItem } from './DateRangeFilter';
import { matchesSmartSearch } from '../utils/searchHelper';
import {
  saveDeviceIotToCloud,
  deleteDeviceIotFromCloud,
  clearAllDeviceIotsFromCloud,
  requestDeviceIotCancel,
  rejectDeviceIotCancel,
  parseDateToMillis,
  pullLatestDeviceIotsFromCloud,
  fetchWarrantyCenters,
  saveWarrantyCenter,
  deleteWarrantyCenter,
  WarrantyCenter,
  DEFAULT_WARRANTY_CENTERS,
} from '../services/firebaseDeviceIotService';
import { parseBackupJson, executeFastRestore } from '../services/backupRestoreService';
import {
  Smartphone,
  Tablet,
  Watch,
  Headphones,
  Radio,
  Cable,
  Boxes,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  PhoneCall,
  CheckCircle2,
  Clock,
  ArrowRight,
  Edit3,
  Edit2,
  StickyNote,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  AlertCircle,
  Tag,
  Hash,
  User,
  Phone,
  FileText,
  FileJson,
  Layers,
  MapPin,
  Calendar,
  X,
  Sparkles,
  Zap,
  ShieldAlert,
  SmartphoneCharging,
  Handshake,
  Receipt,
  CircleDollarSign,
  ArrowRightLeft,
  ShieldCheck,
  Send,
  HelpCircle,
  UserCircle,
  Wrench,
  Printer,
} from 'lucide-react';
import { TechnicianSelector } from './TechnicianSelector';
import { UserSelector } from './UserSelector';
import { subscribeToTechnicians } from '../services/technicianService';
import { TechnicianItem } from '../types/technician';

interface DeviceIotManagerProps {
  activeSubId?: string;
  onSelectSubId?: (id: string) => void;
  bookings: DeviceIotBookingItem[];
  onUpdateBookings: (items: DeviceIotBookingItem[]) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: {
    name?: string;
    role?: string;
    username?: string;
  };
  cloudSynced?: boolean;
  onOpenAdminModal?: () => void;
  onOpenFastBackupRestore?: () => void;
  targetNavigation?: {
    subTab?: string;
    statusFilter?: string;
    searchTerm?: string;
    nonce: number;
  } | null;
}

export const DeviceIotManager: React.FC<DeviceIotManagerProps> = ({
  activeSubId,
  onSelectSubId,
  bookings,
  onUpdateBookings,
  onShowToast,
  currentUser,
  cloudSynced = true,
  onOpenAdminModal,
  onOpenFastBackupRestore,
  targetNavigation,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'filtered' | 'all'>('filtered');
  const [flowFilter, setFlowFilter] = useState<'all' | DeviceIotFlowType>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DeviceIotCategory>('all');

  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    mode: 'all',
    selectedMonth: '',
    startDate: '',
    endDate: '',
  });

  // Calculate available months with ticket creation counts
  const availableMonths = useMemo<AvailableMonthItem[]>(() => {
    const monthMap = new Map<string, { key: string; label: string; count: number; year: number; month: number }>();
    bookings.forEach((b) => {
      const ts = parseDateToMillis(b.bookingDate || b.createdAt || b.updatedAt);
      if (!ts) return;
      const dt = new Date(ts);
      const year = dt.getFullYear();
      const month = dt.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const label = `Tháng ${String(month).padStart(2, '0')}/${year}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { key, label, count: 0, year, month });
      }
      monthMap.get(key)!.count += 1;
    });
    return Array.from(monthMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [bookings]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, flowFilter, statusFilter, categoryFilter, dateFilter, pageSize]);

  // Deep Navigation effect from System Notification Center (Bell)
  useEffect(() => {
    if (!targetNavigation || !targetNavigation.nonce) return;
    const { statusFilter: targetStatus, searchTerm: targetSearch } = targetNavigation;
    if (targetStatus) {
      setStatusFilter(targetStatus);
    }
    if (targetSearch) {
      setSearchTerm(targetSearch);
    }
    setDateFilter({ mode: 'all', selectedMonth: '', startDate: '', endDate: '' });
    setCurrentPage(1);
    if (targetSearch) {
      onShowToast(`Đang lọc máy/IoT: ${targetSearch}`, 'info');
    }
  }, [targetNavigation]);

  // Master Technicians from Firestore
  const [masterTechnicians, setMasterTechnicians] = useState<TechnicianItem[]>([]);
  useEffect(() => {
    const unsub = subscribeToTechnicians((list) => {
      setMasterTechnicians(list);
    });
    return () => unsub();
  }, []);

  // Warranty Centers list & selection state
  const [warrantyCenters, setWarrantyCenters] = useState<WarrantyCenter[]>(DEFAULT_WARRANTY_CENTERS);
  const [isCenterManagerOpen, setIsCenterManagerOpen] = useState(false);
  const [newCenterName, setNewCenterName] = useState('');
  const [newCenterPhone, setNewCenterPhone] = useState('');
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  const [modalQrSrc, setModalQrSrc] = useState<string>('');

  useEffect(() => {
    fetchWarrantyCenters().then((list) => {
      if (list && list.length > 0) {
        setWarrantyCenters(list);
      }
    });
  }, []);

  const handleSaveCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCenterName.trim() || !newCenterPhone.trim()) {
      onShowToast('Vui lòng nhập đầy đủ tên và số điện thoại', 'error');
      return;
    }
    const centerId = editingCenterId || `center_${Date.now()}`;
    const newCenter: WarrantyCenter = {
      id: centerId,
      name: newCenterName.trim(),
      phone: newCenterPhone.trim(),
    };

    try {
      await saveWarrantyCenter(newCenter);
      const updatedList = await fetchWarrantyCenters();
      setWarrantyCenters(updatedList);
      onShowToast(editingCenterId ? 'Đã cập nhật TTBH thành công' : 'Đã thêm TTBH mới thành công', 'success');
      setNewCenterName('');
      setNewCenterPhone('');
      setEditingCenterId(null);
    } catch (err) {
      onShowToast('Không thể lưu thông tin trung tâm bảo hành', 'error');
    }
  };

  const handleDeleteCenter = async (id: string) => {
    if (id === 'default-oppo') {
      onShowToast('Không thể xóa trung tâm bảo hành mặc định', 'error');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa trung tâm bảo hành này?')) return;
    try {
      await deleteWarrantyCenter(id);
      const updatedList = await fetchWarrantyCenters();
      setWarrantyCenters(updatedList);
      onShowToast('Đã xóa TTBH thành công', 'success');
    } catch (err) {
      onShowToast('Không thể xóa trung tâm bảo hành', 'error');
    }
  };

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeviceIotBookingItem | null>(null);
  const [isLoanAgreementModalOpen, setIsLoanAgreementModalOpen] = useState(false);
  const [selectedLoanItem, setSelectedLoanItem] = useState<DeviceIotBookingItem | null>(null);

  useEffect(() => {
    if (selectedLoanItem?.ticketNumber) {
      generateQrDataUrl(selectedLoanItem.ticketNumber, 120)
        .then((url) => setModalQrSrc(url))
        .catch(() => setModalQrSrc(''));
    } else {
      setModalQrSrc('');
    }
  }, [selectedLoanItem]);
  
  // Step Modals
  const [requestingItem, setRequestingItem] = useState<DeviceIotBookingItem | null>(null);
  const [requestDate, setRequestDate] = useState('');
  const [requestNote, setRequestNote] = useState('');

  const [stockingItem, setStockingItem] = useState<DeviceIotBookingItem | null>(null);
  const [stockDate, setStockDate] = useState('');
  const [stockLocation, setStockLocation] = useState('');
  const [stockNote, setStockNote] = useState('');

  const [callingItem, setCallingItem] = useState<DeviceIotBookingItem | null>(null);

  // Ticket Note Modal State (All users can add, edit, delete note)
  const [noteModalItem, setNoteModalItem] = useState<DeviceIotBookingItem | null>(null);
  const [noteModalMode, setNoteModalMode] = useState<'edit' | 'append' | 'add'>('edit');

  const [completingItem, setCompletingItem] = useState<DeviceIotBookingItem | null>(null);
  const [customerArrivedDate, setCustomerArrivedDate] = useState('');
  const [technicianName, setTechnicianName] = useState(currentUser?.name || '');
  const [completionNote, setCompletionNote] = useState('');

  const [returningItem, setReturningItem] = useState<DeviceIotBookingItem | null>(null);
  const [returnDate, setReturnDate] = useState('');
  const [returnReceivedBy, setReturnReceivedBy] = useState(currentUser?.name || '');
  const [returnCondition, setReturnCondition] = useState('');
  const [returnNote, setReturnNote] = useState('');

  // Delete & Cancellation Request State
  const [deletingBookingConfirm, setDeletingBookingConfirm] = useState<DeviceIotBookingItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearAllConfirmModal, setShowClearAllConfirmModal] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const [cancelRequestModalItem, setCancelRequestModalItem] = useState<DeviceIotBookingItem | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Form states for Create/Edit
  const [formData, setFormData] = useState<Partial<DeviceIotBookingItem>>({
    flowType: 'direct_exchange',
    deviceCategory: 'phone',
    deviceModel: '',
    deviceName: '',
    skuCode: '',
    imeiOrIot: '',
    customerName: '',
    customerPhone: '',
    creatorTechnician: '',
    technicianName: '',
    createdBy: '',
    location: '',
    note: '',
    bookingDate: formatViDateTime(),
    requestedDate: '',
    stockedInDate: '',
    calledCustomerDate: '',
    appointmentDate: '',
    customerArrivedDate: '',
    hasDeposit: false,
    depositType: 'khong_coc',
    depositAmount: 0,
    borrowedDate: '',
    returnedDate: '',
    loanCondition: '',
    loanAccessories: '',
    loanHandoverBy: '',
    loanReceivedBy: '',
  });

  // Copy state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    onShowToast(`Đã sao chép ${label}: ${text}`, 'success');
    setTimeout(() => setCopiedText(null), 2000);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = bookings.length;
    const directExchangeCount = bookings.filter((b) => b.flowType === 'direct_exchange').length;
    const requestDeviceCount = bookings.filter((b) => b.flowType === 'request_device').length;
    const customerLoanCount = bookings.filter((b) => b.flowType === 'customer_loan').length;

    const coSanMay = bookings.filter((b) => b.status === 'co_san_may').length;
    const choXinMay = bookings.filter((b) => b.status === 'cho_xin_may').length;
    const daXinMay = bookings.filter((b) => b.status === 'da_xin_may').length;
    const daNhapKho = bookings.filter((b) => b.status === 'da_nhap_kho').length;
    const daGoiKh = bookings.filter((b) => b.status === 'da_goi_kh').length;
    const daHoanTat = bookings.filter((b) => b.status === 'da_hoan_tat').length;
    const dangMuon = bookings.filter((b) => b.status === 'dang_muon').length;
    const daTra = bookings.filter((b) => b.status === 'da_tra').length;

    const cancelRequestsCount = bookings.filter((b) => Boolean(b.cancelRequested)).length;
    const activeTickets = bookings.filter((b) => b.status !== 'da_hoan_tat' && b.status !== 'da_tra').length;

    return {
      total,
      directExchangeCount,
      requestDeviceCount,
      customerLoanCount,
      coSanMay,
      choXinMay,
      daXinMay,
      daNhapKho,
      daGoiKh,
      daHoanTat,
      dangMuon,
      daTra,
      cancelRequestsCount,
      activeTickets,
    };
  }, [bookings]);

  // Match helper for Device/IOT items
  const matchDeviceIotSearch = useCallback((item: DeviceIotBookingItem, term: string): boolean => {
    if (!term) return true;
    const creatorText = item.createdBy ? `Người tạo: ${item.createdBy} Tạo bởi: ${item.createdBy} User tạo: ${item.createdBy}` : '';
    const creatorTechText = item.creatorTechnician ? `Kỹ thuật tạo: ${item.creatorTechnician} KTV tạo: ${item.creatorTechnician} KT tạo: ${item.creatorTechnician} Kỹ thuật viên tạo: ${item.creatorTechnician}` : '';
    const repairTechText = item.technicianName ? `Kỹ thuật sửa: ${item.technicianName} KTV sửa: ${item.technicianName} KT sửa: ${item.technicianName} Kỹ thuật viên sửa: ${item.technicianName} Kỹ thuật xử lý: ${item.technicianName} KTV xử lý: ${item.technicianName} KT xử lý: ${item.technicianName}` : '';
    const loanHandoverText = item.loanHandoverBy ? `KTV giao máy: ${item.loanHandoverBy} Bàn giao: ${item.loanHandoverBy}` : '';
    const loanReceivedText = item.loanReceivedBy ? `KTV nhận máy: ${item.loanReceivedBy} Nhận máy: ${item.loanReceivedBy}` : '';

    return matchesSmartSearch(term, [
      item.ticketNumber,
      item.customerName,
      item.customerPhone,
      item.deviceModel,
      item.deviceName,
      item.skuCode,
      item.imeiOrIot,
      item.location,
      item.note,
      item.createdBy,
      creatorText,
      item.creatorTechnician,
      creatorTechText,
      item.technicianName,
      repairTechText,
      item.loanHandoverBy,
      loanHandoverText,
      item.loanReceivedBy,
      loanReceivedText,
      item.closureBy,
      item.cancelReason,
      item.cancelRequestedBy,
    ]);
  }, []);

  // Global search match count across all Device/IOT tickets
  const globalSearchMatchesCount = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return 0;
    return bookings.filter((item) => matchDeviceIotSearch(item, term)).length;
  }, [bookings, searchTerm, matchDeviceIotSearch]);

  // Check if an active filter is applied
  const isFilterScopeActive = useMemo(() => {
    return (
      statusFilter !== 'all' ||
      flowFilter !== 'all' ||
      categoryFilter !== 'all' ||
      dateFilter.mode !== 'all'
    );
  }, [statusFilter, flowFilter, categoryFilter, dateFilter.mode]);

  // Filtered List
  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim();

    return bookings.filter((item) => {
      // 1. Search query
      if (term && !matchDeviceIotSearch(item, term)) {
        return false;
      }

      // 2. Global search bypass if user selected 'all' scope
      if (term && searchScope === 'all') {
        return true;
      }

      // 3. Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'cancel_requested') {
          if (!item.cancelRequested) return false;
        } else if (statusFilter === 'active') {
          if (item.status === 'da_hoan_tat' || item.status === 'da_tra') return false;
        } else if (item.status !== statusFilter) {
          return false;
        }
      }

      // 4. Flow filter
      if (flowFilter !== 'all' && item.flowType !== flowFilter) {
        return false;
      }

      // 5. Category filter
      if (categoryFilter !== 'all' && item.deviceCategory !== categoryFilter) {
        return false;
      }

      // 6. Date Filter (Lọc theo từng tháng hoặc chọn khoảng ngày)
      if (dateFilter.mode !== 'all') {
        const ts = parseDateToMillis(item.bookingDate || item.createdAt || item.updatedAt);
        if (!ts) return false;
        const dt = new Date(ts);
        const itemYear = dt.getFullYear();
        const itemMonth = dt.getMonth() + 1;
        const itemDate = dt.getDate();
        const itemDateStr = `${itemYear}-${String(itemMonth).padStart(2, '0')}-${String(itemDate).padStart(2, '0')}`;
        const itemMonthStr = `${itemYear}-${String(itemMonth).padStart(2, '0')}`;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        if (dateFilter.mode === 'month') {
          if (dateFilter.selectedMonth && itemMonthStr !== dateFilter.selectedMonth) {
            return false;
          }
        } else if (dateFilter.mode === 'this_month') {
          const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          if (itemMonthStr !== currentMonthStr) return false;
        } else if (dateFilter.mode === 'last_month') {
          const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
          if (itemMonthStr !== lastMonthStr) return false;
        } else if (dateFilter.mode === 'today') {
          if (itemDateStr !== todayStr) return false;
        } else if (dateFilter.mode === 'yesterday') {
          const yest = new Date(now);
          yest.setDate(yest.getDate() - 1);
          const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
          if (itemDateStr !== yestStr) return false;
        } else if (dateFilter.mode === 'last7days') {
          const limit = new Date(now);
          limit.setDate(limit.getDate() - 7);
          limit.setHours(0, 0, 0, 0);
          if (dt.getTime() < limit.getTime()) return false;
        } else if (dateFilter.mode === 'last30days') {
          const limit = new Date(now);
          limit.setDate(limit.getDate() - 30);
          limit.setHours(0, 0, 0, 0);
          if (dt.getTime() < limit.getTime()) return false;
        } else if (dateFilter.mode === 'custom') {
          if (dateFilter.startDate) {
            const sDt = new Date(`${dateFilter.startDate}T00:00:00`);
            if (!isNaN(sDt.getTime()) && dt.getTime() < sDt.getTime()) return false;
          }
          if (dateFilter.endDate) {
            const eDt = new Date(`${dateFilter.endDate}T23:59:59.999`);
            if (!isNaN(eDt.getTime()) && dt.getTime() > eDt.getTime()) return false;
          }
        }
      }

      return true;
    });
  }, [bookings, searchTerm, searchScope, flowFilter, statusFilter, categoryFilter, dateFilter, matchDeviceIotSearch]);

  // Paginated Device/IOT Bookings
  const totalDeviceIotPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const safeDeviceIotCurrentPage = Math.min(Math.max(1, currentPage), totalDeviceIotPages);
  const paginatedBookings = useMemo(() => {
    const start = (safeDeviceIotCurrentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, safeDeviceIotCurrentPage, pageSize]);

  // STT tính theo thời gian tạo: tạo trước là 1 và tăng dần (2, 3, ...)
  const ticketSttMap = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => {
      const tA = parseDateToMillis(a.bookingDate || a.createdAt || a.updatedAt);
      const tB = parseDateToMillis(b.bookingDate || b.createdAt || b.updatedAt);
      if (tA !== tB) return tA - tB; // Tạo trước là số nhỏ hơn (STT 1, 2, ...)
      const ticketA = (a.ticketNumber || '').trim();
      const ticketB = (b.ticketNumber || '').trim();
      if (ticketA && ticketB && ticketA !== ticketB) {
        return ticketA.localeCompare(ticketB);
      }
      return (a.id || '').localeCompare(b.id || '');
    });

    const map = new Map<string, number>();
    sorted.forEach((item, index) => {
      map.set(item.id, index + 1);
    });
    return map;
  }, [bookings]);

  // STT riêng cho bộ lọc hiện tại (áp dụng quy tắc phiếu tạo trước = 1, tiếp theo 2, 3... N)
  const filteredSttMap = useMemo(() => {
    const isFiltered = statusFilter !== 'all' || flowFilter !== 'all' || categoryFilter !== 'all' || Boolean(searchTerm.trim());
    if (!isFiltered) return null;
    const sorted = [...filteredBookings].sort((a, b) => {
      const tA = parseDateToMillis(a.bookingDate || a.createdAt || a.updatedAt);
      const tB = parseDateToMillis(b.bookingDate || b.createdAt || b.updatedAt);
      if (tA !== tB) return tA - tB;
      const ticketA = (a.ticketNumber || '').trim();
      const ticketB = (b.ticketNumber || '').trim();
      if (ticketA && ticketB && ticketA !== ticketB) {
        return ticketA.localeCompare(ticketB);
      }
      return (a.id || '').localeCompare(b.id || '');
    });
    const map = new Map<string, number>();
    sorted.forEach((item, index) => {
      map.set(item.id, index + 1);
    });
    return map;
  }, [filteredBookings, statusFilter, flowFilter, categoryFilter, searchTerm]);

  // Open Create Modal
  const handleOpenCreateModal = (presetFlow?: DeviceIotFlowType) => {
    setEditingItem(null);
    const isLoan = presetFlow === 'customer_loan';
    const nowStr = formatViDateTime();
    setFormData({
      ticketNumber: isLoan ? generateLoanTicketNumber(bookings.length) : generateDeviceIotTicketNumber(bookings.length),
      flowType: presetFlow || 'direct_exchange',
      status: isLoan ? 'dang_muon' : presetFlow === 'request_device' ? 'cho_xin_may' : 'co_san_may',
      deviceCategory: 'phone',
      deviceModel: isLoan ? 'RENO 3 PRO' : '',
      deviceName: '',
      skuCode: '',
      imeiOrIot: '',
      customerName: '',
      customerPhone: '',
      creatorTechnician: '',
      technicianName: '',
      createdBy: currentUser?.name || currentUser?.username || 'KTV HCM4',
      location: isLoan ? 'Tủ Máy Mượn' : '',
      note: '',
      bookingDate: nowStr,
      requestedDate: '',
      stockedInDate: '',
      calledCustomerDate: '',
      appointmentDate: '',
      customerArrivedDate: '',
      hasDeposit: false,
      depositType: 'khong_coc',
      depositAmount: 0,
      borrowedDate: isLoan ? nowStr : '',
      returnedDate: '',
      loanCondition: isLoan ? 'Máy hoạt động tốt, màn hình và vỏ đẹp' : '',
      loanAccessories: isLoan ? 'Máy trần' : '',
      loanHandoverBy: currentUser?.name || 'KTV HCM4',
      loanReceivedBy: '',
      citizenId: '',
      fileNumber: '',
      repairModel: '',
      repairColor: '',
      repairSn: '',
      repairImei: '',
      repairDate: nowStr.split(' ')[0],
      repairDays: '3',
      loanDevicePrice: '5.000.000đ',
      depositAmountInWords: '',
      paymentMethod: 'Tiền mặt',
      warrantyCenterName: warrantyCenters[0]?.name || 'Trung tâm bảo hành OPPO (TTBH)',
      warrantyCenterPhone: warrantyCenters[0]?.phone || '028.38551234',
    });
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: DeviceIotBookingItem) => {
    setEditingItem(item);
    const defaultCenter = warrantyCenters[0] || DEFAULT_WARRANTY_CENTERS[0];
    setFormData({
      ...item,
      creatorTechnician: item.creatorTechnician || '',
      technicianName: item.technicianName || '',
      createdBy: item.createdBy || currentUser?.name || 'KTV HCM4',
      bookingDate: item.bookingDate || formatViDateTime(),
      requestedDate: item.requestedDate || '',
      stockedInDate: item.stockedInDate || '',
      calledCustomerDate: item.calledCustomerDate || '',
      appointmentDate: item.appointmentDate || '',
      customerArrivedDate: item.customerArrivedDate || '',
      borrowedDate: item.borrowedDate || '',
      returnedDate: item.returnedDate || '',
      warrantyCenterName: item.warrantyCenterName || defaultCenter.name,
      warrantyCenterPhone: item.warrantyCenterPhone || defaultCenter.phone,
    });
    setIsCreateModalOpen(true);
  };

  // Submit Create / Edit
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerName?.trim()) {
      onShowToast('Vui lòng nhập Tên Khách Hàng!', 'error');
      return;
    }
    if (!formData.customerPhone?.trim()) {
      onShowToast('Vui lòng nhập Số Điện Thoại khách hàng!', 'error');
      return;
    }
    if (!formData.deviceModel?.trim() && !formData.deviceName?.trim()) {
      onShowToast('Vui lòng nhập Model máy hoặc Tên máy / Thiết bị!', 'error');
      return;
    }

    const flow = formData.flowType || 'direct_exchange';
    let initialStatus = formData.status;
    if (!initialStatus) {
      if (flow === 'customer_loan') {
        initialStatus = 'dang_muon';
      } else if (flow === 'direct_exchange') {
        initialStatus = 'co_san_may';
      } else {
        initialStatus = 'cho_xin_may';
      }
    }

    const nowStr = formatViDateTime();
    const defaultCenter = warrantyCenters[0] || DEFAULT_WARRANTY_CENTERS[0];
    const targetCenterName = (formData.warrantyCenterName || defaultCenter.name).trim();
    const targetCenterPhone = (formData.warrantyCenterPhone || defaultCenter.phone).trim();

    if (editingItem) {
      // Update
      const updated: DeviceIotBookingItem = {
        ...editingItem,
        ...formData,
        flowType: flow,
        status: initialStatus,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        creatorTechnician: (formData.creatorTechnician || '').trim() || undefined,
        technicianName: (formData.technicianName || '').trim() || undefined,
        createdBy: (formData.createdBy || editingItem.createdBy || currentUser?.name || 'KTV HCM4').trim(),
        deviceModel: (formData.deviceModel || '').trim(),
        deviceName: (formData.deviceName || '').trim(),
        skuCode: (formData.skuCode || '').trim(),
        imeiOrIot: (formData.imeiOrIot || '').trim(),
        location: (formData.location || '').trim(),
        note: (formData.note || '').trim(),
        bookingDate: formData.bookingDate || editingItem.bookingDate || nowStr,
        requestedDate: formData.requestedDate || editingItem.requestedDate || undefined,
        stockedInDate: formData.stockedInDate || editingItem.stockedInDate || undefined,
        calledCustomerDate: formData.calledCustomerDate || editingItem.calledCustomerDate || undefined,
        appointmentDate: formData.appointmentDate || editingItem.appointmentDate || undefined,
        customerArrivedDate: formData.customerArrivedDate || editingItem.customerArrivedDate || undefined,
        hasDeposit: formData.depositType === 'co_coc',
        depositType: formData.depositType || 'khong_coc',
        depositAmount: formData.depositAmount || 0,
        borrowedDate: formData.borrowedDate || (flow === 'customer_loan' ? nowStr : undefined),
        returnedDate: formData.returnedDate || undefined,
        loanCondition: formData.loanCondition || '',
        loanAccessories: formData.loanAccessories || '',
        loanHandoverBy: formData.loanHandoverBy || currentUser?.name || 'KTV HCM4',
        loanReceivedBy: formData.loanReceivedBy || '',
        warrantyCenterName: targetCenterName,
        warrantyCenterPhone: targetCenterPhone,
        updatedAt: new Date().toISOString(),
      } as DeviceIotBookingItem;

      const newItems = bookings.map((b) => (b.id === editingItem.id ? updated : b));
      onUpdateBookings(newItems);
      onShowToast(`Đã cập nhật phiếu ${updated.ticketNumber}`, 'success');
    } else {
      // Create new
      const isLoan = flow === 'customer_loan';
      const ticket = formData.ticketNumber?.trim() || (isLoan ? generateLoanTicketNumber(bookings.length) : generateDeviceIotTicketNumber(bookings.length));

      const newItem: DeviceIotBookingItem = {
        id: `dev-iot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ticketNumber: ticket,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        creatorTechnician: (formData.creatorTechnician || '').trim() || undefined,
        technicianName: (formData.technicianName || '').trim() || undefined,
        deviceModel: (formData.deviceModel || '').trim(),
        deviceName: (formData.deviceName || '').trim(),
        skuCode: (formData.skuCode || '').trim(),
        imeiOrIot: (formData.imeiOrIot || '').trim(),
        deviceCategory: formData.deviceCategory || 'phone',
        flowType: flow,
        status: initialStatus,
        bookingDate: formData.bookingDate || nowStr,
        requestedDate: formData.requestedDate || undefined,
        stockedInDate: formData.stockedInDate || undefined,
        calledCustomerDate: formData.calledCustomerDate || undefined,
        appointmentDate: formData.appointmentDate || undefined,
        customerArrivedDate: formData.customerArrivedDate || undefined,
        location: (formData.location || '').trim(),
        note: (formData.note || '').trim(),
        hasDeposit: formData.depositType === 'co_coc',
        depositType: formData.depositType || 'khong_coc',
        depositAmount: formData.depositAmount || 0,
        borrowedDate: isLoan ? (formData.borrowedDate || nowStr) : undefined,
        returnedDate: isLoan ? (formData.returnedDate || undefined) : undefined,
        loanCondition: formData.loanCondition || '',
        loanAccessories: formData.loanAccessories || '',
        loanHandoverBy: formData.loanHandoverBy || currentUser?.name || 'KTV HCM4',
        loanReceivedBy: '',
        warrantyCenterName: targetCenterName,
        warrantyCenterPhone: targetCenterPhone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: (formData.createdBy || currentUser?.name || 'KTV HCM4').trim(),
        createdByUid: currentUser?.username || 'staff',
        history: [
          {
            status: initialStatus,
            timestamp: formData.bookingDate || nowStr,
            note: isLoan
              ? `Tạo phiếu cho khách mượn máy ${formData.deviceModel || ''} (${formData.depositType === 'co_coc' ? 'Có cọc' : 'Không cọc'}). Thời gian mượn: ${formData.borrowedDate || nowStr}`
              : flow === 'direct_exchange'
              ? `Tạo phiếu Có sẵn máy đổi trực tiếp lúc ${formData.bookingDate || nowStr}`
              : `Tạo phiếu Chờ xin máy lúc ${formData.bookingDate || nowStr}`,
            user: (formData.createdBy || currentUser?.name || 'KTV HCM4').trim(),
          },
        ],
      };

      onUpdateBookings([newItem, ...bookings]);
      onShowToast(`Đã tạo mới phiếu ${newItem.ticketNumber}`, 'success');
    }

    setIsCreateModalOpen(false);
  };

  // Open Request Step Modal (Xin Máy)
  const handleOpenRequestModal = (item: DeviceIotBookingItem) => {
    setRequestingItem(item);
    setRequestDate(item.requestedDate || formatViDateTime());
    setRequestNote('');
  };

  // Save Request Step (Xin Máy)
  const handleSaveRequestStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestingItem) return;

    const timeStr = requestDate || formatViDateTime();
    const updated: DeviceIotBookingItem = {
      ...requestingItem,
      status: 'da_xin_may',
      requestedDate: timeStr,
      updatedAt: new Date().toISOString(),
      history: [
        ...(requestingItem.history || []),
        {
          status: 'da_xin_may',
          timestamp: timeStr,
          note: `Đã gửi đơn xin máy lên hệ thống vào lúc ${timeStr}.${requestNote ? ` Ghi chú: ${requestNote}` : ''}`,
          user: currentUser?.name || 'KTV HCM4',
        },
      ],
    };

    onUpdateBookings(bookings.map((b) => (b.id === requestingItem.id ? updated : b)));
    onShowToast(`Phiếu ${requestingItem.ticketNumber} ➔ Đã xin máy (${timeStr})`, 'success');
    setRequestingItem(null);
  };

  // Execute Print Loan Agreement for Web & Desktop (A4 format)
  const handleExecutePrintLoan = async () => {
    if (!selectedLoanItem) return;

    let qrDataUrl = '';
    try {
      qrDataUrl = await generateQrDataUrl(selectedLoanItem.ticketNumber, 120);
    } catch (e) {
      console.warn('Could not generate QR code for print template:', e);
    }

    // Helper formatting functions
    const formatPrice = (val: any) => {
      if (!val) return '5.000.000đ';
      if (typeof val === 'number') return `${val.toLocaleString('vi-VN')}đ`;
      const s = String(val);
      if (s.includes('đ') || s.toLowerCase().includes('vnđ') || s.toLowerCase().includes('vnd')) return val;
      const num = parseFloat(s.replace(/[^0-9]/g, ''));
      if (isNaN(num)) return val;
      return `${num.toLocaleString('vi-VN')}đ`;
    };

    const formatDeposit = (item: any) => {
      if (!item.hasDeposit && item.depositType !== 'co_coc') return 'Không cọc';
      if (item.depositAmount) {
        return formatPrice(item.depositAmount);
      }
      return 'Có cọc';
    };

    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Biên Bản Mượn Máy Điện Thoại Dự Phòng - ${selectedLoanItem.ticketNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 12mm 6mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #fff;
      color: #000;
      font-family: "Times New Roman", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 9.5pt;
      line-height: 1.3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container {
      width: 100%;
      max-width: 184mm;
      margin: 0 auto;
      padding: 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
      padding-bottom: 3px;
      border-bottom: 1.5px solid #000;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: 900;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .header-info {
      display: flex;
      gap: 18px;
      font-weight: bold;
      font-size: 9.5pt;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 4px 0;
    }
    .party-title {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 1px;
      text-decoration: underline;
    }
    .party-info p {
      margin: 1px 0;
      font-size: 9.5pt;
      line-height: 1.3;
    }
    .alert-box {
      background-color: #fffbeb;
      border: 1px solid #f59e0b;
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 8.5pt;
      margin: 4px 0;
      line-height: 1.25;
    }
    .section-intro {
      margin: 4px 0;
      text-align: justify;
      font-size: 9.5pt;
      line-height: 1.32;
    }
    .table-title {
      font-weight: bold;
      font-size: 9.5pt;
      margin: 4px 0 1px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2px 0 4px 0;
      font-size: 9pt;
      line-height: 1.25;
    }
    th, td {
      border: 1px solid #000;
      padding: 3.5px 6px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-align: center;
      font-size: 9.5pt;
    }
    .text-center {
      text-align: center;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .font-bold {
      font-weight: bold;
    }
    .terms-box {
      margin-top: 4px;
      border-top: 1.5px solid #000;
      padding-top: 3px;
    }
    .terms-title {
      font-weight: 800;
      font-size: 9.5pt;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    ol.terms-list {
      margin: 0;
      padding-left: 16px;
      font-size: 8pt;
      line-height: 1.24;
      text-align: justify;
    }
    ol.terms-list li {
      margin-bottom: 2px;
    }
    ol.terms-list li strong {
      color: #000;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 6px;
      text-align: center;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .signature-title {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 10pt;
      margin: 0;
    }
    .signature-sub {
      font-size: 8.5pt;
      font-style: italic;
      margin: 1px 0 0 0;
    }
    .signature-box {
      height: 38px;
    }
    .signature-date {
      font-size: 8.5pt;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header">
      <div style="flex: 1; text-align: left;">
        <h1>BIÊN BẢN MƯỢN MÁY ĐIỆN THOẠI DỰ PHÒNG</h1>
        <div class="header-info">
          <span>Số Đơn Hàng: <span class="font-mono">${selectedLoanItem.ticketNumber}</span></span>
          <span>Số Hồ Sơ: <span class="font-mono">${selectedLoanItem.fileNumber || '.........................'}</span></span>
        </div>
      </div>
      ${qrDataUrl ? '<div style="text-align: right; margin-left: 10px; display: flex; flex-direction: column; align-items: center;"><img src="' + qrDataUrl + '" alt="QR" style="width: 42px; height: 42px; display: block;" /><span style="font-size: 7.5pt; font-family: monospace; display: block; margin-top: 1px;">' + selectedLoanItem.ticketNumber + '</span></div>' : ''}
    </div>

    <div class="grid-2">
      <div class="party-info">
        <div class="party-title">Bên A (gọi là “Bên cho mượn”):</div>
        <p>Tên: <strong>${selectedLoanItem.warrantyCenterName || warrantyCenters[0]?.name || 'Trung tâm bảo hành OPPO (TTBH)'}</strong></p>
        <p>Số Liên Hệ: <strong>${selectedLoanItem.warrantyCenterPhone || warrantyCenters[0]?.phone || '028.38551234'}</strong></p>
      </div>
      <div class="party-info">
        <div class="party-title">Bên B (gọi là “Bên mượn”):</div>
        <p>Tên: <strong>${selectedLoanItem.customerName}</strong></p>
        <p>Số CMND/CCCD: <strong>${selectedLoanItem.citizenId || '...........................................'}</strong></p>
        <p>Số Liên Hệ: <strong>${selectedLoanItem.customerPhone}</strong></p>
      </div>
    </div>

    <div class="alert-box">
      <strong>◆ Thông Báo!</strong> Trước khi ký vào Biên bản này, vui lòng đọc kỹ các điều khoản và điều kiện của Biên bản. Bên B sẽ được coi là đã hiểu đầy đủ và đồng ý với tất cả các điều khoản của Biên bản sau khi ký xác nhận.
    </div>

    <p class="section-intro">
      ◆ Theo đó, Bên B đã gửi điện thoại OPPO/OnePlus (“Sản phẩm”) đến Bên A để sửa chữa vào ngày <strong>${selectedLoanItem.repairDate || selectedLoanItem.bookingDate || '.../.../202...'}</strong>. Bên A dự kiến thời gian sửa máy là <strong>${selectedLoanItem.repairDays || '3'}</strong> ngày. Trong thời gian sửa máy, Bên A đồng ý cho Bên B mượn một máy điện thoại dự phòng để sử dụng.
    </p>

    <div class="table-title">◆ Thông tin sản phẩm do Bên B gửi để sửa chữa như sau:</div>
    <table>
      <thead>
        <tr>
          <th style="width: 33%">Model</th>
          <th style="width: 33%">Màu sắc</th>
          <th style="width: 34%">S/N</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center font-mono font-bold">${selectedLoanItem.repairModel || selectedLoanItem.deviceModel}</td>
          <td class="text-center">${selectedLoanItem.repairColor || '...................'}</td>
          <td class="text-center font-mono">${selectedLoanItem.repairSn || '...................'}</td>
        </tr>
        <tr>
          <td colspan="3">
            <strong>IMEI:</strong> <span class="font-mono">${selectedLoanItem.repairImei || '................................................................'}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="table-title">◆ Thông tin sản phẩm của điện thoại dự phòng:</div>
    <table>
      <thead>
        <tr>
          <th style="width: 33%">Model</th>
          <th style="width: 33%">Màu sắc</th>
          <th style="width: 34%">S/N</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center font-mono font-bold">${selectedLoanItem.deviceModel}</td>
          <td class="text-center">${selectedLoanItem.deviceName || 'Màu tiêu chuẩn'}</td>
          <td class="text-center font-mono">${selectedLoanItem.skuCode || '...................'}</td>
        </tr>
        <tr>
          <td colspan="3">
            <strong>IMEI / S/N:</strong> <span class="font-mono">${selectedLoanItem.imeiOrIot || '................................................................'}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <table>
      <tbody>
        <tr>
          <td style="width: 33%"><strong>Giá máy mượn:</strong> ${formatPrice(selectedLoanItem.loanDevicePrice)}</td>
          <td style="width: 33%"><strong>Phụ kiện kèm theo:</strong> ${selectedLoanItem.loanAccessories || 'Máy trần'}</td>
          <td style="width: 34%"><strong>Tình trạng bên ngoài:</strong> ${selectedLoanItem.loanCondition || 'Hoạt động tốt'}</td>
        </tr>
        <tr>
          <td><strong>Số tiền cọc:</strong> ${formatDeposit(selectedLoanItem)}</td>
          <td><strong>Số tiền cọc bằng chữ:</strong> ${selectedLoanItem.depositAmountInWords || '....................................'}</td>
          <td><strong>Phương thức thanh toán:</strong> ${selectedLoanItem.paymentMethod || 'Tiền mặt'}</td>
        </tr>
      </tbody>
    </table>

    <p class="section-intro" style="margin: 3px 0;">
      1. Trong thời gian mượn máy, Bên A sẽ cung cấp dịch vụ sữa máy cho sản phẩm do Bên B gửi sửa chữa theo chính sách bảo hành của OPPO/OnePlus.<br>
      2. Thời gian mượn điện thoại dự phòng là Bên B phải trả lại điện thoại dự phòng đã mượn cho Bên A trước ngày <strong>${selectedLoanItem.returnedDate || '.../.../202...'}</strong>.
    </p>

    <div class="terms-box">
      <div class="terms-title">Điều khoản và Điều kiện:</div>
      <ol class="terms-list">
        <li><strong>Quyền sở hữu và Mục đích sử dụng:</strong> Máy mượn thuộc sở hữu của Trung tâm bảo hành (Bên A). Bên B cam kết chỉ sử dụng thiết bị cho mục đích cá nhân và hợp pháp. Nghiêm cấm Bên B sử dụng máy mượn để cho thuê thương mại, bán lại, cầm cố, cho mượn lại, phục vụ hoạt động vi phạm pháp luật, bẻ khóa/chạy lại phần mềm (root/jailbreak) hoặc can thiệp hệ thống.</li>
        <li><strong>Xác nhận tình trạng máy:</strong> Khi ký nhận, Bên B được xem là đã kiểm tra ngoại quan, màn hình, phím bấm, camera, sạc và các chức năng cơ bản. Nếu không có khiếu nại ngay tại thời điểm nhận, thiết bị được mặc định bàn giao trong tình trạng hoạt động bình thường, đúng như ghi nhận của Bên A.</li>
        <li><strong>Chi phí phát sinh:</strong> Bên B tự chịu trách nhiệm thanh toán mọi chi phí phát sinh trong quá trình sử dụng, bao gồm cước liên lạc, lưu lượng data, phí ứng dụng, phí nền tảng bên thứ ba, thuế và các khoản tiền phạt vi phạm (nếu có).</li>
        <li><strong>Bảo quản và Bồi thường hư hỏng:</strong> Bên B có trách nhiệm bảo quản thiết bị. Nếu máy hoặc phụ kiện bị hỏng do lỗi chủ quan (như vào nước, ẩm ướt, rơi vỡ, tự ý tháo lắp, sửa chữa ngoài trung tâm chính hãng), Bên B phải bồi thường theo Bảng giá linh kiện, phụ kiện chính thức. Bên B không được phép làm mờ, che phủ hoặc thay đổi số S/N và IMEI của thiết bị.</li>
        <li><strong>Tiền đặt cọc:</strong> Tiền đặt cọc nhằm đảm bảo việc trả máy đúng hạn và nguyên vẹn. Bên A sẽ hoàn trả khoản cọc này theo hình thức đã thỏa thuận nếu Bên B thực hiện đúng nghĩa vụ hoàn trả.</li>
        <li><strong>Chính sách phạt trả chậm và Bồi thường khi mất máy:</strong> 
          <strong>Trả chậm:</strong> Bên B phải trả lại máy mượn trong vòng 07 ngày kể từ ngày lấy máy gửi sửa. Nếu quá hạn, Bên B phải trả phí sử dụng quá hạn bằng 0,5% số tiền đặt cọc cho mỗi ngày chậm trễ. 
          <strong>Mất máy:</strong> Nếu Bên B làm mất thiết bị, Bên B có nghĩa vụ bồi thường thiệt hại cho Bên A bằng đúng giá tiền của máy mượn được ghi trên biên bản. 
          <strong>Xử lý vi phạm:</strong> Trường hợp Bên B từ chối trả máy, quá hạn hoặc có hành vi gian lận, Bên A có quyền ngừng hoàn cọc, khấu trừ phí phạt/sửa chữa vào tiền cọc, báo cáo cơ quan chức năng và được quyền giữ lại Sản phẩm mà Bên B đang gửi sửa chữa.</li>
        <li><strong>Bảo mật dữ liệu:</strong> Trước khi trả máy, Bên B phải tự sao lưu, xóa toàn bộ dữ liệu cá nhân, đăng xuất các tài khoản, gỡ mật khẩu màn hình và tắt chức năng tìm kiếm/khóa từ xa. Bên A có quyền khôi phục cài đặt gốc khi thu hồi và không chịu trách nhiệm về việc rò rỉ, mất mát dữ liệu do Bên B không thực hiện đúng quy định.</li>
        <li><strong>Quyền riêng tư:</strong> Bên B đồng ý cung cấp giấy tờ tùy thân hợp lệ (CCCD/CMND). Bên A được phép thu thập và lưu trữ thông tin cá nhân của Bên B nhằm mục đích quản lý thiết bị, hoàn cọc, và giải quyết tranh chấp.</li>
        <li><strong>Giới hạn trách nhiệm:</strong> Bên A không chịu trách nhiệm đối với bất kỳ thiệt hại trực tiếp, gián tiếp, ngẫu nhiên hay liên đới nào (bao gồm mất mát tài sản, phần mềm, dữ liệu) phát sinh từ việc Bên B sử dụng máy mượn.</li>
      </ol>
    </div>

    <div class="signatures">
      <div>
        <p class="signature-title">Bên A</p>
        <p class="signature-sub">(Ký hoặc Đóng dấu)</p>
        <div class="signature-box"></div>
        <p class="signature-date">Ngày ...... tháng ...... năm 202...</p>
      </div>
      <div>
        <p class="signature-title">Bên B</p>
        <p class="signature-sub">(Ký và ghi rõ họ tên)</p>
        <div class="signature-box"></div>
        <p class="signature-date">Ngày ...... tháng ...... năm 202...</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const hasElectron = Boolean(typeof window !== 'undefined' && (window as any).electronAPI?.printHtml);
    if (hasElectron && (window as any).electronAPI?.printHtml) {
      try {
        await (window as any).electronAPI.printHtml({
          html: fullHtml,
          pageSize: 'A4',
          printBackground: true
        });
        return;
      } catch (err) {
        console.warn('Electron printHtml error, falling back to iframe print:', err);
      }
    }

    // Isolated Iframe Print for Web (completely immune to parent page print styles/DOM)
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(fullHtml);
        doc.close();

        // Focus and trigger print
        iframe.contentWindow?.focus();
        setTimeout(() => {
          iframe.contentWindow?.print();
          // Clean up the iframe after a short delay
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }, 500);
      }
    } catch (err) {
      console.error('Iframe print error, falling back to standard print:', err);
      window.print();
    }
  };

  // Open Stock Step Modal (Nhập Kho)
  const handleOpenStockModal = (item: DeviceIotBookingItem) => {
    setStockingItem(item);
    setStockDate(item.stockedInDate || formatViDateTime());
    setStockLocation(item.location || 'Kệ Máy Mới TTBH');
    setStockNote('');
  };

  // Save Stock Step (Nhập Kho)
  const handleSaveStockStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockingItem) return;

    const timeStr = stockDate || formatViDateTime();
    const loc = stockLocation.trim() || 'Kệ Máy Mới TTBH';
    const updated: DeviceIotBookingItem = {
      ...stockingItem,
      status: 'da_nhap_kho',
      stockedInDate: timeStr,
      location: loc,
      updatedAt: new Date().toISOString(),
      history: [
        ...(stockingItem.history || []),
        {
          status: 'da_nhap_kho',
          timestamp: timeStr,
          note: `Hàng về nhập kho TTBH vào lúc ${timeStr}. Vị trí: ${loc}.${stockNote ? ` Ghi chú: ${stockNote}` : ''}`,
          user: currentUser?.name || 'KTV HCM4',
        },
      ],
    };

    onUpdateBookings(bookings.map((b) => (b.id === stockingItem.id ? updated : b)));
    onShowToast(`Phiếu ${stockingItem.ticketNumber} ➔ Đã nhập kho (${timeStr})`, 'success');
    setStockingItem(null);
  };

  // Open Return Loan Modal
  const handleOpenReturnModal = (item: DeviceIotBookingItem) => {
    setReturningItem(item);
    setReturnDate(item.returnedDate || formatViDateTime());
    setReturnReceivedBy(currentUser?.name || 'KTV HCM4');
    setReturnCondition('Máy hoạt động bình thường, nguyên vẹn không rơi vỡ');
    setReturnNote('');
  };

  // Submit Return Loan Log
  const handleSaveReturnLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningItem) return;

    const timeStr = returnDate || formatViDateTime();
    const updated: DeviceIotBookingItem = {
      ...returningItem,
      status: 'da_tra',
      returnedDate: timeStr,
      loanReceivedBy: returnReceivedBy || currentUser?.name || 'KTV HCM4',
      closureNote: returnNote,
      updatedAt: new Date().toISOString(),
      history: [
        ...(returningItem.history || []),
        {
          status: 'da_tra',
          timestamp: timeStr,
          note: `Khách đã trả máy hoàn tất vào lúc ${timeStr}. KTV nhận: ${returnReceivedBy || 'KTV'}. ${returnCondition ? `Tình trạng: ${returnCondition}. ` : ''}${returningItem.depositType === 'co_coc' ? 'Đã hoàn trả cọc.' : ''} ${returnNote ? `(${returnNote})` : ''}`,
          user: returnReceivedBy || currentUser?.name || 'KTV HCM4',
        },
      ],
    };

    onUpdateBookings(bookings.map((b) => (b.id === returningItem.id ? updated : b)));
    onShowToast(`🎉 Đã xác nhận khách trả máy cho phiếu ${returningItem.ticketNumber}!`, 'success');
    setReturningItem(null);
  };

  // Quick Status Step Advance Handler
  const handleAdvanceStep = (item: DeviceIotBookingItem, nextStatus: DeviceIotStatus) => {
    if (nextStatus === 'da_xin_may') {
      handleOpenRequestModal(item);
      return;
    }
    if (nextStatus === 'da_nhap_kho') {
      handleOpenStockModal(item);
      return;
    }
    if (nextStatus === 'da_goi_kh') {
      handleOpenCallModal(item);
      return;
    }
    if (nextStatus === 'da_hoan_tat') {
      handleOpenCompleteModal(item);
      return;
    }

    const now = formatViDateTime();
    const updated: DeviceIotBookingItem = {
      ...item,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      history: [
        ...(item.history || []),
        {
          status: nextStatus,
          timestamp: now,
          note: `Chuyển sang trạng thái ${DEVICE_IOT_STATUS_CONFIG[nextStatus].label}`,
          user: currentUser?.name || 'KTV HCM4',
        },
      ],
    };

    onUpdateBookings(bookings.map((b) => (b.id === item.id ? updated : b)));
    onShowToast(`Phiếu ${item.ticketNumber} ➔ ${DEVICE_IOT_STATUS_CONFIG[nextStatus].label}`, 'success');
  };

  // Open Call Customer Modal
  const handleOpenCallModal = (item: DeviceIotBookingItem) => {
    setCallingItem(item);
  };

  // Mở modal ghi chú phiếu (Tất cả User đều có quyền Thêm / Sửa / Xóa)
  const handleOpenNoteModal = (item: DeviceIotBookingItem, mode: 'edit' | 'append' | 'add' = 'edit') => {
    setNoteModalItem(item);
    const targetMode = (!item.note || !item.note.trim()) ? 'add' : mode;
    setNoteModalMode(targetMode);
  };

  // Lưu ghi chú phiếu (Thêm nội dung hoặc sửa nội dung)
  const handleSaveNote = (newNote: string) => {
    if (!noteModalItem) return;
    const cleanNote = newNote.trim();
    const nowTime = formatViDateTime();
    const updated: DeviceIotBookingItem = {
      ...noteModalItem,
      note: cleanNote || undefined,
      updatedAt: new Date().toISOString(),
      history: [
        ...(noteModalItem.history || []),
        {
          status: noteModalItem.status,
          timestamp: nowTime,
          note: cleanNote
            ? `Cập nhật ghi chú: "${cleanNote}" [Bởi: ${currentUser?.name || 'KTV HCM4'}]`
            : `Đã xóa ghi chú phiếu [Bởi: ${currentUser?.name || 'KTV HCM4'}]`,
          user: currentUser?.name || 'KTV HCM4',
        },
      ],
    };

    onUpdateBookings(bookings.map((b) => (b.id === noteModalItem.id ? updated : b)));
    if (cleanNote) {
      onShowToast(`Đã lưu ghi chú cho phiếu ${noteModalItem.ticketNumber}`, 'success');
    } else {
      onShowToast(`Đã xóa ghi chú của phiếu ${noteModalItem.ticketNumber}`, 'info');
    }
    setNoteModalItem(null);
  };

  // Xóa ghi chú phiếu
  const handleDeleteNote = (item: DeviceIotBookingItem) => {
    const nowTime = formatViDateTime();
    const updated: DeviceIotBookingItem = {
      ...item,
      note: undefined,
      updatedAt: new Date().toISOString(),
      history: [
        ...(item.history || []),
        {
          status: item.status,
          timestamp: nowTime,
          note: `Đã xóa ghi chú phiếu [Bởi: ${currentUser?.name || 'KTV HCM4'}]`,
          user: currentUser?.name || 'KTV HCM4',
        },
      ],
    };

    onUpdateBookings(bookings.map((b) => (b.id === item.id ? updated : b)));
    onShowToast(`Đã xóa ghi chú của phiếu ${item.ticketNumber}`, 'info');
    setNoteModalItem(null);
  };

  const handleQuickDeleteNote = (item: DeviceIotBookingItem) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa ghi chú của phiếu ${item.ticketNumber} không?`)) {
      handleDeleteNote(item);
    }
  };

  // Submit Call Customer Log
  const handleSaveCustomerCall = (data: {
    calledCustomerDate?: string;
    callSubStatus?: DeviceIotCallSubStatus;
    appointmentDate?: string;
    callNote?: string;
    callLogs: any[];
    shouldCloseTicket?: boolean;
    isDeletedAll?: boolean;
  }) => {
    if (!callingItem) return;

    // Nếu người dùng đã xóa hết các lần gọi trong modal
    if (data.isDeletedAll || data.callLogs.length === 0) {
      const revertStatus: DeviceIotStatus =
        callingItem.flowType === 'direct_exchange'
          ? 'co_san_may'
          : callingItem.stockedInDate
          ? 'da_nhap_kho'
          : callingItem.requestedDate
          ? 'da_xin_may'
          : 'cho_xin_may';

      const updated: DeviceIotBookingItem = {
        ...callingItem,
        status: revertStatus,
        calledCustomerDate: undefined,
        callSubStatus: undefined,
        appointmentDate: undefined,
        callNote: undefined,
        callLogs: [],
        updatedAt: new Date().toISOString(),
        history: [
          ...(callingItem.history || []),
          {
            status: revertStatus,
            timestamp: formatViDateTime(),
            note: 'Đã xóa toàn bộ lịch sử gọi khách hàng, hoàn tác về trạng thái trước đó',
            user: currentUser?.name || 'KTV HCM4',
          },
        ],
      };

      onUpdateBookings(bookings.map((b) => (b.id === callingItem.id ? updated : b)));
      onShowToast(`Đã xóa thông tin gọi khách cho phiếu ${callingItem.ticketNumber}`, 'info');
      setCallingItem(null);
      return;
    }

    const callTime = data.calledCustomerDate?.trim() || formatViDateTime();
    const subStatus = data.callSubStatus || 'hen_ngay';
    const subConfig = CALL_SUBSTATUS_CONFIG[subStatus] || CALL_SUBSTATUS_CONFIG.hen_ngay;
    const callCount = data.callLogs.length;

    let noteDetail = `Hiện trạng gọi khách (${callCount} lần gọi) lúc ${callTime}: ${subConfig.shortLabel}`;
    if (subStatus === 'hen_ngay' && data.appointmentDate) {
      noteDetail += ` - Hẹn ngày ${data.appointmentDate}`;
    }
    if (data.callNote) {
      noteDetail += ` (${data.callNote})`;
    }

    const shouldClose = Boolean(data.shouldCloseTicket);
    const newStatus: DeviceIotStatus = shouldClose ? 'da_hoan_tat' : 'da_goi_kh';

    const updated: DeviceIotBookingItem = {
      ...callingItem,
      status: newStatus,
      calledCustomerDate: callTime,
      callSubStatus: subStatus,
      appointmentDate: subStatus === 'hen_ngay' ? data.appointmentDate : undefined,
      callNote: data.callNote || undefined,
      callLogs: data.callLogs,
      isCompletedWithoutExchange: shouldClose ? true : callingItem.isCompletedWithoutExchange,
      closureReason: shouldClose ? 'Khách báo hủy không đổi/nhận máy' : callingItem.closureReason,
      closureNote: shouldClose ? (data.callNote || 'Khách báo hủy qua điện thoại') : callingItem.closureNote,
      closureBy: shouldClose ? (currentUser?.name || 'Nhân viên liên hệ') : callingItem.closureBy,
      updatedAt: new Date().toISOString(),
      history: [
        ...(callingItem.history || []),
        {
          status: newStatus,
          timestamp: callTime,
          note: noteDetail,
          user: currentUser?.name || 'KTV HCM4',
        },
      ],
    };

    onUpdateBookings(bookings.map((b) => (b.id === callingItem.id ? updated : b)));
    if (shouldClose) {
      onShowToast(`Đã đóng phiếu ${callingItem.ticketNumber} do khách báo hủy`, 'info');
    } else {
      onShowToast(`Đã lưu hiện trạng gọi khách cho phiếu ${callingItem.ticketNumber} (${subConfig.shortLabel})`, 'success');
    }
    setCallingItem(null);
  };

  // Open Complete Modal
  const handleOpenCompleteModal = (item: DeviceIotBookingItem) => {
    setCompletingItem(item);
    setCustomerArrivedDate(item.customerArrivedDate || formatViDateTime());
    setTechnicianName(currentUser?.name || '');
    setCompletionNote('');
  };

  // Save Complete
  const handleSaveComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingItem) return;

    const completeTime = customerArrivedDate || formatViDateTime();
    const updated: DeviceIotBookingItem = {
      ...completingItem,
      status: 'da_hoan_tat',
      customerArrivedDate: completeTime,
      technicianName: technicianName || currentUser?.name || 'KTV HCM4',
      closureNote: completionNote,
      updatedAt: new Date().toISOString(),
      history: [
        ...(completingItem.history || []),
        {
          status: 'da_hoan_tat',
          timestamp: completeTime,
          note: `Khách lên nhận máy & hoàn tất bàn giao lúc ${completeTime}. KTV: ${technicianName || 'KTV'}. ${completionNote ? `Ghi chú: ${completionNote}` : ''}`,
          user: technicianName || currentUser?.name || 'KTV HCM4',
        },
      ],
    };

    onUpdateBookings(bookings.map((b) => (b.id === completingItem.id ? updated : b)));
    onShowToast(`🎉 Phiếu ${completingItem.ticketNumber} đã hoàn tất thành công!`, 'success');
    setCompletingItem(null);
  };

  // Delete & Cancellation Request Handlers
  const handleInitiateDelete = (item: DeviceIotBookingItem) => {
    if (isAdmin) {
      // Admin directly opens the permanent deletion modal
      setDeletingBookingConfirm(item);
    } else {
      // User / Staff: cannot delete directly, must request from Admin
      if (item.cancelRequested) {
        onShowToast(
          `Phiếu [${item.ticketNumber}] đã được gửi yêu cầu xóa trước đó (Lý do: "${item.cancelReason || 'Chưa ghi'}"), đang chờ Quản trị viên duyệt!`,
          'info'
        );
        return;
      }
      setCancelRequestModalItem(item);
      setCancelReasonInput('');
    }
  };

  // User/Staff submits request to delete
  const handleSubmitCancelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelRequestModalItem) return;
    if (!cancelReasonInput.trim()) {
      onShowToast('Vui lòng nhập lý do yêu cầu xóa / hủy phiếu!', 'error');
      return;
    }

    setIsSubmittingCancel(true);
    try {
      const requester = currentUser?.name || currentUser?.username || 'Nhân viên';
      const targetId = cancelRequestModalItem.id;
      const reason = cancelReasonInput.trim();
      const nowIso = new Date().toISOString();

      await requestDeviceIotCancel(targetId, reason, requester);

      const updated = bookings.map((b) =>
        b.id === targetId
          ? {
              ...b,
              cancelRequested: true,
              cancelReason: reason,
              cancelRequestedBy: requester,
              cancelRequestedAt: nowIso,
              updatedAt: nowIso,
            }
          : b
      );
      onUpdateBookings(updated);
      onShowToast(
        `Đã gửi yêu cầu xóa phiếu [${cancelRequestModalItem.ticketNumber}] đến Quản trị viên duyệt!`,
        'success'
      );
      setCancelRequestModalItem(null);
      setCancelReasonInput('');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi gửi yêu cầu xóa: ${err?.message || 'Vui lòng thử lại'}`, 'error');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Admin approves deletion (Permanently deletes from Cloud & Local state)
  const handleAdminApproveDelete = async (item: DeviceIotBookingItem) => {
    setIsDeleting(true);
    try {
      await deleteDeviceIotFromCloud(item.id);
      const newItems = bookings.filter((b) => b.id !== item.id);
      onUpdateBookings(newItems);
      setDeletingBookingConfirm(null);
      onShowToast(`Đã xóa vĩnh viễn phiếu [${item.ticketNumber}] khỏi hệ thống Cloud!`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi xóa phiếu: ${err?.message || 'Vui lòng thử lại'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Admin clear all device iot items
  const handleClearAllDeviceIots = async () => {
    setIsClearingAll(true);
    try {
      await clearAllDeviceIotsFromCloud();
      onUpdateBookings([]);
      onShowToast('Đã xóa trắng toàn bộ danh sách đặt chờ máy & IOT!', 'success');
      setShowClearAllConfirmModal(false);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi xóa trắng danh sách: ${err?.message || 'Vui lòng thử lại'}`, 'error');
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleForceSyncAndRecover = async () => {
    try {
      localStorage.removeItem('firestore_quota_exceeded');
      localStorage.removeItem('label_studio_device_iot_clear_all_timestamp');
      localStorage.removeItem('label_studio_device_iot_deleted_ids');
      localStorage.removeItem('label_studio_device_iot_initialized');
      onShowToast('Đang khôi phục bộ nhớ tạm & đồng bộ dữ liệu từ Cloud Server...', 'info');
      const freshItems = await pullLatestDeviceIotsFromCloud();
      if (Array.isArray(freshItems) && freshItems.length > 0) {
        onUpdateBookings(freshItems);
        onShowToast(`Đã đồng bộ thành công ${freshItems.length} phiếu đặt máy từ Cloud!`, 'success');
      } else {
        setTimeout(() => {
          if (typeof window !== 'undefined' && (window as any).electronAPI?.reloadWindow) {
            (window as any).electronAPI.reloadWindow();
          } else {
            window.location.reload();
          }
        }, 600);
      }
    } catch (e: any) {
      onShowToast('Lỗi khi khôi phục dữ liệu: ' + (e?.message || 'vui lòng tải lại trang'), 'error');
    }
  };

  // Admin rejects cancellation request
  const handleAdminRejectCancel = async (item: DeviceIotBookingItem) => {
    try {
      await rejectDeviceIotCancel(item.id, item.ticketNumber, currentUser?.name || 'Admin');
      const updated = bookings.map((b) =>
        b.id === item.id
          ? {
              ...b,
              cancelRequested: false,
              cancelReason: undefined,
              cancelRequestedBy: undefined,
              cancelRequestedAt: undefined,
              updatedAt: new Date().toISOString(),
            }
          : b
      );
      onUpdateBookings(updated);
      onShowToast(`Đã bác bỏ yêu cầu xóa phiếu [${item.ticketNumber}]`, 'info');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi bác bỏ yêu cầu: ${err?.message || 'Vui lòng thử lại'}`, 'error');
    }
  };

  // Excel & JSON Import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileNameLower = file.name.toLowerCase();

      // Check if user uploaded a JSON Backup file
      if (fileNameLower.endsWith('.json') || file.type === 'application/json') {
        const text = await file.text();
        let parsedBackup: any;
        try {
          parsedBackup = parseBackupJson(text);
        } catch (parseErr: any) {
          onShowToast(parseErr?.message || 'File JSON không hợp lệ!', 'error');
          return;
        }

        onShowToast('Đang nạp và đồng bộ dữ liệu từ bản sao lưu JSON...', 'info');
        const result = await executeFastRestore({
          parsed: parsedBackup,
          mode: 'merge',
          authorName: currentUser?.name || 'Khôi Phục JSON',
        });

        if (result.success) {
          onShowToast(
            `Khôi phục thành công! Đã đồng bộ ${result.counts.deviceIot} phiếu máy & IOT, ${result.counts.shortages} phiếu LK lên Cloud.`,
            'success'
          );
        } else {
          onShowToast(`Khôi phục gặp lỗi: ${result.message}`, 'error');
        }
        return;
      }

      // Otherwise parse Excel
      const parsed = await parseDeviceIotExcelFile(file);
      if (parsed.length === 0) {
        onShowToast('File Excel không có dữ liệu hợp lệ!', 'error');
        return;
      }

      const newItems: DeviceIotBookingItem[] = parsed.map((item, idx) => ({
        id: `dev-iot-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        ticketNumber: item.ticketNumber || generateDeviceIotTicketNumber(bookings.length + idx),
        customerName: item.customerName || 'Khách hàng',
        customerPhone: item.customerPhone || '',
        deviceModel: item.deviceModel || '',
        deviceName: item.deviceName || '',
        skuCode: item.skuCode || '',
        imeiOrIot: item.imeiOrIot || '',
        deviceCategory: item.deviceCategory || 'phone',
        flowType: item.flowType || 'direct_exchange',
        status: item.status || (item.flowType === 'direct_exchange' ? 'co_san_may' : 'cho_xin_may'),
        bookingDate: item.bookingDate || formatDateVi(),
        location: item.location || '',
        note: item.note || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Excel Import',
      }));

      onUpdateBookings([...newItems, ...bookings]);
      onShowToast(`Đã nhập thành công ${newItems.length} phiếu từ file Excel!`, 'success');
    } catch (err: any) {
      console.error('Import error:', err);
      onShowToast('Có lỗi khi đọc file: ' + (err?.message || ''), 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Helper icon for category
  const renderCategoryIcon = (category?: DeviceIotCategory) => {
    switch (category) {
      case 'phone':
        return <Smartphone className="w-3.5 h-3.5" />;
      case 'pad':
        return <Tablet className="w-3.5 h-3.5" />;
      case 'watch':
        return <Watch className="w-3.5 h-3.5" />;
      case 'audio':
        return <Headphones className="w-3.5 h-3.5" />;
      case 'iot':
        return <Radio className="w-3.5 h-3.5" />;
      case 'accessory':
        return <Cable className="w-3.5 h-3.5" />;
      default:
        return <Boxes className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 animate-in fade-in duration-200">
      {/* Hidden file input for Excel & JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv,.json,application/json"
        className="hidden"
      />

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Total */}
        <button
          type="button"
          onClick={() => {
            setFlowFilter('all');
            setStatusFilter('all');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'all' && flowFilter === 'all'
              ? 'bg-amber-50/80 border-2 border-amber-500 ring-2 ring-amber-400/30 text-amber-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white text-stone-700 border-stone-200 hover:border-amber-300'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Tất Cả Phiếu</div>
          <div className="text-xl sm:text-2xl font-black mt-1 text-amber-950">{stats.total}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">{stats.activeTickets} chưa hoàn tất</div>
        </button>

        {/* Có sẵn máy - Đổi trực tiếp */}
        <button
          type="button"
          onClick={() => {
            setFlowFilter('direct_exchange');
            setStatusFilter('co_san_may');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            flowFilter === 'direct_exchange' && statusFilter === 'co_san_may'
              ? 'bg-emerald-50/90 border-2 border-emerald-500 ring-2 ring-emerald-400/30 text-emerald-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white text-emerald-950 border-stone-200 hover:border-emerald-300'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between text-emerald-800">
            <span>1. Có Sẵn Máy</span>
            <Zap className="w-3.5 h-3.5 fill-current text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-1 text-emerald-900">{stats.coSanMay}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Đổi trực tiếp</div>
        </button>

        {/* 1. Chờ xin máy */}
        <button
          type="button"
          onClick={() => {
            setFlowFilter('request_device');
            setStatusFilter('cho_xin_may');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            flowFilter === 'request_device' && statusFilter === 'cho_xin_may'
              ? 'bg-blue-50/90 border-2 border-blue-500 ring-2 ring-blue-400/30 text-blue-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white text-blue-950 border-stone-200 hover:border-blue-300'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between text-blue-800">
            <span>1. Chờ Xin Máy</span>
            <Clock className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-1 text-blue-900">{stats.choXinMay}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Chờ gửi đơn xin</div>
        </button>

        {/* 2. Đã xin máy */}
        <button
          type="button"
          onClick={() => {
            setFlowFilter('all');
            setStatusFilter('da_xin_may');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_xin_may'
              ? 'bg-indigo-50/90 border-2 border-indigo-500 ring-2 ring-indigo-400/30 text-indigo-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white text-indigo-950 border-stone-200 hover:border-indigo-300'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between text-indigo-800">
            <span>2. Đã Xin Máy</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-1 text-indigo-900">{stats.daXinMay}</div>
          <div className="text-[10px] text-indigo-700 mt-0.5">Chờ vận chuyển về</div>
        </button>

        {/* 3. Nhập kho */}
        <button
          type="button"
          onClick={() => {
            setFlowFilter('all');
            setStatusFilter('da_nhap_kho');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_nhap_kho'
              ? 'bg-amber-50/90 border-2 border-amber-600 ring-2 ring-amber-500/30 text-amber-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white text-amber-950 border-stone-200 hover:border-amber-300'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between text-amber-800">
            <span>3. Đã Nhập Kho</span>
            <Boxes className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-1 text-amber-950">{stats.daNhapKho}</div>
          <div className="text-[10px] text-amber-800 mt-0.5">Sẵn sàng trong tủ/kệ</div>
        </button>

        {/* 4. Đã gọi KH */}
        <button
          type="button"
          onClick={() => {
            setFlowFilter('all');
            setStatusFilter('da_goi_kh');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_goi_kh'
              ? 'bg-sky-50/90 border-2 border-sky-500 ring-2 ring-sky-400/30 text-sky-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white text-sky-950 border-stone-200 hover:border-sky-300'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between text-sky-800">
            <span>4. Gọi Khách Lên</span>
            <PhoneCall className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-1 text-sky-900">{stats.daGoiKh}</div>
          <div className="text-[10px] text-sky-700 mt-0.5">Đã hẹn ngày khách lên</div>
        </button>

        {/* MÁY KHÁCH MƯỢN (KPI Card) */}
        <button
          type="button"
          onClick={() => {
            setFlowFilter('customer_loan');
            setStatusFilter('all');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            flowFilter === 'customer_loan'
              ? 'bg-amber-50/90 border-2 border-amber-500 ring-2 ring-amber-400/30 text-amber-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white text-amber-950 border-stone-200 hover:border-amber-300'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between text-amber-800">
            <span>Máy Khách Mượn</span>
            <SmartphoneCharging className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-1 text-amber-950">
            {stats.dangMuon} <span className="text-xs font-normal text-stone-500">/ {stats.customerLoanCount}</span>
          </div>
          <div className="text-[10px] mt-0.5 font-medium text-amber-700">
            {stats.dangMuon} đang mượn • {stats.daTra} đã trả
          </div>
        </button>

        {/* 5. Hoàn tất */}
        <button
          type="button"
          onClick={() => {
            setFlowFilter('all');
            setStatusFilter('da_hoan_tat');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_hoan_tat'
              ? 'bg-emerald-50/90 border-2 border-emerald-500 ring-2 ring-emerald-400/30 text-emerald-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white text-emerald-950 border-stone-200 hover:border-emerald-300'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between text-emerald-800">
            <span>5. Hoàn Thành</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-1 text-emerald-900">{stats.daHoanTat}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Khách đã lên nhận máy</div>
        </button>
      </div>

      {/* Alert Banner for Admin/Staff when cancel requests exist */}
      {stats.cancelRequestsCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                <span>CÓ {stats.cancelRequestsCount} PHIẾU ĐANG CHỜ QUẢN TRỊ VIÊN DUYỆT XÓA</span>
                <span className="px-1.5 py-0.2 bg-rose-200 text-rose-800 rounded font-mono text-[10px]">
                  {stats.cancelRequestsCount}
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                {isAdmin
                  ? 'Quản trị viên có thể xem lý do, phê duyệt xóa vĩnh viễn hoặc bác bỏ yêu cầu ngay trên danh sách.'
                  : 'Nhân viên đã gửi yêu cầu xóa, vui lòng chờ Quản trị viên (Admin) phê duyệt.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && onOpenAdminModal && (
              <button
                type="button"
                onClick={onOpenAdminModal}
                className="px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Mở Quản Trị Duyệt Hủy</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setFlowFilter('all');
                setStatusFilter(statusFilter === 'cancel_requested' ? 'all' : 'cancel_requested');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all shrink-0 flex items-center gap-1 ${
                statusFilter === 'cancel_requested'
                  ? 'bg-rose-700 text-white shadow-sm ring-2 ring-rose-600/30'
                  : 'bg-white hover:bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{statusFilter === 'cancel_requested' ? 'Đang lọc xem yêu cầu' : 'Lọc xem phiếu chờ xóa'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter, Search & Action Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 p-3.5 shadow-xs space-y-3 relative z-20">
        {/* Row 1: Action Buttons Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-3 border-b border-neutral-100">
          {/* Nhóm 1: Tạo Phiếu Mới */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenCreateModal('direct_exchange')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all active:scale-[0.98]"
              title="Tạo phiếu Có sẵn máy để đổi trực tiếp cho khách"
            >
              <Zap className="w-4 h-4 text-emerald-100 fill-current" />
              <span>+ Đổi Trực Tiếp (Có Sẵn)</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateModal('request_device')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all active:scale-[0.98]"
              title="Tạo phiếu Chờ xin máy / IOT từ kho tổng"
            >
              <Plus className="w-4 h-4 text-indigo-200" />
              <span>+ Chờ Xin Máy & IOT</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateModal('customer_loan')}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all active:scale-[0.98]"
              title="Tạo phiếu cho khách mượn máy tạm trong thời gian bảo hành/sửa chữa"
            >
              <SmartphoneCharging className="w-4 h-4 text-amber-100" />
              <span>+ Máy Khách Mượn</span>
            </button>
          </div>

          {/* Nhóm 2: Thao Tác Dữ Liệu Excel & Quản trị */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Gom Nhập, Xuất & Mẫu Excel thành 1 nút dropdown duy nhất */}
            <ExcelActionMenu
              onImportClick={() => fileInputRef.current?.click()}
              onExportClick={() => exportDeviceIotToExcel(filteredBookings)}
              onDownloadSampleClick={downloadSampleDeviceIotExcel}
              exportCount={filteredBookings.length}
              exportDisabled={filteredBookings.length === 0}
              buttonText="Nhập / Xuất Excel"
              shortButtonText="Excel"
              theme="stone"
              title="Thao tác nhập file Excel/JSON, xuất bảng tính hoặc tải mẫu Excel"
            />

            {isAdmin && onOpenFastBackupRestore && (
              <button
                type="button"
                onClick={onOpenFastBackupRestore}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-[0.98] shadow-2xs"
                title="Sao lưu hoặc khôi phục siêu tốc dữ liệu từ file JSON khi chuyển tài khoản hoặc đổi máy"
              >
                <FileJson className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sao Lưu / Khôi Phục JSON</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowClearAllConfirmModal(true)}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl shadow-2xs cursor-pointer flex items-center gap-1 transition-all active:scale-[0.98]"
                title="Xóa trắng toàn bộ danh sách đặt chờ máy & IOT (Admin)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Xóa Trắng</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search Input & Filter Pills */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm số phiếu, khách, SĐT, model, SKU, IMEI/IOT, người tạo, KTV tạo, KTV xử lý..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchScope('filtered');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Cancel requests quick filter */}
          {stats.cancelRequestsCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'cancel_requested' ? 'all' : 'cancel_requested')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border shadow-xs ${
                statusFilter === 'cancel_requested'
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
              }`}
            >
              <AlertCircle className="w-3 h-3 text-rose-600" />
              <span>Chờ xóa ({stats.cancelRequestsCount})</span>
            </button>
          )}
          {/* Bộ lọc theo tháng hoặc chọn khoảng ngày tạo phiếu */}
          <DateRangeFilter
            filterState={dateFilter}
            onFilterChange={setDateFilter}
            availableMonths={availableMonths}
            filteredCount={filteredBookings.length}
            totalCount={bookings.length}
            itemLabel="phiếu"
            align="left"
          />

          {/* Flow Filter */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold gap-1">
            <button
              type="button"
              onClick={() => setFlowFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                flowFilter === 'all'
                  ? 'bg-amber-50 text-amber-950 border border-amber-500 ring-2 ring-amber-400/20 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Tất cả quy trình
            </button>
            <button
              type="button"
              onClick={() => setFlowFilter('direct_exchange')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-bold ${
                flowFilter === 'direct_exchange'
                  ? 'bg-amber-50 text-amber-950 border border-amber-500 ring-2 ring-amber-400/20 shadow-2xs'
                  : 'text-stone-600 hover:text-emerald-700'
              }`}
            >
              <Zap className="w-3 h-3 text-emerald-600 fill-current" />
              <span>Có sẵn (Đổi trực tiếp)</span>
            </button>
            <button
              type="button"
              onClick={() => setFlowFilter('request_device')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-bold ${
                flowFilter === 'request_device'
                  ? 'bg-amber-50 text-amber-950 border border-amber-500 ring-2 ring-amber-400/20 shadow-2xs'
                  : 'text-stone-600 hover:text-indigo-700'
              }`}
            >
              <Boxes className="w-3 h-3 text-indigo-600" />
              <span>Chờ xin máy & IOT</span>
            </button>
            <button
              type="button"
              onClick={() => setFlowFilter('customer_loan')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-bold ${
                flowFilter === 'customer_loan'
                  ? 'bg-amber-50 text-amber-950 border border-amber-500 ring-2 ring-amber-400/20 shadow-2xs'
                  : 'text-stone-600 hover:text-amber-700'
              }`}
            >
              <SmartphoneCharging className="w-3 h-3 text-amber-600" />
              <span>Máy Khách Mượn</span>
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="text-xs py-1.5 px-2.5 bg-white border border-stone-200 rounded-xl text-stone-700 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">Tất cả loại thiết bị</option>
            <option value="phone">📱 Điện thoại</option>
            <option value="pad">📱 Máy tính bảng (Pad)</option>
            <option value="watch">⌚ Đồng hồ / Vòng đeo</option>
            <option value="audio">🎧 Tai nghe / Loa</option>
            <option value="iot">📻 Thiết bị IOT</option>
            <option value="accessory">🔌 Phụ kiện</option>
          </select>

          {/* Status Quick Clear */}
          {(statusFilter !== 'all' || flowFilter !== 'all' || categoryFilter !== 'all' || dateFilter.mode !== 'all' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setFlowFilter('all');
                setCategoryFilter('all');
                setDateFilter({ mode: 'all', selectedMonth: '', startDate: '', endDate: '' });
                setSearchTerm('');
              }}
              className="text-xs px-2.5 py-1.5 text-rose-700 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 rounded-lg font-bold transition-all cursor-pointer shadow-2xs"
            >
              Xóa tất cả bộ lọc
            </button>
          )}
        </div>
      </div>
    </div>

      {/* Active Time Filter Indicator Banner */}
      {dateFilter.mode !== 'all' && (
        <div className="bg-amber-50/90 border border-amber-300 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-950 font-semibold shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-600 text-white font-bold text-[11px]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Đang Lọc Thời Gian Tạo Phiếu Máy/IOT</span>
            </span>
            <span>
              Phạm vi: <strong className="text-amber-900 font-bold">
                {dateFilter.mode === 'month' && dateFilter.selectedMonth ? `Tháng ${dateFilter.selectedMonth.split('-')[1]}/${dateFilter.selectedMonth.split('-')[0]}` :
                 dateFilter.mode === 'this_month' ? 'Tháng này' :
                 dateFilter.mode === 'last_month' ? 'Tháng trước' :
                 dateFilter.mode === 'today' ? 'Hôm nay' :
                 dateFilter.mode === 'yesterday' ? 'Hôm qua' :
                 dateFilter.mode === 'last7days' ? '7 ngày qua' :
                 dateFilter.mode === 'last30days' ? '30 ngày qua' :
                 dateFilter.mode === 'custom' ? `${dateFilter.startDate || '...'} ➔ ${dateFilter.endDate || '...'}` : 'Tùy chỉnh'}
              </strong>
            </span>
            <span className="text-amber-800 text-[11px] bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
              Khớp <b>{filteredBookings.length}</b> / {bookings.length} phiếu
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDateFilter({ mode: 'all', selectedMonth: '', startDate: '', endDate: '' })}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:text-rose-700 bg-white hover:bg-rose-50 border border-amber-300 hover:border-rose-300 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
            title="Xóa lọc thời gian để xem toàn bộ tất cả các tháng"
          >
            <X className="w-3 h-3" />
            <span>Xóa Lọc Thời Gian</span>
          </button>
        </div>
      )}

      {/* Active Search Result Banner */}
      {searchTerm.trim() && (
        <div className="bg-amber-50/90 border border-amber-300 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-950 font-semibold shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-600 text-white font-bold text-[11px] shrink-0">
              <Search className="w-3.5 h-3.5" />
              <span>Kết Quả Tìm Kiếm Máy/IOT</span>
            </span>
            <span className="text-stone-700">
              Từ khóa: <strong className="text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-300 font-mono">"{searchTerm.trim()}"</strong>
            </span>
            <span className="text-amber-900 text-[11px] bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
              {searchScope === 'all' ? (
                <>Toàn bộ hệ thống: <b>{filteredBookings.length}</b> / {bookings.length} phiếu</>
              ) : (
                <>Trong bộ lọc: <b>{filteredBookings.length}</b> phiếu {isFilterScopeActive && `(toàn hệ thống có ${globalSearchMatchesCount} phiếu)`}</>
              )}
            </span>
            {filteredBookings.length === 0 && globalSearchMatchesCount > 0 && searchScope === 'filtered' && (
              <span className="text-rose-800 text-[11px] bg-rose-100 px-2 py-0.5 rounded border border-rose-300 font-medium">
                Không có phiếu nào trong bộ lọc hiện tại khớp từ khóa, nhưng có <b>{globalSearchMatchesCount}</b> phiếu ở các trạng thái khác.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isFilterScopeActive && (
              <button
                type="button"
                onClick={() => setSearchScope(searchScope === 'filtered' ? 'all' : 'filtered')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                  searchScope === 'all'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs hover:bg-amber-700'
                    : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                }`}
                title={searchScope === 'filtered' ? 'Chuyển sang tìm trên toàn bộ hệ thống (bỏ qua trạng thái & thời gian)' : 'Quay lại tìm kiếm trong phạm vi bộ lọc đang chọn'}
              >
                {searchScope === 'all' ? (
                  <><span>↩ Tìm Trong Bộ Lọc</span></>
                ) : (
                  <><span>🌐 Tìm Toàn Hệ Thống ({globalSearchMatchesCount})</span></>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchScope('filtered');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-neutral-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-neutral-300 hover:border-rose-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="w-3 h-3" />
              <span>Xóa Tìm Kiếm</span>
            </button>
          </div>
        </div>
      )}

      {/* Main List Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center text-neutral-400">
            <Smartphone className="w-12 h-12 stroke-[1.2] mb-3 text-neutral-300" />
            <p className="font-bold text-neutral-700 text-sm">Chưa có phiếu đặt chờ máy & IOT nào</p>
            <p className="text-xs text-neutral-500 max-w-sm mt-1 mb-4">
              Bấm nút <strong>+ Đổi Trực Tiếp</strong> hoặc <strong>+ Chờ Xin Máy & IOT</strong> ở phía trên để tạo phiếu mới.
            </p>
            <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 max-w-md">
              <p className="text-[11px] text-amber-800 font-medium leading-normal">
                ⚠️ <strong>Bạn không thấy phiếu cũ?</strong> Có thể bộ nhớ tạm trên trình duyệt của bạn đang lọc ẩn hoặc danh sách bị xóa tạm thời. Hãy bấm nút dưới đây để nạp lại đầy đủ từ Cloud.
              </p>
              <button
                type="button"
                onClick={handleForceSyncAndRecover}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                <span>Khôi Phục & Đồng Bộ Lại Từ Cloud</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50/90 text-neutral-700 border-b border-neutral-200 font-bold">
                  <th className="py-2.5 px-3 w-10 text-center" title="Số thứ tự theo thời gian tạo (tạo trước = 1, tăng dần)">STT</th>
                  <th className="py-2.5 px-3">Số Phiếu</th>
                  <th className="py-2.5 px-3">Khách Hàng & SĐT</th>
                  <th className="py-2.5 px-3">Thiết Bị & Model</th>
                  <th className="py-2.5 px-3">Mã SKU & IMEI/IOT</th>
                  <th className="py-2.5 px-3">Quy Trình</th>
                  <th className="py-2.5 px-3">Tiến Độ & Trạng Thái</th>
                  <th className="py-2.5 px-3">Vị Trí Kệ/Tủ</th>
                  <th className="py-2.5 px-3 text-right">Xử Lý Bước Kế Tiếp</th>
                  <th className="py-2.5 px-3 text-center w-20">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70">
                {paginatedBookings.map((item, idx) => {
                  const flowConf = DEVICE_IOT_FLOW_CONFIG[item.flowType] || DEVICE_IOT_FLOW_CONFIG.direct_exchange;
                  const statusConf = DEVICE_IOT_STATUS_CONFIG[item.status] || DEVICE_IOT_STATUS_CONFIG.co_san_may;
                  const isDone = item.status === 'da_hoan_tat';
                  const isCancelReq = Boolean(item.cancelRequested);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isCancelReq
                          ? 'bg-rose-50/70 hover:bg-rose-100/70 border-l-4 border-l-rose-500'
                          : isDone
                          ? 'bg-neutral-50/40 text-neutral-500 hover:bg-neutral-50/80'
                          : 'hover:bg-neutral-50/80'
                      }`}
                    >
                      {/* STT */}
                      <td className="py-3 px-3 text-center">
                        {(() => {
                          const globalStt = ticketSttMap.get(item.id);
                          const stepStt = filteredSttMap?.get(item.id);
                          const isFiltered = Boolean(filteredSttMap && stepStt !== undefined);
                          const displayStt = isFiltered ? stepStt : globalStt;

                          return (
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span
                                className="font-mono font-black text-neutral-900 text-xs"
                                title={
                                  isFiltered
                                    ? `STT trong danh sách lọc: ${displayStt} | STT gốc: #${globalStt}`
                                    : `STT #${displayStt}`
                                }
                              >
                                {displayStt ?? ((safeDeviceIotCurrentPage - 1) * pageSize + idx + 1)}
                              </span>
                              {isFiltered && globalStt !== undefined && (
                                <span
                                  className="font-mono text-[10px] text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 px-1 py-0.2 rounded border border-slate-300 mt-0.5 cursor-help transition-colors"
                                  title={`STT gốc trong Bảng tổng: #${globalStt}`}
                                >
                                  #{globalStt}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Số Phiếu */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-black text-neutral-900 text-xs">
                            {item.ticketNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.ticketNumber, 'Số phiếu')}
                            className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors cursor-pointer"
                            title="Sao chép số phiếu"
                          >
                            {copiedText === item.ticketNumber ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{item.bookingDate}</span>
                        </div>
                        <div
                          className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5"
                          title={`Tạo bởi: ${item.createdBy || 'Hệ thống'} • KT Tạo: ${item.creatorTechnician || 'Chưa chọn'}`}
                        >
                          <UserCircle className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {item.createdBy || 'Hệ thống'}{item.creatorTechnician ? ` • ${item.creatorTechnician}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Khách hàng & SĐT */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-neutral-900 flex items-center gap-1">
                          <User className="w-3 h-3 text-neutral-400" />
                          <span>{item.customerName}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <a
                            href={`tel:${item.customerPhone}`}
                            className="font-mono text-indigo-700 hover:underline font-bold text-[11px] flex items-center gap-1"
                          >
                            <Phone className="w-2.5 h-2.5 text-indigo-500" />
                            <span>{item.customerPhone}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.customerPhone, 'SĐT khách')}
                            className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded cursor-pointer"
                            title="Sao chép SĐT"
                          >
                            {copiedText === item.customerPhone ? (
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Thiết bị & Model */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-neutral-900 leading-tight">
                          {item.deviceName || item.deviceModel || 'Thiết bị OPPO'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {item.deviceModel && (
                            <span className="px-1.5 py-0.2 rounded bg-neutral-100 border border-neutral-200 text-neutral-700 font-mono text-[10px] font-semibold">
                              {item.deviceModel}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                              DEVICE_IOT_CATEGORY_CONFIG[item.deviceCategory || 'phone'].badgeClass
                            }`}
                          >
                            {renderCategoryIcon(item.deviceCategory)}
                            <span>{DEVICE_IOT_CATEGORY_CONFIG[item.deviceCategory || 'phone'].label}</span>
                          </span>
                          {/* Loan Deposit Badge */}
                          {item.flowType === 'customer_loan' && (
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                item.hasDeposit || item.depositType === 'co_coc'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                              }`}
                            >
                              <CircleDollarSign className="w-2.5 h-2.5" />
                              <span>
                                {item.hasDeposit || item.depositType === 'co_coc'
                                  ? `Có cọc ${item.depositAmount ? `(${Number(item.depositAmount).toLocaleString('vi-VN')}đ)` : ''}`
                                  : 'Không cọc'}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SKU & IMEI/IOT */}
                      <td className="py-3 px-3">
                        {item.skuCode ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-700">
                            <span className="text-neutral-400">SKU:</span>
                            <strong className="text-neutral-900">{item.skuCode}</strong>
                          </div>
                        ) : (
                          <div className="text-[10px] text-neutral-400 italic">Chưa có SKU</div>
                        )}
                        {item.imeiOrIot ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-indigo-900 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100 mt-1 max-w-fit">
                            <Hash className="w-3 h-3 text-indigo-500" />
                            <span>{item.imeiOrIot}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.imeiOrIot, 'IMEI/IOT')}
                              className="text-neutral-400 hover:text-indigo-700 cursor-pointer ml-0.5"
                              title="Sao chép IMEI/Serial"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] text-neutral-400 italic">Chưa có IMEI/SN</div>
                        )}
                      </td>

                      {/* Quy trình */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border shadow-2xs ${
                            flowConf.badgeClass
                          }`}
                        >
                          {item.flowType === 'customer_loan' ? (
                            <SmartphoneCharging className="w-3 h-3 text-amber-600" />
                          ) : item.flowType === 'direct_exchange' ? (
                            <Zap className="w-3 h-3 fill-current text-emerald-600" />
                          ) : (
                            <Boxes className="w-3 h-3 text-indigo-600" />
                          )}
                          <span>{flowConf.shortLabel}</span>
                        </span>
                      </td>

                      {/* Tiến độ & Trạng thái */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] border max-w-fit ${
                              statusConf.badgeBg
                            }`}
                          >
                            <span>{statusConf.label}</span>
                          </span>

                          {/* Customer Loan Borrowed & Returned Times */}
                          {item.flowType === 'customer_loan' && (
                            <div className="flex flex-col gap-0.5 text-[10px] mt-0.5">
                              {item.borrowedDate && (
                                <div className="text-amber-900 font-medium flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Mượn: <strong>{item.borrowedDate}</strong></span>
                                </div>
                              )}
                              {item.returnedDate && (
                                <div className="text-emerald-800 font-bold flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Đã trả: <strong>{item.returnedDate}</strong></span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sub status / appointment for requests */}
                          {item.status === 'da_goi_kh' && (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCallModal(item)}
                                className="text-[10px] text-purple-900 bg-purple-100/90 hover:bg-purple-200 border border-purple-200 rounded px-1.5 py-0.5 font-bold flex items-center gap-1 cursor-pointer transition-colors text-left shadow-2xs"
                                title="Bấm để xem lịch sử gọi hoặc ghi thêm lần gọi mới"
                              >
                                <PhoneCall className="w-2.5 h-2.5 text-purple-700 shrink-0" />
                                <span>
                                  Gọi: {item.calledCustomerDate}
                                  {item.callLogs && item.callLogs.length > 1 ? ` (${item.callLogs.length} lần)` : ''}
                                </span>
                              </button>

                              {item.appointmentDate && (
                                <div className="text-[10px] text-indigo-800 font-bold flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                  <span>Hẹn: {item.appointmentDate}</span>
                                </div>
                              )}

                              {item.callNote && (
                                <div
                                  onClick={() => handleOpenCallModal(item)}
                                  className="text-[10px] text-purple-950 italic bg-purple-50 hover:bg-purple-100 rounded px-1.5 py-0.5 border border-purple-200 truncate max-w-[220px] cursor-pointer"
                                  title={`Ghi chú cuộc gọi: ${item.callNote}. Bấm để xem toàn bộ lịch sử`}
                                >
                                  "{item.callNote}"
                                </div>
                              )}
                            </div>
                          )}

                          {/* Ghi chú phiếu: Cho phép tất cả User Thêm / Sửa / Xóa */}
                          {item.note ? (
                            <div className="mt-1 p-1.5 rounded-md bg-amber-50/80 border border-amber-200/80 flex items-start justify-between gap-1.5 max-w-[280px]">
                              <div className="flex items-start gap-1 min-w-0 text-[10px] text-neutral-800 leading-snug">
                                <StickyNote className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                                <span className="truncate" title={item.note}>
                                  <strong>Ghi chú:</strong> "{item.note}"
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenNoteModal(item, 'append')}
                                  className="p-0.5 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                                  title="Thêm nội dung vào ghi chú (Tất cả User đều có thể thêm)"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenNoteModal(item, 'edit')}
                                  className="p-0.5 text-amber-700 hover:bg-amber-100 rounded cursor-pointer"
                                  title="Sửa ghi chú (Tất cả User đều có thể sửa)"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickDeleteNote(item)}
                                  className="p-0.5 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                  title="Xóa ghi chú này (Tất cả User đều có thể xóa)"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenNoteModal(item, 'add')}
                              className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-bold text-neutral-400 hover:text-amber-800 cursor-pointer"
                              title="Thêm ghi chú cho phiếu này"
                            >
                              <Plus className="w-2.5 h-2.5 text-amber-600" />
                              <span>+ Ghi chú</span>
                            </button>
                          )}

                          {/* Pending Cancel Request Notice & Admin Quick Action */}
                          {item.cancelRequested && (
                            <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-left shadow-2xs">
                              <div className="flex items-center gap-1 text-[11px] font-black text-rose-800">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                                <span>Yêu cầu xóa ({item.cancelRequestedBy || 'Nhân viên'})</span>
                              </div>
                              {item.cancelReason && (
                                <div className="text-[10px] text-rose-700 mt-0.5 italic break-words">
                                  "{item.cancelReason}"
                                </div>
                              )}
                              {isAdmin && (
                                <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-rose-200/80">
                                  <button
                                    type="button"
                                    onClick={() => setDeletingBookingConfirm(item)}
                                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded shadow-xs cursor-pointer flex items-center gap-1"
                                    title="Duyệt và xóa vĩnh viễn phiếu khỏi hệ thống Cloud"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Duyệt Xóa</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdminRejectCancel(item)}
                                    className="px-2 py-0.5 bg-white hover:bg-neutral-100 text-neutral-700 font-semibold text-[10px] rounded border border-neutral-300 cursor-pointer flex items-center gap-1"
                                    title="Bác bỏ yêu cầu xóa này"
                                  >
                                    <X className="w-3 h-3 text-neutral-500" />
                                    <span>Bác Bỏ</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Vị trí kệ/tủ */}
                      <td className="py-3 px-3">
                        {item.location ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono font-bold text-[11px]">
                            <MapPin className="w-3 h-3 text-amber-600" />
                            <span>{item.location}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400 italic">Chưa xếp vị trí</span>
                        )}
                      </td>

                      {/* 1-Click Next Step Handler */}
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {/* Customer Loan Flow Steps */}
                          {item.flowType === 'customer_loan' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLoanItem(item);
                                  setIsLoanAgreementModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                title="In Biên Bản Mượn Máy Điện Thoại Dự Phòng (A4 Chuẩn)"
                              >
                                <Printer className="w-3 h-3" />
                                <span>In Biên Bản A4</span>
                              </button>
                              {item.status === 'dang_muon' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReturnModal(item)}
                                  className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[11px] rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition-all border border-neutral-800"
                                  title="Khách mang máy đến trả, bấm để nhận máy và hoàn trả cọc"
                                >
                                  <ArrowRightLeft className="w-3 h-3" />
                                  <span>Khách Trả Máy</span>
                                </button>
                              )}
                              {item.status === 'da_tra' && (
                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Đã trả ({item.loanReceivedBy || 'KTV'})</span>
                                </span>
                              )}
                            </>
                          )}

                          {/* Direct Exchange Flow Steps */}
                          {item.flowType === 'direct_exchange' && (
                            <>
                              {item.status === 'co_san_may' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(item)}
                                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Đã có sẵn máy, bấm để ghi nhận cuộc gọi báo khách"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>Gọi khách lên</span>
                                </button>
                              )}

                              {item.status === 'da_goi_kh' && (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCallModal(item)}
                                    className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                    title="Bấm để xem lịch sử gọi hoặc ghi thêm lần gọi mới"
                                  >
                                    <PhoneCall className="w-2.5 h-2.5 text-purple-600" />
                                    <span>{item.callLogs && item.callLogs.length > 1 ? `Gọi lại (${item.callLogs.length})` : 'Gọi lại'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCompleteModal(item)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all animate-bounce"
                                    title="Khách đã lên nhận máy, hoàn tất bàn giao"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Khách đã lên (Xong)</span>
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {/* Request Device Flow Steps */}
                          {item.flowType === 'request_device' && (
                            <>
                              {item.status === 'cho_xin_may' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStep(item, 'da_xin_may')}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Xác nhận đã gửi đơn xin máy lên hệ thống"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  <span>2. Đã xin máy</span>
                                </button>
                              )}

                              {item.status === 'da_xin_may' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStep(item, 'da_nhap_kho')}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Hàng đã về TTBH, xác nhận nhập kho"
                                >
                                  <Boxes className="w-3 h-3" />
                                  <span>3. Nhập kho</span>
                                </button>
                              )}

                              {item.status === 'da_nhap_kho' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(item)}
                                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Hàng đã trong kho, bấm để gọi khách lên nhận"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>4. Gọi khách lên</span>
                                </button>
                              )}

                              {item.status === 'da_goi_kh' && (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCallModal(item)}
                                    className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                    title="Bấm để xem lịch sử gọi hoặc ghi thêm lần gọi mới"
                                  >
                                    <PhoneCall className="w-2.5 h-2.5 text-purple-600" />
                                    <span>{item.callLogs && item.callLogs.length > 1 ? `Gọi lại (${item.callLogs.length})` : 'Gọi lại'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCompleteModal(item)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all animate-bounce"
                                    title="Khách đã lên nhận máy, hoàn tất bàn giao"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>5. Khách đã lên (Xong)</span>
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {isDone && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Hoàn tất ({item.technicianName || 'KTV'})</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Menu */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                            title="Chỉnh sửa thông tin phiếu"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleInitiateDelete(item)}
                              className="p-1 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Xóa phiếu (Quản trị viên)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : item.cancelRequested ? (
                            <button
                              type="button"
                              onClick={() =>
                                onShowToast(
                                  `Phiếu [${item.ticketNumber}] đã được gửi yêu cầu xóa (${item.cancelReason || 'Chờ duyệt'}), đang chờ Quản trị viên xử lý!`,
                                  'info'
                                )
                              }
                              className="p-1 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                              title="Đang chờ Quản trị viên duyệt xóa"
                            >
                              <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInitiateDelete(item)}
                              className="p-1 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Yêu cầu Quản trị viên xóa phiếu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredBookings.length > 0 && (
        <PaginationControl
          currentPage={safeDeviceIotCurrentPage}
          totalItems={filteredBookings.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo({ top: 380, behavior: 'smooth' });
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="phiếu đặt chờ máy & IOT"
          className="mt-3"
        />
      )}

      {/* MODAL: CREATE / EDIT TICKET */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-2xl overflow-hidden my-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600/30 rounded-lg border border-blue-500/40">
                  <Smartphone className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    {editingItem ? 'Chỉnh Sửa Phiếu Đặt Chờ Máy & IOT' : 'Tạo Phiếu Đặt Chờ Máy & IOT Mới'}
                  </h3>
                  <p className="text-xs text-blue-200/80 font-mono">
                    Số phiếu: <strong className="text-white font-mono">{formData.ticketNumber}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveItem} className="p-5 flex flex-col gap-4 text-xs">
              {/* FLOW TYPE SELECTION (Crucial User Requirement) */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Chọn Quy Trình Xử Lý:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Option 1: Direct Exchange */}
                  <label
                    className={`p-2.5 rounded-xl border-2 flex flex-col gap-1 cursor-pointer transition-all ${
                      formData.flowType === 'direct_exchange'
                        ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500/20'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-emerald-950 text-xs">
                        <Zap className="w-3.5 h-3.5 text-emerald-600 fill-current" />
                        <span>1. Có sẵn (Đổi trực tiếp)</span>
                      </div>
                      <input
                        type="radio"
                        name="flowType"
                        checked={formData.flowType === 'direct_exchange'}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            flowType: 'direct_exchange',
                            status: 'co_san_may',
                          })
                        }
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="text-[10px] text-neutral-600 mt-0.5">
                      Có sẵn máy ➔ Gọi khách lên ➔ Hoàn thành
                    </p>
                  </label>

                  {/* Option 2: Request Flow */}
                  <label
                    className={`p-2.5 rounded-xl border-2 flex flex-col gap-1 cursor-pointer transition-all ${
                      formData.flowType === 'request_device'
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-1 ring-indigo-500/20'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs">
                        <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                        <span>2. Chờ xin máy & IOT</span>
                      </div>
                      <input
                        type="radio"
                        name="flowType"
                        checked={formData.flowType === 'request_device'}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            flowType: 'request_device',
                            status: 'cho_xin_may',
                          })
                        }
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[10px] text-neutral-600 mt-0.5">
                      Chờ xin ➔ Đã xin ➔ Nhập kho ➔ Gọi KH ➔ Hoàn thành
                    </p>
                  </label>

                  {/* Option 3: Customer Loan Flow (User Request) */}
                  <label
                    className={`p-2.5 rounded-xl border-2 flex flex-col gap-1 cursor-pointer transition-all ${
                      formData.flowType === 'customer_loan'
                        ? 'border-amber-500 bg-orange-50/80 shadow-xs ring-1 ring-amber-500/20'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-orange-950 text-xs">
                        <SmartphoneCharging className="w-3.5 h-3.5 text-amber-600" />
                        <span>3. Máy khách mượn</span>
                      </div>
                      <input
                        type="radio"
                        name="flowType"
                        checked={formData.flowType === 'customer_loan'}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            flowType: 'customer_loan',
                            status: formData.status === 'da_tra' ? 'da_tra' : 'dang_muon',
                            borrowedDate: formData.borrowedDate || formatLoanTimeVi(),
                          })
                        }
                        className="text-amber-600 focus:ring-amber-500"
                      />
                    </div>
                    <p className="text-[10px] text-neutral-600 mt-0.5">
                      Cho khách mượn ➔ Đang mượn (Có cọc/Không cọc) ➔ Khách trả
                    </p>
                  </label>
                </div>
              </div>

              {/* Conditional Grouped Form Layout */}
              {formData.flowType === 'customer_loan' ? (
                /* LOAN FLOW GROUPED SECTIONS */
                <div className="space-y-4">
                  {/* --- NHÓM 1: BÊN A (THÔNG TIN TRUNG TÂM BẢO HÀNH & ĐIỆN THOẠI KHÁCH MƯỢN) --- */}
                  <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <span className="font-extrabold text-amber-950 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                        <SmartphoneCharging className="w-4 h-4 text-amber-600" />
                        <span>🏢 NHÓM 1: BÊN A (TRUNG TÂM BẢO HÀNH & ĐIỆN THOẠI KHÁCH MƯỢN)</span>
                      </span>
                    </div>

                    {/* Selector Trung Tâm Bên A */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-amber-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Trung Tâm Bên A (Đối tác bảo hành):</span>
                        </label>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setIsCenterManagerOpen(true)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
                          >
                            <span>⚙ Quản lý danh sách TTBH</span>
                          </button>
                        )}
                      </div>
                      <select
                        value={formData.warrantyCenterName || warrantyCenters[0]?.name || ''}
                        onChange={(e) => {
                          const chosenName = e.target.value;
                          const chosen = warrantyCenters.find(c => c.name === chosenName);
                          if (chosen) {
                            setFormData(prev => ({
                              ...prev,
                              warrantyCenterName: chosen.name,
                              warrantyCenterPhone: chosen.phone
                            }));
                          }
                        }}
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none text-xs font-semibold text-neutral-800"
                      >
                        {warrantyCenters.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} - {c.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Chi Tiết Máy Cho Mượn */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Model Máy (Mã Model) *</label>
                        <input
                          type="text"
                          value={formData.deviceModel || ''}
                          onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                          placeholder="VD: RENO 3 PRO, CPH2659..."
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Tên Máy / Tên Thiết Bị *</label>
                        <input
                          type="text"
                          value={formData.deviceName || ''}
                          onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                          placeholder="VD: OPPO Reno 3 Pro"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Mã SKU</label>
                        <input
                          type="text"
                          value={formData.skuCode || ''}
                          onChange={(e) => setFormData({ ...formData, skuCode: e.target.value })}
                          placeholder="VD: 601011002341"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">IMEI Máy / S/N (Điện thoại dự phòng)</label>
                        <input
                          type="text"
                          value={formData.imeiOrIot || ''}
                          onChange={(e) => setFormData({ ...formData, imeiOrIot: e.target.value })}
                          placeholder="VD: 555555555555555"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Giá Máy Mượn:</label>
                        <input
                          type="text"
                          value={formData.loanDevicePrice || ''}
                          onChange={(e) => setFormData({ ...formData, loanDevicePrice: e.target.value })}
                          placeholder="VD: 5.000.000đ"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none font-mono font-bold text-amber-900"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Phụ Kiện Kèm Theo Khi Mượn:</label>
                        <input
                          type="text"
                          value={formData.loanAccessories || ''}
                          onChange={(e) => setFormData({ ...formData, loanAccessories: e.target.value })}
                          placeholder="VD: Máy trần"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Tình Trạng Máy Khi Mượn:</label>
                        <input
                          type="text"
                          value={formData.loanCondition || ''}
                          onChange={(e) => setFormData({ ...formData, loanCondition: e.target.value })}
                          placeholder="VD: Máy hoạt động tốt, màn hình và vỏ đẹp"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Vị Trí Kệ / Tủ Lưu Máy</label>
                        <input
                          type="text"
                          value={formData.location || ''}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          placeholder="VD: Tủ Máy Mượn"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Mốc thời gian & Cọc mượn máy */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 border-t border-amber-200/60 pt-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Khách đã mượn thời gian (dd/mm/yyyy HH:mm) *:</span>
                        </label>
                        <DateTimePicker
                          value={formData.borrowedDate || ''}
                          onChange={(val) => setFormData({ ...formData, borrowedDate: val })}
                          placeholder="Chọn ngày giờ mượn"
                          colorScheme="amber"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Khách đã trả thời gian (dd/mm/yyyy HH:mm):</span>
                        </label>
                        <DateTimePicker
                          value={formData.returnedDate || ''}
                          onChange={(val) => setFormData({ ...formData, returnedDate: val })}
                          placeholder="Để trống nếu máy đang mượn"
                          colorScheme="emerald"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-800 flex items-center gap-1">
                          <CircleDollarSign className="w-3.5 h-3.5 text-amber-600" />
                          <span>Có cọc hay không:</span>
                        </label>
                        <select
                          value={formData.depositType || (formData.hasDeposit ? 'co_coc' : 'khong_coc')}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setFormData({
                              ...formData,
                              depositType: val,
                              hasDeposit: val === 'co_coc',
                            });
                          }}
                          className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold text-neutral-800 text-xs"
                        >
                          <option value="khong_coc">❌ Không cọc</option>
                          <option value="co_coc">💰 Có cọc tiền</option>
                          <option value="giu_giay_to">📄 Giữ giấy tờ tùy thân</option>
                        </select>
                      </div>
                      {(formData.depositType === 'co_coc' || formData.hasDeposit) && (
                        <div className="flex flex-col gap-1 animate-in fade-in">
                          <label className="font-bold text-neutral-800">Số Tiền Cọc (VNĐ):</label>
                          <input
                            type="number"
                            value={formData.depositAmount || ''}
                            onChange={(e) => setFormData({ ...formData, depositAmount: Number(e.target.value) })}
                            placeholder="VD: 2000000"
                            className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono font-bold text-amber-900"
                          />
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Số Tiền Cọc Bằng Chữ:</label>
                        <input
                          type="text"
                          value={formData.depositAmountInWords || ''}
                          onChange={(e) => setFormData({ ...formData, depositAmountInWords: e.target.value })}
                          placeholder="VD: Năm triệu đồng chẵn"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Phương Thức Thanh Toán:</label>
                        <input
                          type="text"
                          value={formData.paymentMethod || ''}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                          placeholder="VD: Tiền mặt"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* --- NHÓM 2: BÊN B (THÔNG TIN KHÁCH HÀNG BÊN MƯỢN & MÁY GỬI SỬA CHỮA) --- */}
                  <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                      <span className="font-extrabold text-indigo-950 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                        <Handshake className="w-4 h-4 text-indigo-700" />
                        <span>👤 NHÓM 2: BÊN B (THÔNG TIN KHÁCH HÀNG BÊN MƯỢN & MÁY GỬI SỬA CHỮA)</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Tên Khách Hàng (Bên B) *</label>
                        <input
                          type="text"
                          required
                          value={formData.customerName || ''}
                          onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                          placeholder="VD: Nguyễn Văn A"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Số Điện Thoại (Bên B) *</label>
                        <input
                          type="tel"
                          required
                          value={formData.customerPhone || ''}
                          onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                          placeholder="VD: 0901234567"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Số CMND/CCCD Bên Mượn:</label>
                        <input
                          type="text"
                          value={formData.citizenId || ''}
                          onChange={(e) => setFormData({ ...formData, citizenId: e.target.value })}
                          placeholder="VD: 079204012345"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Số Hồ Sơ / Order:</label>
                        <input
                          type="text"
                          value={formData.fileNumber || ''}
                          onChange={(e) => setFormData({ ...formData, fileNumber: e.target.value })}
                          placeholder="VD: HS-2026-0927"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5 pt-3 border-t border-indigo-200/50">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Model Máy Gửi Sửa:</label>
                        <input
                          type="text"
                          value={formData.repairModel || ''}
                          onChange={(e) => setFormData({ ...formData, repairModel: e.target.value })}
                          placeholder="VD: OPPO Reno8 5G"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none font-bold text-indigo-900"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Màu Sắc Máy Gửi Sửa:</label>
                        <input
                          type="text"
                          value={formData.repairColor || ''}
                          onChange={(e) => setFormData({ ...formData, repairColor: e.target.value })}
                          placeholder="VD: Đen"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">S/N Máy Gửi Sửa:</label>
                        <input
                          type="text"
                          value={formData.repairSn || ''}
                          onChange={(e) => setFormData({ ...formData, repairSn: e.target.value })}
                          placeholder="VD: SN123456789"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">IMEI Máy Gửi Sửa:</label>
                        <input
                          type="text"
                          value={formData.repairImei || ''}
                          onChange={(e) => setFormData({ ...formData, repairImei: e.target.value })}
                          placeholder="VD: 864576081282570"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Ngày Gửi Sửa:</label>
                        <input
                          type="text"
                          value={formData.repairDate || ''}
                          onChange={(e) => setFormData({ ...formData, repairDate: e.target.value })}
                          placeholder="VD: 27/09/2026"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-neutral-700">Dự Kiến Số Ngày Sửa:</label>
                        <input
                          type="text"
                          value={formData.repairDays || ''}
                          onChange={(e) => setFormData({ ...formData, repairDays: e.target.value })}
                          placeholder="VD: 3"
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hidden fields for Loan Flow to keep full compatibility */}
                  <div className="hidden">
                    <input
                      type="text"
                      value={formData.ticketNumber || ''}
                      onChange={(e) => setFormData({ ...formData, ticketNumber: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                /* STANDARD CLASSIC CLASSIFIED WORKFLOW - 100% UNTOUCHED */
                <>
                  {/* Customer Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">Tên Khách Hàng *</label>
                      <input
                        type="text"
                        required
                        value={formData.customerName || ''}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        placeholder="VD: Nguyễn Văn A"
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">Số Điện Thoại *</label>
                      <input
                        type="tel"
                        required
                        value={formData.customerPhone || ''}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        placeholder="VD: 0901234567"
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Device Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">Model Máy (Mã Model) *</label>
                      <input
                        type="text"
                        value={formData.deviceModel || ''}
                        onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                        placeholder="VD: RENO 3 PRO, Find X8 Pro, CPH2659..."
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">Phân Loại Thiết Bị</label>
                      <select
                        value={formData.deviceCategory || 'phone'}
                        onChange={(e) => setFormData({ ...formData, deviceCategory: e.target.value as any })}
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="phone">📱 Điện Thoại</option>
                        <option value="pad">📱 Máy Tính Bảng (Pad)</option>
                        <option value="watch">⌚ Đồng Hồ / Smartwatch</option>
                        <option value="audio">🎧 Tai Nghe / Loa</option>
                        <option value="iot">📻 Thiết Bị IOT Khác</option>
                        <option value="accessory">🔌 Phụ Kiện</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">Tên Máy / Tên Thiết Bị *</label>
                      <input
                        type="text"
                        value={formData.deviceName || ''}
                        onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                        placeholder="VD: OPPO Reno 3 Pro (8GB/256GB) hoặc Find X8 Pro"
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">Mã SKU</label>
                      <input
                        type="text"
                        value={formData.skuCode || ''}
                        onChange={(e) => setFormData({ ...formData, skuCode: e.target.value })}
                        placeholder="VD: 601011002341"
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">IMEI Máy ( hoặc Serial IOT )</label>
                      <input
                        type="text"
                        value={formData.imeiOrIot || ''}
                        onChange={(e) => setFormData({ ...formData, imeiOrIot: e.target.value })}
                        placeholder="VD: 864192068899123 hoặc SN: WX240801..."
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">Vị Trí Kệ / Tủ Lưu Máy</label>
                      <input
                        type="text"
                        value={formData.location || ''}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="VD: Tủ Máy Mượn, Kệ A1, Tủ IOT..."
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700">Số Phiếu</label>
                      <input
                        type="text"
                        value={formData.ticketNumber || ''}
                        onChange={(e) => setFormData({ ...formData, ticketNumber: e.target.value })}
                        placeholder="VD: VN001021-AS2608290003"
                        className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* TIMESTAMPS SECTION - CRITICAL USER REQUIREMENT: dd/mm/yyyy HH:mm with Calendar Picker */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>⏰ Mốc Thời Gian Các Bước (Định dạng: dd/mm/yyyy HH:mm)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Chọn lịch & giờ chính xác
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Booking Date */}
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-neutral-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-600" />
                      <span>Thời Gian Tiếp Nhận / Tạo Phiếu:</span>
                    </label>
                    <DateTimePicker
                      value={formData.bookingDate || ''}
                      onChange={(val) => setFormData({ ...formData, bookingDate: val })}
                      placeholder="dd/mm/yyyy HH:mm"
                      colorScheme="indigo"
                    />
                  </div>

                  {/* 2. Requested Date (Xin máy) */}
                  {formData.flowType === 'request_device' && (
                    <div className="flex flex-col gap-1 animate-in fade-in">
                      <label className="font-bold text-neutral-700 flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-indigo-600" />
                        <span>Thời Gian Xin Máy:</span>
                      </label>
                      <DateTimePicker
                        value={formData.requestedDate || ''}
                        onChange={(val) => setFormData({ ...formData, requestedDate: val })}
                        placeholder="dd/mm/yyyy HH:mm"
                        colorScheme="indigo"
                      />
                    </div>
                  )}

                  {/* 3. Stocked in Date (Nhập kho) */}
                  {formData.flowType === 'request_device' && (
                    <div className="flex flex-col gap-1 animate-in fade-in">
                      <label className="font-bold text-neutral-700 flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-amber-600" />
                        <span>Thời Gian Nhập Kho:</span>
                      </label>
                      <DateTimePicker
                        value={formData.stockedInDate || ''}
                        onChange={(val) => setFormData({ ...formData, stockedInDate: val })}
                        placeholder="dd/mm/yyyy HH:mm"
                        colorScheme="amber"
                      />
                    </div>
                  )}

                  {/* 4. Called Customer Date (Gọi khách) */}
                  {formData.flowType !== 'customer_loan' && (
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700 flex items-center gap-1">
                        <PhoneCall className="w-3 h-3 text-purple-600" />
                        <span>Thời Gian Gọi Khách:</span>
                      </label>
                      <DateTimePicker
                        value={formData.calledCustomerDate || ''}
                        onChange={(val) => setFormData({ ...formData, calledCustomerDate: val })}
                        placeholder="dd/mm/yyyy HH:mm"
                        colorScheme="purple"
                      />
                    </div>
                  )}

                  {/* 5. Appointment Date (Hẹn khách lên) */}
                  {formData.flowType !== 'customer_loan' && (
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-purple-600" />
                        <span>Thời Gian Hẹn Khách Lên:</span>
                      </label>
                      <DateTimePicker
                        value={formData.appointmentDate || ''}
                        onChange={(val) => setFormData({ ...formData, appointmentDate: val })}
                        placeholder="dd/mm/yyyy HH:mm"
                        colorScheme="purple"
                      />
                    </div>
                  )}

                  {/* 6. Customer Arrived Date (Khách lên) */}
                  {formData.flowType !== 'customer_loan' && (
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-neutral-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Thời Gian Khách Lên / Hoàn Tất:</span>
                      </label>
                      <DateTimePicker
                        value={formData.customerArrivedDate || ''}
                        onChange={(val) => setFormData({ ...formData, customerArrivedDate: val })}
                        placeholder="dd/mm/yyyy HH:mm"
                        colorScheme="emerald"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Personnel Section: User Tạo & KT Tạo & KTV Xử Lý */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <UserSelector
                    label="User Tạo Phiếu:"
                    value={formData.createdBy || ''}
                    onChange={(val) => setFormData({ ...formData, createdBy: val })}
                    currentUser={currentUser}
                    isAdmin={currentUser?.role === 'admin' || !editingItem}
                    placeholder="Chọn hoặc nhập User tạo phiếu..."
                  />
                </div>

                <div>
                  <TechnicianSelector
                    label="Kỹ Thuật Tạo Phiếu:"
                    value={formData.creatorTechnician || ''}
                    onChange={(val) => setFormData({ ...formData, creatorTechnician: val })}
                    technicians={masterTechnicians}
                    placeholder="Chọn KTV tạo phiếu..."
                    currentUser={currentUser}
                    isAdmin={currentUser?.role === 'admin'}
                    colorScheme="indigo"
                    icon={<Wrench className="w-3.5 h-3.5 text-indigo-600" />}
                  />
                </div>

                <div>
                  <TechnicianSelector
                    label="KTV Tiếp Nhận / Xử Lý:"
                    value={formData.technicianName || ''}
                    onChange={(val) => setFormData({ ...formData, technicianName: val })}
                    technicians={masterTechnicians}
                    placeholder="Chọn KTV xử lý..."
                    currentUser={currentUser}
                    isAdmin={currentUser?.role === 'admin'}
                    colorScheme="emerald"
                    icon={<Wrench className="w-3.5 h-3.5 text-emerald-600" />}
                  />
                </div>
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-700">Ghi Chú Chi Tiết</label>
                <textarea
                  rows={2}
                  value={formData.note || ''}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Ghi chú tình trạng lỗi, phụ kiện kèm theo, thỏa thuận với khách..."
                  className="px-3 py-2 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-neutral-200">
                <div>
                  {editingItem && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        handleInitiateDelete(editingItem);
                      }}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg border border-rose-200 cursor-pointer flex items-center gap-1.5 transition-colors"
                      title={isAdmin ? 'Xóa phiếu vĩnh viễn (Admin)' : 'Gửi yêu cầu xóa phiếu đến Quản trị viên'}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>{isAdmin ? 'Xóa Phiếu (Admin)' : 'Yêu Cầu Xóa Phiếu'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingItem ? 'Lưu Thay Đổi' : 'Tạo Phiếu Mới'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST DEVICE STEP (XIN MÁY) */}
      {requestingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600/30 rounded-lg border border-blue-500/40">
                  <Boxes className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Xác Nhận Xin Máy & IOT</h3>
                  <p className="text-xs text-blue-200/80 font-mono">{requestingItem.ticketNumber} • {requestingItem.customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRequestingItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRequestStep} className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 flex flex-col gap-1">
                <div className="font-bold text-indigo-950 text-xs">
                  Khách: {requestingItem.customerName} ({requestingItem.customerPhone})
                </div>
                <div className="text-neutral-700 text-[11px]">
                  Thiết bị cần xin: <strong>{requestingItem.deviceName || requestingItem.deviceModel}</strong> ({requestingItem.deviceModel})
                </div>
              </div>

              {/* Request Date Time */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Thời Gian Xin Máy (dd/mm/yyyy HH:mm) *:</span>
                </label>
                <DateTimePicker
                  value={requestDate}
                  onChange={(val) => setRequestDate(val)}
                  placeholder="Chọn thời gian xin máy"
                  colorScheme="indigo"
                />
              </div>

              {/* Request Note */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800">Ghi Chú Gửi Đơn Xin Máy (Tùy chọn):</label>
                <textarea
                  rows={2}
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="Ghi chú mã SO/PO, đơn vị xin máy..."
                  className="px-3 py-2 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setRequestingItem(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác Nhận Đã Xin Máy</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK IN STEP (NHẬP KHO) */}
      {stockingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-600/30 rounded-lg border border-amber-500/40">
                  <Boxes className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Xác Nhận Hàng Về Nhập Kho</h3>
                  <p className="text-xs text-amber-200/80 font-mono">{stockingItem.ticketNumber} • {stockingItem.customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockingItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockStep} className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex flex-col gap-1">
                <div className="font-bold text-amber-950 text-xs">
                  Khách: {stockingItem.customerName} ({stockingItem.customerPhone})
                </div>
                <div className="text-neutral-700 text-[11px]">
                  Thiết bị về kho: <strong>{stockingItem.deviceName || stockingItem.deviceModel}</strong> ({stockingItem.deviceModel})
                </div>
              </div>

              {/* Stock in Date Time */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Thời Gian Nhập Kho (dd/mm/yyyy HH:mm) *:</span>
                </label>
                <DateTimePicker
                  value={stockDate}
                  onChange={(val) => setStockDate(val)}
                  placeholder="Chọn thời gian nhập kho"
                  colorScheme="amber"
                />
              </div>

              {/* Stock Location */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800">Vị Trí Kệ / Tủ Lưu Kho *:</label>
                <input
                  type="text"
                  required
                  value={stockLocation}
                  onChange={(e) => setStockLocation(e.target.value)}
                  placeholder="VD: Kệ A1, Tủ Máy Mới, Khay 3..."
                  className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>

              {/* Stock Note */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800">Ghi Chú Nhập Kho (Tùy chọn):</label>
                <textarea
                  rows={2}
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  placeholder="Ghi chú kiện hàng, tình trạng bao bì..."
                  className="px-3 py-2 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setStockingItem(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác Nhận Đã Nhập Kho</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CALL CUSTOMER with Multi-call History */}
      {callingItem && (
        <CustomerCallModal
          isOpen={Boolean(callingItem)}
          onClose={() => setCallingItem(null)}
          ticketNumber={callingItem.ticketNumber}
          customerName={callingItem.customerName}
          customerPhone={callingItem.customerPhone}
          itemDetail={`${callingItem.deviceName || callingItem.deviceModel || "Thiết bị"}${callingItem.imeiOrIot ? ` (IMEI/Serial: ${callingItem.imeiOrIot})` : ""}`}
          initialCalledDate={callingItem.calledCustomerDate}
          initialSubStatus={callingItem.callSubStatus}
          initialAppointmentDate={callingItem.appointmentDate}
          initialNote={callingItem.callNote}
          callLogs={callingItem.callLogs}
          currentUserName={currentUser?.name}
          moduleType="deviceIot"
          onSave={handleSaveCustomerCall}
          onShowToast={onShowToast}
        />
      )}

      {/* Quick Ticket Note Modal for All Users */}
      {noteModalItem && (
        <TicketNoteModal
          isOpen={Boolean(noteModalItem)}
          onClose={() => setNoteModalItem(null)}
          ticketNumber={noteModalItem.ticketNumber}
          customerName={noteModalItem.customerName}
          currentNote={noteModalItem.note}
          currentUserName={currentUser?.name || 'KTV HCM4'}
          initialMode={noteModalMode}
          onSaveNote={handleSaveNote}
          onDeleteNote={() => handleDeleteNote(noteModalItem)}
        />
      )}

      {/* MODAL: COMPLETE / HANDOVER (KHÁCH ĐÃ LÊN) */}
      {completingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-600/30 rounded-lg border border-emerald-500/40">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Hoàn Tất Bàn Giao Máy / IOT</h3>
                  <p className="text-xs text-emerald-200/80 font-mono">{completingItem.ticketNumber} • {completingItem.customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompletingItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveComplete} className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col gap-1">
                <div className="font-bold text-emerald-950 text-xs">
                  Khách hàng: {completingItem.customerName} ({completingItem.customerPhone})
                </div>
                <div className="text-neutral-700 text-[11px]">
                  Thiết bị đổi: <strong>{completingItem.deviceName || completingItem.deviceModel}</strong>
                </div>
                <div className="text-neutral-700 text-[11px] font-mono">
                  IMEI / Serial: <strong>{completingItem.imeiOrIot}</strong>
                </div>
              </div>

              {/* Thời gian khách lên */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Thời Gian Khách Lên / Bàn Giao Xong (dd/mm/yyyy HH:mm) *:</span>
                </label>
                <DateTimePicker
                  value={customerArrivedDate}
                  onChange={(val) => setCustomerArrivedDate(val)}
                  placeholder="Chọn thời gian khách lên bàn giao"
                  colorScheme="emerald"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800">Kỹ Thuật Viên / Nhân Viên Bàn Giao *</label>
                <input
                  type="text"
                  required
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="Nhập tên KTV tiếp nhận bàn giao..."
                  className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800">Ghi Chú Bàn Giao (Tùy chọn):</label>
                <textarea
                  rows={2}
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Ghi chú thêm về quà tặng, hóa đơn, linh kiện kèm theo..."
                  className="px-3 py-2 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setCompletingItem(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Đã Bàn Giao Xong</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RETURN LOANED DEVICE */}
      {returningItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-600/30 rounded-lg border border-indigo-500/40">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Tiếp Nhận Khách Trả Máy Mượn</h3>
                  <p className="text-xs text-indigo-200/80 font-mono">{returningItem.ticketNumber} • {returningItem.customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturningItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReturnLog} className="p-5 flex flex-col gap-4 text-xs">
              {/* Summary info box */}
              <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 flex flex-col gap-1.5">
                <div className="font-bold text-amber-950 text-xs flex items-center justify-between">
                  <span>Khách hàng: {returningItem.customerName}</span>
                  <span className="font-mono text-neutral-600">{returningItem.customerPhone}</span>
                </div>
                <div className="text-neutral-700 text-[11px]">
                  Thiết bị: <strong>{returningItem.deviceName || returningItem.deviceModel}</strong> ({returningItem.deviceModel})
                </div>
                {returningItem.imeiOrIot && (
                  <div className="text-neutral-700 text-[11px] font-mono">
                    IMEI/Serial: <strong>{returningItem.imeiOrIot}</strong>
                  </div>
                )}
                {returningItem.borrowedDate && (
                  <div className="text-amber-900 text-[11px] flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Thời gian mượn: <strong>{returningItem.borrowedDate}</strong></span>
                  </div>
                )}
                {/* Deposit alert */}
                <div className="pt-1.5 mt-1 border-t border-amber-200/80 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-950 flex items-center gap-1">
                    <CircleDollarSign className="w-3.5 h-3.5 text-amber-600" />
                    <span>Cọc máy:</span>
                  </span>
                  <span className="font-black font-mono text-amber-900 px-2 py-0.5 rounded bg-amber-100 border border-amber-300">
                    {returningItem.hasDeposit || returningItem.depositType === 'co_coc'
                      ? `Có cọc: ${returningItem.depositAmount ? Number(returningItem.depositAmount).toLocaleString('vi-VN') : 0} VNĐ (Nhớ hoàn trả)`
                      : returningItem.depositType === 'giu_giay_to'
                      ? 'Giữ giấy tờ tùy thân (Nhớ hoàn trả)'
                      : 'Không cọc'}
                  </span>
                </div>
              </div>

              {/* Returned Date Time with Calendar Picker */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Khách đã trả thời gian (dd/mm/yyyy HH:mm) *:</span>
                </label>
                <DateTimePicker
                  value={returnDate}
                  onChange={(val) => setReturnDate(val)}
                  placeholder="Chọn thời gian khách trả máy"
                  colorScheme="amber"
                />
              </div>

              {/* Received By */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800">Nhân Viên / KTV Nhận Lại Máy *</label>
                <input
                  type="text"
                  required
                  value={returnReceivedBy}
                  onChange={(e) => setReturnReceivedBy(e.target.value)}
                  placeholder="Nhập tên nhân viên nhận lại máy mượn..."
                  className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Returned Condition */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800">Tình Trạng Thiết Bị Khi Thu Hồi:</label>
                <input
                  type="text"
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  placeholder="VD: Máy nguyên vẹn, hoạt động bình thường, đủ phụ kiện..."
                  className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Return Notes */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-neutral-800">Ghi Chú Hoàn Trả & Trả Cọc (Tùy chọn):</label>
                <textarea
                  rows={2}
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="Đã hoàn trả đủ tiền cọc cho khách, khách đã ký xác nhận..."
                  className="px-3 py-2 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setReturningItem(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác Nhận Khách Đã Trả Máy</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: USER / STAFF REQUEST DELETE TICKET (YÊU CẦU XÓA TỪ ADMIN) */}
      {cancelRequestModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden my-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-rose-600/30 rounded-lg border border-rose-500/40">
                  <ShieldAlert className="w-5 h-5 text-rose-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Yêu Cầu Xóa / Hủy Phiếu</h3>
                  <p className="text-xs text-rose-200/80 font-mono">
                    {cancelRequestModalItem.ticketNumber} • {cancelRequestModalItem.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelRequestModalItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitCancelRequest} className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Lưu ý quyền hạn:</strong> Quyền nhân viên (User) không được xóa trực tiếp phiếu đặt chờ máy. Yêu cầu của bạn sẽ được gửi đến Quản trị viên (Admin) xem xét và phê duyệt xóa.
                </div>
              </div>

              {/* Ticket Quick Info */}
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mã phiếu:</span>
                  <span className="font-mono font-bold text-neutral-900">{cancelRequestModalItem.ticketNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Khách hàng:</span>
                  <span className="font-semibold text-neutral-900">{cancelRequestModalItem.customerName} ({cancelRequestModalItem.customerPhone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Thiết bị:</span>
                  <span className="font-semibold text-neutral-900">{cancelRequestModalItem.deviceName || cancelRequestModalItem.deviceModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Người yêu cầu:</span>
                  <span className="font-semibold text-indigo-700">{currentUser?.name || currentUser?.username || 'Nhân viên'}</span>
                </div>
              </div>

              {/* Reason Input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs text-neutral-800 flex items-center justify-between">
                  <span>Lý do yêu cầu xóa / hủy phiếu <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-neutral-400 font-normal">Bắt buộc nhập</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Ví dụ: Khách báo đổi ý không lấy máy nữa, thông tin nhập trùng lặp, tạo nhầm..."
                  className="px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>

              {/* Quick suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-neutral-400 font-medium">Gợi ý nhanh:</span>
                {[
                  'Khách đổi ý không lấy',
                  'Phiếu nhập trùng lặp',
                  'Tạo nhầm thông tin',
                  'Khách đã mua máy khác',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReasonInput(reason)}
                    className="px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    + {reason}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  disabled={isSubmittingCancel}
                  onClick={() => setCancelRequestModalItem(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-lg cursor-pointer transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel || !cancelReasonInput.trim()}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-all flex items-center gap-1.5 border border-neutral-800 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingCancel ? 'Đang gửi...' : 'Gửi Yêu Cầu Đến Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN DIRECT / CONFIRM DELETE TICKET (XÓA VĨNH VIỄN) */}
      {deletingBookingConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 shadow-2xl border border-neutral-200 w-full max-w-md flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-neutral-900">Xác Nhận Xóa Vĩnh Viễn Phiếu?</h4>
                <p className="text-xs text-neutral-500">Hành động này được thực hiện bởi Quản trị viên (Admin).</p>
              </div>
            </div>

            {/* Item Details */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 text-xs flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-neutral-600">Số phiếu:</span>
                <span className="font-mono font-bold text-rose-900">{deletingBookingConfirm.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Khách hàng:</span>
                <span className="font-semibold text-neutral-900">
                  {deletingBookingConfirm.customerName} ({deletingBookingConfirm.customerPhone})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Thiết bị:</span>
                <span className="font-semibold text-neutral-900">
                  {deletingBookingConfirm.deviceName || deletingBookingConfirm.deviceModel}
                </span>
              </div>

              {deletingBookingConfirm.cancelRequested && (
                <div className="mt-1.5 pt-1.5 border-t border-rose-200 text-rose-800">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>Lý do từ nhân viên ({deletingBookingConfirm.cancelRequestedBy || 'Nhân viên'}):</span>
                  </div>
                  <div className="italic mt-0.5 text-[11px]">"{deletingBookingConfirm.cancelReason || 'Không có ghi chú'}"</div>
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-500 italic">
              Phiếu sẽ bị xóa vĩnh viễn khỏi hệ thống Cloud và không thể khôi phục.
            </p>

            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingBookingConfirm(null)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-lg cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleAdminApproveDelete(deletingBookingConfirm)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Đang xóa...' : 'Xác Nhận Xóa Vĩnh Viễn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Clear All List Confirmation Modal */}
      {showClearAllConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-rose-400">
            <div className="px-5 py-3.5 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-extrabold text-sm">Xác Nhận Xóa Trắng Toàn Bộ Danh Sách Máy & IOT</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowClearAllConfirmModal(false)}
                className="p-1 hover:bg-rose-800 rounded transition-colors text-white"
                disabled={isClearingAll}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-neutral-700">
              <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 space-y-2">
                <div className="font-bold text-rose-900 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Cảnh Báo Nguy Hiểm!</span>
                </div>
                <p className="text-rose-800 leading-relaxed">
                  Hiện đang có <strong className="font-mono text-rose-950">{bookings.length} phiếu đặt chờ máy & IOT</strong> trong hệ thống.
                </p>
                <p className="text-rose-700 text-[11px]">
                  Thao tác này sẽ <strong>xóa vĩnh viễn TOÀN BỘ phiếu</strong> trên Cloud Firestore và tất cả thiết bị kết nối.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearAllConfirmModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                  disabled={isClearingAll}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleClearAllDeviceIots}
                  disabled={isClearingAll}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {isClearingAll ? (
                    <span>Đang xóa...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xác Nhận Xóa Trắng</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Admin Warranty Center Manager Modal */}
      {isCenterManagerOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden border border-neutral-300">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">Danh Sách Trung Tâm Bảo Hành (Bên A)</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCenterManagerOpen(false);
                  setEditingCenterId(null);
                  setNewCenterName('');
                  setNewCenterPhone('');
                }}
                className="p-1 hover:bg-indigo-800 rounded transition-colors text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs">
              {/* Form to Create/Edit Center */}
              <form onSubmit={handleSaveCenter} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
                <div className="font-bold text-neutral-800 text-xs">
                  {editingCenterId ? 'Chỉnh sửa trung tâm bảo hành' : 'Thêm trung tâm bảo hành mới'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-neutral-600">Tên Trung Tâm *</label>
                    <input
                      type="text"
                      value={newCenterName}
                      onChange={(e) => setNewCenterName(e.target.value)}
                      placeholder="VD: Trung tâm bảo hành OPPO (TTBH)"
                      className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-neutral-600">Số Điện Thoại Liên Hệ *</label>
                    <input
                      type="text"
                      value={newCenterPhone}
                      onChange={(e) => setNewCenterPhone(e.target.value)}
                      placeholder="VD: 028.38551234"
                      className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  {editingCenterId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCenterId(null);
                        setNewCenterName('');
                        setNewCenterPhone('');
                      }}
                      className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg font-semibold"
                    >
                      Hủy bỏ
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                  >
                    {editingCenterId ? 'Cập Nhật' : 'Thêm Mới'}
                  </button>
                </div>
              </form>

              {/* List of current Centers */}
              <div className="space-y-2">
                <div className="font-bold text-neutral-800">Danh sách hiện tại ({warrantyCenters.length})</div>
                <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-100 text-neutral-600 font-bold border-b border-neutral-200">
                      <tr>
                        <th className="p-2.5">Tên Trung Tâm</th>
                        <th className="p-2.5">Số Liên Hệ</th>
                        <th className="p-2.5 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white">
                      {warrantyCenters.map((c) => (
                        <tr key={c.id} className="hover:bg-neutral-50/50">
                          <td className="p-2.5 font-bold text-neutral-800">{c.name}</td>
                          <td className="p-2.5 font-mono text-neutral-700">{c.phone}</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCenterId(c.id);
                                  setNewCenterName(c.name);
                                  setNewCenterPhone(c.phone);
                                }}
                                className="p-1 hover:bg-neutral-100 rounded text-blue-600 cursor-pointer"
                                title="Sửa"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCenter(c.id)}
                                disabled={c.id === 'default-oppo'}
                                className={`p-1 hover:bg-neutral-100 rounded cursor-pointer \${c.id === 'default-oppo' ? 'text-neutral-300' : 'text-rose-600 hover:text-rose-700'}`}
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Agreement Print Modal */}
      {isLoanAgreementModalOpen && selectedLoanItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-neutral-300 print:shadow-none print:max-h-none print:border-none">
            {/* Modal Header (Hidden on Print) */}
            <div className="px-6 py-3.5 bg-neutral-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm uppercase tracking-wider">Biên Bản Mượn Máy Điện Thoại Dự Phòng (In Trực Tiếp)</h3>
              </div>
              <div className="flex items-center gap-2.5">
                {/* Fast Selector for Bên A Center */}
                <div className="flex items-center gap-1.5 bg-neutral-800/90 px-3 py-1 rounded-xl border border-neutral-700">
                  <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">🏢 Bên A:</span>
                  <select
                    value={selectedLoanItem.warrantyCenterName || warrantyCenters[0]?.name || ''}
                    onChange={(e) => {
                      const chosenName = e.target.value;
                      const chosen = warrantyCenters.find(c => c.name === chosenName);
                      if (chosen && selectedLoanItem) {
                        const updatedItem: DeviceIotBookingItem = {
                          ...selectedLoanItem,
                          warrantyCenterName: chosen.name,
                          warrantyCenterPhone: chosen.phone,
                          updatedAt: new Date().toISOString(),
                        };
                        setSelectedLoanItem(updatedItem);
                        const newBookings = bookings.map(b => b.id === selectedLoanItem.id ? updatedItem : b);
                        onUpdateBookings(newBookings);
                        saveDeviceIotToCloud(updatedItem).catch(() => null);
                        onShowToast(`Đã chọn Bên A: ${chosen.name}`, 'success');
                      }
                    }}
                    className="bg-neutral-900 text-white text-xs px-2 py-1 rounded-lg border border-neutral-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium cursor-pointer"
                  >
                    {warrantyCenters.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} - {c.phone}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleExecutePrintLoan}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>In Biên Bản Ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoanAgreementModalOpen(false);
                    setSelectedLoanItem(null);
                  }}
                  className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div id="loan-agreement-printable-area" className="p-6 sm:p-8 overflow-y-auto space-y-3 text-sm font-sans text-neutral-900 bg-white print:p-0 print:overflow-visible">
              <div className="flex items-center justify-between pb-3 border-b-2 border-neutral-900">
                <div className="text-left space-y-1">
                  <h1 className="text-base sm:text-xl font-black tracking-tight uppercase">BIÊN BẢN MƯỢN MÁY ĐIỆN THOẠI DỰ PHÒNG</h1>
                  <div className="flex gap-6 sm:gap-8 text-xs sm:text-sm font-bold pt-0.5">
                    <span>Số Đơn Hàng: <strong className="font-mono">{selectedLoanItem.ticketNumber}</strong></span>
                    <span>Số Hồ Sơ: <strong className="font-mono">{selectedLoanItem.fileNumber || '.........................'}</strong></span>
                  </div>
                </div>
                {modalQrSrc && (
                  <div className="flex flex-col items-center ml-4">
                    <img src={modalQrSrc} alt="QR" className="w-[46px] h-[46px] block object-contain" />
                    <span className="text-[9px] font-mono mt-0.5 text-neutral-600">{selectedLoanItem.ticketNumber}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6 pt-1 text-xs sm:text-sm leading-relaxed">
                <div className="space-y-1">
                  <p className="font-bold text-sm underline">Bên A (gọi là “Bên cho mượn”):</p>
                  <p>Tên: <strong>{selectedLoanItem.warrantyCenterName || warrantyCenters[0]?.name || 'Trung tâm bảo hành OPPO (TTBH)'}</strong></p>
                  <p>Số Liên Hệ: <strong>{selectedLoanItem.warrantyCenterPhone || warrantyCenters[0]?.phone || '028.38551234'}</strong></p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm underline">Bên B (gọi là “Bên mượn”):</p>
                  <p>Tên: <strong>{selectedLoanItem.customerName}</strong></p>
                  <p>Số CMND/CCCD: <strong>{selectedLoanItem.citizenId || '...........................................'}</strong></p>
                  <p>Số Liên Hệ: <strong>{selectedLoanItem.customerPhone}</strong></p>
                </div>
              </div>

              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-300 text-xs sm:text-[13px] leading-relaxed text-amber-950">
                <strong className="uppercase font-black text-amber-900">◆ Thông Báo!</strong> Trước khi ký vào Biên bản này, vui lòng đọc kỹ các điều khoản và điều kiện của Biên bản. Bên B sẽ được coi là đã hiểu đầy đủ và đồng ý với tất cả các điều khoản của Biên bản sau khi ký xác nhận.
              </div>

              <p className="leading-relaxed text-xs sm:text-sm text-justify">
                ◆ Theo đó, Bên B đã gửi điện thoại OPPO/OnePlus (“Sản phẩm”) đến Bên A để sửa chữa vào ngày <strong>{selectedLoanItem.repairDate || selectedLoanItem.bookingDate || '.../.../202...'}</strong>. Bên A dự kiến thời gian sửa máy là <strong>{selectedLoanItem.repairDays || '3'}</strong> ngày. Trong thời gian sửa máy, Bên A đồng ý cho Bên B mượn một máy điện thoại dự phòng để sử dụng.
              </p>

              <div className="space-y-1">
                <p className="font-bold text-xs sm:text-sm">◆ Thông tin sản phẩm do Bên B gửi để sửa chữa như sau:</p>
                <table className="w-full border-collapse border border-neutral-400 text-center text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="border border-neutral-400 p-1.5 font-bold">Model</th>
                      <th className="border border-neutral-400 p-1.5 font-bold">Màu sắc</th>
                      <th className="border border-neutral-400 p-1.5 font-bold">S/N</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-neutral-400 p-1.5 font-mono font-bold">{selectedLoanItem.repairModel || selectedLoanItem.deviceModel}</td>
                      <td className="border border-neutral-400 p-1.5">{selectedLoanItem.repairColor || '...................'}</td>
                      <td className="border border-neutral-400 p-1.5 font-mono">{selectedLoanItem.repairSn || '...................'}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="border border-neutral-400 p-1.5 text-left font-mono">
                        <strong>IMEI:</strong> {selectedLoanItem.repairImei || '................................................................'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-xs sm:text-sm">◆ Thông tin sản phẩm của điện thoại dự phòng:</p>
                <table className="w-full border-collapse border border-neutral-400 text-center text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="border border-neutral-400 p-1.5 font-bold">Model</th>
                      <th className="border border-neutral-400 p-1.5 font-bold">Màu sắc</th>
                      <th className="border border-neutral-400 p-1.5 font-bold">S/N</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-neutral-400 p-1.5 font-mono font-bold">{selectedLoanItem.deviceModel}</td>
                      <td className="border border-neutral-400 p-1.5">{selectedLoanItem.deviceName || 'Màu tiêu chuẩn'}</td>
                      <td className="border border-neutral-400 p-1.5 font-mono">{selectedLoanItem.skuCode || '...................'}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="border border-neutral-400 p-1.5 text-left font-mono">
                        <strong>IMEI / S/N:</strong> {selectedLoanItem.imeiOrIot || '................................................................'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <table className="w-full border-collapse border border-neutral-400 text-xs sm:text-sm">
                <tbody>
                  <tr>
                    <td className="border border-neutral-400 p-1.5 w-1/3"><strong>Giá máy mượn:</strong> {selectedLoanItem.loanDevicePrice || '5.000.000đ'}</td>
                    <td className="border border-neutral-400 p-1.5 w-1/3"><strong>Phụ kiện kèm theo:</strong> {selectedLoanItem.loanAccessories || 'Máy trần'}</td>
                    <td className="border border-neutral-400 p-1.5 w-1/3"><strong>Tình trạng bên ngoài:</strong> {selectedLoanItem.loanCondition || 'Hoạt động tốt'}</td>
                  </tr>
                  <tr>
                    <td className="border border-neutral-400 p-1.5"><strong>Số tiền cọc:</strong> {selectedLoanItem.depositAmount ? `${selectedLoanItem.depositAmount}đ` : 'Không cọc'}</td>
                    <td className="border border-neutral-400 p-1.5"><strong>Số tiền cọc bằng chữ:</strong> {selectedLoanItem.depositAmountInWords || '....................................'}</td>
                    <td className="border border-neutral-400 p-1.5"><strong>Phương thức thanh toán:</strong> {selectedLoanItem.paymentMethod || 'Tiền mặt'}</td>
                  </tr>
                </tbody>
              </table>

              <div className="space-y-1 text-xs sm:text-[13px] leading-relaxed">
                <p>1. Trong thời gian mượn máy, Bên A sẽ cung cấp dịch vụ sữa máy cho sản phẩm do Bên B gửi sửa chữa theo chính sách bảo hành của OPPO/OnePlus.</p>
                <p>2. Thời gian mượn điện thoại dự phòng là Bên B phải trả lại điện thoại dự phòng đã mượn cho Bên A trước ngày <strong>{selectedLoanItem.returnedDate || '.../.../202...'}</strong>.</p>
              </div>

              <div className="pt-1">
                <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wide border-b border-neutral-300 pb-0.5 mb-1.5">Điều khoản và Điều kiện:</h4>
                <ol className="list-decimal pl-5 text-[11px] sm:text-xs leading-relaxed text-neutral-800 space-y-1 text-justify">
                  <li><strong>Quyền sở hữu và Mục đích sử dụng:</strong> Máy mượn thuộc sở hữu của Trung tâm bảo hành (Bên A). Bên B cam kết chỉ sử dụng thiết bị cho mục đích cá nhân và hợp pháp. Nghiêm cấm Bên B sử dụng máy mượn để cho thuê thương mại, bán lại, cầm cố, cho mượn lại, phục vụ hoạt động vi phạm pháp luật, bẻ khóa/chạy lại phần mềm (root/jailbreak) hoặc can thiệp hệ thống.</li>
                  <li><strong>Xác nhận tình trạng máy:</strong> Khi ký nhận, Bên B được xem là đã kiểm tra ngoại quan, màn hình, phím bấm, camera, sạc và các chức năng cơ bản. Nếu không có khiếu nại ngay tại thời điểm nhận, thiết bị được mặc định bàn giao trong tình trạng hoạt động bình thường, đúng như ghi nhận của Bên A.</li>
                  <li><strong>Chi phí phát sinh:</strong> Bên B tự chịu trách nhiệm thanh toán mọi chi phí phát sinh trong quá trình sử dụng, bao gồm cước liên lạc, lưu lượng data, phí ứng dụng, phí nền tảng bên thứ ba, thuế và các khoản tiền phạt vi phạm (nếu có).</li>
                  <li><strong>Bảo quản và Bồi thường hư hỏng:</strong> Bên B có trách nhiệm bảo quản thiết bị. Nếu máy hoặc phụ kiện bị hỏng do lỗi chủ quan (như vào nước, ẩm ướt, rơi vỡ, tự ý tháo lắp, sửa chữa ngoài trung tâm chính hãng), Bên B phải bồi thường theo Bảng giá linh kiện, phụ kiện chính thức. Bên B không được phép làm mờ, che phủ hoặc thay đổi số S/N và IMEI của thiết bị.</li>
                  <li><strong>Tiền đặt cọc:</strong> Tiền đặt cọc nhằm đảm bảo việc trả máy đúng hạn và nguyên vẹn. Bên A sẽ hoàn trả khoản cọc này theo hình thức đã thỏa thuận nếu Bên B thực hiện đúng nghĩa vụ hoàn trả.</li>
                  <li><strong>Chính sách phạt trả chậm và Bồi thường khi mất máy:</strong>
                    <div className="mt-0.5 space-y-0.5">
                      <p>• <strong>Trả chậm:</strong> Bên B phải trả lại máy mượn trong vòng 07 ngày kể từ ngày lấy máy gửi sửa. Nếu quá hạn, Bên B phải trả phí sử dụng quá hạn bằng 0,5% số tiền đặt cọc cho mỗi ngày chậm trễ.</p>
                      <p>• <strong>Mất máy:</strong> Nếu Bên B làm mất thiết bị, Bên B có nghĩa vụ bồi thường thiệt hại cho Bên A bằng đúng giá tiền của máy mượn được ghi trên biên bản.</p>
                      <p>• <strong>Xử lý vi phạm:</strong> Trường hợp Bên B từ chối trả máy, quá hạn hoặc có hành vi gian lận, Bên A có quyền ngừng hoàn cọc, khấu trừ phí phạt/sửa chữa vào tiền cọc, báo cáo cơ quan chức năng và được quyền giữ lại Sản phẩm mà Bên B đang gửi sửa chữa.</p>
                    </div>
                  </li>
                  <li><strong>Bảo mật dữ liệu:</strong> Trước khi trả máy, Bên B phải tự sao lưu, xóa toàn bộ dữ liệu cá nhân, đăng xuất các tài khoản, gỡ mật khẩu màn hình và tắt chức năng tìm kiếm/khóa từ xa. Bên A có quyền khôi phục cài đặt gốc khi thu hồi và không chịu trách nhiệm về việc rò rỉ, mất mát dữ liệu do Bên B không thực hiện đúng quy định.</li>
                  <li><strong>Quyền riêng tư:</strong> Bên B đồng ý cung cấp giấy tờ tùy thân hợp lệ (CCCD/CMND). Bên A được phép thu thập và lưu trữ thông tin cá nhân của Bên B nhằm mục đích quản lý thiết bị, hoàn cọc, và giải quyết tranh chấp.</li>
                  <li><strong>Giới hạn trách nhiệm:</strong> Bên A không chịu trách nhiệm đối với bất kỳ thiệt hại trực tiếp, gián tiếp, ngẫu nhiên hay liên đới nào (bao gồm mất mát tài sản, phần mềm, dữ liệu) phát sinh từ việc Bên B sử dụng máy mượn.</li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-3 text-center font-bold">
                <div className="space-y-8">
                  <div>
                    <p className="uppercase text-sm sm:text-base">Bên A</p>
                    <p className="text-xs font-normal italic text-neutral-600">(Ký hoặc Đóng dấu)</p>
                  </div>
                  <p className="font-normal text-xs sm:text-sm">Ngày ...... tháng ...... năm 202...</p>
                </div>
                <div className="space-y-8">
                  <div>
                    <p className="uppercase text-sm sm:text-base">Bên B</p>
                    <p className="text-xs font-normal italic text-neutral-600">(Ký và ghi rõ họ tên)</p>
                  </div>
                  <p className="font-normal text-xs sm:text-sm">Ngày ...... tháng ...... năm 202...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
