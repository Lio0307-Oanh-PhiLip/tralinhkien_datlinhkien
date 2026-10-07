import React, { useState, useRef } from 'react';
import {
  Link2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  PlusCircle,
  Search,
  AlertCircle,
  X,
  ExternalLink,
  FileText,
  Upload,
  FileSpreadsheet,
  Check,
  Filter,
  Layers,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { LabelItem } from '../types/label';
import {
  parseContentToLabelItems,
  parseExcelFileToLabelItems,
} from '../utils/shareLinkParser';

interface LinkSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentItems: LabelItem[];
  onAddItems: (newItems: LabelItem[]) => void;
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

const DEFAULT_SHARE_LINK = 'https://gemini.google.com/share/ed3e5875fe9e';

export const LinkSyncModal: React.FC<LinkSyncModalProps> = ({
  isOpen,
  onClose,
  currentItems,
  onAddItems,
  onShowToast,
}) => {
  const [shareUrl, setShareUrl] = useState<string>(() => {
    return localStorage.getItem('oppo_saved_share_link') || DEFAULT_SHARE_LINK;
  });
  const [activeMode, setActiveMode] = useState<'excel' | 'paste' | 'url'>('excel');
  const [pastedContent, setPastedContent] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [parsedItems, setParsedItems] = useState<LabelItem[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterNewOnly, setFilterNewOnly] = useState<boolean>(true);
  const [selectedTabFilter, setSelectedTabFilter] = useState<string>('ALL');
  const [detectedTabs, setDetectedTabs] = useState<string[]>([]);
  const [filteredJunkCount, setFilteredJunkCount] = useState<number>(0);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set of existing product codes for fast lookup
  const existingCodesSet = React.useMemo(() => {
    const set = new Set<string>();
    currentItems.forEach((item) => {
      if (item.code) {
        set.add(item.code.trim().toUpperCase());
      }
    });
    return set;
  }, [currentItems]);

  // Handle Excel or JSON file upload from StockSync Hub
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsParsingFile(true);
    try {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.json')) {
        // Read JSON backup file
        const text = await file.text();
        const { items, junkFilteredCount, detectedTabs: tabs } = parseContentToLabelItems(text);

        if (items.length === 0) {
          onShowToast('Không tìm thấy danh sách mã linh kiện hợp lệ trong file JSON!', 'error');
          return;
        }

        applyParsedResults(items, junkFilteredCount, tabs, `Đã nạp thành công ${items.length} mã linh kiện từ file JSON!`);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        // Read Excel file directly via SheetJS
        const buffer = await file.arrayBuffer();
        const { items, detectedTabs: tabs } = parseExcelFileToLabelItems(buffer);

        if (items.length === 0) {
          onShowToast('Không tìm thấy mã linh kiện trong file Excel. Vui lòng kiểm tra lại file!', 'error');
          return;
        }

        applyParsedResults(items, 0, tabs, `Đã nạp thành công ${items.length} mã linh kiện từ file Excel!`);
      } else {
        // Try reading as plain text/tsv
        const text = await file.text();
        const { items, junkFilteredCount, detectedTabs: tabs } = parseContentToLabelItems(text);

        if (items.length === 0) {
          onShowToast('Định dạng file không được hỗ trợ hoặc không có mã linh kiện!', 'error');
          return;
        }

        applyParsedResults(items, junkFilteredCount, tabs, `Đã nạp thành công ${items.length} mã linh kiện từ file!`);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      onShowToast(`Lỗi khi đọc file: ${err?.message || 'Không xác định'}`, 'error');
    } finally {
      setIsParsingFile(false);
    }
  };

  // Helper to apply parsed results
  const applyParsedResults = (
    items: LabelItem[],
    junkCount: number,
    tabs: string[],
    successMessage: string
  ) => {
    setParsedItems(items);
    setFilteredJunkCount(junkCount);
    setDetectedTabs(tabs);
    setSelectedTabFilter('ALL');

    // Auto select only new codes
    const newCodes = new Set<string>();
    items.forEach((item) => {
      if (!existingCodesSet.has(item.code.toUpperCase())) {
        newCodes.add(item.code.toUpperCase());
      }
    });

    setSelectedCodes(newCodes);
    setHasScanned(true);
    onShowToast(successMessage, 'success');
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Parse pasted content
  const handleParsePastedText = () => {
    if (!pastedContent.trim()) {
      onShowToast('Vui lòng dán nội dung bảng danh sách mã từ StockSync Hub!', 'error');
      return;
    }

    const { items, junkFilteredCount, detectedTabs: tabs } = parseContentToLabelItems(pastedContent);
    if (items.length === 0) {
      onShowToast('Không tìm thấy mã linh kiện phù hợp trong nội dung dán!', 'error');
      return;
    }

    applyParsedResults(
      items,
      junkFilteredCount,
      tabs,
      `Đã phân tích thành công ${items.length} mã linh kiện! (Đã tự động loại bỏ ${junkFilteredCount} dòng rác CSS/HTML)`
    );
  };

  // Perform Link Scan
  const handleScanLink = async () => {
    if (!shareUrl.trim()) {
      onShowToast('Vui lòng nhập đường link share!', 'error');
      return;
    }

    setIsScanning(true);
    setHasScanned(false);

    try {
      localStorage.setItem('oppo_saved_share_link', shareUrl.trim());

      // Fetch via backend proxy
      const res = await fetch(`/api/sync-share-link?url=${encodeURIComponent(shareUrl.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.parsedItems && Array.isArray(data.parsedItems) && data.parsedItems.length > 0) {
          applyParsedResults(
            data.parsedItems,
            0,
            [],
            `Đã quét thành công ${data.parsedItems.length} mã từ link!`
          );
          return;
        }
      }

      // If direct fetch returns HTML page without parsed rows
      onShowToast(
        'Link Gemini Share là ứng dụng Canvas chạy trong trình duyệt. Vui lòng bấm [Xuất Excel] trên StockSync Hub rồi nạp file vào tab Excel ở trên!',
        'info'
      );
      setActiveMode('excel');
    } catch (err: any) {
      console.warn('Link scan warning:', err);
      onShowToast(
        'Không thể đọc dữ liệu trực tiếp qua URL. Vui lòng tải file Excel từ StockSync Hub hoặc dán bảng vào đây!',
        'info'
      );
      setActiveMode('excel');
    } finally {
      setIsScanning(false);
    }
  };

  // Filter items for display
  const displayedItems = React.useMemo(() => {
    return parsedItems.filter((item) => {
      const isNew = !existingCodesSet.has(item.code.toUpperCase());
      if (filterNewOnly && !isNew) return false;

      // Tab / Dòng máy filter
      if (selectedTabFilter !== 'ALL') {
        const itemTab = (item.location || '').toUpperCase();
        if (itemTab !== selectedTabFilter.toUpperCase()) {
          return false;
        }
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q))
      );
    });
  }, [parsedItems, existingCodesSet, filterNewOnly, selectedTabFilter, searchQuery]);

  const newItemsCount = React.useMemo(() => {
    return parsedItems.filter((i) => !existingCodesSet.has(i.code.toUpperCase())).length;
  }, [parsedItems, existingCodesSet]);

  const existingItemsCount = parsedItems.length - newItemsCount;

  // Toggle selection
  const handleToggleCode = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code.toUpperCase())) {
      next.delete(code.toUpperCase());
    } else {
      next.add(code.toUpperCase());
    }
    setSelectedCodes(next);
  };

  const handleSelectAllNew = () => {
    const next = new Set<string>();
    parsedItems.forEach((i) => {
      if (!existingCodesSet.has(i.code.toUpperCase())) {
        next.add(i.code.toUpperCase());
      }
    });
    setSelectedCodes(next);
  };

  const handleSelectAllCurrentFilter = () => {
    const next = new Set(selectedCodes);
    displayedItems.forEach((i) => {
      next.add(i.code.toUpperCase());
    });
    setSelectedCodes(next);
  };

  const handleDeselectAll = () => {
    setSelectedCodes(new Set());
  };

  // Add selected items to system
  const handleApplyAddItems = () => {
    const itemsToAdd = parsedItems.filter((i) => selectedCodes.has(i.code.toUpperCase()));
    if (itemsToAdd.length === 0) {
      onShowToast('Vui lòng chọn ít nhất 1 mã linh kiện để cập nhật!', 'error');
      return;
    }

    onAddItems(itemsToAdd);
    onShowToast(`🎉 Đã bổ sung thành công ${itemsToAdd.length} mã linh kiện mới vào hệ thống!`, 'success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 via-emerald-950 to-stone-900 p-4 sm:p-5 text-white flex items-center justify-between gap-3 border-b border-emerald-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-300">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Đồng Bộ Danh Sách Mã Linh Kiện Từ StockSync Hub</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                  Lọc Sạch Rác CSS 100%
                </span>
              </h3>
              <p className="text-xs text-stone-300 mt-0.5">
                Trích xuất chính xác bảng linh kiện (CODE, PRODUCT NAME, MODEL, TYPE, DÒNG MÁY), loại bỏ hoàn toàn biến CSS / HTML rác.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-stone-50/50">
          {/* Method Tabs */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                {/* Tab 1: Excel Import (Recommended) */}
                <button
                  type="button"
                  onClick={() => setActiveMode('excel')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMode === 'excel'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Nạp File Excel / Backup</span>
                  <span className="bg-white/20 text-white px-1.5 py-0.2 rounded-sm text-[10px] uppercase font-bold">
                    Chuẩn 100%
                  </span>
                </button>

                {/* Tab 2: Copy & Paste */}
                <button
                  type="button"
                  onClick={() => setActiveMode('paste')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMode === 'paste'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Dán Bảng Dữ Liệu (Copy & Paste)</span>
                </button>

                {/* Tab 3: URL Scan */}
                <button
                  type="button"
                  onClick={() => setActiveMode('url')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMode === 'url'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Quét Qua Link URL</span>
                </button>
              </div>

              {/* Direct Link to StockSync Hub */}
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 hover:underline bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
              >
                <span>Mở StockSync Hub trong tab mới</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Mode 1: Excel / Backup Upload */}
            {activeMode === 'excel' && (
              <div className="space-y-3">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    dragActive
                      ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01]'
                      : 'border-stone-300 hover:border-emerald-500 hover:bg-stone-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-stone-800">
                      Kéo thả hoặc nhấn để chọn file <span className="text-emerald-600 font-mono">.xlsx</span> / <span className="text-emerald-600 font-mono">.json</span> từ StockSync Hub
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      Hỗ trợ file xuất trực tiếp từ nút <strong>[ 📥 Xuất Excel ]</strong> hoặc <strong>[ 📥 Tải Backup ]</strong> trên giao diện StockSync Hub
                    </p>
                  </div>

                  {isParsingFile && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mt-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang trích xuất dữ liệu danh sách mã...</span>
                    </div>
                  )}
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Cách lấy toàn bộ 5,731 mã nhanh và chính xác nhất:</p>
                    <p className="mt-0.5 text-emerald-800">
                      1. Mở StockSync Hub trong trình duyệt của bạn &rarr; 2. Tại tab <strong>Danh sách mã LK</strong>, nhấn nút màu xanh <strong>[ 📥 Xuất Excel ]</strong> (hoặc góc trên <strong>[ 📥 Tải Backup ]</strong>) &rarr; 3. Nạp file vừa tải vào ô phía trên.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mode 2: Copy & Paste Table */}
            {activeMode === 'paste' && (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    placeholder={`Bôi đen các dòng trong bảng StockSync Hub rồi Copy & Dán vào đây...\nVí dụ:\n612122000195\tPhím âm lượng ngoài A3x (Xanh)\tA3x\tPHIM\tA\tDate(2024,7,26)\n4901668\tBo mạch chính 3G 64G A5 (Xách tay) PBAM00\tA5 (Xách tay)\tMAIN\tA\tDate(2019,7,29)\n\n(Hệ thống tự động lọc sạch nút "Info", "Check tồn", biểu tượng copy và các dòng CSS rác)`}
                    rows={6}
                    className="w-full p-3 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono bg-stone-50/50"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-stone-400" />
                    <span>Bộ lọc thông minh sẽ tự động tách Mã SP, Tên LK, Model, Loại và Dòng máy.</span>
                  </p>

                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Phân Tích & Lọc Dữ Liệu</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mode 3: Scan via URL */}
            {activeMode === 'url' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={shareUrl}
                      onChange={(e) => setShareUrl(e.target.value)}
                      placeholder="Nhập link Gemini Share hoặc Google Sheet CSV..."
                      className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <Link2 className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  </div>
                  <button
                    type="button"
                    onClick={handleScanLink}
                    disabled={isScanning}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>{isScanning ? 'Đang Quét Link...' : '⚡ Quét Link Trực Tiếp'}</span>
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Lưu ý về link Gemini Share:</p>
                    <p className="mt-0.5 text-amber-800">
                      StockSync Hub chạy trên trình duyệt người dùng (Client Canvas), máy chủ bên ngoài không thể tải ngầm mã trực tiếp qua HTTP. Nếu quét URL không trả về dữ liệu, vui lòng bấm tab <strong>"Nạp File Excel / Backup"</strong> hoặc <strong>"Dán Bảng Dữ Liệu"</strong> ở trên để nạp chính xác 100%.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scanned Results Section */}
          {hasScanned && (
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-4">
              {/* Summary Stats Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+{newItemsCount} Mã Mới Chưa Có Trong Kho</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-stone-500" />
                    <span>{existingItemsCount} Mã Đã Có Trùng</span>
                  </div>
                  <div className="text-xs text-stone-600 font-medium">
                    Tổng: <strong>{parsedItems.length}</strong> mã hợp lệ
                  </div>
                  {filteredJunkCount > 0 && (
                    <div className="text-xs text-stone-400 italic">
                      (Đã loại bỏ {filteredJunkCount} dòng rác/CSS)
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAllNew}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                  >
                    Chọn tất cả mã mới ({newItemsCount})
                  </button>
                  <span className="text-stone-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-xs font-semibold text-stone-500 hover:text-stone-700 hover:underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* Detected Tabs / Dòng Máy Filter */}
              {detectedTabs.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs font-bold text-stone-600 flex items-center gap-1 shrink-0">
                    <Layers className="w-3.5 h-3.5 text-stone-400" />
                    <span>Dòng Máy (Tab):</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedTabFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      selectedTabFilter === 'ALL'
                        ? 'bg-stone-800 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    Tất Cả ({parsedItems.length})
                  </button>

                  {detectedTabs.map((tab) => {
                    const countInTab = parsedItems.filter(
                      (i) => (i.location || '').toUpperCase() === tab.toUpperCase()
                    ).length;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setSelectedTabFilter(tab)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                          selectedTabFilter.toUpperCase() === tab.toUpperCase()
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {tab} ({countInTab})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo Mã SP, Model, Tên linh kiện, Loại..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterNewOnly}
                      onChange={(e) => setFilterNewOnly(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span>Chỉ hiển thị mã mới ({newItemsCount})</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleSelectAllCurrentFilter}
                    className="text-xs font-semibold text-stone-600 hover:text-stone-800 hover:underline cursor-pointer"
                  >
                    Chọn danh sách đang lọc ({displayedItems.length})
                  </button>
                </div>
              </div>

              {/* Preview Data Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-stone-100 text-stone-700 font-bold sticky top-0 border-b border-stone-200 z-10">
                    <tr>
                      <th className="p-2.5 w-12 text-center">Chọn</th>
                      <th className="p-2.5">Mã SP (CODE)</th>
                      <th className="p-2.5">Tên Linh Kiện (PRODUCT NAME)</th>
                      <th className="p-2.5">Model</th>
                      <th className="p-2.5">Loại (TYPE)</th>
                      <th className="p-2.5">Dòng Máy</th>
                      <th className="p-2.5 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {displayedItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-stone-400 font-medium">
                          Không tìm thấy mã linh kiện phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      displayedItems.map((item) => {
                        const isExisting = existingCodesSet.has(item.code.toUpperCase());
                        const isChecked = selectedCodes.has(item.code.toUpperCase());

                        return (
                          <tr
                            key={item.id}
                            onClick={() => handleToggleCode(item.code)}
                            className={`cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-emerald-50/50 hover:bg-emerald-50'
                                : isExisting
                                ? 'bg-stone-50/60 opacity-70 hover:bg-stone-100'
                                : 'hover:bg-stone-50'
                            }`}
                          >
                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCode(item.code)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-mono font-bold text-stone-900">{item.code}</td>
                            <td className="p-2.5 font-medium text-stone-800">{item.name}</td>
                            <td className="p-2.5 font-semibold text-indigo-900">{item.model}</td>
                            <td className="p-2.5 font-mono text-stone-600">
                              <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[11px]">
                                {item.category}
                              </span>
                            </td>
                            <td className="p-2.5 font-semibold text-stone-700">
                              {item.location && item.location !== '-' ? (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[11px]">
                                  {item.location}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {isExisting ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Đã có
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                  Mã Mới
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-600 font-medium">
            Đã chọn: <strong className="text-emerald-700 font-bold text-sm">{selectedCodes.size}</strong> mã để bổ sung vào hệ thống
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleApplyAddItems}
              disabled={selectedCodes.size === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Bổ Sung {selectedCodes.size} Mã Mới Vào Hệ Thống</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
