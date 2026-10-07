import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  PhoneCall,
  Search,
  Phone,
  Copy,
  ExternalLink,
  Boxes,
  CheckCircle2,
  Clock,
  Package,
  Calendar,
  AlertCircle,
  Filter,
  User,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ShortageBookingItem } from '../types/shortage';
import { buildTicketSttMap, getTicketCreationTimestamp } from '../utils/shortageHelper';
import { extractBarcodePartCode } from '../utils/barcodeExtractor';
import { matchesSmartSearch } from '../utils/searchHelper';
import { PaginationControl } from './PaginationControl';

const GCSM_STOCK_URL = 'https://gcsm-sg.oppoit.com/part/stocks/stock-query';

interface CustomerHoldsTabProps {
  shortageBookings: ShortageBookingItem[];
  onNavigateToShortage: (ticketNumber?: string) => void;
  onOpenConvertToSvd?: (item: ShortageBookingItem) => void;
}

export const CustomerHoldsTab: React.FC<CustomerHoldsTabProps> = ({
  shortageBookings,
  onNavigateToShortage,
  onOpenConvertToSvd,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CALL_HOLD' | 'KEEP_PART' | 'STANDARD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL_ACTIVE');
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  // Copy helper
  const handleCopyText = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedToast(`✅ Đã sao chép ${label}: "${text}"`);
      setTimeout(() => {
        setCopiedToast(null);
      }, 2500);
    });
  }, []);

  // Check stock in GCSM
  const handleCheckStock = useCallback((code?: string) => {
    if (code && code.trim()) {
      navigator.clipboard.writeText(code.trim());
      setCopiedToast(`Đã sao chép mã SP "${code.trim()}" & mở cổng GCSM!`);
    } else {
      setCopiedToast('Đang mở cổng tra cứu tồn kho GCSM...');
    }
    setTimeout(() => setCopiedToast(null), 3000);
    window.open(GCSM_STOCK_URL, '_blank', 'noopener,noreferrer');
  }, []);

  // Filtered holds
  const filteredHolds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const cleanBarcodeTerm = term ? extractBarcodePartCode(term).toLowerCase() : '';
    const hasCleanBarcode = Boolean(cleanBarcodeTerm && cleanBarcodeTerm !== term);

    return shortageBookings.filter((b) => {
      // Search Term Match
      if (term) {
        const cleanTermAlphanumeric = term.replace(/[^a-zA-Z0-9]/g, '');
        const cleanTicketNumberAlphanumeric = (b.ticketNumber || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
        let matchesSearch = false;

        if (cleanTermAlphanumeric.length >= 4 && (cleanTicketNumberAlphanumeric.includes(cleanTermAlphanumeric) || cleanTermAlphanumeric.includes(cleanTicketNumberAlphanumeric))) {
          matchesSearch = true;
        } else {
          const partsText = (b.partsList || []).map((p) => `${p.partName || ''} ${p.partCode || ''} ${p.model || ''}`).join(' ');
          const creatorText = b.createdBy ? `Người tạo: ${b.createdBy} Tạo bởi: ${b.createdBy} User tạo: ${b.createdBy}` : '';
          const creatorTechText = b.creatorTechnician ? `Kỹ thuật tạo: ${b.creatorTechnician} KTV tạo: ${b.creatorTechnician} KT tạo: ${b.creatorTechnician} Kỹ thuật viên tạo: ${b.creatorTechnician}` : '';
          const repairTechText = b.technicianName ? `Kỹ thuật sửa: ${b.technicianName} KTV sửa: ${b.technicianName} KT sửa: ${b.technicianName} Kỹ thuật viên sửa: ${b.technicianName} Kỹ thuật xử lý: ${b.technicianName} KTV xử lý: ${b.technicianName} KT xử lý: ${b.technicianName}` : '';

          const targetFields = [
            b.ticketNumber,
            b.customerName,
            b.customerPhone,
            b.partName,
            b.partCode,
            b.model,
            b.location,
            b.note,
            b.createdBy,
            creatorText,
            b.creatorTechnician,
            creatorTechText,
            b.technicianName,
            repairTechText,
            partsText,
          ];

          matchesSearch =
            matchesSmartSearch(term, targetFields) ||
            (hasCleanBarcode && matchesSmartSearch(cleanBarcodeTerm, targetFields));
        }

        if (!matchesSearch) return false;
      }

      // Type Filter
      if (typeFilter === 'CALL_HOLD' && !b.isCustomerCallHold) return false;
      if (typeFilter === 'KEEP_PART' && !b.customerKeepsPart) return false;
      if (typeFilter === 'STANDARD' && (b.isCustomerCallHold || b.customerKeepsPart)) return false;

      // Status Filter
      if (statusFilter === 'ALL_ACTIVE' && b.status === 'da_hoan_tat') return false;
      if (statusFilter === 'READY' && !(b.status === 'da_nhap_kho' || b.status === 'da_goi_kh')) return false;
      if (statusFilter !== 'ALL' && statusFilter !== 'ALL_ACTIVE' && statusFilter !== 'READY' && b.status !== statusFilter) return false;

      return true;
    });
  }, [shortageBookings, searchTerm, typeFilter, statusFilter]);

  // Hiển thị bảng theo thứ tự mới nhất ở trên, cũ nhất ở dưới (đồng bộ toàn bộ hệ thống)
  // Số STT sẽ đánh ngược: phiếu tạo trước là 1, tiếp theo là 2, 3... N
  const sortedHolds = useMemo(() => {
    return [...filteredHolds].sort((a, b) => {
      const tA = getTicketCreationTimestamp(a);
      const tB = getTicketCreationTimestamp(b);
      if (tA !== tB) return tB - tA;
      return (b.ticketNumber || '').localeCompare(a.ticketNumber || '');
    });
  }, [filteredHolds]);

  // STT riêng cho Tab Khách Đặt Giữ: Phiếu tạo trước nhất là 1, tiếp theo là 2, 3... N
  const holdsSttMap = useMemo(() => {
    return buildTicketSttMap(sortedHolds);
  }, [sortedHolds]);

  // STT gốc của Bảng chính (Bảng 9)
  const mainTableSttMap = useMemo(() => {
    return buildTicketSttMap(shortageBookings);
  }, [shortageBookings]);

  // Pagination State for Holds Tab
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedHolds.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedHolds = useMemo(() => {
    if (pageSize >= 9999) return sortedHolds;
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedHolds.slice(start, start + pageSize);
  }, [sortedHolds, safeCurrentPage, pageSize]);

  // Statistics
  const stats = useMemo(() => {
    const active = shortageBookings.filter((b) => b.status !== 'da_hoan_tat');
    const callHolds = active.filter((b) => b.isCustomerCallHold);
    const keepParts = active.filter((b) => b.customerKeepsPart);
    const inStockReady = active.filter((b) => b.status === 'da_nhap_kho' || b.status === 'da_goi_kh');

    return {
      total: shortageBookings.length,
      activeCount: active.length,
      callHoldsCount: callHolds.length,
      keepPartsCount: keepParts.length,
      readyCount: inStockReady.length,
    };
  }, [shortageBookings]);

  return (
    <div className="flex flex-col h-full bg-white border border-amber-300/80 rounded-xl shadow-xs overflow-hidden animate-in fade-in duration-200">
      {/* Toast Notification */}
      {copiedToast && (
        <div className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-200" />
            <span>{copiedToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setCopiedToast(null)}
            className="text-amber-200 hover:text-white ml-2 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive KPI Cards (Thống kê dạng thẻ icon bấm vào để lọc) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-stone-50/80 border-b border-stone-200 text-xs">
        {/* Card 1: Đang Chờ Xử Lý */}
        <button
          type="button"
          onClick={() => {
            setTypeFilter('ALL');
            setStatusFilter('ALL_ACTIVE');
          }}
          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            typeFilter === 'ALL' && statusFilter === 'ALL_ACTIVE'
              ? 'bg-amber-50/90 border-2 border-amber-500 ring-2 ring-amber-400/30 text-amber-950 font-bold scale-[1.02] shadow-xs'
              : 'bg-white border-stone-200 hover:border-amber-300 text-stone-700'
          }`}
        >
          <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-stone-500 font-semibold truncate">Đang Chờ Xử Lý</div>
            <div className="text-sm font-black text-amber-950">{stats.activeCount} phiếu</div>
          </div>
        </button>

        {/* Card 2: Gọi Đặt (Blue Theme) */}
        <button
          type="button"
          onClick={() => {
            setTypeFilter('CALL_HOLD');
            if (statusFilter === 'ALL') setStatusFilter('ALL_ACTIVE');
          }}
          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            typeFilter === 'CALL_HOLD'
              ? 'bg-blue-50/90 border-2 border-blue-500 ring-2 ring-blue-400/30 text-blue-950 font-bold scale-[1.02] shadow-xs'
              : 'bg-white border-stone-200 hover:border-blue-300 text-stone-700'
          }`}
        >
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-blue-600 font-semibold truncate">Gọi Đặt</div>
            <div className="text-sm font-black text-blue-950">{stats.callHoldsCount} khách</div>
          </div>
        </button>

        {/* Card 3: SVD (Purple Theme) */}
        <button
          type="button"
          onClick={() => {
            setTypeFilter('KEEP_PART');
            if (statusFilter === 'ALL') setStatusFilter('ALL_ACTIVE');
          }}
          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            typeFilter === 'KEEP_PART'
              ? 'bg-purple-50/90 border-2 border-purple-500 ring-2 ring-purple-400/30 text-purple-950 font-bold scale-[1.02] shadow-xs'
              : 'bg-white border-stone-200 hover:border-purple-300 text-stone-700'
          }`}
        >
          <div className="p-2 bg-purple-100 text-purple-700 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-purple-600 font-semibold truncate">SVD</div>
            <div className="text-sm font-black text-purple-950">{stats.keepPartsCount} khách</div>
          </div>
        </button>

        {/* Card 4: Đã Nhập / Đã Gọi KH (Emerald Theme) */}
        <button
          type="button"
          onClick={() => {
            setTypeFilter('ALL');
            setStatusFilter('READY');
          }}
          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            statusFilter === 'READY'
              ? 'bg-emerald-50/90 border-2 border-emerald-500 ring-2 ring-emerald-400/30 text-emerald-950 font-bold scale-[1.02] shadow-xs'
              : 'bg-white border-stone-200 hover:border-emerald-300 text-stone-700'
          }`}
        >
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-emerald-700 font-semibold truncate">Đã Nhập / Đã Gọi KH</div>
            <div className="text-sm font-black text-emerald-950">{stats.readyCount} phiếu</div>
          </div>
        </button>
      </div>

      {/* Toolbar & Filters */}
      <div className="p-3 border-b border-stone-200 bg-stone-50/60 flex flex-wrap items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Tìm số phiếu, khách, SĐT, mã LK, model, người tạo, KTV tạo, KTV sửa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filters & Action Button (Right Position - theo mũi tên đỏ) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter Buttons */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg text-xs border border-stone-200">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Tất cả loại ({shortageBookings.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('CALL_HOLD')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${
                typeFilter === 'CALL_HOLD'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <PhoneCall className="w-3 h-3 text-blue-300" />
              <span>Gọi đặt</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('KEEP_PART')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${
                typeFilter === 'KEEP_PART'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-300" />
              <span>SVD</span>
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer font-medium text-stone-700"
          >
            <option value="ALL_ACTIVE">Chưa hoàn tất (Đang chờ)</option>
            <option value="ALL">Tất cả trạng thái (Bao gồm đã xong)</option>
            <option value="READY">3. Đã nhập kho / 4. Đã gọi KH ({stats.readyCount})</option>
            <option value="da_tao_phieu">1. Tạo phiếu</option>
            <option value="chua_xin_du_lk">2a. Chưa xin đủ LK</option>
            <option value="da_xin_lk">2. Đã xin LK</option>
            <option value="nhap_kho_chua_du_lk">3a. Nhập kho chưa đủ LK</option>
            <option value="da_nhap_kho">3. Đã nhập kho</option>
            <option value="da_goi_kh">4. Đã gọi KH</option>
            <option value="da_hoan_tat">5. Đã hoàn tất / Đã đóng</option>
          </select>

          {/* Nút Mở Trang Quản Lý Đặt Chờ (Đặt đúng vị trí mũi tên đỏ) */}
          <button
            type="button"
            onClick={() => onNavigateToShortage()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border border-orange-700"
            title="Chuyển đến trang Đặt Chờ Linh Kiện để tạo phiếu mới hoặc quản lý nâng cao"
          >
            <ExternalLink className="w-3.5 h-3.5 text-white" />
            <span>Mở Trang Quản Lý Đặt Chờ</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-auto min-h-[480px]">
        {sortedHolds.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 bg-neutral-50 flex flex-col items-center justify-center gap-2">
            <div className="p-3 bg-neutral-200/60 rounded-full">
              <Search className="w-6 h-6 text-neutral-400" />
            </div>
            <div className="font-semibold text-neutral-700">Không tìm thấy phiếu đặt giữ nào</div>
            <p className="text-xs text-neutral-500 max-w-sm">
              Thử thay đổi từ khóa tìm kiếm hoặc chuyển bộ lọc trạng thái để xem các phiếu khác.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-100 text-neutral-700 font-bold sticky top-0 z-10 border-b border-neutral-200">
              <tr>
                <th className="p-2.5 w-14 text-center text-neutral-700 font-bold">STT</th>
                <th className="p-2.5 w-[125px]">Số Phiếu</th>
                <th className="p-2.5 w-[140px]">Phân Loại Đặt</th>
                <th className="p-2.5 w-[200px]">Khách Hàng & SĐT</th>
                <th className="p-2.5 min-w-[240px]">Linh Kiện & Model</th>
                <th className="p-2.5 w-[135px]">Tiến Độ</th>
                <th className="p-2.5 w-[145px]">Ngày Tạo / Đã Gọi</th>
                <th className="p-2.5 w-[100px]">Vị Trí Kệ</th>
                <th className="p-2.5 min-w-[160px]">Ghi Chú</th>
                <th className="p-2.5 w-[115px] text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {paginatedHolds.map((hold, idx) => {
                const statusBadge = (() => {
                  switch (hold.status) {
                    case 'da_tao_phieu':
                      return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-[10px]">1. Tạo phiếu</span>;
                    case 'chua_xin_du_lk':
                      return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">2a. Chưa xin đủ LK</span>;
                    case 'da_xin_lk':
                      return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">2. Đã xin LK</span>;
                    case 'nhap_kho_chua_du_lk':
                      return <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-300 font-bold text-[10px]">3a. Nhập kho chưa đủ LK</span>;
                    case 'da_nhap_kho':
                      return <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[10px]">3. Đã nhập kho</span>;
                    case 'da_goi_kh':
                      return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[10px]">4. Đã gọi KH</span>;
                    case 'da_hoan_tat':
                      return hold.isCompletedWithoutRepair ? (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-semibold text-[10px]">🚫 Đã đóng</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">5. Đã hoàn tất</span>
                      );
                    default:
                      return <span className="px-2 py-0.5 rounded bg-neutral-50 text-neutral-600 text-[10px]">{hold.status}</span>;
                  }
                })();

                const displayStt = holdsSttMap.get(hold.id) ?? ((currentPage - 1) * pageSize + idx + 1);
                const globalStt = mainTableSttMap.get(hold.id);

                return (
                  <tr key={hold.id} className="hover:bg-amber-50/40 transition-colors">
                    {/* 1. STT: Thứ tự trong tab + #Số trên Bảng chính */}
                    <td className="p-2.5 text-center">
                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span
                          className="font-mono font-black text-neutral-900 text-xs"
                          title={`STT trong tab Khách giữ: ${displayStt}`}
                        >
                          {displayStt}
                        </span>
                        {globalStt && (
                          <span
                            className="font-mono text-[10px] text-neutral-500 font-bold bg-neutral-100 px-1 py-0.2 rounded border border-neutral-200 mt-0.5"
                            title={`Số thứ tự trên Bảng chính (Bảng 9): #${globalStt}`}
                          >
                            #{globalStt}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 font-mono font-bold text-neutral-900">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                          #{hold.ticketNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(hold.ticketNumber, 'số phiếu')}
                          className="text-neutral-400 hover:text-amber-700 p-0.5 rounded cursor-pointer transition-colors"
                          title="Sao chép số phiếu"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5">
                      {hold.isCustomerCallHold ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[11px]">
                          <PhoneCall className="w-3 h-3 text-blue-700 shrink-0" />
                          <span>{hold.hasAvailableParts ? '📞 Gọi đặt (Sẵn LK)' : '📞 Gọi đặt'}</span>
                        </span>
                      ) : hold.customerKeepsPart ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[11px]">
                          <Sparkles className="w-3 h-3 text-purple-700 shrink-0" />
                          <span>{hold.hasAvailableParts ? '🎁 SVD (Sẵn LK)' : '🎁 SVD'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 font-semibold text-[11px]">
                          <span>📋 Phiếu đặt chờ</span>
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-neutral-900 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{hold.customerName}</span>
                        {hold.customerName && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(hold.customerName, 'tên khách')}
                            className="text-neutral-400 hover:text-blue-600 p-0.5 rounded cursor-pointer transition-colors shrink-0"
                            title="Sao chép tên khách"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-neutral-600 font-mono text-[11px] mt-1">
                        <a
                          href={`tel:${hold.customerPhone}`}
                          className="hover:text-blue-600 hover:underline flex items-center gap-1 text-blue-700 font-semibold"
                          title="Bấm để gọi"
                        >
                          <Phone className="w-3 h-3 text-blue-600 shrink-0" />
                          <span>{hold.customerPhone}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyText(hold.customerPhone, 'SĐT khách')}
                          className="text-neutral-400 hover:text-blue-600 p-0.5 rounded cursor-pointer transition-colors shrink-0"
                          title="Sao chép SĐT"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-neutral-900 flex items-center gap-1">
                        <span>{hold.partName}</span>
                        {hold.partName && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(hold.partName, 'tên linh kiện')}
                            className="text-neutral-400 hover:text-amber-700 p-0.5 rounded cursor-pointer transition-colors shrink-0"
                            title="Sao chép tên LK"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                        {hold.model && (
                          <span className="font-medium text-neutral-700 bg-neutral-100 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                            <span>{hold.model}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(hold.model || '', 'Model')}
                              className="text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
                              title="Sao chép Model"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        )}
                        {hold.partCode && (
                          <span className="font-mono font-medium text-neutral-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                            <span>{hold.partCode}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(hold.partCode || '', 'Mã LK')}
                              className="text-neutral-400 hover:text-amber-700 p-0.5 cursor-pointer"
                              title="Sao chép mã LK"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        )}
                        {hold.partsList && hold.partsList.length > 1 && (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                            +{hold.partsList.length - 1} LK phụ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5">{statusBadge}</td>
                    <td className="p-2.5 text-neutral-600 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span>{hold.bookingDate || 'Chưa có'}</span>
                        {hold.bookingDate && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(hold.bookingDate, 'ngày tạo')}
                            className="text-neutral-400 hover:text-amber-700 p-0.5 rounded cursor-pointer"
                            title="Sao chép ngày tạo"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      {hold.calledCustomerDate && (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                          <span>📞 Đã gọi: {hold.calledCustomerDate}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 font-mono text-neutral-700">
                      {hold.location ? (
                        <span className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-300 font-bold text-[11px]">
                          {hold.location}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-neutral-600 max-w-[200px]">
                      {hold.note ? (
                        <div className="truncate font-sans italic text-[11px]" title={hold.note}>
                          {hold.note}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCheckStock(hold.partCode)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Kiểm tra tồn kho linh kiện này trên GCSM"
                        >
                          <Boxes className="w-3 h-3 text-amber-600" />
                          <span>GCSM</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateToShortage(hold.ticketNumber)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Đến trang quản lý và xem chi tiết phiếu này"
                        >
                          <ExternalLink className="w-3 h-3 text-blue-600" />
                          <span>Xem</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      {sortedHolds.length > 0 && (
        <div className="p-3 bg-white border-t border-amber-200/80">
          <PaginationControl
            currentPage={safeCurrentPage}
            totalItems={sortedHolds.length}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={(page) => {
              setCurrentPage(page);
            }}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="phiếu gọi đặt / SVD"
          />
        </div>
      )}

      {/* Footer Info */}
      <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between text-xs text-neutral-600">
        <div>
          Hiển thị <strong>{sortedHolds.length}</strong> / {shortageBookings.length} phiếu đặt giữ linh kiện
        </div>
        <div className="text-[11px] text-neutral-500">
          💡 Dữ liệu được đồng bộ Cloud thời gian thực giữa tất cả các máy trạm
        </div>
      </div>
    </div>
  );
};

