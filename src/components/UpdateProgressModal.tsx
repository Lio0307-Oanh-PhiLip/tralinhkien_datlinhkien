import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle, RefreshCw, Server, ArrowRight, ShieldCheck, Zap, Download, Monitor } from 'lucide-react';

interface UpdateProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetVersion: string;
  targetBuildId: string;
  releaseNotes?: string;
  windowsDownloadUrl?: string;
  onUpdateComplete: () => void;
}

export const UpdateProgressModal: React.FC<UpdateProgressModalProps> = ({
  isOpen,
  onClose,
  targetVersion,
  targetBuildId,
  releaseNotes,
  windowsDownloadUrl,
  onUpdateComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [statusText, setStatusText] = useState('Đang khởi tạo tiến trình cập nhật...');
  const [isCompleted, setIsCompleted] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const steps = [
    { label: 'Kết nối máy chủ Cloud', detail: 'Xác minh chữ ký bản cập nhật' },
    { label: 'Tải gói giao diện & mã nguồn', detail: 'Nạp mã nguồn và tối ưu hiệu năng' },
    { label: 'Đồng bộ cơ sở dữ liệu Cloud SQL', detail: 'Cập nhật cấu hình tem nhãn & linh kiện' },
    { label: 'Áp dụng phiên bản hoàn tất', detail: 'Sẵn sàng sử dụng' },
  ];

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setCurrentStep(0);
      setIsCompleted(false);
      setCountdown(3);
      return;
    }

    let isMounted = true;

    // Simulate animated step-by-step update process
    const runUpdate = async () => {
      // Step 1: 0% -> 25%
      setCurrentStep(0);
      setStatusText('Đang kết nối máy chủ Cloud và xác minh phiên bản...');
      for (let p = 0; p <= 25; p += 5) {
        if (!isMounted) return;
        setProgress(p);
        await new Promise((r) => setTimeout(r, 60));
      }

      // Step 2: 25% -> 60%
      setCurrentStep(1);
      setStatusText('Đang nạp mã nguồn, bố cục in tem 3x2 và logic mới nhất...');
      for (let p = 26; p <= 60; p += 5) {
        if (!isMounted) return;
        setProgress(p);
        await new Promise((r) => setTimeout(r, 70));
      }

      // Step 3: 60% -> 90%
      setCurrentStep(2);
      setStatusText('Đang đồng bộ cơ sở dữ liệu Cloud SQL PostgreSQL & bộ nhớ đệm...');
      for (let p = 61; p <= 90; p += 4) {
        if (!isMounted) return;
        setProgress(p);
        await new Promise((r) => setTimeout(r, 70));
      }

      // Step 4: 90% -> 100%
      setCurrentStep(3);
      setStatusText('Hoàn tất gói cập nhật! Đang chuẩn bị khởi động lại...');
      for (let p = 91; p <= 100; p += 3) {
        if (!isMounted) return;
        setProgress(Math.min(100, p));
        await new Promise((r) => setTimeout(r, 50));
      }

      if (!isMounted) return;
      setIsCompleted(true);
      setStatusText('Cập nhật hoàn tất 100% thành công!');

      // Save acknowledged build ID into localStorage
      try {
        localStorage.setItem('label_studio_acknowledged_build_id', targetBuildId);
        localStorage.setItem('label_studio_acknowledged_version', targetVersion);
        sessionStorage.setItem('label_studio_update_success_banner', targetVersion);
      } catch (e) {
        // ignore
      }
    };

    runUpdate();

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetBuildId, targetVersion]);

  // Auto-reload countdown when completed
  useEffect(() => {
    if (!isCompleted) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onUpdateComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCompleted, onUpdateComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-neutral-900 text-white p-5 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center border border-neutral-700">
              {isCompleted ? (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              ) : (
                <Zap className="w-6 h-6 text-amber-300 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight flex items-center gap-2">
                <span>{isCompleted ? 'Cập Nhật Thành Công' : 'Đang Cập Nhật Ứng Dụng'}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-semibold border border-neutral-700">
                  v{targetVersion}
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isCompleted
                  ? 'Toàn bộ mã nguồn & dữ liệu đã được cập nhật bản mới nhất'
                  : 'Tiến trình tự động cập nhật trực tuyến (Live OTA Update)'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-neutral-700">{statusText}</span>
              <span className="text-neutral-900 font-mono font-bold text-sm">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-600'
                    : 'bg-neutral-900'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Release Notes */}
          {releaseNotes && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1">
              <div className="font-bold text-indigo-950 text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Nội dung cập nhật mới (v{targetVersion}):</span>
              </div>
              <p className="text-neutral-700 text-xs leading-relaxed whitespace-pre-line">{releaseNotes}</p>
            </div>
          )}

          {/* Windows Desktop Client Update (.exe) */}
          {windowsDownloadUrl ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <Monitor className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-950 text-xs">
                    Gói Cài Đặt Cho Windows (.exe / Setup)
                  </div>
                  <p className="text-neutral-600 text-[11px] leading-relaxed">
                    Bạn đang chạy ứng dụng Windows? Để cập nhật các tính năng và dịch vụ in ấn ở mức hệ thống (file chạy .exe), vui lòng tải bản cài đặt mới bên dưới:
                  </p>
                </div>
              </div>
              <a
                href={windowsDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-extrabold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-400 select-none"
              >
                <Download className="w-3.5 h-3.5" />
                <span>TẢI FILE CÀI ĐẶT .EXE CHO WINDOWS (v{targetVersion})</span>
              </a>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-start gap-2">
                <Monitor className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-700 text-[11px]">Ứng Dụng Chạy Trên Windows</div>
                  <p className="text-slate-500 text-[10px] leading-relaxed">
                    Trình duyệt web và ứng dụng sẽ tự động OTA cập nhật mã nguồn. Admin có thể bổ sung Link tải File .exe trong mục cấu hình "Quản Trị Cloud" để người dùng tải gói cài đặt Windows trực tiếp.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stepper */}
          <div className="grid grid-cols-1 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            {steps.map((step, idx) => {
              const isDone = currentStep > idx || isCompleted;
              const isCurrent = currentStep === idx && !isCompleted;
              return (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-indigo-600 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-semibold ${
                        isDone
                          ? 'text-emerald-900'
                          : isCurrent
                          ? 'text-indigo-900 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-[11px] text-slate-500">{step.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Success Banner or Info */}
          {isCompleted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3 text-emerald-800 text-xs">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <strong className="font-bold text-emerald-900 block">Đã cài đặt bản cập nhật mới nhất!</strong>
                Ứng dụng sẽ tự động tải lại trong <span className="font-bold text-indigo-700">{countdown}s</span>...
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2.5 text-blue-800 text-xs">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <span>Vui lòng không tắt ứng dụng trong lúc quá trình cập nhật đang diễn ra.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">Build ID: {targetBuildId}</span>

          <div className="flex gap-2">
            {isCompleted ? (
              <button
                type="button"
                onClick={onUpdateComplete}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Khởi động lại ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 cursor-pointer"
              >
                Ẩn xuống chạy nền
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
