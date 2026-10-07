import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  Download,
  Database,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Package,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { ShortageBookingItem } from '../types/shortage';
import { LabelItem } from '../types/label';
import { DeviceIotBookingItem } from '../types/deviceIot';
import {
  parseBackupJson,
  executeFastRestore,
  exportFullSystemBackup,
  exportShortagesBackup,
  exportDeviceIotBackup,
  exportCatalogBackup,
  ParsedBackup,
  RestoreResult,
} from '../services/backupRestoreService';

interface FastBackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortages?: ShortageBookingItem[];
  deviceIot?: DeviceIotBookingItem[];
  catalogLabels?: LabelItem[];
  currentUser?: { name?: string; role?: string } | null;
  onRestored?: (result: RestoreResult) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  defaultTab?: 'restore' | 'backup';
}

export const FastBackupRestoreModal: React.FC<FastBackupRestoreModalProps> = ({
  isOpen,
  onClose,
  shortages = [],
  deviceIot = [],
  catalogLabels = [],
  currentUser,
  onRestored,
  onShowToast,
  defaultTab = 'restore',
}) => {
  const [activeTab, setActiveTab] = useState<'restore' | 'backup'>(defaultTab);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedBackup | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [restoreSuccessResult, setRestoreSuccessResult] = useState<RestoreResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setSelectedFile(null);
      setParsedData(null);
      setParseError(null);
      setIsProcessing(false);
      setRestoreSuccessResult(null);
      setProgressPercent(0);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  // Handle file inspection
  const handleInspectFile = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setRestoreSuccessResult(null);

    try {
      const text = await file.text();
      const parsed = parseBackupJson(text);
      setParsedData(parsed);
    } catch (err: any) {
      console.error(err);
      setParseError(err?.message || 'File không hợp lệ hoặc bị lỗi cú pháp JSON');
      setParsedData(null);
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleInspectFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleInspectFile(file);
    }
  };

  // Run fast restore
  const handleRunRestore = async () => {
    if (!parsedData) {
      onShowToast('Vui lòng chọn file sao lưu JSON hợp lệ trước!', 'error');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(10);
    setProgressStep('Đang khởi tạo giải mã dữ liệu...');

    try {
      const result = await executeFastRestore({
        parsed: parsedData,
        mode: restoreMode,
        authorName: currentUser?.name || 'Khôi phục JSON',
        onProgress: (step, percent) => {
          setProgressStep(step);
          setProgressPercent(percent);
        },
      });

      setRestoreSuccessResult(result);
      onShowToast(result.message, 'success');
      onRestored?.(result);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Lỗi khi khôi phục: ${err?.message || 'Vui lòng kiểm tra lại file'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white flex items-center justify-between border-b border-indigo-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Sao Lưu & Khôi Phục Dữ Liệu (JSON)</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                  Siêu Tốc 0.3s
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Chuyển tài khoản, đổi thiết bị làm việc nguyên vẹn 100% thuộc tính
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-neutral-200 bg-neutral-50 px-6 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'restore'
                ? 'border-indigo-600 text-indigo-700 font-black'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-indigo-600" />
            <span>⚡ Khôi Phục Siêu Tốc (Restore)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'border-emerald-600 text-emerald-700 font-black'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>📥 Tải Bản Sao Lưu (Backup / Chuyển TK)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-stone-800 text-sm">
          {/* TAB 1: RESTORE */}
          {activeTab === 'restore' && (
            <div className="space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/70 scale-[0.99]'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/60'
                    : 'border-neutral-300 hover:border-indigo-400 bg-stone-50/70 hover:bg-indigo-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelectChange}
                  className="hidden"
                />

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  selectedFile
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {selectedFile ? <FileJson className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
                </div>

                <div>
                  <p className="font-bold text-stone-800 text-sm">
                    {selectedFile ? selectedFile.name : 'Kéo & thả file sao lưu .JSON vào đây'}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB — Bấm để đổi file khác`
                      : 'Hoặc bấm vào đây để duyệt file từ máy tính'}
                  </p>
                </div>

                <span className="px-3 py-1 bg-white border border-stone-200 text-[11px] font-bold text-stone-700 rounded-lg shadow-2xs">
                  Hỗ trợ: Sao lưu toàn hệ thống, Đặt chờ linh kiện, Đặt chờ máy & IOT
                </span>
              </div>

              {/* Parsing Error */}
              {parseError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Lỗi giải mã file sao lưu:</span>
                    <p className="mt-0.5">{parseError}</p>
                  </div>
                </div>
              )}

              {/* Parsed Inspection Card */}
              {parsedData && (
                <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/40 border border-indigo-200/80 rounded-2xl p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-indigo-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="font-black text-xs text-indigo-950 uppercase tracking-wider">
                        Thông Tin Bản Sao Lưu Được Nhận Diện
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      parsedData.type === 'FULL_SYSTEM'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : parsedData.type === 'SHORTAGES'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : parsedData.type === 'DEVICE_IOT'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-stone-700 text-white shadow-2xs'
                    }`}>
                      {parsedData.type === 'FULL_SYSTEM' && '🌟 Toàn Bộ Hệ Thống (All-in-One)'}
                      {parsedData.type === 'SHORTAGES' && '📦 Đặt Chờ Linh Kiện'}
                      {parsedData.type === 'DEVICE_IOT' && '📱 Đặt Chờ Máy & IOT'}
                      {parsedData.type === 'CATALOG' && '🏷️ Danh Mục Mã Tem'}
                      {parsedData.type === 'UNKNOWN' && 'Dữ liệu JSON'}
                    </span>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
                      <Package className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="text-[10px] font-bold text-stone-500 uppercase">Linh kiện chờ</div>
                        <div className="text-sm font-black text-blue-700">{parsedData.counts.shortages} phiếu</div>
                      </div>
                    </div>

                    <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
                      <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <div className="text-[10px] font-bold text-stone-500 uppercase">Máy & IOT</div>
                        <div className="text-sm font-black text-amber-700">{parsedData.counts.deviceIot} phiếu</div>
                      </div>
                    </div>

                    <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
                      <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-[10px] font-bold text-stone-500 uppercase">Mã tem in</div>
                        <div className="text-sm font-black text-emerald-700">{parsedData.counts.catalog} mã</div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  {(parsedData.exportedAt || parsedData.exportedBy) && (
                    <div className="text-[11px] text-stone-500 flex items-center gap-4 pt-1">
                      {parsedData.exportedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>Xuất lúc: {new Date(parsedData.exportedAt).toLocaleString('vi-VN')}</span>
                        </span>
                      )}
                      {parsedData.exportedBy && (
                        <span>Người xuất: <strong className="text-stone-700">{parsedData.exportedBy}</strong></span>
                      )}
                    </div>
                  )}

                  {/* Restore Mode Selection */}
                  <div className="pt-2 border-t border-indigo-100 space-y-2">
                    <label className="text-xs font-bold text-stone-700 block">
                      Tùy chọn chế độ khôi phục:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className={`border rounded-xl p-3 cursor-pointer flex items-start gap-2.5 transition-all ${
                        restoreMode === 'merge'
                          ? 'border-indigo-600 bg-white shadow-2xs ring-1 ring-indigo-600'
                          : 'border-stone-200 bg-white/60 hover:bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          value="merge"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="mt-0.5 text-indigo-600"
                        />
                        <div>
                          <div className="text-xs font-bold text-stone-900 flex items-center gap-1">
                            <span>Gộp thông minh</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-black">Khuyên dùng</span>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                            Giữ nguyên dữ liệu hiện tại, tự động thêm mới & cập nhật bản mới nhất nếu trùng mã.
                          </div>
                        </div>
                      </label>

                      <label className={`border rounded-xl p-3 cursor-pointer flex items-start gap-2.5 transition-all ${
                        restoreMode === 'replace'
                          ? 'border-rose-600 bg-white shadow-2xs ring-1 ring-rose-600'
                          : 'border-stone-200 bg-white/60 hover:bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          value="replace"
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className="mt-0.5 text-rose-600"
                        />
                        <div>
                          <div className="text-xs font-bold text-rose-900">Ghi đè / Thay thế toàn bộ</div>
                          <div className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                            Xóa dữ liệu cũ của danh mục và chỉ nạp đúng các bản ghi từ file sao lưu này.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Indicator */}
              {isProcessing && (
                <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                      <span>{progressStep}</span>
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-200"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Result Card */}
              {restoreSuccessResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900 text-xs animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-black text-sm text-emerald-950">
                      Khôi Phục Dữ Liệu Hoàn Tất Siêu Tốc!
                    </span>
                    <p className="text-emerald-800">
                      {restoreSuccessResult.message}
                    </p>
                    <div className="flex items-center gap-2 pt-1 font-bold text-emerald-700">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Thời gian đồng bộ: {restoreSuccessResult.durationMs}ms</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Restore Action Button */}
              {parsedData && !isProcessing && (
                <button
                  type="button"
                  onClick={handleRunRestore}
                  className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>⚡ Bắt Đầu Khôi Phục & Đồng Bộ Cloud Siêu Tốc Ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* TAB 2: BACKUP / EXPORT */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Bản sao lưu JSON bảo toàn <strong>100% thuộc tính nguyên vẹn</strong> (bao gồm tất cả linh kiện con, nhật ký gọi, IMEI, lịch sử hẹn khách, ghi chú, người tạo...).
                </span>
              </div>

              {/* Master Full Backup Card */}
              <div className="bg-gradient-to-br from-emerald-500/10 via-indigo-500/5 to-transparent border-2 border-emerald-400/80 rounded-2xl p-5 space-y-3 shadow-xs hover:border-emerald-500 transition-all">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-stone-900 text-sm flex items-center gap-1.5">
                        <span>Sao Lưu Toàn Bộ Hệ Thống (Full All-in-One)</span>
                        <span className="px-2 py-0.2 bg-emerald-600 text-white text-[10px] font-black rounded-full">
                          Khuyên Dùng
                        </span>
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Tích hợp toàn bộ Đặt chờ linh kiện + Đặt chờ máy & IOT + Danh mục mã tem
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs py-1">
                  <div className="bg-white border border-emerald-100 rounded-xl py-2">
                    <span className="text-[10px] text-stone-500 block">Linh kiện</span>
                    <strong className="text-emerald-700 font-bold text-sm">{shortages.length}</strong>
                  </div>
                  <div className="bg-white border border-emerald-100 rounded-xl py-2">
                    <span className="text-[10px] text-stone-500 block">Máy & IOT</span>
                    <strong className="text-emerald-700 font-bold text-sm">{deviceIot.length}</strong>
                  </div>
                  <div className="bg-white border border-emerald-100 rounded-xl py-2">
                    <span className="text-[10px] text-stone-500 block">Mã tem in</span>
                    <strong className="text-emerald-700 font-bold text-sm">{catalogLabels.length}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    exportFullSystemBackup({
                      shortages,
                      deviceIot,
                      catalogLabels,
                      userName: currentUser?.name,
                    });
                    onShowToast('Đã xuất bản sao lưu toàn bộ hệ thống ra file JSON!', 'success');
                  }}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Bản Sao Lưu Toàn Bộ Hệ Thống (.JSON)</span>
                </button>
              </div>

              {/* Sub Part Backups */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-stone-600 uppercase tracking-wider block">
                  Hoặc tải riêng từng phân hệ:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Shortages */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                        <span>Đặt chờ linh kiện</span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-1">
                        Hiện có: <strong className="text-stone-700">{shortages.length}</strong> phiếu
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportShortagesBackup(shortages, currentUser?.name);
                        onShowToast('Đã tải sao lưu linh kiện ra file JSON!', 'success');
                      }}
                      className="w-full py-1.5 px-2.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500" />
                      <span>Tải JSON</span>
                    </button>
                  </div>

                  {/* Device IOT */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                        <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                        <span>Đặt chờ máy & IOT</span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-1">
                        Hiện có: <strong className="text-stone-700">{deviceIot.length}</strong> phiếu
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportDeviceIotBackup(deviceIot, currentUser?.name);
                        onShowToast('Đã tải sao lưu máy & IOT ra file JSON!', 'success');
                      }}
                      className="w-full py-1.5 px-2.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500" />
                      <span>Tải JSON</span>
                    </button>
                  </div>

                  {/* Catalog */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Danh mục tem kho</span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-1">
                        Hiện có: <strong className="text-stone-700">{catalogLabels.length}</strong> mã tem
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportCatalogBackup(catalogLabels, currentUser?.name);
                        onShowToast('Đã tải sao lưu danh mục tem ra file JSON!', 'success');
                      }}
                      className="w-full py-1.5 px-2.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500" />
                      <span>Tải JSON</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-stone-50 border-t border-neutral-200 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span>Hệ thống hỗ trợ đồng bộ song song Cloud SQL & Cloud Firestore</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
