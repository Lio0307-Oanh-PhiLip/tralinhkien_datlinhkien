import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  ZapOff,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  Sliders,
  Sparkles,
  ArrowRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LabelItem } from '../types/label';
import { extractBarcodePartCode } from '../utils/barcodeExtractor';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem?: LabelItem | null;
  targetRowIndex?: number;
  totalRows?: number;
  allItems?: LabelItem[];
  customExtractCode?: (raw: string) => string;
  onScanSuccess: (scannedCode: string, targetItemId: string) => void;
  onMoveToNextRow?: (currentItemId: string) => LabelItem | null;
  onMoveToPrevRow?: (currentItemId: string) => LabelItem | null;
}

// Audio beep tone using Web Audio API
function playScanBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch (err) {
    // Audio might be blocked by browser autoplay policy
  }
}

// Clean barcode string from potential multi-field QR text
export function extractCleanBarcode(decodedText: string, masterItems: LabelItem[] = []): string {
  let text = (decodedText || '').trim();
  if (!text) return '';

  // If JSON format
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.code) return String(parsed.code).trim();
    } catch {
      // ignore
    }
  }

  // If separated by " - " e.g. "2180428 - Dây RF..."
  if (text.includes(' - ')) {
    const firstPart = text.split(' - ')[0].trim();
    if (firstPart) return extractBarcodePartCode(firstPart, masterItems);
  }

  // If tab separated or newline separated
  if (text.includes('\t')) {
    const firstPart = text.split('\t')[0].trim();
    if (firstPart) return extractBarcodePartCode(firstPart, masterItems);
  }

  // Extract primary part code
  return extractBarcodePartCode(text, masterItems);
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  targetItem,
  targetRowIndex,
  allItems = [],
  customExtractCode,
  onScanSuccess,
  onMoveToNextRow,
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<{ code: string; timestamp: number } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [autoNextRow, setAutoNextRow] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCodeInput, setManualCodeInput] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const currentTargetItemRef = useRef<LabelItem | null>(targetItem || null);

  useEffect(() => {
    currentTargetItemRef.current = targetItem || null;
  }, [targetItem]);

  // Cleanup scanner on unmount or close
  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScanning && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        isStoppingRef.current = false;
        setIsScanning(false);
      }
    }
  }, [isScanning]);

  const handleClose = useCallback(async () => {
    await stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  // Start Scanner
  const startScanner = useCallback(
    async (cameraId?: string) => {
      setErrorMsg(null);
      setScannedResult(null);

      // Stop previous instance if running
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }

      const elementId = 'barcode-camera-viewfinder';
      const el = document.getElementById(elementId);
      if (!el) return;

      try {
        const html5QrCode = new Html5Qrcode(elementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.ITF,
          ],
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.333,
        };

        const onScan = (decodedText: string) => {
          const cleanCode = customExtractCode
            ? customExtractCode(decodedText)
            : extractCleanBarcode(decodedText);
          if (!cleanCode) return;

          if (soundEnabled) {
            playScanBeep();
          }

          setScannedResult({ code: cleanCode, timestamp: Date.now() });

          const currentTarget = currentTargetItemRef.current;
          onScanSuccess(cleanCode, currentTarget ? currentTarget.id : '');

          if (autoNextRow && onMoveToNextRow && currentTarget) {
            const next = onMoveToNextRow(currentTarget.id);
            if (next) {
              currentTargetItemRef.current = next;
            }
          } else {
            // Auto close on single scan
            setTimeout(() => {
              handleClose();
            }, 650);
          }
        };

        const targetCamera = cameraId || (cameras.length > 0 ? cameras[0].id : { facingMode: 'environment' });

        await html5QrCode.start(targetCamera, config, onScan, () => {
          // Frame error (no barcode found in frame) - ignore
        });

        setIsScanning(true);

        // Check torch capability
        try {
          const capabilities = html5QrCode.getRunningTrackCapabilities();
          if ((capabilities as any)?.torch) {
            setHasTorch(true);
          }
        } catch {
          setHasTorch(false);
        }
      } catch (err: any) {
        console.error('Failed to start camera:', err);
        setErrorMsg(
          err?.message ||
            'Không thể truy cập camera. Vui lòng cấp quyền sử dụng camera trên trình duyệt hoặc thiết bị.'
        );
        setIsScanning(false);
      }
    },
    [cameras, soundEnabled, autoNextRow, onScanSuccess, onMoveToNextRow, handleClose]
  );

  // Initialize camera list on open
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/rear camera on mobile/tablet
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('sau') ||
              d.label.toLowerCase().includes('environment')
          );
          const defaultCamId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(defaultCamId);
          startScanner(defaultCamId);
        } else {
          // Try facingMode environment
          startScanner();
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Error fetching cameras:', err);
        startScanner();
      });

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  // Toggle flashlight / torch
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Cannot toggle torch:', err);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = manualCodeInput.trim();
    if (!rawInput) return;
    const clean = customExtractCode ? customExtractCode(rawInput) : extractCleanBarcode(rawInput);
    if (!clean) return;

    if (soundEnabled) playScanBeep();
    onScanSuccess(clean, targetItem ? targetItem.id : '');
    setScannedResult({ code: clean, timestamp: Date.now() });
    setManualCodeInput('');

    if (autoNextRow && onMoveToNextRow && targetItem) {
      const next = onMoveToNextRow(targetItem.id);
      if (next) {
        currentTargetItemRef.current = next;
      }
    } else {
      setTimeout(() => {
        handleClose();
      }, 400);
    }
  };

  if (!isOpen) return null;

  const displayTarget = targetItem || currentTargetItemRef.current;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#181c26] text-white rounded-2xl shadow-2xl border border-stone-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#12151e] border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-inner">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Quét Mã Vạch Bằng Camera</span>
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] rounded font-mono font-semibold border border-emerald-500/30">
                  1D / QR
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                {displayTarget ? 'Tự động điền Mã SP vào dòng được chọn' : 'Tự động bóc tách mã sản phẩm & tìm kiếm tức thì'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            title="Đóng cửa sổ quét"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Row Info Banner */}
        <div className="px-4 py-2 bg-[#202636] border-b border-stone-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded font-mono font-bold text-[11px] shrink-0 shadow-xs">
              {displayTarget
                ? targetRowIndex !== undefined ? `Dòng #${targetRowIndex + 1}` : 'Dòng đang chọn'
                : 'Tìm kiếm QR'}
            </span>
            {displayTarget ? (
              <div className="truncate flex items-center gap-1.5 text-stone-200">
                <span className="font-bold text-white truncate">{displayTarget.name || 'Linh kiện mới'}</span>
                {displayTarget.model && (
                  <span className="text-stone-400 font-mono text-[11px] truncate">({displayTarget.model})</span>
                )}
                {displayTarget.code && (
                  <span className="text-amber-300 font-mono text-[11px] truncate">
                    [Hiện tại: {displayTarget.code}]
                  </span>
                )}
              </div>
            ) : (
              <span className="text-emerald-300 font-medium truncate">
                Đưa QR hệ thống hoặc Barcode vào camera để tìm kiếm
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-stone-800 text-stone-500 border-stone-700'
              }`}
              title={soundEnabled ? 'Đang bật âm thanh bíp khi quét' : 'Đã tắt âm thanh bíp'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  torchOn
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                    : 'bg-stone-800 text-stone-400 border-stone-700'
                }`}
                title={torchOn ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
              >
                {torchOn ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Viewfinder / Camera Screen */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[260px] overflow-hidden">
          {/* HTML5 QR Scanner Container */}
          <div
            id="barcode-camera-viewfinder"
            className="w-full h-full max-h-[340px] flex items-center justify-center [&_video]:max-h-[340px] [&_video]:object-cover"
          />

          {/* Aiming Laser Reticle Overlay */}
          {isScanning && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-[280px] h-[160px] border-2 border-emerald-400/80 rounded-xl relative shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

                {/* Animated Red / Emerald Laser Scanning Line */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
              </div>
              <span className="mt-3 text-[11px] font-semibold text-emerald-300 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs border border-emerald-500/30">
                Đưa mã vạch hoặc mã QR vào khung ngắm
              </span>
            </div>
          )}

          {/* Scanned Success Overlay Toast */}
          {scannedResult && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center animate-in zoom-in-95 duration-150 z-20">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg mb-2 animate-bounce">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-black text-white">Đã Quét Thành Công!</h4>
              <div className="mt-1 px-3 py-1.5 bg-black/50 border border-emerald-400/40 rounded-lg text-emerald-300 font-mono font-bold text-sm tracking-wider shadow-inner">
                {scannedResult.code}
              </div>
              <p className="text-xs text-emerald-200/80 mt-1">
                Đã điền vào trường Mã SP của dòng đang chọn
              </p>
            </div>
          )}

          {/* Error Message if camera failed */}
          {errorMsg && (
            <div className="absolute inset-0 bg-stone-900/95 flex flex-col items-center justify-center p-6 text-center z-10">
              <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
              <h4 className="text-sm font-bold text-white mb-1">Không thể khởi động Camera</h4>
              <p className="text-xs text-stone-300 max-w-sm mb-4 leading-relaxed">{errorMsg}</p>
              <button
                type="button"
                onClick={() => startScanner(selectedCameraId)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          )}
        </div>

        {/* Camera Selector & Controls */}
        <div className="p-3.5 bg-[#141722] border-t border-stone-800 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            {/* Camera Switcher Dropdown */}
            {cameras.length > 1 && (
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <Camera className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedCameraId(newId);
                    startScanner(newId);
                  }}
                  className="bg-[#202636] border border-stone-700 text-stone-200 text-xs rounded-lg px-2 py-1 flex-1 focus:outline-none focus:border-emerald-500"
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Scan Mode Toggle */}
            <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoNextRow}
                onChange={(e) => setAutoNextRow(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-emerald-500 bg-stone-800 border-stone-700"
              />
              <span>Quét liên tục sang dòng kế tiếp</span>
            </label>
          </div>

          {/* Manual input fallback */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5 pt-2 border-t border-stone-800/80">
            <input
              type="text"
              value={manualCodeInput}
              onChange={(e) => setManualCodeInput(e.target.value)}
              placeholder="Hoặc gõ mã SP trực tiếp (vd: 2180428)..."
              className="flex-1 bg-[#202636] border border-stone-700 text-white placeholder-stone-500 text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!manualCodeInput.trim()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-xs"
            >
              <span>Điền mã</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
