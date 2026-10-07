import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  X,
  Check,
  RotateCcw,
  Clock,
  Sparkles,
  Filter,
} from 'lucide-react';

export type DateFilterMode =
  | 'all'
  | 'month'
  | 'custom'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'this_month'
  | 'last_month';

export interface DateFilterState {
  mode: DateFilterMode;
  selectedMonth: string; // 'YYYY-MM' e.g. '2026-09'
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
}

export interface AvailableMonthItem {
  key: string; // 'YYYY-MM'
  label: string; // 'Tháng 09/2026'
  count: number;
  year: number;
  month: number;
}

export interface DateRangeFilterProps {
  filterState: DateFilterState;
  onFilterChange: (newState: DateFilterState) => void;
  availableMonths: AvailableMonthItem[];
  filteredCount?: number;
  totalCount?: number;
  itemLabel?: string;
  className?: string;
  align?: 'left' | 'right';
  compact?: boolean;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  filterState,
  onFilterChange,
  availableMonths,
  filteredCount,
  totalCount,
  itemLabel = 'phiếu',
  className = '',
  align = 'left',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'month' | 'range'>(
    filterState.mode === 'custom' ||
      filterState.mode === 'today' ||
      filterState.mode === 'yesterday' ||
      filterState.mode === 'last7days' ||
      filterState.mode === 'last30days'
      ? 'range'
      : 'month'
  );

