import React from 'react';
import { Layers, Tag, Boxes, PackagePlus, PhoneCall, Sparkles } from 'lucide-react';

interface DuplicateSummaryCardsProps {
  scopeFilter: 'pending_only' | 'need_request' | 'stocked' | 'hot_only' | 'all';
  viewMode: 'matrix' | 'cards' | 'tickets';
  sortBy: string;
  stats: {
    totalDuplicateParts: number;
    pendingDuplicatePartsCount: number;
    totalTickets: number;
    totalPieces: number;
    activeTickets: number;
    activePieces: number;
    totalNeededToRequest: number;
    totalStockedWaiting: number;
    needRequestGroupsCount: number;
    stockedGroupsCount: number;
    needRequestTicketsCount?: number;
    stockedTicketsCount?: number;
  };
  allBookingsCount: number;
  onScopeFilterChange: (filter: 'pending_only' | 'need_request' | 'stocked' | 'hot_only' | 'all') => void;
  onViewModeChange: (mode: 'matrix' | 'cards' | 'tickets') => void;
  onSortByChange: (sort: 'active_tickets_desc' | 'active_qty_desc' | 'need_request_desc' | 'tickets_desc' | 'name_asc' | 'code_asc') => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
}

export const DuplicateSummaryCards: React.FC<DuplicateSummaryCardsProps> = ({
  scopeFilter,
  viewMode,
  sortBy,
  stats,
  allBookingsCount,
  onScopeFilterChange,
  onViewModeChange,
  onSortByChange,
  onShowToast,
}) => {
  return (
    <div className="bg-slate-50 border-b border-neutral-200 p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
      {/* Card 1: LK Trùng Chưa Lên Thay (Key Metric) */}
      <button
        type="button"
        onClick={() => {
          onScopeFilterChange('pending_only');
          onShowToast(`Đang lọc ${stats.pendingDuplicatePartsCount} loại linh kiện trùng có khách chưa lên thay`, 'info');
        }}
        className={`text-left p-3 rounded-xl border transition-all cursor-pointer group ${
          scopeFilter === 'pending_only'
            ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-400/40 shadow-xs'
            : 'bg-white border-purple-200 hover:border-purple-300 hover:shadow-2xs'
        }`}
        title="Nhấp vào để lọc danh sách các loại linh kiện trùng khách chưa lên thay"
      >
        <div className="text-[11px] font-bold text-purple-900 flex items-center justify-between">
          <span className="group-hover:text-purple-700 transition-colors">LK Trùng Chưa Lên Thay</span>
          <Layers className="w-3.5 h-3.5 text-purple-600" />
        </div>
        <div className="text-2xl font-black text-purple-950 mt-0.5">
          {stats.pendingDuplicatePartsCount} <span className="text-xs font-semibold text-neutral-500">/ {stats.totalDuplicateParts} loại</span>
        </div>
        <div className="text-[10px] text-purple-700 font-semibold mt-0.5 flex items-center justify-between">
          <span>{stats.activeTickets} phiếu chưa hoàn tất (B5)</span>
          <span className="text-[9.5px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded group-hover:bg-purple-200 transition-colors">Bấm lọc</span>
        </div>
      </button>

      {/* Card 2: Số phiếu đang chờ (Direct drilldown to tickets list) */}
      <button
        type="button"
        onClick={() => {
          onScopeFilterChange('pending_only');
          onViewModeChange('tickets');
          onShowToast(`Đang hiển thị danh sách chi tiết đúng ${stats.activeTickets} phiếu khách đang chờ`, 'info');
        }}
        className={`text-left p-3 rounded-xl border transition-all cursor-pointer group ${
          viewMode === 'tickets' && scopeFilter === 'pending_only'
            ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/40 shadow-xs'
            : 'bg-white border-blue-200 hover:border-blue-300 hover:shadow-2xs'
        }`}
        title="Nhấp vào để xem ngay danh sách số phiếu và thông tin khách hàng đang chờ"
      >
        <div className="text-[11px] font-bold text-blue-900 flex items-center justify-between">
          <span className="group-hover:text-blue-700 transition-colors">Số Phiếu Đang Chờ</span>
          <Tag className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <div className="text-2xl font-black text-blue-950 mt-0.5">
          {stats.activeTickets} <span className="text-xs font-semibold text-neutral-500">/ {stats.totalTickets} phiếu trùng</span>
        </div>
        <div className="text-[10px] text-blue-700 font-semibold mt-0.5 flex items-center justify-between">
          <span>Khách chưa lên ({stats.activePieces} cái nợ)</span>
          <span className="text-[9.5px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded group-hover:bg-blue-200 transition-colors">Xem danh sách</span>
        </div>
      </button>

      {/* Card 3: Tổng SL đang nợ khách */}
      <button
        type="button"
        onClick={() => {
          onScopeFilterChange('pending_only');
          onSortByChange('active_qty_desc');
          onShowToast(`Sắp xếp theo số lượng nợ khách giảm dần (${stats.activePieces} cái)`, 'info');
        }}
        className={`text-left p-3 rounded-xl border transition-all cursor-pointer group ${
          sortBy === 'active_qty_desc' && scopeFilter === 'pending_only'
            ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
            : 'bg-white border-amber-200 hover:border-amber-300 hover:shadow-2xs'
        }`}
        title="Nhấp vào để lọc và sắp xếp theo số lượng nợ khách nhiều nhất"
      >
        <div className="text-[11px] font-bold text-amber-900 flex items-center justify-between">
          <span className="group-hover:text-amber-700 transition-colors">Tổng SL Đang Nợ Khách</span>
          <Boxes className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="text-2xl font-black text-amber-950 mt-0.5">
          {stats.activePieces} <span className="text-xs font-semibold text-neutral-500">cái (Tổng nhu cầu: {stats.totalPieces})</span>
        </div>
        <div className="text-[10px] text-amber-800 font-semibold mt-0.5 flex items-center justify-between">
          <span>Linh kiện khách đang đợi thay</span>
          <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded group-hover:bg-amber-200 transition-colors">Xếp theo SL</span>
        </div>
      </button>

      {/* Card 4: Cần xin thêm GCSM vs Đã về kho */}
      <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs flex flex-col justify-between">
        <div className="text-[11px] font-bold text-rose-900 flex items-center justify-between">
          <span>Tiến Độ LK (Cần Xin / Đã Về)</span>
          <PackagePlus className="w-3.5 h-3.5 text-rose-600" />
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {/* Button 1: Cần xin GCSM */}
          <button
            type="button"
            onClick={() => {
              onScopeFilterChange('need_request');
              onShowToast(`Đang lọc ${stats.totalNeededToRequest} cái cần xin thêm trên GCSM (${stats.needRequestGroupsCount} loại)`, 'info');
            }}
            className={`flex-1 py-1 px-1.5 rounded-lg border text-center cursor-pointer transition-all ${
              scopeFilter === 'need_request'
                ? 'bg-rose-500 text-white border-rose-600 shadow-2xs font-black'
                : 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100 font-bold'
            }`}
            title="Bấm để lọc các linh kiện/phiếu cần đặt thêm trên GCSM (Bước 1 & Bước 2a)"
          >
            <div className="text-sm font-black leading-tight">{stats.totalNeededToRequest} cái</div>
            <div className="text-[9.5px] uppercase tracking-wider opacity-90">Cần xin (B1, 2a)</div>
          </button>

          {/* Button 2: Ở kho chờ khách */}
          <button
            type="button"
            onClick={() => {
              onScopeFilterChange('stocked');
              onShowToast(`Đang lọc ${stats.totalStockedWaiting} cái đã về kho đang chờ khách (${stats.stockedGroupsCount} loại)`, 'info');
            }}
            className={`flex-1 py-1 px-1.5 rounded-lg border text-center cursor-pointer transition-all ${
              scopeFilter === 'stocked'
                ? 'bg-purple-600 text-white border-purple-700 shadow-2xs font-black'
                : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100 font-bold'
            }`}
            title="Bấm để lọc các linh kiện/phiếu đã có ở kho chờ khách lên thay (Bước 3 & Bước 4)"
          >
            <div className="text-sm font-black leading-tight">{stats.totalStockedWaiting} cái</div>
            <div className="text-[9.5px] uppercase tracking-wider opacity-90">Ở kho (B3, 4)</div>
          </button>
        </div>
        <div className="text-[10px] text-neutral-500 mt-1 text-center">
          Nhấn nút để lọc chính xác nhóm tiến độ
        </div>
      </div>
    </div>
  );
};
