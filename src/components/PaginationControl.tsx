import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListFilter,
} from 'lucide-react';

export interface PaginationControlProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
  className?: string;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'phiếu',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const [inputPage, setInputPage] = useState<string>(String(safeCurrentPage));

  useEffect(() => {
    setInputPage(String(safeCurrentPage));
  }, [safeCurrentPage]);

  if (totalItems <= 0) {
    return null;
  }

  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (safeCurrentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (safeCurrentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(safeCurrentPage - 1);
        pages.push(safeCurrentPage);
        pages.push(safeCurrentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(inputPage, 10);
    if (!isNaN(pageNum)) {
      const clamped = Math.min(Math.max(1, pageNum), totalPages);
      onPageChange(clamped);
      setInputPage(String(clamped));
    } else {
      setInputPage(String(safeCurrentPage));
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs ${className}`}
    >
      {/* Left: Summary and Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div className="text-neutral-600 font-medium">
          Hiển thị{' '}
          <strong className="text-neutral-900 font-bold font-mono">
            {startItem.toLocaleString('vi-VN')}
          </strong>
          {' - '}
          <strong className="text-neutral-900 font-bold font-mono">
            {endItem.toLocaleString('vi-VN')}
          </strong>{' '}
          trong tổng số{' '}
          <strong className="text-indigo-700 font-bold font-mono">
            {totalItems.toLocaleString('vi-VN')}
          </strong>{' '}
          {itemLabel}
        </div>

        <div className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200">
          <ListFilter className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[11px] text-neutral-500 font-medium">Mỗi trang:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = parseInt(e.target.value, 10);
              onPageSizeChange(newSize);
            }}
            className="bg-transparent font-bold text-neutral-800 border-none outline-none cursor-pointer py-0.5 text-xs pr-1"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / trang
              </option>
            ))}
            <option value={9999}>Tất cả ({totalItems})</option>
          </select>
        </div>
      </div>

      {/* Right: Pagination Controls & Jump Input */}
      <div className="flex flex-wrap items-center justify-center md:justify-end gap-1.5 w-full md:w-auto">
        {/* First Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage <= 1}
          title="Về trang đầu tiên"
          className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          title="Trang trước"
          className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:pointer-events-none font-semibold transition-colors cursor-pointer flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Trước</span>
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="w-7 h-7 flex items-center justify-center text-neutral-400 font-bold"
                >
                  ...
                </span>
              );
            }

            const isCurrent = page === safeCurrentPage;
            return (
              <button
                key={`page-${page}`}
                type="button"
                onClick={() => onPageChange(page as number)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center font-mono ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-xs scale-105 ring-2 ring-indigo-200'
                    : 'bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          title="Trang sau"
          className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:pointer-events-none font-semibold transition-colors cursor-pointer flex items-center gap-1"
        >
          <span className="hidden sm:inline">Sau</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage >= totalPages}
          title="Đến trang cuối cùng"
          className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>

        {/* Quick Jump Input */}
        {totalPages > 1 && (
          <form onSubmit={handlePageJump} className="flex items-center gap-1 ml-1 sm:ml-2">
            <span className="text-[11px] text-neutral-400">Đến:</span>
            <input
              type="text"
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onBlur={handlePageJump}
              className="w-10 p-1 text-center bg-neutral-50 border border-neutral-300 rounded font-mono font-bold text-neutral-900 focus:bg-white focus:border-indigo-600 outline-none text-xs"
              title={`Nhập trang từ 1 đến ${totalPages}`}
            />
            <span className="text-[11px] text-neutral-400 font-mono">/{totalPages}</span>
          </form>
        )}
      </div>
    </div>
  );
};
