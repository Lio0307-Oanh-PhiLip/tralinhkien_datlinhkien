import React, { useRef } from 'react';
import { Calendar, Clock, Zap, X } from 'lucide-react';

interface DateTimePickerProps {
  value: string | undefined;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  showQuickButtons?: boolean;
  quickPresets?: ('now' | 'today' | '+1day' | '+2days' | '+3days' | 'clear')[];
  disabled?: boolean;
  colorScheme?: 'indigo' | 'amber' | 'emerald' | 'purple' | 'slate';
  id?: string;
}

/**
 * Format a Date object to "dd/MM/yyyy HH:mm"
 */
export function formatViDateTime(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

/**
 * Format a Date object to "dd/MM/yyyy"
 */
export function formatViDate(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse any VI date time string (like "29/08/2026 14:30", "29/8/2026 ; 9H13", "2026-08-29T14:30")
 * into HTML datetime-local format "YYYY-MM-DDTHH:mm"
 */
export function parseViToDatetimeLocal(str: string | undefined): string {
  if (!str || !str.trim()) return '';

  const s = str.trim();

  // Already HTML datetime-local format: "2026-08-29T14:30"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    return s.slice(0, 16);
  }

  // Check format "dd/mm/yyyy ; HHhMM" or "dd/mm/yyyy ; H:mm"
  if (s.includes(';')) {
    const [dateP, timeP] = s.split(';').map((p) => p.trim());
    const dParts = dateP.split('/');
    if (dParts.length === 3) {
      const day = String(parseInt(dParts[0], 10) || 1).padStart(2, '0');
      const month = String(parseInt(dParts[1], 10) || 1).padStart(2, '0');
      let year = dParts[2];
      if (year.length === 2) year = `20${year}`;

      let hour = '09';
      let min = '00';
      const cleanTime = timeP.toUpperCase().replace('H', ':');
      const tParts = cleanTime.split(':');
      if (tParts.length >= 1) hour = String(parseInt(tParts[0], 10) || 0).padStart(2, '0');
      if (tParts.length >= 2) min = String(parseInt(tParts[1], 10) || 0).padStart(2, '0');

      return `${year}-${month}-${day}T${hour}:${min}`;
    }
  }

  // Check format "dd/mm/yyyy HH:mm" or "dd/mm/yyyy"
  if (s.includes('/')) {
    const [dateP, timeP] = s.split(/\s+/);
    const dParts = dateP.split('/');
    if (dParts.length === 3) {
      const day = String(parseInt(dParts[0], 10) || 1).padStart(2, '0');
      const month = String(parseInt(dParts[1], 10) || 1).padStart(2, '0');
      let year = dParts[2];
      if (year.length === 2) year = `20${year}`;

      let hour = '09';
      let min = '00';
      if (timeP) {
        const cleanTime = timeP.toUpperCase().replace('H', ':');
        const tParts = cleanTime.split(':');
        if (tParts.length >= 1) hour = String(parseInt(tParts[0], 10) || 0).padStart(2, '0');
        if (tParts.length >= 2) min = String(parseInt(tParts[1], 10) || 0).padStart(2, '0');
      }

      return `${year}-${month}-${day}T${hour}:${min}`;
    }
  }

  // Fallback try standard Date
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${mins}`;
    }
  } catch (e) {
    // Ignore
  }

  return '';
}

/**
 * Convert HTML datetime-local string "YYYY-MM-DDTHH:mm" to "dd/MM/yyyy HH:mm"
 */
export function datetimeLocalToViFormat(isoStr: string): string {
  if (!isoStr) return '';
  const [dateP, timeP] = isoStr.split('T');
  if (!dateP) return '';
  const [y, m, d] = dateP.split('-');
  if (!y || !m || !d) return '';

  const day = String(parseInt(d, 10)).padStart(2, '0');
  const month = String(parseInt(m, 10)).padStart(2, '0');
  const time = timeP || '09:00';

  return `${day}/${month}/${y} ${time}`;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy HH:mm',
  className = '',
  label,
  required = false,
  showQuickButtons = true,
  quickPresets = ['now', 'today', '+1day', 'clear'],
  disabled = false,
  colorScheme = 'indigo',
  id,
}) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const localDatetimeValue = parseViToDatetimeLocal(value);

  const colorStyles = {
    indigo: {
      ring: 'focus:ring-indigo-500 focus:border-indigo-500',
      icon: 'text-indigo-600 hover:bg-indigo-50',
      badge: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700',
    },
    amber: {
      ring: 'focus:ring-amber-500 focus:border-amber-500',
      icon: 'text-amber-600 hover:bg-amber-50',
      badge: 'bg-amber-50 hover:bg-amber-100 text-amber-700',
    },
    emerald: {
      ring: 'focus:ring-emerald-500 focus:border-emerald-500',
      icon: 'text-emerald-600 hover:bg-emerald-50',
      badge: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700',
    },
    purple: {
      ring: 'focus:ring-purple-500 focus:border-purple-500',
      icon: 'text-purple-600 hover:bg-purple-50',
      badge: 'bg-purple-50 hover:bg-purple-100 text-purple-700',
    },
    slate: {
      ring: 'focus:ring-slate-500 focus:border-slate-500',
      icon: 'text-slate-600 hover:bg-slate-50',
      badge: 'bg-slate-50 hover:bg-slate-100 text-slate-700',
    },
  }[colorScheme] || {
    ring: 'focus:ring-indigo-500 focus:border-indigo-500',
    icon: 'text-indigo-600 hover:bg-indigo-50',
    badge: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700',
  };

  const handleCalendarClick = () => {
    if (disabled) return;
    if (hiddenInputRef.current) {
      if (typeof hiddenInputRef.current.showPicker === 'function') {
        hiddenInputRef.current.showPicker();
      } else {
        hiddenInputRef.current.focus();
      }
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange('');
      return;
    }
    const viFormatted = datetimeLocalToViFormat(val);
    onChange(viFormatted);
  };

  const handleSetNow = () => {
    onChange(formatViDateTime(new Date()));
  };

  const handleSetToday = () => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    onChange(formatViDateTime(d));
  };

  const handleAddDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(10, 0, 0, 0);
    onChange(formatViDateTime(d));
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-xs font-bold text-neutral-800 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{label}</span>
            {required && <span className="text-rose-500">*</span>}
          </label>
          {showQuickButtons && !disabled && (
            <div className="flex items-center gap-1">
              {quickPresets.includes('now') && (
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-0.5"
                  title="Đặt thời gian hiện tại ngay lập tức"
                >
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  <span>Bây giờ</span>
                </button>
              )}
              {quickPresets.includes('+1day') && (
                <button
                  type="button"
                  onClick={() => handleAddDays(1)}
                  className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded cursor-pointer transition-colors"
                  title="Hẹn ngày mai (10:00)"
                >
                  +1 ngày
                </button>
              )}
              {quickPresets.includes('+2days') && (
                <button
                  type="button"
                  onClick={() => handleAddDays(2)}
                  className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded cursor-pointer transition-colors"
                  title="Hẹn 2 ngày nữa"
                >
                  +2 ngày
                </button>
              )}
              {quickPresets.includes('clear') && value && (
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[10px] rounded cursor-pointer"
                  title="Xóa thời gian"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input container */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full pl-3 pr-10 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-900 focus:ring-2 ${colorStyles.ring} focus:outline-none transition-all shadow-2xs ${
            disabled ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed' : ''
          }`}
        />

        {/* Hidden native datetime-local picker */}
        <input
          ref={hiddenInputRef}
          type="datetime-local"
          value={localDatetimeValue}
          onChange={handleNativeChange}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />

        {/* Calendar Picker Trigger Button */}
        <button
          type="button"
          onClick={handleCalendarClick}
          disabled={disabled}
          className={`absolute right-1.5 p-1.5 text-neutral-500 ${colorStyles.icon} rounded-md transition-colors cursor-pointer`}
          title="Mở lịch chọn Ngày & Giờ (dd/mm/yyyy HH:mm)"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {/* Quick buttons under input if no label */}
      {!label && showQuickButtons && !disabled && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {quickPresets.includes('now') && (
            <button
              type="button"
              onClick={handleSetNow}
              className={`px-1.5 py-0.5 ${colorStyles.badge} text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-0.5`}
            >
              <Zap className="w-2.5 h-2.5 fill-current" />
              <span>⚡ Bây giờ</span>
            </button>
          )}
          {quickPresets.includes('+1day') && (
            <button
              type="button"
              onClick={() => handleAddDays(1)}
              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded cursor-pointer transition-colors"
            >
              +1 ngày (Mai)
            </button>
          )}
          {quickPresets.includes('clear') && value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[10px] text-neutral-500 hover:text-rose-600 underline ml-auto cursor-pointer"
            >
              Xóa
            </button>
          )}
        </div>
      )}
    </div>
  );
};
