import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
} from 'lucide-react';

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onScrollToTop?: () => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  itemLabel,
  onPageChange,
  onPageSizeChange,
  onScrollToTop,
}) => {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="bg-white p-3 rounded-xl border border-neutral-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Left: Item Range & Total */}
      <div className="flex items-center gap-2 text-neutral-600 font-medium">
        <span>
          Hiển thị <strong className="text-neutral-900 font-bold">{startItem} - {endItem}</strong> trong tổng số{' '}
          <strong className="text-indigo-900 font-bold">{totalItems}</strong> {itemLabel}
        </span>
        {totalPages > 1 && (
          <span className="text-neutral-400 font-normal">
            (Trang <strong className="text-neutral-700 font-bold">{currentPage}</strong> / {totalPages})
          </span>
        )}
      </div>

      {/* Center & Right: Page Size selector & Navigation Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200">
          <span className="text-[11px] text-neutral-500 font-medium">Mỗi trang:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-neutral-800 outline-none cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={9999}>Tất cả</option>
          </select>
        </div>

        {/* Page Nav Buttons (Only show when totalPages > 1) */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white text-neutral-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Về trang đầu"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Prev Page */}
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white text-neutral-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Numeric Page Buttons */}
            {getPageNumbers().map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`dots-${idx}`} className="px-1 text-neutral-400 select-none">
                    ...
                  </span>
                );
              }

              const isCurrent = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange(p as number)}
                  className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-2xs font-black'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            {/* Next Page */}
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white text-neutral-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Trang sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white text-neutral-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Đến trang cuối"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scroll To Top Quick Action */}
        {onScrollToTop && (
          <button
            type="button"
            onClick={onScrollToTop}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition-colors"
            title="Cuộn lên đầu danh sách"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Về đầu trang</span>
          </button>
        )}
      </div>
    </div>
  );
};
