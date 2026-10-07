import React, { useState, useEffect, useMemo, memo, useCallback, useDeferredValue, startTransition, useRef } from 'react';
import { LabelItem } from '../types/label';
import { getTodayFormattedDate, readExcelFile, exportToExcel, downloadSampleExcel } from '../utils/excelHelper';
import {
  Plus,
  Trash2,
  Copy,
  Search,
  CheckSquare,
  Square,
  ArrowUpDown,
  Printer,
  Sparkles,
  SlidersHorizontal,
  Eye,
  Crosshair,
  Calendar,
  ExternalLink,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  PhoneCall,
  Phone,
  User,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Ban,
  X,
  Tag,
  Check,
  UploadCloud,
  Download,
  FileSpreadsheet,
  Camera,
  ScanLine,
} from 'lucide-react';
import { ShortageBookingItem } from '../types/shortage';
import { ExcelActionMenu } from './ExcelActionMenu';
import { CameraBarcodeScannerModal } from './CameraBarcodeScannerModal';
import { extractBarcodePartCode } from '../utils/barcodeExtractor';
import { matchesSmartSearch } from '../utils/searchHelper';

const GCSM_STOCK_URL = 'https://gcsm-sg.oppoit.com/part/stocks/stock-query';

const QuickCopyButton: React.FC<{ text?: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  if (!text || !text.trim()) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 text-neutral-400 hover:text-blue-700 hover:bg-neutral-200/80 rounded transition-colors cursor-pointer shrink-0 ml-1 inline-flex items-center justify-center border border-neutral-200/80 bg-white shadow-2xs"
      title={`Sao chép ${label ? label + ': ' : ''}"${text}"`}
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-600 font-bold" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
};

interface DataTableProps {
  items: LabelItem[];
  focusedItemId?: string | null;
  onFocusItem?: (id: string) => void;
  onUpdateItems: (items: LabelItem[], syncToText?: boolean) => void;
  onPrintSelected: (selectedItems: LabelItem[]) => void;
  onAddNewRow: () => void;
  isAdmin?: boolean;
  shortageBookings?: ShortageBookingItem[];
  onNavigateToShortage?: (ticketNumber?: string) => void;
}

// Memoized Table Row component to prevent re-rendering unchanged rows during search/selection
interface DataTableRowProps {
  item: LabelItem;
  index: number;
  isFocused: boolean;
  editingCell: { id: string; field: keyof LabelItem } | null;
  isAdmin: boolean;
  showStockCheckButton?: boolean;
  onToggleSelect: (id: string) => void;
  onStartEditCell: (id: string, field: keyof LabelItem) => void;
  onCellBlur: (id: string, field: keyof LabelItem, value: string) => void;
  onCheckStock: (code?: string) => void;
  onFocusItem?: (id: string) => void;
  onFieldChange: (id: string, field: keyof LabelItem, value: any) => void;
  onDeleteItem: (id: string) => void;
  onOpenScanner?: (item: LabelItem) => void;
}

