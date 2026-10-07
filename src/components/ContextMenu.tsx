import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Maximize2,
  Minimize2,
  Printer,
  Boxes,
  Smartphone,
  Copy,
  ClipboardCopy,
  Check,
  HelpCircle,
  ShieldCheck,
  Sliders,
  Plus,
  Zap,
  LayoutDashboard,
  AlertTriangle,
  Search,
  PhoneCall,
} from 'lucide-react';

export interface ContextMenuProps {
  currentTab: 'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot';
  activeSubId?: string;
  totalWarningsCount?: number;
  onSelectTab: (tab: 'overview' | 'labels' | 'shortage' | 'device_iot' | 'ai_chatbot', subId?: string) => void;
  onRefreshData?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onOpenGuide?: () => void;
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  currentTab,
  activeSubId,
  totalWarningsCount = 0,
  onSelectTab,
  onRefreshData,
  onToggleFullscreen,
  isFullscreen = false,
  onOpenGuide,
  onOpenSettings,
  onOpenAdmin,
  isAdmin = false,
  onShowToast,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState<string>('');
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Scroll to top handler
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const appContainer = document.getElementById('root') || document.querySelector('main');
    if (appContainer) {
      appContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsOpen(false);
    if (onShowToast) {
      onShowToast('Đã cuộn về đầu trang 🔝', 'info');
    }
  };

  // Scroll to bottom handler
  const handleScrollToBottom = () => {
    window.scrollTo({
      top: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      behavior: 'smooth',
    });
    setIsOpen(false);
    if (onShowToast) {
      onShowToast('Đã cuộn xuống cuối trang ⬇️', 'info');
    }
  };

