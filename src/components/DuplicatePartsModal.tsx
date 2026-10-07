import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  DuplicatePartGroup,
  ShortageBookingItem,
  ShortageStatus,
} from '../types/shortage';
import { LabelItem } from '../types/label';
import { extractBarcodePartCode } from '../utils/barcodeExtractor';
import { matchesSmartSearch } from '../utils/searchHelper';
import { PaginationBar } from './duplicate-parts/PaginationBar';
import { DuplicateSummaryCards } from './duplicate-parts/DuplicateSummaryCards';
import { DuplicateAllocationTable } from './duplicate-parts/DuplicateAllocationTable';
import { DuplicateTicketsTable, UniqueTicketGroupItem } from './duplicate-parts/DuplicateTicketsTable';
import { DuplicateCardsList } from './duplicate-parts/DuplicateCardsList';
import {
  X,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  Boxes,
  Tag,
  Table,
  LayoutGrid,
  ClipboardCopy,
  ArrowUp,
} from 'lucide-react';

interface DuplicatePartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateGroups: DuplicatePartGroup[];
  allBookingsCount: number;
  selectedDuplicatePartKey: string | null;
  onSelectDuplicatePartKey: (key: string | null) => void;
  onSendToLabelStudio: (item: LabelItem) => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
  onOpenEditModal: (ticket: ShortageBookingItem) => void;
  isEmbedded?: boolean;
}