  // Local state for custom range inputs
  const [tempStartDate, setTempStartDate] = useState(filterState.startDate || '');
  const [tempEndDate, setTempEndDate] = useState(filterState.endDate || '');
  const [tempMonth, setTempMonth] = useState(filterState.selectedMonth || '');

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Coordinates for Portal positioning
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    placeAbove: boolean;
  }>({
    left: 0,
    width: 380,
    placeAbove: false,
  });

  // Calculate coordinates relative to viewport
  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.min(380, window.innerWidth - 20);

    // Calculate horizontal placement
    let left = align === 'right' ? rect.right - dropdownWidth : rect.left;
    if (left + dropdownWidth > window.innerWidth - 10) {
      left = window.innerWidth - dropdownWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }

    // Calculate vertical placement (check if enough space below)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = 440;
    const placeAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    if (placeAbove) {
      setCoords({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width: dropdownWidth,
        placeAbove: true,
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left,
        width: dropdownWidth,
        placeAbove: false,
      });
    }
  }, [align]);

  // Sync temp inputs when filterState changes from outside
  useEffect(() => {
    setTempStartDate(filterState.startDate || '');
    setTempEndDate(filterState.endDate || '');
    setTempMonth(filterState.selectedMonth || '');
    if (
      filterState.mode === 'custom' ||
      filterState.mode === 'today' ||
      filterState.mode === 'yesterday' ||
      filterState.mode === 'last7days' ||
      filterState.mode === 'last30days'
    ) {
      setActiveTab('range');
    } else {
      setActiveTab('month');
    }
  }, [filterState]);

  // Recalculate coordinates on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Get human-readable description of the current filter
  const filterLabel = useMemo(() => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    switch (filterState.mode) {
      case 'all':
        return 'Tất cả thời gian';
      case 'this_month':
        return `Tháng này (${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()})`;
      case 'last_month':
        return `Tháng trước (${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}/${lastMonthDate.getFullYear()})`;
      case 'month': {
        if (!filterState.selectedMonth) return 'Tất cả các tháng';
        const parts = filterState.selectedMonth.split('-');
        if (parts.length === 2) {
          return `Tháng ${parts[1]}/${parts[0]}`;
        }
        return `Tháng ${filterState.selectedMonth}`;
      }
      case 'today':
        return 'Hôm nay';
      case 'yesterday':
        return 'Hôm qua';
      case 'last7days':
        return '7 ngày qua';
      case 'last30days':
        return '30 ngày qua';
      case 'custom': {
        if (filterState.startDate && filterState.endDate) {
          const sParts = filterState.startDate.split('-');
          const eParts = filterState.endDate.split('-');
          const sFormatted =
            sParts.length === 3 ? `${sParts[2]}/${sParts[1]}/${sParts[0]}` : filterState.startDate;
          const eFormatted =
            eParts.length === 3 ? `${eParts[2]}/${eParts[1]}/${eParts[0]}` : filterState.endDate;
          if (filterState.startDate === filterState.endDate) {
            return `Ngày ${sFormatted}`;
          }
          return `${sFormatted} → ${eFormatted}`;
        } else if (filterState.startDate) {
          const sParts = filterState.startDate.split('-');
          const sFormatted =
            sParts.length === 3 ? `${sParts[2]}/${sParts[1]}/${sParts[0]}` : filterState.startDate;
          return `Từ ${sFormatted}`;
        } else if (filterState.endDate) {
          const eParts = filterState.endDate.split('-');
          const eFormatted =
            eParts.length === 3 ? `${eParts[2]}/${eParts[1]}/${eParts[0]}` : filterState.endDate;
          return `Đến ${eFormatted}`;
        }
        return 'Khoảng ngày tùy chọn';
      }
      default:
        return 'Lọc thời gian';
    }
  }, [filterState]);

  const isFilteringActive = filterState.mode !== 'all';

  // Helper date generators for presets
  const handleSelectPreset = (preset: DateFilterMode) => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (preset === 'all') {
      onFilterChange({
        mode: 'all',
        selectedMonth: '',
        startDate: '',
        endDate: '',
      });
      setIsOpen(false);
      return;
    }

    if (preset === 'this_month') {
      onFilterChange({
        mode: 'this_month',
        selectedMonth: currentMonthStr,
        startDate: '',
        endDate: '',
      });
      setIsOpen(false);
      return;
    }

    if (preset === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
      onFilterChange({
        mode: 'last_month',
        selectedMonth: lastMonthStr,
        startDate: '',
        endDate: '',
      });
      setIsOpen(false);
      return;
    }

    if (preset === 'today') {
      onFilterChange({
        mode: 'today',
        selectedMonth: '',
        startDate: todayStr,
        endDate: todayStr,
      });
      setIsOpen(false);
      return;
    }

    if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      onFilterChange({
        mode: 'yesterday',
        selectedMonth: '',
        startDate: yestStr,
        endDate: yestStr,
      });
      setIsOpen(false);
      return;
    }

    if (preset === 'last7days') {
      const limit = new Date(now);
      limit.setDate(limit.getDate() - 7);
      const startStr = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
      onFilterChange({
        mode: 'last7days',
        selectedMonth: '',
        startDate: startStr,
        endDate: todayStr,
      });
      setIsOpen(false);
      return;
    }

    if (preset === 'last30days') {
      const limit = new Date(now);
      limit.setDate(limit.getDate() - 30);
      const startStr = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
      onFilterChange({
        mode: 'last30days',
        selectedMonth: '',
        startDate: startStr,
        endDate: todayStr,
      });
      setIsOpen(false);
      return;
    }
  };

  const handleSelectSpecificMonth = (monthKey: string) => {
    onFilterChange({
      mode: 'month',
      selectedMonth: monthKey,
      startDate: '',
      endDate: '',
    });
    setIsOpen(false);
  };

  const handleApplyCustomRange = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tempStartDate && !tempEndDate) {
      onFilterChange({
        mode: 'all',
        selectedMonth: '',
        startDate: '',
        endDate: '',
      });
    } else {
      onFilterChange({
        mode: 'custom',
        selectedMonth: '',
        startDate: tempStartDate,
        endDate: tempEndDate,
      });
    }
    setIsOpen(false);
  };

  const handleResetFilter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTempStartDate('');
    setTempEndDate('');
    setTempMonth('');
    onFilterChange({
      mode: 'all',
      selectedMonth: '',
      startDate: '',
      endDate: '',
    });
    setIsOpen(false);
  };

  // Get current date strings for quick reference
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button - Rõ ràng, Nổi bật, Trực quan */}
      <div className="inline-flex items-center">
        <button
          ref={buttonRef}
          type="button"
          id="btn-date-filter-toggle"
          onClick={() => {
            updateCoords();
            setIsOpen(!isOpen);
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border select-none ${
            isFilteringActive
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-500/25 hover:bg-emerald-700'
              : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-300 hover:border-neutral-400 shadow-2xs'
          }`}
          title="Bấm để lọc danh sách phiếu theo tháng tạo hoặc khoảng ngày"
        >
          <Calendar
            className={`w-3.5 h-3.5 shrink-0 ${isFilteringActive ? 'text-white' : 'text-emerald-600'}`}
          />
          <span className="truncate max-w-[170px] sm:max-w-[220px]">
            {filterLabel}
          </span>
          {isFilteringActive && filteredCount !== undefined && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-800 text-emerald-100 leading-none">
              {filteredCount}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
              isFilteringActive ? 'text-emerald-200' : 'text-neutral-400'
            } ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Nút Xóa nhanh bộ lọc khi đang lọc */}
        {isFilteringActive && (
          <button
            type="button"
            onClick={handleResetFilter}
            className="ml-1 p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer border border-transparent hover:border-rose-200"
            title="Xóa lọc thời gian, xem tất cả"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Panel Rendered via Portal Directly to document.body (Never Clipped!) */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.placeAbove ? undefined : coords.top,
              bottom: coords.placeAbove ? coords.bottom : undefined,
              left: coords.left,
              width: coords.width,
              zIndex: 99999,
            }}
            className="bg-white rounded-xl shadow-2xl border border-stone-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="p-3 bg-gradient-to-r from-stone-50 to-neutral-100 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <CalendarRange className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-black text-stone-900 uppercase tracking-wide">
                    Lọc Thời Gian Tạo Phiếu
                  </h3>
                  <p className="text-[10px] text-stone-500 font-medium">
                    Chọn xem theo tháng hoặc khoảng ngày cụ thể
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isFilteringActive && (
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-colors border border-rose-200"
                    title="Bỏ lọc và xem toàn bộ"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Xem tất cả</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-md transition-colors cursor-pointer"
                  title="Đóng cửa sổ lọc"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode Tabs: Theo Tháng / Chọn Khoảng Ngày */}
            <div className="p-2 border-b border-stone-200 bg-stone-50/70 flex gap-1.5">
              <button
                type="button"
                id="tab-filter-by-month"
                onClick={() => setActiveTab('month')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'month'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Theo Từng Tháng</span>
              </button>
              <button
                type="button"
                id="tab-filter-by-range"
                onClick={() => setActiveTab('range')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'range'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Khoảng Ngày (Từ - Đến)</span>
              </button>
            </div>

            {/* Tab Content: Theo Tháng */}
            {activeTab === 'month' && (
              <div className="p-3 space-y-3 max-h-[380px] overflow-y-auto">
                {/* Quick Month Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('this_month')}
                    className={`p-2.5 rounded-lg text-xs text-left border transition-all cursor-pointer flex items-center justify-between ${
                      filterState.mode === 'this_month' ||
                      (filterState.mode === 'month' && filterState.selectedMonth === currentMonthKey)
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-500 ring-2 ring-emerald-400/20 font-bold shadow-2xs'
                        : 'bg-white border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-bold">Tháng này</span>
                    </div>
                    <span className="text-[10px] text-emerald-800 font-black bg-emerald-100 px-1.5 py-0.5 rounded">
                      T{now.getMonth() + 1}/{now.getFullYear()}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPreset('last_month')}
                    className={`p-2.5 rounded-lg text-xs text-left border transition-all cursor-pointer flex items-center justify-between ${
                      filterState.mode === 'last_month'
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-500 ring-2 ring-emerald-400/20 font-bold shadow-2xs'
                        : 'bg-white border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-stone-500" />
                      <span className="font-bold">Tháng trước</span>
                    </div>
                    <span className="text-[10px] text-stone-700 font-black bg-stone-100 px-1.5 py-0.5 rounded">
                      T{now.getMonth() === 0 ? 12 : now.getMonth()}
                    </span>
                  </button>
                </div>

                {/* All Months Reset Option */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('all')}
                  className={`w-full p-2.5 rounded-lg text-xs text-left border transition-all cursor-pointer flex items-center justify-between ${
                    filterState.mode === 'all'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-500 ring-2 ring-emerald-400/20 font-bold shadow-2xs'
                      : 'bg-white border-stone-200 hover:border-emerald-300 hover:bg-stone-50 text-stone-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-stone-500" />
                    <span className="font-bold">Tất cả các tháng (Xem toàn bộ)</span>
                  </div>
                  {totalCount !== undefined && (
                    <span className="text-[11px] text-stone-600 font-extrabold bg-stone-100 px-2 py-0.5 rounded-md">
                      {totalCount} {itemLabel}
                    </span>
                  )}
                </button>

                {/* List of Months with Available Data */}
                <div className="pt-1">
                  <div className="text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1.5 px-0.5 flex items-center justify-between">
                    <span>Tháng có dữ liệu phiếu ({availableMonths.length})</span>
                    <span className="text-[10px] lowercase font-normal text-stone-400">
                      bấm để xem
                    </span>
                  </div>

                  {availableMonths.length === 0 ? (
                    <div className="text-center py-4 text-xs text-stone-400 italic bg-stone-50 rounded-lg border border-dashed border-stone-200">
                      Chưa có dữ liệu phiếu
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {availableMonths.map((m) => {
                        const isSelected =
                          filterState.mode === 'month' && filterState.selectedMonth === m.key;
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => handleSelectSpecificMonth(m.key)}
                            className={`w-full px-3 py-2 rounded-lg text-xs text-left border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black ring-1 ring-emerald-400/30 shadow-2xs'
                                : 'bg-white hover:bg-emerald-50/40 border-stone-200 text-stone-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  isSelected ? 'bg-emerald-600 ring-2 ring-emerald-300' : 'bg-stone-300'
                                }`}
                              />
                              <span className="font-bold">{m.label}</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {m.count} {itemLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Month Picker Input */}
                <div className="pt-2 border-t border-stone-200 flex items-center gap-2 bg-stone-50 p-2 rounded-lg">
                  <label className="text-[11px] font-bold text-stone-700 shrink-0">
                    Tháng khác:
                  </label>
                  <input
                    type="month"
                    value={tempMonth}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTempMonth(val);
                      if (val) {
                        handleSelectSpecificMonth(val);
                      }
                    }}
                    className="flex-1 px-2.5 py-1 text-xs border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-stone-800"
                  />
                </div>
              </div>
            )}

            {/* Tab Content: Khoảng Ngày */}
            {activeTab === 'range' && (
              <div className="p-3 space-y-3 max-h-[390px] overflow-y-auto">
                {/* Quick Presets */}
                <div>
                  <div className="text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1.5 px-0.5">
                    Chọn nhanh khoảng thời gian
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('today')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                        filterState.mode === 'today'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('yesterday')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                        filterState.mode === 'yesterday'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      Hôm qua
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('last7days')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                        filterState.mode === 'last7days'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      7 ngày qua
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('last30days')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                        filterState.mode === 'last30days'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      30 ngày qua
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('this_month')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                        filterState.mode === 'this_month'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      Tháng này
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('all')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                        filterState.mode === 'all'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      Tất cả
                    </button>
                  </div>
                </div>

                {/* Custom Date Form */}
                <form
                  onSubmit={handleApplyCustomRange}
                  className="pt-2.5 border-t border-stone-200 space-y-2.5"
                >
                  <div className="text-[10px] font-black text-stone-500 uppercase tracking-wider px-0.5">
                    Tùy chỉnh khoảng ngày
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Từ ngày (Bắt đầu):
                      </label>
                      <input
                        type="date"
                        value={tempStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Đến ngày (Kết thúc):
                      </label>
                      <input
                        type="date"
                        value={tempEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleResetFilter}
                      className="flex-1 py-2 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer border border-stone-300"
                    >
                      Đặt lại
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Áp dụng lọc</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Footer Info */}
            <div className="p-2.5 bg-stone-100/90 border-t border-stone-200 text-center text-[11px] text-stone-600 flex items-center justify-between">
              <span>
                {isFilteringActive ? (
                  <>
                    Khớp: <b className="text-emerald-800 font-black">{filteredCount ?? 0}</b> /{' '}
                    {totalCount ?? 0} {itemLabel}
                  </>
                ) : (
                  <>
                    Tổng cộng:{' '}
                    <b className="text-stone-900 font-extrabold">{totalCount ?? 0}</b> {itemLabel}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-bold text-stone-700 hover:text-stone-950 px-2 py-0.5 rounded hover:bg-stone-200 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

