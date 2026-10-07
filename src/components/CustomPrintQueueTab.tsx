import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Printer,
  ExternalLink,
  FileCode,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Boxes,
  Eye,
  SlidersHorizontal,
  Layers,
  FileDown,
  ClipboardList,
  Sparkles,
  Info,
  ShieldCheck,
  Calendar,
  ScanLine,
} from 'lucide-react';
import { LabelItem, LabelConfig } from '../types/label';
import { LabelCard } from './LabelCard';
import {
  parseCustomPrintExcel,
  parseCustomPrintText,
  downloadCustomPrintSampleExcel,
  exportCustomPrintToExcel,
  getTodayFormattedDate,
} from '../utils/excelHelper';
import { PartAutocompleteCell } from './PartAutocompleteCell';
import { extractBarcodePartCode, findMasterItemByBarcode } from '../utils/barcodeExtractor';
import { matchesSmartSearch } from '../utils/searchHelper';

const GCSM_STOCK_URL = 'https://gcsm-sg.oppoit.com/part/stocks/stock-query';

function toIsoDate(dmyStr?: string): string {
  if (!dmyStr) return '';
  const parts = dmyStr.trim().split(/[/\-.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return '';
}

function formatDateToDmy(isoStr: string): string {
  if (!isoStr) return getTodayFormattedDate();
  const parts = isoStr.trim().split(/[/\-.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${d}/${m}/${y}`;
  }
  return isoStr;
}

interface CustomPrintQueueTabProps {
  customItems: LabelItem[];
  setCustomItems: React.Dispatch<React.SetStateAction<LabelItem[]>>;
  masterItems: LabelItem[];
  config: LabelConfig;
  onOpenPrintTab: (itemsToPrint: LabelItem[]) => void;
  onDownloadHtml: (itemsToPrint: LabelItem[]) => void;
  onDirectPrint: (itemsToPrint: LabelItem[]) => void;
}

export const CustomPrintQueueTab: React.FC<CustomPrintQueueTabProps> = ({
  customItems,
  setCustomItems,
  masterItems,
  config,
  onOpenPrintTab,
  onDownloadHtml,
  onDirectPrint,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [viewMode, setViewMode] = useState<'split' | 'table' | 'preview'>('split');
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isConfirmClearModalOpen, setIsConfirmClearModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newlyAddedRowId, setNewlyAddedRowId] = useState<string | null>(null);

  // Batch tools menu state (matching Image 1 & Image 2)
  const [showBatchTools, setShowBatchTools] = useState(false);
  const [batchQty, setBatchQty] = useState(1);
  const [batchDateISO, setBatchDateISO] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset page when search term changes or customItems length changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, customItems.length]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  // Copy helper
  const handleCopyText = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Đã sao chép ${label}: "${text}"`, 'success');
    });
  }, []);

  // Check stock in GCSM
  const handleCheckStock = useCallback((code?: string) => {
    if (code && code.trim()) {
      navigator.clipboard.writeText(code.trim());
      showToast(`Đã sao chép mã SP "${code.trim()}" & mở cổng GCSM!`, 'info');
    }
    window.open(GCSM_STOCK_URL, '_blank', 'noopener,noreferrer');
  }, []);

  // Handle Excel Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { items: parsedItems, matchedCount, unmatchedCount } = await parseCustomPrintExcel(file, masterItems);

      if (parsedItems.length === 0) {
        showToast('Không tìm thấy dòng dữ liệu hợp lệ trong file Excel.', 'error');
      } else {
        setCustomItems(parsedItems);
        showToast(
          `Đã nạp ${parsedItems.length} linh kiện (${matchedCount} khớp kho tổng 5731, ${unmatchedCount} mã mới)!`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Failed to parse Excel:', err);
      showToast(`Lỗi đọc file Excel: ${err?.message || 'Định dạng không hợp lệ'}`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Paste text
  const handleApplyPaste = () => {
    if (!pastedText.trim()) return;

    const { items: parsedItems, matchedCount, unmatchedCount } = parseCustomPrintText(pastedText, masterItems);

    if (parsedItems.length === 0) {
      showToast('Không nhận diện được mã linh kiện nào.', 'error');
      return;
    }

    setCustomItems((prev) => [...prev, ...parsedItems]);
    setIsPasteModalOpen(false);
    setPastedText('');
    showToast(
      `Đã thêm ${parsedItems.length} linh kiện từ danh sách dán (${matchedCount} khớp kho tổng, ${unmatchedCount} mã mới)!`,
      'success'
    );
  };

  // Toggle selection
  const handleToggleSelectAll = (checked: boolean) => {
    setCustomItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const handleToggleSelectItem = (id: string, checked: boolean) => {
    setCustomItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: checked } : item)));
  };

  // Auto-fill entire row when a suggestion is picked from master catalog
  const handleSelectMasterItemForRow = useCallback((rowId: string, masterItem: LabelItem) => {
    setCustomItems((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
          const cleanCode = extractBarcodePartCode(masterItem.code || item.code, masterItems);
          return {
            ...item,
            code: cleanCode,
            name: masterItem.name || item.name,
            model: masterItem.model || item.model,
            category: masterItem.category || item.category || 'Linh Kiện',
            location: masterItem.location || item.location || '',
            price: masterItem.price || item.price || '',
            date: item.date || getTodayFormattedDate(), // Maintain custom queue's independent date
          };
        }
        return item;
      })
    );
    showToast(
      `Đã tự động điền thông tin: ${masterItem.model ? `[${masterItem.model}] ` : ''}${masterItem.name || masterItem.code}`,
      'success'
    );
  }, [masterItems]);

  // Update item field with automatic barcode sanitization (stripping suffix after - or _)
  const handleUpdateItem = useCallback((id: string, field: keyof LabelItem, value: any) => {
    let finalVal = value;
    if (field === 'code' && typeof value === 'string') {
      finalVal = extractBarcodePartCode(value, masterItems);
    }

    setCustomItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: finalVal } : item)));

    // Auto-match exact item in master items if code was changed
    if (field === 'code' && typeof value === 'string' && finalVal) {
      const cleanCode = extractBarcodePartCode(value, masterItems);
      const matchedMaster = findMasterItemByBarcode(cleanCode, masterItems);
      if (matchedMaster) {
        handleSelectMasterItemForRow(id, matchedMaster);
      }
    }
  }, [masterItems, handleSelectMasterItemForRow]);

  // Global hardware barcode scanner listener (captures rapid barcode gun scans ending with Enter)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const activeTag = (activeEl?.tagName || '').toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      // Reset buffer if delay is too long (human typing is typically > 100ms per key)
      if (diff > 80) {
        buffer = '';
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          const scannedRaw = buffer.trim();
          buffer = '';
          const cleanCode = extractBarcodePartCode(scannedRaw, masterItems);
          const matchedMaster = findMasterItemByBarcode(cleanCode, masterItems);

          // If user scanned while focused inside an input cell for 'code'
          if (isInputFocused && activeEl instanceof HTMLInputElement) {
            const rowId = activeEl.getAttribute('data-row-id');
            const dataField = activeEl.getAttribute('data-field');
            if (dataField === 'code' && rowId) {
              e.preventDefault();
              activeEl.value = cleanCode;
              handleUpdateItem(rowId, 'code', cleanCode);
              if (matchedMaster) {
                handleSelectMasterItemForRow(rowId, matchedMaster);
              }
              showToast(
                `📷 Đã quét mã: ${cleanCode} ${matchedMaster ? `• ${matchedMaster.model ? `[${matchedMaster.model}] ` : ''}${matchedMaster.name}` : ''}`,
                'success'
              );
              return;
            }
          }

          // Only intercept if user is not in an active text input (or if they scanned while viewing table)
          if (!isInputFocused) {
            e.preventDefault();
            setCustomItems((prev) => {
              // Find an empty row first
              const emptyIdx = prev.findIndex((r) => !r.code.trim());
              if (emptyIdx >= 0) {
                return prev.map((r, idx) => {
                  if (idx === emptyIdx) {
                    return {
                      ...r,
                      code: matchedMaster?.code || cleanCode,
                      name: matchedMaster?.name || r.name || `Linh kiện ${cleanCode}`,
                      model: matchedMaster?.model || r.model || '',
                      category: matchedMaster?.category || r.category || 'Linh Kiện',
                      location: matchedMaster?.location || r.location || '',
                      price: matchedMaster?.price || r.price || '',
                      date: r.date || getTodayFormattedDate(),
                    };
                  }
                  return r;
                });
              } else {
                // Prepend new row
                const newRow: LabelItem = {
                  id: `custom-scanned-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  code: matchedMaster?.code || cleanCode,
                  name: matchedMaster?.name || `Linh kiện ${cleanCode}`,
                  model: matchedMaster?.model || '',
                  category: matchedMaster?.category || 'Linh Kiện',
                  quantity: 1,
                  price: matchedMaster?.price || '',
                  location: matchedMaster?.location || '',
                  date: getTodayFormattedDate(),
                  note: matchedMaster?.note || '',
                  selected: true,
                };
                return [newRow, ...prev];
              }
            });

            showToast(
              `📷 Đã quét thành công mã: ${cleanCode} ${matchedMaster ? `• ${matchedMaster.model ? `[${matchedMaster.model}] ` : ''}${matchedMaster.name}` : ''}`,
              'success'
            );
          }
        }
        buffer = '';
        return;
      }

      // Collect single printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [masterItems, handleSelectMasterItemForRow, handleUpdateItem]);

  // Export Custom Print Queue to Excel with independent entry dates
  const handleExportExcel = () => {
    if (customItems.length === 0) {
      showToast('Danh sách dữ liệu cần in hiện đang trống!', 'info');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const filename = `danh_sach_tem_can_in_${today}.xlsx`;
    exportCustomPrintToExcel(customItems, filename);
    showToast(`Đã xuất ${customItems.length} linh kiện (kèm ngày nhập và vị trí) ra file Excel!`, 'success');
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    setCustomItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Batch action methods
  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedItems.length} linh kiện đang chọn khỏi danh sách in?`)) {
      setCustomItems((prev) => prev.filter((item) => item.selected === false));
      showToast(`Đã xóa ${selectedItems.length} linh kiện đã chọn!`, 'info');
    }
  };

  const handleBatchQuantity = (qty: number) => {
    if (selectedItems.length === 0) return;
    setCustomItems((prev) =>
      prev.map((item) => (item.selected !== false ? { ...item, quantity: qty } : item))
    );
    showToast(`Đã cập nhật số lượng tem thành ${qty} cho ${selectedItems.length} linh kiện đã chọn!`, 'success');
  };

  const handleApplyBatchQuantity = () => {
    if (selectedItems.length === 0) return;
    const qty = Math.max(1, batchQty);
    setCustomItems((prev) =>
      prev.map((item) => (item.selected !== false ? { ...item, quantity: qty } : item))
    );
    showToast(`Đã đổi số lượng thành ${qty} cho ${selectedItems.length} tem đã chọn!`, 'success');
  };

  const handleApplyBatchDate = () => {
    if (selectedItems.length === 0 || !batchDateISO) return;
    const formatted = formatDateToDmy(batchDateISO);
    setCustomItems((prev) =>
      prev.map((item) => (item.selected !== false ? { ...item, date: formatted } : item))
    );
    showToast(`Đã gán ngày ${formatted} cho ${selectedItems.length} tem đã chọn!`, 'success');
  };

  const handleBatchLocation = () => {
    if (selectedItems.length === 0) return;
    const loc = prompt('Nhập mã kệ chung cho các linh kiện đã chọn (ví dụ: KỆ A-01):');
    if (loc !== null) {
      const trimmed = loc.trim().toUpperCase();
      setCustomItems((prev) =>
        prev.map((item) => (item.selected !== false ? { ...item, location: trimmed } : item))
      );
      showToast(`Đã cập nhật mã kệ "${trimmed || '(Trống)'}" cho ${selectedItems.length} linh kiện đã chọn!`, 'success');
    }
  };

  const handleBatchCategory = () => {
    if (selectedItems.length === 0) return;
    const cat = prompt('Nhập loại linh kiện chung cho các mục đã chọn (ví dụ: Màn hình, Main, Pin...):');
    if (cat !== null) {
      const trimmed = cat.trim();
      setCustomItems((prev) =>
        prev.map((item) => (item.selected !== false ? { ...item, category: trimmed || 'Linh Kiện' } : item))
      );
      showToast(`Đã cập nhật loại thành "${trimmed || 'Linh Kiện'}" cho ${selectedItems.length} linh kiện đã chọn!`, 'success');
    }
  };

  const handleInvertSelection = () => {
    setCustomItems((prev) =>
      prev.map((item) => ({ ...item, selected: item.selected === false ? true : false }))
    );
    showToast('Đã đảo ngược lựa chọn hàng loạt!', 'info');
  };

  // Clear all modal prompt
  const handleClearAll = () => {
    if (customItems.length === 0) return;
    setIsConfirmClearModalOpen(true);
  };

  // Execute clear all
  const executeClearAll = () => {
    setCustomItems([]);
    setSearchTerm('');
    setCurrentPage(1);
    setIsConfirmClearModalOpen(false);
    showToast('Đã xóa trắng toàn bộ danh sách dữ liệu cần in!', 'info');
  };

  // Add blank row
  const handleAddNewRow = () => {
    setSearchTerm(''); // Clear active search so newly added row is immediately visible
    setCurrentPage(1); // Jump to page 1 where newly added row appears at the top
    const todayStr = getTodayFormattedDate();
    const newId = `custom-row-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newItem: LabelItem = {
      id: newId,
      code: '',
      name: '',
      model: '',
      category: 'Linh Kiện',
      quantity: 1,
      price: '',
      location: '',
      date: todayStr,
      selected: true,
    };
    setNewlyAddedRowId(newId);
    setCustomItems((prev) => [newItem, ...prev]);
  };

  // Filtered items by search
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return customItems;
    return customItems.filter((i) => {
      return matchesSmartSearch(term, [
        i.code,
        i.name,
        i.model,
        i.category,
        i.location,
        i.note,
      ]);
    });
  }, [customItems, searchTerm]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredItems.length / pageSize) || 1;
  }, [filteredItems.length, pageSize]);

  // Ensure current page is valid
  const validPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, validPage, pageSize]);

  // Selected items for printing
  const selectedItems = useMemo(() => {
    return customItems.filter((i) => i.selected !== false);
  }, [customItems]);

  const totalSelectedLabels = useMemo(() => {
    return selectedItems.reduce((acc, i) => acc + Math.max(1, i.quantity || 1), 0);
  }, [selectedItems]);

  const totalQueueLabels = useMemo(() => {
    return customItems.reduce((acc, i) => acc + Math.max(1, i.quantity || 1), 0);
  }, [customItems]);

  // Expanded items for preview
  const previewMultipliedItems = useMemo(() => {
    const list: LabelItem[] = [];
    selectedItems.forEach((item) => {
      const count = Math.max(1, item.quantity || 1);
      for (let i = 0; i < count; i++) {
        list.push(item);
      }
    });
    return list;
  }, [selectedItems]);

  const allSelected = customItems.length > 0 && selectedItems.length === customItems.length;

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-200">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`p-3 rounded-lg shadow-sm text-xs font-semibold flex items-center justify-between transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : toastMessage.type === 'info'
              ? 'bg-blue-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/80 hover:text-white ml-2 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Consolidated Single Toolbar & Action Bar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx, .xls, .csv"
          className="hidden"
        />

        {/* Left: View Mode Toggles & Search & Add Row */}
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[280px]">
          {/* Sub View Toggle */}
          <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg text-xs font-medium border border-neutral-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                viewMode === 'split' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Chia đôi
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Bảng dữ liệu ({customItems.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                viewMode === 'preview' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Xem trước tem ({previewMultipliedItems.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs min-w-[150px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm trong danh sách cần in..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Thao tác hàng loạt menu toggle button (Khớp mẫu Hình 1) */}
          <button
            type="button"
            onClick={() => setShowBatchTools(!showBatchTools)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors shadow-2xs shrink-0 ${
              showBatchTools
                ? 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
            title="Bật/Tắt thanh menu thao tác hàng loạt"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
            <span>Thao tác hàng loạt</span>
          </button>

          <button
            type="button"
            onClick={handleAddNewRow}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>Thêm dòng</span>
          </button>
        </div>

        {/* Right: Data Import & Print Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Data Import Actions */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer transition-colors"
            title="Tải lên file Excel danh sách mã linh kiện cần in"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Đang đọc file...' : 'Tải File Excel Cần In'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold shadow-2xs cursor-pointer transition-colors"
            title="Dán nhanh danh sách các mã linh kiện"
          >
            <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dán danh sách mã</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={customItems.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Xuất danh sách linh kiện cần in (kèm ngày nhập và vị trí kệ) ra file Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          <button
            type="button"
            onClick={() => downloadCustomPrintSampleExcel()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded-lg text-xs font-medium cursor-pointer transition-colors"
            title="Tải file Excel mẫu đơn giản (chỉ cần điền mã SP, số lượng & ngày nhập)"
          >
            <FileDown className="w-3.5 h-3.5 text-neutral-600" />
            <span>Mẫu Excel</span>
          </button>

          {customItems.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition-colors"
              title="Xóa trắng toàn bộ danh sách cần in này"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa hết</span>
            </button>
          )}
        </div>
      </div>

      {/* Batch Tools Bar if expanded (Khớp 100% mẫu Hình 1 & Hình 2) */}
      {showBatchTools && (
        <div className="px-3 py-2 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="font-medium text-emerald-950">
              Đã chọn: <strong>{selectedItems.length}</strong> / {customItems.length} tem
            </span>
            <button
              type="button"
              onClick={() => handleToggleSelectAll(!allSelected)}
              className="text-emerald-700 hover:text-emerald-900 hover:underline font-bold cursor-pointer"
            >
              {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Đổi SL: [ 1 ] [ Áp dụng ] */}
            <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg px-2 py-0.5 shrink-0 shadow-2xs">
              <span className="text-stone-600 whitespace-nowrap">Đổi SL:</span>
              <input
                type="number"
                min="1"
                max="999"
                value={batchQty}
                onChange={(e) => setBatchQty(parseInt(e.target.value, 10) || 1)}
                className="w-12 text-center font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyBatchQuantity}
                disabled={selectedItems.length === 0}
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                Áp dụng
              </button>
            </div>

            {/* Check tồn kho ({selectedItems.length}) */}
            <button
              type="button"
              disabled={selectedItems.length === 0}
              onClick={() => {
                const codes = selectedItems.map((i) => i.code).filter(Boolean).join('\n');
                handleCheckStock(codes);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold rounded-lg disabled:opacity-40 cursor-pointer transition-colors shrink-0 whitespace-nowrap shadow-2xs"
              title="Sao chép các mã SP đang chọn và mở hệ thống GCSM tra cứu tồn kho"
            >
              <Boxes className="w-3.5 h-3.5 text-emerald-600" />
              <span>Check tồn kho ({selectedItems.length})</span>
            </button>

            {/* Gán ngày: [ 📅 ] [ Hôm nay ] [ Gán ngày ] */}
            <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg px-2 py-0.5 shadow-2xs shrink-0 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <input
                type="date"
                value={batchDateISO}
                onChange={(e) => setBatchDateISO(e.target.value)}
                className="w-[115px] text-xs font-mono font-bold text-stone-800 bg-transparent focus:outline-none border-none p-0 cursor-pointer shrink-0"
                title="Chọn ngày tùy chỉnh để gán cho các tem đang chọn"
              />
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setBatchDateISO(`${year}-${month}-${day}`);
                }}
                className="px-1.5 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded shrink-0 cursor-pointer whitespace-nowrap"
                title="Đặt lại thành Ngày hôm nay"
              >
                Hôm nay
              </button>
              <button
                type="button"
                disabled={selectedItems.length === 0 || !batchDateISO}
                onClick={handleApplyBatchDate}
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold disabled:opacity-40 cursor-pointer transition-colors shrink-0 shadow-2xs whitespace-nowrap"
                title={`Gán ngày ${formatDateToDmy(batchDateISO)} cho ${selectedItems.length} tem đang chọn`}
              >
                Gán ngày
              </button>
            </div>

            {/* Sao chép {selectedItems.length} dòng */}
            <button
              type="button"
              disabled={selectedItems.length === 0}
              onClick={() => {
                const tsv = selectedItems
                  .map((i) => `${i.code}\t${i.name}\t${i.model}\t${i.category}\t${i.location || ''}\t${i.quantity || 1}\t${i.date || ''}`)
                  .join('\n');
                navigator.clipboard.writeText(tsv);
                showToast(`Đã sao chép ${selectedItems.length} dòng vào clipboard!`, 'success');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 font-semibold rounded-lg disabled:opacity-40 cursor-pointer transition-colors shrink-0 whitespace-nowrap shadow-2xs"
              title="Sao chép tất cả dòng đang chọn để dán sang Excel"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sao chép {selectedItems.length} dòng</span>
            </button>

            {/* In {totalSelectedLabels} tem đã chọn */}
            <button
              type="button"
              disabled={selectedItems.length === 0}
              onClick={() => onDirectPrint(selectedItems)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
              title="In ngay các tem đang chọn"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In {totalSelectedLabels} tem đã chọn</span>
            </button>

            {/* Xóa đã chọn */}
            <button
              type="button"
              disabled={selectedItems.length === 0}
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
              title="Xóa các tem đang chọn khỏi danh sách"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa đã chọn</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {customItems.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-dashed border-emerald-300 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shadow-2xs">
            <FileSpreadsheet className="w-10 h-10" />
          </div>
          <h3 className="text-base font-bold text-neutral-900">
            Chưa có linh kiện nào trong Bảng Dữ Liệu Cần In
          </h3>
          <p className="text-xs text-neutral-500 max-w-md">
            Khi bạn cần in tem cho một danh sách chỉ định, hãy tải file Excel lên theo mã (hoặc dán danh sách mã). Hệ thống sẽ tự động tra cứu và điền đầy đủ tên, model, kệ từ kho tổng 5731 linh kiện.
          </p>
          <div className="flex items-center gap-2.5 mt-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={handleAddNewRow}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm dòng mới</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Tải File Excel Cần In</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPasteModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold cursor-pointer transition-colors"
            >
              <ClipboardList className="w-4 h-4 text-emerald-700" />
              <span>Dán danh sách mã</span>
            </button>
            <button
              type="button"
              onClick={() => downloadCustomPrintSampleExcel()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-medium cursor-pointer transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Tải mẫu Excel</span>
            </button>
          </div>
        </div>
      ) : (
        /* Data View: Split or Full Table or Preview */
        <div
          className={`grid gap-4 ${
            viewMode === 'split'
              ? 'grid-cols-1 lg:grid-cols-12'
              : 'grid-cols-1'
          }`}
        >
          {/* Table Panel */}
          {(viewMode === 'split' || viewMode === 'table') && (
            <div
              className={`bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden flex flex-col ${
                viewMode === 'split' ? 'lg:col-span-7' : 'w-full'
              }`}
            >
              <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-3 font-bold text-neutral-800 flex-wrap">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-neutral-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Chọn tất cả ({selectedItems.length}/{customItems.length} mã)</span>
                  </label>
                </div>
                <div className="text-neutral-500">
                  Tổng tem in theo số lượng: <strong className="text-emerald-700 font-bold">{totalSelectedLabels} tem</strong>
                  {totalSelectedLabels !== totalQueueLabels && (
                    <span className="text-neutral-400 font-normal ml-1"> (hàng đợi {totalQueueLabels} tem)</span>
                  )}
                </div>
              </div>

              {/* Table Body with safe horizontal scroll and non-collapsing columns */}
              <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[600px] min-h-[320px]">
                <table className="w-full text-left border-collapse text-xs min-w-[990px]">
                  <thead className="bg-neutral-100 text-neutral-700 font-bold sticky top-0 z-10 border-b border-neutral-200">
                    <tr>
                      <th className="p-2 w-9 min-w-[36px] text-center shrink-0"></th>
                      <th className="p-2 w-9 min-w-[36px] text-center text-neutral-400 shrink-0">#</th>
                      <th className="p-2 w-[140px] min-w-[140px]">Mã SP (Cột A)</th>
                      <th className="p-2 w-[130px] min-w-[130px]">Model (Cột C)</th>
                      <th className="p-2 min-w-[210px]">Tên Linh Kiện (Cột B)</th>
                      <th className="p-2 w-[85px] min-w-[85px]">Loại</th>
                      <th className="p-2 w-[85px] min-w-[85px] text-center">SL Tem</th>
                      <th className="p-2 w-[85px] min-w-[85px]">Mã Kệ</th>
                      <th className="p-2 w-[120px] min-w-[120px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Ngày Nhập</span>
                        </div>
                      </th>
                      <th className="p-2 w-[80px] min-w-[80px] text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {paginatedItems.map((item, idx) => {
                      const absoluteIndex = (validPage - 1) * pageSize + idx + 1;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-emerald-50/40 transition-colors ${
                            item.selected === false ? 'opacity-50 bg-neutral-50/50' : ''
                          }`}
                        >
                          <td className="p-2 text-center w-9 min-w-[36px]">
                            <input
                              type="checkbox"
                              checked={item.selected !== false}
                              onChange={(e) => handleToggleSelectItem(item.id, e.target.checked)}
                              className="w-4 h-4 text-emerald-600 rounded border-neutral-300 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2 text-center text-neutral-400 font-mono text-[11px] w-9 min-w-[36px]">
                            {absoluteIndex}
                          </td>
                          <td className="p-2 w-[145px] min-w-[145px]">
                            <div className="flex items-center gap-1 min-w-0" title={item.code ? `Mã SP: ${item.code}` : undefined}>
                              <div className="flex-1 min-w-0">
                                <PartAutocompleteCell
                                  value={item.code}
                                  field="code"
                                  rowId={item.id}
                                  placeholder="Nhập mã SP..."
                                  autoFocus={item.id === newlyAddedRowId}
                                  inputClassName="font-mono font-bold text-neutral-900"
                                  masterItems={masterItems}
                                  onValueChange={(val) => handleUpdateItem(item.id, 'code', val)}
                                  onSelectMasterItem={(selected) => handleSelectMasterItemForRow(item.id, selected)}
                                />
                              </div>
                              {item.code && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(item.code, 'mã SP')}
                                  className="text-neutral-400 hover:text-emerald-700 p-1 hover:bg-neutral-100 rounded cursor-pointer shrink-0 transition-colors"
                                  title={`Sao chép mã: ${item.code}`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2 w-[135px] min-w-[135px]">
                            <div className="flex items-center gap-1 min-w-0" title={item.model ? `Model: ${item.model}` : undefined}>
                              <div className="flex-1 min-w-0">
                                <PartAutocompleteCell
                                  value={item.model}
                                  field="model"
                                  placeholder="Nhập Model..."
                                  inputClassName="font-semibold text-neutral-900"
                                  masterItems={masterItems}
                                  onValueChange={(val) => handleUpdateItem(item.id, 'model', val)}
                                  onSelectMasterItem={(selected) => handleSelectMasterItemForRow(item.id, selected)}
                                />
                              </div>
                              {item.model && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(item.model, 'Model')}
                                  className="text-neutral-400 hover:text-emerald-700 p-1 hover:bg-neutral-100 rounded cursor-pointer shrink-0 transition-colors"
                                  title={`Sao chép Model: ${item.model}`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2 min-w-[240px]">
                            <div className="flex items-center gap-1 min-w-0" title={item.name ? `Tên linh kiện: ${item.name}` : undefined}>
                              <div className="flex-1 min-w-0">
                                <PartAutocompleteCell
                                  value={item.name}
                                  field="name"
                                  placeholder="Nhập tên linh kiện..."
                                  inputClassName="text-neutral-800 font-medium"
                                  masterItems={masterItems}
                                  onValueChange={(val) => handleUpdateItem(item.id, 'name', val)}
                                  onSelectMasterItem={(selected) => handleSelectMasterItemForRow(item.id, selected)}
                                />
                              </div>
                              {item.name && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(item.name, 'Tên linh kiện')}
                                  className="text-neutral-400 hover:text-emerald-700 p-1 hover:bg-neutral-100 rounded cursor-pointer shrink-0 transition-colors"
                                  title={`Sao chép tên: ${item.name}`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2 w-[90px] min-w-[90px]">
                            <div className="flex items-center gap-1 min-w-0" title={item.category ? `Loại: ${item.category}` : undefined}>
                              <input
                                type="text"
                                value={item.category}
                                onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                                placeholder="Loại..."
                                title={item.category || 'Loại...'}
                                className="w-full min-w-0 px-1.5 py-1 bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-emerald-500 rounded text-xs text-neutral-600 truncate"
                              />
                              {item.category && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(item.category, 'Loại linh kiện')}
                                  className="text-neutral-400 hover:text-emerald-700 p-0.5 rounded cursor-pointer shrink-0"
                                  title="Sao chép loại"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-center w-[90px] min-w-[90px]">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(item.id, 'quantity', Math.max(1, (item.quantity || 1) - 1))}
                                className="w-5 h-5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-xs font-bold flex items-center justify-center cursor-pointer shrink-0"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={999}
                                value={item.quantity || 1}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))
                                }
                                className="w-10 text-center font-bold text-emerald-900 border border-neutral-300 rounded py-0.5 text-xs focus:ring-1 focus:ring-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(item.id, 'quantity', (item.quantity || 1) + 1)}
                                className="w-5 h-5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-xs font-bold flex items-center justify-center cursor-pointer shrink-0"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-2 w-[85px] min-w-[85px]">
                            <div className="flex items-center gap-1 min-w-0" title={item.location ? `Mã kệ: ${item.location}` : undefined}>
                              <input
                                type="text"
                                value={item.location || ''}
                                onChange={(e) => handleUpdateItem(item.id, 'location', e.target.value)}
                                placeholder="Kệ..."
                                title={item.location || 'Kệ...'}
                                className="w-full min-w-0 font-mono px-1.5 py-1 bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-emerald-500 rounded text-xs text-neutral-700 uppercase"
                              />
                              {item.location && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(item.location || '', 'Mã kệ')}
                                  className="text-neutral-400 hover:text-emerald-700 p-0.5 rounded cursor-pointer shrink-0"
                                  title="Sao chép mã kệ"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2 w-[120px] min-w-[120px]">
                            <div className="flex items-center gap-1 min-w-0" title={`Ngày nhập in trên tem: ${item.date || getTodayFormattedDate()}`}>
                              <div className="relative flex items-center w-full min-w-0 bg-neutral-50/90 hover:bg-neutral-100 focus-within:bg-white border border-neutral-200 focus-within:border-emerald-500 rounded px-1.5 py-1 transition-colors">
                                <input
                                  type="text"
                                  value={item.date ?? ''}
                                  placeholder={getTodayFormattedDate()}
                                  onChange={(e) => handleUpdateItem(item.id, 'date', e.target.value)}
                                  className="w-full min-w-0 font-mono text-xs text-neutral-800 bg-transparent focus:outline-none pr-5"
                                  title="Nhập ngày DD/MM/YYYY (được in trực tiếp dưới mã QR)"
                                />
                                <div className="absolute right-1 flex items-center justify-center w-4 h-4 text-neutral-400 hover:text-emerald-700 cursor-pointer" title="Chọn ngày từ lịch">
                                  <Calendar className="w-3.5 h-3.5 pointer-events-none" />
                                  <input
                                    type="date"
                                    value={toIsoDate(item.date || getTodayFormattedDate())}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleUpdateItem(item.id, 'date', formatDateToDmy(e.target.value));
                                      }
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 text-center w-[85px] min-w-[85px]">
                            <div className="flex items-center justify-center gap-1">
                              {item.code && (
                                <button
                                  type="button"
                                  onClick={() => handleCheckStock(item.code)}
                                  className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded transition-all hover:scale-105 cursor-pointer shadow-2xs shrink-0"
                                  title={`Check tồn kho GCSM mã ${item.code}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer shrink-0 transition-colors"
                                title="Xóa dòng này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-600">
                  <div className="flex items-center gap-1">
                    <span>Hiển thị dòng</span>
                    <strong className="text-neutral-800">{(validPage - 1) * pageSize + 1}</strong>
                    <span>đến</span>
                    <strong className="text-neutral-800">{Math.min(validPage * pageSize, filteredItems.length)}</strong>
                    <span>trong tổng số</span>
                    <strong className="text-emerald-700">{filteredItems.length} dòng</strong>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={validPage === 1}
                      className="px-2 py-1 bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Đầu
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={validPage === 1}
                      className="px-2 py-1 bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Trước
                    </button>

                    <span className="px-2 font-semibold">
                      Trang <strong className="text-emerald-900">{validPage}</strong> / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={validPage === totalPages}
                      className="px-2 py-1 bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Sau
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={validPage === totalPages}
                      className="px-2 py-1 bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Cuối
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview Panel */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div
              className={`bg-neutral-100/90 border border-neutral-200 rounded-xl p-3.5 shadow-xs flex flex-col ${
                viewMode === 'split' ? 'lg:col-span-5' : 'w-full'
              }`}
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-700" />
                  <h4 className="text-xs font-bold text-neutral-900">
                    Bản Xem Trước Tem In ({previewMultipliedItems.length} tem)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-500 hidden sm:inline">
                    Chuẩn khổ: <strong>3" x 2"</strong>
                  </span>
                  {selectedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onDirectPrint(selectedItems)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer transition-colors"
                      title="In ngay các tem được chọn đang hiển thị trong bản xem trước"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>In {totalSelectedLabels} tem này</span>
                    </button>
                  )}
                </div>
              </div>

              {previewMultipliedItems.length === 0 ? (
                <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center text-xs text-neutral-500 flex-1 flex flex-col items-center justify-center">
                  <Printer className="w-6 h-6 text-neutral-400 mb-1.5" />
                  <span>Hãy chọn ít nhất 1 linh kiện trong bảng trên để xem trước tem in</span>
                </div>
              ) : (
                <div className="flex-1 overflow-auto max-h-[600px] p-2 bg-neutral-200/50 rounded-lg flex flex-wrap gap-3 items-start justify-center">
                  {previewMultipliedItems.slice(0, 40).map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="shadow-xs rounded bg-white">
                      <LabelCard item={item} config={config} index={idx} />
                    </div>
                  ))}
                  {previewMultipliedItems.length > 40 && (
                    <div className="w-full text-center py-2 text-xs text-neutral-500 font-medium">
                      + và còn {previewMultipliedItems.length - 40} tem khác sẽ được in đầy đủ...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Paste Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-sm">Dán Danh Sách Mã Linh Kiện Cần In</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-neutral-600">
                Dán danh sách mã SP cần in vào ô dưới đây (mỗi dòng 1 mã, hoặc kèm số lượng như <code className="bg-neutral-100 px-1 py-0.5 rounded text-emerald-800 font-bold">621035000389 2</code>). Hệ thống sẽ tự động tra cứu và điền đầy đủ tên, model từ kho tổng 5731 linh kiện.
              </p>

              <textarea
                rows={8}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Ví dụ:&#10;621035000389&#10;621035000395  2&#10;621035000401&#10;621035000410  3"
                className="w-full font-mono text-xs p-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-neutral-500">
                  {pastedText.trim() ? `${pastedText.trim().split('\n').length} dòng được nhập` : 'Chưa có nội dung'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyPaste}
                    disabled={!pastedText.trim()}
                    className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs disabled:opacity-40 cursor-pointer"
                  >
                    Nạp Vào Bảng In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Clear All Modal */}
      {isConfirmClearModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">Xác Nhận Xóa Trắng Dữ Liệu</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmClearModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-neutral-700">
              <p className="leading-relaxed text-sm">
                Bạn có chắc chắn muốn xóa tất cả <strong className="text-rose-700 font-extrabold">{customItems.length} linh kiện</strong> trong danh sách Bảng Dữ Liệu Cần In này không?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11.5px] flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Lưu ý: Thao tác này chỉ xóa dữ liệu tạm thời cần in trên máy bạn, <strong>không làm ảnh hưởng đến Kho dữ liệu gốc (5731 mã)</strong>.</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsConfirmClearModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeClearAll}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Trắng Danh Sách</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