export const DuplicatePartsModal: React.FC<DuplicatePartsModalProps> = ({
  isOpen,
  onClose,
  duplicateGroups,
  allBookingsCount,
  selectedDuplicatePartKey,
  onSelectDuplicatePartKey,
  onSendToLabelStudio,
  onShowToast,
  onOpenEditModal,
  isEmbedded = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Filter scope: pending_only (khách chưa lên thay), need_request (B1+B2a), stocked (B3+B4), hot_only (>=3 khách), all (tất cả)
  const [scopeFilter, setScopeFilter] = useState<'pending_only' | 'need_request' | 'stocked' | 'hot_only' | 'all'>('pending_only');
  const [viewMode, setViewMode] = useState<'matrix' | 'cards' | 'tickets'>('matrix');
  const [sortBy, setSortBy] = useState<'active_tickets_desc' | 'active_qty_desc' | 'need_request_desc' | 'tickets_desc' | 'name_asc' | 'code_asc'>('active_tickets_desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset page to 1 whenever filters, search, sort, or viewMode change
  useEffect(() => {
    setCurrentPage(1);
  }, [scopeFilter, viewMode, searchTerm, sortBy, pageSize]);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopy = (text: string, id: string, label = 'Đã sao chép') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast(`${label}: ${text}`, 'success');
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    duplicateGroups.forEach((g) => {
      next[g.key] = true;
    });
    setExpandedKeys(next);
  };

  const handleCollapseAll = () => {
    setExpandedKeys({});
  };

  // High-level statistics
  const stats = useMemo(() => {
    const totalDuplicateParts = duplicateGroups.length;
    let totalPieces = 0;
    let activePieces = 0;
    let totalNeededToRequest = 0;
    let totalStockedWaiting = 0;
    let pendingDuplicatePartsCount = 0;
    let needRequestGroupsCount = 0;
    let stockedGroupsCount = 0;

    const uniqueTicketIds = new Set<string>();
    const uniqueActiveTicketIds = new Set<string>();
    const uniqueNeedRequestTicketIds = new Set<string>();
    const uniqueStockedTicketIds = new Set<string>();

    duplicateGroups.forEach((g) => {
      totalPieces += g.totalQuantity;
      activePieces += g.activeQuantity;
      totalNeededToRequest += g.neededToRequestQty;
      totalStockedWaiting += g.stockedWaitingCustomerQty;

      if (g.activeCount >= 1) {
        pendingDuplicatePartsCount += 1;
      }
      if (g.neededToRequestQty > 0) {
        needRequestGroupsCount += 1;
      }
      if (g.stockedWaitingCustomerQty > 0) {
        stockedGroupsCount += 1;
      }

      g.tickets.forEach((t) => {
        const isCompleted = t.ticket.status === 'da_hoan_tat';
        uniqueTicketIds.add(t.ticket.id);

        if (!isCompleted) {
          uniqueActiveTicketIds.add(t.ticket.id);
        }

        const isPartStocked =
          t.isPartStocked ??
          (t.ticket.status === 'da_nhap_kho' || t.ticket.status === 'da_goi_kh');
        const isPartRequested =
          t.isPartRequested ?? (t.ticket.status === 'da_xin_lk');

        // Phiếu thực sự cần xin thêm linh kiện này (chưa xin và chưa nhập kho)
        if (
          !isPartStocked &&
          !isPartRequested &&
          (t.ticket.status === 'da_tao_phieu' || t.ticket.status === 'chua_xin_du_lk')
        ) {
          uniqueNeedRequestTicketIds.add(t.ticket.id);
        }

        // Phiếu đã có linh kiện này tại kho
        if (isPartStocked) {
          uniqueStockedTicketIds.add(t.ticket.id);
        }
      });
    });

    return {
      totalDuplicateParts,
      pendingDuplicatePartsCount,
      totalTickets: uniqueTicketIds.size,
      totalPieces,
      activeTickets: uniqueActiveTicketIds.size,
      activePieces,
      totalNeededToRequest,
      totalStockedWaiting,
      needRequestGroupsCount,
      stockedGroupsCount,
      needRequestTicketsCount: uniqueNeedRequestTicketIds.size,
      stockedTicketsCount: uniqueStockedTicketIds.size,
    };
  }, [duplicateGroups]);

  // Filtered & Sorted Duplicate Groups
  const processedGroups = useMemo(() => {
    return duplicateGroups
      .filter((group) => {
        // Scope filter
        if (scopeFilter === 'pending_only') {
          if (group.activeCount === 0) return false;
        } else if (scopeFilter === 'need_request') {
          if (group.neededToRequestQty === 0) return false;
        } else if (scopeFilter === 'stocked') {
          if (group.stockedWaitingCustomerQty === 0) return false;
        } else if (scopeFilter === 'hot_only') {
          if (group.ticketCount < 3 && group.activeCount < 2) return false;
        }

        // Search term
        if (!searchTerm.trim()) return true;
        const term = searchTerm.trim();
        const cleanBarcodeTerm = extractBarcodePartCode(term).toLowerCase();
        const hasCleanBarcode = Boolean(cleanBarcodeTerm && cleanBarcodeTerm !== term.toLowerCase());

        const groupFields = [
          group.partName,
          group.partCode,
          group.model,
        ];

        const matchGroup =
          matchesSmartSearch(term, groupFields) ||
          (hasCleanBarcode && matchesSmartSearch(cleanBarcodeTerm, groupFields));

        const matchTicket = group.tickets.some((t) => {
          const creatorText = t.ticket.createdBy ? `Người tạo: ${t.ticket.createdBy} Tạo bởi: ${t.ticket.createdBy} User tạo: ${t.ticket.createdBy}` : '';
          const creatorTechText = t.ticket.creatorTechnician ? `Kỹ thuật tạo: ${t.ticket.creatorTechnician} KTV tạo: ${t.ticket.creatorTechnician} KT tạo: ${t.ticket.creatorTechnician} Kỹ thuật viên tạo: ${t.ticket.creatorTechnician}` : '';
          const repairTechText = t.ticket.technicianName ? `Kỹ thuật sửa: ${t.ticket.technicianName} KTV sửa: ${t.ticket.technicianName} KT sửa: ${t.ticket.technicianName} Kỹ thuật viên sửa: ${t.ticket.technicianName} Kỹ thuật xử lý: ${t.ticket.technicianName} KTV xử lý: ${t.ticket.technicianName}` : '';

          return matchesSmartSearch(term, [
            t.ticket.ticketNumber,
            t.ticket.customerName,
            t.ticket.customerPhone,
            t.ticket.note,
            t.ticket.createdBy,
            creatorText,
            t.ticket.creatorTechnician,
            creatorTechText,
            t.ticket.technicianName,
            repairTechText,
          ]);
        });

        return matchGroup || matchTicket;
      })
      .sort((a, b) => {
        if (sortBy === 'active_tickets_desc') {
          return b.activeCount - a.activeCount || b.activeQuantity - a.activeQuantity || b.ticketCount - a.ticketCount;
        }
        if (sortBy === 'active_qty_desc') {
          return b.activeQuantity - a.activeQuantity || b.activeCount - a.activeCount;
        }
        if (sortBy === 'need_request_desc') {
          return b.neededToRequestQty - a.neededToRequestQty || b.activeQuantity - a.activeQuantity;
        }
        if (sortBy === 'tickets_desc') {
          return b.ticketCount - a.ticketCount || b.totalQuantity - a.totalQuantity;
        }
        if (sortBy === 'name_asc') {
          return a.partName.localeCompare(b.partName, 'vi');
        }
        if (sortBy === 'code_asc') {
          return a.partCode.localeCompare(b.partCode, 'vi');
        }
        return 0;
      });
  }, [duplicateGroups, scopeFilter, searchTerm, sortBy]);

  // Grouped unique tickets for ticket-level drilldown (De-duplicated by Ticket ID, completely matching counts!)
  const uniqueProcessedTickets = useMemo(() => {
    const map = new Map<string, UniqueTicketGroupItem>();

    processedGroups.forEach((g) => {
      g.tickets.forEach((t) => {
        const isCompleted = t.ticket.status === 'da_hoan_tat';

        // Filter tickets strictly by current scopeFilter so ticket counts match the cards 100%
        if (scopeFilter === 'pending_only' && isCompleted) return;
        if (
          scopeFilter === 'need_request' &&
          t.ticket.status !== 'da_tao_phieu' &&
          t.ticket.status !== 'chua_xin_du_lk'
        )
          return;
        if (
          scopeFilter === 'stocked' &&
          t.ticket.status !== 'da_nhap_kho' &&
          t.ticket.status !== 'da_goi_kh'
        )
          return;

        const partEntry = {
          partGroupKey: g.key,
          partName: g.partName,
          partCode: g.partCode,
          model: g.model,
          quantity: t.partQuantity || 1,
          status: t.ticket.status,
        };

        const existing = map.get(t.ticket.id);
        if (existing) {
          if (!existing.parts.some((p) => p.partGroupKey === g.key)) {
            existing.parts.push(partEntry);
            existing.totalQuantity += partEntry.quantity;
          }
        } else {
          map.set(t.ticket.id, {
            ticket: t.ticket,
            parts: [partEntry],
            totalQuantity: partEntry.quantity,
            hasHold: Boolean(t.ticket.isCustomerCallHold),
            hasKeepsPart: Boolean(t.ticket.customerKeepsPart),
          });
        }
      });
    });

    const list = Array.from(map.values());

    // Sort tickets: Pending first, then by priority, then date
    return list.sort((a, b) => {
      const aDone = a.ticket.status === 'da_hoan_tat';
      const bDone = b.ticket.status === 'da_hoan_tat';
      if (aDone !== bDone) return aDone ? 1 : -1;

      const aPriority = (a.hasHold || a.hasKeepsPart) ? 1 : 0;
      const bPriority = (b.hasHold || b.hasKeepsPart) ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      return (a.ticket.bookingDate || '').localeCompare(b.ticket.bookingDate || '');
    });
  }, [processedGroups, scopeFilter]);

  // Total pieces represented in the current filtered tickets list
  const totalPiecesInFilteredTickets = useMemo(() => {
    return uniqueProcessedTickets.reduce((sum, item) => sum + item.totalQuantity, 0);
  }, [uniqueProcessedTickets]);

  // Paginated Slices
  const paginatedGroups = useMemo(() => {
    if (pageSize >= 9999) return processedGroups;
    const start = (currentPage - 1) * pageSize;
    return processedGroups.slice(start, start + pageSize);
  }, [processedGroups, currentPage, pageSize]);

  const paginatedTickets = useMemo(() => {
    if (pageSize >= 9999) return uniqueProcessedTickets;
    const start = (currentPage - 1) * pageSize;
    return uniqueProcessedTickets.slice(start, start + pageSize);
  }, [uniqueProcessedTickets, currentPage, pageSize]);

  // Total pages calculation
  const totalGroupPages = Math.max(1, Math.ceil(processedGroups.length / pageSize));
  const totalTicketPages = Math.max(1, Math.ceil(uniqueProcessedTickets.length / pageSize));

  // Copy full allocation / replenishment list for GCSM ordering
  const handleCopyReplenishmentList = () => {
    const itemsWithNeededQty = processedGroups.filter((g) => g.activeQuantity > 0 || g.neededToRequestQty > 0);
    if (itemsWithNeededQty.length === 0) {
      onShowToast('Không có linh kiện nào đang cần cấp hoặc xin thêm', 'info');
      return;
    }

    const lines = itemsWithNeededQty.map((g, idx) => {
      const codeStr = g.partCode !== 'N/A' ? `[${g.partCode}] ` : '';
      const neededStr = g.neededToRequestQty > 0 ? ` (Cần xin thêm GCSM: ${g.neededToRequestQty} cái)` : '';
      return `${idx + 1}. ${codeStr}${g.partName} - ${g.model || 'Tất cả model'}: ${g.activeCount} phiếu chưa xong, Tổng nợ khách: ${g.activeQuantity} cái${neededStr}`;
    });

    const text = `DANH SÁCH LINH KIỆN TRÙNG ĐANG ĐẶT CHỜ (CHƯA HOÀN TẤT):\n${lines.join('\n')}\n\nTổng cộng: ${itemsWithNeededQty.length} loại linh kiện`;
    handleCopy(text, 'copy-replenishment-all', 'Đã sao chép danh sách phân bổ linh kiện cần xin thêm');
  };

  if (!isOpen && !isEmbedded) return null;

  const content = (
    <div className={`bg-white w-full rounded-2xl ${isEmbedded ? 'border border-neutral-200 shadow-xs' : 'max-w-6xl shadow-2xl border border-neutral-200 max-h-[94vh] my-auto'} overflow-hidden flex flex-col`}>
      {/* Modal Header (Only shown when opened as popup modal, hidden when embedded in main view) */}
      {!isEmbedded && (
        <div className="bg-white border-b border-neutral-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-200">
              <Boxes className="w-5 h-5 text-blue-600 shrink-0" />
            </div>
            <h3 className="text-base font-bold text-stone-900">
              Phân Tích Linh Kiện Khách Đặt Trùng
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

        {/* Top Summary Metrics Bar (Fully Interactive with Click-to-Drilldown) */}
        <DuplicateSummaryCards
          scopeFilter={scopeFilter}
          viewMode={viewMode}
          sortBy={sortBy}
          stats={stats}
          allBookingsCount={allBookingsCount}
          onScopeFilterChange={(f) => {
            setScopeFilter(f);
            setCurrentPage(1);
            scrollToTop();
          }}
          onViewModeChange={(m) => {
            setViewMode(m);
            setCurrentPage(1);
            scrollToTop();
          }}
          onSortByChange={(s) => {
            setSortBy(s);
            setCurrentPage(1);
            scrollToTop();
          }}
          onShowToast={onShowToast}
        />

        {/* Toolbar: Scope Tabs, Search, View Switcher & Actions */}
        <div className="p-3 md:p-4 bg-white border-b border-neutral-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Scope Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-neutral-500 text-[11px] font-bold mr-1 flex items-center gap-1 shrink-0">
                <Filter className="w-3.5 h-3.5 text-indigo-600" /> Lọc Theo:
              </span>

              <button
                type="button"
                onClick={() => {
                  setScopeFilter('pending_only');
                  setCurrentPage(1);
                  scrollToTop();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1.5 shrink-0 ${
                  scopeFilter === 'pending_only'
                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-2 ring-purple-400/20'
                    : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                }`}
                title="Chỉ hiển thị các linh kiện có khách chưa lên thay (chưa hoàn tất bước 5)"
              >
                <span>🔥 Khách Chưa Lên Thay ({stats.pendingDuplicatePartsCount} loại • {stats.activeTickets} phiếu)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScopeFilter('need_request');
                  setCurrentPage(1);
                  scrollToTop();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1.5 shrink-0 ${
                  scopeFilter === 'need_request'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                    : 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
                }`}
                title="Linh kiện ở Bước 1 & Bước 2a cần tạo xin thêm trên GCSM"
              >
                <span>🔴 Cần Xin Thêm GCSM ({stats.needRequestGroupsCount} loại • {stats.needRequestTicketsCount} phiếu)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScopeFilter('stocked');
                  setCurrentPage(1);
                  scrollToTop();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1.5 shrink-0 ${
                  scopeFilter === 'stocked'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                }`}
                title="Linh kiện đã về kho ở Bước 3 & Bước 4 đang chờ khách lên thay"
              >
                <span>🟣 Đã Về Kho Chờ Khách ({stats.stockedGroupsCount} loại • {stats.stockedTicketsCount} phiếu)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScopeFilter('hot_only');
                  setCurrentPage(1);
                  scrollToTop();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all border shrink-0 ${
                  scopeFilter === 'hot_only'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                }`}
                title="Các linh kiện có từ 3 khách đặt trở lên"
              >
                <span>⚡ Trùng ≥3 Khách</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScopeFilter('all');
                  setCurrentPage(1);
                  scrollToTop();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all border shrink-0 ${
                  scopeFilter === 'all'
                    ? 'bg-neutral-800 text-white border-neutral-900 shadow-xs'
                    : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                }`}
              >
                <span>Tất Cả ({duplicateGroups.length} loại • {stats.totalTickets} phiếu)</span>
              </button>
            </div>

            {/* View Switcher (Matrix vs Cards vs Tickets) & Quick Copy Button */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="bg-neutral-100 p-1 rounded-xl border border-neutral-200 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('matrix');
                    setCurrentPage(1);
                    scrollToTop();
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    viewMode === 'matrix'
                      ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-black/5 font-extrabold'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                  title="Xem bảng phân bổ nhu cầu linh kiện để xin thêm trên GCSM"
                >
                  <Table className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Bảng Phân Bổ ({processedGroups.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('cards');
                    setCurrentPage(1);
                    scrollToTop();
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    viewMode === 'cards'
                      ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-black/5 font-extrabold'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                  title="Xem dạng thẻ phân nhóm theo linh kiện và khách hàng"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Dạng Thẻ ({processedGroups.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('tickets');
                    setCurrentPage(1);
                    scrollToTop();
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    viewMode === 'tickets'
                      ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-black/5 font-extrabold'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                  title="Xem bảng danh sách chi tiết tất cả từng số phiếu"
                >
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>DS Số Phiếu ({uniqueProcessedTickets.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyReplenishmentList}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                title="Sao chép toàn bộ danh sách mã linh kiện và số lượng cần xin thêm để dán vào GCSM"
              >
                <ClipboardCopy className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Sao Chép DS Xin LK</span>
              </button>
            </div>
          </div>

          {/* Search box & Sorting */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
            <div className="relative w-full sm:w-80 md:w-96">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã LK, model, số phiếu, khách, người tạo, KTV tạo, KTV sửa..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end text-xs">
              <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-[11px] text-neutral-500 font-medium">Sắp xếp:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-neutral-800 outline-none cursor-pointer"
                >
                  <option value="active_tickets_desc">Phiếu chưa xong nhiều nhất</option>
                  <option value="active_qty_desc">SL đang nợ khách nhiều nhất</option>
                  <option value="need_request_desc">SL cần xin thêm GCSM nhiều nhất</option>
                  <option value="tickets_desc">Tổng số lượt đặt nhiều nhất</option>
                  <option value="name_asc">Tên linh kiện (A ➔ Z)</option>
                  <option value="code_asc">Mã linh kiện (A ➔ Z)</option>
                </select>
              </div>

              {viewMode === 'cards' && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:text-indigo-600 hover:bg-neutral-100 rounded cursor-pointer"
                  >
                    Mở tất cả
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:text-indigo-600 hover:bg-neutral-100 rounded cursor-pointer"
                  >
                    Thu gọn
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div
          ref={scrollContainerRef}
          onScroll={(e) => {
            setShowScrollTop(e.currentTarget.scrollTop > 160);
          }}
          className="p-3 md:p-4 overflow-y-auto space-y-3.5 flex-1 bg-neutral-50/60 relative"
        >
          {processedGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-neutral-800 text-sm md:text-base">
                {searchTerm
                  ? 'Không tìm thấy linh kiện trùng khớp với từ khóa tìm kiếm'
                  : scopeFilter === 'pending_only'
                  ? 'Tuyệt vời! Không có linh kiện trùng nào đang bị tồn đọng chưa hoàn tất'
                  : 'Không có dữ liệu linh kiện trùng'}
              </h4>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                {scopeFilter === 'pending_only'
                  ? 'Tất cả các phiếu đặt linh kiện trùng trước đây đã được hoàn tất xử lý ở bước 5.'
                  : 'Hệ thống sẽ tự động phát hiện và phân tích khi có từ 2 phiếu trở lên đặt cùng một mã hoặc tên linh kiện.'}
              </p>
              {scopeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setScopeFilter('all')}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Xem tất cả linh kiện trùng ({duplicateGroups.length})
                </button>
              )}
            </div>
          ) : viewMode === 'matrix' ? (
            /* ================= VIEW MODE 1: MATRIX ALLOCATION TABLE ================= */
            <>
              <DuplicateAllocationTable
                groups={paginatedGroups}
                selectedDuplicatePartKey={selectedDuplicatePartKey}
                copiedId={copiedId}
                onSelectDuplicatePartKey={onSelectDuplicatePartKey}
                onCopy={handleCopy}
                onCloseModal={onClose}
                onShowToast={onShowToast}
                startIndex={(currentPage - 1) * pageSize}
              />
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalGroupPages}
                pageSize={pageSize}
                totalItems={processedGroups.length}
                itemLabel="loại linh kiện"
                onPageChange={(p) => {
                  setCurrentPage(p);
                  scrollToTop();
                }}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setCurrentPage(1);
                  scrollToTop();
                }}
                onScrollToTop={scrollToTop}
              />
            </>
          ) : viewMode === 'tickets' ? (
            /* ================= VIEW MODE 3: ALL TICKETS LIST DRILLDOWN ================= */
            <>
              <DuplicateTicketsTable
                tickets={paginatedTickets}
                totalTicketsCount={uniqueProcessedTickets.length}
                totalPiecesCount={totalPiecesInFilteredTickets}
                copiedId={copiedId}
                onCopy={handleCopy}
                onOpenEditModal={onOpenEditModal}
                onSelectDuplicatePartKey={onSelectDuplicatePartKey}
                onCloseModal={onClose}
                onShowToast={onShowToast}
                startIndex={(currentPage - 1) * pageSize}
              />
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalTicketPages}
                pageSize={pageSize}
                totalItems={uniqueProcessedTickets.length}
                itemLabel="phiếu khách hàng"
                onPageChange={(p) => {
                  setCurrentPage(p);
                  scrollToTop();
                }}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setCurrentPage(1);
                  scrollToTop();
                }}
                onScrollToTop={scrollToTop}
              />
            </>
          ) : (
            /* ================= VIEW MODE 2: CARDS & TICKETS LIST ================= */
            <>
              <DuplicateCardsList
                groups={paginatedGroups}
                selectedDuplicatePartKey={selectedDuplicatePartKey}
                expandedKeys={expandedKeys}
                copiedId={copiedId}
                startIndex={(currentPage - 1) * pageSize}
                onToggleExpand={toggleExpand}
                onSelectDuplicatePartKey={onSelectDuplicatePartKey}
                onSendToLabelStudio={onSendToLabelStudio}
                onOpenEditModal={onOpenEditModal}
                onCopy={handleCopy}
                onCloseModal={onClose}
                onShowToast={onShowToast}
              />
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalGroupPages}
                pageSize={pageSize}
                totalItems={processedGroups.length}
                itemLabel="loại linh kiện"
                onPageChange={(p) => {
                  setCurrentPage(p);
                  scrollToTop();
                }}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setCurrentPage(1);
                  scrollToTop();
                }}
                onScrollToTop={scrollToTop}
              />
            </>
          )}

          {/* Floating Scroll To Top Button */}
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className="sticky bottom-2 ml-auto z-40 bg-indigo-600/90 hover:bg-indigo-600 text-white p-2.5 rounded-full shadow-lg border border-indigo-400/50 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 animate-in fade-in"
              title="Cuộn lên đầu trang"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 md:p-4 bg-white border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-neutral-600">
            Đang hiển thị <strong>{processedGroups.length}</strong> / <strong>{duplicateGroups.length}</strong> loại linh kiện trùng (Có <strong>{uniqueProcessedTickets.length} phiếu</strong> phù hợp bộ lọc, tổng nhu cầu <strong>{totalPiecesInFilteredTickets} cái</strong>)
          </div>

          <div className="flex items-center gap-2">
            {selectedDuplicatePartKey && (
              <button
                type="button"
                onClick={() => {
                  onSelectDuplicatePartKey(null);
                  onShowToast('Đã bỏ bộ lọc linh kiện trùng', 'info');
                }}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer transition-colors"
              >
                ✕ Bỏ chọn lọc linh kiện
              </button>
            )}

            {!isEmbedded && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg cursor-pointer transition-colors"
              >
                Đóng Cửa Sổ
              </button>
            )}
          </div>
        </div>
      </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      {content}
    </div>
  );
};
