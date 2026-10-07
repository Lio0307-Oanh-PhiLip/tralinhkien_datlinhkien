import React from 'react';
import { Smartphone, Download, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenMobileModal: () => void;
  className?: string;
  variant?: 'header' | 'sidebar' | 'mobile_banner' | 'pill';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenMobileModal,
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isAndroid, triggerInstall } = usePWAInstall();

  // If already installed and variant is header, show small icon or subtle button
  if (isInstalled && variant === 'mobile_banner') {
    return null;
  }

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={onOpenMobileModal}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer bg-gradient-to-r from-emerald-950/40 to-stone-900/50 hover:from-emerald-900/60 hover:to-stone-800 text-emerald-300 border border-emerald-500/30 shadow-xs group ${className}`}
        title="Cài đặt App Android & Đồng bộ điện thoại"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <span className="block leading-tight text-white">App Android</span>
            <span className="block text-[10px] text-emerald-400 font-normal">Cài đặt & Đồng bộ</span>
          </div>
        </div>
        <Download className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
      </button>
    );
  }

  if (variant === 'mobile_banner') {
    return (
      <div className={`bg-gradient-to-r from-emerald-900 via-stone-900 to-emerald-950 text-white px-3.5 py-2.5 rounded-2xl border border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black truncate text-white">Cài App trên Điện Thoại</p>
            <p className="text-[11px] text-stone-300 truncate">Dùng mượt mà, đồng bộ Cloud tức thì</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenMobileModal}
          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs rounded-xl shrink-0 transition-transform active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Cài Ngay</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenMobileModal}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300/80 shadow-2xs ${className}`}
      title="Cài đặt App Android & Hướng dẫn đồng bộ điện thoại"
    >
      <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
      <span className="hidden sm:inline">App Android</span>
      <span className="px-1 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-black">APK</span>
    </button>
  );
};