const DataTableRow = memo<DataTableRowProps>(({
  item,
  index,
  isFocused,
  editingCell,
  isAdmin,
  showStockCheckButton = true,
  onToggleSelect,
  onStartEditCell,
  onCellBlur,
  onCheckStock,
  onFocusItem,
  onFieldChange,
  onDeleteItem,
  onOpenScanner,
}) => {
  const isEditing = (field: keyof LabelItem) => editingCell?.id === item.id && editingCell?.field === field;

  return (
    <tr
      id={`table-row-${item.id}`}
      className={`transition-colors select-text ${
        isFocused
          ? 'bg-emerald-50/70 ring-2 ring-inset ring-emerald-500 font-semibold'
          : item.selected
          ? 'ring-1 ring-inset ring-emerald-500/80 bg-emerald-50/25'
          : 'hover:bg-stone-50/80'
      }`}
    >
      <td className="p-2 text-center select-none" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onToggleSelect(item.id)}
          className="cursor-pointer text-stone-400 hover:text-emerald-600"
        >
          {item.selected ? (
            <CheckSquare className="w-4 h-4 text-emerald-600" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
      </td>
      <td className="p-2 text-center text-stone-400 font-mono text-[11px] select-none">
        {index + 1}
      </td>
      
      {/* Mã SP */}
      <td
        className="p-1.5 font-mono font-medium text-stone-900 select-text w-[145px] min-w-[145px]"
        onDoubleClick={() => onStartEditCell(item.id, 'code')}
      >
        {isEditing('code') ? (
          <input
            type="text"
            autoFocus
            defaultValue={item.code}
            title={item.code}
            onBlur={(e) => onCellBlur(item.id, 'code', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCellBlur(item.id, 'code', e.currentTarget.value);
            }}
            className="w-full px-1.5 py-0.5 font-mono text-xs bg-white border border-emerald-500 rounded focus:outline-none shadow-xs"
          />
        ) : (
          <div className="flex items-center justify-between group/code px-1.5 py-1 rounded hover:bg-stone-100 cursor-text select-text min-w-0" title={item.code ? `Mã SP: ${item.code}` : undefined}>
            <span className="truncate min-w-0 flex-1 font-mono font-bold">
              {item.code || <span className="text-stone-400 italic font-normal">Trống</span>}
            </span>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenScanner(item);
                  }}
                  className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-800 hover:text-amber-950 border border-amber-200 hover:border-amber-300 rounded transition-all cursor-pointer items-center justify-center hover:scale-105 shadow-2xs shrink-0 inline-flex"
                  title={`Mở camera quét mã vạch cho dòng #${index + 1}`}
                >
                  <Camera className="w-3 h-3" />
                </button>
              )}
              {item.code && <QuickCopyButton text={item.code} label="Mã SP" />}
              {item.code && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckStock(item.code);
                  }}
                  className={`p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 hover:text-emerald-950 border border-emerald-200 hover:border-emerald-300 rounded transition-all cursor-pointer items-center justify-center hover:scale-105 shadow-2xs shrink-0 ${
                    showStockCheckButton
                      ? 'inline-flex'
                      : 'hidden group-hover/code:inline-flex'
                  }`}
                  title={`Check tồn kho mã ${item.code} trên GCSM (${GCSM_STOCK_URL})`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </td>

      {/* Model máy */}
      <td
        className="p-1.5 font-bold text-stone-900 select-text w-[135px] min-w-[135px]"
        onDoubleClick={() => onStartEditCell(item.id, 'model')}
      >
        {isEditing('model') ? (
          <input
            type="text"
            autoFocus
            defaultValue={item.model}
            title={item.model}
            onBlur={(e) => onCellBlur(item.id, 'model', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCellBlur(item.id, 'model', e.currentTarget.value);
            }}
            className="w-full px-1.5 py-0.5 text-xs font-bold bg-white border border-emerald-500 rounded focus:outline-none shadow-xs"
          />
        ) : (
          <div className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-stone-100 cursor-text select-text min-w-0" title={item.model ? `Model: ${item.model}` : undefined}>
            <span className="truncate min-w-0 flex-1">
              {item.model || <span className="text-stone-400 font-normal italic">Trống</span>}
            </span>
            <QuickCopyButton text={item.model} label="Model" />
          </div>
        )}
      </td>

      {/* Tên linh kiện */}
      <td
        className="p-1.5 text-stone-900 select-text min-w-[220px]"
        onDoubleClick={() => onStartEditCell(item.id, 'name')}
      >
        {isEditing('name') ? (
          <input
            type="text"
            autoFocus
            defaultValue={item.name}
            title={item.name}
            onBlur={(e) => onCellBlur(item.id, 'name', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCellBlur(item.id, 'name', e.currentTarget.value);
            }}
            className="w-full px-1.5 py-0.5 text-xs bg-white border border-emerald-500 rounded focus:outline-none shadow-xs"
          />
        ) : (
          <div className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-stone-100 cursor-text select-text min-w-0" title={item.name ? `Tên linh kiện: ${item.name}` : undefined}>
            <span className="truncate min-w-0 flex-1 font-medium">
              {item.name || <span className="text-stone-400 italic">Trống</span>}
            </span>
            <QuickCopyButton text={item.name} label="Tên linh kiện" />
          </div>
        )}
      </td>

      {/* Loại (Category) */}
      <td
        className="p-1.5 font-semibold text-stone-700 select-text"
        onDoubleClick={() => onStartEditCell(item.id, 'category')}
      >
        {isEditing('category') ? (
          <input
            type="text"
            autoFocus
            defaultValue={item.category}
            onBlur={(e) => onCellBlur(item.id, 'category', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCellBlur(item.id, 'category', e.currentTarget.value);
            }}
            className="w-full px-1.5 py-0.5 text-xs font-semibold bg-white border border-emerald-500 rounded focus:outline-none shadow-xs"
          />
        ) : (
          <div className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-stone-100 cursor-text select-text" title={item.category}>
            <span className="truncate max-w-[130px] lg:max-w-none">
              {item.category || <span className="text-stone-400 font-normal italic">-</span>}
            </span>
            <QuickCopyButton text={item.category} label="Loại" />
          </div>
        )}
      </td>

      {/* Mã Kệ (Location) */}
      <td
        className="p-1.5 font-bold text-stone-900 select-text"
        onDoubleClick={() => onStartEditCell(item.id, 'location')}
      >
        {isEditing('location') ? (
          <input
            type="text"
            autoFocus
            defaultValue={item.location || ''}
            onBlur={(e) => onCellBlur(item.id, 'location', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCellBlur(item.id, 'location', e.currentTarget.value);
            }}
            className="w-full px-1.5 py-0.5 text-xs font-bold bg-white border border-emerald-500 rounded focus:outline-none shadow-xs"
          />
        ) : (
          <div className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-stone-100 cursor-text select-text" title={item.location}>
            {item.location ? (
              <span className="bg-emerald-50 text-emerald-950 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px] font-bold">
                {item.location}
              </span>
            ) : (
              <span className="text-stone-400 font-normal italic">-</span>
            )}
            <QuickCopyButton text={item.location} label="Mã Kệ" />
          </div>
        )}
      </td>

      {/* Ngày nhập kho (Date) */}
      <td
        className="p-1.5 font-mono text-stone-800 select-text"
        onDoubleClick={() => onStartEditCell(item.id, 'date')}
      >
        {isEditing('date') ? (
          <input
            type="text"
            autoFocus
            defaultValue={item.date || ''}
            placeholder="DD/MM/YYYY"
            onBlur={(e) => onCellBlur(item.id, 'date', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCellBlur(item.id, 'date', e.currentTarget.value);
            }}
            className="w-full px-1.5 py-0.5 font-mono text-xs bg-white border border-emerald-500 rounded focus:outline-none shadow-xs"
          />
        ) : (
          <div className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-stone-100 cursor-text select-text" title={item.date}>
            {item.date ? (
              <span className="text-stone-800 font-semibold">{item.date}</span>
            ) : (
              <span className="text-stone-400 font-normal italic">-</span>
            )}
            <QuickCopyButton text={item.date} label="Ngày nhập" />
          </div>
        )}
      </td>

      {/* Số lượng */}
      <td className="p-1.5 text-center select-none" onClick={(e) => e.stopPropagation()}>
        <div className="inline-flex items-center border border-stone-300 rounded overflow-hidden">
          <button
            type="button"
            onClick={() =>
              onFieldChange(
                item.id,
                'quantity',
                Math.max(1, (item.quantity || 1) - 1)
              )
            }
            className="px-1 text-stone-500 hover:bg-stone-200 cursor-pointer"
          >
            -
          </button>
          <input
            type="number"
            min="1"
            max="999"
            value={item.quantity || 1}
            onChange={(e) =>
              onFieldChange(
                item.id,
                'quantity',
                Math.max(1, parseInt(e.target.value, 10) || 1)
              )
            }
            className="w-8 text-center font-bold text-xs bg-white focus:outline-none"
          />
          <button
            type="button"
            onClick={() =>
              onFieldChange(
                item.id,
                'quantity',
                (item.quantity || 1) + 1
              )
            }
            className="px-1 text-stone-500 hover:bg-stone-200 cursor-pointer"
          >
            +
          </button>
        </div>
      </td>

      {/* Thao tác */}
      <td className="p-1.5 text-center select-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => onFocusItem?.(item.id)}
            className={`p-1.5 rounded transition-all cursor-pointer ${
              isFocused
                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300 scale-105'
                : 'text-emerald-700 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
            }`}
            title="Xem vị trí tem này ở bản xem trước bên phải"
          >
            <Eye className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
          {showStockCheckButton && (
            <button
              type="button"
              onClick={() => onCheckStock(item.code)}
              className="p-1.5 text-emerald-700 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-all hover:scale-105 cursor-pointer shadow-2xs"
              title="Check tồn kho linh kiện này trên GCSM"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const rowText = `${item.code}\t${item.name}\t${item.model}\t${item.category}\t${item.location || ''}\t${item.quantity || 1}\t${item.date || ''}`;
              navigator.clipboard.writeText(rowText);
            }}
            className="p-1 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
            title="Sao chép dòng này vào Clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => onDeleteItem(item.id)}
              className="p-1 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
              title="Xóa dòng"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span
              className="p-1 text-stone-300 cursor-not-allowed inline-flex items-center"
              title="Quyền Kỹ thuật viên: Chỉ xem & in tem"
            >
              <Lock className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
});

