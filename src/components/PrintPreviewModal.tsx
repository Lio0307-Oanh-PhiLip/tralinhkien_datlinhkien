import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Printer,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Download,
  ExternalLink,
  Layers,
  Copy,
  FileCode,
  Eye,
  Settings2,
  Plus,
  Check,
} from 'lucide-react';
import { LabelConfig, LabelItem, DEFAULT_LABEL_CONFIG } from '../types/label';
import { generatePrintableHtml, downloadPrintableHtmlFile } from '../utils/printHelper';
import { ElectronPrinterInfo } from '../types/electron';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: LabelItem[];
  config: LabelConfig;
  title?: string;
  onOpenSettings?: () => void;
}

// Office & barcode label printer driver presets
const POPULAR_PRINTER_PRESETS = [
  { name: 'EPSON L3110 Series', desc: 'Máy in phun đa năng Epson L3110' },
  { name: 'EPSON L3250 Series', desc: 'Máy in phun đa năng Epson L3250' },
  { name: 'Canon LBP2900', desc: 'Máy in laser Canon LBP 2900' },
  { name: 'LBP6030w/6018w', desc: 'Máy in laser Canon LBP 6030/6018' },
  { name: 'Xprinter XP-350B', desc: 'Máy in nhiệt tem mã vạch XP-350B' },
  { name: 'Xprinter XP-420B', desc: 'Máy in nhiệt tem mã vạch XP-420B' },
  { name: 'HPRT N41', desc: 'Máy in nhiệt tem chuyên dụng' },
  { name: 'Godex G500', desc: 'Máy in nhãn mã vạch công nghiệp' },
  { name: 'Brother QL-800', desc: 'Máy in nhãn Brother QL Series' },
  { name: 'Microsoft Print to PDF', desc: 'Xuất file PDF khổ 3x2' },
];

/**
 * Universal Intelligent Printer Driver Resolver
 * Matches any preset, partial model, or fuzzy user string to the actual Windows Spooler driver name.
 */