  // Copy selected text or active input text handler
  const handleCopy = async () => {
    let textToCopy = selectedText;

    if (!textToCopy) {
      const activeEl = targetElement || document.activeElement;
      if (activeEl && (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        if (start !== null && end !== null && start !== end) {
          textToCopy = activeEl.value.substring(start, end);
        } else if (activeEl.value) {
          textToCopy = activeEl.value;
        }
      }
    }

    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        if (onShowToast) {
          onShowToast(`Đã sao chép: "${textToCopy.slice(0, 30)}${textToCopy.length > 30 ? '...' : ''}" 📋`, 'success');
        }
      } catch (e) {
        try {
          document.execCommand('copy');
          if (onShowToast) {
            onShowToast('Đã sao chép vào bộ nhớ tạm 📋', 'success');
          }
        } catch (err) {
          if (onShowToast) onShowToast('Không thể tự động sao chép', 'error');
        }
      }
    } else {
      if (onShowToast) {
        onShowToast('Vui lòng chọn hoặc bôi đen văn bản cần sao chép', 'info');
      }
    }
    setIsOpen(false);
  };

  // Paste handler
  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText) {
        if (onShowToast) onShowToast('Bộ nhớ tạm (Clipboard) đang trống', 'info');
        setIsOpen(false);
        return;
      }

      let inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;
      const activeEl = targetElement || document.activeElement;

      if (activeEl && (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)) {
        inputEl = activeEl;
      } else if (targetElement) {
        const closestInput = targetElement.closest('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
        if (closestInput) inputEl = closestInput;
      }

      if (inputEl && !inputEl.disabled && !inputEl.readOnly) {
        inputEl.focus();
        const start = inputEl.selectionStart ?? inputEl.value.length;
        const end = inputEl.selectionEnd ?? inputEl.value.length;
        const val = inputEl.value;
        const newVal = val.substring(0, start) + clipboardText + val.substring(end);

        const proto = inputEl instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (valueSetter) {
          valueSetter.call(inputEl, newVal);
        } else {
          inputEl.value = newVal;
        }

        const newCursorPos = start + clipboardText.length;
        inputEl.setSelectionRange(newCursorPos, newCursorPos);

        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

        if (onShowToast) {
          onShowToast(`Đã dán: "${clipboardText.slice(0, 25)}${clipboardText.length > 25 ? '...' : ''}" 📥`, 'success');
        }
      } else {
        if (onShowToast) {
          onShowToast(`Nội dung bộ nhớ tạm: "${clipboardText.slice(0, 35)}${clipboardText.length > 35 ? '...' : ''}" (Hãy nhấp vào ô nhập liệu để dán)`, 'info');
        }
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast('Cần cấp quyền truy cập Clipboard trình duyệt để Dán', 'error');
      }
    }
    setIsOpen(false);
  };

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();

    const target = e.target as HTMLElement;
    setTargetElement(target);

    const selection = window.getSelection()?.toString().trim() || '';
    setSelectedText(selection);

    const menuWidth = 260;
    const menuHeight = 450;

    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) {
      posX = Math.max(10, window.innerWidth - menuWidth - 12);
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = Math.max(10, window.innerHeight - menuHeight - 12);
    }

    setPosition({ x: posX, y: posY });
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      handleContextMenu(e);
    };

    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const onScroll = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('click', onClickOutside);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('click', onClickOutside);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [handleContextMenu, isOpen]);

  if (!isOpen) return null;

  const isInputTarget = !!(
    targetElement &&
    (targetElement instanceof HTMLInputElement ||
      targetElement instanceof HTMLTextAreaElement ||
      targetElement.closest('input, textarea'))
  );

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
      className="fixed z-[9999] w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-neutral-200/90 text-neutral-800 text-xs py-1.5 animate-in fade-in zoom-in-95 duration-100 divide-y divide-neutral-100 select-none overflow-hidden ring-1 ring-black/5"
    >
      {/* 1. SCROLL ACTIONS */}
      <div className="p-1 space-y-0.5">
        <button
          type="button"
          onClick={handleScrollToTop}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1 bg-indigo-600 text-white rounded-lg group-hover:scale-110 transition-transform">
              <ArrowUp className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-xs">Quay về đầu trang</span>
          </div>
          <span className="text-[10px] font-mono font-normal text-indigo-500 bg-white/80 px-1.5 py-0.5 rounded border border-indigo-200">
            Home
          </span>
        </button>

        <button
          type="button"
          onClick={handleScrollToBottom}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <ArrowDown className="w-4 h-4 text-neutral-500" />
            <span>Cuộn xuống cuối trang</span>
          </div>
          <span className="text-[10px] font-mono font-normal text-neutral-400">
            End
          </span>
        </button>
      </div>

      {/* 2. CLIPBOARD ACTIONS (Copy & Paste) */}
      <div className="p-1 space-y-0.5">
        <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          Sao Chép & Dán (Clipboard)
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-semibold transition-colors cursor-pointer ${
            selectedText
              ? 'bg-emerald-50 text-emerald-900 font-bold hover:bg-emerald-100'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate mr-2">
            <Copy className={`w-4 h-4 shrink-0 ${selectedText ? 'text-emerald-600' : 'text-neutral-500'}`} />
            <span className="truncate">
              {selectedText ? `Sao chép: "${selectedText.slice(0, 14)}..."` : 'Sao chép (Copy)'}
            </span>
          </div>
          <span className="text-[10px] font-mono font-normal text-neutral-400 shrink-0">Ctrl+C</span>
        </button>

        <button
          type="button"
          onClick={handlePaste}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-semibold transition-colors cursor-pointer ${
            isInputTarget
              ? 'bg-indigo-50 text-indigo-900 font-bold hover:bg-indigo-100'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ClipboardCopy className={`w-4 h-4 ${isInputTarget ? 'text-indigo-600' : 'text-neutral-500'}`} />
            <span>Dán văn bản (Paste)</span>
          </div>
          <span className="text-[10px] font-mono font-normal text-neutral-400">Ctrl+V</span>
        </button>
      </div>

      {/* 3. QUICK TAB NAVIGATION */}
      <div className="p-1 space-y-0.5">
        <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          Chuyển tab nhanh
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectTab('overview');
            handleClose();
          }}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-medium transition-colors cursor-pointer ${
            currentTab === 'overview'
              ? 'bg-emerald-50 text-emerald-950 font-bold'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className={`w-4 h-4 ${currentTab === 'overview' ? 'text-emerald-600' : 'text-neutral-500'}`} />
            <span>Tổng Quan Báo Cáo</span>
          </div>
          {currentTab === 'overview' && (
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onSelectTab('labels');
            handleClose();
          }}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-medium transition-colors cursor-pointer ${
            currentTab === 'labels'
              ? 'bg-indigo-50 text-indigo-950 font-bold'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Printer className={`w-4 h-4 ${currentTab === 'labels' ? 'text-indigo-600' : 'text-neutral-500'}`} />
            <span>1. In Tem Linh Kiện (3x2)</span>
          </div>
          {currentTab === 'labels' && (
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
          )}
        </button>

        {/* 2. ĐẶT CHỜ LINH KIỆN - Direct Click & Quick Sub-views */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onSelectTab('shortage', 'shortage-main');
              onShowToast?.('Đã chuyển sang: 2. Đặt Chờ Linh Kiện (Danh sách chính)', 'info');
              handleClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-medium transition-colors cursor-pointer ${
              currentTab === 'shortage' && activeSubId !== 'shortage-warnings'
                ? 'bg-indigo-50 text-indigo-950 font-bold'
                : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Boxes className={`w-4 h-4 ${currentTab === 'shortage' ? 'text-indigo-600' : 'text-neutral-500'}`} />
              <span>2. Đặt Chờ Linh Kiện</span>
            </div>
            {currentTab === 'shortage' && activeSubId !== 'shortage-warnings' && (
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
            )}
          </button>

          {/* Quick Sub-entry to Cảnh Báo & Nhắc Nhở */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('shortage', 'shortage-warnings');
              onShowToast?.('Đã mở: Cảnh báo & Nhắc nhở tiến độ', 'info');
              handleClose();
            }}
            className={`w-full flex items-center justify-between pl-8 pr-3 py-1 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
              currentTab === 'shortage' && activeSubId === 'shortage-warnings'
                ? 'bg-amber-50 text-amber-900 font-bold'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Cảnh Báo & Nhắc Nhở</span>
            </div>
            {totalWarningsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-xs animate-pulse">
                {totalWarningsCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectTab('device_iot', 'device-main');
            onShowToast?.('Đã chuyển sang: 3. Đặt Chờ Máy & IOT', 'info');
            handleClose();
          }}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-medium transition-colors cursor-pointer ${
            currentTab === 'device_iot'
              ? 'bg-indigo-50 text-indigo-950 font-bold'
              : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Smartphone className={`w-4 h-4 ${currentTab === 'device_iot' ? 'text-indigo-600' : 'text-neutral-500'}`} />
            <span>3. Đặt Chờ Máy & IOT</span>
          </div>
          {currentTab === 'device_iot' && (
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
          )}
        </button>
      </div>

      {/* 4. QUICK ACTIONS & UTILITIES */}
      <div className="p-1 space-y-0.5">
        {onRefreshData && (
          <button
            type="button"
            onClick={() => {
              onRefreshData();
              handleClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-sky-600" />
              <span>Làm mới dữ liệu Cloud</span>
            </div>
            <span className="text-[10px] font-mono font-normal text-neutral-400">F5</span>
          </button>
        )}

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={() => {
              onToggleFullscreen();
              handleClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-amber-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-amber-600" />
              )}
              <span>{isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}</span>
            </div>
            <span className="text-[10px] font-mono font-normal text-neutral-400">F11</span>
          </button>
        )}
      </div>

      {/* 5. MODALS & GUIDES */}
      <div className="p-1 space-y-0.5">
        {onOpenGuide && (
          <button
            type="button"
            onClick={() => {
              onOpenGuide();
              handleClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-neutral-500" />
            <span>Hướng dẫn in & cân chỉnh</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              handleClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-neutral-500" />
            <span>Cài đặt mẫu tem & máy in</span>
          </button>
        )}

        {isAdmin && onOpenAdmin && (
          <button
            type="button"
            onClick={() => {
              onOpenAdmin();
              handleClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Quản trị Cloud & Phân quyền</span>
          </button>
        )}
      </div>
    </div>
  );
};

