import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  FileText,
  ChevronDown,
} from 'lucide-react';

export interface ExcelActionMenuProps {
  /**
   * Direct callback when user wants to import (e.g. triggering an external file input)
   */
  onImportClick?: () => void;
  /**
   * Alternatively, pass a file change handler to let ExcelActionMenu manage its own hidden file input
   */
  onFileSelect?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /**
   * Callback for exporting data to Excel
   */
  onExportClick: () => void;
  /**
   * Optional callback for downloading a sample template
   */
  onDownloadSampleClick?: () => void;
  /**
   * Disable export button (e.g., if list is empty)
   */
  exportDisabled?: boolean;
  /**
   * Current row count for export badge/hint
   */
  exportCount?: number;
  /**
   * Accepted file extensions for file input
   */
  accept?: string;
  /**
   * Custom label on the button. Default: "Nhập / Xuất Excel" (responsive: "Excel")
   */
  buttonText?: string;
  /**
   * Short text for mobile. Default: "Excel"
   */
  shortButtonText?: string;
  /**
   * Tooltip for button
   */
  title?: string;
  /**
   * Theme variant for the trigger button
   */
  theme?: 'default' | 'neutral' | 'emerald' | 'stone' | 'indigo';
  /**
   * Alignment of dropdown: 'left' or 'right'
   */
  align?: 'left' | 'right';
  /**
   * Extra classes for wrapper
   */
  className?: string;
  /**
   * Extra classes for trigger button
   */
  buttonClassName?: string;
}

export const ExcelActionMenu: React.FC<ExcelActionMenuProps> = ({
  onImportClick,
  onFileSelect,
  onExportClick,
  onDownloadSampleClick,
  exportDisabled = false,
  exportCount,
  accept = '.xlsx,.xls,.csv,.json,application/json',
  buttonText = 'Nhập / Xuất Excel',
  shortButtonText = 'Excel',
  title = 'Thao tác nạp và xuất file Excel',
  theme = 'default',
  align = 'left',
  className = '',
  buttonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalFileInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleTriggerImport = () => {
    setIsOpen(false);
    if (onFileSelect && internalFileInputRef.current) {
      internalFileInputRef.current.click();
    } else if (onImportClick) {
      onImportClick();
    }
  };

  const handleTriggerExport = () => {
    if (exportDisabled) return;
    setIsOpen(false);
    onExportClick();
  };

  const handleTriggerSample = () => {
    setIsOpen(false);
    if (onDownloadSampleClick) {
      onDownloadSampleClick();
    }
  };

  // Dynamic button theme styles
  let themeBtnStyle = 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200';
  if (theme === 'emerald') {
    themeBtnStyle = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200';
  } else if (theme === 'neutral') {
    themeBtnStyle = 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300';
  } else if (theme === 'indigo') {
    themeBtnStyle = 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200';
  }

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Hidden File Input if managed internally */}
      {onFileSelect && (
        <input
          type="file"
          ref={internalFileInputRef}
          accept={accept}
          onChange={(e) => {
            onFileSelect(e);
            if (internalFileInputRef.current) {
              internalFileInputRef.current.value = '';
            }
          }}
          className="hidden"
          aria-hidden="true"
        />
      )}

      {/* Unified Excel Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={title}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-bold text-xs rounded-lg cursor-pointer transition-all shadow-2xs active:scale-[0.98] ${themeBtnStyle} ${buttonClassName}`}
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="hidden sm:inline">{buttonText}</span>
        <span className="sm:hidden">{shortButtonText}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 shrink-0 opacity-70 ${
            isOpen ? 'rotate-180 text-emerald-700' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top`}
          role="menu"
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-black uppercase tracking-wider text-stone-600">
                Thao tác file Excel
              </span>
            </div>
            <span className="px-1.5 py-0.2 text-[9px] font-mono bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
              .xlsx / .xls
            </span>
          </div>

          <div className="p-1 space-y-0.5">
            {/* Option 1: Import Excel */}
            <button
              type="button"
              onClick={handleTriggerImport}
              className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-emerald-50/70 transition-colors group cursor-pointer"
              role="menuitem"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-stone-800 group-hover:text-emerald-900 flex items-center justify-between">
                  <span>Nhập từ file Excel</span>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1 rounded">
                    Tải lên
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                  Đọc danh sách từ file .xlsx, .xls, .csv hoặc .json
                </div>
              </div>
            </button>

            {/* Option 2: Export Excel */}
            <button
              type="button"
              onClick={handleTriggerExport}
              disabled={exportDisabled}
              className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors group cursor-pointer ${
                exportDisabled
                  ? 'opacity-50 cursor-not-allowed hover:bg-transparent'
                  : 'hover:bg-blue-50/70'
              }`}
              role="menuitem"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  exportDisabled
                    ? 'bg-stone-100 text-stone-400'
                    : 'bg-blue-100 group-hover:bg-blue-200 text-blue-700'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-xs font-bold flex items-center justify-between ${
                    exportDisabled
                      ? 'text-stone-400'
                      : 'text-stone-800 group-hover:text-blue-900'
                  }`}
                >
                  <span>Xuất ra file Excel</span>
                  {exportCount !== undefined && (
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                      {exportCount.toLocaleString('vi-VN')} dòng
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                  Tải bảng tính dữ liệu định dạng chuẩn Excel (.xlsx)
                </div>
              </div>
            </button>

            {/* Option 3: Sample Excel (if provided) */}
            {onDownloadSampleClick && (
              <button
                type="button"
                onClick={handleTriggerSample}
                className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-amber-50/70 transition-colors group cursor-pointer border-t border-stone-100 mt-1"
                role="menuitem"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-100 group-hover:bg-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-800 group-hover:text-amber-900 flex items-center justify-between">
                    <span>Tải file Excel mẫu</span>
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1 rounded">
                      Mẫu chuẩn
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                    Tải bảng mẫu có sẵn tiêu đề cột để điền nhanh
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