const DataTableInner: React.FC<DataTableProps> = ({
  items,
  focusedItemId,
  onFocusItem,
  onUpdateItems,
  onPrintSelected,
  onAddNewRow,
  isAdmin = false,
  shortageBookings = [],
  onNavigateToShortage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortField, setSortField] = useState<keyof LabelItem>('code');
  const [sortAsc, setSortAsc] = useState(true);
  const [batchQty, setBatchQty] = useState<number>(1);
  const [batchDateISO, setBatchDateISO] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [showBatchTools, setShowBatchTools] = useState(false);
  const [stockToast, setStockToast] = useState<string | null>(null);
  const [showStockCheckButton, setShowStockCheckButton] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('label_show_stock_check_btn');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await readExcelFile(file);
      if (imported && imported.length > 0) {
        const updated = [...imported, ...items];
        onUpdateItems(updated, true);
        setStockToast(`🎉 Nhập thành công ${imported.length} tem linh kiện từ file Excel!`);
      } else {
        setStockToast('⚠️ Không tìm thấy dữ liệu tem linh kiện phù hợp trong file Excel');
      }
    } catch (err: any) {
      console.error(err);
      setStockToast('❌ Lỗi khi đọc file Excel, vui lòng kiểm tra định dạng file');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleExcelExport = () => {
    if (items.length === 0) {
      setStockToast('⚠️ Bảng dữ liệu hiện đang trống');
      return;
    }
    const filename = `danh_sach_tem_linh_kien_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportToExcel(items, filename);
    setStockToast(`📥 Đã xuất thành công ${items.length} tem ra file Excel!`);
  };

  const handleDownloadSample = () => {
    downloadSampleExcel();
    setStockToast('📄 Đã tải file Excel mẫu chuẩn (3x2in) thành công!');
  };

  // Function to open GCSM stock query and auto-copy part code
  const handleCheckStock = useCallback((code?: string) => {
    if (code && code.trim()) {
      navigator.clipboard.writeText(code.trim());
      setStockToast(`Đã sao chép mã SP "${code.trim()}" & mở cổng tra cứu tồn kho GCSM!`);
    } else {
      setStockToast('Đang mở cổng tra cứu tồn kho GCSM...');
    }
    setTimeout(() => setStockToast(null), 3500);
    window.open(GCSM_STOCK_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const handleCopyText = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setStockToast(`✅ Đã sao chép ${label}: "${text}"`);
      setTimeout(() => {
        setStockToast(null);
      }, 2500);
    });
  }, []);

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTargetItem, setScannerTargetItem] = useState<LabelItem | null>(null);

  // Pagination state
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Edit cell state
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof LabelItem } | null>(null);
  const [lastTickedId, setLastTickedId] = useState<string | null>(null);

  const handleOpenScanner = useCallback((targetItem?: LabelItem) => {
    let itemToTarget = targetItem;
    if (!itemToTarget) {
      // Find currently selected row, or focused row, or first row
      itemToTarget =
        (lastTickedId && items.find((i) => i.id === lastTickedId)) ||
        items.find((i) => i.selected) ||
        (focusedItemId ? items.find((i) => i.id === focusedItemId) : null) ||
        items[0];
    }

    if (!itemToTarget) {
      // If table is empty, trigger add new row first
      if (onAddNewRow) {
        onAddNewRow();
        setStockToast('Đã tạo dòng mới, vui lòng bấm Quét lại camera!');
      } else {
        setStockToast('⚠️ Bảng dữ liệu chưa có dòng nào để gán mã!');
      }
      return;
    }

    setScannerTargetItem(itemToTarget);
    setIsScannerOpen(true);
  }, [items, lastTickedId, focusedItemId, onAddNewRow]);

  const handleStartEditCell = useCallback((id: string, field: keyof LabelItem) => {
    if (!isAdmin) return;
    setEditingCell({ id, field });
  }, [isAdmin]);

  const handleFieldChange = useCallback((id: string, field: keyof LabelItem, value: any) => {
    if (!isAdmin && field !== 'quantity' && field !== 'selected') return;
    const updated = items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onUpdateItems(updated, true);
  }, [isAdmin, items, onUpdateItems]);

  const handleCellBlur = useCallback((id: string, field: keyof LabelItem, value: string) => {
    if (!isAdmin) {
      setEditingCell(null);
      return;
    }
    if (editingCell && editingCell.id === id && editingCell.field === field) {
      handleFieldChange(id, field, value);
      setEditingCell(null);
    }
  }, [isAdmin, editingCell, handleFieldChange]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(items.map((i) => i.category).filter((c) => Boolean(c && c.trim())))
    );
  }, [items]);

  // Clean label items filtering (strictly on label fields, separate from customer holds)
  const filteredItems = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    if (!term && categoryFilter === 'ALL') {
      return items;
    }
    const cleanBarcodeTerm = term ? extractBarcodePartCode(term, items).toLowerCase() : '';
    const hasCleanBarcode = Boolean(cleanBarcodeTerm && cleanBarcodeTerm !== term);

    return items.filter((item) => {
      const itemFields = [
        item.code,
        item.name,
        item.model,
        item.category,
        item.location,
        item.note,
      ];

      const matchesSearch =
        term === '' ||
        matchesSmartSearch(term, itemFields) ||
        (hasCleanBarcode && matchesSmartSearch(cleanBarcodeTerm, itemFields));

      const matchesCategory =
        categoryFilter === 'ALL' || item.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [items, deferredSearchTerm, categoryFilter]);

  const sortedItems = useMemo(() => {
    if (filteredItems.length <= 1) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredItems, sortField, sortAsc]);

  // Reset page when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchTerm, categoryFilter]);

  // Total pages
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(sortedItems.length / pageSize));

  // Prevent multiple forced navigations to the same focus ID when items update
  const [lastNavigatedFocusId, setLastNavigatedFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (focusedItemId && pageSize !== 'all' && focusedItemId !== lastNavigatedFocusId) {
      setLastNavigatedFocusId(focusedItemId);
      const itemIndex = sortedItems.findIndex((i) => i.id === focusedItemId);
      if (itemIndex !== -1) {
        const targetPage = Math.floor(itemIndex / pageSize) + 1;
        setCurrentPage((prevPage) => (targetPage !== prevPage ? targetPage : prevPage));
      }
    }
  }, [focusedItemId, sortedItems, pageSize, lastNavigatedFocusId]);

  // Paginated subset of items
  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return sortedItems;
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const endIndex = pageSize === 'all' ? sortedItems.length : Math.min(startIndex + pageSize, sortedItems.length);

  const handleSort = (field: keyof LabelItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleToggleSelect = useCallback((id: string) => {
    startTransition(() => {
      let isNowSelected = false;
      const updated = items.map((item) => {
        if (item.id === id) {
          isNowSelected = !item.selected;
          return { ...item, selected: isNowSelected };
        }
        return item;
      });
      onUpdateItems(updated, false);
      if (isNowSelected) {
        setLastTickedId(id);
      } else if (lastTickedId === id) {
        const otherSelected = updated.find((i) => i.selected);
        setLastTickedId(otherSelected ? otherSelected.id : null);
      }
    });
  }, [items, onUpdateItems, lastTickedId]);

  const handleSelectAll = useCallback((select: boolean) => {
    startTransition(() => {
      // Fast path: avoid mutating objects that already match the selection status
      const updated = items.map((item) => (item.selected === select ? item : { ...item, selected: select }));
      onUpdateItems(updated, false);
      if (select && items.length > 0) {
        setLastTickedId(items[0].id);
      } else {
        setLastTickedId(null);
      }
    });
  }, [items, onUpdateItems]);

  const handleDeleteItem = useCallback((id: string) => {
    if (!isAdmin) return;
    const updated = items.filter((item) => item.id !== id);
    onUpdateItems(updated, true);
  }, [isAdmin, items, onUpdateItems]);

  const handleDeleteSelected = useCallback(() => {
    const remaining = items.filter((item) => !item.selected);
    onUpdateItems(remaining, true);
  }, [items, onUpdateItems]);

  const handleApplyBatchQuantity = useCallback(() => {
    if (batchQty < 1) return;
    const updated = items.map((item) =>
      item.selected ? { ...item, quantity: batchQty } : item
    );
    onUpdateItems(updated, true);
  }, [batchQty, items, onUpdateItems]);

  const formattedBatchDate = useMemo(() => {
    if (!batchDateISO) return getTodayFormattedDate();
    const parts = batchDateISO.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return batchDateISO;
  }, [batchDateISO]);

  const handleApplyBatchDate = useCallback(() => {
    const updated = items.map((item) =>
      item.selected ? { ...item, date: formattedBatchDate } : item
    );
    onUpdateItems(updated, true);
  }, [formattedBatchDate, items, onUpdateItems]);

  const selectedCount = useMemo(() => items.filter((i) => i.selected).length, [items]);
  const allSelected = items.length > 0 && selectedCount === items.length;

  return (
    <div className="flex flex-col h-full bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden">
      {/* Staff Read-Only Notice Banner */}
      {!isAdmin && (
        <div className="bg-emerald-50/90 border-b border-emerald-200 px-3.5 py-2 flex items-center justify-between text-xs text-emerald-950 font-medium">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Quyền Kỹ thuật viên (Chỉ chọn & in):</strong> Dữ liệu danh mục linh kiện được đồng bộ tự động từ Quản trị viên. Bạn có thể chọn tem, đổi số lượng tem cần in và bấm In tem.
            </span>
          </div>
          <span className="text-[11px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-md border border-emerald-300 shrink-0 ml-2">
            Đồng bộ Cloud
          </span>
        </div>
      )}

      {/* Stock Toast Notification */}
      {stockToast && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold px-3.5 py-2 flex items-center justify-between shadow-xs animate-in slide-in-from-top duration-150 border-b border-emerald-400">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-emerald-100" />
            <span>{stockToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setStockToast(null)}
            className="text-emerald-100 hover:text-white ml-2 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table Toolbar */}
      <div className="p-3 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Tìm mã, model, tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val && (val.startsWith(']') || val.includes('\t'))) {
                    const clean = extractBarcodePartCode(val, items);
                    if (clean) setSearchTerm(clean);
                  }
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (pasted && (pasted.startsWith(']') || pasted.includes('\t') || pasted.length > 25)) {
                  const clean = extractBarcodePartCode(pasted, items);
                  if (clean && clean !== pasted) {
                    e.preventDefault();
                    setSearchTerm(clean);
                  }
                }
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-stone-700 font-medium"
            >
              <option value="ALL">Tất cả phân loại ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Nút Hiện / Ẩn check tồn mã linh kiện */}
          <button
            type="button"
            onClick={() => {
              const nextVal = !showStockCheckButton;
              setShowStockCheckButton(nextVal);
              try {
                localStorage.setItem('label_show_stock_check_btn', String(nextVal));
              } catch {}
              setStockToast(
                nextVal
                  ? 'Đã bật luôn hiển thị nút check tồn kho GCSM'
                  : 'Đã ẩn nút check tồn kho GCSM (chỉ hiện khi rê chuột vào mã SP)'
              );
              setTimeout(() => setStockToast(null), 3000);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-xs rounded-lg cursor-pointer transition-colors border ${
              showStockCheckButton
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300 shadow-2xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-600 border-stone-300'
            }`}
            title="Bật / Tắt hiển thị nút mở cổng tra cứu tồn kho GCSM sau mã linh kiện"
          >
            <ExternalLink className={`w-3.5 h-3.5 ${showStockCheckButton ? 'text-emerald-600' : 'text-stone-500'}`} />
            <span>
              Nút check tồn:{' '}
              <strong className={showStockCheckButton ? 'text-emerald-700 font-bold' : 'text-stone-500 font-bold'}>
                {showStockCheckButton ? 'Hiện' : 'Ẩn'}
              </strong>
            </span>
          </button>

          {items.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  const targetItem =
                    (lastTickedId && items.find((i) => i.id === lastTickedId && i.selected !== false)) ||
                    items.find((i) => i.selected === true) ||
                    (focusedItemId ? items.find((i) => i.id === focusedItemId) : null) ||
                    paginatedItems[0] ||
                    items[0];
                  handleCheckStock(targetItem?.code);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-pointer transition-colors shadow-2xs"
                title="Mở cổng tra cứu tồn kho GCSM & tự động sao chép mã linh kiện đang chọn"
              >
                <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                <span>Check tồn kho</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetItem =
                    (lastTickedId && items.find((i) => i.id === lastTickedId && i.selected !== false)) ||
                    items.find((i) => i.selected === true) ||
                    (focusedItemId ? items.find((i) => i.id === focusedItemId) : null) ||
                    paginatedItems[0] ||
                    items[0];

                  if (targetItem) {
                    onFocusItem?.(targetItem.id);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-pointer transition-colors shadow-2xs"
                title="Tìm và xem vị trí tem in của dòng đang được tick chọn"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Xem vị trí tem
                  {(() => {
                    const targetItem =
                      (lastTickedId && items.find((i) => i.id === lastTickedId && i.selected !== false)) ||
                      items.find((i) => i.selected === true) ||
                      (focusedItemId ? items.find((i) => i.id === focusedItemId) : null);
                    if (targetItem) {
                      const idx = items.findIndex((i) => i.id === targetItem.id);
                      return idx !== -1 ? ` (#${idx + 1})` : '';
                    }
                    return '';
                  })()}
                </span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowBatchTools(!showBatchTools)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
              showBatchTools
                ? 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold shadow-2xs'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
            <span>Thao tác hàng loạt</span>
          </button>

          {/* Camera Barcode Scanner Button */}
          <button
            type="button"
            onClick={() => handleOpenScanner()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
            title="Mở camera điện thoại / webcam để quét mã vạch / QR gán trực tiếp vào mã SP dòng được chọn"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Quét Camera</span>
          </button>

          {/* File Import / Export Group */}
          <div className="flex items-center gap-1 border-l border-stone-300 pl-2 ml-0.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleExcelImport}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            {/* Gom Nhập, Xuất & Mẫu Excel thành 1 nút dropdown duy nhất */}
            <ExcelActionMenu
              onImportClick={() => fileInputRef.current?.click()}
              onExportClick={handleExcelExport}
              onDownloadSampleClick={handleDownloadSample}
              exportCount={sortedItems.length}
              buttonText="Nhập / Xuất Excel"
              shortButtonText="Excel"
              theme="emerald"
              title="Thao tác nhập file Excel, xuất bảng tem hiện tại hoặc tải file mẫu"
            />
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={onAddNewRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm dòng</span>
            </button>
          )}
        </div>
      </div>

        {/* Batch Tools Bar if expanded */}
        {showBatchTools && (
          <div className="px-3 py-2 bg-emerald-50/80 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-medium text-emerald-950">
                Đã chọn: <strong>{selectedCount}</strong> / {items.length} tem
              </span>
              <button
                type="button"
                onClick={() => handleSelectAll(!allSelected)}
                className="text-emerald-700 hover:text-emerald-900 hover:underline font-bold cursor-pointer"
              >
                {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg px-2 py-0.5 shrink-0">
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
                  disabled={selectedCount === 0}
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  Áp dụng
                </button>
              </div>

              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => {
                  const selected = items.filter((i) => i.selected);
                  const codes = selected.map((i) => i.code).filter(Boolean).join('\n');
                  handleCheckStock(codes);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold rounded-lg disabled:opacity-40 cursor-pointer transition-colors shrink-0 whitespace-nowrap shadow-2xs"
                title="Sao chép các mã SP đang chọn và mở hệ thống GCSM tra cứu tồn kho"
              >
                <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                <span>Check tồn kho ({selectedCount})</span>
              </button>

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
                  disabled={selectedCount === 0 || !batchDateISO}
                  onClick={handleApplyBatchDate}
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold disabled:opacity-40 cursor-pointer transition-colors shrink-0 shadow-2xs whitespace-nowrap"
                  title={`Gán ngày ${formattedBatchDate} cho ${selectedCount} tem đang chọn`}
                >
                  Gán ngày
                </button>
              </div>

              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => {
                  const selectedItemsList = items.filter((i) => i.selected);
                  const tsv = selectedItemsList
                    .map((i) => `${i.code}\t${i.name}\t${i.model}\t${i.category}\t${i.location || ''}\t${i.quantity || 1}\t${i.date || ''}`)
                    .join('\n');
                  navigator.clipboard.writeText(tsv);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 font-semibold rounded-lg disabled:opacity-40 cursor-pointer transition-colors shrink-0 whitespace-nowrap shadow-2xs"
                title="Sao chép tất cả dòng đang chọn để dán sang Excel"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sao chép {selectedCount} dòng</span>
              </button>

              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => onPrintSelected(items.filter((i) => i.selected))}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In {selectedCount} tem đã chọn</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa đã chọn</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[420px]">
          <table className="w-full text-left border-collapse text-xs min-w-[920px]">
            <thead className="bg-stone-100 text-stone-700 font-semibold sticky top-0 z-10 border-b border-stone-200">
              <tr>
                <th className="p-2 w-9 min-w-[36px] text-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(!allSelected)}
                    className="cursor-pointer text-stone-600 hover:text-emerald-700"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-2 w-10 min-w-[40px] text-center text-stone-400 shrink-0">#</th>
                <th
                  onClick={() => handleSort('code')}
                  className="p-2 cursor-pointer hover:bg-stone-200 transition-colors w-[145px] min-w-[145px]"
                >
                  <div className="flex items-center justify-between">
                    <span>Mã SP (Cột A)</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('model')}
                  className="p-2 cursor-pointer hover:bg-stone-200 transition-colors w-[135px] min-w-[135px]"
                >
                  <div className="flex items-center justify-between">
                    <span>Model (Cột C)</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="p-2 cursor-pointer hover:bg-stone-200 transition-colors min-w-[220px]"
                >
                  <div className="flex items-center justify-between">
                    <span>Tên Linh Kiện (Cột B)</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="p-2 cursor-pointer hover:bg-stone-200 transition-colors w-[85px] min-w-[85px]"
                >
                  <div className="flex items-center justify-between">
                    <span>Loại (D)</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('location')}
                  className="p-2 cursor-pointer hover:bg-stone-200 transition-colors w-[85px] min-w-[85px]"
                >
                  <div className="flex items-center justify-between">
                    <span>Mã Kệ</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="p-2 cursor-pointer hover:bg-stone-200 transition-colors w-[100px] min-w-[100px]"
                >
                  <div className="flex items-center justify-between">
                    <span>Ngày nhập</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('quantity')}
                  className="p-2 cursor-pointer hover:bg-stone-200 transition-colors w-[75px] min-w-[75px] text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Số tem</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th className="p-2 w-[140px] min-w-[140px] text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>Thao tác</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 select-text">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p className="text-sm">Chưa có linh kiện nào.</p>
                      <p className="text-xs text-stone-500">
                        Tải lên file Excel (.xlsx), dán dữ liệu vào ô văn bản, hoặc nhấn "+ Thêm dòng".
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => (
                  <DataTableRow
                    key={item.id}
                    item={item}
                    index={startIndex + idx}
                    isFocused={item.id === focusedItemId}
                    editingCell={editingCell}
                    isAdmin={isAdmin}
                    showStockCheckButton={showStockCheckButton}
                    onToggleSelect={handleToggleSelect}
                    onStartEditCell={handleStartEditCell}
                    onCellBlur={handleCellBlur}
                    onCheckStock={handleCheckStock}
                    onFocusItem={onFocusItem}
                    onFieldChange={handleFieldChange}
                    onDeleteItem={handleDeleteItem}
                    onOpenScanner={handleOpenScanner}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination & Stats */}
        <div className="p-2.5 bg-stone-50 border-t border-stone-200 text-xs text-stone-600 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>
              Hiển thị <strong>{sortedItems.length === 0 ? 0 : startIndex + 1} - {endIndex}</strong> / <strong>{items.length}</strong> linh kiện
            </span>
            {filteredItems.length !== items.length && (
              <span className="text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300 text-[11px] font-bold">
                (Khớp bộ lọc: {filteredItems.length})
              </span>
            )}
          </div>

          {/* Pagination Navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-stone-500">Mỗi trang:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="py-0.5 px-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-stone-700"
              >
                <option value={25}>25 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
                <option value={250}>250 dòng</option>
                <option value="all">Tất cả ({sortedItems.length})</option>
              </select>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1 border border-stone-300 bg-white rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded-md hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-stone-700"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-md hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-stone-700"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="px-2 py-0.5 text-xs font-bold text-emerald-950">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-md hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-stone-700"
                  title="Trang tiếp"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-md hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-stone-700"
                  title="Trang cuối"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Camera Barcode Scanner Modal */}
        {isScannerOpen && scannerTargetItem && (
          <CameraBarcodeScannerModal
            isOpen={isScannerOpen}
            onClose={() => {
              setIsScannerOpen(false);
              setScannerTargetItem(null);
            }}
            targetItem={scannerTargetItem}
            targetRowIndex={items.findIndex((i) => i.id === scannerTargetItem.id)}
            totalRows={items.length}
            onScanSuccess={(scannedCode, targetItemId) => {
              // Update code of this item
              const cleanCode = extractBarcodePartCode(scannedCode, items) || scannedCode;
              const targetIdx = items.findIndex((i) => i.id === targetItemId);
              const updated = items.map((item) =>
                item.id === targetItemId ? { ...item, code: cleanCode } : item
              );
              onUpdateItems(updated, true);
              setStockToast(`📷 Đã quét thành công mã "${cleanCode}" cho dòng #${targetIdx >= 0 ? targetIdx + 1 : ''}!`);
              setTimeout(() => setStockToast(null), 3500);
            }}
            onMoveToNextRow={(currentItemId: string) => {
              const curIdx = items.findIndex((i) => i.id === currentItemId);
              if (curIdx >= 0 && curIdx < items.length - 1) {
                const nextItem = items[curIdx + 1];
                setScannerTargetItem(nextItem);
                return nextItem;
              }
              return null;
            }}
            onMoveToPrevRow={(currentItemId: string) => {
              const curIdx = items.findIndex((i) => i.id === currentItemId);
              if (curIdx > 0) {
                const prevItem = items[curIdx - 1];
                setScannerTargetItem(prevItem);
                return prevItem;
              }
              return null;
            }}
          />
        )}
      </div>
  );
};

export const DataTable = memo(DataTableInner);