export function resolvePrinterMatch(
  query: string,
  printerList: ElectronPrinterInfo[]
): ElectronPrinterInfo | null {
  if (!query || !Array.isArray(printerList) || printerList.length === 0) return null;
  const clean = query.trim();
  const lower = clean.toLowerCase();

  // 1. Exact match
  const exact = printerList.find((p) => p && p.name === clean);
  if (exact) return exact;

  // 2. Case-insensitive exact match
  const caseMatch = printerList.find((p) => p && p.name.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  // 3. Substring inclusion match (either way)
  const subMatch = printerList.find(
    (p) => p && (lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower))
  );
  if (subMatch) return subMatch;

  // 4. Model number extraction match (e.g. "3110", "3250", "2900", "6030", "6018", "350", "420", "800")
  const numbers = lower.match(/\d{3,4}/g) || [];
  for (const num of numbers) {
    const numMatch = printerList.find((p) => p && p.name.toLowerCase().includes(num));
    if (numMatch) return numMatch;
  }

  // 5. Token & Brand scoring
  const tokens = lower
    .split(/[\s\/\-_,]+/)
    .filter((t) => t.length >= 3 && !['series', 'printer', 'mayin'].includes(t));

  let bestPrinter: ElectronPrinterInfo | null = null;
  let maxScore = 0;

  for (const p of printerList) {
    if (!p || !p.name) continue;
    const pLower = p.name.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (pLower.includes(token)) {
        score += token.length;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestPrinter = p;
    }
  }

  if (bestPrinter && maxScore > 0) return bestPrinter;

  return null;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  items,
  config: initialConfig,
  title = 'Xem Trước & Cấu Hình In Tem Khổ 3x2 inch',
  onOpenSettings,
}) => {
  const activeConfig = initialConfig || DEFAULT_LABEL_CONFIG;
  const [config, setConfig] = useState<LabelConfig>(activeConfig);
  const [zoom, setZoom] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [isElectron, setIsElectron] = useState<boolean>(false);
  const [printers, setPrinters] = useState<ElectronPrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessMessage, setPrintSuccessMessage] = useState<string | null>(null);
  const [printErrorMessage, setPrintErrorMessage] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'current'>('all');
  const [isLoadingPrinters, setIsLoadingPrinters] = useState<boolean>(false);

  // Custom user-added printer driver names
  const [customPrinters, setCustomPrinters] = useState<string[]>([]);
  const [isAddingCustomPrinter, setIsAddingCustomPrinter] = useState<boolean>(false);
  const [newPrinterNameInput, setNewPrinterNameInput] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync config when prop changes
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  // Load saved printer choices from localStorage on mount
  useEffect(() => {
    try {
      const savedPrinter = localStorage.getItem('oppo_selected_printer');
      if (savedPrinter) {
        setSelectedPrinter(savedPrinter);
      }
      const savedCustoms = localStorage.getItem('oppo_custom_printers');
      if (savedCustoms) {
        const parsed = JSON.parse(savedCustoms);
        if (Array.isArray(parsed)) {
          setCustomPrinters(parsed);
        }
      }
    } catch (e) {
      console.warn('LocalStorage error reading printer prefs:', e);
    }
  }, []);

  // Check Electron environment & load printers from system spooler
  const loadPrinters = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectron(true);
      if (window.electronAPI.getPrinters) {
        setIsLoadingPrinters(true);
        try {
          const list = await window.electronAPI.getPrinters();
          const safeList = Array.isArray(list) ? list : [];
          setPrinters(safeList);
          if (safeList.length > 0) {
            setSelectedPrinter((currentSelected) => {
              const saved = currentSelected || localStorage.getItem('oppo_selected_printer') || '';
              if (!saved) {
                const def = safeList.find((p) => p && p.isDefault) || safeList[0];
                return def?.name || '';
              }
              // If current choice matches a real printer in safeList exactly:
              const exact = safeList.find((p) => p && p.name === saved);
              if (exact) return exact.name;

              // If it's a fuzzy or preset name (e.g. "Epson L3110 / L3250" or "LBP6030"), resolve it to real driver name:
              const resolved = resolvePrinterMatch(saved, safeList);
              if (resolved) {
                try {
                  localStorage.setItem('oppo_selected_printer', resolved.name);
                } catch (e) {}
                return resolved.name;
              }

              // Fallback to default
              const def = safeList.find((p) => p && p.isDefault) || safeList[0];
              return def?.name || saved;
            });
          }
        } catch (err) {
          console.warn('Could not fetch electron printers:', err);
        } finally {
          setIsLoadingPrinters(false);
        }
      }
    } else {
      setIsElectron(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPrinters();
      // Retry after 600ms in case Electron initial spooler warming up takes a moment
      const retryTimer = setTimeout(() => {
        loadPrinters();
      }, 600);
      setCurrentPage(1);
      setPrintSuccessMessage(null);
      setPrintErrorMessage(null);
      return () => clearTimeout(retryTimer);
    }
  }, [isOpen, loadPrinters]);

  // Handler: Change printer selection
  const handlePrinterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__ADD_CUSTOM__') {
      setIsAddingCustomPrinter(true);
      setNewPrinterNameInput('');
    } else {
      setIsAddingCustomPrinter(false);
      setSelectedPrinter(value);
      try {
        localStorage.setItem('oppo_selected_printer', value);
      } catch (err) {}
    }
  };

  // Handler: Save custom printer driver name
  const handleSaveCustomPrinter = () => {
    const trimmed = newPrinterNameInput.trim();
    if (!trimmed) return;

    const safeCustoms = Array.isArray(customPrinters) ? customPrinters : [];
    let updated = safeCustoms;
    if (!safeCustoms.includes(trimmed)) {
      updated = [...safeCustoms, trimmed];
      setCustomPrinters(updated);
      try {
        localStorage.setItem('oppo_custom_printers', JSON.stringify(updated));
      } catch (e) {}
    }

    setSelectedPrinter(trimmed);
    try {
      localStorage.setItem('oppo_selected_printer', trimmed);
    } catch (e) {}

    setIsAddingCustomPrinter(false);
    setNewPrinterNameInput('');
  };

  // Safe reference config
  const currentConfig = config || DEFAULT_LABEL_CONFIG;

  // Multiply items if config.respectQuantity is enabled
  const processedItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    if (safeItems.length === 0) return [];
    const multiplied: LabelItem[] = [];
    safeItems.forEach((item) => {
      if (!item) return;
      const count = currentConfig.respectQuantity ? Math.max(1, item.quantity || 1) : 1;
      for (let i = 0; i < count; i++) {
        multiplied.push({ ...item, quantity: 1 });
      }
    });
    return multiplied;
  }, [items, currentConfig.respectQuantity]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    const safeProcessed = Array.isArray(processedItems) ? processedItems : [];
    if (safeProcessed.length === 0) return 0;
    if (currentConfig.template === 'split_horizontal') {
      return Math.ceil(safeProcessed.length / 2);
    }
    return safeProcessed.length;
  }, [processedItems, currentConfig.template]);

  // Items to display in current preview
  const displayItems = useMemo(() => {
    const safeProcessed = Array.isArray(processedItems) ? processedItems : [];
    if (safeProcessed.length === 0) return [];
    if (viewMode === 'all' || pageRangeMode === 'all') {
      return safeProcessed;
    }
    // Single page mode
    if (currentConfig.template === 'split_horizontal') {
      const startIndex = Math.max(0, (currentPage - 1) * 2);
      return safeProcessed.slice(startIndex, startIndex + 2);
    } else {
      const targetIndex = Math.max(0, currentPage - 1);
      const targetItem = safeProcessed[targetIndex];
      return targetItem ? [targetItem] : [];
    }
  }, [processedItems, viewMode, pageRangeMode, currentPage, currentConfig.template]);

  // Generate preview HTML whenever items, config, or displayItems change
  useEffect(() => {
    let isMounted = true;
    const safeDisplay = Array.isArray(displayItems) ? displayItems : [];
    if (!isOpen || safeDisplay.length === 0) {
      setPreviewHtml('');
      return;
    }

    // Generate standalone HTML without autoTriggerPrint
    generatePrintableHtml(safeDisplay, currentConfig, false)
      .then((html) => {
        if (isMounted) {
          setPreviewHtml(html || '');
        }
      })
      .catch((err) => {
        console.error('Failed to generate preview HTML:', err);
        if (isMounted) {
          setPreviewHtml('<div style="padding:16px;color:#ef4444;font-family:sans-serif;">Không thể nạp bản xem trước tem</div>');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, displayItems, currentConfig]);

  // Reset page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Helper to resolve device name to actual system printer if possible
  const getResolvedDeviceName = useCallback((selectedName: string): string => {
    if (!selectedName || typeof selectedName !== 'string' || selectedName.trim() === '') return '';
    const safePrinters = Array.isArray(printers) ? printers : [];
    const cleanInput = selectedName.trim();
    if (safePrinters.length === 0) return cleanInput;

    // Use intelligent resolver
    const matched = resolvePrinterMatch(cleanInput, safePrinters);
    if (matched) return matched.name;

    // Fallback to default printer so Chromium NEVER opens the Windows print dialog
    const defPrinter = safePrinters.find((p) => p.isDefault) || safePrinters[0];
    if (defPrinter) return defPrinter.name;

    return cleanInput;
  }, [printers]);

  if (!isOpen) return null;

  // Handler: Direct Print
  // - If a specific printer is selected: Prints SILENTLY directly to that printer (No Windows print dialog popup)
  // - If "Máy in mặc định của hệ thống Windows" is selected (""): Opens the Windows print dialog
  const handleDirectPrint = async () => {
    if (processedItems.length === 0) return;

    setIsPrinting(true);
    setPrintSuccessMessage(null);
    setPrintErrorMessage(null);

    const targetList = pageRangeMode === 'current' ? displayItems : processedItems;
    const isDefaultSelected = !selectedPrinter || selectedPrinter.trim() === '';
    const hasElectron = Boolean(typeof window !== 'undefined' && (window as any).electronAPI?.printHtml);

    try {
      const printableHtml = await generatePrintableHtml(targetList, config, false);

      if (hasElectron && window.electronAPI?.printHtml) {
        if (!isDefaultSelected) {
          // SPECIFIC PRINTER SELECTED: Silent direct print (No Windows print dialog popup)
          const resolvedDeviceName = getResolvedDeviceName(selectedPrinter);
          const safePrinters = Array.isArray(printers) ? printers : [];
          const finalDevice = resolvedDeviceName || (safePrinters.length > 0 ? (safePrinters.find((p) => p.isDefault)?.name || safePrinters[0]?.name) : selectedPrinter);

          const result = await window.electronAPI.printHtml({
            html: printableHtml,
            options: {
              silent: true, // SILENT MODE: No Windows dialog popup!
              deviceName: finalDevice,
              copies: copies,
              printBackground: true,
              margins: {
                marginType: 'none',
              },
            },
          });

          if (result && result.success) {
            setPrintSuccessMessage(
              `⚡ Đã in ngầm trực tiếp (Silent Print) ${targetList.length} tem tới máy in "${result.deviceUsed || finalDevice || selectedPrinter}" — Không mở hộp thoại Windows!`
            );
          } else {
            console.warn('Silent print result:', result);
            setPrintErrorMessage(
              `Không thể in trực tiếp tới máy in "${selectedPrinter}" (${result?.error || 'Lỗi kết nối'}). Vui lòng kiểm tra cáp máy in hoặc chuyển sang "Máy in mặc định của hệ thống Windows".`
            );
          }
        } else {
          // DEFAULT PRINTER SELECTED: Show Windows Print Dialog popup
          const result = await window.electronAPI.printHtml({
            html: printableHtml,
            options: {
              silent: false, // OPEN WINDOWS SYSTEM PRINT DIALOG
              copies: copies,
              printBackground: true,
              margins: {
                marginType: 'none',
              },
            },
          });

          if (result && result.success !== false) {
            setPrintSuccessMessage(
              `Đã mở hộp thoại in Windows cho ${targetList.length} tem! Chọn máy in và bấm Print để hoàn tất.`
            );
          }
        }
      } else {
        // Web mode or browser iframe
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.focus();
          iframeRef.current.contentWindow.print();
          setPrintSuccessMessage(
            !isDefaultSelected
              ? `Đã gửi lệnh in tới "${selectedPrinter}" qua trình duyệt.`
              : `Đã mở hộp thoại in trình duyệt cho ${targetList.length} tem!`
          );
        } else {
          window.print();
        }
      }
    } catch (err: any) {
      console.error('Print execution error:', err);
      setPrintErrorMessage(`Lỗi khi thực hiện in: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsPrinting(false);
    }
  };

  // Handler: System Print Dialog
  const handleSystemPrintDialog = async () => {
    if (processedItems.length === 0) return;

    setIsPrinting(true);
    setPrintSuccessMessage(null);
    setPrintErrorMessage(null);

    const targetList = pageRangeMode === 'current' ? displayItems : processedItems;

    try {
      const printableHtml = await generatePrintableHtml(targetList, config, false);

      if (isElectron && window.electronAPI?.printHtml) {
        // Open with silent: false to invoke system dialog
        await window.electronAPI.printHtml({
          html: printableHtml,
          options: {
            silent: false,
            deviceName: selectedPrinter || undefined,
            copies: copies,
          },
        });
        setPrintSuccessMessage('Đã mở hộp thoại in hệ thống.');
      } else {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.focus();
          iframeRef.current.contentWindow.print();
        } else {
          window.print();
        }
      }
    } catch (err: any) {
      setPrintErrorMessage(`Lỗi mở hộp thoại in: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsPrinting(false);
    }
  };

  // Handler: Open in External Browser (Chrome / Edge with native print preview)
  const handleOpenInBrowser = async () => {
    const targetList = pageRangeMode === 'current' ? displayItems : processedItems;
    try {
      const html = await generatePrintableHtml(targetList, config, true);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      if (isElectron && window.electronAPI?.openInBrowser) {
        await window.electronAPI.openInBrowser(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Failed to open in browser:', err);
    }
  };

  // Handler: Download HTML
  const handleDownloadHtml = async () => {
    const targetList = pageRangeMode === 'current' ? displayItems : processedItems;
    await downloadPrintableHtmlFile(targetList, config);
  };

  return (
    <div
      id="print-preview-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-fade-in"
    >
      <div
        id="print-preview-modal-container"
        className="relative flex flex-col w-full max-w-6xl h-[92vh] max-h-[880px] bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-700 overflow-hidden text-neutral-100"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-md">
                  Chuẩn 3" x 2" (76.2 × 50.8 mm)
                </span>
                {isElectron && (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-800 rounded-md">
                    Windows Desktop App
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Xem trước giao diện tem in thực tế 100% — Tránh lỗi màn hình xám "This app doesn't support print preview"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 cursor-pointer transition-colors"
                title="Tùy chỉnh cỡ chữ, mã vạch, mã QR"
              >
                <Settings2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Cấu hình tem</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors"
              title="Đóng cửa sổ xem trước"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Split View (Left: Visual Preview Canvas, Right: Settings Sidebar) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Canvas: Real Visual Label Preview */}
          <div className="flex-1 flex flex-col bg-neutral-900 min-h-0 relative border-r border-neutral-800">
            {/* Canvas Toolbar: Zoom & Pagination */}
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-950/60 border-b border-neutral-800/80 text-xs shrink-0 flex-wrap gap-2">
              {/* Pagination Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('single')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      viewMode === 'single'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Từng trang
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      viewMode === 'all'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Tất cả ({totalPages} trang)
                  </button>
                </div>

                {viewMode === 'single' && totalPages > 1 && (
                  <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-0.5 text-neutral-300 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Trang trước"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-neutral-200 text-xs px-1">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-0.5 text-neutral-300 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Trang kế tiếp"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(50, z - 15))}
                  className="p-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="w-12 text-center font-mono text-neutral-300 text-xs">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(200, z + 15))}
                  className="p-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 font-mono text-[11px] cursor-pointer"
                  title="Đặt về kích thước thật 100% (3x2 inch)"
                >
                  100% Khổ thật
                </button>
              </div>
            </div>

            {/* Visual Canvas Stage */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-neutral-900/90 relative">
              {processedItems.length === 0 ? (
                <div className="text-center text-neutral-500">
                  <p>Không có dữ liệu tem để hiển thị.</p>
                </div>
              ) : (
                <div
                  className="transition-transform duration-150 origin-center flex flex-col items-center gap-6"
                  style={{ transform: `scale(${zoom / 100})` }}
                >
                  {/* Visual Paper Sheet Container */}
                  <div className="relative shadow-2xl rounded-sm border-2 border-dashed border-emerald-500/40 bg-white p-0">
                    {/* Dimension Rulers Badges */}
                    <div className="absolute -top-6 left-0 right-0 text-center">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-neutral-800 text-emerald-400 border border-neutral-700 rounded-full shadow-xs">
                        Rộng: 3.0 inch (76.2 mm)
                      </span>
                    </div>
                    <div className="absolute -left-20 top-1/2 -translate-y-1/2 -rotate-90">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-neutral-800 text-emerald-400 border border-neutral-700 rounded-full shadow-xs">
                        Cao: 2.0 inch (50.8 mm)
                      </span>
                    </div>

                    {/* iframe rendering actual printable HTML directly */}
                    <iframe
                      ref={iframeRef}
                      title="Bản xem trước tem in khổ 3x2"
                      srcDoc={previewHtml}
                      className="border-0 bg-white shadow-inner"
                      style={{
                        width: '288px', // 3 inches at 96 DPI
                        height: viewMode === 'all' && totalPages > 1 ? `${192 * totalPages + 10}px` : '192px', // 2 inches per page at 96 DPI
                        overflow: 'hidden',
                        display: 'block',
                      }}
                    />
                  </div>

                  <div className="text-center">
                    <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Bản in đúng tỷ lệ 3:2 • Độ phân giải chuẩn cho máy in mã vạch & máy in văn phòng
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Status / Tip */}
            <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Đang xem: <strong>{displayItems.length}</strong> tem (Tổng cộng{' '}
                  <strong>{processedItems.length}</strong> tem cần in trên <strong>{totalPages}</strong> tờ giấy)
                </span>
              </div>
              <div className="text-neutral-500 hidden sm:block">
                Khổ tem: 3.0 x 2.0 inch (76.2 x 50.8 mm) • Không viền lề
              </div>
            </div>
          </div>

          {/* Right Sidebar: Print Settings & Actions */}
          <div className="w-full md:w-80 lg:w-96 bg-neutral-950 flex flex-col min-h-0 border-t md:border-t-0 shrink-0 overflow-y-auto">
            <div className="p-5 flex flex-col gap-5 flex-1">
              {/* Alert Feedback Messages */}
              {printSuccessMessage && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 rounded-xl text-xs flex items-start gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">{printSuccessMessage}</div>
                  <button
                    type="button"
                    onClick={() => setPrintSuccessMessage(null)}
                    className="text-emerald-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}

              {printErrorMessage && (
                <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-200 rounded-xl text-xs flex items-start gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">{printErrorMessage}</div>
                  <button
                    type="button"
                    onClick={() => setPrintErrorMessage(null)}
                    className="text-rose-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Section 1: Printer Selection (Microsoft Office Style Dropdown & Status) */}
              <div className="flex flex-col gap-2.5 p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Máy in đích (Printer)</span>
                  </label>
                  <button
                    type="button"
                    onClick={loadPrinters}
                    disabled={isLoadingPrinters}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors font-medium"
                    title="Quét lại danh sách máy in từ driver hệ thống Windows"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingPrinters ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>{isLoadingPrinters ? 'Đang quét...' : 'Quét lại'}</span>
                  </button>
                </div>

                {/* Printer Select Control */}
                <div className="relative">
                  <select
                    value={isAddingCustomPrinter ? '__ADD_CUSTOM__' : selectedPrinter}
                    onChange={handlePrinterChange}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer shadow-inner font-medium"
                  >
                    {printers.length > 0 ? (
                      <optgroup label={`⚡ MÁY IN TRÊN WINDOWS (${printers.length}) — TỰ ĐỘNG IN NGẦM 0 POPUP`}>
                        {printers.map((p) => (
                          <option key={`sys-${p.name}`} value={p.name}>
                            🖨️ {p.name} {p.isDefault ? '(Mặc định Windows)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      <optgroup label="⚠️ TRÌNH DUYỆT WEB KHÔNG QUÉT ĐƯỢC MÁY IN CỤC BỘ">
                        <option disabled>Vui lòng chọn chế độ mở hộp thoại Windows ở dưới để chọn máy in</option>
                      </optgroup>
                    )}

                    <optgroup label="⚙️ CHẾ ĐỘ MẶC ĐỊNH (MỞ HỘP THOẠI WINDOWS)">
                      <option value="">⚙️ Máy in mặc định của hệ thống Windows (Mở bảng in Windows)</option>
                    </optgroup>

                    {customPrinters.length > 0 && (
                      <optgroup label="⭐️ MÁY IN BẠN ĐÃ THÊM THỦ CÔNG">
                        {customPrinters.map((cp) => (
                          <option key={`cust-${cp}`} value={cp}>
                            ⭐ {cp}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <optgroup label="➕ TÙY CHỌN BỔ SUNG">
                      <option value="__ADD_CUSTOM__">➕ Nhập tên máy in khác thủ công...</option>
                    </optgroup>
                  </select>
                </div>

                {/* Inline Custom Printer Input */}
                {isAddingCustomPrinter && (
                  <div className="p-2.5 bg-neutral-950 border border-emerald-500/50 rounded-lg flex flex-col gap-2 animate-fade-in">
                    <span className="text-[11px] font-semibold text-emerald-300">
                      Nhập tên máy in cài trong Windows (Control Panel {'>'} Devices & Printers):
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newPrinterNameInput}
                        onChange={(e) => setNewPrinterNameInput(e.target.value)}
                        placeholder="Ví dụ: Canon LBP6030w, Xprinter XP-350B"
                        className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomPrinter()}
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomPrinter}
                        disabled={!newPrinterNameInput.trim()}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Lưu</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomPrinter(false)}
                        className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                {/* Microsoft Office Style Printer Status Card */}
                <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-semibold text-emerald-400 text-[11px]">Sẵn sàng (Ready)</span>
                    </div>
                    {isElectron ? (
                      selectedPrinter ? (
                        <span className="text-[10px] text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700 font-bold flex items-center gap-1">
                          ⚡ In Ngầm (Silent Print - Không Popup)
                        </span>
                      ) : (
                        <span className="text-[10px] text-blue-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-700 font-bold flex items-center gap-1">
                          ⚙️ Hộp thoại in Windows
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800 font-medium">
                        Chế độ Web Browser
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] font-bold text-white truncate flex items-center gap-1.5">
                    <span className="text-neutral-400 font-normal">Đích in:</span>
                    <span className="text-emerald-300">
                      {selectedPrinter ? selectedPrinter : '⚙️ Máy in mặc định của hệ thống Windows'}
                    </span>
                  </div>

                  <div className="text-[10px] text-neutral-400 leading-tight">
                    • Khổ giấy: <strong className="text-neutral-300">3.0" x 2.0" (76.2 × 50.8 mm)</strong> • Lề: <strong className="text-neutral-300">0mm</strong>
                  </div>
                  <div className="text-[10px] text-neutral-400 leading-tight">
                    • Cơ chế: {selectedPrinter ? (
                      <strong className="text-emerald-300">In thẳng ngầm vào máy in (Bỏ qua popup Windows)</strong>
                    ) : (
                      <strong className="text-blue-300">Mở hộp thoại Windows để lựa chọn máy in</strong>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Copies & Quantity Multiplier */}
              <div className="grid grid-cols-2 gap-3">
                {/* Number of Copies */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Số bản sao</span>
                  </label>
                  <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setCopies((c) => Math.max(1, c - 1))}
                      className="px-2.5 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={copies}
                      onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-transparent text-center text-xs font-bold text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCopies((c) => Math.min(99, c + 1))}
                      className="px-2.5 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Print by Quantity Toggle */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-neutral-400" />
                    <span>In theo SL</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, respectQuantity: !prev.respectQuantity }))}
                    className={`w-full py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      config.respectQuantity
                        ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                        : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {config.respectQuantity ? '✓ Nhân bản SL' : '1 tem / mã'}
                  </button>
                </div>
              </div>

              {/* Section 3: Page Range Mode */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Phạm vi trang in</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPageRangeMode('all')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                      pageRangeMode === 'all'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div>Tất cả tem</div>
                    <div className="text-[10px] font-normal text-neutral-400 mt-0.5">
                      {processedItems.length} tem ({totalPages} tờ)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPageRangeMode('current')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                      pageRangeMode === 'current'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div>Chỉ trang đang xem</div>
                    <div className="text-[10px] font-normal text-neutral-400 mt-0.5">
                      Trang {currentPage} / {totalPages}
                    </div>
                  </button>
                </div>
              </div>

              {/* Important Windows App Solution Note */}
              <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl text-[11px] text-neutral-300 leading-relaxed space-y-1.5">
                <p className="font-bold text-emerald-400 flex items-center gap-1">
                  <span>💡 Quy tắc in thông minh:</span>
                </p>
                {isElectron ? (
                  selectedPrinter ? (
                    <p className="text-emerald-300 font-semibold">
                      ⚡ <strong>Đã chọn máy in chỉ định:</strong> Lệnh in sẽ truyền thẳng ngầm (Silent Print) tới máy in <span className="text-white underline font-bold">{selectedPrinter}</span>, <strong>hoàn toàn KHÔNG hiển thị bất kỳ hộp thoại (popup) nào từ Windows</strong>!
                    </p>
                  ) : (
                    <p className="text-blue-300 font-semibold">
                      ⚙️ <strong>Đang chọn "Máy in mặc định của hệ thống Windows":</strong> Khi bấm in, hệ thống sẽ <strong>hiển thị bảng in từ Windows</strong> để bạn chọn máy in và thiết lập.
                    </p>
                  )
                ) : (
                  <p className="text-amber-300 font-semibold">
                    ⚠️ <strong>Bạn đang mở trên Trình duyệt Web (Chrome/Edge):</strong> Để in ngầm trực tiếp (Silent Print - 0 Popup Windows), vui lòng mở qua <strong>ứng dụng Desktop Windows (.exe)</strong> của OPPO Label Studio hoặc khởi chạy Chrome với tham số <code className="bg-neutral-950 px-1 py-0.5 rounded text-amber-200">--kiosk-printing</code>.
                  </p>
                )}
                <p className="text-neutral-400 text-[10.5px]">
                  Khung bên trái là <strong>bản xem trước thực tế 100%</strong> của tem theo chuẩn khổ 3x2 inch (76.2 × 50.8 mm).
                </p>
              </div>

              {/* Primary Action Buttons */}
              <div className="flex flex-col gap-2.5 mt-auto pt-4 border-t border-neutral-800">
                {/* 1. Direct Print Button */}
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  disabled={isPrinting || processedItems.length === 0}
                  className={`w-full flex flex-col items-center justify-center gap-0.5 py-3 px-4 rounded-xl text-white font-bold text-sm shadow-lg disabled:opacity-50 cursor-pointer transition-all hover:scale-[1.01] ${
                    selectedPrinter
                      ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-emerald-900/30'
                      : 'bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border border-neutral-700 shadow-neutral-900/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    <span>
                      {isPrinting
                        ? 'Đang gửi lệnh in...'
                        : isElectron
                        ? selectedPrinter
                          ? `⚡ IN TRỰC TIẾP NGẦM (${pageRangeMode === 'current' ? displayItems.length : processedItems.length} tem)`
                          : `⚙️ MỞ BẢNG IN TỪ WINDOWS (${pageRangeMode === 'current' ? displayItems.length : processedItems.length} tem)`
                        : `🖨️ IN QUA HỘP THOẠI TRÌNH DUYỆT (${pageRangeMode === 'current' ? displayItems.length : processedItems.length} tem)`}
                    </span>
                  </div>
                  <span className={`text-[10px] font-normal truncate max-w-full ${selectedPrinter ? 'text-emerald-200' : 'text-neutral-400'}`}>
                    {isElectron
                      ? selectedPrinter
                        ? `⚡ Truyền thẳng vào driver "${selectedPrinter}" — Không bật hộp thoại Windows`
                        : '⚙️ Lựa chọn máy in mặc định: Mở bảng in từ Windows'
                      : 'Xác nhận in trên bảng in của Windows (Dùng bản Desktop .exe để in ngầm)'}
                  </span>
                </button>

                {/* 2. System Print Dialog */}
                <button
                  type="button"
                  onClick={handleSystemPrintDialog}
                  disabled={isPrinting || processedItems.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 cursor-pointer transition-colors"
                  title="Mở hộp thoại in Windows để chỉnh khay giấy hoặc độ phân giải DPI"
                >
                  <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Hộp thoại máy in hệ thống</span>
                </button>

                {/* 3. Open in Browser & Download HTML */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleOpenInBrowser}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800 text-[11px] font-semibold cursor-pointer transition-colors"
                    title="Mở trong trình duyệt Chrome / Edge (Nơi có tính năng xem trước mặc định)"
                  >
                    <ExternalLink className="w-3 h-3 text-blue-400" />
                    <span>Mở tab Chrome</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadHtml}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-[11px] font-semibold cursor-pointer transition-colors"
                    title="Tải file HTML chuẩn để lưu trữ hoặc in offline"
                  >
                    <FileCode className="w-3 h-3 text-neutral-400" />
                    <span>Tải file .html</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
