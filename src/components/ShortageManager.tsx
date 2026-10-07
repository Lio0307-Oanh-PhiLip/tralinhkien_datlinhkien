import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ShortageBookingItem,
  ShortagePartSubItem,
  ShortageStatus,
  SHORTAGE_STATUS_CONFIG,
  ShortageCallSubStatus,
  SHORTAGE_CALL_SUBSTATUS_CONFIG,
  GCSM_SHORTAGE_URL,
  GCSM_STOCK_URL,
  DuplicatePartGroup,
  DuplicatePartTicketItem,
} from '../types/shortage';
import { LabelItem } from '../types/label';
import { extractBarcodePartCode, findMasterItemByBarcode, extractShortageSearchCode } from '../utils/barcodeExtractor';
import { CameraBarcodeScannerModal } from './CameraBarcodeScannerModal';
import { matchesSmartSearch } from '../utils/searchHelper';
import {
  generateShortageTicketNumber,
  getTodayDateString,
  getCurrentDateTimeString,
  exportShortageToExcel,
  importShortageFromExcel,
  printShortageLabel,
  printBatchShortageLabels,
  shortageToLabelItem,
  checkOverdue7Days,
  checkSvdPending3Days,
  checkSvdMultiDayAppointmentProgress,
  checkStep1AgingWarning,
  checkStep2AgingWarning,
  checkStep3AgingWarning,
  getDaysSinceCalled,
  SHORTAGE_CLOSURE_REASONS,
  buildTicketSttMap,
  getTicketCreationTimestamp,
  getNormalizedBookingParts,
  calculateShortageStatusFromParts,
  getActiveShortageWarningTickets,
} from '../utils/shortageHelper';
import {
  requestShortageCancel,
  rejectShortageCancel,
  requestShortageEdit,
  approveShortageEdit,
  rejectShortageEdit,
  deleteShortageFromCloud,
  clearAllShortagesFromCloud,
  getLocalCatalogCache,
  DEFAULT_CATALOG_FALLBACK_ITEMS,
  batchSyncShortagesToCloud,
  deduplicateShortages,
} from '../services/firebaseShortageService';
import {
  parseBackupJson,
  executeFastRestore,
  exportFullSystemBackup,
} from '../services/backupRestoreService';
import { CustomerHoldsTab } from './CustomerHoldsTab';
import { DuplicatePartsModal } from './DuplicatePartsModal';
import { PaginationControl } from './PaginationControl';
import { TechnicianSelector } from './TechnicianSelector';
import { UserSelector } from './UserSelector';
import { RequestTechnicianModal } from './RequestTechnicianModal';
import { TechnicianItem } from '../types/technician';
import { subscribeToTechnicians } from '../services/technicianService';
import { CustomerCallModal, CustomerCallLogItem } from './CustomerCallModal';
import { TicketNoteModal } from './TicketNoteModal';
import { ExcelActionMenu } from './ExcelActionMenu';
import { DateRangeFilter, DateFilterState, AvailableMonthItem } from './DateRangeFilter';
import {
  Plus,
  StickyNote,
  Search,
  QrCode,
  ExternalLink,
  Phone,
  Printer,
  FileSpreadsheet,
  FileJson,
  Upload,
  Download,
  Copy,
  Check,
  Edit2,
  Edit3,
  Loader2,
  History as HistoryIcon,
  Trash2,
  Clock,
  User,
  UserCircle,
  Package,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  Boxes,
  Layers,
  Sparkles,
  RefreshCw,
  Calendar,
  MapPin,
  X,
  ShieldCheck,
  Cloud,
  Lock,
  AlertTriangle,
  ShieldAlert,
  Bookmark,
  Send,
  PhoneOff,
  XCircle,
  CheckSquare,
  Square,
  PlusCircle,
  Ban,
  CalendarX,
  Bell,
  Eye,
  Wrench,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// Helper functions to parse and convert dates between DD/MM/YYYY and YYYY-MM-DD
function parseVNToDate(vnStr: string): string {
  if (!vnStr) return '';
  const parts = vnStr.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length > 4) {
      year = year.slice(0, 4);
    }
    return `${year}-${month}-${day}`;
  }
  return '';
}

function parseDateToVN(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return '';
}

function parseVNToDateTime(vnStr: string): string {
  if (!vnStr) return '';
  const parts = vnStr.trim().split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00';
  const dateStr = parseVNToDate(datePart);
  if (dateStr) {
    return `${dateStr}T${timePart}`;
  }
  return '';
}

function parseDateTimeToVN(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  const parts = dateTimeStr.split('T');
  const dateFormatted = parseDateToVN(parts[0]);
  let timePart = parts[1] || '00:00';
  if (timePart.length > 5) {
    timePart = timePart.slice(0, 5);
  }
  if (dateFormatted) {
    return `${dateFormatted} ${timePart}`;
  }
  return '';
}

// Helper to parse date/time string into numeric timestamp for comparison
function parseToTimestamp(dateStr: string | undefined | null): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();
  
  // Format DD/MM/YYYY or DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss
  if (s.includes('/')) {
    const spaceParts = s.split(' ');
    const datePart = spaceParts[0];
    const timePart = spaceParts[1] || '00:00';
    const dParts = datePart.split('/');
    if (dParts.length === 3) {
      const day = parseInt(dParts[0], 10);
      const month = parseInt(dParts[1], 10) - 1;
      let year = parseInt(dParts[2], 10);
      if (year < 100) year += 2000;
      
      const tParts = timePart.split(':');
      const hour = parseInt(tParts[0] || '0', 10);
      const min = parseInt(tParts[1] || '0', 10);
      const sec = parseInt(tParts[2] || '0', 10);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const dt = new Date(year, month, day, hour, min, sec);
        if (!isNaN(dt.getTime())) return dt.getTime();
      }
    }
  }

  // Format YYYY-MM-DD or YYYY-MM-DDTHH:mm
  if (s.includes('-')) {
    const formatted = s.replace(' ', 'T');
    const dt = new Date(formatted);
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.getTime();

  return null;
}

interface DateStepCheck {
  stepName: string;
  stepNum: number;
  dateStr: string;
  timestamp: number;
}

// Check chronological sequence: Step 1 <= Step 2 <= Step 3 <= Step 4 <= Step 5
function checkDateSequenceViolations(dates: {
  bookingDate?: string;
  requestedDate?: string;
  stockedInDate?: string;
  calledCustomerDate?: string;
  customerArrivedDate?: string;
}): string[] {
  const warnings: string[] = [];
  const steps: DateStepCheck[] = [];

  if (dates.bookingDate) {
    const ts = parseToTimestamp(dates.bookingDate);
    if (ts !== null) {
      steps.push({
        stepName: 'Bước 1 (Đã Tạo Phiếu)',
        stepNum: 1,
        dateStr: dates.bookingDate,
        timestamp: ts,
      });
    }
  }

  if (dates.requestedDate) {
    const ts = parseToTimestamp(dates.requestedDate);
    if (ts !== null) {
      steps.push({
        stepName: 'Bước 2 (Đã Xin LK)',
        stepNum: 2,
        dateStr: dates.requestedDate,
        timestamp: ts,
      });
    }
  }

  if (dates.stockedInDate) {
    const ts = parseToTimestamp(dates.stockedInDate);
    if (ts !== null) {
      steps.push({
        stepName: 'Bước 3 (Đã Về Kho)',
        stepNum: 3,
        dateStr: dates.stockedInDate,
        timestamp: ts,
      });
    }
  }

  if (dates.calledCustomerDate) {
    const ts = parseToTimestamp(dates.calledCustomerDate);
    if (ts !== null) {
      steps.push({
        stepName: 'Bước 4 (Đã Gọi Khách)',
        stepNum: 4,
        dateStr: dates.calledCustomerDate,
        timestamp: ts,
      });
    }
  }

  if (dates.customerArrivedDate) {
    const ts = parseToTimestamp(dates.customerArrivedDate);
    if (ts !== null) {
      steps.push({
        stepName: 'Bước 5 (Khách Đã Lên)',
        stepNum: 5,
        dateStr: dates.customerArrivedDate,
        timestamp: ts,
      });
    }
  }

  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length; j++) {
      const stepA = steps[i];
      const stepB = steps[j];

      if (stepA.stepNum < stepB.stepNum && stepA.timestamp > stepB.timestamp) {
        warnings.push(
          `Thời gian ${stepA.stepName} (${stepA.dateStr}) diễn ra SAU thời gian ${stepB.stepName} (${stepB.dateStr}).`
        );
      }
    }
  }

  return warnings;
}

// Helper to extract normalized parts list from a ShortageBookingItem
function getBookingParts(booking: ShortageBookingItem): Array<{
  partCode: string;
  partName: string;
  model: string;
  quantity: number;
  isRequested?: boolean;
  requestedQuantity?: number;
  isStockedIn?: boolean;
  stockedInQuantity?: number;
}> {
  const parts: Array<{
    partCode: string;
    partName: string;
    model: string;
    quantity: number;
    isRequested?: boolean;
    requestedQuantity?: number;
    isStockedIn?: boolean;
    stockedInQuantity?: number;
  }> = [];

  if (booking.partsList && booking.partsList.length > 0) {
    booking.partsList.forEach((p) => {
      const code = (p.partCode || booking.partCode || '').trim();
      const name = (p.partName || booking.partName || 'Linh kiện').trim();
      const model = (p.model || booking.model || '').trim();
      const qty = Number(p.quantity) >= 1 ? Number(p.quantity) : 1;
      parts.push({
        partCode: code,
        partName: name,
        model,
        quantity: qty,
        isRequested: p.isRequested,
        requestedQuantity: p.requestedQuantity,
        isStockedIn: p.isStockedIn,
        stockedInQuantity: p.stockedInQuantity,
      });
    });
  } else {
    const code = (booking.partCode || '').trim();
    const name = (booking.partName || 'Linh kiện').trim();
    const model = (booking.model || '').trim();
    const q = Number(booking.quantity) >= 1 ? Number(booking.quantity) : 1;
    const isReq = booking.status !== 'da_tao_phieu' && booking.status !== 'chua_xin_du_lk';
    const isStock =
      booking.status === 'da_nhap_kho' ||
      booking.status === 'da_goi_kh' ||
      booking.status === 'da_hoan_tat';
    parts.push({
      partCode: code,
      partName: name,
      model,
      quantity: q,
      isRequested: isReq,
      requestedQuantity: booking.requestedQuantity ?? (isReq ? q : 0),
      isStockedIn: isStock,
      stockedInQuantity: booking.stockedInQuantity ?? (isStock ? q : 0),
    });
  }

  return parts;
}

// Get or derive requestedDate (Bước 2: Đã xin linh kiện) for a ticket item
function getBookingDateWithTime(item: ShortageBookingItem): string {
  if (!item.bookingDate) return '';
  const trimmed = item.bookingDate.trim();
  if (trimmed.includes(':') || trimmed.includes(' ')) {
    return trimmed;
  }
  if (item.history && item.history.length > 0) {
    const createdEntry = item.history.find((h) => h.status === 'da_tao_phieu');
    if (createdEntry && createdEntry.timestamp && createdEntry.timestamp.includes(':')) {
      return createdEntry.timestamp;
    }
  }
  if (item.createdAt) {
    try {
      const dt = new Date(item.createdAt);
      if (!isNaN(dt.getTime())) {
        const hh = String(dt.getHours()).padStart(2, '0');
        const mm = String(dt.getMinutes()).padStart(2, '0');
        return `${trimmed} ${hh}:${mm}`;
      }
    } catch {
      // ignore
    }
  }
  return trimmed;
}

function getRequestedDate(item: ShortageBookingItem): string | undefined {
  if (item.requestedDate && item.requestedDate.trim()) {
    return item.requestedDate.trim();
  }
  if (item.history && item.history.length > 0) {
    const xinEntry = item.history.find(
      (h) => h.status === 'da_xin_lk' || h.status === 'chua_xin_du_lk'
    );
    if (xinEntry && xinEntry.timestamp) {
      return xinEntry.timestamp;
    }
  }
  const isRequestedStatus =
    item.status === 'da_xin_lk' ||
    item.status === 'chua_xin_du_lk' ||
    item.status === 'da_nhap_kho' ||
    item.status === 'da_goi_kh' ||
    item.status === 'da_hoan_tat';

  const hasRequestedParts = item.partsList?.some((p) => p.isRequested);

  if (isRequestedStatus || hasRequestedParts) {
    return item.bookingDate || item.createdAt;
  }
  return undefined;
}

interface ShortageManagerProps {
  bookings: ShortageBookingItem[];
  catalogLabels?: LabelItem[];
  onUpdateBookings: (bookings: ShortageBookingItem[]) => void;
  onSendToLabelStudio: (item: LabelItem) => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
  onOpenAdminModal?: () => void;
  cloudSynced?: boolean;
  currentUser?: {
    uid: string;
    username?: string;
    name: string;
    role: 'admin' | 'staff';
    status?: 'pending' | 'approved' | 'rejected';
  } | null;
  isAdmin?: boolean;
  activeSubId?: string;
  onSelectSubId?: (id: string) => void;
  onOpenFastBackupRestore?: () => void;
  targetNavigation?: {
    subTab?: string;
    statusFilter?: string;
    warningBranch?: 'all' | 'overdue_7' | 'step1' | 'step2' | 'step3' | 'svd' | 'cancel' | 'edit';
    searchTerm?: string;
    ticketId?: string;
    ticketNumber?: string;
    nonce: number;
  } | null;
}

export const ShortageManager: React.FC<ShortageManagerProps> = ({
  bookings,
  catalogLabels = [],
  onUpdateBookings,
  onSendToLabelStudio,
  onShowToast,
  onOpenAdminModal,
  cloudSynced = true,
  currentUser,
  isAdmin = false,
  activeSubId = 'shortage-main',
  onSelectSubId,
  onOpenFastBackupRestore,
  targetNavigation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'filtered' | 'all'>('filtered');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Date Filter State (Lọc theo từng tháng hoặc chọn khoảng ngày: từ ngày - đến ngày)
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    mode: 'all',
    selectedMonth: '',
    startDate: '',
    endDate: '',
  });

  // Calculate list of available months with ticket creation counts (sorted newest first)
  const availableMonths = useMemo<AvailableMonthItem[]>(() => {
    const monthMap = new Map<string, { key: string; label: string; count: number; year: number; month: number }>();
    bookings.forEach((b) => {
      const ts = getTicketCreationTimestamp(b);
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCustomerHoldsModal, setShowCustomerHoldsModal] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);

  // High-performance Set for O(1) ticket number matching
  const allTicketNumbersSet = useMemo(
    () => new Set(bookings.map((b) => (b.ticketNumber || '').toLowerCase()).filter(Boolean)),
    [bookings]
  );
  const allTicketNumbersSetRef = useRef(allTicketNumbersSet);
  useEffect(() => {
    allTicketNumbersSetRef.current = allTicketNumbersSet;
  }, [allTicketNumbersSet]);

  // Synthesized scan beep feedback sound
  const playScanBeepSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio autoplay policy fallback
    }
  }, []);

  // Global Barcode Gun Scanner Listener (Handling ultra-high-speed hardware scanner keypresses)
  const barcodeBufferRef = useRef<{ buffer: string; lastTime: number }>({ buffer: '', lastTime: 0 });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingText = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      const now = Date.now();
      const timeDiff = now - barcodeBufferRef.current.lastTime;

      // Hardware barcode guns transmit characters rapidly (<50ms per char). Reset buffer if user is typing manually (>120ms gap)
      if (timeDiff > 120) {
        barcodeBufferRef.current.buffer = '';
      }
      barcodeBufferRef.current.lastTime = now;

      if (e.key === 'Enter') {
        const rawBuffer = barcodeBufferRef.current.buffer.trim();
        if (rawBuffer.length >= 3) {
          const { cleanCode, originalRaw } = extractShortageSearchCode(rawBuffer, allTicketNumbersSetRef.current);
          if (cleanCode) {
            playScanBeepSound();
            setSearchTerm(cleanCode);
            setSearchScope('filtered');
            onShowToast(
              `Đã quét súng: "${cleanCode}"${cleanCode !== originalRaw ? ` (từ QR: ${originalRaw.substring(0, 15)}...)` : ''}`,
              'success'
            );
            barcodeBufferRef.current.buffer = '';
            if (isEditingText && target) {
              (target as HTMLInputElement).value = cleanCode;
              (target as HTMLElement).blur();
            }
            e.preventDefault();
            e.stopPropagation();
          }
        }
        barcodeBufferRef.current.buffer = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBufferRef.current.buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [onShowToast, playScanBeepSound]);

  // Hierarchical Alert Branch state
  const [warningBranch, setWarningBranch] = useState<'all' | 'overdue_7' | 'step1' | 'step2' | 'step3' | 'svd' | 'cancel' | 'edit'>('all');
  const [isAlertsExpanded, setIsAlertsExpanded] = useState<boolean>(true);
  const [warningPage, setWarningPage] = useState<number>(1);
  const [warningPageSize, setWarningPageSize] = useState<number>(20);

  // Helper to safely navigate to main table and clear any conflicting filters
  const handleNavigateToMainTable = useCallback((ticketNumber?: string) => {
    if (onSelectSubId) onSelectSubId('shortage-main');
    setStatusFilter('all');
    setShowDuplicateFilterOnly(false);
    setSelectedDuplicatePartKey(null);
    setDateFilter({ mode: 'all', selectedMonth: '', startDate: '', endDate: '' });
    setCurrentPage(1);
    if (ticketNumber && ticketNumber.trim()) {
      setSearchTerm(ticketNumber.trim());
    } else {
      setSearchTerm('');
    }
  }, [onSelectSubId]);

  // Sync with Left Sidebar sub-item navigation
  useEffect(() => {
    if (!activeSubId) return;
    if (activeSubId === 'shortage-create-new') {
      handleOpenCreateModal();
      if (onSelectSubId) onSelectSubId('shortage-main');
    } else if (activeSubId === 'shortage-clear-all') {
      if (isAdmin) {
        setShowClearAllConfirmModal(true);
      }
      if (onSelectSubId) onSelectSubId('shortage-main');
    } else if (activeSubId === 'shortage-open-gcsm') {
      window.open('https://oln-cs.myoppo.com/main/#/index', '_blank');
      if (onSelectSubId) onSelectSubId('shortage-main');
    } else if (activeSubId === 'shortage-warnings') {
      setIsAlertsExpanded(true);
      setWarningBranch('all');
    } else if (activeSubId === 'shortage-check-dup') {
      setShowDuplicatePartsModal(true);
    } else if (activeSubId === 'shortage-holds') {
      setShowCustomerHoldsModal(true);
    }
  }, [activeSubId, isAdmin]);

  // Deep Navigation effect from System Notification Center (Bell)
  useEffect(() => {
    if (!targetNavigation || !targetNavigation.nonce) return;
    const { subTab, statusFilter: targetStatus, warningBranch: targetBranch, searchTerm: targetSearch } = targetNavigation;

    if (subTab === 'warnings' || activeSubId === 'shortage-warnings') {
      setIsAlertsExpanded(true);
      if (targetBranch) {
        setWarningBranch(targetBranch);
      }
    } else {
      if (targetStatus) {
        setStatusFilter(targetStatus);
      } else if (targetSearch) {
        setStatusFilter('all');
      }
    }

    if (targetSearch) {
      setSearchTerm(targetSearch);
    } else if (targetStatus) {
      setSearchTerm('');
    }

    // Reset date filter, duplicate filter, and page to 1 so the target tickets are visible immediately
    setDateFilter({ mode: 'all', selectedMonth: '', startDate: '', endDate: '' });
    setShowDuplicateFilterOnly(false);
    setSelectedDuplicatePartKey(null);
    setCurrentPage(1);
    setWarningPage(1);

    if (targetSearch) {
      onShowToast(`Đang lọc chi tiết phiếu: ${targetSearch}`, 'info');
    } else if (targetStatus === 'da_nhap_kho') {
      onShowToast(`Đang lọc: Phiếu LK đã nhập kho cần gọi khách (Bước 3)`, 'info');
    } else if (targetStatus === 'chua_xin_du_lk') {
      onShowToast(`Đang lọc: Phiếu Chưa Đủ Linh Kiện (Bước 2a)`, 'info');
    } else if (targetStatus === 'da_tao_phieu') {
      onShowToast(`Đang lọc: Phiếu mới tạo chờ xin linh kiện (Bước 1)`, 'info');
    } else if (targetBranch === 'overdue_7') {
      onShowToast(`Đang xem: Danh sách phiếu đặt chờ quá hạn 7 ngày`, 'info');
    } else if (targetBranch === 'svd') {
      onShowToast(`Đang xem: Tiến độ và nhắc hẹn SVD (10-12)`, 'info');
    }
  }, [targetNavigation]);

  // Duplicate Parts filter & modal state
  const [showDuplicatePartsModal, setShowDuplicatePartsModal] = useState(false);
  const [showDuplicateFilterOnly, setShowDuplicateFilterOnly] = useState(false);
  const [selectedDuplicatePartKey, setSelectedDuplicatePartKey] = useState<string | null>(null);
  const [duplicateFilterScope, setDuplicateFilterScope] = useState<'pending_only' | 'all'>('pending_only');

  // Show / Hide Check Stock Button (link: https://gcsm-sg.oppoit.com/part/stocks/stock-query)
  const [showStockCheckButton, setShowStockCheckButton] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('shortage_show_stock_check_btn');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, showDuplicateFilterOnly, selectedDuplicatePartKey, duplicateFilterScope, dateFilter, pageSize]);

  const activeHoldsCount = useMemo(() => {
    return bookings.filter((b) => b.status !== 'da_hoan_tat' && (b.isCustomerCallHold || b.customerKeepsPart)).length;
  }, [bookings]);

  // Auto-suggest catalog state
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'partCode' | 'partName' | null>(null);

  const activeCatalog = useMemo(() => {
    if (catalogLabels && catalogLabels.length > 0) return catalogLabels;
    const cached = getLocalCatalogCache();
    if (cached && cached.length > 0) return cached;
    return DEFAULT_CATALOG_FALLBACK_ITEMS;
  }, [catalogLabels]);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form Parts List state for creating and editing tickets (Supports multi-part requested per ticket)
  const [formPartsList, setFormPartsList] = useState<ShortagePartSubItem[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShortageBookingItem | null>(null);
  const [showClearAllConfirmModal, setShowClearAllConfirmModal] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Status Change Custom Confirm Modal State (Replaces native window.confirm)
  const [statusConfirmModal, setStatusConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    ticketNumber?: string;
    customerName?: string;
    fromStatus?: ShortageStatus;
    toStatus?: ShortageStatus;
    message: string;
    confirmButtonText?: string;
    secondaryButtonText?: string;
    onConfirm: () => void;
    onSecondaryConfirm?: () => void;
  } | null>(null);

  // Cancellation Request State (Staff)
  const [cancelRequestModalItem, setCancelRequestModalItem] = useState<ShortageBookingItem | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Direct Deletion Confirm State (Admin)
  const [deletingBookingConfirm, setDeletingBookingConfirm] = useState<ShortageBookingItem | null>(null);

  // Edit Request State (Staff & Admin Review)
  const [editReasonInput, setEditReasonInput] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editReviewModalItem, setEditReviewModalItem] = useState<ShortageBookingItem | null>(null);

  // Complete / Step 5 & Closure Modal State
  const [completingItem, setCompletingItem] = useState<ShortageBookingItem | null>(null);
  const [completeType, setCompleteType] = useState<'success_repair' | 'close_no_repair'>('success_repair');
  const [completeTechName, setCompleteTechName] = useState('');
  const [completeArrivedDate, setCompleteArrivedDate] = useState('');
  const [completeNote, setCompleteNote] = useState('');
  const [completeClosureReason, setCompleteClosureReason] = useState('khach_khong_len');
  const [completeCustomReason, setCompleteCustomReason] = useState('');

  // Bulk Overdue Close Confirm Modal State
  const [bulkCloseOverdueModal, setBulkCloseOverdueModal] = useState(false);

  // Call Customer Sub-Status Modal State
  const [callingModalItem, setCallingModalItem] = useState<ShortageBookingItem | null>(null);

  // Ticket Note Modal State (All users can add, edit, delete note)
  const [noteModalItem, setNoteModalItem] = useState<ShortageBookingItem | null>(null);
  const [noteModalMode, setNoteModalMode] = useState<'edit' | 'append' | 'add'>('edit');

  // Convert to SVD (Service Day Promotion) Modal State
  const [convertToSvdModalItem, setConvertToSvdModalItem] = useState<ShortageBookingItem | null>(null);
  const [svdTargetStatus, setSvdTargetStatus] = useState<ShortageStatus>('da_tao_phieu');
  const [svdHasAvailableParts, setSvdHasAvailableParts] = useState<boolean>(false);
  const [svdNoteOption, setSvdNoteOption] = useState<string>('🎁 Áp dụng ưu đãi Ngày Dịch Vụ SVD (10-12 hằng tháng)');
  const [svdCustomNote, setSvdCustomNote] = useState<string>('');

  // Date sequence warning modal state (Cảnh báo thứ tự ngày bước 1 -> 5)
  const [dateWarnings, setDateWarnings] = useState<string[]>([]);
  const [isDateWarningModalOpen, setIsDateWarningModalOpen] = useState<boolean>(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<(() => void) | null>(null);

  const triggerSaveWithDateCheck = (
    dates: {
      bookingDate?: string;
      requestedDate?: string;
      stockedInDate?: string;
      calledCustomerDate?: string;
      customerArrivedDate?: string;
    },
    saveCallback: () => void
  ) => {
    const warnings = checkDateSequenceViolations(dates);
    if (warnings.length > 0) {
      setDateWarnings(warnings);
      setPendingSaveAction(() => saveCallback);
      setIsDateWarningModalOpen(true);
    } else {
      saveCallback();
    }
  };

  const handleOpenCallModal = (item: ShortageBookingItem) => {
    setCallingModalItem(item);
  };

  // Mở modal ghi chú phiếu (Tất cả User đều có quyền Thêm / Sửa / Xóa)
  const handleOpenNoteModal = (item: ShortageBookingItem, mode: 'edit' | 'append' | 'add' = 'edit') => {
    setNoteModalItem(item);
    const targetMode = (!item.note || !item.note.trim()) ? 'add' : mode;
    setNoteModalMode(targetMode);
  };

  // Lưu ghi chú phiếu (Thêm nội dung hoặc sửa nội dung)
  const handleSaveNote = (newNote: string) => {
    if (!noteModalItem) return;
    const currentDateTime = getCurrentDateTimeString();
    const cleanNote = newNote.trim();
    const updatedList = bookings.map((b) => {
      if (b.id === noteModalItem.id) {
        return {
          ...b,
          note: cleanNote || undefined,
          updatedAt: new Date().toISOString(),
          history: [
            ...(b.history || []),
            {
              status: b.status,
              timestamp: currentDateTime,
              note: cleanNote
                ? `Cập nhật ghi chú: "${cleanNote}" [Bởi: ${currentUser?.name || 'Nhân viên'}]`
                : `Đã xóa ghi chú phiếu [Bởi: ${currentUser?.name || 'Nhân viên'}]`,
            },
          ],
        };
      }
      return b;
    });

    onUpdateBookings(updatedList);
    if (cleanNote) {
      onShowToast(`Đã lưu ghi chú cho phiếu [${noteModalItem.ticketNumber}]`, 'success');
    } else {
      onShowToast(`Đã xóa ghi chú của phiếu [${noteModalItem.ticketNumber}]`, 'info');
    }
    setNoteModalItem(null);
  };

  // Xóa ghi chú phiếu
  const handleDeleteNote = (item: ShortageBookingItem) => {
    const currentDateTime = getCurrentDateTimeString();
    const updatedList = bookings.map((b) => {
      if (b.id === item.id) {
        return {
          ...b,
          note: undefined,
          updatedAt: new Date().toISOString(),
          history: [
            ...(b.history || []),
            {
              status: b.status,
              timestamp: currentDateTime,
              note: `Đã xóa ghi chú phiếu [Bởi: ${currentUser?.name || 'Nhân viên'}]`,
            },
          ],
        };
      }
      return b;
    });

    onUpdateBookings(updatedList);
    onShowToast(`Đã xóa ghi chú của phiếu [${item.ticketNumber}]`, 'info');
    setNoteModalItem(null);
  };

  const handleQuickDeleteNote = (item: ShortageBookingItem) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa ghi chú của phiếu [${item.ticketNumber}] không?`)) {
      handleDeleteNote(item);
    }
  };

  // Collapsed / Expanded Tickets State
  const [expandedTicketIds, setExpandedTicketIds] = useState<Set<string>>(new Set());

  const handleToggleExpandTicket = (ticketId: string) => {
    setExpandedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const handleExpandAllTickets = (ticketIds: string[]) => {
    setExpandedTicketIds(new Set(ticketIds));
  };

  const handleCollapseAllTickets = () => {
    setExpandedTicketIds(new Set());
  };

  const handleSaveCustomerCall = (data: {
    calledCustomerDate?: string;
    callSubStatus?: ShortageCallSubStatus;
    appointmentDate?: string;
    callNote?: string;
    callLogs: CustomerCallLogItem[];
    shouldCloseTicket?: boolean;
    isDeletedAll?: boolean;
  }) => {
    if (!callingModalItem) return;

    // Nếu người dùng đã xóa hết các lần gọi trong modal
    if (data.isDeletedAll || data.callLogs.length === 0) {
      const nowStr = new Date().toISOString();
      const currentDateTime = getCurrentDateTimeString();
      const revertStatus: ShortageStatus = callingModalItem.stockedInDate
        ? 'da_nhap_kho'
        : callingModalItem.requestedDate
        ? 'da_xin_lk'
        : 'da_tao_phieu';

      const updatedList = bookings.map((b) => {
        if (b.id === callingModalItem.id) {
          return {
            ...b,
            status: revertStatus,
            calledCustomerDate: undefined,
            callSubStatus: undefined,
            appointmentDate: undefined,
            callNote: undefined,
            callLogs: [],
            updatedAt: nowStr,
            history: [
              ...(b.history || []),
              {
                status: revertStatus,
                timestamp: currentDateTime,
                note: 'Đã xóa toàn bộ lịch sử gọi khách hàng, hoàn tác về trạng thái trước đó',
              },
            ],
          };
        }
        return b;
      });

      onUpdateBookings(updatedList);
      onShowToast(`Đã xóa thông tin gọi KH cho phiếu [${callingModalItem.ticketNumber}]`, 'info');
      setCallingModalItem(null);
      return;
    }

    const executeSaveCallModal = () => {
      const nowStr = new Date().toISOString();
      const currentDateTime = getCurrentDateTimeString();
      const finalCalledDate = data.calledCustomerDate?.trim() || currentDateTime;
      const shouldCloseTicket = Boolean(data.shouldCloseTicket);

      const subStatus = data.callSubStatus || 'hen_ngay';
      const subConfig = SHORTAGE_CALL_SUBSTATUS_CONFIG[subStatus] || SHORTAGE_CALL_SUBSTATUS_CONFIG.hen_ngay;
      const sortedLogs = Array.isArray(data.callLogs)
        ? [...data.callLogs].sort((a, b) => {
            const tA = parseToTimestamp(a.calledDate) || 0;
            const tB = parseToTimestamp(b.calledDate) || 0;
            return tA - tB;
          })
        : [];
      const callCount = sortedLogs.length || 1;
      let noteDetail = `Hiện trạng gọi KH (${callCount} lần gọi) - Lần gần nhất (${finalCalledDate}): ${subConfig.label}`;
      if (subStatus === 'hen_ngay' && data.appointmentDate) {
        noteDetail += ` - Khách hẹn lên: ${data.appointmentDate}`;
      }
      if (data.callNote) {
        noteDetail += ` (${data.callNote})`;
      }

      const newStatus: ShortageStatus = shouldCloseTicket ? 'da_hoan_tat' : 'da_goi_kh';

      const updatedList = bookings.map((b) => {
        if (b.id === callingModalItem.id) {
          const newHistory = [
            ...(b.history || []),
            {
              status: newStatus,
              timestamp: currentDateTime,
              note: noteDetail,
            },
          ];

          return {
            ...b,
            status: newStatus,
            calledCustomerDate: finalCalledDate,
            callSubStatus: subStatus,
            appointmentDate: subStatus === 'hen_ngay' ? (data.appointmentDate || undefined) : undefined,
            callNote: data.callNote || undefined,
            callLogs: sortedLogs as any,
            isCompletedWithoutRepair: shouldCloseTicket ? true : b.isCompletedWithoutRepair,
            closureReason: shouldCloseTicket ? 'Khách báo hủy không đặt nữa / không thay' : b.closureReason,
            closureNote: shouldCloseTicket ? (data.callNote || 'Khách báo hủy qua điện thoại') : b.closureNote,
            closureBy: shouldCloseTicket ? (currentUser?.name || 'Nhân viên liên hệ') : b.closureBy,
            updatedAt: nowStr,
            history: newHistory,
          };
        }
        return b;
      });

      onUpdateBookings(updatedList);
      if (shouldCloseTicket) {
        onShowToast(`Đã đóng phiếu [${callingModalItem.ticketNumber}] do khách báo hủy/không thay!`, 'info');
      } else {
        onShowToast(`Đã lưu hiện trạng gọi KH cho phiếu [${callingModalItem.ticketNumber}] (${subConfig.shortLabel})`, 'success');
      }
      setCallingModalItem(null);
    };

    triggerSaveWithDateCheck(
      {
        bookingDate: callingModalItem.bookingDate,
        stockedInDate: callingModalItem.stockedInDate,
        calledCustomerDate: data.calledCustomerDate || '',
        customerArrivedDate: callingModalItem.customerArrivedDate,
      },
      executeSaveCallModal
    );
  };

  // Form State
  const [formData, setFormData] = useState({
    ticketNumber: '',
    partCode: '',
    partName: '',
    model: '',
    quantity: 1 as number | undefined,
    requestedQuantity: 0 as number | undefined,
    stockedInQuantity: 0 as number | undefined,
    customerName: '',
    customerPhone: '',
    bookingDate: getCurrentDateTimeString(),
    requestedDate: '',
    stockedInDate: '',
    calledCustomerDate: '',
    customerArrivedDate: '',
    creatorTechnician: '',
    technicianName: '',
    createdBy: '',
    status: 'da_tao_phieu' as ShortageStatus,
    location: '',
    note: '',
    customerKeepsPart: false,
    isCustomerCallHold: false,
    hasAvailableParts: undefined as boolean | undefined,
  });

  // Master Technicians list from Cloud Firestore
  const [masterTechnicians, setMasterTechnicians] = useState<TechnicianItem[]>([]);
  const [isRequestTechModalOpen, setIsRequestTechModalOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToTechnicians((list) => {
      setMasterTechnicians(list);
    });
    return () => unsub();
  }, []);

  // Quick Assign Modal for Technician & Creator
  const [quickAssignItem, setQuickAssignItem] = useState<ShortageBookingItem | null>(null);
  const [quickTechName, setQuickTechName] = useState('');
  const [quickCreatorTech, setQuickCreatorTech] = useState('');
  const [quickCreatedBy, setQuickCreatedBy] = useState('');

  // Collect unique technicians for suggestions
  const technicianList = useMemo(() => {
    const list = new Set<string>();
    masterTechnicians.forEach((t) => {
      if (t.status === 'active') {
        list.add(t.name);
      }
    });
    if (currentUser?.name) list.add(currentUser.name);
    bookings.forEach((b) => {
      if (b.creatorTechnician?.trim()) list.add(b.creatorTechnician.trim());
      if (b.technicianName?.trim()) list.add(b.technicianName.trim());
      if (b.closureBy?.trim()) list.add(b.closureBy.trim());
    });
    return Array.from(list);
  }, [bookings, currentUser, masterTechnicians]);

  const handleOpenQuickAssignTech = (item: ShortageBookingItem) => {
    setQuickAssignItem(item);
    setQuickTechName(item.technicianName || '');
    setQuickCreatorTech(item.creatorTechnician || '');
    setQuickCreatedBy(item.createdBy || currentUser?.name || currentUser?.username || '');
  };

  const handleSaveQuickAssign = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickAssignItem) return;
    const nowStr = new Date().toISOString();
    const currentDateTime = getCurrentDateTimeString();
    const finalTech = quickTechName.trim();
    const finalCreatorTech = quickCreatorTech.trim();
    const finalCreator = (currentUser?.role === 'admin' ? quickCreatedBy.trim() : quickAssignItem.createdBy) || quickAssignItem.createdBy || currentUser?.name || 'Hệ thống';

    const updatedList = bookings.map((b) => {
      if (b.id === quickAssignItem.id) {
        const isTechChanged = (b.technicianName || '') !== finalTech;
        const isCreatorTechChanged = (b.creatorTechnician || '') !== finalCreatorTech;
        const isCreatedByChanged = (b.createdBy || '') !== finalCreator;
        const newHistory = [...(b.history || [])];

        const changeNotes: string[] = [];
        if (isTechChanged) {
          changeNotes.push(`KT Xử lý: ${finalTech || 'Chưa phân công'}`);
        }
        if (isCreatorTechChanged) {
          changeNotes.push(`KT Tạo: ${finalCreatorTech || 'Chưa gán'}`);
        }
        if (isCreatedByChanged) {
          changeNotes.push(`User Tạo: ${finalCreator}`);
        }

        if (changeNotes.length > 0) {
          newHistory.push({
            status: b.status,
            timestamp: currentDateTime,
            note: `Cập nhật KTV / Phân công: ${changeNotes.join(' | ')} [Bởi: ${currentUser?.name || 'Nhân viên'}]`,
          });
        }

        return {
          ...b,
          creatorTechnician: finalCreatorTech || undefined,
          technicianName: finalTech || undefined,
          createdBy: finalCreator,
          updatedAt: nowStr,
          history: newHistory,
        };
      }
      return b;
    });

    onUpdateBookings(updatedList);
    onShowToast(`Đã cập nhật KTV xử lý [${finalTech || 'Chưa phân công'}] & KT tạo [${finalCreatorTech || 'Chưa gán'}] cho phiếu [${quickAssignItem.ticketNumber}]!`, 'success');
    setQuickAssignItem(null);
  };

  const handleCopy = (text: string, id: string, label = 'Đã sao chép') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast(`${label}: ${text}`, 'success');
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Open GCSM stock query & auto-copy part code to clipboard
  const handleCheckStock = useCallback(
    (code?: string) => {
      if (code && code.trim()) {
        navigator.clipboard.writeText(code.trim());
        onShowToast(`Đã sao chép mã LK "${code.trim()}" & mở cổng tra cứu tồn kho GCSM!`, 'success');
      } else {
        onShowToast('Đang mở cổng tra cứu tồn kho GCSM...', 'info');
      }
      window.open(GCSM_STOCK_URL, '_blank', 'noopener,noreferrer');
    },
    [onShowToast]
  );

  // Open modal for new item
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormPartsList([
      {
        id: `part-${Date.now()}-0`,
        partCode: '',
        partName: '',
        model: '',
        quantity: 1,
        isRequested: false,
      },
    ]);
    setFormData({
      ticketNumber: generateShortageTicketNumber(),
      partCode: '',
      partName: '',
      model: '',
      quantity: 1,
      requestedQuantity: 0,
      stockedInQuantity: 0,
      customerName: '',
      customerPhone: '',
      bookingDate: getCurrentDateTimeString(),
      requestedDate: '',
      stockedInDate: '',
      calledCustomerDate: '',
      customerArrivedDate: '',
      creatorTechnician: '',
      technicianName: '',
      createdBy: currentUser?.name || currentUser?.username || 'Nhân viên',
      status: 'da_tao_phieu',
      location: '',
      note: '',
      customerKeepsPart: false,
      isCustomerCallHold: false,
      hasAvailableParts: undefined,
    });
    setIsModalOpen(true);
  };

  // Open modal for editing existing ticket
  const handleOpenEditModal = (item: ShortageBookingItem) => {
    setEditingItem(item);
    setEditReasonInput(item.editReason || '');
    let initialParts: ShortagePartSubItem[] = [];
    const isAdvancedStatus = item.status !== 'da_tao_phieu' && item.status !== 'chua_xin_du_lk';
    const isStockedStatus = item.status === 'da_nhap_kho' || item.status === 'da_goi_kh' || item.status === 'da_hoan_tat';
    if (item.partsList && item.partsList.length > 0) {
      initialParts = item.partsList.map((p, idx) => ({
        id: p.id || `part-${idx}`,
        partCode: p.partCode || '',
        partName: p.partName || '',
        model: p.model || item.model || '',
        quantity: p.quantity && Number(p.quantity) >= 1 ? Number(p.quantity) : 1,
        isRequested: p.isRequested !== undefined ? !!p.isRequested : isAdvancedStatus,
        isStockedIn: p.isStockedIn !== undefined ? !!p.isStockedIn : isStockedStatus,
      }));
    } else {
      initialParts = [
        {
          id: `part-${Date.now()}-0`,
          partCode: item.partCode || '',
          partName: item.partName || '',
          model: item.model || '',
          quantity: 1,
          isRequested: isAdvancedStatus,
          isStockedIn: isStockedStatus,
        },
      ];
    }

    // Auto-reconcile initial status & dates if all parts are already stocked in
    const totalInitialParts = initialParts.length;
    const stockedInitialCount = initialParts.filter((p) => p.isStockedIn).length;
    const requestedInitialCount = initialParts.filter((p) => p.isRequested).length;
    let initialStatus = item.status;
    let initialStockedInDate = item.stockedInDate || '';
    let initialRequestedDate = item.requestedDate || getRequestedDate(item) || '';
    const nowTimestamp = getCurrentDateTimeString();

    if (item.hasAvailableParts || (stockedInitialCount === totalInitialParts && totalInitialParts > 0)) {
      if (initialStatus === 'da_tao_phieu' || initialStatus === 'chua_xin_du_lk' || initialStatus === 'da_xin_lk') {
        initialStatus = 'da_nhap_kho';
        if (!initialStockedInDate) initialStockedInDate = nowTimestamp;
        if (!initialRequestedDate) initialRequestedDate = nowTimestamp;
      }
      initialParts = initialParts.map((p) => ({ ...p, isRequested: true, isStockedIn: true }));
    } else if (stockedInitialCount < totalInitialParts && (initialStatus === 'da_nhap_kho' || initialStatus === 'da_goi_kh' || initialStatus === 'da_hoan_tat')) {
      // If parts are not all in warehouse, status must match actual parts
      initialStatus = requestedInitialCount === totalInitialParts ? 'da_xin_lk' : (requestedInitialCount > 0 ? 'chua_xin_du_lk' : 'da_tao_phieu');
    }

    setFormPartsList(initialParts);
    setFormData({
      ticketNumber: item.ticketNumber,
      partCode: item.partCode || '',
      partName: item.partName || '',
      model: item.model || '',
      quantity: item.quantity || 1,
      requestedQuantity: item.requestedQuantity || 0,
      stockedInQuantity: item.stockedInQuantity || 0,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      bookingDate: getBookingDateWithTime(item),
      requestedDate: initialRequestedDate,
      stockedInDate: initialStockedInDate,
      calledCustomerDate: item.calledCustomerDate || '',
      customerArrivedDate: item.customerArrivedDate || '',
      creatorTechnician: item.creatorTechnician || item.technicianName || '',
      technicianName: item.technicianName || '',
      createdBy: item.createdBy || '',
      status: initialStatus,
      location: item.location || '',
      note: item.note || '',
      customerKeepsPart: !!item.customerKeepsPart,
      isCustomerCallHold: !!item.isCustomerCallHold,
      hasAvailableParts: item.hasAvailableParts,
    });
    setIsModalOpen(true);
  };

  // Dynamic form parts list handlers
  const handleAddFormPart = () => {
    setFormPartsList((prev) => [
      ...prev,
      {
        id: `part-${Date.now()}-${prev.length}`,
        partCode: '',
        partName: '',
        model: formData.model || '',
        quantity: 1,
        isRequested: formData.status !== 'da_tao_phieu' && formData.status !== 'chua_xin_du_lk',
        isStockedIn: formData.status === 'da_nhap_kho' || formData.status === 'da_goi_kh' || formData.status === 'da_hoan_tat',
      },
    ]);
  };

  const handleRemoveFormPart = (index: number) => {
    if (formPartsList.length <= 1) return;
    const remaining = formPartsList.filter((_, i) => i !== index);
    setFormPartsList(remaining);
    if (activeSuggestionIdx === index) {
      setActiveSuggestionIdx(null);
      setActiveSuggestionField(null);
    }

    // Re-evaluate status for remaining parts
    const total = remaining.length;
    const stockedCount = remaining.filter((p) => p.isStockedIn).length;
    const reqCount = remaining.filter((p) => p.isRequested).length;
    const nowTimestamp = getCurrentDateTimeString();

    let newStatus = formData.status;
    let nextHasAvailableParts = formData.hasAvailableParts;

    if (stockedCount === total && total > 0) {
      if (newStatus === 'da_tao_phieu' || newStatus === 'chua_xin_du_lk' || newStatus === 'da_xin_lk') {
        newStatus = 'da_nhap_kho';
        onShowToast(
          `Đã xóa linh kiện. Tất cả ${total} món còn lại đã nhận kho ➔ Tự động chuyển: 3. Linh kiện đã nhập kho`,
          'success'
        );
      } else {
        onShowToast(`Đã xóa linh kiện khỏi phiếu (${total} món còn lại)`, 'info');
      }
    } else if (stockedCount < total) {
      nextHasAvailableParts = false;
      if (newStatus === 'da_nhap_kho' || newStatus === 'da_goi_kh' || newStatus === 'da_hoan_tat') {
        newStatus = reqCount === total ? 'da_xin_lk' : (reqCount > 0 ? 'chua_xin_du_lk' : 'da_tao_phieu');
        onShowToast(
          `Đã xóa linh kiện ➔ Cập nhật trạng thái về: ${SHORTAGE_STATUS_CONFIG[newStatus]?.label || newStatus}`,
          'info'
        );
      } else {
        onShowToast(`Đã xóa linh kiện khỏi phiếu (${total} món còn lại)`, 'info');
      }
    }

    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      stockedInDate: newStatus === 'da_nhap_kho' || newStatus === 'da_goi_kh' || newStatus === 'da_hoan_tat' ? (prev.stockedInDate || nowTimestamp) : prev.stockedInDate,
      requestedDate: prev.requestedDate || nowTimestamp,
      hasAvailableParts: nextHasAvailableParts,
    }));
  };

  // Handle changing status dropdown in the modal form
  const handleFormStatusChange = (newStatus: ShortageStatus) => {
    const timestampStr = getCurrentDateTimeString();
    let updatedStockedInDate = formData.stockedInDate;
    let updatedRequestedDate = formData.requestedDate;
    let updatedCalledCustomerDate = formData.calledCustomerDate;
    let updatedHasAvailableParts = formData.hasAvailableParts;

    if (newStatus === 'da_nhap_kho' || newStatus === 'da_goi_kh' || newStatus === 'da_hoan_tat') {
      if (!updatedStockedInDate) updatedStockedInDate = timestampStr;
      if (!updatedRequestedDate) updatedRequestedDate = timestampStr;
      if (newStatus === 'da_goi_kh' && !updatedCalledCustomerDate) updatedCalledCustomerDate = timestampStr;
      // All parts must be marked requested & stocked in
      setFormPartsList((prev) =>
        prev.map((p) => ({ ...p, isRequested: true, isStockedIn: true }))
      );
      onShowToast(
        `Đã chuyển trạng thái sang: ${SHORTAGE_STATUS_CONFIG[newStatus]?.label || newStatus} (Tất cả linh kiện được tích Đã nhận kho)`,
        'success'
      );
    } else if (newStatus === 'da_xin_lk') {
      if (!updatedRequestedDate) updatedRequestedDate = timestampStr;
      updatedHasAvailableParts = false;
      // All parts requested, none stocked in
      setFormPartsList((prev) =>
        prev.map((p) => ({ ...p, isRequested: true, isStockedIn: false }))
      );
      onShowToast(
        `Đã chuyển trạng thái sang: 2. Đã xin linh kiện (Tất cả linh kiện Đã xin, Chưa nhận kho)`,
        'info'
      );
    } else if (newStatus === 'chua_xin_du_lk') {
      if (!updatedRequestedDate) updatedRequestedDate = timestampStr;
      updatedHasAvailableParts = false;
      // First part requested if none were, none stocked in
      setFormPartsList((prev) => {
        const hasAnyReq = prev.some((p) => p.isRequested);
        return prev.map((p, idx) => ({
          ...p,
          isRequested: hasAnyReq ? !!p.isRequested : idx === 0,
          isStockedIn: false,
        }));
      });
      onShowToast(
        `Đã chuyển trạng thái sang: 2a. Chưa xin đủ linh kiện`,
        'info'
      );
    } else if (newStatus === 'da_tao_phieu') {
      updatedHasAvailableParts = false;
      // Step 1: no parts requested, none stocked in
      setFormPartsList((prev) =>
        prev.map((p) => ({ ...p, isRequested: false, isStockedIn: false }))
      );
      onShowToast(
        `Đã chuyển trạng thái về: 1. Đã tạo phiếu chờ (Tất cả linh kiện Chưa xin, Chưa nhận kho)`,
        'info'
      );
    }

    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      stockedInDate: updatedStockedInDate,
      requestedDate: updatedRequestedDate,
      calledCustomerDate: updatedCalledCustomerDate,
      hasAvailableParts: updatedHasAvailableParts,
    }));
  };

  // Handle toggling "Đã nhận kho" checkbox for a part in the modal
  const handleToggleFormPartStocked = (index: number, checked: boolean) => {
    const timestampStr = getCurrentDateTimeString();
    let nextStockedDate = formData.stockedInDate;
    let nextRequestedDate = formData.requestedDate;

    const nextParts = formPartsList.map((item, i) => {
      if (i !== index) return item;
      const q = Math.max(1, item.quantity || 1);
      return {
        ...item,
        quantity: q,
        isStockedIn: checked,
        stockedInQuantity: checked ? q : 0,
        // If part is stocked in, it is automatically marked as requested as well
        isRequested: checked ? true : item.isRequested,
        requestedQuantity: checked ? q : (item.requestedQuantity ?? (item.isRequested ? q : 0)),
      };
    });

    setFormPartsList(nextParts);
    const calc = calculateShortageStatusFromParts(nextParts, formData.status, !!formData.customerKeepsPart);
    let newStatus = calc.status;

    if (checked) {
      if (!nextRequestedDate) nextRequestedDate = timestampStr;
      if (calc.isFullyStocked && !nextStockedDate) nextStockedDate = timestampStr;
      onShowToast(
        calc.isFullyStocked
          ? `Tất cả linh kiện đã về kho ➔ Trạng thái: ${SHORTAGE_STATUS_CONFIG[newStatus]?.label || newStatus}`
          : `Linh kiện #${index + 1}: Đã nhận về kho (${calc.totalStockedQty}/${calc.totalRequiredQty} cái - Chưa đủ)`,
        calc.isFullyStocked ? 'success' : 'info'
      );
    } else {
      onShowToast(
        `Linh kiện #${index + 1}: Bỏ nhận kho (${calc.totalStockedQty}/${calc.totalRequiredQty} cái ở kho)`,
        'info'
      );
    }

    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      stockedInDate: (newStatus === 'da_nhap_kho' || newStatus === 'da_goi_kh' || newStatus === 'da_hoan_tat') ? nextStockedDate : prev.stockedInDate,
      requestedDate: nextRequestedDate,
      hasAvailableParts: calc.isFullyStocked,
    }));
  };

  // Handle toggling "Đã xin LK" checkbox for a part in the modal
  const handleToggleFormPartRequested = (index: number, checked: boolean) => {
    const timestampStr = getCurrentDateTimeString();
    let nextRequestedDate = formData.requestedDate;

    const nextParts = formPartsList.map((item, i) => {
      if (i !== index) return item;
      const q = Math.max(1, item.quantity || 1);
      return {
        ...item,
        quantity: q,
        isRequested: checked,
        requestedQuantity: checked ? q : 0,
        // If un-requesting, part CANNOT be stocked in!
        isStockedIn: !checked ? false : item.isStockedIn,
        stockedInQuantity: !checked ? 0 : (item.stockedInQuantity ?? 0),
      };
    });

    setFormPartsList(nextParts);
    const calc = calculateShortageStatusFromParts(nextParts, formData.status, !!formData.customerKeepsPart);
    let newStatus = calc.status;

    if (checked) {
      if (!nextRequestedDate) nextRequestedDate = timestampStr;
      onShowToast(
        calc.isFullyRequested
          ? `Đã xin đủ tất cả (${calc.totalRequestedQty}/${calc.totalRequiredQty} cái) ➔ Chuyển: ${SHORTAGE_STATUS_CONFIG[newStatus]?.label || newStatus}`
          : `Linh kiện #${index + 1}: Đã xin (${calc.totalRequestedQty}/${calc.totalRequiredQty} cái - Chưa đủ, Bước 2a)`,
        calc.isFullyRequested ? 'success' : 'info'
      );
    } else {
      onShowToast(`Linh kiện #${index + 1}: Bỏ xin LK (${calc.totalRequestedQty}/${calc.totalRequiredQty} cái đã xin)`, 'info');
    }

    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      requestedDate: nextRequestedDate,
      hasAvailableParts: calc.isFullyStocked,
    }));
  };

  // Handle updating requested quantity for a part in the modal
  const handleUpdateFormPartRequestedQty = (index: number, newQty: number) => {
    const timestampStr = getCurrentDateTimeString();
    let nextRequestedDate = formData.requestedDate;

    const nextParts = formPartsList.map((item, i) => {
      if (i !== index) return item;
      const maxQ = Math.max(1, item.quantity || 1);
      const clampedQ = Math.max(0, Math.min(maxQ, newQty));
      const isReq = clampedQ >= maxQ;
      // If requested quantity drops below stocked quantity, clamp stocked quantity
      const curStock = typeof item.stockedInQuantity === 'number'
        ? item.stockedInQuantity
        : (item.isStockedIn ? maxQ : 0);
      const newStock = Math.min(clampedQ, curStock);

      return {
        ...item,
        quantity: maxQ,
        requestedQuantity: clampedQ,
        isRequested: isReq,
        stockedInQuantity: newStock,
        isStockedIn: newStock >= maxQ,
      };
    });

    setFormPartsList(nextParts);
    const calc = calculateShortageStatusFromParts(nextParts, formData.status, !!formData.customerKeepsPart);
    let newStatus = calc.status;

    if (newQty > 0 && !nextRequestedDate) nextRequestedDate = timestampStr;

    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      requestedDate: nextRequestedDate,
      hasAvailableParts: calc.isFullyStocked,
    }));
  };

  // Handle updating stocked-in quantity for a part in the modal
  const handleUpdateFormPartStockedQty = (index: number, newQty: number) => {
    const timestampStr = getCurrentDateTimeString();
    let nextStockedDate = formData.stockedInDate;
    let nextRequestedDate = formData.requestedDate;

    const nextParts = formPartsList.map((item, i) => {
      if (i !== index) return item;
      const maxQ = Math.max(1, item.quantity || 1);
      const clampedStock = Math.max(0, Math.min(maxQ, newQty));
      const curReq = typeof item.requestedQuantity === 'number'
        ? item.requestedQuantity
        : (item.isRequested ? maxQ : 0);
      const newReq = Math.max(curReq, clampedStock);

      return {
        ...item,
        quantity: maxQ,
        stockedInQuantity: clampedStock,
        isStockedIn: clampedStock >= maxQ,
        requestedQuantity: newReq,
        isRequested: newReq >= maxQ,
      };
    });

    setFormPartsList(nextParts);
    const calc = calculateShortageStatusFromParts(nextParts, formData.status, !!formData.customerKeepsPart);
    let newStatus = calc.status;

    if (newQty > 0) {
      if (!nextRequestedDate) nextRequestedDate = timestampStr;
      if (calc.isFullyStocked && !nextStockedDate) nextStockedDate = timestampStr;
    }

    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      stockedInDate: (newStatus === 'da_nhap_kho' || newStatus === 'da_goi_kh' || newStatus === 'da_hoan_tat') ? nextStockedDate : prev.stockedInDate,
      requestedDate: nextRequestedDate,
      hasAvailableParts: calc.isFullyStocked,
    }));
  };

  const handleUpdateFormPart = (
    index: number,
    field: keyof ShortagePartSubItem,
    value: any
  ) => {
    setFormPartsList((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };

        // Instant Auto-fill partName & model when user enters/pastes partCode
        if (field === 'partCode' && typeof value === 'string' && value.trim()) {
          const cleanCode = extractBarcodePartCode(value, activeCatalog);
          updated.partCode = cleanCode;
          const matched = findMasterItemByBarcode(cleanCode, activeCatalog);
          if (matched) {
            updated.partName = matched.name || updated.partName;
            if (!updated.model) {
              updated.model = matched.model || '';
            }
          }
        }

        // Instant Auto-fill partCode & model if user enters/pastes partName
        if (field === 'partName' && typeof value === 'string' && value.trim()) {
          const queryName = value.trim().toLowerCase();
          const matched = activeCatalog.find(
            (cat) => (cat.name || '').trim().toLowerCase() === queryName
          );
          if (matched) {
            if (!updated.partCode) updated.partCode = extractBarcodePartCode(matched.code, activeCatalog) || matched.code || '';
            if (!updated.model) updated.model = matched.model || '';
          }
        }

        return updated;
      })
    );

    if (field === 'partCode' || field === 'partName') {
      setActiveSuggestionIdx(index);
      setActiveSuggestionField(field);
    }
  };

  // Helper to filter matching catalog items for suggestion dropdown
  const getFormPartSuggestions = (index: number): LabelItem[] => {
    if (activeSuggestionIdx !== index || !activeSuggestionField) return [];
    const part = formPartsList[index];
    if (!part) return [];

    const rawVal =
      activeSuggestionField === 'partCode' ? part.partCode : part.partName || '';
    const query = (rawVal || '').trim().toLowerCase();
    if (!query || query.length < 1) return [];

    const cleanQuery = (activeSuggestionField === 'partCode')
      ? extractBarcodePartCode(query, activeCatalog).toLowerCase()
      : query;

    return activeCatalog
      .filter((cat) => {
        const cCode = (cat.code || '').toLowerCase();
        const cCleanCode = extractBarcodePartCode(cCode, activeCatalog).toLowerCase();
        const cName = (cat.name || '').toLowerCase();
        const cModel = (cat.model || '').toLowerCase();
        return (
          cCode.includes(query) ||
          cCleanCode.includes(cleanQuery) ||
          cName.includes(query) ||
          cModel.includes(query)
        );
      })
      .slice(0, 8);
  };

  // Select a suggestion from the dropdown to auto-fill partCode, partName, and model
  const handleSelectCatalogSuggestion = (index: number, item: LabelItem) => {
    setFormPartsList((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              partCode: item.code || p.partCode,
              partName: item.name || p.partName,
              model: item.model || p.model || formData.model || '',
            }
          : p
      )
    );
    if (!formData.model && item.model) {
      setFormData((prev) => ({ ...prev, model: item.model }));
    }
    setActiveSuggestionIdx(null);
    setActiveSuggestionField(null);
    onShowToast(`Đã tự động chọn linh kiện: "${item.name}" (${item.code})`, 'info');
  };

  // Check if any entered parts in form already have other customers holding/booking them
  const activeHoldAlerts = useMemo(() => {
    if (!isModalOpen) return [];
    const inputCodes = formPartsList
      .map((p) => p.partCode?.trim().toLowerCase())
      .filter((c): c is string => Boolean(c && c.length >= 2));
    const inputNames = formPartsList
      .map((p) => p.partName?.trim().toLowerCase())
      .filter((n): n is string => Boolean(n && n.length >= 3));

    if (inputCodes.length === 0 && inputNames.length === 0) return [];

    return bookings.filter((b) => {
      if (editingItem && b.id === editingItem.id) return false;
      if (b.status === 'da_hoan_tat') return false;

      const bCode = (b.partCode || '').trim().toLowerCase();
      const bName = (b.partName || '').trim().toLowerCase();

      const matchCode = bCode && inputCodes.includes(bCode);
      const matchName = bName && inputNames.some((n) => bName.includes(n));

      const matchSub = (b.partsList || []).some((sub) => {
        const sCode = (sub.partCode || '').trim().toLowerCase();
        const sName = (sub.partName || '').trim().toLowerCase();
        return (sCode && inputCodes.includes(sCode)) || (sName && inputNames.some((n) => sName.includes(n)));
      });

      return matchCode || matchName || matchSub;
    });
  }, [isModalOpen, formPartsList, bookings, editingItem]);

  // Update requested quantity for a specific part
  const handleUpdatePartRequestedQty = (item: ShortageBookingItem, partIdOrIdx: string, newReqQty: number) => {
    const currentParts = getNormalizedBookingParts(item);
    const updatedParts = currentParts.map((p, idx) => {
      if (p.id === partIdOrIdx || String(idx) === partIdOrIdx) {
        const quantity = Math.max(1, p.quantity || 1);
        const clampedReq = Math.max(0, Math.min(quantity, newReqQty));
        // If requested quantity is lowered below stockedInQuantity, also reduce stockedInQuantity
        const currentStock = p.stockedInQuantity ?? 0;
        const clampedStock = Math.min(clampedReq, currentStock);
        return {
          ...p,
          quantity,
          requestedQuantity: clampedReq,
          isRequested: clampedReq >= quantity,
          stockedInQuantity: clampedStock,
          isStockedIn: clampedStock >= quantity,
        };
      }
      return p;
    });

    const calc = calculateShortageStatusFromParts(updatedParts, item.status, !!item.customerKeepsPart);
    const newStatus = calc.status;
    const currentDateTime = getCurrentDateTimeString();
    const nowStr = new Date().toISOString();

    const updatedList = bookings.map((b) => {
      if (b.id === item.id) {
        const isChanged = b.status !== newStatus;
        const newHistory = isChanged
          ? [
              ...(b.history || []),
              {
                status: newStatus,
                timestamp: currentDateTime,
                note: `Cập nhật xin LK: ${calc.totalRequestedQty}/${calc.totalRequiredQty} cái [${SHORTAGE_STATUS_CONFIG[newStatus]?.label || newStatus}]`,
              },
            ]
          : b.history;

        return {
          ...b,
          partsList: updatedParts,
          status: newStatus,
          hasAvailableParts: calc.isFullyStocked,
          requestedDate: b.requestedDate || (calc.hasAnyRequested ? currentDateTime : b.requestedDate),
          updatedAt: nowStr,
          history: newHistory,
        };
      }
      return b;
    });

    onUpdateBookings(updatedList);
    if (calc.isFullyRequested) {
      onShowToast(`Đã xin đủ ${calc.totalRequestedQty}/${calc.totalRequiredQty} linh kiện cho phiếu [${item.ticketNumber}]!`, 'success');
    } else if (calc.hasAnyRequested) {
      onShowToast(`Phiếu [${item.ticketNumber}]: Đã xin ${calc.totalRequestedQty}/${calc.totalRequiredQty} linh kiện (Chuyển Bước 2a. Chưa đủ)`, 'info');
    } else {
      onShowToast(`Phiếu [${item.ticketNumber}]: Chưa xin linh kiện nào (Chuyển Bước 1. Đã tạo phiếu)`, 'info');
    }
  };

  // Update stocked-in (received) quantity for a specific part
  const handleUpdatePartStockedQty = (item: ShortageBookingItem, partIdOrIdx: string, newStockQty: number) => {
    const currentParts = getNormalizedBookingParts(item);
    const currentDateTime = getCurrentDateTimeString();
    const updatedParts = currentParts.map((p, idx) => {
      if (p.id === partIdOrIdx || String(idx) === partIdOrIdx) {
        const quantity = Math.max(1, p.quantity || 1);
        const clampedStock = Math.max(0, Math.min(quantity, newStockQty));
        // When stocking in, requestedQuantity must be at least as much as stockedInQuantity
        const currentReq = p.requestedQuantity ?? 0;
        const clampedReq = Math.max(clampedStock, currentReq);
        return {
          ...p,
          quantity,
          stockedInQuantity: clampedStock,
          isStockedIn: clampedStock >= quantity,
          requestedQuantity: clampedReq,
          isRequested: clampedReq >= quantity,
          stockedInDate: clampedStock > 0 ? (p.stockedInDate || currentDateTime) : undefined,
        };
      }
      return p;
    });

    const calc = calculateShortageStatusFromParts(updatedParts, item.status, !!item.customerKeepsPart);
    const newStatus = calc.status;
    const nowStr = new Date().toISOString();

    let updatedStockedInDate = item.stockedInDate;
    if (calc.isFullyStocked && !updatedStockedInDate) {
      updatedStockedInDate = currentDateTime;
    }

    const updatedList = bookings.map((b) => {
      if (b.id === item.id) {
        const isChanged = b.status !== newStatus;
        const newHistory = isChanged
          ? [
              ...(b.history || []),
              {
                status: newStatus,
                timestamp: currentDateTime,
                note: `Cập nhật nhận LK về kho: ${calc.totalStockedQty}/${calc.totalRequiredQty} cái [${SHORTAGE_STATUS_CONFIG[newStatus]?.label || newStatus}]`,
              },
            ]
          : b.history;

        return {
          ...b,
          partsList: updatedParts,
          status: newStatus,
          hasAvailableParts: calc.isFullyStocked,
          stockedInDate: updatedStockedInDate,
          calledCustomerDate: newStatus === 'da_goi_kh' && !b.calledCustomerDate ? currentDateTime : b.calledCustomerDate,
          requestedDate: b.requestedDate || currentDateTime,
          callSubStatus: newStatus === 'da_goi_kh' ? b.callSubStatus || 'hen_ngay' : b.callSubStatus,
          appointmentDate: newStatus === 'da_goi_kh' ? b.appointmentDate || 'Ngày SVD (10-12 hằng tháng)' : b.appointmentDate,
          updatedAt: nowStr,
          history: newHistory,
        };
      }
      return b;
    });

    onUpdateBookings(updatedList);
    if (calc.isFullyStocked) {
      if (item.customerKeepsPart) {
        onShowToast(
          `🎉 Đã nhận đủ ${calc.totalStockedQty}/${calc.totalRequiredQty} linh kiện SVD về kho! Phiếu [${item.ticketNumber}] chuyển sang "4. Chờ khách lên (Hẹn ngày SVD)".`,
          'success'
        );
      } else {
        onShowToast(
          `🎉 Đã nhận đủ ${calc.totalStockedQty}/${calc.totalRequiredQty} linh kiện về kho! Phiếu [${item.ticketNumber}] chuyển sang "3. Nhập kho".`,
          'success'
        );
      }
    } else if (calc.hasAnyStocked) {
      onShowToast(
        `Phiếu [${item.ticketNumber}]: Đã nhận ${calc.totalStockedQty}/${calc.totalRequiredQty} linh kiện về kho (Chưa đủ LK - Đẩy về Bước 2a)`,
        'info'
      );
    } else {
      onShowToast(`Phiếu [${item.ticketNumber}]: Chưa nhận linh kiện nào về kho.`, 'info');
    }
  };

  // Toggle single part requested state directly on card (toggle 0 vs full)
  const handleTogglePartRequested = (item: ShortageBookingItem, partIdOrIdx: string) => {
    const parts = getNormalizedBookingParts(item);
    const found = parts.find((p, idx) => p.id === partIdOrIdx || String(idx) === partIdOrIdx);
    if (!found) return;
    const maxQty = found.quantity || 1;
    const currentReq = found.requestedQuantity ?? (found.isRequested ? maxQty : 0);
    const nextReq = currentReq >= maxQty ? 0 : maxQty;
    handleUpdatePartRequestedQty(item, partIdOrIdx, nextReq);
  };

  // Toggle single part stocked-in (received) state directly on card (toggle 0 vs full)
  const handleTogglePartStockedIn = (item: ShortageBookingItem, partIdOrIdx: string) => {
    const parts = getNormalizedBookingParts(item);
    const found = parts.find((p, idx) => p.id === partIdOrIdx || String(idx) === partIdOrIdx);
    if (!found) return;
    const maxQty = found.quantity || 1;
    const currentStock = found.stockedInQuantity ?? (found.isStockedIn ? maxQty : 0);
    const nextStock = currentStock >= maxQty ? 0 : maxQty;
    handleUpdatePartStockedQty(item, partIdOrIdx, nextStock);
  };

  // Batch selection handlers
  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (filteredList: ShortageBookingItem[]) => {
    if (selectedIds.length === filteredList.length && filteredList.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map((b) => b.id));
    }
  };

  const handleBatchUpdateStatus = (targetStatus: ShortageStatus) => {
    if (selectedIds.length === 0) return;

    const executeBatchUpdate = () => {
      const timestampStr = getCurrentDateTimeString();
      const nowStr = new Date().toISOString();

      const updatedList = bookings.map((b) => {
        if (selectedIds.includes(b.id)) {
          const newHistory = [
            ...(b.history || []),
            { status: targetStatus, timestamp: timestampStr },
          ];
          let updatedStockedIn = b.stockedInDate;
          let updatedCalledCustomer = b.calledCustomerDate;
          let updatedRequestedDate = b.requestedDate;

          if (targetStatus === 'da_nhap_kho') {
            if (!updatedStockedIn) updatedStockedIn = timestampStr;
            if (!updatedRequestedDate) updatedRequestedDate = timestampStr;
          } else if (targetStatus === 'da_goi_kh') {
            if (!updatedRequestedDate) updatedRequestedDate = timestampStr;
            if (!updatedStockedIn) updatedStockedIn = timestampStr;
            if (!updatedCalledCustomer) updatedCalledCustomer = timestampStr;
          } else if (targetStatus === 'da_xin_lk' && !updatedRequestedDate) {
            updatedRequestedDate = timestampStr;
          }

          const finalPartsList = b.partsList && b.partsList.length > 0
            ? b.partsList.map((p) => {
                if (targetStatus === 'da_tao_phieu') {
                  return { ...p, isRequested: false, isStockedIn: false };
                } else if (targetStatus === 'chua_xin_du_lk') {
                  return { ...p, isRequested: p.isRequested ?? false, isStockedIn: false };
                } else if (targetStatus === 'da_xin_lk') {
                  return { ...p, isRequested: true, isStockedIn: false };
                } else if (targetStatus === 'da_nhap_kho' || (targetStatus as string) === 'da_goi_kh' || (targetStatus as string) === 'da_hoan_tat') {
                  return { ...p, isRequested: true, isStockedIn: true };
                }
                return p;
              })
            : b.partsList;

          return {
            ...b,
            partsList: finalPartsList,
            status: targetStatus,
            stockedInDate: updatedStockedIn,
            calledCustomerDate: updatedCalledCustomer,
            requestedDate: updatedRequestedDate,
            updatedAt: nowStr,
            history: newHistory,
          };
        }
        return b;
      });

      onUpdateBookings(updatedList);
      onShowToast(
        `Đã xác nhận chuyển ${selectedIds.length} phiếu sang "${SHORTAGE_STATUS_CONFIG[targetStatus]?.label}" thành công!`,
        'success'
      );
      setSelectedIds([]);
    };

    setStatusConfirmModal({
      isOpen: true,
      title: 'Xác nhận chuyển trạng thái hàng loạt',
      toStatus: targetStatus,
      message: `Bạn có chắc chắn muốn chuyển trạng thái cho ${selectedIds.length} phiếu đã chọn sang "${SHORTAGE_STATUS_CONFIG[targetStatus]?.label}"?`,
      confirmButtonText: `Xác nhận chuyển (${selectedIds.length} phiếu)`,
      onConfirm: executeBatchUpdate,
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const authorName = currentUser?.name || 'Admin';

    const executeBatchDelete = async () => {
      try {
        for (const id of selectedIds) {
          const found = bookings.find((b) => b.id === id);
          await deleteShortageFromCloud(id, found?.ticketNumber || '', authorName);
        }
        const updated = bookings.filter((b) => !selectedIds.includes(b.id));
        onUpdateBookings(updated);
        setSelectedIds([]);
        onShowToast(`Đã xóa vĩnh viễn ${count} phiếu đã chọn khỏi hệ thống!`, 'success');
      } catch (err: any) {
        console.error(err);
        onShowToast(`Lỗi khi xóa hàng loạt: ${err?.message || 'Thử lại sau'}`, 'error');
      }
    };

    setStatusConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa vĩnh viễn phiếu hàng loạt',
      message: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${count} phiếu đã chọn khỏi hệ thống? Thao tác này không thể hoàn tác!`,
      confirmButtonText: `Xác Nhận Xóa (${count} phiếu)`,
      onConfirm: executeBatchDelete,
    });
  };

  // Batch print selected shortage tickets (3x2 inch labels)
  const handleBatchPrintShortageSelected = useCallback(() => {
    if (selectedIds.length === 0) {
      onShowToast('Vui lòng tick chọn ít nhất 1 phiếu đặt chờ trong bảng để in tem!', 'error');
      return;
    }
    const selectedBookings = bookings.filter((b) => selectedIds.includes(b.id));
    if (selectedBookings.length === 0) {
      onShowToast('Không tìm thấy dữ liệu phiếu được chọn!', 'error');
      return;
    }
    onShowToast(`⚡ Đang chuẩn bị in tem cho ${selectedBookings.length} phiếu đặt chờ đã chọn...`, 'info');
    printBatchShortageLabels(selectedBookings);
  }, [selectedIds, bookings, onShowToast]);

  // Listen for trigger-shortage-print event (dispatched when user presses Ctrl+P or clicks desktop print menu)
  useEffect(() => {
    const handleTriggerShortagePrint = () => {
      if (selectedIds.length > 0) {
        handleBatchPrintShortageSelected();
      } else {
        onShowToast(
          'Vui lòng tick chọn vào ô vuông ☑ của phiếu đặt chờ cần in tem trong bảng (hoặc bấm nút 🖨️ trên từng dòng phiếu)!',
          'info'
        );
      }
    };

    window.addEventListener('trigger-shortage-print', handleTriggerShortagePrint);
    return () => window.removeEventListener('trigger-shortage-print', handleTriggerShortagePrint);
  }, [selectedIds, handleBatchPrintShortageSelected, onShowToast]);

  // Batch convert to SVD
  const handleBatchConvertToSvd = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const timestampStr = getCurrentDateTimeString();
    const nowStr = new Date().toISOString();
    const authorName = currentUser?.name || currentUser?.username || 'Nhân viên';

    const executeBatchSvd = () => {
      const updatedList = bookings.map((b) => {
        if (selectedIds.includes(b.id)) {
          const isStep1Or2 =
            b.status === 'da_tao_phieu' ||
            b.status === 'chua_xin_du_lk' ||
            b.status === 'da_xin_lk';
          const hasAllPartsStocked =
            b.partsList &&
            b.partsList.length > 0 &&
            b.partsList.every((p) => p.isStockedIn);
          const isStocked = isStep1Or2
            ? Boolean(hasAllPartsStocked)
            : (b.hasAvailableParts ||
               b.status === 'da_nhap_kho' ||
               b.status === 'da_goi_kh' ||
               Boolean(b.stockedInDate));
          // When parts are available, SVD tickets directly transition to Step 4: Chờ khách lên
          const targetSt = isStocked && b.status !== 'da_hoan_tat' ? ('da_goi_kh' as ShortageStatus) : b.status;
          const newHistory = [
            ...(b.history || []),
            {
              status: targetSt,
              timestamp: timestampStr,
              note: `Chuyển hàng loạt sang Đặt giữ SVD${isStocked ? ' ➔ Chuyển bước 4: Chờ khách lên (Đã có đủ LK)' : ''} (Khách áp dụng khuyến mãi SVD - Bởi: ${authorName})`,
            },
          ];

          const finalPartsList =
            targetSt === 'da_goi_kh' && b.partsList && b.partsList.length > 0
              ? b.partsList.map((p) => ({ ...p, isRequested: true, isStockedIn: true }))
              : b.partsList;

          return {
            ...b,
            partsList: finalPartsList,
            customerKeepsPart: true,
            status: targetSt,
            hasAvailableParts: Boolean(isStocked),
            stockedInDate: isStocked && !b.stockedInDate ? timestampStr : b.stockedInDate,
            calledCustomerDate: isStocked && !b.calledCustomerDate ? timestampStr : b.calledCustomerDate,
            requestedDate: isStocked && !b.requestedDate ? timestampStr : b.requestedDate,
            callSubStatus: targetSt === 'da_goi_kh' ? b.callSubStatus || 'hen_ngay' : b.callSubStatus,
            appointmentDate: targetSt === 'da_goi_kh' ? b.appointmentDate || 'Ngày SVD (10-12 hằng tháng)' : b.appointmentDate,
            updatedAt: nowStr,
            history: newHistory,
          };
        }
        return b;
      });

      onUpdateBookings(updatedList);
      onShowToast(`Đã chuyển ${count} phiếu đã chọn sang Đặt giữ SVD (Áp dụng khuyến mãi SVD)!`, 'success');
      setSelectedIds([]);
    };

    setStatusConfirmModal({
      isOpen: true,
      title: 'Xác nhận chuyển Đặt Giữ SVD hàng loạt',
      message: `Bạn có chắc chắn muốn chuyển ${count} phiếu đã chọn sang chế độ "Đặt giữ SVD" để áp dụng khuyến mãi Ngày Dịch Vụ SVD?`,
      confirmButtonText: `Xác nhận chuyển (${count} phiếu) sang Đặt giữ SVD`,
      onConfirm: executeBatchSvd,
    });
  };

  // Open modal to convert/switch a ticket from any step (1, 2a, 2, 3, 4) to SVD Hold
  const handleOpenConvertToSvdModal = (item: ShortageBookingItem) => {
    setConvertToSvdModalItem(item);
    
    // Check if the ticket is currently in requesting phase (Step 1-2: da_tao_phieu, chua_xin_du_lk, da_xin_lk)
    const isStep1Or2 =
      item.status === 'da_tao_phieu' ||
      item.status === 'chua_xin_du_lk' ||
      item.status === 'da_xin_lk';

    // Check if parts are actually physically stocked in partsList
    const hasAllPartsStocked =
      item.partsList &&
      item.partsList.length > 0 &&
      item.partsList.every((p) => p.isStockedIn);

    // If ticket is at step 1-2: default to false (chưa có sẵn LK) unless all parts are stocked
    // If ticket is at step 3-5: parts are in warehouse
    const isStocked = isStep1Or2
      ? Boolean(hasAllPartsStocked)
      : (item.hasAvailableParts ??
         (item.status === 'da_nhap_kho' ||
          item.status === 'da_goi_kh' ||
          item.status === 'da_hoan_tat' ||
          Boolean(item.stockedInDate)));
    
    // Set target status strictly to current ticket status
    setSvdTargetStatus(item.status);
    setSvdHasAvailableParts(Boolean(isStocked));
    setSvdNoteOption('🎁 Áp dụng ưu đãi Ngày Dịch Vụ SVD (10-12 hằng tháng)');
    setSvdCustomNote(item.note || '');
  };

  // Internal execution for saving SVD
  const doSaveConvertToSvd = (
    isRemovingSvd: boolean,
    targetStatus: ShortageStatus,
    overrideHasAvailableParts?: boolean
  ) => {
    if (!convertToSvdModalItem) return;
    const currentDateTime = getCurrentDateTimeString();
    const nowStr = new Date().toISOString();
    const authorName = currentUser?.name || currentUser?.username || 'Nhân viên';

    if (isRemovingSvd) {
      const updatedList = bookings.map((b) => {
        if (b.id === convertToSvdModalItem.id) {
          const newHistory = [
            ...(b.history || []),
            {
              status: b.status,
              timestamp: currentDateTime,
              note: `Hủy chế độ Đặt giữ SVD ➔ Trở lại phiếu đặt chờ thông thường (Bởi: ${authorName})`,
            },
          ];
          return {
            ...b,
            customerKeepsPart: false,
            updatedAt: nowStr,
            history: newHistory,
          };
        }
        return b;
      });

      onUpdateBookings(updatedList);
      onShowToast(`Đã hủy chế độ Đặt giữ SVD cho phiếu [${convertToSvdModalItem.ticketNumber}]`, 'info');
      setConvertToSvdModalItem(null);
      return;
    }

    const finalStatus: ShortageStatus = targetStatus;
    const effectiveHasAvailableParts =
      overrideHasAvailableParts !== undefined
        ? overrideHasAvailableParts
        : (finalStatus === 'da_tao_phieu' || finalStatus === 'chua_xin_du_lk' || finalStatus === 'da_xin_lk'
            ? false
            : svdHasAvailableParts);

    let updatedStockedIn = convertToSvdModalItem.stockedInDate;
    let updatedCalledCustomer = convertToSvdModalItem.calledCustomerDate;
    let updatedRequestedDate = convertToSvdModalItem.requestedDate;

    if (finalStatus === 'da_goi_kh') {
      if (!updatedRequestedDate) updatedRequestedDate = currentDateTime;
      if (!updatedStockedIn) updatedStockedIn = currentDateTime;
      if (!updatedCalledCustomer) updatedCalledCustomer = currentDateTime;
    } else if (finalStatus === 'da_nhap_kho') {
      if (!updatedStockedIn) updatedStockedIn = currentDateTime;
      if (!updatedRequestedDate) updatedRequestedDate = currentDateTime;
    } else if (finalStatus === 'da_xin_lk') {
      if (!updatedRequestedDate) updatedRequestedDate = currentDateTime;
      if (!effectiveHasAvailableParts) {
        updatedStockedIn = undefined;
        updatedCalledCustomer = undefined;
      }
    } else if (finalStatus === 'chua_xin_du_lk' || finalStatus === 'da_tao_phieu') {
      if (!effectiveHasAvailableParts) {
        updatedStockedIn = undefined;
        updatedCalledCustomer = undefined;
      }
    }

    const additionalParts = [];
    if (svdNoteOption?.trim()) additionalParts.push(svdNoteOption.trim());
    if (svdCustomNote?.trim() && !convertToSvdModalItem.note?.includes(svdCustomNote.trim())) {
      additionalParts.push(svdCustomNote.trim());
    }

    let combinedNote = convertToSvdModalItem.note || '';
    if (additionalParts.length > 0) {
      combinedNote = convertToSvdModalItem.note ? `${convertToSvdModalItem.note} • ${additionalParts.join(' • ')}` : additionalParts.join(' • ');
    }

    const finalPartsList =
      convertToSvdModalItem.partsList && convertToSvdModalItem.partsList.length > 0
        ? convertToSvdModalItem.partsList.map((p) => {
            if (finalStatus === 'da_tao_phieu') {
              return { ...p, isRequested: false, isStockedIn: false };
            } else if (finalStatus === 'chua_xin_du_lk') {
              return { ...p, isRequested: p.isRequested ?? false, isStockedIn: false };
            } else if (finalStatus === 'da_xin_lk') {
              return { ...p, isRequested: true, isStockedIn: false };
            } else {
              return { ...p, isRequested: true, isStockedIn: true };
            }
          })
        : convertToSvdModalItem.partsList;

    const newHistory = [
      ...(convertToSvdModalItem.history || []),
      {
        status: finalStatus,
        timestamp: currentDateTime,
        note:
          finalStatus === 'da_goi_kh'
            ? `Chuyển sang Đặt giữ SVD ➔ Bước 4: Đã gọi KH / Chờ khách lên (Đã có đủ linh kiện - Hẹn ngày SVD - Bởi: ${authorName})`
            : `Chuyển sang Đặt giữ SVD ở ${SHORTAGE_STATUS_CONFIG[finalStatus]?.label || finalStatus} (${effectiveHasAvailableParts ? 'Đã có sẵn LK' : 'Chưa có sẵn LK'} - Khách áp dụng khuyến mãi SVD - Bởi: ${authorName})`,
      },
    ];

    const updatedList = bookings.map((b) => {
      if (b.id === convertToSvdModalItem.id) {
        return {
          ...b,
          partsList: finalPartsList,
          customerKeepsPart: true,
          hasAvailableParts: effectiveHasAvailableParts,
          status: finalStatus,
          stockedInDate: updatedStockedIn,
          calledCustomerDate: updatedCalledCustomer,
          requestedDate: updatedRequestedDate,
          callSubStatus: finalStatus === 'da_goi_kh' ? b.callSubStatus || 'hen_ngay' : b.callSubStatus,
          appointmentDate:
            finalStatus === 'da_goi_kh' ? b.appointmentDate || 'Ngày SVD (10-12 hằng tháng)' : b.appointmentDate,
          note: combinedNote,
          updatedAt: nowStr,
          history: newHistory,
        };
      }
      return b;
    });

    onUpdateBookings(updatedList);
    onShowToast(
      finalStatus === 'da_goi_kh'
        ? `Đã chuyển phiếu [${convertToSvdModalItem.ticketNumber}] sang Đặt giữ SVD ➔ Bước 4: Đã gọi KH (Chờ khách lên)!`
        : `Đã lưu thiết lập Đặt giữ SVD cho phiếu [${convertToSvdModalItem.ticketNumber}] ở ${SHORTAGE_STATUS_CONFIG[finalStatus]?.label || finalStatus}!`,
      'success'
    );
    setConvertToSvdModalItem(null);
  };

  // Save SVD Conversion or cancel SVD with check for Step 4 & Inappropriate status warnings
  const handleSaveConvertToSvd = (isRemovingSvd = false, bypassWarning = false) => {
    if (!convertToSvdModalItem) return;

    if (isRemovingSvd) {
      doSaveConvertToSvd(true, svdTargetStatus);
      return;
    }

    const isStep345 =
      svdTargetStatus === 'da_nhap_kho' ||
      svdTargetStatus === 'da_goi_kh' ||
      svdTargetStatus === 'da_hoan_tat';

    // CASE 1: Chưa có LK sẵn (!svdHasAvailableParts), nhưng người dùng chọn Bước 3, 4, 5
    // -> Bật cảnh báo lựa chọn chưa phù hợp
    if (!bypassWarning && !svdHasAvailableParts && isStep345) {
      setStatusConfirmModal({
        isOpen: true,
        title: 'Cảnh báo: Lựa chọn tiến độ chưa phù hợp',
        ticketNumber: convertToSvdModalItem.ticketNumber,
        customerName: convertToSvdModalItem.customerName,
        fromStatus: convertToSvdModalItem.status,
        toStatus: svdTargetStatus,
        message: `Phiếu #${convertToSvdModalItem.ticketNumber} hiện đang ở tình trạng "Chưa có linh kiện sẵn" (tiến độ thực tế: ${SHORTAGE_STATUS_CONFIG[convertToSvdModalItem.status]?.label || convertToSvdModalItem.status}), nhưng bạn đang chọn lưu ở [${SHORTAGE_STATUS_CONFIG[svdTargetStatus]?.label || svdTargetStatus}].\n\nNếu linh kiện thực tế đã về kho, vui lòng xác nhận cập nhật thành "Đã có linh kiện sẵn". Nếu chưa có linh kiện, vui lòng giữ nguyên bước xin LK tương ứng để tránh sai lệch dữ liệu quản lý kho.`,
        confirmButtonText: 'Đã có LK sẵn & Tiếp tục lưu',
        secondaryButtonText: `Giữ đúng tiến độ (${SHORTAGE_STATUS_CONFIG[convertToSvdModalItem.status]?.label || 'Bước xin LK'})`,
        onConfirm: () => {
          setSvdHasAvailableParts(true);
          doSaveConvertToSvd(false, svdTargetStatus, true);
        },
        onSecondaryConfirm: () => {
          const fallback = (convertToSvdModalItem.status === 'da_nhap_kho' || convertToSvdModalItem.status === 'da_goi_kh')
            ? 'da_xin_lk'
            : convertToSvdModalItem.status;
          setSvdTargetStatus(fallback);
          setSvdHasAvailableParts(false);
          doSaveConvertToSvd(false, fallback, false);
        },
      });
      return;
    }

    // CASE 2: Đã có LK sẵn (svdHasAvailableParts = true), nhưng chọn Bước 3 (Nhập kho)
    // -> Nhắc nhở khuyên chọn Bước 4 (Đã gọi KH / Chờ khách lên) cho phiếu SVD
    if (!bypassWarning && svdHasAvailableParts && svdTargetStatus === 'da_nhap_kho') {
      setStatusConfirmModal({
        isOpen: true,
        title: 'Nhắc nhở: Chọn Bước 4 (Đã gọi KH / Chờ khách lên)',
        ticketNumber: convertToSvdModalItem.ticketNumber,
        customerName: convertToSvdModalItem.customerName,
        fromStatus: svdTargetStatus,
        toStatus: 'da_goi_kh',
        message: `Linh kiện của phiếu #${convertToSvdModalItem.ticketNumber} đã có sẵn tại kho (Bước 3) và khách đổi sang Đặt giữ SVD. Theo quy trình, nên chọn "Bước 4. Đã gọi KH (Chờ khách lên)" vì đã có đủ linh kiện và khách đã hẹn lịch Ngày Dịch Vụ SVD (10-12) để theo dõi thời gian và nhắc gọi lại nếu quá hạn.`,
        confirmButtonText: 'Chuyển sang Bước 4 (Đã gọi KH)',
        secondaryButtonText: 'Vẫn lưu Bước 3. Nhập kho',
        onConfirm: () => {
          setSvdTargetStatus('da_goi_kh');
          doSaveConvertToSvd(false, 'da_goi_kh', true);
        },
        onSecondaryConfirm: () => {
          doSaveConvertToSvd(false, svdTargetStatus, true);
        },
      });
      return;
    }

    // CASE 3: Phiếu ở bước 1-2 và tình trạng chưa có LK sẵn (!svdHasAvailableParts)
    // -> Lưu NGAY LẬP TỨC trạng thái đó, không cảnh báo phi lý!
    doSaveConvertToSvd(false, svdTargetStatus, svdHasAvailableParts);
  };

  // Handle extending SVD appointment to next month
  const handleExtendSvdNextMonth = (item: ShortageBookingItem) => {
    const timestampStr = getCurrentDateTimeString();
    const nowStr = new Date().toISOString();
    const authorName = currentUser?.name || currentUser?.username || 'Nhân viên';

    const updatedList = bookings.map((b) => {
      if (b.id === item.id) {
        const extNote = `Khách hẹn chờ sang đợt Ngày Dịch Vụ SVD (10-12) đợt tiếp theo (Ghi nhận bởi: ${authorName})`;
        const newHistory = [
          ...(b.history || []),
          {
            status: b.status,
            timestamp: timestampStr,
            note: extNote,
          },
        ];
        return {
          ...b,
          appointmentDate: 'Ngày Dịch Vụ SVD (10-12) đợt tới',
          callSubStatus: 'cho_them_thoi_gian' as ShortageCallSubStatus,
          note: b.note ? `${b.note} • ${extNote}` : extNote,
          updatedAt: nowStr,
          history: newHistory,
        };
      }
      return b;
    });

    onUpdateBookings(updatedList);
    onShowToast(`Đã gia hạn phiếu [${item.ticketNumber}] chờ sang đợt Ngày Dịch Vụ SVD tháng sau!`, 'success');
  };

  // Open step 5 quick complete / closure modal
  const handleOpenCompleteModal = (
    item: ShortageBookingItem,
    type: 'success_repair' | 'close_no_repair' = 'success_repair',
    defaultClosureReason = 'khach_doi_y'
  ) => {
    setCompletingItem(item);
    setCompleteType(type);
    setCompleteTechName(item.technicianName || currentUser?.name || currentUser?.username || 'Kỹ thuật viên');
    setCompleteArrivedDate(item.customerArrivedDate || getCurrentDateTimeString());
    setCompleteNote(item.note || '');
    setCompleteClosureReason(
      item.closureReason
        ? SHORTAGE_CLOSURE_REASONS.find((r) => r.label === item.closureReason || r.id === item.closureReason)?.id || 'ly_do_khac'
        : defaultClosureReason
    );
    setCompleteCustomReason(
      item.closureNote ||
        (item.closureReason && !SHORTAGE_CLOSURE_REASONS.some((r) => r.label === item.closureReason || r.id === item.closureReason)
          ? item.closureReason
          : '')
    );
  };

  // Handle confirm Step 5 (Khách đã lên thay LK hoặc Đóng hoàn tất do khách không thay)
  const handleConfirmCompleteStep5 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingItem) return;

    const executeConfirmComplete = () => {
      const finalTechName = completeTechName.trim() || currentUser?.name || 'Kỹ thuật viên';
      const finalArrivedDate = completeArrivedDate.trim() || getCurrentDateTimeString();
      const isNoRepair = completeType === 'close_no_repair';

      const reasonObj = SHORTAGE_CLOSURE_REASONS.find((r) => r.id === completeClosureReason);
      const reasonLabel =
        completeClosureReason === 'ly_do_khac'
          ? completeCustomReason.trim() || 'Lý do khác'
          : reasonObj?.label || 'Khách không thay linh kiện';

      const updatedList = bookings.map((b) => {
        if (b.id === completingItem.id) {
          const historyNote = isNoRepair
            ? `Đóng hoàn tất phiếu: ${reasonLabel}${completeCustomReason && completeClosureReason !== 'ly_do_khac' ? ` (Ghi chú: ${completeCustomReason})` : ''} [Bởi: ${finalTechName}]`
            : `Khách đã lên - KT xử lý: ${finalTechName}${completeNote ? ` (${completeNote})` : ''}`;

          const newHistory = [
            ...(b.history || []),
            {
              status: 'da_hoan_tat' as ShortageStatus,
              timestamp: finalArrivedDate,
              note: historyNote,
            },
          ];

          return {
            ...b,
            partsList:
              b.partsList && b.partsList.length > 0
                ? b.partsList.map((p) => ({ ...p, isRequested: true }))
                : b.partsList,
            status: 'da_hoan_tat' as ShortageStatus,
            isCompletedWithoutRepair: isNoRepair,
            closureReason: isNoRepair ? reasonLabel : undefined,
            closureNote: isNoRepair ? completeCustomReason.trim() : undefined,
            closureBy: isNoRepair ? finalTechName : undefined,
            customerArrivedDate: isNoRepair ? undefined : finalArrivedDate,
            technicianName: finalTechName,
            stockedInDate: b.stockedInDate || finalArrivedDate,
            calledCustomerDate: b.calledCustomerDate || finalArrivedDate,
            note: isNoRepair
              ? completeCustomReason.trim()
                ? `[Đã đóng: ${reasonLabel}] ${completeCustomReason.trim()}${b.note ? ` | Ghi chú cũ: ${b.note}` : ''}`
                : `[Đã đóng: ${reasonLabel}] ${b.note || ''}`.trim()
              : completeNote.trim()
              ? completeNote.trim()
              : b.note,
            updatedAt: new Date().toISOString(),
            history: newHistory,
          };
        }
        return b;
      });

      onUpdateBookings(updatedList);
      if (isNoRepair) {
        onShowToast(
          `Đã đóng hoàn tất phiếu [${completingItem.ticketNumber}]: ${reasonLabel}`,
          'info'
        );
      } else {
        onShowToast(
          `Đã hoàn tất tiến độ 5: Khách đã lên - Kỹ thuật "${finalTechName}" đã xử lý!`,
          'success'
        );
      }
      setCompletingItem(null);
    };

    const finalArrivedDate = completeArrivedDate.trim() || getCurrentDateTimeString();
    triggerSaveWithDateCheck(
      {
        bookingDate: completingItem.bookingDate,
        stockedInDate: completingItem.stockedInDate,
        calledCustomerDate: completingItem.calledCustomerDate,
        customerArrivedDate: finalArrivedDate,
      },
      executeConfirmComplete
    );
  };

  // Handle 1-click batch close all tickets that are overdue 7 days since called
  const handleBulkCloseOverdue = () => {
    const overdueList = bookings.filter((b) => checkOverdue7Days(b).isOverdue);
    if (overdueList.length === 0) {
      onShowToast('Không có phiếu nào quá hạn 7 ngày cần đóng.', 'info');
      setBulkCloseOverdueModal(false);
      return;
    }

    const currentDateTime = getCurrentDateTimeString();
    const closerName = currentUser?.name || currentUser?.username || 'Hệ thống / KTV';

    const updatedList = bookings.map((b) => {
      if (checkOverdue7Days(b).isOverdue) {
        const historyNote = `Tự động đóng hoàn tất: Quá hạn 7 ngày từ khi gọi báo có LK nhưng khách không lên thay [Bởi: ${closerName}]`;
        const newHistory = [
          ...(b.history || []),
          {
            status: 'da_hoan_tat' as ShortageStatus,
            timestamp: currentDateTime,
            note: historyNote,
          },
        ];

        return {
          ...b,
          status: 'da_hoan_tat' as ShortageStatus,
          isCompletedWithoutRepair: true,
          closureReason: 'Quá hạn 7 ngày từ khi gọi báo có LK - Đóng hoàn tất',
          closureNote: 'Khách không lên nhận máy/thay sau 7 ngày kể từ khi trung tâm liên hệ thông báo linh kiện đã về.',
          closureBy: closerName,
          note: `[Đã đóng: Quá 7 ngày không lên] ${b.note || ''}`.trim(),
          updatedAt: new Date().toISOString(),
          history: newHistory,
        };
      }
      return b;
    });

    onUpdateBookings(updatedList);
    onShowToast(`Đã đóng hoàn tất thành công ${overdueList.length} phiếu quá hạn 7 ngày!`, 'success');
    setBulkCloseOverdueModal(false);
  };

  // Save form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();

    // Check quantity validation for each part item in formPartsList
    for (let i = 0; i < formPartsList.length; i++) {
      const q = formPartsList[i].quantity;
      if (q === undefined || q === null || Number(q) < 1 || isNaN(Number(q))) {
        onShowToast(`Linh kiện #${i + 1} có số lượng nhỏ hơn 1. Vui lòng nhập số lượng tối thiểu là 1!`, 'error');
        return;
      }
    }

    const nowStr = new Date().toISOString();
    const timestampStr = getCurrentDateTimeString();

    // Filter valid parts from formPartsList respecting the actual user checked state and quantities
    const validParts: ShortagePartSubItem[] = formPartsList
      .map((p, idx) => {
        const qty = p.quantity && Number(p.quantity) >= 1 ? Number(p.quantity) : 1;
        const reqQ = typeof p.requestedQuantity === 'number'
          ? Math.max(0, Math.min(qty, p.requestedQuantity))
          : (p.isRequested ? qty : 0);
        const stockQ = typeof p.stockedInQuantity === 'number'
          ? Math.max(0, Math.min(qty, p.stockedInQuantity))
          : (p.isStockedIn ? qty : 0);

        return {
          id: p.id || `part-${Date.now()}-${idx}`,
          partCode: p.partCode.trim(),
          partName: p.partName.trim(),
          model: p.model?.trim() || formData.model.trim(),
          quantity: qty,
          requestedQuantity: reqQ,
          isRequested: reqQ >= qty,
          stockedInQuantity: stockQ,
          isStockedIn: stockQ >= qty,
        };
      })
      .filter((p) => p.partCode || p.partName);

    if (validParts.length === 0) {
      if (formData.partCode.trim() || formData.partName.trim()) {
        const qty = formData.quantity && Number(formData.quantity) >= 1 ? Number(formData.quantity) : 1;
        const isReq = formData.status !== 'da_tao_phieu' && formData.status !== 'chua_xin_du_lk';
        const isStock = formData.status === 'da_nhap_kho' || formData.status === 'da_goi_kh' || formData.status === 'da_hoan_tat';
        validParts.push({
          id: `part-${Date.now()}-0`,
          partCode: formData.partCode.trim(),
          partName: formData.partName.trim(),
          model: formData.model.trim(),
          quantity: qty,
          requestedQuantity: isReq ? qty : 0,
          isRequested: isReq,
          stockedInQuantity: isStock ? qty : 0,
          isStockedIn: isStock,
        });
      } else {
        onShowToast('Vui lòng nhập ít nhất 1 mã linh kiện hoặc tên linh kiện', 'error');
        return;
      }
    }

    const primaryPart = validParts[0];
    const calc = calculateShortageStatusFromParts(validParts, formData.status, !!formData.customerKeepsPart);
    let calculatedStatus = calc.status;
    let finalHasAvailableParts = calc.isFullyStocked;

    // If user explicitly chose da_hoan_tat or da_goi_kh and all parts are stocked, maintain it
    if ((formData.status === 'da_hoan_tat' || formData.status === 'da_goi_kh') && calc.isFullyStocked) {
      calculatedStatus = formData.status;
    }

    // Synchronize parts flags with calculatedStatus
    const finalValidParts = validParts.map((p) => {
      const qty = p.quantity || 1;
      if (calculatedStatus === 'da_nhap_kho' || calculatedStatus === 'da_goi_kh' || calculatedStatus === 'da_hoan_tat') {
        return { ...p, isRequested: true, requestedQuantity: qty, isStockedIn: true, stockedInQuantity: qty };
      } else if (calculatedStatus === 'da_xin_lk') {
        return { ...p, isRequested: true, requestedQuantity: qty, isStockedIn: false, stockedInQuantity: 0 };
      } else if (calculatedStatus === 'da_tao_phieu') {
        return { ...p, isRequested: false, requestedQuantity: 0, isStockedIn: false, stockedInQuantity: 0 };
      }
      return p;
    });

    // Auto populate dates according to status if empty
    let finalRequestedDate = formData.requestedDate;
    let finalStockedInDate = formData.stockedInDate;
    let finalCalledCustomerDate = formData.calledCustomerDate;
    let finalCustomerArrivedDate = formData.customerArrivedDate;
    let finalTechnicianName = formData.technicianName;

    if ((calculatedStatus === 'da_xin_lk' || calculatedStatus === 'chua_xin_du_lk' || calculatedStatus === 'da_nhap_kho' || calculatedStatus === 'da_goi_kh' || calculatedStatus === 'da_hoan_tat') && !finalRequestedDate) {
      finalRequestedDate = timestampStr;
    }

    if (calculatedStatus === 'da_nhap_kho' && !finalStockedInDate) {
      finalStockedInDate = timestampStr;
    } else if (calculatedStatus === 'da_goi_kh') {
      if (!finalStockedInDate) finalStockedInDate = timestampStr;
      if (!finalCalledCustomerDate) finalCalledCustomerDate = timestampStr;
    } else if (calculatedStatus === 'da_hoan_tat') {
      if (!finalStockedInDate) finalStockedInDate = timestampStr;
      if (!finalCalledCustomerDate) finalCalledCustomerDate = timestampStr;
      if (!finalCustomerArrivedDate) finalCustomerArrivedDate = timestampStr;
      if (!finalTechnicianName) finalTechnicianName = currentUser?.name || 'Kỹ thuật viên';
    }

    // If staff user (non-admin) is editing an existing ticket -> Send edit request for admin approval
    if (editingItem && !isAdmin) {
      if (!editReasonInput.trim()) {
        onShowToast('Vui lòng nhập lý do xin chỉnh sửa phiếu này để gửi Quản trị viên duyệt!', 'error');
        return;
      }
      setIsSubmittingEdit(true);
      const requesterName = currentUser?.name || currentUser?.username || 'Kỹ thuật viên';
      const pendingData: Partial<ShortageBookingItem> = {
        ticketNumber: formData.ticketNumber,
        partCode: primaryPart.partCode,
        partName: primaryPart.partName,
        model: primaryPart.model || formData.model,
        partsList: finalValidParts,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        bookingDate: formData.bookingDate,
        status: calculatedStatus,
        location: formData.location,
        note: formData.note,
        customerKeepsPart: !!formData.customerKeepsPart,
        isCustomerCallHold: !!formData.isCustomerCallHold,
        hasAvailableParts: formData.hasAvailableParts,
        requestedDate: finalRequestedDate,
        stockedInDate: finalStockedInDate,
        calledCustomerDate: finalCalledCustomerDate,
        customerArrivedDate: finalCustomerArrivedDate,
        creatorTechnician: (formData.creatorTechnician || '').trim() || undefined,
        technicianName: finalTechnicianName?.trim() || undefined,
      };

      requestShortageEdit(
        editingItem.id,
        editingItem.ticketNumber,
        pendingData,
        editReasonInput.trim(),
        requesterName
      )
        .then(() => {
          const updatedList = bookings.map((item) => {
            if (item.id === editingItem.id) {
              return {
                ...item,
                editRequested: true,
                editReason: editReasonInput.trim(),
                editRequestedBy: requesterName,
                editRequestedAt: new Date().toISOString(),
                pendingEditData: pendingData,
              };
            }
            return item;
          });
          onUpdateBookings(updatedList);
          onShowToast(`Đã gửi yêu cầu chỉnh sửa phiếu [${editingItem.ticketNumber}] cho Quản trị viên (Admin) duyệt!`, 'info');
          setIsModalOpen(false);
        })
        .catch((err: any) => {
          console.error(err);
          onShowToast(`Lỗi khi gửi yêu cầu sửa phiếu: ${err?.message || 'Thử lại sau'}`, 'error');
        })
        .finally(() => {
          setIsSubmittingEdit(false);
        });
      return;
    }

    const executeSaveForm = () => {
      if (editingItem) {
        // Update existing single ticket item
        const updatedList = bookings.map((item) => {
          if (item.id === editingItem.id) {
            const isStatusChanged = item.status !== calculatedStatus;
            const newHistory = [...(item.history || [])];
            if (isStatusChanged) {
              newHistory.push({
                status: calculatedStatus,
                timestamp: timestampStr,
                note: formData.note,
              });
            }
            return {
              ...item,
              ...formData,
              partCode: primaryPart.partCode,
              partName: primaryPart.partName,
              model: primaryPart.model || formData.model,
              partsList: finalValidParts,
              status: calculatedStatus,
              hasAvailableParts: finalHasAvailableParts,
              requestedDate: finalRequestedDate,
              stockedInDate: finalStockedInDate,
              calledCustomerDate: finalCalledCustomerDate,
              customerArrivedDate: finalCustomerArrivedDate,
              creatorTechnician: (formData.creatorTechnician || '').trim() || undefined,
              technicianName: finalTechnicianName?.trim() || undefined,
              createdBy: (formData.createdBy || item.createdBy || currentUser?.name || currentUser?.username || 'Hệ thống').trim(),
              editRequested: false,
              editReason: undefined,
              editRequestedBy: undefined,
              editRequestedAt: undefined,
              pendingEditData: undefined,
              updatedAt: nowStr,
              history: newHistory,
            };
          }
          return item;
        });
        onUpdateBookings(updatedList);
        onShowToast(`Đã cập nhật thông tin phiếu đặt chờ [${formData.ticketNumber}]`, 'success');
      } else {
        // Create new single ticket item
        const finalCreator = (formData.createdBy || currentUser?.name || currentUser?.username || 'Hệ thống').trim();
        const newItem: ShortageBookingItem = {
          id: `shortage-${Date.now()}`,
          ...formData,
          partCode: primaryPart.partCode,
          partName: primaryPart.partName,
          model: primaryPart.model || formData.model,
          partsList: finalValidParts,
          status: calculatedStatus,
          hasAvailableParts: finalHasAvailableParts,
          requestedDate: finalRequestedDate,
          stockedInDate: finalStockedInDate,
          calledCustomerDate: finalCalledCustomerDate,
          customerArrivedDate: finalCustomerArrivedDate,
          creatorTechnician: (formData.creatorTechnician || '').trim() || undefined,
          technicianName: finalTechnicianName?.trim() || undefined,
          createdBy: finalCreator,
          createdByUid: currentUser?.uid || '',
          createdAt: nowStr,
          updatedAt: nowStr,
          history: [
            {
              status: calculatedStatus,
              timestamp: timestampStr,
              note: formData.note,
            },
          ],
        };

        onUpdateBookings([newItem, ...bookings]);
        onShowToast(
          `Đã tạo phiếu [${formData.ticketNumber}] gồm ${finalValidParts.length} linh kiện đặt chờ thành công!`,
          'success'
        );
      }
      setIsModalOpen(false);
    };

    const runSaveWithDateCheck = () => {
      triggerSaveWithDateCheck(
        {
          bookingDate: formData.bookingDate,
          requestedDate: finalRequestedDate,
          stockedInDate: finalStockedInDate,
          calledCustomerDate: finalCalledCustomerDate,
          customerArrivedDate: finalCustomerArrivedDate,
        },
        executeSaveForm
      );
    };

    const isCallHoldOrKeep = Boolean(formData.isCustomerCallHold || formData.customerKeepsPart);
    const isStep3Stocked =
      finalHasAvailableParts ||
      calculatedStatus === 'da_nhap_kho' ||
      Boolean(finalStockedInDate) ||
      (finalValidParts.length > 0 && finalValidParts.every((p) => p.isStockedIn));

    const checkStatusChangeThenSave = (statusToUse: ShortageStatus) => {
      calculatedStatus = statusToUse;
      if (editingItem && calculatedStatus !== editingItem.status) {
        setStatusConfirmModal({
          isOpen: true,
          title: 'Xác nhận cập nhật phiếu',
          ticketNumber: formData.ticketNumber,
          customerName: formData.customerName,
          fromStatus: editingItem.status,
          toStatus: calculatedStatus,
          message: `Trạng thái phiếu [${formData.ticketNumber}] sẽ bị thay đổi từ "${SHORTAGE_STATUS_CONFIG[editingItem.status]?.label}" sang "${SHORTAGE_STATUS_CONFIG[calculatedStatus]?.label}". Bạn có chắc chắn muốn lưu thay đổi này?`,
          confirmButtonText: 'Lưu & Cập nhật trạng thái',
          onConfirm: runSaveWithDateCheck,
        });
      } else {
        runSaveWithDateCheck();
      }
    };

    if (isCallHoldOrKeep && isStep3Stocked && calculatedStatus !== 'da_goi_kh' && calculatedStatus !== 'da_hoan_tat') {
      const typeTitle = formData.isCustomerCallHold ? 'Khách Gọi Đặt' : 'Đặt Giữ SVD';
      setStatusConfirmModal({
        isOpen: true,
        title: `Nhắc nhở: Chuyển sang Bước 4 cho ${typeTitle}`,
        ticketNumber: formData.ticketNumber,
        customerName: formData.customerName,
        fromStatus: calculatedStatus,
        toStatus: 'da_goi_kh',
        message: `Linh kiện của phiếu #${formData.ticketNumber} (${typeTitle}) đã có sẵn / về kho ở Bước 3. Theo quy trình, hệ thống khuyến nghị chuyển sang "Bước 4. Đã gọi KH (Chờ khách lên)" để dễ dàng theo dõi và lịch hẹn gọi khách đặt trước.`,
        confirmButtonText: 'Chuyển sang Bước 4 (Đã gọi KH)',
        secondaryButtonText: `Vẫn lưu ${SHORTAGE_STATUS_CONFIG[calculatedStatus]?.label || 'Bước hiện tại'}`,
        onConfirm: () => {
          setFormData((prev) => ({
            ...prev,
            status: 'da_goi_kh',
            stockedInDate: finalStockedInDate || timestampStr,
            calledCustomerDate: finalCalledCustomerDate || timestampStr,
          }));
          checkStatusChangeThenSave('da_goi_kh');
        },
        onSecondaryConfirm: () => {
          checkStatusChangeThenSave(calculatedStatus);
        },
      });
      return;
    }

    checkStatusChangeThenSave(calculatedStatus);
  };

  // Quick change status step & auto-update corresponding timestamps
  const handleAdvanceStatus = (item: ShortageBookingItem, targetStatus: ShortageStatus) => {
    if (item.status === targetStatus) {
      if (targetStatus === 'da_goi_kh') {
        handleOpenCallModal(item);
      }
      return;
    }

    if (targetStatus === 'da_hoan_tat') {
      handleOpenCompleteModal(item);
      return;
    }

    if (targetStatus === 'da_goi_kh') {
      handleOpenCallModal(item);
      return;
    }

    const executeAdvance = () => {
      const currentDateTime = getCurrentDateTimeString();
      const updatedList = bookings.map((b) => {
        if (b.id === item.id) {
          const newHistory = [...(b.history || []), { status: targetStatus, timestamp: currentDateTime }];
          let updatedStockedIn = b.stockedInDate;
          let updatedCalledCustomer = b.calledCustomerDate;

          if (targetStatus === 'da_nhap_kho' && !updatedStockedIn) {
            updatedStockedIn = currentDateTime;
          } else if ((targetStatus as string) === 'da_goi_kh') {
            if (!updatedStockedIn) updatedStockedIn = currentDateTime;
            if (!updatedCalledCustomer) updatedCalledCustomer = currentDateTime;
          }

          const finalPartsList = b.partsList && b.partsList.length > 0
            ? b.partsList.map((p) => {
                const q = Math.max(1, p.quantity || 1);
                if (targetStatus === 'da_tao_phieu') {
                  return { ...p, quantity: q, isRequested: false, requestedQuantity: 0, isStockedIn: false, stockedInQuantity: 0 };
                } else if (targetStatus === 'chua_xin_du_lk') {
                  const reqQ = typeof p.requestedQuantity === 'number' && p.requestedQuantity > 0 ? p.requestedQuantity : Math.max(1, Math.floor(q / 2));
                  return { ...p, quantity: q, isRequested: reqQ >= q, requestedQuantity: reqQ, isStockedIn: false, stockedInQuantity: 0 };
                } else if (targetStatus === 'da_xin_lk') {
                  return { ...p, quantity: q, isRequested: true, requestedQuantity: q, isStockedIn: false, stockedInQuantity: 0 };
                } else if (targetStatus === 'da_nhap_kho' || (targetStatus as string) === 'da_goi_kh' || (targetStatus as string) === 'da_hoan_tat') {
                  return { ...p, quantity: q, isRequested: true, requestedQuantity: q, isStockedIn: true, stockedInQuantity: q };
                }
                return p;
              })
            : b.partsList;

          return {
            ...b,
            partsList: finalPartsList,
            status: targetStatus,
            stockedInDate: updatedStockedIn,
            calledCustomerDate: updatedCalledCustomer,
            updatedAt: new Date().toISOString(),
            history: newHistory,
          };
        }
        return b;
      });
      onUpdateBookings(updatedList);
      onShowToast(`Đã xác nhận chuyển phiếu [${item.ticketNumber}] sang: "${SHORTAGE_STATUS_CONFIG[targetStatus]?.label}"`, 'success');
    };

    setStatusConfirmModal({
      isOpen: true,
      title: 'Xác nhận chuyển tiến độ phiếu',
      ticketNumber: item.ticketNumber,
      customerName: item.customerName,
      fromStatus: item.status,
      toStatus: targetStatus,
      message: `Bạn có chắc chắn muốn chuyển phiếu [${item.ticketNumber}] từ bước "${SHORTAGE_STATUS_CONFIG[item.status]?.label}" sang bước "${SHORTAGE_STATUS_CONFIG[targetStatus]?.label}" không?`,
      confirmButtonText: `Xác nhận chuyển sang: ${SHORTAGE_STATUS_CONFIG[targetStatus]?.label}`,
      onConfirm: executeAdvance,
    });
  };

  // Quick update timestamp on item
  const handleQuickStamp = (item: ShortageBookingItem, type: 'stock' | 'call' | 'arrived') => {
    const currentDateTime = getCurrentDateTimeString();
    if (type === 'call') {
      handleOpenCallModal(item);
      return;
    }
    if (type === 'arrived') {
      if (item.status !== 'da_hoan_tat') {
        setStatusConfirmModal({
          isOpen: true,
          title: 'Xác nhận Khách đã lên (Hoàn tất)',
          ticketNumber: item.ticketNumber,
          customerName: item.customerName,
          fromStatus: item.status,
          toStatus: 'da_hoan_tat',
          message: `Bạn có chắc chắn muốn chuyển phiếu [${item.ticketNumber}] sang bước "5. Khách đã lên" không?`,
          confirmButtonText: 'Chuyển sang Bước 5',
          onConfirm: () => handleOpenCompleteModal(item),
        });
      } else {
        handleOpenCompleteModal(item);
      }
      return;
    }

    const updatedList = bookings.map((b) => {
      if (b.id === item.id) {
        if (type === 'stock') {
          return { ...b, stockedInDate: currentDateTime, updatedAt: new Date().toISOString() };
        } else {
          return { ...b, calledCustomerDate: currentDateTime, updatedAt: new Date().toISOString() };
        }
      }
      return b;
    });
    onUpdateBookings(updatedList);
    onShowToast(
      type === 'stock'
        ? `Đã cập nhật giờ nhập kho: ${currentDateTime}`
        : `Đã cập nhật giờ gọi khách: ${currentDateTime}`,
      'success'
    );
  };

  const handleExtendStep2 = (item: ShortageBookingItem) => {
    const currentDateTime = getCurrentDateTimeString();
    const updatedList = bookings.map((b) => {
      if (b.id === item.id) {
        return {
          ...b,
          step2Extended: true,
          step2ExtendedAt: currentDateTime,
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });
    onUpdateBookings(updatedList);
    onShowToast(`Đã xác nhận tiếp tục chờ linh kiện cho phiếu [${item.ticketNumber}]. Cộng thêm 2 ngày chờ!`, 'success');
  };

  // Cancellation / Deletion Handlers
  const handleRequestDeleteOrCancel = (item: ShortageBookingItem) => {
    if (isAdmin) {
      setDeletingBookingConfirm(item);
    } else {
      setCancelRequestModalItem(item);
      setCancelReasonInput('');
    }
  };

  const handleSubmitCancelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelRequestModalItem) return;
    if (!cancelReasonInput.trim()) {
      onShowToast('Vui lòng nhập lý do yêu cầu hủy phiếu!', 'error');
      return;
    }

    setIsSubmittingCancel(true);
    try {
      const requesterName = currentUser?.name || currentUser?.username || 'Kỹ thuật viên';
      await requestShortageCancel(
        cancelRequestModalItem.id,
        cancelRequestModalItem.ticketNumber,
        cancelReasonInput.trim(),
        requesterName
      );

      const updated = bookings.map((b) =>
        b.id === cancelRequestModalItem.id
          ? {
              ...b,
              cancelRequested: true,
              cancelReason: cancelReasonInput.trim(),
              cancelRequestedBy: requesterName,
              cancelRequestedAt: new Date().toISOString(),
            }
          : b
      );
      onUpdateBookings(updated);
      onShowToast(`Đã gửi yêu cầu hủy phiếu [${cancelRequestModalItem.ticketNumber}] cho Quản trị viên duyệt!`, 'info');
      setCancelRequestModalItem(null);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi gửi yêu cầu hủy: ${err?.message || 'Thử lại sau'}`, 'error');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleAdminApproveCancelOrDelete = async (item: ShortageBookingItem) => {
    try {
      await deleteShortageFromCloud(item.id, item.ticketNumber, currentUser?.name || 'Admin');
      const updated = bookings.filter((b) => b.id !== item.id);
      onUpdateBookings(updated);
      onShowToast(`Đã xóa vĩnh viễn phiếu đặt chờ [${item.ticketNumber}]`, 'success');
      setDeletingBookingConfirm(null);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi xóa phiếu: ${err?.message || 'Thử lại sau'}`, 'error');
    }
  };

  const handleClearAllShortages = async () => {
    setIsClearingAll(true);
    try {
      await clearAllShortagesFromCloud(currentUser?.name || 'Admin');
      onUpdateBookings([]);
      setSelectedIds([]);
      onShowToast('Đã xóa trắng toàn bộ danh sách phiếu đặt chờ linh kiện!', 'success');
      setShowClearAllConfirmModal(false);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi xóa trắng danh sách: ${err?.message || 'Vui lòng thử lại'}`, 'error');
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleAdminRejectCancelRequest = async (item: ShortageBookingItem) => {
    try {
      await rejectShortageCancel(item.id, item.ticketNumber, currentUser?.name || 'Admin');
      const updated = bookings.map((b) =>
        b.id === item.id
          ? {
              ...b,
              cancelRequested: false,
              cancelReason: undefined,
              cancelRequestedBy: undefined,
              cancelRequestedAt: undefined,
            }
          : b
      );
      onUpdateBookings(updated);
      onShowToast(`Đã bác bỏ yêu cầu hủy phiếu [${item.ticketNumber}]`, 'info');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi bác bỏ yêu cầu: ${err?.message || 'Thử lại sau'}`, 'error');
    }
  };

  // Edit Request Handlers (Admin)
  const handleAdminApproveEditRequest = async (item: ShortageBookingItem) => {
    if (!item.pendingEditData) {
      onShowToast('Không tìm thấy dữ liệu chỉnh sửa đề xuất để phê duyệt', 'error');
      return;
    }
    try {
      await approveShortageEdit(item.id, item.ticketNumber, currentUser?.name || 'Admin');
      const nowStr = new Date().toISOString();
      const timestampStr = getCurrentDateTimeString();
      const pending = item.pendingEditData;

      const updated = bookings.map((b) => {
        if (b.id === item.id) {
          const newHistory = [
            ...(b.history || []),
            {
              status: pending.status || b.status,
              timestamp: timestampStr,
              note: `Admin phê duyệt chỉnh sửa thông tin phiếu (Lý do: ${item.editReason || 'Không ghi'} - Yêu cầu bởi: ${item.editRequestedBy || 'Nhân viên'})`,
            },
          ];
          return {
            ...b,
            ...pending,
            editRequested: false,
            editReason: undefined,
            editRequestedBy: undefined,
            editRequestedAt: undefined,
            pendingEditData: undefined,
            updatedAt: nowStr,
            history: newHistory,
          };
        }
        return b;
      });
      onUpdateBookings(updated);
      onShowToast(`Đã phê duyệt chỉnh sửa thành công cho phiếu [${item.ticketNumber}]`, 'success');
      setEditReviewModalItem(null);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi phê duyệt sửa phiếu: ${err?.message || 'Thử lại sau'}`, 'error');
    }
  };

  const handleAdminRejectEditRequest = async (item: ShortageBookingItem) => {
    try {
      await rejectShortageEdit(item.id, item.ticketNumber, currentUser?.name || 'Admin');
      const updated = bookings.map((b) =>
        b.id === item.id
          ? {
              ...b,
              editRequested: false,
              editReason: undefined,
              editRequestedBy: undefined,
              editRequestedAt: undefined,
              pendingEditData: undefined,
            }
          : b
      );
      onUpdateBookings(updated);
      onShowToast(`Đã bác bỏ yêu cầu chỉnh sửa phiếu [${item.ticketNumber}]`, 'info');
      setEditReviewModalItem(null);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi bác bỏ yêu cầu: ${err?.message || 'Thử lại sau'}`, 'error');
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    if (bookings.length === 0) {
      onShowToast('Không có dữ liệu phiếu đặt chờ để xuất Excel', 'error');
      return;
    }
    exportShortageToExcel(bookings);
    onShowToast(`Đã xuất ${bookings.length} phiếu đặt chờ ra file Excel`, 'success');
  };

  // Export 100% Full JSON Backup (Chuyển TK)
  const handleExportJsonBackup = () => {
    if (bookings.length === 0) {
      onShowToast('Không có dữ liệu phiếu đặt chờ để sao lưu JSON', 'error');
      return;
    }
    try {
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        type: 'SHORTAGE_BOOKINGS_BACKUP',
        totalItems: bookings.length,
        bookings: bookings, // Full 100% array of items with all sub-properties
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
      const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      link.href = url;
      link.setAttribute('download', `SaoLuu_DatChoLinhKien_Full_${dateStr}_${timeStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onShowToast(`Đã sao lưu nguyên vẹn 100% (${bookings.length} phiếu) ra file JSON!`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi sao lưu dữ liệu JSON: ${err?.message || 'Vui lòng thử lại'}`, 'error');
    }
  };

  // Import File (Excel or 100% Full JSON Backup)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fileNameLower = file.name.toLowerCase();
      if (fileNameLower.endsWith('.json') || file.type === 'application/json') {
        const text = await file.text();
        let parsedBackup: any;
        try {
          parsedBackup = parseBackupJson(text);
        } catch (parseErr: any) {
          onShowToast(parseErr?.message || 'File JSON không hợp lệ hoặc bị hỏng định dạng!', 'error');
          e.target.value = '';
          return;
        }

        onShowToast('Đang khôi phục siêu tốc 100% dữ liệu từ file JSON...', 'info');
        const restoreResult = await executeFastRestore({
          parsed: parsedBackup,
          mode: 'merge',
          authorName: currentUser?.name || 'Nhập Backup JSON',
        });

        if (restoreResult.success) {
          if (parsedBackup.shortages && parsedBackup.shortages.length > 0) {
            const combined = deduplicateShortages([...parsedBackup.shortages, ...bookings]);
            onUpdateBookings(combined);
          }
          onShowToast(
            `Phục hồi thành công 100%! Đã nạp ${restoreResult.counts.shortages} phiếu đặt chờ, ${restoreResult.counts.deviceIot} phiếu máy. Đã tự động đồng bộ Cloud Firestore & Cloud SQL!`,
            'success'
          );
        } else {
          onShowToast(`Lỗi khi khôi phục dữ liệu: ${restoreResult.message}`, 'error');
        }
        e.target.value = '';
        return;
      } else {
        const imported = await importShortageFromExcel(file);
        if (imported.length === 0) {
          onShowToast('Không tìm thấy dữ liệu hợp lệ trong file Excel', 'error');
          e.target.value = '';
          return;
        }
        const combined = deduplicateShortages([...imported, ...bookings]);
        onUpdateBookings(combined);

        try {
          await batchSyncShortagesToCloud(imported, currentUser?.name || 'Nhập Excel');
        } catch (syncErr) {
          console.warn('Batch sync Excel to cloud notice:', syncErr);
        }

        onShowToast(`Đã nhập thành công ${imported.length} phiếu đặt chờ từ Excel! Đã tự động đồng bộ Cloud.`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi đọc file: ${err?.message || 'Vui lòng kiểm tra định dạng!'}`, 'error');
    }
    e.target.value = '';
  };

  // Send to label studio
  const handleSendToLabelStudio = (item: ShortageBookingItem) => {
    const labelItem = shortageToLabelItem(item);
    onSendToLabelStudio(labelItem);
    onShowToast(`Đã thêm linh kiện "${item.partName}" vào danh sách in tem 3x2`, 'success');
  };

  // Aggregation of duplicate parts across all bookings
  const duplicatePartGroups = useMemo<DuplicatePartGroup[]>(() => {
    const map = new Map<string, {
      key: string;
      partCode: string;
      partName: string;
      model: string;
      totalQuantity: number;
      ticketCount: number;
      tickets: DuplicatePartTicketItem[];
      statusBreakdown: Record<string, number>;
      activeCount: number;
      completedCount: number;
      activeQuantity: number;
      completedQuantity: number;
      neededToRequestQty: number;
      requestedWaitingQty: number;
      stockedWaitingCustomerQty: number;
      activeTickets: DuplicatePartTicketItem[];
      hasCallHold: boolean;
      hasSvdKeep: boolean;
    }>();

    bookings.forEach((booking) => {
      // Gather all parts from this booking
      const parts: Array<{
        partCode: string;
        partName: string;
        model: string;
        quantity: number;
        isRequested?: boolean;
        isStockedIn?: boolean;
      }> = [];

      if (booking.partsList && booking.partsList.length > 0) {
        booking.partsList.forEach((p) => {
          const code = (p.partCode || booking.partCode || '').trim();
          const name = (p.partName || booking.partName || 'Linh kiện').trim();
          const model = (p.model || booking.model || '').trim();
          const qty = Number(p.quantity) >= 1 ? Number(p.quantity) : 1;
          parts.push({
            partCode: code,
            partName: name,
            model,
            quantity: qty,
            isRequested: p.isRequested,
            isStockedIn: p.isStockedIn,
          });
        });
      } else {
        const code = (booking.partCode || '').trim();
        const name = (booking.partName || 'Linh kiện').trim();
        const model = (booking.model || '').trim();
        parts.push({
          partCode: code,
          partName: name,
          model,
          quantity: 1,
          isRequested: booking.status !== 'da_tao_phieu' && booking.status !== 'chua_xin_du_lk',
          isStockedIn:
            booking.status === 'da_nhap_kho' ||
            booking.status === 'da_goi_kh' ||
            booking.status === 'da_hoan_tat',
        });
      }

      // Track unique keys within this booking to count ticketCount once per booking
      const ticketKeys = new Set<string>();

      parts.forEach((p) => {
        let key = '';
        if (p.partCode && p.partCode.length >= 2 && p.partCode.toUpperCase() !== 'N/A') {
          key = `CODE:${p.partCode.trim().toUpperCase()}`;
        } else {
          key = `NAME:${p.partName.trim().toLowerCase()}___${p.model.trim().toLowerCase()}`;
        }

        if (!map.has(key)) {
          map.set(key, {
            key,
            partCode: p.partCode || 'N/A',
            partName: p.partName || 'Linh kiện',
            model: p.model || booking.model || '',
            totalQuantity: 0,
            ticketCount: 0,
            tickets: [],
            statusBreakdown: {},
            activeCount: 0,
            completedCount: 0,
            activeQuantity: 0,
            completedQuantity: 0,
            neededToRequestQty: 0,
            requestedWaitingQty: 0,
            stockedWaitingCustomerQty: 0,
            activeTickets: [],
            hasCallHold: false,
            hasSvdKeep: false,
          });
        }

        const group = map.get(key)!;
        group.totalQuantity += p.quantity;

        const isCompleted = booking.status === 'da_hoan_tat';

        // Xác định chính xác trạng thái của linh kiện này:
        // 1. Linh kiện đã nhận / nhập kho:
        //    - Toàn bộ phiếu đã ở bước đã nhập kho (B3), đã gọi khách (B4)
        //    - HOẶC linh kiện này đã được bấm xác nhận "đã nhận hoặc đã nhập" (p.isStockedIn === true),
        //      kể cả khi phiếu còn treo ở bước 2a (chưa xin đủ LK), bước 1 hay bước 2!
        const isPartStocked =
          booking.status === 'da_nhap_kho' ||
          booking.status === 'da_goi_kh' ||
          Boolean(p.isStockedIn);

        // 2. Linh kiện đã được xin trên GCSM (đang chờ trung tâm cấp về kho):
        //    - Toàn bộ phiếu ở bước 2 (da_xin_lk)
        //    - HOẶC linh kiện này đã được tích chọn "Đã xin" (p.isRequested === true)
        const isPartRequested =
          booking.status === 'da_xin_lk' ||
          Boolean(p.isRequested);

        if (isCompleted) {
          group.completedQuantity += p.quantity;
        } else {
          group.activeQuantity += p.quantity;

          if (isPartStocked) {
            // Linh kiện đã nhận kho / về kho chờ khách -> KHÔNG cộng vào số lượng cần xin!
            group.stockedWaitingCustomerQty += p.quantity;
          } else if (isPartRequested) {
            // Linh kiện đã gửi xin đang đợi cấp -> KHÔNG cộng vào số lượng cần xin!
            group.requestedWaitingQty += p.quantity;
          } else if (booking.status === 'da_tao_phieu' || booking.status === 'chua_xin_du_lk') {
            // Chỉ cộng vào số lượng cần xin khi linh kiện này THỰC SỰ CHƯA XIN và CHƯA VỀ KHO
            group.neededToRequestQty += p.quantity;
          } else {
            // Dự phòng: các bước khác coi như đã xin
            group.requestedWaitingQty += p.quantity;
          }
        }

        if (booking.isCustomerCallHold) group.hasCallHold = true;
        if (booking.customerKeepsPart) group.hasSvdKeep = true;

        if (!ticketKeys.has(key)) {
          ticketKeys.add(key);
          group.ticketCount += 1;
          const ticketItem: DuplicatePartTicketItem = {
            ticket: booking,
            partQuantity: p.quantity,
            partModel: p.model,
            partCode: p.partCode,
            partName: p.partName,
            isPartStocked,
            isPartRequested,
          };
          group.tickets.push(ticketItem);

          const st = booking.status || 'da_tao_phieu';
          group.statusBreakdown[st] = (group.statusBreakdown[st] || 0) + 1;
          if (isCompleted) {
            group.completedCount += 1;
          } else {
            group.activeCount += 1;
            group.activeTickets.push(ticketItem);
          }
        }
      });
    });

    // Only keep groups where ticketCount >= 2 (có từ 2 khách/phiếu trở lên)
    const duplicates: DuplicatePartGroup[] = Array.from(map.values())
      .filter((g) => g.ticketCount >= 2)
      .map((g) => ({
        ...g,
        isPendingDuplicate: g.activeCount >= 2,
      }));

    // Sort by activeCount descending (ưu tiên các linh kiện có nhiều khách chưa lên thay nhất), then totalQuantity descending
    duplicates.sort((a, b) => {
      if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
      if (b.activeQuantity !== a.activeQuantity) return b.activeQuantity - a.activeQuantity;
      if (b.ticketCount !== a.ticketCount) return b.ticketCount - a.ticketCount;
      return b.totalQuantity - a.totalQuantity;
    });

    return duplicates;
  }, [bookings]);

  // Subset of duplicate groups that have at least 1 pending ticket (khách chưa lên thay)
  const pendingDuplicateGroups = useMemo(() => {
    return duplicatePartGroups.filter((g) => g.activeCount >= 1);
  }, [duplicatePartGroups]);

  // Lookup map: booking ID -> list of duplicate groups it belongs to
  const bookingDuplicateGroupsMap = useMemo(() => {
    const map: Record<string, DuplicatePartGroup[]> = {};
    duplicatePartGroups.forEach((group) => {
      group.tickets.forEach((t) => {
        if (!map[t.ticket.id]) {
          map[t.ticket.id] = [];
        }
        map[t.ticket.id].push(group);
      });
    });
    return map;
  }, [duplicatePartGroups]);

  // Helper function to match a single booking against search query
  const matchBookingSearch = useCallback(
    (item: ShortageBookingItem, term: string): boolean => {
      if (!term) return true;
      const termLower = term.toLowerCase();

      // 1. Prioritize strict ticket number match by stripping non-alphanumeric characters (extremely robust for GCSM ticket numbers with dashes/spaces/etc.)
      const cleanTermAlphanumeric = termLower.replace(/[^a-zA-Z0-9]/g, '');
      const cleanTicketNumberAlphanumeric = (item.ticketNumber || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
      if (cleanTermAlphanumeric.length >= 4) {
        if (cleanTicketNumberAlphanumeric.includes(cleanTermAlphanumeric) || cleanTermAlphanumeric.includes(cleanTicketNumberAlphanumeric)) {
          return true;
        }
      }

      const cleanBarcode = extractBarcodePartCode(term, activeCatalog).toLowerCase();
      const hasCleanBarcode = Boolean(cleanBarcode && cleanBarcode !== termLower);
      const partsInfo = (item.partsList || []).map((p: any) => `${p.partCode || ''} ${p.partName || ''} ${p.model || ''} ${p.note || ''}`).join(' ');

      const creatorText = item.createdBy
        ? `Người tạo: ${item.createdBy} Tạo bởi: ${item.createdBy} User tạo: ${item.createdBy}`
        : '';
      const creatorTechText = item.creatorTechnician
        ? `Kỹ thuật tạo: ${item.creatorTechnician} KTV tạo: ${item.creatorTechnician} KT tạo: ${item.creatorTechnician} Kỹ thuật viên tạo: ${item.creatorTechnician}`
        : '';
      const repairTechText = item.technicianName
        ? `Kỹ thuật sửa: ${item.technicianName} KTV sửa: ${item.technicianName} KT sửa: ${item.technicianName} Kỹ thuật viên sửa: ${item.technicianName} Kỹ thuật xử lý: ${item.technicianName} KTV xử lý: ${item.technicianName} KT xử lý: ${item.technicianName} Kỹ thuật viên xử lý: ${item.technicianName}`
        : '';
      const closureByText = item.closureBy
        ? `Người đóng: ${item.closureBy} Đóng bởi: ${item.closureBy} KTV đóng: ${item.closureBy}`
        : '';
      const callLogsText = (item.callLogs || []).map((c: any) => `${c.callerName || ''} ${c.note || ''}`).join(' ');

      const searchableFields = [
        item.ticketNumber,
        item.partCode,
        item.partName,
        item.model,
        item.customerName,
        item.customerPhone,
        item.note,
        item.stockedInDate,
        item.calledCustomerDate,
        item.customerArrivedDate,
        item.technicianName,     // Kỹ thuật viên sửa / KTV xử lý
        repairTechText,          // Chuỗi bối cảnh: "Kỹ thuật sửa...", "KTV sửa..."
        item.creatorTechnician,  // Kỹ thuật viên tạo phiếu
        creatorTechText,         // Chuỗi bối cảnh: "Kỹ thuật tạo...", "KTV tạo..."
        item.createdBy,          // Tên người tạo phiếu (User / CS / Admin)
        creatorText,             // Chuỗi bối cảnh: "Người tạo...", "Tạo bởi..."
        item.closureReason,
        item.closureNote,
        item.closureBy,
        closureByText,
        item.location,
        partsInfo,
        callLogsText,
      ];

      const baseMatch =
        matchesSmartSearch(term, searchableFields) ||
        (hasCleanBarcode && matchesSmartSearch(cleanBarcode, searchableFields));

      if (baseMatch) return true;

      // Check quick keywords or specific system statuses
      const specialMatch =
        ((termLower === 'quá 7 ngày' ||
          termLower === 'qua 7 ngay' ||
          termLower === 'quá hạn' ||
          termLower === 'qua han' ||
          termLower === 'overdue' ||
          termLower === '7 ngày' ||
          termLower === '7 ngay') &&
          checkOverdue7Days(item).isOverdue) ||
        (termLower === 'cảnh báo bước 1' && checkStep1AgingWarning(item).hasWarning) ||
        ((termLower === 'cảnh báo bước 2' || termLower === 'cảnh báo bước 2 (lần 2)' || termLower === 'cảnh báo bước 2 lần 2') && checkStep2AgingWarning(item).hasWarning) ||
        (termLower === 'cảnh báo bước 3' && checkStep3AgingWarning(item).hasWarning) ||
        ((termLower === 'đóng phiếu' ||
          termLower === 'dong phieu' ||
          termLower === 'khách không lên' ||
          termLower === 'khach khong len' ||
          termLower === 'từ chối' ||
          termLower === 'tu choi' ||
          termLower === 'không thay' ||
          termLower === 'khong thay') &&
          Boolean(item.isCompletedWithoutRepair)) ||
        ((termLower === 'bỏ mẫu' || termLower === 'bo mau') && item.status === 'da_bo_mau') ||
        ((termLower === 'chưa chọn kt tạo' ||
          termLower === 'chua chon kt tao' ||
          termLower === 'chưa có kt tạo' ||
          termLower === 'chua co kt tao' ||
          termLower === 'chưa có ktv tạo' ||
          termLower === 'chua co ktv tao') &&
          !item.creatorTechnician?.trim()) ||
        ((termLower === 'đã chọn kt tạo' ||
          termLower === 'da chon kt tao' ||
          termLower === 'đã có kt tạo' ||
          termLower === 'da co kt tao' ||
          termLower === 'đã có ktv tạo' ||
          termLower === 'da co ktv tao') &&
          Boolean(item.creatorTechnician?.trim())) ||
        ((termLower === 'chưa chọn kt sửa' ||
          termLower === 'chua chon kt sua' ||
          termLower === 'chưa có kt sửa' ||
          termLower === 'chua co kt sua' ||
          termLower === 'chưa có ktv sửa' ||
          termLower === 'chua co ktv sua' ||
          termLower === 'chưa phân công ktv' ||
          termLower === 'chua phan cong ktv' ||
          termLower === 'chưa phân công' ||
          termLower === 'chua phan cong') &&
          !item.technicianName?.trim()) ||
        ((termLower === 'đã chọn kt sửa' ||
          termLower === 'da chon kt sua' ||
          termLower === 'đã có kt sửa' ||
          termLower === 'da co kt sua' ||
          termLower === 'đã có ktv sửa' ||
          termLower === 'da co ktv sua') &&
          Boolean(item.technicianName?.trim())) ||
        (item.customerKeepsPart && (
          matchesSmartSearch(term, ['svd', 'ngày dịch vụ', 'đặt svd', 'đặt giữ svd', 'khách đặt svd', 'khách giữ', 'giữ lk', 'giữ linh kiện', 'keeps part']) ||
          ((termLower === 'svd 3 ngày' || termLower === 'svd 3 ngay' || termLower === 'svd quá 3 ngày' || termLower === 'svd qua 3 ngay') &&
            checkSvdPending3Days(item).isSvdPending3Days)
        )) ||
        (item.isCustomerCallHold &&
          matchesSmartSearch(term, ['khách gọi', 'gọi đặt', 'đặt giữ', 'đặt trước', 'giữ trước', 'call hold', 'gọi giữ']));

      return Boolean(specialMatch);
    },
    [activeCatalog]
  );

  // Global matches count across all bookings in database for active search term
  const globalSearchMatchesCount = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return 0;
    return bookings.filter((item) => matchBookingSearch(item, term)).length;
  }, [bookings, searchTerm, matchBookingSearch]);

  // Filtered & Searched Bookings
  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim();

    return bookings.filter((item) => {
      // 1. Search match evaluation
      if (term && !matchBookingSearch(item, term)) {
        return false;
      }

      // 2. If user chose to search across entire system (searchScope === 'all'), bypass local status/date/duplicate filters
      if (term && searchScope === 'all') {
        return true;
      }

      // 3. Duplicate parts filter check
      if (selectedDuplicatePartKey) {
        const itemGroups = bookingDuplicateGroupsMap[item.id] || [];
        const hasSelectedKey = itemGroups.some((g) => g.key === selectedDuplicatePartKey);
        if (!hasSelectedKey) return false;
        if (duplicateFilterScope === 'pending_only' && item.status === 'da_hoan_tat') {
          return false;
        }
      } else if (showDuplicateFilterOnly) {
        const itemGroups = bookingDuplicateGroupsMap[item.id] || [];
        if (itemGroups.length === 0) return false;
        if (duplicateFilterScope === 'pending_only') {
          if (item.status === 'da_hoan_tat') return false;
          const hasActiveGroup = itemGroups.some((g) => g.activeCount >= 1);
          if (!hasActiveGroup) return false;
        }
      }

      // 4. Status & Cancel / Edit Request Filter
      if (statusFilter === 'cancel_requested') {
        if (!Boolean(item.cancelRequested)) return false;
      } else if (statusFilter === 'edit_requested') {
        if (!Boolean(item.editRequested)) return false;
      } else {
        const isDuplicateFilteringActive = Boolean(selectedDuplicatePartKey || showDuplicateFilterOnly);
        const matchStatus =
          isDuplicateFilteringActive ||
          statusFilter === 'all' ||
          item.status === statusFilter;
        if (!matchStatus) return false;
      }

      // 5. Date Filter (Lọc theo từng tháng hoặc chọn khoảng ngày: từ ngày - đến ngày)
      if (dateFilter.mode !== 'all') {
        const ts = getTicketCreationTimestamp(item);
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
  }, [
    bookings,
    searchTerm,
    searchScope,
    statusFilter,
    dateFilter,
    selectedDuplicatePartKey,
    showDuplicateFilterOnly,
    duplicateFilterScope,
    bookingDuplicateGroupsMap,
    matchBookingSearch,
  ]);

  // Check if an active filter is applied (status or date or duplicate)
  const isFilterScopeActive = useMemo(() => {
    return (
      statusFilter !== 'all' ||
      dateFilter.mode !== 'all' ||
      Boolean(selectedDuplicatePartKey) ||
      showDuplicateFilterOnly
    );
  }, [statusFilter, dateFilter.mode, selectedDuplicatePartKey, showDuplicateFilterOnly]);

  // Paginated items for the current page
  const totalShortagePages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const safeShortageCurrentPage = Math.min(Math.max(1, currentPage), totalShortagePages);
  const paginatedBookings = useMemo(() => {
    const start = (safeShortageCurrentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, safeShortageCurrentPage, pageSize]);

  // STT tính theo thời gian tạo: tạo trước là 1 và tăng dần (2, 3, ...)
  // Số thứ tự này cố định và không bị ảnh hưởng bởi các tab menu hay bộ lọc
  const ticketSttMap = useMemo(() => {
    return buildTicketSttMap(bookings);
  }, [bookings]);

  // STT riêng cho từng bước (1. Đã tạo phiếu, 2a. Chưa xin đủ LK, 2. Đã xin LK, 3a. Nhập kho chưa đủ LK, 3. Đã nhập kho, 4. Đã gọi KH, 5. Khách lên)
  // Quy tắc nghiệp vụ nhất quán: Phiếu tạo trước (sớm nhất về thời gian) sẽ là 1, tiếp theo là 2, 3... N
  const stepSttMapByStatus = useMemo(() => {
    const resultMap = new Map<string, Map<string, number>>();
    const stepKeys = ['da_tao_phieu', 'chua_xin_du_lk', 'da_xin_lk', 'nhap_kho_chua_du_lk', 'da_nhap_kho', 'da_goi_kh', 'da_hoan_tat', 'da_bo_mau'];
    stepKeys.forEach((statusKey) => {
      const stepItems = bookings.filter((b) => b.status === statusKey);
      resultMap.set(statusKey, buildTicketSttMap(stepItems));
    });
    return resultMap;
  }, [bookings]);

  // STT áp dụng khi lọc theo từng bước cụ thể (không làm ảnh hưởng STT gốc tab tổng)
  const currentFilteredSttMap = useMemo(() => {
    const hasSearchOrDup = Boolean(searchTerm.trim() || selectedDuplicatePartKey || showDuplicateFilterOnly);
    if (statusFilter === 'all' && !hasSearchOrDup) return null;
    if (statusFilter !== 'all' && !hasSearchOrDup && stepSttMapByStatus.has(statusFilter)) {
      return stepSttMapByStatus.get(statusFilter)!;
    }
    return buildTicketSttMap(filteredBookings);
  }, [statusFilter, stepSttMapByStatus, filteredBookings, searchTerm, selectedDuplicatePartKey, showDuplicateFilterOnly]);

  // Grouping helper for ticket numbers with multiple components
  const ticketGroupMap = useMemo(() => {
    const map: Record<string, ShortageBookingItem[]> = {};
    bookings.forEach((b) => {
      const key = b.ticketNumber.trim().toUpperCase();
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [bookings]);

  // Overdue 7 days tickets list
  const overdue7DaysTickets = useMemo(() => {
    return bookings.filter((b) => checkOverdue7Days(b).isOverdue);
  }, [bookings]);

  // SVD pending & multi-day appointment reminder tickets list
  const svdPending3DaysTickets = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.status !== 'da_hoan_tat' &&
        b.status !== 'da_bo_mau' &&
        (checkSvdPending3Days(b).isSvdPending3Days || checkSvdMultiDayAppointmentProgress(b).hasReminder)
    );
  }, [bookings]);

  // Step 1 aging warnings tickets list (> 2 days)
  const step1AgingTickets = useMemo(() => {
    return bookings.filter((b) => checkStep1AgingWarning(b).hasWarning);
  }, [bookings]);

  // Step 2 aging warnings tickets list (> 3 days / > 5 days)
  const step2AgingTickets = useMemo(() => {
    return bookings.filter((b) => checkStep2AgingWarning(b).hasWarning);
  }, [bookings]);

  // Step 3 aging warnings tickets list (> 2 days)
  const step3AgingTickets = useMemo(() => {
    return bookings.filter((b) => checkStep3AgingWarning(b).hasWarning);
  }, [bookings]);

  // Statistics
  const stats = useMemo(() => {
    const total = bookings.length;
    const daTaoPhieu = bookings.filter((b) => b.status === 'da_tao_phieu').length;
    const chuaXinDuLk = bookings.filter((b) => b.status === 'chua_xin_du_lk').length;
    const daXinLk = bookings.filter((b) => b.status === 'da_xin_lk').length;
    const nhapKhoChuaDuLk = bookings.filter((b) => b.status === 'nhap_kho_chua_du_lk').length;
    const daNhapKho = bookings.filter((b) => b.status === 'da_nhap_kho').length;
    const daGoiKh = bookings.filter((b) => b.status === 'da_goi_kh').length;
    const daHoanTat = bookings.filter((b) => b.status === 'da_hoan_tat').length;
    const daBoMau = bookings.filter((b) => b.status === 'da_bo_mau').length;
    const qua7Ngay = bookings.filter((b) => checkOverdue7Days(b).isOverdue).length;
    const daDongPhieuKhongThay = bookings.filter((b) => b.status === 'da_hoan_tat' && b.isCompletedWithoutRepair).length;
    const cancelRequestsCount = bookings.filter((b) => Boolean(b.cancelRequested)).length;
    const editRequestsCount = bookings.filter((b) => Boolean(b.editRequested)).length;

    // Active (Chưa lên máy) vs Completed (Đã lên máy hoàn tất Bước 5 hoặc Bước 6 Bỏ mẫu)
    const activeCallHolds = bookings.filter((b) => b.isCustomerCallHold && b.status !== 'da_hoan_tat' && b.status !== 'da_bo_mau').length;
    const activeSvdKeeps = bookings.filter((b) => b.customerKeepsPart && b.status !== 'da_hoan_tat' && b.status !== 'da_bo_mau').length;
    const completedCallHolds = bookings.filter((b) => b.isCustomerCallHold && (b.status === 'da_hoan_tat' || b.status === 'da_bo_mau')).length;
    const completedSvdKeeps = bookings.filter((b) => b.customerKeepsPart && (b.status === 'da_hoan_tat' || b.status === 'da_bo_mau')).length;

    return {
      total,
      daTaoPhieu,
      chuaXinDuLk,
      daXinLk,
      nhapKhoChuaDuLk,
      daNhapKho,
      daGoiKh,
      daHoanTat,
      daBoMau,
      qua7Ngay,
      daDongPhieuKhongThay,
      cancelRequestsCount,
      editRequestsCount,
      activeCallHolds,
      activeSvdKeeps,
      completedCallHolds,
      completedSvdKeeps,
    };
  }, [bookings]);

  const cancelRequestedTickets = useMemo(() => {
    return bookings.filter((b) => Boolean(b.cancelRequested));
  }, [bookings]);

  const editRequestedTickets = useMemo(() => {
    return bookings.filter((b) => Boolean(b.editRequested));
  }, [bookings]);

  const totalWarningsCount = useMemo(() => {
    return getActiveShortageWarningTickets(bookings, isAdmin).length;
  }, [bookings, isAdmin]);

  const [warningSearchTerm, setWarningSearchTerm] = useState('');

  const activeWarningTickets = useMemo(() => {
    let list: ShortageBookingItem[] = [];
    if (warningBranch === 'overdue_7') list = overdue7DaysTickets;
    else if (warningBranch === 'step1') list = step1AgingTickets;
    else if (warningBranch === 'step2') list = step2AgingTickets;
    else if (warningBranch === 'step3') list = step3AgingTickets;
    else if (warningBranch === 'svd') list = svdPending3DaysTickets;
    else if (warningBranch === 'cancel') list = bookings.filter((b) => Boolean(b.cancelRequested));
    else if (warningBranch === 'edit') list = bookings.filter((b) => Boolean(b.editRequested));
    else {
      list = getActiveShortageWarningTickets(bookings, isAdmin);
    }

    if (warningSearchTerm.trim()) {
      const q = warningSearchTerm.toLowerCase();
      list = list.filter((b) => {
        const parts = getBookingParts(b);
        return (
          b.ticketNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.customerPhone?.toLowerCase().includes(q) ||
          b.model?.toLowerCase().includes(q) ||
          b.technicianName?.toLowerCase().includes(q) ||
          parts.some((p) => p.partCode?.toLowerCase().includes(q) || p.partName?.toLowerCase().includes(q))
        );
      });
    }

    // Hiển thị bảng theo thứ tự mới nhất ở trên, cũ nhất ở dưới (đồng bộ toàn bộ hệ thống)
    // Số STT sẽ đánh ngược: phiếu tạo trước là 1, tiếp theo là 2, 3... N
    return [...list].sort((a, b) => {
      const tA = getTicketCreationTimestamp(a);
      const tB = getTicketCreationTimestamp(b);
      if (tA !== tB) return tB - tA;
      return (b.ticketNumber || '').localeCompare(a.ticketNumber || '');
    });
  }, [
    warningBranch,
    warningSearchTerm,
    overdue7DaysTickets,
    step1AgingTickets,
    step2AgingTickets,
    step3AgingTickets,
    svdPending3DaysTickets,
    bookings,
  ]);

  // Reset warning page when branch, search term, or page size changes
  useEffect(() => {
    setWarningPage(1);
  }, [warningBranch, warningSearchTerm, warningPageSize]);

  // STT riêng cho Tab Cảnh báo: Sắp theo thời gian tạo (tạo trước là 1, tăng dần 2, 3, 4... N)
  const warningSttMap = useMemo(() => {
    return buildTicketSttMap(activeWarningTickets);
  }, [activeWarningTickets]);

  const totalWarningPages = Math.max(1, Math.ceil(activeWarningTickets.length / warningPageSize));
  const safeWarningPage = Math.min(Math.max(1, warningPage), totalWarningPages);

  const paginatedWarningTickets = useMemo(() => {
    if (warningPageSize >= 9999) return activeWarningTickets;
    const start = (safeWarningPage - 1) * warningPageSize;
    return activeWarningTickets.slice(start, start + warningPageSize);
  }, [activeWarningTickets, safeWarningPage, warningPageSize]);

  return (
    <div className="w-full space-y-4">
      {/* VIEW: Tra cứu & Check trùng linh kiện (Tách biệt hoàn toàn) */}
      {activeSubId === 'shortage-check-dup' && (
        <DuplicatePartsModal
          isOpen={true}
          isEmbedded={true}
          duplicateGroups={duplicatePartGroups}
          allBookingsCount={bookings.length}
          selectedDuplicatePartKey={selectedDuplicatePartKey}
          onSelectDuplicatePartKey={(key) => {
            setSelectedDuplicatePartKey(key);
            setSearchTerm('');
            setStatusFilter('all');
            setShowDuplicateFilterOnly(false);
            setDuplicateFilterScope('pending_only');
          }}
          onSendToLabelStudio={onSendToLabelStudio}
          onShowToast={onShowToast}
          onOpenEditModal={handleOpenEditModal}
          onClose={() => onSelectSubId?.('shortage-main')}
        />
      )}

      {/* VIEW: Quản lý Gọi đặt trước & Giữ SVD (Tách biệt hoàn toàn) */}
      {activeSubId === 'shortage-holds' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-4">
          <CustomerHoldsTab
            shortageBookings={bookings}
            onNavigateToShortage={(ticket) => {
              handleNavigateToMainTable(ticket);
            }}
            onOpenConvertToSvd={(item) => {
              handleOpenEditModal(item);
            }}
          />
        </div>
      )}

      {/* VIEW: Cảnh báo & Nhắc nhở quy trình (Tách biệt hoàn toàn - KPI Icon Cards như Hình 2) */}
      {activeSubId === 'shortage-warnings' && (
        <div className="space-y-4">
          {/* KPI Branch Cards (Thống kê dạng thẻ icon trực quan như hình 2) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                id: 'all',
                title: 'Tất cả cảnh báo',
                count: totalWarningsCount,
                subtext: 'Tổng linh kiện (Xem tất cả)',
                icon: AlertTriangle,
                activeStyle: 'bg-orange-50/90 border-2 border-orange-500 ring-2 ring-orange-400/30 text-orange-950 shadow-xs font-bold scale-[1.02]',
                inactiveStyle: 'bg-white border border-stone-200 hover:border-orange-300 text-stone-700',
                iconColor: 'text-orange-600',
                numberColor: 'text-orange-900',
              },
              {
                id: 'overdue_7',
                title: 'Quá hạn 7 ngày',
                count: overdue7DaysTickets.length,
                subtext: '🚨 Báo LK >7 ngày chưa lên',
                icon: Clock,
                activeStyle: 'bg-rose-50/90 border-2 border-rose-500 ring-2 ring-rose-400/30 text-rose-950 shadow-xs font-bold scale-[1.02]',
                inactiveStyle: 'bg-white border border-stone-200 hover:border-rose-300 text-stone-700',
                iconColor: 'text-rose-600',
                numberColor: 'text-rose-900',
              },
              {
                id: 'step1',
                title: '1. Quá 2 ngày chưa xin',
                count: step1AgingTickets.length,
                subtext: '⚠️ Tạo >2 ngày chưa gửi',
                icon: AlertCircle,
                activeStyle: 'bg-amber-50/90 border-2 border-amber-500 ring-2 ring-amber-400/30 text-amber-950 shadow-xs font-bold scale-[1.02]',
                inactiveStyle: 'bg-white border border-stone-200 hover:border-amber-300 text-stone-700',
                iconColor: 'text-amber-600',
                numberColor: 'text-amber-900',
              },
              {
                id: 'step2',
                title: '2. Quá hạn chưa về',
                count: step2AgingTickets.length,
                subtext: '📦 Đã xin quá hạn chưa về',
                icon: Package,
                activeStyle: 'bg-blue-50/90 border-2 border-blue-500 ring-2 ring-blue-400/30 text-blue-950 shadow-xs font-bold scale-[1.02]',
                inactiveStyle: 'bg-white border border-stone-200 hover:border-blue-300 text-stone-700',
                iconColor: 'text-blue-600',
                numberColor: 'text-blue-900',
              },
              {
                id: 'step3',
                title: '3. Về kho >2 ngày',
                count: step3AgingTickets.length,
                subtext: '📞 Về kho >2 ngày chưa gọi',
                icon: PhoneCall,
                activeStyle: 'bg-purple-50/90 border-2 border-purple-500 ring-2 ring-purple-400/30 text-purple-950 shadow-xs font-bold scale-[1.02]',
                inactiveStyle: 'bg-white border border-stone-200 hover:border-purple-300 text-stone-700',
                iconColor: 'text-purple-600',
                numberColor: 'text-purple-900',
              },
              {
                id: 'svd',
                title: 'SVD: Đặt giữ & Nhắc hẹn (10-12)',
                count: svdPending3DaysTickets.length,
                subtext: '✨ Đặt giữ >1 ngày & Nhắc hẹn SVD',
                icon: Sparkles,
                activeStyle: 'bg-purple-50/90 border-2 border-purple-500 ring-2 ring-purple-400/30 text-purple-950 shadow-xs font-bold scale-[1.02]',
                inactiveStyle: 'bg-white border border-stone-200 hover:border-purple-300 text-stone-700',
                iconColor: 'text-purple-600',
                numberColor: 'text-purple-900',
              },
              ...(stats.cancelRequestsCount > 0 ? [{
                id: 'cancel',
                title: 'Yêu cầu hủy từ NV',
                count: stats.cancelRequestsCount,
                subtext: '🛑 Kỹ thuật xin hủy phiếu',
                icon: XCircle,
                activeStyle: 'bg-rose-50/90 border-2 border-rose-500 ring-2 ring-rose-400/30 text-rose-950 shadow-xs font-bold scale-[1.02]',
                inactiveStyle: 'bg-white border border-stone-200 hover:border-rose-300 text-stone-700',
                iconColor: 'text-rose-600',
                numberColor: 'text-rose-900',
              }] : []),
              ...(stats.editRequestsCount > 0 ? [{
                id: 'edit',
                title: 'Yêu cầu sửa từ NV',
                count: stats.editRequestsCount,
                subtext: '📝 Kỹ thuật xin điều chỉnh',
                icon: Edit3,
                activeStyle: 'bg-sky-50/90 border-2 border-sky-500 ring-2 ring-sky-400/30 text-sky-950 shadow-xs font-bold scale-[1.02]',
                inactiveStyle: 'bg-white border border-stone-200 hover:border-sky-300 text-stone-700',
                iconColor: 'text-sky-600',
                numberColor: 'text-sky-900',
              }] : []),
            ].map((card) => {
              const isSelected = warningBranch === card.id;
              const IconComp = card.icon;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setWarningBranch(card.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    isSelected ? card.activeStyle : card.inactiveStyle
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold line-clamp-1">{card.title}</span>
                    <IconComp className={`w-4 h-4 shrink-0 ${card.iconColor}`} />
                  </div>
                  <div className={`text-2xl font-black mt-1 ${card.numberColor}`}>
                    {card.count}
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5 font-semibold line-clamp-1">
                    {card.subtext}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">

            {/* Active Branch Guidance & Actions */}
            <div className="p-4 bg-stone-50/40 space-y-3">
              {warningBranch === 'overdue_7' && (
                <div className="p-3.5 rounded-lg bg-white border border-stone-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-200 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-stone-900">
                          Nhắc nhở: Có {overdue7DaysTickets.length} phiếu đã gọi báo linh kiện về quá 7 ngày khách chưa lên thay
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Quá hạn 7 ngày
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-0.5">
                        Khách không lên thay hoặc không liên lạc được sau 7 ngày. Nhân viên có thể bấm đóng hoàn tất từng phiếu hoặc đóng hàng loạt để giải phóng linh kiện.
                      </p>
                    </div>
                  </div>
                  {overdue7DaysTickets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBulkCloseOverdueModal(true)}
                      className="px-3.5 py-1.5 bg-[#059669] hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Đóng tất cả {overdue7DaysTickets.length} phiếu quá 7 ngày</span>
                    </button>
                  )}
                </div>
              )}

              {warningBranch === 'step1' && (
                <div className="p-3.5 rounded-lg bg-white border border-stone-200 shadow-2xs flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900">
                      Cảnh báo Bước 1: Có {step1AgingTickets.length} phiếu đã tạo quá 2 ngày chưa chuyển sang Bước 2
                    </span>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Phiếu đã lưu vào hệ thống nhưng quá 2 ngày chưa gửi yêu cầu xin linh kiện lên hệ thống GCSM.
                    </p>
                  </div>
                </div>
              )}

              {warningBranch === 'step2' && (
                <div className="p-3.5 rounded-lg bg-white border border-stone-200 shadow-2xs flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900">
                      Cảnh báo Bước 2: Có {step2AgingTickets.length} phiếu đã xin linh kiện quá hạn chưa nhập kho
                    </span>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Linh kiện đã xin quá 3 ngày (hoặc quá 5 ngày nếu đã gia hạn) nhưng chưa chuyển sang bước 3 nhập kho.
                    </p>
                  </div>
                </div>
              )}

              {warningBranch === 'step3' && (
                <div className="p-3.5 rounded-lg bg-white border border-stone-200 shadow-2xs flex items-center gap-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg border border-purple-200 shrink-0">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900">
                      Cảnh báo Bước 3: Có {step3AgingTickets.length} phiếu linh kiện nhập kho quá 2 ngày chưa gọi khách
                    </span>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Linh kiện đã về kho trên 2 ngày nhưng nhân viên chưa gọi điện thông báo cho khách hàng mang máy lên thay.
                    </p>
                  </div>
                </div>
              )}

              {warningBranch === 'svd' && (
                <div className="p-3.5 rounded-lg bg-purple-50/80 border border-purple-200 shadow-2xs flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-lg border border-purple-300 shrink-0">
                    <Sparkles className="w-4 h-4 text-purple-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-purple-950">
                      Cảnh báo & Nhắc nhở SVD: Có {svdPending3DaysTickets.length} phiếu đặt giữ SVD cần xử lý
                    </span>
                    <p className="text-[11px] text-purple-800 mt-0.5 font-medium">
                      Bao gồm phiếu đặt giữ SVD ở Bước 1 &gt; 1 ngày chưa xin LK, và chuỗi nhắc nhở khách hẹn Ngày Dịch Vụ SVD (ngày 10, 11, 12, đóng phiếu khi kết thúc ngày 12 để tránh treo phiếu).
                    </p>
                  </div>
                </div>
              )}

              {warningBranch === 'cancel' && stats.cancelRequestsCount > 0 && (
                <div className="p-3.5 rounded-lg bg-white border border-stone-200 shadow-2xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-200 shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900">
                        Có {stats.cancelRequestsCount} phiếu yêu cầu hủy từ nhân viên đang chờ duyệt
                      </span>
                      <p className="text-[11px] text-stone-600 mt-0.5">
                        Nhân viên gửi yêu cầu hủy phiếu. Quản trị viên duyệt xóa hoặc hủy yêu cầu trực tiếp bên dưới.
                      </p>
                    </div>
                  </div>
                  {isAdmin && onOpenAdminModal && (
                    <button
                      type="button"
                      onClick={onOpenAdminModal}
                      className="px-3.5 py-1.5 bg-[#059669] hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      Mở Quản Trị Duyệt Hủy
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Warning Tickets Table List */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                  Danh Sách Phiếu Cảnh Báo ({activeWarningTickets.length})
                </h4>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm phiếu cảnh báo..."
                  value={warningSearchTerm}
                  onChange={(e) => setWarningSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>

            {activeWarningTickets.length === 0 ? (
              <div className="p-12 text-center text-stone-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-stone-800 text-sm">Không có phiếu cảnh báo nào trong mục này</p>
                <p className="text-xs text-stone-500 mt-1">Tất cả quy trình đang được xử lý đúng tiến độ.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-700 border-b border-stone-200 font-bold">
                      <th className="py-2.5 px-3 w-12 text-center">STT</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Số Phiếu</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Khách Hàng & SĐT</th>
                      <th className="py-2.5 px-3 min-w-[130px]">Thiết Bị & Model</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Linh Kiện Cần Đặt</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Tiến Độ & Trạng Thái</th>
                      <th className="py-2.5 px-3 min-w-[100px]">Vị Trí Kệ/Tủ</th>
                      <th className="py-2.5 px-3 min-w-[140px] text-right">Xử Lý Bước Kế Tiếp</th>
                      <th className="py-2.5 px-3 text-center min-w-[130px]">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/70">
                    {paginatedWarningTickets.map((item, idx) => {
                      const ov7 = checkOverdue7Days(item);
                      const s1Warn = checkStep1AgingWarning(item);
                      const s2Warn = checkStep2AgingWarning(item);
                      const s3Warn = checkStep3AgingWarning(item);
                      const svdWarn = checkSvdPending3Days(item);
                      const svdMultiProgress = checkSvdMultiDayAppointmentProgress(item);
                      const statusConfig = SHORTAGE_STATUS_CONFIG[item.status] || SHORTAGE_STATUS_CONFIG.da_tao_phieu;
                      const bookingParts = getBookingParts(item);
                      const isCancelReq = Boolean(item.cancelRequested);

                      return (
                        <tr
                          key={item.id}
                          className="transition-colors border-b border-stone-200/70 bg-white hover:bg-stone-50/80"
                        >
                          {/* 1. STT: Thứ tự trong tab cảnh báo + #Số trên Bảng chính */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span className="font-mono font-black text-stone-900 text-xs">
                                {warningSttMap.get(item.id) ?? (idx + 1)}
                              </span>
                              {ticketSttMap.get(item.id) && (
                                <button
                                  type="button"
                                  onClick={() => handleNavigateToMainTable(item.ticketNumber)}
                                  className="font-mono text-[10px] text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-1 py-0.2 rounded border border-emerald-200 mt-0.5 cursor-pointer transition-colors"
                                  title={`Bấm để chuyển tới Bảng chính (STT #${ticketSttMap.get(item.id)})`}
                                >
                                  #{ticketSttMap.get(item.id)}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 2. Số Phiếu */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-black text-stone-900 text-xs">
                                {item.ticketNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.ticketNumber, `ticket-warn-${item.id}`, 'Đã chép số phiếu')}
                                className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors cursor-pointer"
                                title="Sao chép số phiếu"
                              >
                                {copiedId === `ticket-warn-${item.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              {ticketGroupMap[item.ticketNumber?.trim().toUpperCase()]?.length > 1 && (
                                <span
                                  className="text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shrink-0"
                                  title="Khách này yêu cầu nhiều linh kiện khác nhau"
                                >
                                  <Layers className="w-2.5 h-2.5 text-amber-700" />
                                  <span>{ticketGroupMap[item.ticketNumber?.trim().toUpperCase()].length} LK</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-2.5 h-2.5 text-stone-400" />
                              <span>{getBookingDateWithTime(item)}</span>
                            </div>
                            <div
                              className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5"
                              title={`Tạo bởi: ${item.createdBy || 'Hệ thống'} • KT Tạo: ${item.creatorTechnician || 'Chưa chọn'}`}
                            >
                              <UserCircle className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {item.createdBy || 'Hệ thống'}{item.creatorTechnician ? ` • ${item.creatorTechnician}` : ''}
                              </span>
                            </div>
                          </td>

                          {/* 3. Khách Hàng & SĐT */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-stone-900 flex items-center gap-1">
                              <User className="w-3 h-3 text-stone-400 shrink-0" />
                              <span className="truncate max-w-[130px]">{item.customerName || 'Khách lẻ'}</span>
                            </div>
                            {item.customerPhone ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <a
                                  href={`tel:${item.customerPhone}`}
                                  className="font-mono text-indigo-700 hover:underline font-bold text-[11px] flex items-center gap-1"
                                  title="Bấm để gọi"
                                >
                                  <Phone className="w-2.5 h-2.5 text-indigo-500" />
                                  <span>{item.customerPhone}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.customerPhone, `phone-warn-${item.id}`, 'Đã chép SĐT')}
                                  className="text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer"
                                  title="Sao chép SĐT"
                                >
                                  {copiedId === `phone-warn-${item.id}` ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="text-[10px] text-stone-400 italic">Không có SĐT</div>
                            )}
                          </td>

                          {/* 4. Thiết Bị & Model */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-stone-900 leading-tight">
                              {item.model || 'Điện thoại'}
                            </div>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {item.isCustomerCallHold && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold border bg-blue-50 text-blue-800 border-blue-200">
                                  <PhoneCall className="w-2.5 h-2.5 text-blue-600" />
                                  <span>Gọi đặt</span>
                                </span>
                              )}
                              {item.customerKeepsPart && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold border bg-purple-50 text-purple-900 border-purple-200">
                                  <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                  <span>SVD</span>
                                </span>
                              )}
                              {bookingDuplicateGroupsMap[item.id]?.map((dupGroup) => (
                                <button
                                  key={dupGroup.key}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectSubId) onSelectSubId('shortage-main');
                                    setSelectedDuplicatePartKey(dupGroup.key);
                                    setShowDuplicateFilterOnly(false);
                                    setStatusFilter('all');
                                    setSearchTerm('');
                                    setDuplicateFilterScope('pending_only');
                                    onShowToast(`Đang lọc ${dupGroup.ticketCount} phiếu trùng LK: ${dupGroup.partName}`, 'info');
                                  }}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-300 hover:bg-fuchsia-200 cursor-pointer transition-colors"
                                  title={`Bấm để lọc tất cả ${dupGroup.ticketCount} phiếu trùng [${dupGroup.partName}] trên bảng chính`}
                                >
                                  <Layers className="w-2.5 h-2.5 text-fuchsia-700" />
                                  <span>Trùng LK ({dupGroup.ticketCount})</span>
                                </button>
                              ))}
                              {item.technicianName && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                  <span>KT: {item.technicianName}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 5. Linh Kiện Cần Đặt */}
                          <td className="py-2.5 px-3 max-w-[260px]">
                            <div className="flex flex-col gap-1">
                              {bookingParts.map((part, pIdx) => {
                                const q = Math.max(1, part.quantity || 1);
                                const reqQ = typeof part.requestedQuantity === 'number'
                                  ? part.requestedQuantity
                                  : (part.isRequested ? q : 0);
                                const stockQ = typeof part.stockedInQuantity === 'number'
                                  ? part.stockedInQuantity
                                  : (part.isStockedIn ? q : 0);

                                return (
                                  <div key={pIdx} className="flex items-center gap-1.5 text-stone-800 text-[11px] leading-snug">
                                    <Boxes className="w-3 h-3 text-indigo-500 shrink-0" />
                                    <div className="min-w-0 flex-1 flex items-center gap-1 flex-wrap">
                                      <span className="font-mono font-bold text-stone-900">{part.partCode}</span>
                                      <span className="text-stone-600 truncate max-w-[130px]" title={part.partName}>{part.partName}</span>
                                      <span className={`px-1 py-0.2 rounded text-[10px] font-bold font-mono ${
                                        q > 1 ? 'bg-amber-100 text-amber-950 border border-amber-300' : 'bg-stone-100 text-stone-700'
                                      }`}>
                                        x{q}
                                      </span>
                                      {q > 1 && (
                                        <span className="text-[9px] font-bold text-stone-600 bg-stone-50 border border-stone-200 px-1 rounded font-mono">
                                          Xin:{reqQ}/{q} • Kho:{stockQ}/{q}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>

                          {/* 6. Tiến Độ & Trạng Thái */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-1">
                              {/* Cảnh báo lý do */}
                              <div className="flex items-center gap-1 flex-wrap">
                                {ov7.isOverdue && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    <span>Quá 7 ngày chưa lên ({ov7.daysSinceCalled} ngày)</span>
                                  </span>
                                )}
                                {s1Warn.hasWarning && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                    <span>Bước 1: Quá {s1Warn.daysPassed} ngày chưa xin LK</span>
                                  </span>
                                )}
                                {s2Warn.hasWarning && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                                    <Package className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                    <span>Bước 2: Quá {s2Warn.daysPassed} ngày chưa về kho</span>
                                  </span>
                                )}
                                {s3Warn.hasWarning && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                                    <PhoneCall className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                    <span>Bước 3: Về kho {s3Warn.daysPassed} ngày chưa gọi KH</span>
                                  </span>
                                )}
                                {svdWarn.isSvdPending3Days && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5 text-purple-700 shrink-0" />
                                    <span>SVD: Tạo {svdWarn.daysPending} ngày chưa xin LK</span>
                                  </span>
                                )}
                                {svdMultiProgress.isSvdBooking && svdMultiProgress.hasReminder && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black border flex items-center gap-1 ${
                                      svdMultiProgress.isUrgent
                                        ? 'bg-rose-100 text-rose-950 border-rose-300 animate-pulse'
                                        : 'bg-amber-100 text-amber-950 border-amber-300'
                                    }`}
                                  >
                                    <PhoneCall className="w-2.5 h-2.5 shrink-0" />
                                    <span>{svdMultiProgress.title}</span>
                                  </span>
                                )}
                                {item.cancelRequested && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse flex items-center gap-1">
                                    <AlertCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    <span>Yêu cầu hủy: {item.cancelRequestedBy || 'NV'}</span>
                                  </span>
                                )}
                                {item.editRequested && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1">
                                    <Edit3 className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                                    <span>Yêu cầu sửa: {item.editRequestedBy || 'NV'}</span>
                                  </span>
                                )}
                              </div>

                              {/* Trạng thái quy trình */}
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] border max-w-fit ${statusConfig.badgeBg}`}
                                >
                                  <span>{statusConfig.label}</span>
                                </span>

                                {item.status === 'da_goi_kh' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCallModal(item)}
                                    className="text-[10px] text-purple-900 bg-purple-100 hover:bg-purple-200 border border-purple-200 rounded px-1.5 py-0.2 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <PhoneCall className="w-2.5 h-2.5 text-purple-700 shrink-0" />
                                    <span>{item.calledCustomerDate || 'Đã gọi'}</span>
                                  </button>
                                )}

                                {item.appointmentDate && (
                                  <span className="text-[10px] text-indigo-800 font-bold flex items-center gap-0.5 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.2">
                                    <Calendar className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                    <span>Hẹn: {item.appointmentDate}</span>
                                  </span>
                                )}
                              </div>

                              {/* Ghi chú */}
                              {item.note && (
                                <div className="mt-0.5 p-1 rounded bg-amber-50/80 border border-amber-200/80 text-[10px] text-stone-800 leading-snug flex items-center gap-1 max-w-[240px] truncate" title={item.note}>
                                  <StickyNote className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                  <span className="truncate">"{item.note}"</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 7. Vị Trí Kệ/Tủ */}
                          <td className="py-2.5 px-3">
                            {item.location ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono font-bold text-[11px]">
                                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>{item.location}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-400 italic">Chưa xếp vị trí</span>
                            )}
                          </td>

                          {/* 8. Xử Lý Bước Kế Tiếp */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1 flex-wrap">
                              {item.status === 'da_tao_phieu' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatus(item, 'da_xin_lk')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Chuyển sang Bước 2: Đã xin linh kiện"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  <span>2. Đã xin LK</span>
                                </button>
                              )}
                              {item.status === 'chua_xin_du_lk' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatus(item, 'da_xin_lk')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Bổ sung xin đủ LK"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  <span>2. Bổ sung đủ LK</span>
                                </button>
                              )}
                              {item.status === 'da_xin_lk' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatus(item, 'da_nhap_kho')}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Chuyển sang Bước 3: Đã nhập kho"
                                >
                                  <Boxes className="w-3 h-3" />
                                  <span>3. Nhập kho</span>
                                </button>
                              )}
                              {item.status === 'da_nhap_kho' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(item)}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Hàng đã về kho, bấm để gọi khách lên"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>4. Gọi khách</span>
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
                                    onClick={() => handleAdvanceStatus(item, 'da_hoan_tat')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                    title="Khách đã lên nhận máy thay xong"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>5. Khách lên</span>
                                  </button>
                                </div>
                              )}
                              {item.status === 'da_hoan_tat' && (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Hoàn tất ({item.closureBy || 'KTV'})</span>
                                </span>
                              )}

                              {svdMultiProgress.isSvdBooking && svdMultiProgress.stage === 'after_svd_ended' && item.status !== 'da_hoan_tat' && (
                                <div className="mt-1 flex items-center gap-1 justify-end flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCompleteModal(item, 'close_no_repair', 'khach_khong_len_svd')}
                                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                    title="Đóng phiếu do khách không lên trong đợt Ngày Dịch Vụ SVD (tránh treo phiếu)"
                                  >
                                    <XCircle className="w-2.5 h-2.5" />
                                    <span>Đóng SVD</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleExtendSvdNextMonth(item)}
                                    className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                    title="Khách hẹn chờ sang đợt Ngày Dịch Vụ SVD (10-12) đợt sau"
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Chờ đợt sau</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 9. Thao Tác */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center justify-center gap-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleOpenCallModal(item)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                                title="Gọi điện cho khách hàng"
                              >
                                <PhoneCall className="w-3 h-3 text-blue-600" />
                                <span>Gọi KH</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                                title="Chỉnh sửa phiếu / cập nhật tiến độ"
                              >
                                <Edit3 className="w-3 h-3 text-indigo-600" />
                                <span>Cập nhật</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => printShortageLabel(item)}
                                className="px-1.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded border border-stone-300 transition-colors cursor-pointer flex items-center gap-1"
                                title="In tem phiếu đặt chờ 3x2 cm"
                              >
                                <Printer className="w-3 h-3 text-stone-600" />
                                <span>In tem</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleNavigateToMainTable(item.ticketNumber)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#059669] text-xs font-bold rounded border border-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
                                title="Xem trên bảng chính"
                              >
                                <Eye className="w-3 h-3 text-[#059669]" />
                                <span>Bảng chính</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls for Warnings Tab */}
            {activeWarningTickets.length > 0 && (
              <div className="p-3 bg-white border-t border-stone-200">
                <PaginationControl
                  currentPage={safeWarningPage}
                  totalItems={activeWarningTickets.length}
                  pageSize={warningPageSize}
                  pageSizeOptions={[10, 20, 50, 100]}
                  onPageChange={(page) => {
                    setWarningPage(page);
                  }}
                  onPageSizeChange={(newSize) => {
                    setWarningPageSize(newSize);
                    setWarningPage(1);
                  }}
                  itemLabel="phiếu cảnh báo & nhắc nhở"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: Danh sách phiếu đặt chờ chính (Default / shortage-main) */}
      {(!activeSubId || activeSubId === 'shortage-main') && (
        <>
          {/* Compact Alerts Notice if any */}
          {totalWarningsCount > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="text-xs font-bold text-orange-950">
                  Có {totalWarningsCount} cảnh báo tiến độ & nhắc nhở cần xử lý
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectSubId?.('shortage-warnings')}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                Mở Cảnh Báo ({totalWarningsCount})
              </button>
            </div>
          )}

      {/* KPI Cards Row (Single-row layout on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-flow-col xl:auto-cols-fr gap-2 md:gap-2.5">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setSearchTerm('');
            setSelectedDuplicatePartKey(null);
            setShowDuplicateFilterOnly(false);
            onShowToast('Đã hiển thị tất cả phiếu đặt chờ', 'info');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'all' && !searchTerm && !selectedDuplicatePartKey && !showDuplicateFilterOnly
              ? 'bg-amber-50/80 border-2 border-amber-500 ring-2 ring-amber-400/30 text-amber-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-amber-300 text-stone-700'
          }`}
        >
          <div className="flex justify-between items-start text-amber-900">
            <span className="text-[11px] font-bold">Tất cả phiếu</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 mt-1">{stats.total}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">Tổng linh kiện (Xem tất cả)</div>
        </button>

        {stats.cancelRequestsCount > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'cancel_requested' ? 'all' : 'cancel_requested')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === 'cancel_requested'
                ? 'bg-rose-50/90 border-2 border-rose-500 ring-2 ring-rose-400/30 shadow-xs font-bold scale-[1.02]'
                : 'bg-rose-50/40 border border-rose-200 hover:border-rose-400'
            }`}
          >
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <div className="flex justify-between items-start text-rose-800">
              <span className="text-[11px] font-bold">⚠️ Yêu cầu hủy</span>
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            </div>
            <div className="text-2xl font-black text-rose-700 mt-1">{stats.cancelRequestsCount}</div>
            <div className="text-[10px] text-rose-700 font-semibold mt-0.5">Chờ duyệt hủy</div>
          </button>
        )}

        {stats.editRequestsCount > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'edit_requested' ? 'all' : 'edit_requested')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === 'edit_requested'
                ? 'bg-sky-50/90 border-2 border-sky-500 ring-2 ring-sky-400/30 shadow-xs font-bold scale-[1.02]'
                : 'bg-sky-50/40 border border-sky-200 hover:border-sky-400'
            }`}
          >
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <div className="flex justify-between items-start text-sky-800">
              <span className="text-[11px] font-bold">📝 Yêu cầu sửa</span>
              <Edit3 className="w-4 h-4 text-sky-600 shrink-0" />
            </div>
            <div className="text-2xl font-black text-sky-700 mt-1">{stats.editRequestsCount}</div>
            <div className="text-[10px] text-sky-700 font-semibold mt-0.5">Chờ duyệt sửa</div>
          </button>
        )}

        <button
          type="button"
          onClick={() => setStatusFilter('da_tao_phieu')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_tao_phieu'
              ? 'bg-slate-50/90 border-2 border-slate-500 ring-2 ring-slate-400/30 text-slate-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-slate-300 text-stone-700'
          }`}
        >
          <div className="flex justify-between items-start text-slate-800">
            <span className="text-[11px] font-bold">1. Đã tạo phiếu</span>
            <Clock className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.daTaoPhieu}</div>
          <div className="text-[10px] text-slate-600 mt-0.5 font-semibold">Chờ gửi yêu cầu</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('chua_xin_du_lk')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'chua_xin_du_lk'
              ? 'bg-amber-50/90 border-2 border-amber-500 ring-2 ring-amber-400/30 text-amber-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-amber-300 text-stone-700'
          }`}
        >
          <div className="flex justify-between items-start text-amber-800">
            <span className="text-[11px] font-bold">2a. Chưa xin đủ LK</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{stats.chuaXinDuLk}</div>
          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">⚠️ Thiếu linh kiện</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('da_xin_lk')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_xin_lk'
              ? 'bg-emerald-50/90 border-2 border-emerald-500 ring-2 ring-emerald-400/30 text-emerald-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-emerald-300 text-stone-700'
          }`}
        >
          <div className="flex justify-between items-start text-emerald-800">
            <span className="text-[11px] font-bold">2. Đã xin LK</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{stats.daXinLk}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5 font-semibold">Chờ trung tâm cấp</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('nhap_kho_chua_du_lk')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'nhap_kho_chua_du_lk'
              ? 'bg-cyan-50/90 border-2 border-cyan-500 ring-2 ring-cyan-400/30 text-cyan-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-cyan-300 text-stone-700'
          }`}
        >
          <div className="flex justify-between items-start text-cyan-800">
            <span className="text-[11px] font-bold">3a. Nhập kho chưa đủ LK</span>
            <Boxes className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-black text-cyan-900 mt-1">{stats.nhapKhoChuaDuLk}</div>
          <div className="text-[10px] text-cyan-700 font-semibold mt-0.5">📦 Về 1 phần LK</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('da_nhap_kho')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            statusFilter === 'da_nhap_kho'
              ? 'bg-indigo-50/90 border-2 border-indigo-500 ring-2 ring-indigo-400/30 text-indigo-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-indigo-300 text-stone-700'
          }`}
        >
          {stats.daNhapKho > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
          )}
          <div className="flex justify-between items-start text-indigo-800">
            <span className="text-[11px] font-bold">3. Đã nhập kho</span>
            <Boxes className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1">{stats.daNhapKho}</div>
          <div className="text-[10px] text-indigo-700 font-bold mt-0.5">⚡ Cần gọi khách</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('da_goi_kh')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_goi_kh'
              ? 'bg-blue-50/90 border-2 border-blue-500 ring-2 ring-blue-400/30 text-blue-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-blue-300 text-stone-700'
          }`}
        >
          <div className="flex justify-between items-start text-blue-800">
            <span className="text-[11px] font-bold">4. Đã gọi khách</span>
            <PhoneCall className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{stats.daGoiKh}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Chờ mang máy lên</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('da_hoan_tat')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_hoan_tat'
              ? 'bg-emerald-50/90 border-2 border-emerald-500 ring-2 ring-emerald-400/30 text-emerald-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-emerald-300 text-stone-700'
          }`}
        >
          <div className="flex justify-between items-start text-emerald-800">
            <span className="text-[11px] font-bold">5. Khách đã lên</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{stats.daHoanTat}</div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            {stats.completedCallHolds > 0 || stats.completedSvdKeeps > 0 ? (
              <span className="truncate block" title={`Đã xử lý xong: ${[stats.completedCallHolds > 0 ? `${stats.completedCallHolds} gọi đặt` : '', stats.completedSvdKeeps > 0 ? `${stats.completedSvdKeeps} SVD` : ''].filter(Boolean).join(', ')}`}>
                Xong ({[stats.completedCallHolds > 0 ? `${stats.completedCallHolds} gọi đặt` : '', stats.completedSvdKeeps > 0 ? `${stats.completedSvdKeeps} SVD` : ''].filter(Boolean).join(', ')})
              </span>
            ) : (
              'KT đã xử lý xong'
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('da_bo_mau')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'da_bo_mau'
              ? 'bg-rose-50/90 border-2 border-rose-500 ring-2 ring-rose-400/30 text-rose-950 shadow-xs font-bold scale-[1.02]'
              : 'bg-white border-stone-200 hover:border-rose-300 text-stone-700'
          }`}
        >
          <div className="flex justify-between items-start text-rose-800">
            <span className="text-[11px] font-bold">6. Bỏ mẫu</span>
            <Ban className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-900 mt-1">{stats.daBoMau}</div>
          <div className="text-[10px] text-rose-700 font-semibold mt-0.5">Linh kiện đã bỏ mẫu</div>
        </button>
      </div>

      {/* Action Bar: Search, Filters, Excel */}
      <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 relative z-20">
        {/* Search Input & Dedicated QR Barcode Scanner Button */}
        <div className="flex items-center gap-2 w-full sm:w-[380px] md:w-[420px] lg:w-[460px] shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                // Instant check for full QR string bursts or tab delimiters without disrupting normal typing
                if (val && (val.length > 25 || val.includes('\t') || val.startsWith(']'))) {
                  const { cleanCode } = extractShortageSearchCode(val, allTicketNumbersSetRef.current);
                  if (cleanCode && cleanCode !== val) {
                    setSearchTerm(cleanCode);
                    return;
                  }
                }
                setSearchTerm(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val) {
                    const { cleanCode, originalRaw } = extractShortageSearchCode(val, allTicketNumbersSetRef.current);
                    if (cleanCode) {
                      setSearchTerm(cleanCode);
                      setSearchScope('filtered');
                      playScanBeepSound();
                      if (cleanCode !== originalRaw) {
                        onShowToast(`Đã bóc tách mã: "${cleanCode}"`, 'success');
                      }
                    }
                  }
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (pasted) {
                  const { cleanCode, originalRaw } = extractShortageSearchCode(pasted, allTicketNumbersSetRef.current);
                  if (cleanCode) {
                    e.preventDefault();
                    setSearchTerm(cleanCode);
                    setSearchScope('filtered');
                    playScanBeepSound();
                    if (cleanCode !== originalRaw) {
                      onShowToast(`Đã dán & bóc tách mã: "${cleanCode}"`, 'success');
                    }
                  }
                }
              }}
              placeholder="Tìm số phiếu, KH, SĐT, mã LK, KTV..."
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all shadow-2xs font-medium placeholder:text-neutral-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSearchScope('filtered');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-rose-600 text-xs font-bold p-0.5 cursor-pointer"
                title="Xóa tìm kiếm để xem tất cả"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0 border border-emerald-700"
            title="Quét mã QR / Barcode bằng Camera (Hỗ trợ tự động bóc tách mã trước dấu '-')"
          >
            <QrCode className="w-4 h-4 text-white animate-pulse" />
            <span className="inline">Quét QR</span>
          </button>
        </div>

        {/* Status Filter Dropdown & Quick Tags */}
        <div className="flex items-center gap-2 w-full md:w-auto pb-1 md:pb-0 text-xs flex-wrap">
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

          {/* Status Filter Menu Xổ xuống */}
          <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-300 rounded-lg px-2 py-1 shadow-2xs">
            <span className="text-neutral-500 text-[11px] font-bold flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-indigo-600" /> Lọc:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                const val = e.target.value;
                setStatusFilter(val);
                if (val === 'all') {
                  setSearchTerm('');
                  setSelectedDuplicatePartKey(null);
                  setShowDuplicateFilterOnly(false);
                }
              }}
              className="text-xs font-semibold bg-transparent border-none focus:ring-0 outline-none cursor-pointer text-neutral-800 py-0.5"
            >
              <option value="all">Tất cả trạng thái ({stats.total})</option>
              <option value="da_tao_phieu">1. Đã tạo phiếu ({stats.daTaoPhieu})</option>
              <option value="chua_xin_du_lk">2a. Chưa xin đủ LK ({stats.chuaXinDuLk})</option>
              <option value="da_xin_lk">2. Đã xin LK ({stats.daXinLk})</option>
              <option value="nhap_kho_chua_du_lk">3a. Nhập kho chưa đủ LK ({stats.nhapKhoChuaDuLk})</option>
              <option value="da_nhap_kho">3. Đã về kho ({stats.daNhapKho})</option>
              <option value="da_goi_kh">4. Đã gọi KH ({stats.daGoiKh})</option>
              <option value="da_hoan_tat">5. Khách đã lên / Đã xử lý ({stats.daHoanTat})</option>
            </select>
          </div>

          {/* Quick Overdue and Closed filters */}
          <button
            type="button"
            onClick={() => {
              if (searchTerm === 'quá 7 ngày') {
                setSearchTerm('');
              } else {
                setStatusFilter('da_goi_kh');
                setSearchTerm('quá 7 ngày');
              }
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors border flex items-center gap-1 ${
              searchTerm === 'quá 7 ngày'
                ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                : stats.qua7Ngay > 0
                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 animate-pulse'
                : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
            title="Lọc các phiếu đã gọi khách quá 7 ngày chưa lên"
          >
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>Quá 7 ngày ({stats.qua7Ngay})</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchTerm(searchTerm === 'đóng phiếu' ? '' : 'đóng phiếu')}
            className={`px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors border flex items-center gap-1 ${
              searchTerm === 'đóng phiếu'
                ? 'bg-slate-700 text-white border-slate-800 shadow-2xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
            title="Lọc các phiếu đã đóng do khách không thay linh kiện"
          >
            <Ban className="w-3 h-3 text-slate-500" />
            <span>Đã đóng ({stats.daDongPhieuKhongThay})</span>
          </button>

          {/* Quick Hold filters: Only active holds (chưa hoàn tất bước 5) */}
          <button
            type="button"
            onClick={() => {
              if (searchTerm === 'gọi đặt') {
                setSearchTerm('');
              } else {
                setStatusFilter('all');
                setSearchTerm('gọi đặt');
              }
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors border flex items-center gap-1 ${
              searchTerm === 'gọi đặt'
                ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
            }`}
            title="Lọc các phiếu khách gọi đặt giữ trước (khách chưa lên)"
          >
            <PhoneCall className="w-3 h-3" />
            <span>Gọi đặt ({stats.activeCallHolds})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (searchTerm === 'svd') {
                setSearchTerm('');
              } else {
                setStatusFilter('all');
                setSearchTerm('svd');
              }
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1.5 ${
              searchTerm === 'svd' || searchTerm === 'khách đặt svd'
                ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                : 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100'
            }`}
            title="Lọc các phiếu khách đặt giữ linh kiện ngày khuyến mãi SVD (khách chưa lên)"
          >
            <Sparkles className={`w-3.5 h-3.5 ${searchTerm === 'svd' || searchTerm === 'khách đặt svd' ? 'text-white' : 'text-purple-600'}`} />
            <span>Đặt Giữ SVD ({stats.activeSvdKeeps})</span>
          </button>

          {svdPending3DaysTickets.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchTerm(searchTerm === 'svd 3 ngày' ? '' : 'svd 3 ngày')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1 ${
                searchTerm === 'svd 3 ngày'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="Cảnh báo: Linh kiện SVD chưa được đặt/xin quá 3 ngày liên tục!"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${searchTerm === 'svd 3 ngày' ? 'text-white' : 'text-amber-600'}`} />
              <span>SVD Chưa Đặt &gt;3 Ngày ({svdPending3DaysTickets.length})</span>
            </button>
          )}

          {/* Quick Duplicate Part Filter Tab (Focus on pending unreplaced parts) */}
          <button
            type="button"
            onClick={() => {
              if (showDuplicateFilterOnly || selectedDuplicatePartKey) {
                setShowDuplicateFilterOnly(false);
                setSelectedDuplicatePartKey(null);
                setStatusFilter('all');
                setSearchTerm('');
                onShowToast('Đã tắt lọc linh kiện trùng', 'info');
              } else {
                setShowDuplicateFilterOnly(true);
                setSelectedDuplicatePartKey(null);
                setDuplicateFilterScope('pending_only');
                setStatusFilter('all');
                setSearchTerm('');
                onShowToast(`Đang lọc ${pendingDuplicateGroups.length} loại linh kiện trùng khách chưa lên thay`, 'info');
              }
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1.5 ${
              showDuplicateFilterOnly || selectedDuplicatePartKey
                ? 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-2xs'
                : pendingDuplicateGroups.length > 0
                ? 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-300 hover:bg-fuchsia-100 shadow-2xs'
                : 'bg-stone-50 text-stone-500 border-stone-200'
            }`}
            title="Lọc chỉ hiển thị các phiếu khách chưa lên thay có linh kiện trùng nhau"
          >
            <Layers className={`w-3.5 h-3.5 ${showDuplicateFilterOnly || selectedDuplicatePartKey ? 'text-white' : 'text-fuchsia-600'}`} />
            <span>Trùng LK Chưa Thay ({pendingDuplicateGroups.length})</span>
          </button>
        </div>

        {/* Action Buttons: Toggle Check Stock & Excel Import/Export */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Nút Tạo phiếu đặt chờ mẫu màu xanh lá giống mẫu hình 2 */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg bg-[#00A854] hover:bg-[#009247] transition-all cursor-pointer shadow-sm active:scale-95"
            title="Tạo phiếu đặt chờ linh kiện mới"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tạo phiếu đặt chờ</span>
          </button>

          {/* Nút Mở cổng tra cứu / đăng ký GCSM Part Shortage Register */}
          <a
            href="https://gcsm-sg.oppoit.com/part/part-shortage-register"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer transition-colors shadow-2xs"
            title="Mở cổng đăng ký / tra cứu GCSM (https://gcsm-sg.oppoit.com/part/part-shortage-register)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
            <span>Cổng GCSM</span>
          </a>

          {/* Nút Check tồn GCSM mở cổng tra cứu tồn kho (kích thước chuẩn đồng bộ với tab In tem kho) */}
          <a
            href="https://gcsm-sg.oppoit.com/part/stocks/stock-query"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 cursor-pointer transition-colors shadow-2xs"
            title="Mở cổng tra cứu tồn kho linh kiện GCSM (https://gcsm-sg.oppoit.com/part/stocks/stock-query)"
          >
            <Boxes className="w-3.5 h-3.5 text-neutral-600" />
            <span>Check tồn GCSM</span>
          </a>

          {/* Nút Hiện / Ẩn check tồn mã linh kiện */}
          <button
            type="button"
            onClick={() => {
              const nextVal = !showStockCheckButton;
              setShowStockCheckButton(nextVal);
              try {
                localStorage.setItem('shortage_show_stock_check_btn', String(nextVal));
              } catch {}
              onShowToast(
                nextVal
                  ? 'Đã bật hiển thị nút check tồn kho GCSM'
                  : 'Đã ẩn nút check tồn kho GCSM (chỉ hiện khi rê chuột vào linh kiện)',
                'info'
              );
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-xs rounded cursor-pointer transition-colors border ${
              showStockCheckButton
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border-neutral-300'
            }`}
            title="Bật / Tắt hiển thị nút mở cổng tra cứu tồn kho GCSM sau mã linh kiện"
          >
            <ExternalLink className={`w-3.5 h-3.5 ${showStockCheckButton ? 'text-white' : 'text-neutral-500'}`} />
            <span>Nút check tồn: <strong className={showStockCheckButton ? 'text-white font-bold' : 'text-neutral-500 font-bold'}>{showStockCheckButton ? 'Hiện' : 'Ẩn'}</strong></span>
          </button>

          {/* Gom Nhập & Xuất Excel thành 1 nút dropdown gọn gàng */}
          <ExcelActionMenu
            onFileSelect={handleFileChange}
            onExportClick={handleExportExcel}
            exportCount={filteredBookings.length}
            exportDisabled={filteredBookings.length === 0}
            buttonText="Nhập / Xuất Excel"
            shortButtonText="Excel"
            theme="neutral"
            title="Thao tác nhập file Excel/JSON hoặc xuất danh sách đặt chờ linh kiện ra Excel"
          />

          {isAdmin && (
            <button
              type="button"
              onClick={onOpenFastBackupRestore || handleExportJsonBackup}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs rounded-lg cursor-pointer transition-all shadow-2xs active:scale-[0.98]"
              title="Sao lưu toàn bộ dữ liệu 100% thuộc tính hoặc khôi phục siêu tốc từ file JSON khi chuyển tài khoản hoặc đổi máy"
            >
              <FileJson className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Sao Lưu / Khôi Phục JSON</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowClearAllConfirmModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg border border-rose-200 cursor-pointer transition-colors"
              title="Xóa trắng toàn bộ danh sách đặt chờ linh kiện"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Xóa trắng danh sách</span>
            </button>
          )}
        </div>
      </div>

      {/* Duplicate Part Filter Active Highlight Banner with Allocation Analytics */}
      {(selectedDuplicatePartKey || showDuplicateFilterOnly) && (
        <div className="bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950 text-white p-3.5 md:p-4 rounded-xl shadow-xs border border-amber-500/40 flex flex-col gap-3 animate-in fade-in overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg shrink-0 mt-0.5 border border-amber-500/30">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded uppercase tracking-wider">
                    {selectedDuplicatePartKey ? 'Đang Lọc 1 Linh Kiện Trùng' : 'Đang Lọc Danh Sách Linh Kiện Trùng'}
                  </span>
                  <span className="text-xs font-bold text-white bg-stone-800 px-2 py-0.5 rounded border border-stone-700">
                    Hiển thị: {filteredBookings.length} phiếu
                  </span>
                  {/* Scope Selector: Pending only vs All */}
                  <div className="inline-flex items-center rounded-lg bg-stone-800 p-0.5 border border-stone-700">
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicateFilterScope('pending_only');
                        setStatusFilter('all');
                        setSearchTerm('');
                      }}
                      className={`px-2 py-0.5 text-[10.5px] font-bold rounded cursor-pointer transition-all ${
                        duplicateFilterScope === 'pending_only'
                          ? 'bg-amber-500 text-stone-950 shadow-2xs font-bold'
                          : 'text-stone-300 hover:text-white'
                      }`}
                      title="Chỉ hiển thị các phiếu của khách chưa lên thay linh kiện (chưa hoàn tất bước 5)"
                    >
                      Khách chưa lên thay (B1-B4)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicateFilterScope('all');
                        setStatusFilter('all');
                        setSearchTerm('');
                      }}
                      className={`px-2 py-0.5 text-[10.5px] font-bold rounded cursor-pointer transition-all ${
                        duplicateFilterScope === 'all'
                          ? 'bg-amber-500 text-stone-950 shadow-2xs font-bold'
                          : 'text-stone-300 hover:text-white'
                      }`}
                      title="Hiển thị tất cả các phiếu (bao gồm cả phiếu khách đã lên nhận máy xong)"
                    >
                      Tất cả phiếu
                    </button>
                  </div>
                </div>

                {/* Detailed description and breakdown */}
                {selectedDuplicatePartKey ? (
                  (() => {
                    const activeGroup = duplicatePartGroups.find((g) => g.key === selectedDuplicatePartKey);
                    if (!activeGroup) return <p className="text-xs text-amber-200">Đang lọc theo linh kiện trùng...</p>;
                    return (
                      <div className="space-y-1.5">
                        <p className="text-xs text-stone-200 leading-relaxed break-words">
                          Linh kiện: <strong className="text-white text-sm">{activeGroup.partName}</strong>{' '}
                          {activeGroup.partCode && activeGroup.partCode !== 'N/A' && (
                            <span className="font-mono bg-stone-900 text-amber-300 font-bold px-1.5 py-0.5 rounded text-xs border border-amber-500/30">
                              [{activeGroup.partCode}]
                            </span>
                          )}{' '}
                          • Model: <span className="text-amber-200 font-semibold">{activeGroup.model || 'Tất cả model'}</span>
                        </p>
                        
                        {/* Status allocation breakdown tags */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 border border-rose-400/40">
                            🔴 Cần xin GCSM: <strong>{activeGroup.neededToRequestQty} cái</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-400/40">
                            🟡 Đang chờ cấp (B2): <strong>{activeGroup.requestedWaitingQty} cái</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-200 border border-purple-400/40">
                            🟣 Đã về kho chờ khách (B3, B4): <strong>{activeGroup.stockedWaitingCustomerQty} cái</strong>
                          </span>
                          {activeGroup.completedQuantity > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                              🟢 Đã xong (B5): <strong>{activeGroup.completedQuantity} cái</strong> ({activeGroup.completedCount} phiếu)
                            </span>
                          )}
                          <span className="text-[11px] text-amber-200/90 font-semibold">
                            (Tổng cộng nợ khách chưa thay: <strong className="text-white">{activeGroup.activeQuantity} cái</strong> trên <strong className="text-white">{activeGroup.activeCount} phiếu</strong>)
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-stone-300 leading-relaxed">
                    {duplicateFilterScope === 'pending_only'
                      ? `Đang lọc các phiếu khách chưa lên thay có chứa linh kiện bị đặt trùng. Có ${pendingDuplicateGroups.length} loại linh kiện trùng chưa hoàn tất, tổng số lượng cần cấp nợ khách: ${pendingDuplicateGroups.reduce((s, g) => s + g.activeQuantity, 0)} cái.`
                      : `Đang hiển thị tất cả các phiếu có linh kiện trùng nhau (${duplicatePartGroups.length} loại linh kiện).`}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Action Buttons on Banner */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-amber-600/30">
              {selectedDuplicatePartKey && (() => {
                const activeGroup = duplicatePartGroups.find((g) => g.key === selectedDuplicatePartKey);
                if (!activeGroup) return null;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const code = activeGroup.partCode !== 'N/A' ? activeGroup.partCode : activeGroup.partName;
                        const copyText = `${code}\t${activeGroup.neededToRequestQty || activeGroup.activeQuantity}`;
                        navigator.clipboard.writeText(copyText);
                        onShowToast(`Đã copy: "${copyText}" vào clipboard`, 'success');
                      }}
                      className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 border border-stone-700"
                      title="Copy mã linh kiện và số lượng cần xin thêm để dán vào Excel/GCSM"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-300" />
                      <span>Copy Mã & SL</span>
                    </button>
                    {activeGroup.partCode && activeGroup.partCode !== 'N/A' && (
                      <a
                        href={GCSM_STOCK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 border border-amber-400/30"
                        title="Mở cổng GCSM tra cứu tồn kho"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Check tồn GCSM</span>
                      </a>
                    )}
                  </>
                );
              })()}

              <button
                type="button"
                onClick={() => setShowDuplicatePartsModal(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-amber-400/40"
                title="Mở bảng phân bổ chi tiết và danh sách linh kiện trùng"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Bảng Phân Bổ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDuplicatePartKey(null);
                  setShowDuplicateFilterOnly(false);
                  setStatusFilter('all');
                  setSearchTerm('');
                  onShowToast('Đã xóa bộ lọc linh kiện trùng', 'info');
                }}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 border border-stone-700"
                title="Bỏ lọc để hiển thị lại toàn bộ danh sách phiếu"
              >
                <X className="w-3.5 h-3.5" />
                <span>Bỏ Lọc</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Action Bar when tickets are selected */}
      {selectedIds.length > 0 && (
        <div className="mb-3 bg-slate-900 text-white p-2.5 px-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs border border-emerald-500/40">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-emerald-400">
              Đã chọn: {selectedIds.length} / {filteredBookings.length} phiếu
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
            >
              Bỏ chọn tất cả
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleBatchPrintShortageSelected}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer mr-1"
              title="In tem 3x2 inch cho tất cả các phiếu đã tick chọn (Phím tắt: Ctrl + P)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-950" />
              <span>In tem ({selectedIds.length} phiếu)</span>
              <span className="text-[10px] bg-amber-600/30 text-slate-950 px-1 py-0.5 rounded font-mono font-semibold">Ctrl+P</span>
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateStatus('da_xin_lk')}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition-colors cursor-pointer"
            >
              ➔ 2. Đã xin LK
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateStatus('chua_xin_du_lk')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded transition-colors cursor-pointer"
            >
              ➔ 2a. Chưa đủ LK
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateStatus('da_nhap_kho')}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded transition-colors cursor-pointer"
            >
              ➔ 3. Đã nhập kho
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateStatus('da_goi_kh')}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-colors cursor-pointer"
            >
              ➔ 4. Đã gọi KH
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateStatus('da_hoan_tat')}
              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded transition-colors cursor-pointer"
            >
              ➔ 5. Khách đã lên
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateStatus('da_bo_mau')}
              className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white font-bold rounded transition-colors cursor-pointer"
            >
              ➔ 6. Bỏ mẫu
            </button>
            <button
              type="button"
              onClick={handleBatchConvertToSvd}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              title="Chuyển các phiếu đã chọn sang chế độ Đặt giữ SVD (Áp dụng khuyến mãi Ngày Dịch Vụ SVD)"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>Đổi Đặt giữ SVD ({selectedIds.length})</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa chọn ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Search Filter Banner */}
      {searchTerm.trim() && (
        <div className="bg-indigo-50/90 border border-indigo-200 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs text-indigo-950 font-semibold shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-[11px] shrink-0">
              <Search className="w-3.5 h-3.5" />
              <span>Kết Quả Tìm Kiếm</span>
            </span>
            <span className="text-neutral-700">
              Từ khóa: <strong className="text-indigo-950 bg-white px-2 py-0.5 rounded border border-indigo-200 font-mono">"{searchTerm.trim()}"</strong>
            </span>
            <span className="text-indigo-900 text-[11px] bg-indigo-100/90 px-2 py-0.5 rounded border border-indigo-200">
              {searchScope === 'all' ? (
                <>Toàn bộ hệ thống: <b>{filteredBookings.length}</b> / {bookings.length} phiếu</>
              ) : (
                <>Trong bộ lọc: <b>{filteredBookings.length}</b> phiếu {isFilterScopeActive && `(toàn hệ thống có ${globalSearchMatchesCount} phiếu)`}</>
              )}
            </span>
            {filteredBookings.length === 0 && globalSearchMatchesCount > 0 && searchScope === 'filtered' && (
              <span className="text-amber-800 text-[11px] bg-amber-100 px-2 py-0.5 rounded border border-amber-300 font-medium">
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
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs hover:bg-indigo-700'
                    : 'bg-white text-indigo-900 border-indigo-300 hover:bg-indigo-50 shadow-2xs'
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

      {/* Active Time Filter Indicator Banner */}
      {dateFilter.mode !== 'all' && (
        <div className="bg-emerald-50/90 border border-emerald-300 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950 font-semibold shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[11px]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Đang Lọc Thời Gian Tạo Phiếu</span>
            </span>
            <span>
              Phạm vi: <strong className="text-emerald-900 font-bold">
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
            <span className="text-emerald-800 text-[11px] bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
              Khớp <b>{filteredBookings.length}</b> / {bookings.length} phiếu
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDateFilter({ mode: 'all', selectedMonth: '', startDate: '', endDate: '' })}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-900 hover:text-rose-700 bg-white hover:bg-rose-50 border border-emerald-300 hover:border-rose-300 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
            title="Xóa lọc thời gian để xem toàn bộ tất cả các tháng"
          >
            <X className="w-3 h-3" />
            <span>Xóa Lọc Thời Gian</span>
          </button>
        </div>
      )}

      {/* Sub toolbar: Total count & Expand/Collapse All toggle */}
      <div className="flex items-center justify-between gap-2 mb-2 text-xs">
        <span className="text-neutral-500 font-medium">
          Danh sách phiếu: <strong>{filteredBookings.length}</strong> kết quả
        </span>
        <div className="flex items-center gap-2">
          {expandedTicketIds.size > 0 ? (
            <button
              type="button"
              onClick={handleCollapseAllTickets}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 font-bold text-xs cursor-pointer transition-colors shadow-2xs"
              title="Thu gọn tất cả các phiếu về dạng bảng tóm tắt"
            >
              <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Thu gọn tất cả ({expandedTicketIds.size} đang mở)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleExpandAllTickets(filteredBookings.map((b) => b.id))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 font-bold text-xs cursor-pointer transition-colors shadow-2xs"
              title="Mở rộng xem chi tiết tất cả phiếu"
            >
              <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mở rộng tất cả</span>
            </button>
          )}
        </div>
      </div>

      {/* Main List Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-neutral-800 text-sm">
                {searchTerm || statusFilter !== 'all'
                  ? 'Không tìm thấy phiếu đặt chờ phù hợp với bộ lọc'
                  : 'Chưa có phiếu đặt chờ linh kiện nào'}
              </h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                Nhấn nút <strong>"+ Tạo Phiếu Đặt Chờ"</strong> để tạo phiếu mới hoặc nhập dữ liệu từ file Excel.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Phiếu Đặt Chờ Đầu Tiên</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50/90 text-neutral-700 border-b border-neutral-200 font-bold">
                  <th className="py-2.5 px-3 w-14 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectAll(filteredBookings)}
                        className="text-neutral-400 hover:text-emerald-600 cursor-pointer transition-colors p-0.5"
                        title={selectedIds.length === filteredBookings.length && filteredBookings.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      >
                        {selectedIds.length === filteredBookings.length && filteredBookings.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400" />
                        )}
                      </button>
                      <span title="Số thứ tự theo thời gian tạo (tạo trước = 1, tăng dần)">STT</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[140px]">Số Phiếu</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Khách Hàng & SĐT</th>
                  <th className="py-2.5 px-3 min-w-[130px]">Thiết Bị & Model</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Linh Kiện Cần Đặt</th>
                  <th className="py-2.5 px-3 min-w-[190px]">Tiến Độ & Trạng Thái</th>
                  <th className="py-2.5 px-3 min-w-[100px]">Vị Trí Kệ/Tủ</th>
                  <th className="py-2.5 px-3 min-w-[140px] text-right">Xử Lý Bước Kế Tiếp</th>
                  <th className="py-2.5 px-3 text-center w-28">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70">
                {paginatedBookings.map((item, idx) => {
                  const statusConfig = SHORTAGE_STATUS_CONFIG[item.status] || SHORTAGE_STATUS_CONFIG.da_tao_phieu;
                  const isExpanded = expandedTicketIds.has(item.id);
                  const bookingParts = getBookingParts(item);
                  const isDone = item.status === 'da_hoan_tat' || item.status === 'da_bo_mau';
                  const isCancelReq = Boolean(item.cancelRequested);

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`transition-colors border-b border-neutral-200/70 ${
                          isCancelReq
                            ? 'bg-rose-50/70 hover:bg-rose-100/70 border-l-4 border-l-rose-500'
                            : isDone
                            ? 'bg-neutral-50/40 text-neutral-500 hover:bg-neutral-50/80'
                            : item.status === 'da_nhap_kho'
                            ? 'bg-purple-50/25 hover:bg-purple-50/40'
                            : 'hover:bg-neutral-50/80'
                        }`}
                      >
                        {/* 1. STT & Checkbox */}
                        <td className="py-2.5 px-3 text-center font-mono font-medium text-neutral-500">
                          {(() => {
                            const globalStt = ticketSttMap.get(item.id);
                            const stepStt = currentFilteredSttMap?.get(item.id);
                            const isFiltered = Boolean(
                              currentFilteredSttMap &&
                              (statusFilter !== 'all' || searchTerm.trim() || selectedDuplicatePartKey || showDuplicateFilterOnly)
                            );
                            const displayStt = isFiltered ? (stepStt ?? globalStt) : globalStt;

                            return (
                              <div className="flex flex-col items-center justify-center leading-tight">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSelectItem(item.id)}
                                    className="text-neutral-400 hover:text-emerald-600 cursor-pointer transition-colors p-0.5"
                                    title="Chọn phiếu này"
                                  >
                                    {selectedIds.includes(item.id) ? (
                                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-neutral-300" />
                                    )}
                                  </button>
                                  <span
                                    className="font-mono font-black text-neutral-900 text-xs"
                                    title={
                                      isFiltered
                                        ? `STT trong tab: ${displayStt} | STT gốc: #${globalStt}`
                                        : `STT #${displayStt}`
                                    }
                                  >
                                    {displayStt ?? (idx + 1)}
                                  </span>
                                </div>
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

                        {/* 2. Số Phiếu */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-black text-neutral-900 text-xs">
                              {item.ticketNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.ticketNumber, `ticket-${item.id}`, 'Đã chép số phiếu')}
                              className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors cursor-pointer"
                              title="Sao chép số phiếu"
                            >
                              {copiedId === `ticket-${item.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            {ticketGroupMap[item.ticketNumber?.trim().toUpperCase()]?.length > 1 && (
                              <span
                                className="text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shrink-0"
                                title="Khách này yêu cầu nhiều linh kiện khác nhau"
                              >
                                <Layers className="w-2.5 h-2.5 text-amber-700" />
                                <span>{ticketGroupMap[item.ticketNumber?.trim().toUpperCase()].length} LK</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-2.5 h-2.5 text-neutral-400" />
                            <span>{getBookingDateWithTime(item)}</span>
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

                        {/* 3. Khách Hàng & SĐT */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-neutral-900 flex items-center gap-1">
                            <User className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span className="truncate max-w-[130px]">{item.customerName || 'Khách lẻ'}</span>
                          </div>
                          {item.customerPhone ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <a
                                href={`tel:${item.customerPhone}`}
                                className="font-mono text-indigo-700 hover:underline font-bold text-[11px] flex items-center gap-1"
                                title="Bấm để gọi"
                              >
                                <Phone className="w-2.5 h-2.5 text-indigo-500" />
                                <span>{item.customerPhone}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.customerPhone, `phone-${item.id}`, 'Đã chép SĐT')}
                                className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded cursor-pointer"
                                title="Sao chép SĐT"
                              >
                                {copiedId === `phone-${item.id}` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="text-[10px] text-neutral-400 italic">Không có SĐT</div>
                          )}
                        </td>

                        {/* 4. Thiết Bị & Model */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-neutral-900 leading-tight">
                            {item.model || 'Điện thoại'}
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {item.isCustomerCallHold && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold border bg-blue-50 text-blue-800 border-blue-200">
                                <PhoneCall className="w-2.5 h-2.5 text-blue-600" />
                                <span>Gọi đặt</span>
                              </span>
                            )}
                            {item.customerKeepsPart && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold border bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200">
                                <Sparkles className="w-2.5 h-2.5 text-fuchsia-600" />
                                <span>SVD</span>
                              </span>
                            )}
                            {bookingDuplicateGroupsMap[item.id]?.map((dupGroup) => (
                              <button
                                key={dupGroup.key}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDuplicatePartKey(dupGroup.key);
                                  setShowDuplicateFilterOnly(false);
                                  setStatusFilter('all');
                                  setSearchTerm('');
                                  setDuplicateFilterScope('pending_only');
                                  onShowToast(`Đang lọc ${dupGroup.ticketCount} phiếu trùng LK: ${dupGroup.partName}`, 'info');
                                }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200 cursor-pointer transition-colors"
                                title={`Trùng LK [${dupGroup.partName}] (${dupGroup.ticketCount} khách / ${dupGroup.totalQuantity} cái) - Bấm để lọc`}
                              >
                                <Layers className="w-2.5 h-2.5 text-purple-700" />
                                <span>Trùng LK ({dupGroup.ticketCount})</span>
                              </button>
                            ))}
                          </div>
                        </td>

                        {/* 5. Linh Kiện Cần Đặt */}
                        <td className="py-2.5 px-3 max-w-[240px]">
                          <div className="flex flex-col gap-1">
                            {bookingParts.map((part, pIdx) => (
                              <div key={pIdx} className="flex items-center gap-1.5 text-neutral-800 text-[11px] leading-snug">
                                <Boxes className="w-3 h-3 text-indigo-500 shrink-0" />
                                <div className="min-w-0 flex-1 flex items-center gap-1 flex-wrap">
                                  <span className="font-mono font-bold text-neutral-900">{part.partCode}</span>
                                  <span className="text-neutral-600 truncate max-w-[130px]" title={part.partName}>{part.partName}</span>
                                  <span className="px-1 py-0.2 bg-neutral-100 text-neutral-700 rounded text-[10px] font-bold font-mono">
                                    x{part.quantity}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* 6. Tiến Độ & Trạng Thái */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] border max-w-fit ${statusConfig.badgeBg}`}
                            >
                              <span>{statusConfig.label}</span>
                            </span>

                            {/* Call status & appointments */}
                            {item.status === 'da_goi_kh' && (
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(item)}
                                  className="text-[10px] text-purple-900 bg-purple-100/90 hover:bg-purple-200 border border-purple-200 rounded px-1.5 py-0.5 font-bold flex items-center gap-1 cursor-pointer transition-colors text-left shadow-2xs max-w-fit"
                                  title="Bấm để xem lịch sử gọi hoặc ghi thêm lần gọi mới"
                                >
                                  <PhoneCall className="w-2.5 h-2.5 text-purple-700 shrink-0" />
                                  <span>
                                    Gọi: {item.calledCustomerDate || 'Đã gọi'}
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
                                    className="text-[10px] text-purple-950 italic bg-purple-50 hover:bg-purple-100 rounded px-1.5 py-0.5 border border-purple-200 truncate max-w-[200px] cursor-pointer"
                                    title={`Ghi chú cuộc gọi: ${item.callNote}. Bấm để xem toàn bộ lịch sử`}
                                  >
                                    "{item.callNote}"
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Ghi chú phiếu: Cho phép tất cả User Thêm / Sửa / Xóa */}
                            {item.note ? (
                              <div className="mt-1 p-1.5 rounded-md bg-amber-50/80 border border-amber-200/80 flex items-start justify-between gap-1.5 max-w-[240px]">
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
                                    title="Thêm nội dung vào ghi chú"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenNoteModal(item, 'edit')}
                                    className="p-0.5 text-amber-700 hover:bg-amber-100 rounded cursor-pointer"
                                    title="Sửa ghi chú"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickDeleteNote(item)}
                                    className="p-0.5 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                    title="Xóa ghi chú"
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

                            {/* Pending Cancel or Edit request badge */}
                            {item.cancelRequested && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
                                <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                                <span>Yêu cầu hủy: {item.cancelRequestedBy || 'Nhân viên'}</span>
                              </span>
                            )}
                            {item.editRequested && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300">
                                <Edit3 className="w-2.5 h-2.5 text-sky-600" />
                                <span>Yêu cầu sửa: {item.editRequestedBy || 'Nhân viên'}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 7. Vị Trí Kệ/Tủ */}
                        <td className="py-2.5 px-3">
                          {item.location ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono font-bold text-[11px]">
                              <MapPin className="w-3 h-3 text-amber-600" />
                              <span>{item.location}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">Chưa xếp vị trí</span>
                          )}
                        </td>

                        {/* 8. Xử Lý Bước Kế Tiếp */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            {item.status === 'da_tao_phieu' && (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatus(item, 'da_xin_lk')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Chuyển sang Bước 2: Đã xin linh kiện"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  <span>2. Đã xin LK</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(item, 'close_no_repair', 'khach_doi_y')}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Đóng & hoàn tất phiếu (Không xin được LK / Chờ lâu / Khách đổi ý không thay...)"
                                >
                                  <Ban className="w-2.5 h-2.5 text-rose-600" />
                                  <span>Đóng phiếu</span>
                                </button>
                              </div>
                            )}
                            {item.status === 'chua_xin_du_lk' && (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatus(item, 'da_xin_lk')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Bổ sung xin đủ LK"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  <span>2. Bổ sung đủ LK</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(item, 'close_no_repair', 'toan_quoc_con_it_khong_xin_duoc')}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Đóng & hoàn tất phiếu (Linh kiện toàn quốc còn ít không xin được / Chờ lâu...)"
                                >
                                  <Ban className="w-2.5 h-2.5 text-rose-600" />
                                  <span>Đóng phiếu</span>
                                </button>
                              </div>
                            )}
                            {item.status === 'da_xin_lk' && (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatus(item, 'da_nhap_kho')}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Chuyển sang Bước 3: Đã nhập kho"
                                >
                                  <Boxes className="w-3 h-3" />
                                  <span>3. Nhập kho</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(item, 'close_no_repair', 'cho_lau_khach_huy')}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Đóng & hoàn tất phiếu (Thời gian chờ lâu khách hủy / Khách đổi ý...)"
                                >
                                  <Ban className="w-2.5 h-2.5 text-rose-600" />
                                  <span>Đóng phiếu</span>
                                </button>
                              </div>
                            )}
                            {item.status === 'da_nhap_kho' && (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(item)}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Hàng đã về kho, bấm để gọi khách lên"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>4. Gọi khách</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(item, 'close_no_repair', 'khach_khong_len')}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Đóng hoàn tất phiếu nếu khách không lên nhận máy / không thay"
                                >
                                  <Ban className="w-2.5 h-2.5 text-rose-600" />
                                  <span>Đóng</span>
                                </button>
                              </div>
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
                                  onClick={() => handleAdvanceStatus(item, 'da_hoan_tat')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all animate-bounce"
                                  title="Khách đã lên nhận máy thay xong"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>5. Khách lên (Xong)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenCompleteModal(
                                      item,
                                      'close_no_repair',
                                      checkOverdue7Days(item).isOverdue ? 'qua_7_ngay_tu_dong' : 'khach_khong_len'
                                    )
                                  }
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                                  title="Đóng hoàn tất phiếu nếu khách không lên nhận máy / từ chối thay"
                                >
                                  <Ban className="w-2.5 h-2.5 text-rose-600" />
                                  <span>Đóng</span>
                                </button>
                              </div>
                            )}
                            {item.status === 'da_hoan_tat' && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Hoàn tất ({item.closureBy || 'KTV'})</span>
                              </span>
                            )}
                            {item.status === 'da_bo_mau' && (
                              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                                <Ban className="w-3 h-3 text-rose-600" />
                                <span>Bỏ mẫu</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 9. Thao Tác */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            {/* Call modal */}
                            <button
                              type="button"
                              onClick={() => handleOpenCallModal(item)}
                              className="p-1 text-neutral-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors cursor-pointer"
                              title="Gọi điện / xem lịch sử gọi KH"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </button>

                            {/* Print label */}
                            <button
                              type="button"
                              onClick={() => printShortageLabel(item)}
                              className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                              title="In tem phiếu 3x2"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit modal */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="Chỉnh sửa thông tin phiếu"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Expand/Collapse Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleExpandTicket(item.id)}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                isExpanded
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={isExpanded ? 'Thu gọn chi tiết' : 'Mở rộng xem toàn bộ chi tiết linh kiện, timeline'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Delete or Cancel Request */}
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteOrCancel(item)}
                                className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Xóa phiếu đặt chờ này (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : item.cancelRequested ? (
                              <span
                                className="text-[10px] text-amber-600 font-bold px-1"
                                title="Đang chờ Admin duyệt hủy"
                              >
                                ⏳
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteOrCancel(item)}
                                className="p-1 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                title="Gửi yêu cầu hủy phiếu lên Admin"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED ROW: Full Detailed Layout */}
                      {isExpanded && (
                        <tr className="bg-neutral-50/70 border-b border-neutral-200">
                          <td colSpan={9} className="p-4">
                            <div className="space-y-3">
                {/* Shortage warning banner for chua_xin_du_lk status */}
                {item.status === 'chua_xin_du_lk' && (
                  <div className="p-2.5 bg-orange-50 border border-orange-300 rounded-lg flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-orange-950 font-bold">
                      <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>Trạng thái: 2a. Chưa xin đủ linh kiện do hỏng nhiều món nhưng kho trung tâm còn thiếu.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(item, 'da_xin_lk')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded transition-colors shrink-0 shadow-2xs cursor-pointer"
                    >
                      ➔ Đã bổ sung xin đủ LK
                    </button>
                  </div>
                )}
                {item.cancelRequested && (
                  <div className="p-3 bg-amber-50 border-2 border-amber-400 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-amber-200/80 rounded-md text-amber-900 shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700 animate-bounce" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-amber-950 text-xs">
                            ⚠️ YÊU CẦU HỦY PHIẾU TỪ NHÂN VIÊN:
                          </span>
                          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-bold rounded text-[11px] border border-amber-300">
                            👤 {item.cancelRequestedBy || 'Kỹ thuật viên'}
                          </span>
                          {item.cancelRequestedAt && (
                            <span className="text-[10px] text-amber-800 font-medium">
                              🕒 {item.cancelRequestedAt}
                            </span>
                          )}
                        </div>
                        <p className="text-amber-900 text-xs mt-1 bg-amber-100/70 px-2 py-1 rounded border border-amber-200/80">
                          <strong>Lý do yêu cầu hủy:</strong> <em>"{item.cancelReason || 'Nhân viên không ghi chú'}"</em>
                        </p>
                      </div>
                    </div>
                    {isAdmin ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdminApproveCancelOrDelete(item)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer transition-colors flex items-center gap-1"
                          title="Phê duyệt yêu cầu hủy và xóa vĩnh viễn phiếu này"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>✓ Duyệt Hủy & Xóa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminRejectCancelRequest(item)}
                          className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
                          title="Bác bỏ yêu cầu hủy và giữ lại phiếu"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>✕ Bác Bỏ</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-amber-800 font-bold bg-amber-100 px-2 py-1 rounded-md border border-amber-200">
                        ⏳ Đang chờ Quản trị viên (Admin) xem xét & phê duyệt...
                      </span>
                    )}
                  </div>
                )}

                {item.editRequested && (
                  <div className="p-3 bg-blue-50 border-2 border-blue-400 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-blue-200/80 rounded-md text-blue-900 shrink-0 mt-0.5">
                        <Edit3 className="w-4 h-4 text-blue-700 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-blue-950 text-xs">
                            📝 YÊU CẦU CHỈNH SỬA TỪ NHÂN VIÊN:
                          </span>
                          <span className="px-2 py-0.5 bg-blue-200 text-blue-900 font-bold rounded text-[11px] border border-blue-300">
                            👤 {item.editRequestedBy || 'Kỹ thuật viên'}
                          </span>
                          {item.editRequestedAt && (
                            <span className="text-[10px] text-blue-800 font-medium">
                              🕒 {new Date(item.editRequestedAt).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                        <p className="text-blue-900 text-xs mt-1 bg-blue-100/70 px-2 py-1 rounded border border-blue-200/80">
                          <strong>Lý do xin sửa:</strong> <em>"{item.editReason || 'Không ghi chú'}"</em>
                        </p>
                      </div>
                    </div>
                    {isAdmin ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditReviewModalItem(item)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer transition-colors flex items-center gap-1"
                          title="Xem chi tiết thông tin đề xuất và duyệt"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Xem & Duyệt Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminRejectEditRequest(item)}
                          className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
                          title="Bác bỏ yêu cầu sửa"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Bác Bỏ</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-blue-800 font-bold bg-blue-100 px-2 py-1 rounded-md border border-blue-200">
                        ⏳ Đang chờ Quản trị viên (Admin) xem xét & phê duyệt...
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Main Ticket and Part Info */}
                  <div className="space-y-2 flex-1">
                    {/* Ticket Header & Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectItem(item.id)}
                        className="text-neutral-500 hover:text-indigo-600 cursor-pointer p-0.5 transition-colors"
                        title="Chọn phiếu này"
                      >
                        {selectedIds.includes(item.id) ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-300" />
                        )}
                      </button>

                      <div className="flex items-center gap-1 font-mono font-bold text-xs text-emerald-700">
                        {(() => {
                          const globalStt = ticketSttMap.get(item.id);
                          const stepStt = currentFilteredSttMap?.get(item.id);
                          const isFiltered = Boolean(
                            currentFilteredSttMap &&
                            (statusFilter !== 'all' || searchTerm.trim() || selectedDuplicatePartKey || showDuplicateFilterOnly)
                          );
                          const displayStt = isFiltered ? (stepStt ?? globalStt) : globalStt;

                          if (isFiltered && globalStt !== undefined) {
                            return (
                              <span
                                className="font-mono font-bold text-[11px] text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 flex items-center gap-1"
                                title={`STT trong tab #${displayStt} | STT gốc #${globalStt}`}
                              >
                                <span>STT #{displayStt ?? (idx + 1)}</span>
                                <span className="text-slate-400">|</span>
                                <span className="text-slate-600 font-semibold">Gốc #{globalStt}</span>
                              </span>
                            );
                          }
                          return (
                            <span
                              className="font-mono font-bold text-[11px] text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200"
                              title={`STT #${displayStt}`}
                            >
                              STT #{displayStt ?? (idx + 1)}
                            </span>
                          );
                        })()}
                        <span>{item.ticketNumber}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.ticketNumber, `ticket-${item.id}`, 'Đã chép số phiếu')}
                          title="Sao chép số phiếu"
                          className="hover:text-emerald-900 p-0.5 cursor-pointer"
                        >
                          {copiedId === `ticket-${item.id}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-emerald-600" />
                          )}
                        </button>
                      </div>

                      {/* Multi-part Indicator Badge */}
                      {ticketGroupMap[item.ticketNumber?.trim().toUpperCase()]?.length > 1 && (
                        <span className="text-[10px] font-black text-amber-900 bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1" title="Khách này yêu cầu nhiều linh kiện khác nhau">
                          <Layers className="w-3 h-3 text-amber-800" />
                          <span>Gồm {ticketGroupMap[item.ticketNumber?.trim().toUpperCase()].length} LK</span>
                        </span>
                      )}

                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusConfig.badgeBg}`}
                      >
                        {statusConfig.label}
                      </span>

                      {/* Top Collapse Button inside Header */}
                      <button
                        type="button"
                        onClick={() => handleToggleExpandTicket(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs ml-auto"
                        title="Thu gọn phiếu về dạng tóm tắt"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-stone-600" />
                        <span>Thu gọn</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Ngày đặt chờ */}
                      <span className="text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Đặt: <strong>{getBookingDateWithTime(item)}</strong></span>
                      </span>

                      {/* Ngày / Thời gian đã xin linh kiện (Vị trí khoanh đỏ ngay bên cạnh ô Đặt) */}
                      {(() => {
                        const reqDate = getRequestedDate(item);
                        if (!reqDate) return null;
                        return (
                          <span
                            className="text-xs text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 font-medium"
                            title="Thời gian đã xin linh kiện"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            <span>Đã xin: <strong>{reqDate}</strong></span>
                          </span>
                        );
                      })()}

                      {item.location && (
                        <span className="text-[11px] font-black text-neutral-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <span>Kệ: {item.location}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.location || '', `loc-${item.id}`, 'Đã chép mã kệ')}
                            title="Sao chép mã kệ"
                            className="hover:text-indigo-600 text-neutral-400 p-0.5 cursor-pointer"
                          >
                            {copiedId === `loc-${item.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </span>
                      )}

                      {/* Duplicate Part Indicator Chip for this Ticket */}
                      {bookingDuplicateGroupsMap[item.id]?.map((dupGroup) => {
                        const isFilteredThis = selectedDuplicatePartKey === dupGroup.key;
                        return (
                          <button
                            key={dupGroup.key}
                            type="button"
                            onClick={() => {
                              if (isFilteredThis) {
                                setSelectedDuplicatePartKey(null);
                                setStatusFilter('all');
                                onShowToast('Đã bỏ lọc linh kiện trùng', 'info');
                              } else {
                                setSelectedDuplicatePartKey(dupGroup.key);
                                setStatusFilter('all');
                                onShowToast(`Đang lọc ${dupGroup.ticketCount} phiếu đặt trùng linh kiện "${dupGroup.partName}"`, 'info');
                              }
                            }}
                            className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 transition-all cursor-pointer border ${
                              isFilteredThis
                                ? 'bg-indigo-700 text-white border-indigo-800 shadow-2xs ring-2 ring-indigo-400'
                                : 'bg-purple-100/90 text-purple-950 border-purple-300 hover:bg-purple-200'
                            }`}
                            title={`Linh kiện [${dupGroup.partName}] có ${dupGroup.ticketCount} khách đặt trùng (tổng ${dupGroup.totalQuantity} cái). Bấm để lọc các phiếu này.`}
                          >
                            <Layers className="w-3 h-3 text-purple-700" />
                            <span>Trùng LK ({dupGroup.ticketCount} khách / {dupGroup.totalQuantity} cái)</span>
                          </button>
                        );
                      })}

                      {item.isCustomerCallHold && (
                        item.status === 'da_hoan_tat' ? (
                          <span className="text-[11px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1 shrink-0" title="Khách gọi đặt giữ linh kiện trước - Khách lên đã xử lý xong (Bước 5)">
                            <PhoneCall className="w-3 h-3 text-blue-600" />
                            <span>{item.isCompletedWithoutRepair ? '🚫 GỌI ĐẶT (ĐÃ ĐÓNG)' : '📞 GỌI ĐẶT (KHÁCH LÊN ĐÃ XỬ LÝ XONG)'}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-black text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded flex items-center gap-1 shrink-0 shadow-2xs" title="Khách hàng gọi điện đặt giữ linh kiện trước (Khách chưa lên)">
                            <PhoneCall className="w-3 h-3 text-blue-700" />
                            <span>{item.hasAvailableParts ? '📞 GỌI ĐẶT (SẴN LK - KHÁCH CHƯA LÊN)' : '📞 GỌI ĐẶT (KHÁCH CHƯA LÊN)'}</span>
                          </span>
                        )
                      )}

                      {item.customerKeepsPart ? (
                        item.status === 'da_hoan_tat' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenConvertToSvdModal(item)}
                            className="text-[11px] font-bold text-fuchsia-900 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                            title="Khách đặt giữ linh kiện Ngày Dịch Vụ SVD - Khách lên đã xử lý xong (Bấm để xem/chỉnh sửa)"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-fuchsia-600" />
                            <span>{item.isCompletedWithoutRepair ? 'ĐẶT GIỮ SVD (ĐÃ ĐÓNG)' : 'ĐẶT GIỮ SVD (ĐÃ XỬ LÝ)'}</span>
                          </button>
                        ) : (
                          (() => {
                            const svdProg = checkSvdMultiDayAppointmentProgress(item);
                            const monthSuffix = svdProg.targetSvdMonth ? ` T${svdProg.targetSvdMonth}` : '';
                            return (
                              <button
                                type="button"
                                onClick={() => handleOpenConvertToSvdModal(item)}
                                className="text-[11px] font-bold text-purple-900 bg-purple-50 border border-purple-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 shadow-2xs hover:bg-purple-100 transition-colors cursor-pointer"
                                title={`Khách đặt giữ linh kiện Ngày Dịch Vụ SVD ${svdProg.targetSvdLabel || '(10-12 hằng tháng)'} - Bấm để chỉnh sửa/quản lý SVD`}
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                <span>{item.hasAvailableParts ? `ĐẶT GIỮ SVD${monthSuffix} (SẴN LK - CHƯA LÊN)` : `ĐẶT GIỮ SVD${monthSuffix} (CHƯA LÊN)`}</span>
                              </button>
                            );
                          })()
                        )
                      ) : (
                        item.status !== 'da_hoan_tat' && (
                          <button
                            type="button"
                            onClick={() => handleOpenConvertToSvdModal(item)}
                            className="text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs"
                            title="Khách muốn áp dụng khuyến mãi Ngày Dịch Vụ SVD - Bấm để chuyển sang Đặt giữ SVD từ bước hiện tại"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            <span>+ Đổi sang Đặt giữ SVD</span>
                          </button>
                        )
                      )}
                    </div>

                    {/* SVD 1-Day Urgent Pending Warning Banner for this item */}
                    {checkSvdPending3Days(item).isSvdPending3Days && (
                      <div className="mb-2 p-2.5 bg-amber-50 text-amber-950 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs border border-amber-300 shadow-2xs">
                        <div className="flex items-center gap-2 text-amber-900 font-medium">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>Cảnh báo SVD:</strong> Phiếu này khách đặt giữ SVD đã <strong>{checkSvdPending3Days(item).daysPending} ngày</strong> ở Bước 1 chưa chuyển sang Bước 2 xin linh kiện!
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(item, 'da_xin_lk')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded transition-colors shrink-0 shadow-2xs cursor-pointer"
                        >
                          ➔ Tiến hành xin LK SVD
                        </button>
                      </div>
                    )}

                    {/* SVD Multi-Day (10-12) Appointment Follow-up Reminder Banner */}
                    {(() => {
                      const svdProgress = checkSvdMultiDayAppointmentProgress(item);
                      if (!svdProgress.isSvdBooking) return null;

                      // Nếu trước đợt SVD mục tiêu (chưa đến ngày 10 của tháng SVD): Hiển thị thông báo tiến độ chờ đợt SVD
                      if (!svdProgress.hasReminder) {
                        if (svdProgress.stage === 'before_svd' && svdProgress.hasPartsReady) {
                          return (
                            <div className="mb-2.5 p-2.5 rounded-xl border border-purple-200 bg-purple-50/80 text-purple-950 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1.5 rounded-lg bg-purple-200/80 text-purple-800 shrink-0">
                                  <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-xs text-purple-900">{svdProgress.title}</span>
                                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                      {svdProgress.actionRecommendation}
                                    </span>
                                  </div>
                                  <p className="text-[11.5px] text-purple-900/90 leading-relaxed">{svdProgress.message}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenCallModal(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-lg transition-all cursor-pointer shadow-2xs shrink-0 ml-auto"
                                title="Ghi chú / Gọi báo khách"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>+ Ghi nhận gọi khách</span>
                              </button>
                            </div>
                          );
                        }
                        return null;
                      }

                      return (
                        <div
                          className={`mb-2.5 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-2xs ${
                            svdProgress.stage === 'after_svd_ended'
                              ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                              : svdProgress.stage === 'day_12'
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : svdProgress.stage === 'day_11'
                              ? 'bg-orange-50 border-orange-200 text-orange-950'
                              : 'bg-amber-50 border-amber-200 text-amber-950'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div
                              className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                svdProgress.isUrgent
                                  ? 'bg-rose-200/80 text-rose-800'
                                  : 'bg-amber-200/80 text-amber-800'
                              }`}
                            >
                              <PhoneCall className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-[13px]">{svdProgress.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                                    svdProgress.isUrgent
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : 'bg-amber-100 text-amber-800 border-amber-300'
                                  }`}
                                >
                                  {svdProgress.actionRecommendation}
                                </span>
                              </div>
                              <p className="text-xs opacity-90 leading-relaxed">{svdProgress.message}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenCallModal(item);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                              title="Ghi nhận cuộc gọi nhắc SVD cho khách"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>+ Ghi nhận gọi khách</span>
                            </button>

                            {svdProgress.stage === 'after_svd_ended' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(item, 'close_no_repair', 'khach_khong_len_svd')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                                  title="Đóng phiếu do khách không lên thay trong đợt Ngày Dịch Vụ SVD (tránh treo phiếu)"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Đóng phiếu (Không thay)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExtendSvdNextMonth(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-2xs"
                                  title="Gia hạn chờ khách sang đợt Ngày Dịch Vụ SVD (10-12) tháng sau"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Chờ đợt SVD sau</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 1 Aging Warning Banner */}
                    {(() => {
                      const check = checkStep1AgingWarning(item);
                      if (!check.hasWarning) return null;
                      return (
                        <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-rose-950 font-bold">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
                            <span>
                              ⏳ Cảnh báo Bước 1: Phiếu đã tạo được <strong>{check.daysPassed} ngày</strong> nhưng chưa chuyển sang Bước 2!
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(item, 'da_xin_lk')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded transition-colors shrink-0 cursor-pointer shadow-2xs"
                          >
                            Chuyển Bước 2
                          </button>
                        </div>
                      );
                    })()}

                    {/* Step 2 Aging Warning Banner */}
                    {(() => {
                      const check = checkStep2AgingWarning(item);
                      if (!check.hasWarning) return null;
                      return (
                        <div className={`mb-2 p-2.5 border rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs ${
                          check.warningLevel === 2 
                            ? 'bg-rose-100 border-rose-400 text-rose-950 font-extrabold' 
                            : 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                        }`}>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={`w-4 h-4 shrink-0 ${check.warningLevel === 2 ? 'text-rose-600 animate-pulse' : 'text-amber-600'}`} />
                            <span>
                              {check.warningLevel === 2 ? (
                                <span>🚨 Cảnh báo Bước 2 (Lần 2): Linh kiện đã xin quá <strong>{check.daysPassed} ngày</strong> vẫn chưa nhập kho!</span>
                              ) : (
                                <span>⚠️ Cảnh báo Bước 2 (Lần 1): Linh kiện đã xin quá <strong>{check.daysPassed} ngày</strong> chưa về kho!</span>
                              )}
                            </span>
                          </div>
                          {check.warningLevel === 1 && (
                            <button
                              type="button"
                              onClick={() => handleExtendStep2(item)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded transition-colors shrink-0 cursor-pointer shadow-2xs"
                            >
                              Xác nhận tiếp tục (+2 ngày)
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Step 3 Aging Warning Banner */}
                    {(() => {
                      const check = checkStep3AgingWarning(item);
                      if (!check.hasWarning) return null;
                      return (
                        <div className="mb-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-purple-950 font-bold">
                            <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                            <span>
                              📞 Cảnh báo Bước 3: Linh kiện nhập kho đã <strong>{check.daysPassed} ngày</strong> nhưng chưa gọi báo khách!
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickStamp(item, 'call')}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded transition-colors shrink-0 cursor-pointer shadow-2xs"
                          >
                            Gọi khách ngay
                          </button>
                        </div>
                      );
                    })()}

                    {/* Parts List Section (Single or Multi-part per ticket) */}
                    {(() => {
                      const parts: ShortagePartSubItem[] = getNormalizedBookingParts(item);
                      const calc = calculateShortageStatusFromParts(parts, item.status, !!item.customerKeepsPart);

                      return (
                        <div className="bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-200/90 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                              <Boxes className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>
                                {parts.length > 1
                                  ? `Danh sách LK cần xin (${calc.totalRequestedQty}/${calc.totalRequiredQty} đã xin, ${calc.totalStockedQty}/${calc.totalRequiredQty} đã về kho):`
                                  : calc.totalRequiredQty > 1
                                  ? `Linh kiện đặt chờ (Cần: ${calc.totalRequiredQty} cái - Đã xin: ${calc.totalRequestedQty}/${calc.totalRequiredQty} • Đã về kho: ${calc.totalStockedQty}/${calc.totalRequiredQty}):`
                                  : 'Linh kiện đặt chờ:'}
                              </span>
                            </span>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                                  calc.isFullyRequested
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : calc.totalRequestedQty > 0
                                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                                    : 'bg-neutral-200/70 text-neutral-700 border-neutral-300'
                                }`}
                              >
                                {calc.isFullyRequested
                                  ? '✓ Đã xin đủ LK'
                                  : calc.totalRequestedQty > 0
                                  ? `⏳ Chưa xin đủ (${calc.totalRequestedQty}/${calc.totalRequiredQty} cái - Bước 2a)`
                                  : 'Chưa xin LK nào'}
                              </span>

                              <span
                                className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                                  calc.isFullyStocked
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : calc.totalStockedQty > 0
                                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                                    : 'bg-neutral-200/70 text-neutral-600 border-neutral-300'
                                }`}
                              >
                                {calc.isFullyStocked
                                  ? '📦 Đã về đủ kho (Bước 3)'
                                  : calc.totalStockedQty > 0
                                  ? `⏳ Đã nhận ${calc.totalStockedQty}/${calc.totalRequiredQty} cái (${calc.isFullyRequested ? 'Chưa đủ LK - Bước 3a' : 'Chưa xin đủ LK - Bước 2a'})`
                                  : 'Chưa có LK nào về kho'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {parts.map((part, pIdx) => {
                              const partKey = part.id || String(pIdx);
                              const partQty = Math.max(1, part.quantity || 1);
                              const partReqQty = typeof part.requestedQuantity === 'number'
                                ? Math.max(0, Math.min(partQty, part.requestedQuantity))
                                : (part.isRequested ? partQty : 0);
                              const partStockQty = typeof part.stockedInQuantity === 'number'
                                ? Math.max(0, Math.min(partQty, part.stockedInQuantity))
                                : (part.isStockedIn ? partQty : 0);
                              const isPartReqFull = partReqQty >= partQty;
                              const isPartStockFull = partStockQty >= partQty;

                              return (
                                <div
                                  key={partKey}
                                  className={`p-2 rounded-lg border transition-all flex flex-col md:flex-row md:items-center justify-between gap-2.5 group/part ${
                                    isPartStockFull
                                      ? 'bg-purple-50/80 border-purple-300 text-purple-950'
                                      : isPartReqFull
                                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                                      : partReqQty > 0 || partStockQty > 0
                                      ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                                      : 'bg-white border-neutral-200/90 text-neutral-900 shadow-2xs'
                                  }`}
                                >
                                  {/* Part Name, Code & Model */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {parts.length > 1 && (
                                        <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
                                          #{pIdx + 1}
                                        </span>
                                      )}
                                      <span className="font-extrabold text-sm text-neutral-900 inline-flex items-center gap-1">
                                        <span>{part.partName || 'Linh kiện chưa đặt tên'}</span>
                                        {part.partName && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCopy(
                                                part.partName,
                                                `name-${item.id}-${pIdx}`,
                                                'Đã chép tên linh kiện'
                                              )
                                            }
                                            title="Sao chép tên linh kiện"
                                            className="hover:text-indigo-600 text-neutral-400 p-0.5 cursor-pointer"
                                          >
                                            {copiedId === `name-${item.id}-${pIdx}` ? (
                                              <Check className="w-3 h-3 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                          </button>
                                        )}
                                      </span>

                                      {/* Quantity Badge */}
                                      <span
                                        className={`text-[11px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                          partQty > 1
                                            ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-2xs font-bold'
                                            : 'bg-neutral-100 text-neutral-800 border-neutral-300'
                                        }`}
                                        title={`Số lượng linh kiện yêu cầu: ${partQty}`}
                                      >
                                        <span>SL:</span>
                                        <span className="font-mono text-xs font-black">{partQty}</span>
                                      </span>

                                      {/* Progress indicators if multi quantity */}
                                      {partQty > 1 && (
                                        <>
                                          <span
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono ${
                                              isPartReqFull
                                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                : partReqQty > 0
                                                ? 'bg-amber-100 text-amber-950 border-amber-300'
                                                : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                                            }`}
                                            title={`Số lượng đã xin: ${partReqQty}/${partQty}`}
                                          >
                                            Xin: {partReqQty}/{partQty}
                                          </span>
                                          <span
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono ${
                                              isPartStockFull
                                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                                : partStockQty > 0
                                                ? 'bg-amber-100 text-amber-950 border-amber-300'
                                                : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                                            }`}
                                            title={`Số lượng đã về kho: ${partStockQty}/${partQty}`}
                                          >
                                            Kho: {partStockQty}/{partQty}
                                          </span>
                                        </>
                                      )}

                                      {(part.model || item.model) && (
                                        <span className="text-[11px] bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1">
                                          <span>Model: {part.model || item.model}</span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCopy(
                                                part.model || item.model || '',
                                                `model-${item.id}-${pIdx}`,
                                                'Đã chép Model'
                                              )
                                            }
                                            title="Sao chép Model"
                                            className="hover:text-indigo-600 text-neutral-400 p-0.5 cursor-pointer"
                                          >
                                            {copiedId === `model-${item.id}-${pIdx}` ? (
                                              <Check className="w-3 h-3 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                          </button>
                                        </span>
                                      )}
                                      {isPartStockFull && (
                                        <span className="text-[10px] bg-purple-200 text-purple-900 font-bold px-1.5 py-0.5 rounded border border-purple-300 flex items-center gap-1">
                                          <Boxes className="w-3 h-3 text-purple-700" />
                                          <span>✓ ĐÃ VỀ KHO</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-neutral-600 mt-0.5 font-mono">
                                      <span>
                                        Mã LK:{' '}
                                        <strong className="text-neutral-900">
                                          {part.partCode || 'N/A'}
                                        </strong>
                                      </span>
                                      {part.partCode && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCopy(
                                              part.partCode,
                                              `code-${item.id}-${pIdx}`,
                                              'Đã chép mã LK'
                                            )
                                          }
                                          title="Sao chép mã LK"
                                          className="hover:text-indigo-600 text-neutral-400 p-0.5 cursor-pointer"
                                        >
                                          {copiedId === `code-${item.id}-${pIdx}` ? (
                                            <Check className="w-3 h-3 text-emerald-600" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                      {/* Nút check tồn mã linh kiện như hình 2 */}
                                      {part.partCode && (
                                        <button
                                          type="button"
                                          onClick={() => handleCheckStock(part.partCode)}
                                          className={`p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 rounded transition-all cursor-pointer items-center justify-center hover:scale-105 shadow-2xs shrink-0 ${
                                            showStockCheckButton
                                              ? 'inline-flex'
                                              : 'hidden group-hover/part:inline-flex'
                                          }`}
                                          title={`Check tồn kho mã ${part.partCode} trên GCSM (${GCSM_STOCK_URL})`}
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Interactive Quantity-Aware Action Buttons for each part */}
                                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                    {partQty === 1 ? (
                                      <>
                                        {/* 1. Xin LK Button for quantity = 1 */}
                                        <button
                                          type="button"
                                          onClick={() => handleTogglePartRequested(item, partKey)}
                                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-[11px] border cursor-pointer select-none transition-all ${
                                            isPartReqFull
                                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs hover:bg-emerald-700'
                                              : 'bg-neutral-100 hover:bg-amber-100 text-neutral-700 hover:text-amber-900 border-neutral-300'
                                          }`}
                                          title={
                                            isPartReqFull
                                              ? 'Bấm để bỏ đánh dấu (Chưa xin mã này)'
                                              : 'Bấm để tích chọn (Đã xin LK mã này)'
                                          }
                                        >
                                          {isPartReqFull ? (
                                            <>
                                              <CheckSquare className="w-3.5 h-3.5 text-white" />
                                              <span>Đã xin</span>
                                            </>
                                          ) : (
                                            <>
                                              <Square className="w-3.5 h-3.5 text-neutral-400" />
                                              <span>Chưa xin</span>
                                            </>
                                          )}
                                        </button>

                                        {/* 2. Nhận Kho Button for quantity = 1 */}
                                        <button
                                          type="button"
                                          onClick={() => handleTogglePartStockedIn(item, partKey)}
                                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-[11px] border cursor-pointer select-none transition-all ${
                                            isPartStockFull
                                              ? 'bg-purple-600 text-white border-purple-700 shadow-2xs hover:bg-purple-700'
                                              : 'bg-neutral-100 hover:bg-purple-100 text-neutral-700 hover:text-purple-900 border-neutral-300'
                                          }`}
                                          title={
                                            isPartStockFull
                                              ? 'Bấm để hủy ghi nhận đã về kho cho linh kiện này'
                                              : 'Bấm để tích chọn đã nhận linh kiện này về kho'
                                          }
                                        >
                                          {isPartStockFull ? (
                                            <>
                                              <Boxes className="w-3.5 h-3.5 text-white" />
                                              <span>✓ Đã nhận LK</span>
                                            </>
                                          ) : (
                                            <>
                                              <Boxes className="w-3.5 h-3.5 text-neutral-400" />
                                              <span>+ Nhận LK này</span>
                                            </>
                                          )}
                                        </button>
                                      </>
                                    ) : (
                                      /* Advanced Quantity Controls when partQty >= 2 */
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {/* Phần Xin LK */}
                                        <div className="flex items-center gap-1 bg-white border border-neutral-300 rounded-lg p-1 shadow-2xs">
                                          <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 px-1">Xin LK:</span>
                                            <span
                                              className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${
                                                partReqQty === 0
                                                  ? 'bg-neutral-100 text-neutral-600 border-neutral-300'
                                                  : partReqQty < partQty
                                                  ? 'bg-amber-100 text-amber-950 border-amber-300 animate-pulse'
                                                  : 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                              }`}
                                            >
                                              {partReqQty === 0
                                                ? 'Chưa xin'
                                                : partReqQty < partQty
                                                ? `Chưa đủ (${partReqQty}/${partQty})`
                                                : `✓ Đủ (${partReqQty}/${partQty})`}
                                            </span>
                                          </div>

                                          {/* Stepper buttons - / + */}
                                          <div className="flex items-center border border-neutral-300 rounded overflow-hidden bg-neutral-50">
                                            <button
                                              type="button"
                                              disabled={partReqQty <= 0}
                                              onClick={() => handleUpdatePartRequestedQty(item, partKey, Math.max(0, partReqQty - 1))}
                                              className="w-6 h-7 flex items-center justify-center font-black text-sm hover:bg-neutral-200 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer text-neutral-800 transition-colors"
                                              title="Giảm 1 số lượng đã xin"
                                            >
                                              −
                                            </button>
                                            <span className="w-7 text-center text-xs font-mono font-black text-neutral-900 bg-white select-none">
                                              {partReqQty}
                                            </span>
                                            <button
                                              type="button"
                                              disabled={partReqQty >= partQty}
                                              onClick={() => handleUpdatePartRequestedQty(item, partKey, Math.min(partQty, partReqQty + 1))}
                                              className="w-6 h-7 flex items-center justify-center font-black text-sm hover:bg-neutral-200 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer text-neutral-800 transition-colors"
                                              title="Tăng 1 số lượng đã xin"
                                            >
                                              +
                                            </button>
                                          </div>

                                          {/* Fast 1-click Xin đủ / Bỏ xin */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdatePartRequestedQty(
                                                item,
                                                partKey,
                                                partReqQty === partQty ? 0 : partQty
                                              )
                                            }
                                            className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                                              partReqQty === partQty
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            }`}
                                            title={partReqQty === partQty ? 'Bấm để bỏ xin (về 0)' : `Bấm để xin đủ ${partQty} cái`}
                                          >
                                            {partReqQty === partQty ? '✓ Đã xin' : `Xin đủ (${partQty})`}
                                          </button>
                                        </div>

                                        {/* Phần Nhận Linh Kiện Về Kho */}
                                        <div className="flex items-center gap-1 bg-white border border-neutral-300 rounded-lg p-1 shadow-2xs">
                                          <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-purple-700 px-1">Về kho:</span>
                                            <span
                                              className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${
                                                partStockQty === 0
                                                  ? 'bg-neutral-100 text-neutral-600 border-neutral-300'
                                                  : partStockQty < partQty
                                                  ? 'bg-amber-100 text-amber-950 border-amber-300 animate-pulse'
                                                  : 'bg-purple-100 text-purple-950 border-purple-300'
                                              }`}
                                            >
                                              {partStockQty === 0
                                                ? 'Chưa nhận'
                                                : partStockQty < partQty
                                                ? `Chưa đủ (${partStockQty}/${partQty})`
                                                : `✓ Đủ (${partStockQty}/${partQty})`}
                                            </span>
                                          </div>

                                          {/* Stepper buttons - / + */}
                                          <div className="flex items-center border border-neutral-300 rounded overflow-hidden bg-neutral-50">
                                            <button
                                              type="button"
                                              disabled={partStockQty <= 0}
                                              onClick={() => handleUpdatePartStockedQty(item, partKey, Math.max(0, partStockQty - 1))}
                                              className="w-6 h-7 flex items-center justify-center font-black text-sm hover:bg-neutral-200 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer text-neutral-800 transition-colors"
                                              title="Giảm 1 số lượng đã nhận về kho"
                                            >
                                              −
                                            </button>
                                            <span className="w-7 text-center text-xs font-mono font-black text-neutral-900 bg-white select-none">
                                              {partStockQty}
                                            </span>
                                            <button
                                              type="button"
                                              disabled={partStockQty >= partQty}
                                              onClick={() => handleUpdatePartStockedQty(item, partKey, Math.min(partQty, partStockQty + 1))}
                                              className="w-6 h-7 flex items-center justify-center font-black text-sm hover:bg-neutral-200 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer text-neutral-800 transition-colors"
                                              title="Tăng 1 số lượng đã nhận về kho"
                                            >
                                              +
                                            </button>
                                          </div>

                                          {/* Fast 1-click Nhận đủ / Bỏ nhận */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdatePartStockedQty(
                                                item,
                                                partKey,
                                                partStockQty === partQty ? 0 : partQty
                                              )
                                            }
                                            className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                                              partStockQty === partQty
                                                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-2xs'
                                                : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300'
                                            }`}
                                            title={partStockQty === partQty ? 'Bấm để hủy nhận về kho (về 0)' : `Bấm để nhận đủ ${partQty} cái`}
                                          >
                                            {partStockQty === partQty ? '✓ Đã nhận' : `+ Nhận đủ (${partQty})`}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Customer Info & Time Status Badges */}
                    <div className="flex flex-wrap items-center gap-2 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-xs">
                      {/* Creator Info (User Tạo & KT Tạo Phiếu) */}
                      <button
                        type="button"
                        onClick={() => handleOpenQuickAssignTech(item)}
                        className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-950 px-2.5 py-1 rounded-md text-xs font-semibold shadow-2xs hover:bg-indigo-100 cursor-pointer transition-all"
                        title="Bấm để cập nhật KTV tạo & User tạo phiếu"
                      >
                        <UserCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>
                          Tạo bởi: <strong className="text-indigo-900 font-bold">{item.createdBy || 'Hệ thống'}</strong>
                          {item.creatorTechnician ? (
                            <span className="text-indigo-800 font-semibold ml-1.5">
                              • KT Tạo: <strong className="text-indigo-950 font-extrabold">{item.creatorTechnician}</strong>
                            </span>
                          ) : (
                            <span className="text-neutral-500 font-normal italic ml-1.5 opacity-80">
                              • KT Tạo: Chưa chọn
                            </span>
                          )}
                        </span>
                        <Edit2 className="w-3 h-3 text-indigo-500 ml-1 opacity-70 hover:opacity-100" />
                      </button>

                      {/* Technician Info (Kỹ thuật sửa chữa / xử lý) */}
                      <button
                        type="button"
                        onClick={() => handleOpenQuickAssignTech(item)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border shadow-2xs transition-all cursor-pointer ${
                          item.technicianName
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold hover:bg-emerald-100'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200'
                        }`}
                        title="Bấm để phân công hoặc đổi kỹ thuật sửa chữa"
                      >
                        <Wrench className={`w-3.5 h-3.5 ${item.technicianName ? 'text-emerald-700' : 'text-neutral-400'} shrink-0`} />
                        <span>Kỹ thuật: <strong className={item.technicianName ? 'text-emerald-800 font-bold' : 'text-neutral-500 font-normal italic'}>{item.technicianName || 'Chưa phân công'}</strong></span>
                        <Edit2 className="w-3 h-3 text-neutral-400 hover:text-emerald-700 ml-1 opacity-70 hover:opacity-100" />
                      </button>

                      {/* Customer name & phone */}
                    <div className="flex items-center gap-1 text-neutral-800 font-bold mr-1">
                        <User className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{item.customerName || 'Khách hàng'}</span>
                        {item.customerName && (
                          <button
                            type="button"
                            onClick={() => handleCopy(item.customerName || '', `cname-${item.id}`, 'Đã chép tên khách')}
                            title="Sao chép tên khách"
                            className="text-neutral-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                          >
                            {copiedId === `cname-${item.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {item.customerPhone && (
                        <div className="flex items-center gap-1 mr-2">
                          <a
                            href={`tel:${item.customerPhone}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded cursor-pointer transition-colors text-[11px]"
                            title="Bấm để gọi điện cho khách"
                          >
                            <Phone className="w-3 h-3 text-emerald-700" />
                            <span>{item.customerPhone}</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopy(item.customerPhone, `phone-${item.id}`, 'Đã chép số điện thoại')}
                            title="Sao chép số điện thoại"
                            className="text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                          >
                            {copiedId === `phone-${item.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}

                      {item.isCustomerCallHold && (
                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[11px] border ${
                            item.status === 'da_hoan_tat'
                              ? 'bg-blue-50 border-blue-200 text-blue-800'
                              : 'bg-blue-100 border-blue-300 text-blue-900 shadow-2xs'
                          }`}
                          title={
                            item.status === 'da_hoan_tat'
                              ? 'Phiếu khách gọi đặt trước - Khách lên đã xử lý xong (Bước 5)'
                              : 'Khách gọi đặt giữ linh kiện trước (Khách chưa lên)'
                          }
                        >
                          <PhoneCall className={`w-3 h-3 ${item.status === 'da_hoan_tat' ? 'text-blue-600' : 'text-blue-700 animate-pulse'}`} />
                          <span>
                            {item.status === 'da_hoan_tat'
                              ? 'Khách gọi đặt trước (Khách lên đã xử lý xong)'
                              : 'Khách gọi đặt giữ LK trước (Khách chưa lên)'}
                          </span>
                        </div>
                      )}

                      {item.customerKeepsPart && (
                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[11px] border ${
                            item.status === 'da_hoan_tat'
                              ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900'
                              : 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-950 shadow-2xs'
                          }`}
                          title={
                            item.status === 'da_hoan_tat'
                              ? 'Phiếu đặt giữ Ngày Dịch Vụ SVD - Khách lên đã xử lý xong (Bước 5)'
                              : 'Khách đặt giữ suất ngày dịch vụ SVD (Khách chưa lên)'
                          }
                        >
                          <Sparkles className={`w-3 h-3 ${item.status === 'da_hoan_tat' ? 'text-fuchsia-600' : 'text-fuchsia-700 animate-pulse'}`} />
                          <span>
                            {item.status === 'da_hoan_tat'
                              ? 'Đặt giữ ngày dịch vụ SVD (Khách lên đã xử lý xong)'
                              : 'Đặt giữ ngày dịch vụ SVD (Khách chưa lên)'}
                          </span>
                        </div>
                      )}

                      {/* Thời gian Nhập Kho Badge */}
                      {item.stockedInDate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100/90 text-purple-900 border border-purple-200 text-[11px] font-semibold">
                          <Boxes className="w-3 h-3 text-purple-700" />
                          <span>Nhập kho: <strong>{item.stockedInDate}</strong></span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickStamp(item, 'stock')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-200/60 hover:bg-purple-100 text-neutral-600 hover:text-purple-900 text-[10px] font-medium transition-colors cursor-pointer"
                          title="Ghi nhận giờ nhập kho hiện tại"
                        >
                          <span>+ Nhập kho lúc này</span>
                        </button>
                      )}

                      {/* Thời gian Gọi Khách & Lịch sử các lần gọi Badge */}
                      {(() => {
                        const rawLogs = (item.callLogs && Array.isArray(item.callLogs) && item.callLogs.length > 0)
                          ? item.callLogs
                          : (item.calledCustomerDate
                            ? [{
                                id: `log-legacy-${item.id}`,
                                calledDate: item.calledCustomerDate,
                                subStatus: (item.callSubStatus || 'hen_ngay') as ShortageCallSubStatus,
                                appointmentDate: item.appointmentDate,
                                note: item.callNote,
                              }]
                            : []);

                        if (rawLogs.length === 0) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenCallModal(item)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                              title="Ghi nhận gọi khách hàng và kết quả cuộc gọi"
                            >
                              <PhoneCall className="w-3.5 h-3.5 text-sky-600" />
                              <span>+ Ghi nhận gọi khách</span>
                            </button>
                          );
                        }

                        return (
                          <div className="w-full bg-sky-50/70 border border-sky-200 rounded-xl p-2.5 space-y-2">
                            {/* Header of Call History */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <PhoneCall className="w-4 h-4 text-sky-700 shrink-0" />
                                <span className="text-xs font-black text-sky-950">
                                  Lịch sử các lần gọi khách ({rawLogs.length} lần gọi):
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                                  title="Ghi nhận thêm cuộc gọi mới"
                                >
                                  <Plus className="w-3.5 h-3.5 text-white" />
                                  <span>+ Gọi lại (Thêm lần gọi)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                  title="Mở bảng quản lý và chỉnh sửa chi tiết các lần gọi"
                                >
                                  <Edit3 className="w-3 h-3 text-sky-600" />
                                  <span>Sửa cuộc gọi</span>
                                </button>
                              </div>
                            </div>

                            {/* List of all call logs */}
                            <div className="space-y-1.5">
                              {rawLogs.map((log, lIdx) => {
                                const subStatus = (log.subStatus || 'hen_ngay') as ShortageCallSubStatus;
                                const cfg = SHORTAGE_CALL_SUBSTATUS_CONFIG[subStatus];
                                const isLatest = lIdx === rawLogs.length - 1;

                                return (
                                  <div
                                    key={log.id || lIdx}
                                    onClick={() => handleOpenCallModal(item)}
                                    className={`p-2 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all cursor-pointer hover:border-sky-400 ${
                                      isLatest
                                        ? 'bg-white border-sky-300 shadow-2xs ring-1 ring-sky-200'
                                        : 'bg-white/90 border-neutral-200 text-neutral-700'
                                    }`}
                                    title="Bấm để xem chi tiết hoặc chỉnh sửa lần gọi này"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`px-2 py-0.5 rounded-md font-mono font-black text-[11px] ${
                                          isLatest
                                            ? 'bg-sky-600 text-white shadow-2xs'
                                            : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                                        }`}
                                      >
                                        Lần {lIdx + 1}
                                      </span>

                                      <span className="font-bold text-neutral-900 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-neutral-400" />
                                        <span>{log.calledDate}</span>
                                      </span>

                                      {/* Sub-status badge */}
                                      {cfg && (
                                        <span
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${cfg.badgeBg} ${cfg.textColor} ${cfg.borderColor}`}
                                        >
                                          {subStatus === 'hen_ngay' && <Calendar className="w-3 h-3 text-indigo-700" />}
                                          {subStatus === 'khong_nghe_may' && <PhoneOff className="w-3 h-3 text-amber-700" />}
                                          {subStatus === 'cho_them_thoi_gian' && <Clock className="w-3 h-3 text-blue-700" />}
                                          {subStatus === 'khach_bao_huy' && <XCircle className="w-3 h-3 text-rose-700" />}
                                          <span>{cfg.shortLabel}</span>
                                        </span>
                                      )}

                                      {/* Appointment date */}
                                      {log.appointmentDate && subStatus === 'hen_ngay' && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-600 text-white border border-indigo-700 font-black text-[11px] shadow-2xs">
                                          <Calendar className="w-3 h-3 text-indigo-100" />
                                          <span>Khách hẹn lên: <u>{log.appointmentDate}</u></span>
                                        </span>
                                      )}

                                      {/* Fallback appointment date if status is not hen_ngay but date present */}
                                      {log.appointmentDate && subStatus !== 'hen_ngay' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold text-[11px]">
                                          <Calendar className="w-3 h-3 text-indigo-600" />
                                          <span>Hẹn: {log.appointmentDate}</span>
                                        </span>
                                      )}

                                      {/* Caller name */}
                                      {log.callerName && (
                                        <span className="text-[11px] text-neutral-500 font-medium">
                                          • Người gọi: <strong className="text-neutral-800">{log.callerName}</strong>
                                        </span>
                                      )}
                                    </div>

                                    {/* Call Note */}
                                    {log.note && (
                                      <div
                                        className="text-[11px] text-amber-950 bg-amber-50/90 border border-amber-200 rounded px-2 py-0.5 font-medium flex items-center gap-1 max-w-full sm:max-w-md truncate"
                                        title={`Ghi chú: ${log.note}`}
                                      >
                                        <StickyNote className="w-3 h-3 text-amber-600 shrink-0" />
                                        <span className="truncate">"{log.note}"</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 7-Days Overdue Warning Tag */}
                      {item.status === 'da_goi_kh' && (() => {
                        const overdueInfo = checkOverdue7Days(item);
                        if (overdueInfo.isOverdue) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-black animate-pulse" title="Đã quá 7 ngày kể từ lúc gọi báo có linh kiện">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>⚠️ Quá hạn 7 ngày ({overdueInfo.daysSinceCalled} ngày)</span>
                            </span>
                          );
                        }
                        if (overdueInfo.daysSinceCalled > 0) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-medium">
                              <span>Đã gọi {overdueInfo.daysSinceCalled} ngày trước</span>
                            </span>
                          );
                        }
                        return null;
                      })()}

                      {/* Tiến độ 5: Khách đã lên / Kỹ thuật xử lý HOẶC Đóng hoàn tất Badge */}
                      {item.status === 'da_bo_mau' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-950 border border-rose-300 text-[11px] font-bold">
                          <Ban className="w-3 h-3 text-rose-600" />
                          <span>Linh kiện đã bỏ mẫu (Đóng phiếu)</span>
                        </span>
                      ) : item.status === 'da_hoan_tat' ? (
                        item.isCompletedWithoutRepair ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-950 border border-rose-300 text-[11px] font-bold" title={item.closureNote || item.closureReason || 'Đã đóng do khách không thay'}>
                            <Ban className="w-3 h-3 text-rose-600" />
                            <span>Đã đóng: <strong className="text-rose-700">{item.closureReason || 'Khách không thay'}</strong>{item.closureBy ? ` (Bởi: ${item.closureBy})` : ''}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100/90 text-emerald-950 border border-emerald-300 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Khách lên: <strong>{item.customerArrivedDate || 'Đã lên'}</strong>{item.technicianName ? ` (KT: ${item.technicianName})` : ''}</span>
                          </span>
                        )
                      ) : item.customerArrivedDate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100/90 text-emerald-950 border border-emerald-300 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Khách lên: <strong>{item.customerArrivedDate}</strong>{item.technicianName ? ` (KT: ${item.technicianName})` : ''}</span>
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenCompleteModal(item, 'success_repair')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Ghi nhận khách đã lên & Kỹ thuật đã xử lý thay xong"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>+ Khách đã lên (Thay xong)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCompleteModal(
                                item,
                                'close_no_repair',
                                item.status === 'da_tao_phieu'
                                  ? 'khach_doi_y'
                                  : item.status === 'chua_xin_du_lk'
                                  ? 'toan_quoc_con_it_khong_xin_duoc'
                                  : item.status === 'da_xin_lk'
                                  ? 'cho_lau_khach_huy'
                                  : checkOverdue7Days(item).isOverdue
                                  ? 'qua_7_ngay_tu_dong'
                                  : 'khach_doi_y'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Đóng hoàn tất phiếu (Không xin được LK / Chờ lâu / Khách đổi ý không thay...)"
                          >
                            <Ban className="w-3 h-3 text-rose-600" />
                            <span>Đóng phiếu (Không thay)</span>
                          </button>
                        </div>
                      )}

                      {/* Ghi chú phiếu - Nâng cấp cho tất cả User đều có thể Thêm, Sửa, Xóa */}
                      {item.note ? (
                        <div className="w-full mt-2 pt-1.5 border-t border-neutral-200/70">
                          <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-amber-50/70 hover:bg-amber-50 border border-amber-200/80 transition-all">
                            <div className="flex items-start gap-1.5 flex-1 min-w-0">
                              <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="text-[11px] text-neutral-800 leading-relaxed break-words whitespace-pre-wrap">
                                <span className="font-bold text-amber-950 mr-1">Ghi chú:</span>
                                "{item.note}"
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenNoteModal(item, 'append')}
                                className="px-2 py-0.5 rounded bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Thêm nội dung vào ghi chú này (Tất cả User đều có thể thêm)"
                              >
                                <Plus className="w-3 h-3 text-emerald-600" />
                                <span className="hidden sm:inline">Thêm</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenNoteModal(item, 'edit')}
                                className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Sửa nội dung ghi chú (Tất cả User đều có thể sửa)"
                              >
                                <Edit2 className="w-3 h-3 text-amber-700" />
                                <span className="hidden sm:inline">Sửa</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickDeleteNote(item)}
                                className="p-1 rounded bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 transition-colors cursor-pointer shadow-2xs"
                                title="Xóa ghi chú này (Tất cả User đều có thể xóa)"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full mt-1.5 pt-1 border-t border-dashed border-neutral-200">
                          <button
                            type="button"
                            onClick={() => handleOpenNoteModal(item, 'add')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-neutral-600 hover:text-amber-900 bg-neutral-50 hover:bg-amber-50 border border-dashed border-neutral-300 hover:border-amber-300 transition-all cursor-pointer shadow-2xs"
                            title="Bấm để thêm ghi chú cho phiếu này"
                          >
                            <Plus className="w-3 h-3 text-amber-600" />
                            <span>+ Thêm ghi chú</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center: 5-Step Interactive Progress Bar */}
                  <div className="flex flex-col items-center lg:items-end justify-center gap-2 border-t lg:border-t-0 lg:border-l border-neutral-100 pt-3 lg:pt-0 lg:pl-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 text-center lg:text-right">
                      Tiến độ phiếu (Bấm chuyển bước)
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center lg:justify-end">
                      {/* Step 1 */}
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(item, 'da_tao_phieu')}
                        title="Bước 1: Đã tạo phiếu chờ"
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          item.status === 'da_tao_phieu'
                            ? 'bg-slate-700 text-white border-slate-700 shadow-2xs scale-105'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        1. Tạo phiếu
                      </button>
                      <ArrowRight className="w-2.5 h-2.5 text-neutral-300 shrink-0" />

                      {/* Step 2a: Chưa xin đủ LK */}
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(item, 'chua_xin_du_lk')}
                        title="Bước 2a: Chưa xin đủ linh kiện"
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          item.status === 'chua_xin_du_lk'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs scale-105 animate-pulse'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-amber-50 hover:text-amber-800'
                        }`}
                      >
                        2a. Chưa đủ
                      </button>
                      <ArrowRight className="w-2.5 h-2.5 text-neutral-300 shrink-0" />

                      {/* Step 2 */}
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(item, 'da_xin_lk')}
                        title="Bước 2: Đã xin đủ linh kiện"
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          item.status === 'da_xin_lk'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs scale-105'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-emerald-50 hover:text-emerald-800'
                        }`}
                      >
                        2. Đã xin LK
                      </button>
                      <ArrowRight className="w-2.5 h-2.5 text-neutral-300 shrink-0" />

                      {/* Step 3 */}
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(item, 'da_nhap_kho')}
                        title="Bước 3: Linh kiện đã nhập kho"
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          item.status === 'da_nhap_kho'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs scale-105 animate-pulse'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-indigo-50 hover:text-indigo-800'
                        }`}
                      >
                        3. Nhập kho
                      </button>
                      <ArrowRight className="w-2.5 h-2.5 text-neutral-300 shrink-0" />

                      {/* Step 4 */}
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(item, 'da_goi_kh')}
                        title="Bước 4: Đã gọi khách hàng"
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          item.status === 'da_goi_kh'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs scale-105'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-blue-50 hover:text-blue-800'
                        }`}
                      >
                        4. Gọi KH
                      </button>
                      <ArrowRight className="w-2.5 h-2.5 text-neutral-300 shrink-0" />

                      {/* Step 5 */}
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(item, 'da_hoan_tat')}
                        title="Bước 5: Khách đã lên, kỹ thuật đã xử lý xong"
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          item.status === 'da_hoan_tat'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs scale-105'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-emerald-50 hover:text-emerald-800'
                        }`}
                      >
                        5. Khách lên
                      </button>
                    </div>

                    {/* Action Buttons Group */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {/* Convert / Edit SVD Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenConvertToSvdModal(item)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-2xs ${
                          item.customerKeepsPart
                            ? 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                        }`}
                        title={
                          item.customerKeepsPart
                            ? 'Xem hoặc điều chỉnh thiết lập Đặt giữ SVD'
                            : 'Khách muốn áp dụng khuyến mãi Ngày Dịch Vụ SVD - Bấm để chuyển sang Đặt giữ SVD từ bất kỳ bước nào (1, 2a, 2, 3, 4)'
                        }
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${item.customerKeepsPart ? 'text-purple-600' : 'text-purple-200'}`} />
                        <span>{item.customerKeepsPart ? 'Sửa Đặt giữ SVD' : 'Đổi Đặt giữ SVD'}</span>
                      </button>

                      {/* Direct GCSM Link */}
                      <a
                        href={GCSM_SHORTAGE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-50 text-stone-700 font-semibold text-xs rounded-lg border border-stone-200 transition-colors cursor-pointer"
                        title="Mở cổng GCSM để tra cứu phiếu này"
                      >
                        <ExternalLink className="w-3 h-3 text-amber-600" />
                        <span>GCSM</span>
                      </a>

                      {/* Print 3x2 Shortage Sticker */}
                      <button
                        type="button"
                        onClick={() => printShortageLabel(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-50 text-stone-700 font-semibold text-xs rounded-lg border border-stone-200 transition-colors cursor-pointer"
                        title="In tem dán phiếu đặt chờ khổ 3x2 inch"
                      >
                        <Printer className="w-3 h-3 text-amber-600" />
                        <span>In tem phiếu 3x2</span>
                      </button>

                      {/* Send to Label Studio queue */}
                      <button
                        type="button"
                        onClick={() => handleSendToLabelStudio(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-lg border border-amber-300 transition-colors cursor-pointer"
                        title="Gửi linh kiện này sang danh sách in tem linh kiện 3x2 inch"
                      >
                        <Boxes className="w-3 h-3 text-amber-600" />
                        <span>In tem kho 3x2</span>
                      </button>

                      {/* Đóng phiếu (Không thay / Chờ lâu / Không xin được LK) */}
                      {item.status !== 'da_bo_mau' && item.status !== 'da_hoan_tat' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCompleteModal(
                              item,
                              'close_no_repair',
                              item.status === 'da_tao_phieu'
                                ? 'khach_doi_y'
                                : item.status === 'chua_xin_du_lk'
                                ? 'toan_quoc_con_it_khong_xin_duoc'
                                : item.status === 'da_xin_lk'
                                ? 'cho_lau_khach_huy'
                                : checkOverdue7Days(item).isOverdue
                                ? 'qua_7_ngay_tu_dong'
                                : 'khach_doi_y'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-950 font-bold text-xs rounded-lg border border-rose-300 transition-colors cursor-pointer"
                          title="Đóng hoàn tất phiếu (Không xin được LK / Chờ lâu khách hủy / Khách đổi ý không thay...)"
                        >
                          <Ban className="w-3 h-3 text-rose-600" />
                          <span>Đóng phiếu (Không thay)</span>
                        </button>
                      )}

                      {/* Bỏ mẫu (Đóng phiếu) */}
                      {item.status !== 'da_bo_mau' && item.status !== 'da_hoan_tat' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(item, 'da_bo_mau')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-rose-50 text-neutral-700 hover:text-rose-900 font-medium text-xs rounded-lg border border-neutral-300 transition-colors cursor-pointer"
                          title="Linh kiện đã bỏ mẫu - Đóng phiếu hoàn tất"
                        >
                          <Ban className="w-3 h-3 text-neutral-500" />
                          <span>Bỏ mẫu</span>
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded cursor-pointer"
                        title="Sửa thông tin"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete (Admin) or Request Cancel (Staff) */}
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleRequestDeleteOrCancel(item)}
                          className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                          title="Xóa phiếu đặt chờ này (Quyền Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : item.cancelRequested ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                          title="Phiếu này đã gửi yêu cầu hủy và đang chờ Quản trị viên duyệt"
                        >
                          <Clock className="w-3 h-3" /> Đang chờ duyệt hủy
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestDeleteOrCancel(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-neutral-500 hover:text-amber-700 bg-neutral-100 hover:bg-amber-50 rounded text-xs font-medium border border-neutral-200 transition-colors cursor-pointer"
                          title="Gửi yêu cầu hủy phiếu đặt chờ này cho Quản trị viên xác nhận"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Yêu cầu hủy</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Quick Collapse Footer */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                  <span className="text-[11px] text-neutral-400">Đang hiển thị toàn bộ chi tiết phiếu #{item.ticketNumber}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleExpandTicket(item.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs"
                    title="Thu gọn phiếu này"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-stone-600" />
                    <span>Thu gọn phiếu</span>
                  </button>
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
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
          currentPage={safeShortageCurrentPage}
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
          itemLabel="phiếu đặt chờ linh kiện"
          className="mt-3"
        />
      )}
    </>
  )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-neutral-200 relative">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-indigo-50/70 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-neutral-900 text-sm">
                  {editingItem ? `Chỉnh Sửa Phiếu Đặt Chờ [${editingItem.ticketNumber}]` : 'Tạo Phiếu Đặt Chờ Linh Kiện Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveForm} className="p-5 space-y-3.5 text-xs text-neutral-700 max-h-[78vh] overflow-y-auto">
              {editingItem && !isAdmin && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-900 text-xs flex items-start gap-2 shadow-2xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Chế độ Nhân viên / Kỹ thuật viên:</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Bạn đang sửa phiếu. Mọi thay đổi sau khi gửi sẽ được lưu tạm và chuyển đến <strong>Quản trị viên (Admin) duyệt</strong> trước khi có hiệu lực chính thức.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Số Phiếu Đặt Chờ:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ticketNumber}
                    onChange={(e) => setFormData({ ...formData, ticketNumber: e.target.value })}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded font-mono font-bold text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                    placeholder="VD: PC-2608-001"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-neutral-800">
                      Thời Gian Đặt Chờ:
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, bookingDate: getCurrentDateTimeString() })}
                      className="text-[10px] text-indigo-700 hover:underline font-bold"
                    >
                      Lấy hiện tại
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={formData.bookingDate}
                      onChange={(e) => setFormData({ ...formData, bookingDate: e.target.value })}
                      className="w-full p-2 pr-10 bg-neutral-50 border border-neutral-300 rounded font-mono text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                      placeholder="DD/MM/YYYY HH:mm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 text-neutral-400 hover:text-indigo-600 rounded-full hover:bg-neutral-100 transition-colors pointer-events-none">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      type="datetime-local"
                      value={parseVNToDateTime(formData.bookingDate)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setFormData({ ...formData, bookingDate: parseDateTimeToVN(val) });
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic list of parts for this ticket (Supports adding parts when creating AND editing) */}
              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-600" />
                    <span>Linh kiện cần xin (Gồm {formPartsList.length} món):</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddFormPart}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Thêm linh kiện cần xin</span>
                  </button>
                </div>

                <p className="text-[11px] text-amber-800 leading-tight">
                  💡 Tích chọn <strong>"Đã xin LK"</strong> cho từng mã. Nếu chưa tích đủ tất cả dấu tick, hệ thống sẽ tự động chuyển trạng thái thành <strong>"2a. Chưa xin đủ LK"</strong>.
                </p>

                <div className="space-y-2">
                  {formPartsList.map((part, idx) => (
                    <div
                      key={part.id || idx}
                      className="bg-white p-2.5 rounded-lg border border-amber-300/80 shadow-2xs space-y-2 relative"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                          Linh kiện #{idx + 1}
                        </span>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          {/* Checkbox Tick: Đã xin LK */}
                          <div className="flex items-center gap-1">
                            <label className={`flex items-center gap-1.5 font-bold text-xs cursor-pointer select-none px-2 py-0.5 rounded border transition-all ${
                              part.isRequested
                                ? 'text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border-emerald-400 shadow-2xs ring-1 ring-emerald-300'
                                : 'text-neutral-500 bg-neutral-100 hover:bg-neutral-200 border-neutral-300'
                            }`}>
                              <input
                                type="checkbox"
                                checked={!!part.isRequested}
                                onChange={(e) => handleToggleFormPartRequested(idx, e.target.checked)}
                                className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                              />
                              <span>{part.isRequested ? '✓ Đã xin LK' : 'Chưa xin LK'}</span>
                            </label>

                            {Number(part.quantity || 1) > 1 && (
                              <div className="inline-flex items-center border border-emerald-300 bg-emerald-50 rounded px-1.5 py-0.5 text-[10px] font-bold text-emerald-900 gap-1">
                                <span>Xin:</span>
                                <button
                                  type="button"
                                  disabled={(part.requestedQuantity ?? (part.isRequested ? Number(part.quantity) : 0)) <= 0}
                                  onClick={() => handleUpdateFormPartRequestedQty(idx, (part.requestedQuantity ?? (part.isRequested ? Number(part.quantity) : 0)) - 1)}
                                  className="w-4 h-4 bg-white hover:bg-emerald-200 border border-emerald-300 rounded flex items-center justify-center font-bold text-emerald-800 disabled:opacity-30 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black min-w-[20px] text-center">
                                  {part.requestedQuantity ?? (part.isRequested ? Number(part.quantity) : 0)}/{part.quantity}
                                </span>
                                <button
                                  type="button"
                                  disabled={(part.requestedQuantity ?? (part.isRequested ? Number(part.quantity) : 0)) >= Number(part.quantity)}
                                  onClick={() => handleUpdateFormPartRequestedQty(idx, (part.requestedQuantity ?? (part.isRequested ? Number(part.quantity) : 0)) + 1)}
                                  className="w-4 h-4 bg-white hover:bg-emerald-200 border border-emerald-300 rounded flex items-center justify-center font-bold text-emerald-800 disabled:opacity-30 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Checkbox Tick: Đã nhận kho */}
                          <div className="flex items-center gap-1">
                            <label className={`flex items-center gap-1.5 font-bold text-xs cursor-pointer select-none px-2 py-0.5 rounded border transition-all ${
                              part.isStockedIn
                                ? 'text-purple-900 bg-purple-100 hover:bg-purple-200 border-purple-400 shadow-2xs ring-1 ring-purple-300'
                                : 'text-neutral-500 bg-neutral-100 hover:bg-neutral-200 border-neutral-300'
                            }`}>
                              <input
                                type="checkbox"
                                checked={!!part.isStockedIn}
                                onChange={(e) => handleToggleFormPartStocked(idx, e.target.checked)}
                                className="w-3.5 h-3.5 accent-purple-600 rounded cursor-pointer"
                              />
                              <span>{part.isStockedIn ? '📦 Đã nhận kho' : 'Chưa nhận kho'}</span>
                            </label>

                            {Number(part.quantity || 1) > 1 && (
                              <div className="inline-flex items-center border border-purple-300 bg-purple-50 rounded px-1.5 py-0.5 text-[10px] font-bold text-purple-900 gap-1">
                                <span>Kho:</span>
                                <button
                                  type="button"
                                  disabled={(part.stockedInQuantity ?? (part.isStockedIn ? Number(part.quantity) : 0)) <= 0}
                                  onClick={() => handleUpdateFormPartStockedQty(idx, (part.stockedInQuantity ?? (part.isStockedIn ? Number(part.quantity) : 0)) - 1)}
                                  className="w-4 h-4 bg-white hover:bg-purple-200 border border-purple-300 rounded flex items-center justify-center font-bold text-purple-800 disabled:opacity-30 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black min-w-[20px] text-center">
                                  {part.stockedInQuantity ?? (part.isStockedIn ? Number(part.quantity) : 0)}/{part.quantity}
                                </span>
                                <button
                                  type="button"
                                  disabled={(part.stockedInQuantity ?? (part.isStockedIn ? Number(part.quantity) : 0)) >= Number(part.quantity)}
                                  onClick={() => handleUpdateFormPartStockedQty(idx, (part.stockedInQuantity ?? (part.isStockedIn ? Number(part.quantity) : 0)) + 1)}
                                  className="w-4 h-4 bg-white hover:bg-purple-200 border border-purple-300 rounded flex items-center justify-center font-bold text-purple-800 disabled:opacity-30 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>

                          {formPartsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFormPart(idx)}
                              className="text-red-600 hover:text-red-800 font-bold text-[11px] hover:underline"
                              title="Xóa linh kiện này khỏi phiếu"
                            >
                              ✕ Xóa
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-3 relative">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5 flex items-center justify-between">
                            <span>Mã linh kiện:</span>
                            <span className="text-[9px] font-normal text-indigo-600">Tự gợi ý tên LK</span>
                          </label>
                          <input
                            type="text"
                            required={idx === 0}
                            value={part.partCode}
                            onFocus={() => {
                              setActiveSuggestionIdx(idx);
                              setActiveSuggestionField('partCode');
                            }}
                            onChange={(e) =>
                              handleUpdateFormPart(idx, 'partCode', e.target.value)
                            }
                            className="w-full p-1.5 bg-neutral-50 border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-900 outline-none focus:bg-white focus:border-indigo-600"
                            placeholder="VD: 621033000403"
                          />

                          {/* Auto-suggest dropdown for Part Code */}
                          {activeSuggestionIdx === idx &&
                            activeSuggestionField === 'partCode' &&
                            getFormPartSuggestions(idx).length > 0 && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-indigo-200 rounded-lg shadow-xl max-h-52 overflow-y-auto divide-y divide-neutral-100 text-xs">
                                <div className="p-1.5 bg-indigo-50/90 text-[10px] font-bold text-indigo-800 flex items-center justify-between border-b border-indigo-100 sticky top-0 backdrop-blur-xs">
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
                                    Gợi ý từ hệ thống ({getFormPartSuggestions(idx).length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSuggestionIdx(null)}
                                    className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {getFormPartSuggestions(idx).map((sug) => (
                                  <button
                                    key={sug.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectCatalogSuggestion(idx, sug);
                                    }}
                                    className="w-full text-left p-2 hover:bg-indigo-50/80 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-mono font-bold text-indigo-950 block truncate text-[11px]">
                                        {sug.code}
                                      </span>
                                      <span className="text-neutral-700 font-semibold block truncate text-[11px]">
                                        {sug.name}
                                      </span>
                                    </div>
                                    {sug.model && (
                                      <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded shrink-0 font-medium">
                                        {sug.model}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>

                        <div className="sm:col-span-4 relative">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Tên linh kiện:
                          </label>
                          <input
                            type="text"
                            required={idx === 0}
                            value={part.partName}
                            onFocus={() => {
                              setActiveSuggestionIdx(idx);
                              setActiveSuggestionField('partName');
                            }}
                            onChange={(e) =>
                              handleUpdateFormPart(idx, 'partName', e.target.value)
                            }
                            className="w-full p-1.5 bg-neutral-50 border border-neutral-300 rounded text-xs font-bold text-neutral-900 outline-none focus:bg-white focus:border-indigo-600"
                            placeholder="VD: Nắp pin / Màn hình"
                          />

                          {/* Auto-suggest dropdown for Part Name */}
                          {activeSuggestionIdx === idx &&
                            activeSuggestionField === 'partName' &&
                            getFormPartSuggestions(idx).length > 0 && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-indigo-200 rounded-lg shadow-xl max-h-52 overflow-y-auto divide-y divide-neutral-100 text-xs">
                                <div className="p-1.5 bg-indigo-50/90 text-[10px] font-bold text-indigo-800 flex items-center justify-between border-b border-indigo-100 sticky top-0 backdrop-blur-xs">
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
                                    Gợi ý từ hệ thống ({getFormPartSuggestions(idx).length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSuggestionIdx(null)}
                                    className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {getFormPartSuggestions(idx).map((sug) => (
                                  <button
                                    key={sug.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectCatalogSuggestion(idx, sug);
                                    }}
                                    className="w-full text-left p-2 hover:bg-indigo-50/80 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                  >
                                    <div className="min-w-0">
                                      <span className="text-neutral-900 font-bold block truncate text-[11px]">
                                        {sug.name}
                                      </span>
                                      <span className="font-mono text-indigo-700 font-semibold block truncate text-[10px]">
                                        {sug.code}
                                      </span>
                                    </div>
                                    {sug.model && (
                                      <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded shrink-0 font-medium">
                                        {sug.model}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Model máy:
                          </label>
                          <input
                            type="text"
                            value={part.model}
                            onChange={(e) =>
                              handleUpdateFormPart(idx, 'model', e.target.value)
                            }
                            className="w-full p-1.5 bg-neutral-50 border border-neutral-300 rounded text-xs text-neutral-800 outline-none focus:bg-white focus:border-indigo-600"
                            placeholder="VD: Find X8 Pro"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5 flex items-center justify-between">
                            <span>Số lượng:</span>
                            <span className="text-[9px] font-bold text-amber-700">Min 1</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={part.quantity ?? 1}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              if (valStr === '') {
                                handleUpdateFormPart(idx, 'quantity', '' as any);
                                return;
                              }
                              const val = parseInt(valStr, 10);
                              if (isNaN(val) || val < 1) {
                                onShowToast(`Linh kiện #${idx + 1}: Số lượng tối thiểu là 1!`, 'error');
                                handleUpdateFormPart(idx, 'quantity', 1);
                              } else {
                                handleUpdateFormPart(idx, 'quantity', val);
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (isNaN(val) || val < 1) {
                                onShowToast(`Linh kiện #${idx + 1}: Số lượng tối thiểu phải là 1!`, 'error');
                                handleUpdateFormPart(idx, 'quantity', 1);
                              }
                            }}
                            className={`w-full p-1.5 border rounded text-xs font-bold text-center outline-none transition-colors ${
                              part.quantity !== undefined && part.quantity !== null && (Number(part.quantity) < 1 || isNaN(Number(part.quantity)))
                                ? 'bg-red-50 border-red-500 text-red-900 focus:border-red-600'
                                : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:bg-white focus:border-indigo-600'
                            }`}
                            placeholder="1"
                          />
                          {part.quantity !== undefined && part.quantity !== null && (Number(part.quantity) < 1 || isNaN(Number(part.quantity))) && (
                            <p className="text-[9px] font-bold text-red-600 mt-0.5">⚠️ Tối thiểu 1</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Active Hold Alert Banner */}
                {activeHoldAlerts.length > 0 && (
                  <div className="mt-2.5 bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex flex-col gap-2 shadow-2xs animate-fadeIn">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Lưu ý: Phát hiện <strong>{activeHoldAlerts.length}</strong> khách hàng đang đặt giữ linh kiện trùng khớp:
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {activeHoldAlerts.map((h) => (
                        <div
                          key={h.id}
                          className="bg-white/90 border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs flex flex-wrap items-center justify-between gap-1.5 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] border border-indigo-200">
                              {h.ticketNumber}
                            </span>
                            <span className="font-bold text-neutral-900">{h.customerName}</span>
                            <span className="text-neutral-500 font-mono text-[11px]">{h.customerPhone}</span>
                            {h.isCustomerCallHold && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded border border-blue-200">
                                📞 GỌI ĐẶT TRƯỚC
                              </span>
                            )}
                            {h.customerKeepsPart && (
                              <span className="px-1.5 py-0.5 bg-fuchsia-100 text-fuchsia-900 text-[10px] font-black rounded border border-fuchsia-300 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-fuchsia-600" />
                                <span>ĐẶT GIỮ SVD</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-neutral-600 font-medium">
                              {h.partName} ({h.partCode})
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-800 border">
                              {SHORTAGE_STATUS_CONFIG[h.status]?.label || h.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-100">
                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Tên Khách Hàng:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Số Điện Thoại:
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                    placeholder="VD: 0987654321"
                  />
                </div>
              </div>

              {/* User Tạo Phiếu & Kỹ Thuật Tạo Phiếu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
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
                    placeholder="Chọn hoặc tìm KTV tạo phiếu (ID / Tên)..."
                    currentUser={currentUser}
                    isAdmin={currentUser?.role === 'admin'}
                    onRequestNewTech={() => setIsRequestTechModalOpen(true)}
                    colorScheme="indigo"
                    icon={<Wrench className="w-3.5 h-3.5 text-indigo-600" />}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-neutral-800">
                      Trạng Thái Quy Trình:
                    </label>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors shadow-2xs ${
                        formData.status === 'da_nhap_kho'
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : formData.status === 'da_goi_kh'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : formData.status === 'da_hoan_tat'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : formData.status === 'da_xin_lk'
                          ? 'bg-teal-100 text-teal-800 border-teal-300'
                          : formData.status === 'chua_xin_du_lk'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                      }`}
                    >
                      {SHORTAGE_STATUS_CONFIG[formData.status]?.label || formData.status}
                    </span>
                  </div>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormStatusChange(e.target.value as ShortageStatus)}
                    className="w-full p-2 bg-white border border-neutral-300 rounded text-neutral-900 font-semibold focus:border-indigo-600 outline-none transition-colors"
                  >
                    <option value="da_tao_phieu">1. Đã tạo phiếu chờ</option>
                    <option value="chua_xin_du_lk">2a. Chưa xin đủ LK</option>
                    <option value="da_xin_lk">2. Đã xin LK</option>
                    <option value="nhap_kho_chua_du_lk">3a. Nhập kho chưa đủ LK</option>
                    <option value="da_nhap_kho">3. Linh kiện đã nhập kho</option>
                    <option value="da_goi_kh">4. Đã gọi khách hàng</option>
                    <option value="da_hoan_tat">5. Khách đã lên (Kỹ thuật đã xử lý)</option>
                    <option value="da_bo_mau">6. Linh kiện bỏ mẫu (Đóng phiếu)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Mã Kệ (Khi đã nhập kho):
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded text-neutral-900 font-bold focus:bg-white focus:border-indigo-600 outline-none"
                    placeholder="VD: A-01"
                  />
                </div>
              </div>
              
              {/* Special Options: Call Hold & Customer Keeps Part */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Option 1: Customer Call Hold */}
                <div className={`border rounded-xl p-3 flex flex-col justify-between gap-2 transition-all shadow-2xs ${
                  formData.isCustomerCallHold
                    ? 'bg-blue-50/90 border-blue-300 ring-1 ring-blue-200'
                    : 'bg-neutral-50/70 border-neutral-200 hover:bg-neutral-50'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="isCustomerCallHold"
                      checked={!!formData.isCustomerCallHold}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          // Default to false (chưa có linh kiện sẵn, bắt đầu bước 1) if not set
                          setFormData({ 
                            ...formData, 
                            isCustomerCallHold: true,
                            hasAvailableParts: formData.hasAvailableParts !== undefined ? formData.hasAvailableParts : false,
                          });
                        } else {
                          setFormData({ 
                            ...formData, 
                            isCustomerCallHold: false,
                            hasAvailableParts: formData.customerKeepsPart ? formData.hasAvailableParts : undefined,
                          });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="isCustomerCallHold" className="font-bold text-neutral-800 text-xs cursor-pointer flex items-center gap-1.5 select-none">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-black text-[10px] border border-blue-200">
                        📞 GỌI ĐẶT TRƯỚC
                      </span>
                      <span>Khách gọi đặt giữ linh kiện trước</span>
                    </label>
                  </div>
                  <span className="text-[10px] text-neutral-500 italic pl-6.5">
                    (Khách gọi đặt giữ LK trước, chưa gửi máy tại trung tâm)
                  </span>

                  {/* Sub-options for Call Hold: Có linh kiện sẵn vs Chưa có linh kiện */}
                  {formData.isCustomerCallHold && (
                    <div className="mt-1 pt-2 border-t border-blue-200/80 flex flex-col gap-1.5 animate-in fade-in">
                      <span className="text-[11px] font-bold text-blue-950 flex items-center justify-between">
                        <span>Tình trạng linh kiện tại kho:</span>
                        {formData.hasAvailableParts === true && (
                          <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] font-black">
                            TỰ ĐỘNG BƯỚC 3
                          </span>
                        )}
                        {formData.hasAvailableParts === false && (
                          <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded text-[9px] font-black">
                            BẮT ĐẦU BƯỚC 1
                          </span>
                        )}
                      </span>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const now = getCurrentDateTimeString();
                            setFormData((prev) => ({
                              ...prev,
                              hasAvailableParts: true,
                              status: 'da_nhap_kho',
                              stockedInDate: prev.stockedInDate || now,
                              requestedDate: prev.requestedDate || now,
                            }));
                            setFormPartsList((prev) => prev.map((p) => ({ ...p, isRequested: true, isStockedIn: true })));
                            onShowToast('Đã chọn: Có linh kiện sẵn ➔ Tự động chuyển sang Bước 3 (Đã nhập kho)', 'info');
                          }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            formData.hasAvailableParts === true
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-1 ring-blue-400'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-blue-50'
                          }`}
                        >
                          <span>📦 Có linh kiện sẵn</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              hasAvailableParts: false,
                              status: 'da_tao_phieu',
                              stockedInDate: '',
                              requestedDate: '',
                            }));
                            setFormPartsList((prev) => prev.map((p) => ({ ...p, isRequested: false, isStockedIn: false })));
                            onShowToast('Đã chọn: Chưa có linh kiện ➔ Bắt đầu từ Bước 1 (Đã tạo phiếu)', 'info');
                          }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            formData.hasAvailableParts === false
                              ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-1 ring-amber-400'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-amber-50'
                          }`}
                        >
                          <span>⏳ Chưa có linh kiện</span>
                        </button>
                      </div>

                      {formData.hasAvailableParts === true ? (
                        <p className="text-[10px] text-blue-800 font-semibold bg-blue-100/70 px-2 py-1 rounded">
                          ✓ Linh kiện có sẵn: Trạng thái tự động nhảy đến <strong>Bước 3 (Linh kiện đã nhập kho)</strong>.
                        </p>
                      ) : (
                        <p className="text-[10px] text-amber-800 font-semibold bg-amber-100/70 px-2 py-1 rounded">
                          ⏳ Chưa có sẵn: Phiếu sẽ bắt đầu từ <strong>Bước 1 (Đã tạo phiếu chờ)</strong>.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Option 2: Customer SVD Hold */}
                <div className={`border rounded-xl p-3 flex flex-col justify-between gap-2 transition-all shadow-2xs ${
                  formData.customerKeepsPart
                    ? 'bg-fuchsia-50/90 border-fuchsia-400 ring-2 ring-fuchsia-300/50'
                    : 'bg-neutral-50/70 border-neutral-200 hover:bg-neutral-50'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="customerKeepsPart"
                      checked={!!formData.customerKeepsPart}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setFormData({ 
                            ...formData, 
                            customerKeepsPart: true,
                            hasAvailableParts: formData.hasAvailableParts !== undefined ? formData.hasAvailableParts : false,
                          });
                        } else {
                          setFormData({ 
                            ...formData, 
                            customerKeepsPart: false,
                            hasAvailableParts: formData.isCustomerCallHold ? formData.hasAvailableParts : undefined,
                          });
                        }
                      }}
                      className="w-4 h-4 text-fuchsia-600 border-neutral-300 rounded focus:ring-fuchsia-500 cursor-pointer"
                    />
                    <label htmlFor="customerKeepsPart" className="font-bold text-neutral-800 text-xs cursor-pointer flex items-center gap-1.5 select-none">
                      <span className="px-2 py-0.5 bg-indigo-600 text-white rounded font-bold text-[10px] border border-indigo-500 flex items-center gap-1 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-indigo-200" />
                        <span>ĐẶT GIỮ SVD</span>
                      </span>
                      <span>Khách đặt giữ linh kiện SVD</span>
                    </label>
                  </div>
                  <span className="text-[10px] text-fuchsia-950/80 font-medium pl-6.5">
                    (Khách đặt giữ linh kiện Ngày Dịch Vụ SVD 10-12 hằng tháng. Hệ thống sẽ cảnh báo khẩn nếu sau 1 ngày chưa xin linh kiện)
                  </span>

                  {/* Sub-options for SVD: Có linh kiện sẵn vs Chưa có linh kiện */}
                  {formData.customerKeepsPart && (
                    <div className="mt-1 pt-2 border-t border-fuchsia-200/80 flex flex-col gap-1.5 animate-in fade-in">
                      <span className="text-[11px] font-bold text-fuchsia-950 flex items-center justify-between">
                        <span>Tình trạng linh kiện SVD tại kho:</span>
                        {formData.hasAvailableParts === true && (
                          <span className="px-1.5 py-0.2 bg-fuchsia-600 text-white rounded text-[9px] font-black">
                            TỰ ĐỘNG BƯỚC 3
                          </span>
                        )}
                        {formData.hasAvailableParts === false && (
                          <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded text-[9px] font-black">
                            BẮT ĐẦU BƯỚC 1
                          </span>
                        )}
                      </span>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const now = getCurrentDateTimeString();
                            setFormData((prev) => ({
                              ...prev,
                              hasAvailableParts: true,
                              status: 'da_nhap_kho',
                              stockedInDate: prev.stockedInDate || now,
                              requestedDate: prev.requestedDate || now,
                            }));
                            setFormPartsList((prev) => prev.map((p) => ({ ...p, isRequested: true, isStockedIn: true })));
                            onShowToast('Đã chọn: SVD có sẵn linh kiện ➔ Tự động chuyển sang Bước 3 (Đã nhập kho)', 'info');
                          }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            formData.hasAvailableParts === true
                              ? 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-xs ring-1 ring-fuchsia-400'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-fuchsia-50'
                          }`}
                        >
                          <span>📦 Có linh kiện sẵn</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              hasAvailableParts: false,
                              status: 'da_tao_phieu',
                              stockedInDate: '',
                              requestedDate: '',
                            }));
                            setFormPartsList((prev) => prev.map((p) => ({ ...p, isRequested: false, isStockedIn: false })));
                            onShowToast('Đã chọn: SVD chưa có linh kiện ➔ Bắt đầu từ Bước 1 (Đã tạo phiếu)', 'info');
                          }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            formData.hasAvailableParts === false
                              ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-1 ring-amber-400'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-amber-50'
                          }`}
                        >
                          <span>⏳ Chưa có linh kiện</span>
                        </button>
                      </div>

                      {formData.hasAvailableParts === true ? (
                        <p className="text-[10px] text-fuchsia-900 font-semibold bg-fuchsia-100/70 px-2 py-1 rounded">
                          ✓ Linh kiện SVD có sẵn: Trạng thái tự động nhảy đến <strong>Bước 3 (Linh kiện đã nhập kho)</strong>.
                        </p>
                      ) : (
                        <p className="text-[10px] text-rose-900 font-semibold bg-rose-100/70 px-2 py-1 rounded">
                          ⏳ Chưa có sẵn: Bắt đầu từ <strong>Bước 1 (Đã tạo phiếu)</strong>. Sẽ cảnh báo khẩn nếu quá 1 ngày chưa xin linh kiện.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Thời gian Xin LK, Nhập Kho & Gọi Khách Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-neutral-100 bg-indigo-50/40 p-2.5 rounded-lg border text-xs">
                {/* Thời gian Xin LK */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-neutral-800 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Thời Gian Xin LK:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, requestedDate: getCurrentDateTimeString() })}
                      className="text-[10px] text-amber-700 hover:underline font-bold"
                    >
                      Lấy hiện tại
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={formData.requestedDate || ''}
                      onChange={(e) => setFormData({ ...formData, requestedDate: e.target.value })}
                      className="w-full p-2 pr-10 bg-white border border-neutral-300 rounded text-neutral-900 font-medium focus:border-indigo-600 outline-none"
                      placeholder="DD/MM/YYYY HH:mm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 text-neutral-400 hover:text-indigo-600 rounded-full hover:bg-neutral-100 transition-colors pointer-events-none">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      type="datetime-local"
                      value={parseVNToDateTime(formData.requestedDate || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setFormData({ ...formData, requestedDate: parseDateTimeToVN(val) });
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-neutral-800 flex items-center gap-1">
                      <Boxes className="w-3 h-3 text-purple-600" />
                      <span>Thời Gian Nhập Kho:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, stockedInDate: getCurrentDateTimeString() })}
                      className="text-[10px] text-purple-700 hover:underline font-bold"
                    >
                      Lấy hiện tại
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={formData.stockedInDate || ''}
                      onChange={(e) => setFormData({ ...formData, stockedInDate: e.target.value })}
                      className="w-full p-2 pr-10 bg-white border border-neutral-300 rounded text-neutral-900 font-medium focus:border-indigo-600 outline-none"
                      placeholder="DD/MM/YYYY HH:mm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 text-neutral-400 hover:text-indigo-600 rounded-full hover:bg-neutral-100 transition-colors pointer-events-none">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      type="datetime-local"
                      value={parseVNToDateTime(formData.stockedInDate || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setFormData({ ...formData, stockedInDate: parseDateTimeToVN(val) });
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-neutral-800 flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-sky-600" />
                      <span>Thời Gian Gọi Khách:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, calledCustomerDate: getCurrentDateTimeString() })}
                      className="text-[10px] text-sky-700 hover:underline font-bold"
                    >
                      Lấy hiện tại
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={formData.calledCustomerDate || ''}
                      onChange={(e) => setFormData({ ...formData, calledCustomerDate: e.target.value })}
                      className="w-full p-2 pr-10 bg-white border border-neutral-300 rounded text-neutral-900 font-medium focus:border-indigo-600 outline-none"
                      placeholder="DD/MM/YYYY HH:mm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 text-neutral-400 hover:text-indigo-600 rounded-full hover:bg-neutral-100 transition-colors pointer-events-none">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      type="datetime-local"
                      value={parseVNToDateTime(formData.calledCustomerDate || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setFormData({ ...formData, calledCustomerDate: parseDateTimeToVN(val) });
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Tiến độ 5: Kỹ thuật xử lý & Thời gian khách lên Inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-100 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                <div>
                  <TechnicianSelector
                    label="Kỹ Thuật Xử Lý:"
                    value={formData.technicianName || ''}
                    onChange={(val) => setFormData({ ...formData, technicianName: val })}
                    technicians={masterTechnicians}
                    placeholder="Chọn hoặc tìm KTV xử lý (ID / Tên)..."
                    currentUser={currentUser}
                    isAdmin={currentUser?.role === 'admin'}
                    onRequestNewTech={() => setIsRequestTechModalOpen(true)}
                    colorScheme="emerald"
                    icon={<Wrench className="w-3.5 h-3.5 text-emerald-600" />}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-emerald-950 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      <span>Thời Gian Khách Lên:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, customerArrivedDate: getCurrentDateTimeString() })}
                      className="text-[10px] text-emerald-800 hover:underline font-bold"
                    >
                      Lấy hiện tại
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={formData.customerArrivedDate || ''}
                      onChange={(e) => setFormData({ ...formData, customerArrivedDate: e.target.value })}
                      className="w-full p-2 pr-10 bg-white border border-emerald-300 rounded text-neutral-900 font-medium focus:border-emerald-600 outline-none"
                      placeholder="DD/MM/YYYY HH:mm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 text-neutral-400 hover:text-emerald-600 rounded-full hover:bg-neutral-100 transition-colors pointer-events-none">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      type="datetime-local"
                      value={parseVNToDateTime(formData.customerArrivedDate || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setFormData({ ...formData, customerArrivedDate: parseDateTimeToVN(val) });
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Ghi Chú Chi Tiết:
                </label>
                <textarea
                  rows={2}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none"
                  placeholder="VD: Khách hẹn chiều thứ 5, gọi trước 30 phút..."
                />
              </div>

              {/* Edit Reason Input (Compulsory when staff edits existing ticket) */}
              {editingItem && !isAdmin && (
                <div className="bg-amber-50/80 p-3 rounded-lg border border-amber-300 space-y-1.5 animate-in fade-in">
                  <label className="block font-bold text-amber-950 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                      <span>Lý do xin chỉnh sửa thông tin: <span className="text-rose-600">*</span></span>
                    </span>
                    <span className="text-[10px] text-amber-700 font-normal">Gửi Quản trị viên duyệt</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editReasonInput}
                    onChange={(e) => setEditReasonInput(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-300 rounded text-neutral-900 focus:border-amber-600 outline-none text-xs"
                    placeholder="VD: Khách hàng đổi số điện thoại mới, điều chỉnh tên model đúng với thực tế..."
                  />
                </div>
              )}

              {/* Real-time Date Sequence Warning Box */}
              {(() => {
                const warnings = checkDateSequenceViolations({
                  bookingDate: formData.bookingDate,
                  stockedInDate: formData.stockedInDate,
                  calledCustomerDate: formData.calledCustomerDate,
                  customerArrivedDate: formData.customerArrivedDate,
                });
                if (warnings.length === 0) return null;
                return (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-amber-900">⚠️ Cảnh báo thứ tự mốc thời gian (Bước 1 ➔ Bước 5):</p>
                      <ul className="list-disc pl-4 space-y-0.5 mt-1 text-[11.5px] text-amber-950">
                        {warnings.map((w, idx) => (
                          <li key={idx} className="font-medium">{w}</li>
                        ))}
                      </ul>
                      <p className="text-[10.5px] text-amber-800 mt-1 italic">
                        Lưu ý: Hệ thống vẫn cho phép bạn lưu nếu đây là thông tin cố ý, nhưng khuyến nghị kiểm tra lại ngày/giờ để tránh sai lệch báo cáo.
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg cursor-pointer transition-colors shadow-sm flex items-center gap-1.5 ${
                    editingItem && !isAdmin
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSubmittingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingItem
                    ? (!isAdmin ? 'Gửi Yêu Cầu Sửa Cho Admin' : 'Lưu Thay Đổi (Admin)')
                    : 'Tạo Phiếu Đặt Chờ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Review Edit Request Modal */}
      {editReviewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-blue-300">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600/30 rounded-lg border border-blue-500/40">
                  <ShieldCheck className="w-5 h-5 text-blue-300" />
                </div>
                <h3 className="font-bold text-sm">Quản Trị Duyệt Yêu Cầu Chỉnh Sửa Phiếu</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditReviewModalItem(null)}
                className="p-1 hover:bg-white/20 rounded transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-neutral-700 max-h-[80vh] overflow-y-auto">
              <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950 text-xs">
                    Số phiếu: <span className="font-mono text-blue-700 text-sm font-black">{editReviewModalItem.ticketNumber}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px] border border-blue-200">
                    Chờ Admin duyệt
                  </span>
                </div>
                <div className="text-[11px] text-blue-900">
                  <strong>Người yêu cầu:</strong> {editReviewModalItem.editRequestedBy || 'Kỹ thuật viên'}
                  {editReviewModalItem.editRequestedAt && (
                    <span className="text-neutral-500 ml-2">({new Date(editReviewModalItem.editRequestedAt).toLocaleString('vi-VN')})</span>
                  )}
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-blue-200 text-neutral-800">
                  <strong className="text-blue-950 block mb-1">📝 Lý do xin sửa:</strong>
                  <p className="italic text-neutral-700 leading-relaxed font-medium">
                    "{editReviewModalItem.editReason || 'Không có lý do chi tiết'}"
                  </p>
                </div>
              </div>

              {/* Comparison of Changes */}
              {editReviewModalItem.pendingEditData && (
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-900 flex items-center gap-1.5 text-xs">
                    <HistoryIcon className="w-4 h-4 text-indigo-600" />
                    <span>Chi tiết các thông tin đề xuất thay đổi:</span>
                  </h4>
                  <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-3 space-y-2">
                    {/* Customer */}
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-neutral-200">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Khách hàng hiện tại:</span>
                        <span className="font-semibold text-neutral-800">
                          {editReviewModalItem.customerName} ({editReviewModalItem.customerPhone})
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-600 font-bold block">Khách hàng đề xuất mới:</span>
                        <span className="font-bold text-indigo-900">
                          {editReviewModalItem.pendingEditData.customerName || editReviewModalItem.customerName} ({editReviewModalItem.pendingEditData.customerPhone || editReviewModalItem.customerPhone})
                        </span>
                      </div>
                    </div>

                    {/* Part & Model */}
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-neutral-200">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Linh kiện hiện tại:</span>
                        <span className="font-semibold text-neutral-800">
                          {editReviewModalItem.partName} ({editReviewModalItem.partCode})
                        </span>
                        {editReviewModalItem.model && (
                          <span className="text-[10px] text-neutral-500 block">Model: {editReviewModalItem.model}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-600 font-bold block">Linh kiện đề xuất mới:</span>
                        <span className="font-bold text-indigo-900">
                          {editReviewModalItem.pendingEditData.partName || editReviewModalItem.partName} ({editReviewModalItem.pendingEditData.partCode || editReviewModalItem.partCode})
                        </span>
                        {(editReviewModalItem.pendingEditData.model || editReviewModalItem.model) && (
                          <span className="text-[10px] text-indigo-700 block">Model: {editReviewModalItem.pendingEditData.model || editReviewModalItem.model}</span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-neutral-200">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Trạng thái hiện tại:</span>
                        <span className="font-bold text-neutral-800">
                          {SHORTAGE_STATUS_CONFIG[editReviewModalItem.status]?.label || editReviewModalItem.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-600 font-bold block">Trạng thái đề xuất mới:</span>
                        <span className="font-bold text-indigo-900">
                          {SHORTAGE_STATUS_CONFIG[editReviewModalItem.pendingEditData.status || editReviewModalItem.status]?.label || editReviewModalItem.pendingEditData.status}
                        </span>
                      </div>
                    </div>

                    {/* KTV xử lý */}
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-neutral-200">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">KTV xử lý hiện tại:</span>
                        <span className="font-semibold text-neutral-800">
                          {editReviewModalItem.technicianName || 'Chưa phân công'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-600 font-bold block">KTV xử lý đề xuất:</span>
                        <span className="font-bold text-indigo-900">
                          {editReviewModalItem.pendingEditData.technicianName || editReviewModalItem.technicianName || 'Chưa phân công'}
                        </span>
                      </div>
                    </div>

                    {/* Note */}
                    {editReviewModalItem.pendingEditData.note !== undefined && (
                      <div>
                        <span className="text-[10px] text-indigo-600 font-bold block">Ghi chú cập nhật:</span>
                        <span className="font-medium text-neutral-800 italic">
                          "{editReviewModalItem.pendingEditData.note || '(Trống)'}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setEditReviewModalItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  Đóng
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdminRejectEditRequest(editReviewModalItem)}
                    className="px-3.5 py-2 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg cursor-pointer transition-colors"
                  >
                    Bác bỏ yêu cầu
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAdminApproveEditRequest(editReviewModalItem)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Duyệt & Cập Nhật Phiếu</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Request-to-Cancel Modal */}
      {cancelRequestModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-300">
            <div className="px-5 py-3.5 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Gửi Yêu Cầu Hủy Phiếu Đặt Chờ</h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelRequestModalItem(null)}
                className="p-1 hover:bg-amber-600 rounded transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCancelRequest} className="p-5 space-y-4 text-xs text-neutral-700">
              <div className="bg-amber-50/80 p-3 rounded-lg border border-amber-200 space-y-1">
                <div>
                  Số phiếu: <strong className="font-mono text-neutral-900">{cancelRequestModalItem.ticketNumber}</strong>
                </div>
                <div>
                  Linh kiện: <strong className="text-neutral-900">{cancelRequestModalItem.partName}</strong> ({cancelRequestModalItem.partCode})
                </div>
                <div>
                  Khách hàng: <strong>{cancelRequestModalItem.customerName}</strong> - {cancelRequestModalItem.customerPhone}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-neutral-900">
                  Lý do yêu cầu hủy phiếu <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={3}
                  required
                  autoFocus
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="VD: Khách đổi ý không sửa, nhập trùng phiếu, khách tự mua linh kiện ngoài..."
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none leading-relaxed"
                />
                <p className="text-[11px] text-neutral-500">
                  Sau khi gửi, phiếu sẽ được đánh dấu và chuyển đến Quản trị viên (Admin) để xác nhận xóa vĩnh viễn khỏi hệ thống.
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelRequestModalItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel || !cancelReasonInput.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingCancel ? 'Đang gửi...' : 'Gửi Yêu Cầu Cho Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Direct Delete Confirmation Modal */}
      {deletingBookingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-rose-300">
            <div className="px-5 py-3.5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Xác Nhận Xóa Vĩnh Viễn Phiếu</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingBookingConfirm(null)}
                className="p-1 hover:bg-rose-700 rounded transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-neutral-700">
              <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 space-y-1">
                <div>
                  Số phiếu: <strong className="font-mono text-neutral-900">{deletingBookingConfirm.ticketNumber}</strong>
                </div>
                <div>
                  Linh kiện: <strong className="text-neutral-900">{deletingBookingConfirm.partName}</strong> ({deletingBookingConfirm.partCode})
                </div>
                <div>
                  Khách hàng: <strong>{deletingBookingConfirm.customerName}</strong> ({deletingBookingConfirm.customerPhone})
                </div>
                {deletingBookingConfirm.cancelReason && (
                  <div className="text-rose-700 pt-1 mt-1 border-t border-rose-200">
                    Lý do yêu cầu hủy: <em>"{deletingBookingConfirm.cancelReason}"</em>
                  </div>
                )}
              </div>

              <p className="text-neutral-600">
                Hành động này sẽ xóa hoàn toàn phiếu đặt chờ này trên toàn bộ hệ thống Cloud và tất cả máy nhân viên. Bạn có chắc chắn muốn tiếp tục?
              </p>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingBookingConfirm(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleAdminApproveCancelOrDelete(deletingBookingConfirm)}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  Xác Nhận Xóa Vĩnh Viễn
                </button>
              </div>
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
                <h3 className="font-extrabold text-sm">Xác Nhận Xóa Trắng Toàn Bộ Danh Sách</h3>
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
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Cảnh Báo Nguy Hiểm!</span>
                </div>
                <p className="text-rose-800 leading-relaxed">
                  Hiện đang có <strong className="font-mono text-rose-950">{bookings.length} phiếu đặt chờ linh kiện</strong> trong hệ thống.
                </p>
                <p className="text-rose-700 text-[11px]">
                  Thao tác này sẽ <strong>xóa vĩnh viễn TOÀN BỘ phiếu</strong> trên cơ sở dữ liệu Cloud SQL PostgreSQL, Cloud Firestore và tất cả các thiết bị kết nối.
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
                  onClick={handleClearAllShortages}
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

      {/* Step 5: Khách đã lên & Kỹ thuật đã xử lý HOẶC Đóng hoàn tất Modal */}
      {completingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200">
            {/* Modal Header */}
            <div className="px-5 py-3.5 text-white flex items-center justify-between bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                {completeType === 'close_no_repair' ? (
                  <div className="p-1.5 bg-rose-600/30 rounded-lg border border-rose-500/40">
                    <Ban className="w-5 h-5 text-rose-300" />
                  </div>
                ) : (
                  <div className="p-1.5 bg-emerald-600/30 rounded-lg border border-emerald-500/40">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {completeType === 'close_no_repair'
                      ? 'Hoàn Tất Đóng Phiếu (Khách Không Thay)'
                      : 'Tiến Độ 5: Khách Đã Lên - Kỹ Thuật Đã Xử Lý'}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono">
                    Phiếu #{completingItem.ticketNumber} • {completingItem.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompletingItem(null)}
                className="p-1 hover:bg-black/20 rounded-lg transition-colors text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="p-2 bg-neutral-100 border-b border-neutral-200 grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCompleteType('success_repair')}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  completeType === 'success_repair'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Khách đã lên thay xong</span>
              </button>

              <button
                type="button"
                onClick={() => setCompleteType('close_no_repair')}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  completeType === 'close_no_repair'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Ban className="w-4 h-4" />
                <span>Đóng phiếu (Không thay)</span>
              </button>
            </div>

            <form onSubmit={handleConfirmCompleteStep5} className="p-5 space-y-4 text-xs text-neutral-700 max-h-[80vh] overflow-y-auto">
              <div
                className={`p-3 rounded-xl border space-y-1 ${
                  completeType === 'close_no_repair'
                    ? 'bg-rose-50/80 border-rose-200'
                    : 'bg-emerald-50/80 border-emerald-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    Số phiếu: <strong className="font-mono text-neutral-900">{completingItem.ticketNumber}</strong>
                  </div>
                  {completingItem.calledCustomerDate && (
                    <span className="text-[11px] text-sky-800 font-semibold">
                      Đã gọi: {completingItem.calledCustomerDate} ({getDaysSinceCalled(completingItem.calledCustomerDate)} ngày trước)
                    </span>
                  )}
                </div>
                <div>
                  Linh kiện: <strong className="text-neutral-900">{completingItem.partName}</strong> ({completingItem.partCode})
                </div>
                <div>
                  Khách hàng: <strong>{completingItem.customerName}</strong> ({completingItem.customerPhone})
                </div>
              </div>

              {/* Specific fields for 'success_repair' */}
              {completeType === 'success_repair' ? (
                <>
                  <div className="space-y-1.5">
                    <TechnicianSelector
                      label="Tên Kỹ Thuật Viên Đã Xử Lý:"
                      value={completeTechName}
                      onChange={(val) => setCompleteTechName(val)}
                      technicians={masterTechnicians}
                      placeholder="Chọn hoặc tìm KTV xử lý (ID / Tên)..."
                      currentUser={currentUser}
                      isAdmin={currentUser?.role === 'admin'}
                      onRequestNewTech={() => setIsRequestTechModalOpen(true)}
                      colorScheme="emerald"
                      icon={<Wrench className="w-3.5 h-3.5 text-emerald-600" />}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-neutral-900 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Thời Gian Khách Mang Máy Lên:</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setCompleteArrivedDate(getCurrentDateTimeString())}
                        className="text-[10px] text-emerald-700 hover:underline font-bold cursor-pointer"
                      >
                        Lấy hiện tại
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={completeArrivedDate || ''}
                        onChange={(e) => setCompleteArrivedDate(e.target.value)}
                        placeholder="DD/MM/YYYY HH:mm"
                        className="w-full p-2.5 pr-10 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none font-mono"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 text-neutral-400 hover:text-emerald-600 rounded-full hover:bg-neutral-100 transition-colors pointer-events-none">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <input
                        type="datetime-local"
                        value={parseVNToDateTime(completeArrivedDate || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            setCompleteArrivedDate(parseDateTimeToVN(val));
                          }
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-neutral-900">
                      Ghi Chú Hoàn Tất (Tùy chọn):
                    </label>
                    <textarea
                      rows={2}
                      value={completeNote}
                      onChange={(e) => setCompleteNote(e.target.value)}
                      placeholder="VD: Đã thay xong linh kiện cho khách, test cảm ứng & sạc OK..."
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none resize-none"
                    />
                  </div>
                </>
              ) : (
                /* Specific fields for 'close_no_repair' */
                <>
                  <div className="space-y-2">
                    <label className="block font-bold text-neutral-900 flex items-center gap-1">
                      <Ban className="w-3.5 h-3.5 text-rose-600" />
                      <span>Chọn Lý Do Đóng Phiếu / Hủy Đặt <span className="text-rose-500">*</span>:</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {SHORTAGE_CLOSURE_REASONS.map((r) => (
                        <label
                          key={r.id}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                            completeClosureReason === r.id
                              ? 'bg-rose-50/90 border-rose-500 ring-2 ring-rose-500/20'
                              : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="closureReason"
                            value={r.id}
                            checked={completeClosureReason === r.id}
                            onChange={() => setCompleteClosureReason(r.id)}
                            className="mt-0.5 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="font-semibold text-xs text-neutral-800 leading-tight">
                            {r.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-neutral-900">
                      Ghi Chú Chi Tiết / Lý Do Bổ Sung:
                    </label>
                    <textarea
                      rows={2}
                      value={completeCustomReason}
                      onChange={(e) => setCompleteCustomReason(e.target.value)}
                      placeholder={
                        completeClosureReason === 'ly_do_khac'
                          ? 'Vui lòng nhập rõ lý do đóng phiếu...'
                          : 'VD: Khách báo đã mua điện thoại mới, gọi 3 cuộc không nghe máy...'
                      }
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-neutral-900 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-rose-600" />
                      <span>Nhân Viên / KTV Xác Nhận Đóng Phiếu:</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={completeTechName}
                      onChange={(e) => setCompleteTechName(e.target.value)}
                      placeholder="VD: KTV Minh / NV Tiếp Nhận..."
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 font-bold focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                    />
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Khi xác nhận đóng phiếu, trạng thái sẽ chuyển thành <strong>Đã Hoàn Tất</strong> kèm lý do đóng không thay. Linh kiện sẽ được giải phóng cho nhu cầu khác.
                    </span>
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompletingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-lg cursor-pointer transition-colors shadow-xs ${
                    completeType === 'close_no_repair'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {completeType === 'close_no_repair' ? (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>Xác Nhận Đóng Hoàn Tất Phiếu</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác Nhận Đã Xử Lý Xong</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Overdue Close Confirmation Modal */}
      {bulkCloseOverdueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-rose-300">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-600/30 rounded-xl border border-rose-500/40">
                  <AlertTriangle className="w-5 h-5 text-rose-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-tight text-white">
                    Xác Nhận Đóng Tất Cả {overdue7DaysTickets.length} Phiếu Quá Hạn 7 Ngày
                  </h3>
                  <p className="text-xs text-slate-300">
                    Tự động đóng hoàn tất các phiếu đã gọi khách quá 7 ngày nhưng khách không lên thay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkCloseOverdueModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-neutral-700 max-h-[70vh] overflow-y-auto">
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-900 leading-relaxed">
                Hệ thống sẽ chuyển tất cả <strong>{overdue7DaysTickets.length}</strong> phiếu dưới đây sang trạng thái <strong>Đã Hoàn Tất</strong> với lý do: <em>"Quá hạn 7 ngày từ khi gọi báo có LK - Đóng hoàn tất"</em>.
              </div>

              <div className="space-y-2">
                <div className="font-bold text-neutral-900 text-xs">
                  Danh sách {overdue7DaysTickets.length} phiếu sẽ được đóng:
                </div>
                <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-neutral-50/50">
                  {overdue7DaysTickets.map((t) => {
                    const overdue = checkOverdue7Days(t);
                    return (
                      <div key={t.id} className="p-2.5 flex items-center justify-between gap-3 text-[11px] hover:bg-white transition-colors">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <strong className="font-mono text-neutral-900 font-bold">{t.ticketNumber}</strong>
                            <span className="text-neutral-700 font-semibold">{t.customerName} ({t.customerPhone})</span>
                          </div>
                          <div className="text-neutral-500">
                            {t.partName} ({t.partCode})
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-black text-[10px]">
                            Quá {overdue.daysSinceCalled} ngày
                          </span>
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            Gọi ngày {t.calledCustomerDate}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkCloseOverdueModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleBulkCloseOverdue}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Đóng Toàn Bộ ({overdue7DaysTickets.length} phiếu)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Status Change Custom Confirmation Modal */}
      {statusConfirmModal && statusConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 relative z-[101]">
            {/* Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/30 rounded-xl border border-blue-500/40">
                  <CheckCircle2 className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-tight text-white">
                    {statusConfirmModal.title || 'Xác Nhận Chuyển Trạng Thái'}
                  </h3>
                  {statusConfirmModal.ticketNumber && (
                    <p className="text-xs text-blue-300/80 font-mono">
                      Phiếu #{statusConfirmModal.ticketNumber}
                      {statusConfirmModal.customerName ? ` • ${statusConfirmModal.customerName}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusConfirmModal(null)}
                className="text-indigo-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-sm text-neutral-700">
              {/* Status Transition Badges */}
              {statusConfirmModal.toStatus && (
                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/80 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 text-center">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
                      Hiện tại
                    </span>
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${
                      statusConfirmModal.fromStatus && SHORTAGE_STATUS_CONFIG[statusConfirmModal.fromStatus]
                        ? `${SHORTAGE_STATUS_CONFIG[statusConfirmModal.fromStatus].badgeBg} ${SHORTAGE_STATUS_CONFIG[statusConfirmModal.fromStatus].badgeText} ${SHORTAGE_STATUS_CONFIG[statusConfirmModal.fromStatus].borderColor}`
                        : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                    }`}>
                      {statusConfirmModal.fromStatus && SHORTAGE_STATUS_CONFIG[statusConfirmModal.fromStatus]
                        ? SHORTAGE_STATUS_CONFIG[statusConfirmModal.fromStatus].label
                        : 'Chưa xác định'}
                    </span>
                  </div>

                  <ArrowRight className="w-5 h-5 text-indigo-500 shrink-0" />

                  <div className="flex-1 min-w-0 text-center">
                    <span className="text-[10px] uppercase font-bold text-indigo-600 block mb-0.5">
                      Chuyển sang
                    </span>
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${
                      SHORTAGE_STATUS_CONFIG[statusConfirmModal.toStatus]
                        ? `${SHORTAGE_STATUS_CONFIG[statusConfirmModal.toStatus].badgeBg} ${SHORTAGE_STATUS_CONFIG[statusConfirmModal.toStatus].badgeText} ${SHORTAGE_STATUS_CONFIG[statusConfirmModal.toStatus].borderColor}`
                        : 'bg-blue-600 text-white border-blue-700'
                    }`}>
                      {SHORTAGE_STATUS_CONFIG[statusConfirmModal.toStatus]?.label}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-neutral-800 text-xs leading-relaxed font-medium">
                {statusConfirmModal.message}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setStatusConfirmModal(null)}
                className="px-3.5 py-2 bg-white hover:bg-neutral-100 text-neutral-600 font-bold text-xs rounded-xl border border-neutral-300 transition-colors cursor-pointer"
              >
                Hủy / Đóng
              </button>
              <div className="flex items-center gap-2">
                {statusConfirmModal.secondaryButtonText && statusConfirmModal.onSecondaryConfirm && (
                  <button
                    type="button"
                    onClick={() => {
                      const secAction = statusConfirmModal.onSecondaryConfirm!;
                      setStatusConfirmModal(null);
                      secAction();
                    }}
                    className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl border border-neutral-300 transition-colors cursor-pointer"
                  >
                    {statusConfirmModal.secondaryButtonText}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const action = statusConfirmModal.onConfirm;
                    setStatusConfirmModal(null);
                    action();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{statusConfirmModal.confirmButtonText || 'Xác Nhận'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Customer Sub-Status Modal with Multi-call History */}
      {callingModalItem && (
        <CustomerCallModal
          isOpen={Boolean(callingModalItem)}
          onClose={() => setCallingModalItem(null)}
          ticketNumber={callingModalItem.ticketNumber}
          customerName={callingModalItem.customerName}
          customerPhone={callingModalItem.customerPhone}
          itemDetail={`${callingModalItem.partName || "Linh kiện"}${callingModalItem.partCode ? ` (${callingModalItem.partCode})` : ""}${callingModalItem.model ? ` - Model: ${callingModalItem.model}` : ""}`}
          initialCalledDate={callingModalItem.calledCustomerDate}
          initialSubStatus={callingModalItem.callSubStatus}
          initialAppointmentDate={callingModalItem.appointmentDate}
          initialNote={callingModalItem.callNote}
          callLogs={callingModalItem.callLogs}
          currentUserName={currentUser?.name}
          moduleType="shortage"
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
          currentUserName={currentUser?.name || 'Nhân viên'}
          initialMode={noteModalMode}
          onSaveNote={handleSaveNote}
          onDeleteNote={() => handleDeleteNote(noteModalItem)}
        />
      )}

      {/* Customer Holds Modal */}
      {showCustomerHoldsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden my-auto">
            <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600/30 rounded-lg border border-blue-500/40">
                  <PhoneCall className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base tracking-tight">
                    Danh Sách CLK / Gọi Đặt / Đặt Giữ SVD
                  </h3>
                  <p className="text-[11px] text-blue-200/80">
                    Tra cứu nhanh thông tin khách hàng đặt linh kiện , đặt giữ linh kiện , đặt chờ SVD.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerHoldsModal(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 border border-white/20"
              >
                ✕ Đóng
              </button>
            </div>
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-50/50">
              <CustomerHoldsTab
                shortageBookings={bookings}
                onNavigateToShortage={(ticket?: string) => {
                  setShowCustomerHoldsModal(false);
                  handleNavigateToMainTable(ticket);
                }}
                onOpenConvertToSvd={(item) => {
                  setShowCustomerHoldsModal(false);
                  handleOpenConvertToSvdModal(item);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Convert to SVD (Service Day Promotion) Modal */}
      {convertToSvdModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-neutral-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-500/40">
                  <Sparkles className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                    <span>Đổi Sang Đặt Giữ SVD (Khuyến Mãi Ngày Dịch Vụ)</span>
                  </h3>
                  <p className="text-xs text-indigo-200/80 font-medium">
                    Chuyển đổi linh hoạt từ Bước 1, 2a, 2, 3, 4 khi khách muốn áp dụng khuyến mãi SVD
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConvertToSvdModalItem(null)}
                className="text-fuchsia-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Ticket Summary Card */}
              <div className="bg-fuchsia-50/70 p-3.5 rounded-xl border border-fuchsia-200/80 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-neutral-900 text-sm bg-white px-2 py-0.5 rounded border border-fuchsia-200">
                      #{convertToSvdModalItem.ticketNumber}
                    </span>
                    <span className="font-bold text-neutral-800 text-xs">
                      {convertToSvdModalItem.customerName}
                    </span>
                    <span className="text-neutral-500 font-mono text-xs">
                      ({convertToSvdModalItem.customerPhone})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500 font-medium">Tiến độ hiện tại:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                        SHORTAGE_STATUS_CONFIG[convertToSvdModalItem.status]?.badgeBg ||
                        'bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      {SHORTAGE_STATUS_CONFIG[convertToSvdModalItem.status]?.label ||
                        convertToSvdModalItem.status}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-neutral-600 flex items-center gap-2 flex-wrap pt-1 border-t border-fuchsia-100">
                  <span>
                    Model:{' '}
                    <strong className="text-neutral-800">
                      {convertToSvdModalItem.model || 'Chưa có'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Linh kiện:{' '}
                    <strong className="text-neutral-800">
                      {convertToSvdModalItem.partName}
                    </strong>{' '}
                    {convertToSvdModalItem.partCode ? `(${convertToSvdModalItem.partCode})` : ''}
                  </span>
                </div>
              </div>

              {/* 1. Chọn bước tiến độ áp dụng */}
              <div className="space-y-2">
                <label className="block font-extrabold text-neutral-800 text-xs">
                  1. Chọn tiến độ quy trình áp dụng cho phiếu SVD:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { status: 'da_tao_phieu' as ShortageStatus, label: '1. Tạo phiếu' },
                    { status: 'da_xin_lk' as ShortageStatus, label: '2. Đã xin LK' },
                    { status: 'chua_xin_du_lk' as ShortageStatus, label: '2a. Chưa đủ LK' },
                    { status: 'da_nhap_kho' as ShortageStatus, label: '3. Nhập kho' },
                    { status: 'da_goi_kh' as ShortageStatus, label: '4. Đã gọi KH' },
                  ].map((st) => {
                    const isSelected = svdTargetStatus === st.status;
                    const isCurrent = convertToSvdModalItem.status === st.status;
                    return (
                      <button
                        key={st.status}
                        type="button"
                        onClick={() => setSvdTargetStatus(st.status)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-sm ring-2 ring-fuchsia-300'
                            : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{st.label}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                        {isCurrent && (
                          <span
                            className={`text-[9px] font-bold px-1 py-0.2 rounded self-start ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                            }`}
                          >
                            (Bước hiện tại)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 1. CẢNH BÁO LỰA CHỌN CHƯA PHÙ HỢP: Chưa có LK sẵn nhưng chọn bước 3, 4, 5 */}
                {!svdHasAvailableParts &&
                  (svdTargetStatus === 'da_nhap_kho' ||
                    svdTargetStatus === 'da_goi_kh' ||
                    svdTargetStatus === 'da_hoan_tat') && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 flex items-start gap-2.5 animate-in fade-in duration-150 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <p className="font-bold text-rose-900 flex items-center gap-1.5">
                        <span>⚠️ Cảnh báo: Lựa chọn tiến độ chưa phù hợp!</span>
                      </p>
                      <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                        Tình trạng linh kiện hiện tại là <strong>"Chưa có linh kiện sẵn"</strong> (đang ở bước xin linh kiện), nhưng bạn đang chọn <strong>{SHORTAGE_STATUS_CONFIG[svdTargetStatus]?.label || svdTargetStatus}</strong>.
                        <br />
                        • Nếu linh kiện <strong>đã có tại kho</strong>, vui lòng chuyển tình trạng thành <strong>"Đã có linh kiện sẵn"</strong>.
                        <br />
                        • Nếu linh kiện <strong>chưa về</strong>, vui lòng giữ nguyên bước xin LK (Bước 1 hoặc Bước 2) để tránh sai lệch dữ liệu kho.
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSvdHasAvailableParts(true)}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] cursor-pointer transition-colors inline-flex items-center gap-1 shadow-xs"
                        >
                          <Package className="w-3.5 h-3.5 text-white" />
                          <span>Chuyển sang "Đã có linh kiện sẵn"</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const fallback =
                              convertToSvdModalItem.status === 'da_nhap_kho' ||
                              convertToSvdModalItem.status === 'da_goi_kh'
                                ? 'da_xin_lk'
                                : convertToSvdModalItem.status;
                            setSvdTargetStatus(fallback);
                          }}
                          className="px-3 py-1 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold rounded-lg text-[11px] cursor-pointer transition-colors inline-flex items-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5 text-rose-600" />
                          <span>Về bước xin LK ({SHORTAGE_STATUS_CONFIG[convertToSvdModalItem.status]?.label || 'Bước 2. Đã xin LK'})</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. NHẮC NHỞ: Đã có sẵn LK nhưng chọn Bước 3 (Nhập kho) -> Khuyên chọn Bước 4 (Đã gọi KH) */}
                {svdHasAvailableParts && svdTargetStatus === 'da_nhap_kho' && (
                  <div className="p-3 bg-amber-50 border border-amber-300/90 rounded-xl text-amber-950 flex items-start gap-2.5 animate-in fade-in duration-150 shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <p className="font-bold text-amber-900 flex items-center gap-1.5">
                        <span>Nhắc nhở: Khuyên chọn Bước 4 (Đã gọi KH / Chờ khách lên)</span>
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Linh kiện đã có sẵn tại kho (Bước 3) và chuyển sang Đặt giữ SVD. Bạn nên chọn <strong>Bước 4 (Đã gọi KH)</strong> vì đã có đủ linh kiện và khách đã hẹn lịch Ngày Dịch Vụ SVD (10-12) để theo dõi thời gian và nhắc gọi lại nếu quá hạn.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSvdTargetStatus('da_goi_kh')}
                        className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] cursor-pointer transition-colors inline-flex items-center gap-1 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Chuyển sang Bước 4 (Đã gọi KH)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. THÔNG BÁO THUẬN LỢI: Phiếu ở bước 1-2 và chưa có sẵn LK -> Lưu ngay */}
                {!svdHasAvailableParts &&
                  (svdTargetStatus === 'da_tao_phieu' ||
                    svdTargetStatus === 'chua_xin_du_lk' ||
                    svdTargetStatus === 'da_xin_lk') && (
                  <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 flex items-center gap-2 animate-in fade-in duration-150 text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>
                      Phiếu giữ nguyên trạng thái <strong>{SHORTAGE_STATUS_CONFIG[svdTargetStatus]?.label}</strong> (Chưa có sẵn LK) và gắn nhãn Đặt Giữ SVD. Bấm <strong>Xác nhận</strong> bên dưới để lưu ngay!
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Tình trạng linh kiện tại kho */}
              <div className="space-y-1.5">
                <label className="block font-extrabold text-neutral-800 text-xs">
                  2. Tình trạng linh kiện SVD tại kho:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSvdHasAvailableParts(true);
                      if (
                        svdTargetStatus === 'da_tao_phieu' ||
                        svdTargetStatus === 'chua_xin_du_lk' ||
                        svdTargetStatus === 'da_xin_lk' ||
                        svdTargetStatus === 'da_nhap_kho'
                      ) {
                        setSvdTargetStatus('da_goi_kh');
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      svdHasAvailableParts
                        ? 'bg-fuchsia-50 border-fuchsia-400 text-fuchsia-950 font-bold ring-1 ring-fuchsia-300'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg ${
                        svdHasAvailableParts ? 'bg-fuchsia-600 text-white' : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs">📦 Đã có linh kiện sẵn / Đủ LK</div>
                      <div className="text-[10px] text-neutral-500">Tự động chuyển bước 4 (Chờ khách lên)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSvdHasAvailableParts(false);
                      if (
                        svdTargetStatus === 'da_nhap_kho' ||
                        svdTargetStatus === 'da_goi_kh' ||
                        svdTargetStatus === 'da_hoan_tat'
                      ) {
                        const fallback =
                          convertToSvdModalItem.status === 'da_nhap_kho' ||
                          convertToSvdModalItem.status === 'da_goi_kh'
                            ? 'da_xin_lk'
                            : convertToSvdModalItem.status;
                        setSvdTargetStatus(fallback);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      !svdHasAvailableParts
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-300'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg ${
                        !svdHasAvailableParts ? 'bg-amber-600 text-white' : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs">⏳ Chưa có linh kiện sẵn</div>
                      <div className="text-[10px] text-neutral-500">Giữ theo tiến độ xin LK thực tế</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Lý do & Ghi chú khuyến mãi SVD */}
              <div className="space-y-2">
                <label className="block font-extrabold text-neutral-800 text-xs">
                  3. Lý do áp dụng & Ghi chú khuyến mãi SVD:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '🎁 Áp dụng ưu đãi Ngày Dịch Vụ SVD (10-12 hằng tháng)',
                    '🎁 Khách hẹn ngày 10-12 SVD lên thay để nhận khuyến mãi',
                    '🎁 Khách mang máy về chờ ngày SVD lên nhận LK',
                    '🎁 Giảm giá linh kiện & miễn phí công thay SVD',
                    '🎁 Khách yêu cầu chuyển diện Đặt Giữ SVD',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSvdNoteOption(tag)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                        svdNoteOption === tag
                          ? 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-2xs font-bold'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-fuchsia-50 hover:text-fuchsia-900'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={svdCustomNote}
                  onChange={(e) => setSvdCustomNote(e.target.value)}
                  placeholder="Ghi chú bổ sung khác (nếu có)..."
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-900 font-medium focus:bg-white focus:border-fuchsia-600 outline-none text-xs"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-2 shrink-0">
              <div>
                {convertToSvdModalItem.customerKeepsPart && (
                  <button
                    type="button"
                    onClick={() => handleSaveConvertToSvd(true)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hủy chế độ Đặt giữ SVD</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConvertToSvdModalItem(null)}
                  className="px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConvertToSvd(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>
                    {convertToSvdModalItem.customerKeepsPart
                      ? 'Lưu Thiết Lập SVD'
                      : 'Xác Nhận Chuyển Sang Đặt Giữ SVD'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Sequence Warning Modal (Cảnh báo mốc thời gian các bước 1->5 bất hợp lý nhưng vẫn cho chọn/tiếp tục) */}
      {isDateWarningModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-amber-200 relative z-[101]">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-600/30 rounded-xl border border-amber-500/40">
                  <AlertTriangle className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-tight">Cảnh Báo Thứ Tự Thời Gian</h3>
                  <p className="text-[11px] text-amber-200/80">Phát hiện mốc thời gian không khớp theo tiến độ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDateWarningModalOpen(false);
                  setPendingSaveAction(null);
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs">
                <p className="font-bold text-amber-900 mb-2">
                  Các mốc thời gian giữa các bước (Bước 1 ➔ Bước 3 ➔ Bước 4 ➔ Bước 5) đang bị ngược hoặc không khớp theo trình tự:
                </p>
                <ul className="list-disc pl-4 space-y-1.5 text-[11.5px] text-amber-900">
                  {dateWarnings.map((warning, index) => (
                    <li key={index} className="font-medium leading-relaxed">{warning}</li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                💡 <span className="font-semibold text-neutral-800">Lưu ý:</span> Bạn vẫn có thể tiếp tục chọn/lưu mốc thời gian này nếu cố ý. Hệ thống chỉ cảnh báo để tránh nhầm lẫn ngày tháng.
              </p>
            </div>

            <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsDateWarningModalOpen(false);
                  setPendingSaveAction(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 rounded-lg cursor-pointer transition-colors"
              >
                Kiểm Tra Lại Ngày
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDateWarningModalOpen(false);
                  if (pendingSaveAction) {
                    pendingSaveAction();
                    setPendingSaveAction(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span>Vẫn Tiếp Tục Lưu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Assign / Edit Technician & Creator Modal */}
      {quickAssignItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/30 rounded-lg border border-blue-500/40">
                  <Wrench className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Phân Công Kỹ Thuật & User Tạo
                  </h3>
                  <p className="text-xs text-blue-200/80 font-mono">
                    Phiếu [{quickAssignItem.ticketNumber}] • KH: {quickAssignItem.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAssignItem(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickAssign} className="p-4 space-y-4 text-xs">
              {/* Linh kiện của phiếu */}
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-neutral-700">
                <div className="text-[11px] text-neutral-500 font-medium">Linh kiện cần xử lý:</div>
                <div className="font-bold text-neutral-900 text-xs mt-0.5">
                  {quickAssignItem.partName} {quickAssignItem.partCode ? `(${quickAssignItem.partCode})` : ''}
                </div>
                {quickAssignItem.model && (
                  <div className="text-[11px] text-neutral-600 font-medium mt-0.5">
                    Model: {quickAssignItem.model}
                  </div>
                )}
              </div>

              {/* 1. User Tạo Phiếu Field (Vị trí 1 theo yêu cầu) */}
              <div>
                <UserSelector
                  label="User Tạo Phiếu:"
                  value={quickCreatedBy}
                  onChange={(val) => setQuickCreatedBy(val)}
                  currentUser={currentUser}
                  isAdmin={currentUser?.role === 'admin'}
                  placeholder="Chọn hoặc tìm User tạo phiếu..."
                />
              </div>

              {/* 2. Kỹ Thuật Tạo Phiếu Field (Vị trí 2 theo yêu cầu) */}
              <div>
                <TechnicianSelector
                  label="Kỹ Thuật Tạo Phiếu:"
                  value={quickCreatorTech}
                  onChange={(val) => setQuickCreatorTech(val)}
                  technicians={masterTechnicians}
                  placeholder="Chọn hoặc tìm KTV tạo phiếu (ID / Tên)..."
                  currentUser={currentUser}
                  isAdmin={currentUser?.role === 'admin'}
                  onRequestNewTech={() => setIsRequestTechModalOpen(true)}
                  colorScheme="indigo"
                  icon={<Wrench className="w-4 h-4 text-indigo-600" />}
                />
              </div>

              {/* 3. Kỹ Thuật Xử Lý Field (Vị trí 3 theo yêu cầu) */}
              <div>
                <TechnicianSelector
                  label="Kỹ Thuật Xử Lý:"
                  value={quickTechName}
                  onChange={(val) => setQuickTechName(val)}
                  technicians={masterTechnicians}
                  placeholder="Chọn hoặc tìm KTV xử lý (ID / Tên)..."
                  currentUser={currentUser}
                  isAdmin={currentUser?.role === 'admin'}
                  onRequestNewTech={() => setIsRequestTechModalOpen(true)}
                  colorScheme="emerald"
                  icon={<Wrench className="w-4 h-4 text-emerald-600" />}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setQuickAssignItem(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lưu Phân Công</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Parts Analysis & Filter Modal */}
      <DuplicatePartsModal
        isOpen={showDuplicatePartsModal}
        onClose={() => setShowDuplicatePartsModal(false)}
        duplicateGroups={duplicatePartGroups}
        allBookingsCount={bookings.length}
        selectedDuplicatePartKey={selectedDuplicatePartKey}
        onSelectDuplicatePartKey={(key) => {
          setSelectedDuplicatePartKey(key);
          setSearchTerm('');
          setStatusFilter('all');
          if (key) {
            setShowDuplicateFilterOnly(false);
            setDuplicateFilterScope('pending_only');
          }
        }}
        onSendToLabelStudio={onSendToLabelStudio}
        onShowToast={onShowToast}
        onOpenEditModal={(ticket) => {
          setShowDuplicatePartsModal(false);
          handleOpenEditModal(ticket);
        }}
      />

      {/* User Request Technician Modal */}
      <RequestTechnicianModal
        isOpen={isRequestTechModalOpen}
        onClose={() => setIsRequestTechModalOpen(false)}
        currentUser={currentUser}
        onShowToast={(msg, type) => onShowToast(msg, type || 'info')}
      />

      {/* QR & Barcode Camera Scanner Modal for Shortage Manager Search */}
      {isQrScannerOpen && (
        <CameraBarcodeScannerModal
          isOpen={isQrScannerOpen}
          onClose={() => setIsQrScannerOpen(false)}
          customExtractCode={(raw) => extractShortageSearchCode(raw, allTicketNumbersSetRef.current).cleanCode}
          onScanSuccess={(scannedRawCode) => {
            const { cleanCode, originalRaw } = extractShortageSearchCode(scannedRawCode, allTicketNumbersSetRef.current);
            if (cleanCode) {
              setSearchTerm(cleanCode);
              setSearchScope('filtered');
              onShowToast(
                `Đã tìm thấy mã: "${cleanCode}"${cleanCode !== originalRaw ? ` (từ chuỗi QR: ${originalRaw.substring(0, 15)}...)` : ''}`,
                'success'
              );
              setIsQrScannerOpen(false);
            } else {
              onShowToast(`Không thể trích xuất mã từ chuỗi QR: ${scannedRawCode}`, 'error');
            }
          }}
        />
      )}
    </div>
  );
};
