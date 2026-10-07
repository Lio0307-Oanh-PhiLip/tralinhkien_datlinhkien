import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, GripVertical, RotateCcw, X, MessageSquare } from 'lucide-react';
import { AiChatbot } from './AiChatbot';
import { LabelItem } from '../types/label';
import { ShortageBookingItem } from '../types/shortage';
import { TechnicianItem } from '../types/technician';
import { DeviceIotBookingItem } from '../types/deviceIot';
import { AiNavigationTarget } from './AiChatbot';
import { CuteAiRobot } from './CuteAiRobot';

interface DraggableAiWidgetProps {
  catalogLabels: LabelItem[];
  shortageBookings: ShortageBookingItem[];
  deviceIotBookings?: DeviceIotBookingItem[];
  items: LabelItem[];
  techniciansList: TechnicianItem[];
  currentUser: { name?: string; role?: string } | null;
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  onNavigateTarget?: (target: AiNavigationTarget) => void;
}

const STORAGE_KEY = 'hcm4_floating_ai_widget_pos';

export const DraggableAiWidget: React.FC<DraggableAiWidgetProps> = ({
  catalogLabels,
  shortageBookings,
  deviceIotBookings = [],
  items,
  techniciansList,
  currentUser,
  isOpen,
  onToggleOpen,
  onNavigateTarget,
}) => {
  // Positional coordinates { x, y }
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    // Default: bottom-right
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return { x: Math.max(16, w - 240), y: Math.max(16, h - 80) };
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({
    clientX: 0,
    clientY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  });

  const widgetRef = useRef<HTMLDivElement>(null);

  // Clamp helper
  const clampPosition = useCallback((x: number, y: number, width = 200, height = 50) => {
    const minX = 12;
    const minY = 12;
    const maxX = Math.max(minX, (typeof window !== 'undefined' ? window.innerWidth : 1200) - width - 12);
    const maxY = Math.max(minY, (typeof window !== 'undefined' ? window.innerHeight : 800) - height - 12);
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }, []);

  // Ensure position stays within viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Drag handlers
  const handleStartDrag = (clientX: number, clientY: number) => {
    dragStartRef.current = {
      clientX,
      clientY,
      initialX: pos.x,
      initialY: pos.y,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Left click only
    if (e.button !== 0) return;
    handleStartDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleStartDrag(touch.clientX, touch.clientY);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;

      if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 5) {
        dragStartRef.current.hasMoved = true;
      }

      if (dragStartRef.current.hasMoved) {
        const nextX = dragStartRef.current.initialX + dx;
        const nextY = dragStartRef.current.initialY + dy;
        const clamped = clampPosition(nextX, nextY);
        setPos(clamped);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartRef.current.clientX;
        const dy = touch.clientY - dragStartRef.current.clientY;

        if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 5) {
          dragStartRef.current.hasMoved = true;
        }

        if (dragStartRef.current.hasMoved) {
          const nextX = dragStartRef.current.initialX + dx;
          const nextY = dragStartRef.current.initialY + dy;
          const clamped = clampPosition(nextX, nextY);
          setPos(clamped);
        }
      }
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      if (dragStartRef.current.hasMoved) {
        // Save to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch {}
      } else {
        // Was a simple click, toggle open
        onToggleOpen(!isOpen);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, pos, clampPosition, onToggleOpen, isOpen]);

  // Reset position back to default bottom-right
  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const defaultPos = { x: Math.max(16, w - 240), y: Math.max(16, h - 80) };
    setPos(defaultPos);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Determine chat window positioning relative to pos
  const isUpperHalf = pos.y < window.innerHeight / 2;
  const isLeftHalf = pos.x < window.innerWidth / 2;

  return (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 9999,
        touchAction: 'none',
      }}
      className="no-print select-none"
    >
      {/* Floating Chat Window when open */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...(isUpperHalf ? { top: '56px' } : { bottom: '56px' }),
            ...(isLeftHalf ? { left: '0px' } : { right: '0px' }),
            width: 'min(440px, calc(100vw - 32px))',
            maxHeight: 'min(620px, calc(100vh - 120px))',
          }}
          className="shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 bg-white border border-stone-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header toolbar with reset position & close */}
          <div className="bg-stone-900 text-white px-3 py-1.5 flex items-center justify-between text-xs border-b border-stone-800">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Trợ lý AI Gemini</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetPosition}
                title="Đặt lại vị trí góc dưới bên phải"
                className="p-1 hover:bg-stone-800 text-stone-300 hover:text-white rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onToggleOpen(false)}
                title="Đóng cửa sổ chat"
                className="p-1 hover:bg-stone-800 text-stone-300 hover:text-white rounded transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <AiChatbot
            isFloating={true}
            onCloseFloating={() => onToggleOpen(false)}
            catalogLabels={items.length > 0 ? items : catalogLabels}
            shortageBookings={shortageBookings}
            deviceIotBookings={deviceIotBookings}
            techniciansList={techniciansList}
            items={items}
            onNavigateTarget={onNavigateTarget}
            workspaceContext={{
              labelsCount: items.length,
              catalogCount: catalogLabels.length,
              shortageCount: shortageBookings.length,
              pendingBookingsCount: shortageBookings.filter((b) => b.status === 'da_tao_phieu').length,
              techniciansCount: techniciansList.length,
              currentUser:
                currentUser && currentUser.name && currentUser.role
                  ? { name: currentUser.name, role: currentUser.role }
                  : undefined,
            }}
          />
        </div>
      )}

      {/* Draggable AI Pill / Button */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`group flex items-center gap-2 pl-2 pr-3.5 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-full shadow-xl border border-emerald-400/50 backdrop-blur-md transition-all select-none ${
          isDragging
            ? 'cursor-grabbing scale-105 shadow-2xl ring-4 ring-emerald-400/50 opacity-95'
            : 'cursor-grab hover:shadow-2xl hover:scale-105 active:scale-95'
        }`}
        title="Giữ chuột và kéo để di chuyển vị trí | Nhấp chuột để mở Trợ lý AI"
      >
        {/* Grip indicator */}
        <div className="opacity-60 group-hover:opacity-100 transition-opacity flex items-center text-emerald-200">
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Cute AI Robot Avatar */}
        <div className="w-8 h-8 rounded-full bg-emerald-950/40 p-0.5 border border-emerald-300/40 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
          <CuteAiRobot size={26} isAnimated={!isDragging} />
        </div>

        {/* Label & Status */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wide bg-gradient-to-r from-white via-emerald-100 to-teal-100 bg-clip-text text-transparent">
                Trợ lý AI
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black bg-emerald-300/90 text-emerald-950 tracking-tighter uppercase shadow-xs">
                Kéo thả
              </span>
            </div>
            <span className="text-[9px] text-emerald-100/80 font-medium line-clamp-1">
              Hỏi đáp kho & KTV
            </span>
          </div>
        </div>

        {/* Open / Active indicator */}
        <div className="relative flex items-center justify-center w-2.5 h-2.5 ml-0.5">
          <span className={`absolute inline-flex h-full w-full rounded-full ${isOpen ? 'bg-amber-400 animate-ping opacity-75' : 'bg-emerald-300 animate-pulse'}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isOpen ? 'bg-amber-400' : 'bg-emerald-300'}`} />
        </div>
      </div>
    </div>
  );
};
