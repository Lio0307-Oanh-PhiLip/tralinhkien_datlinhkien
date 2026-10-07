import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Wrench, ChevronDown, Check, UserPlus, Search, X, User } from 'lucide-react';
import { TechnicianItem } from '../types/technician';
import { UserSessionData } from '../services/firebaseShortageService';

interface TechnicianSelectorProps {
  label: string;
  value: string;
  onChange: (value: string, tech?: TechnicianItem) => void;
  technicians: TechnicianItem[];
  placeholder?: string;
  currentUser?: {
    uid?: string;
    username?: string;
    name?: string;
    displayName?: string;
    role?: string;
    status?: string;
  } | null;
  isAdmin?: boolean;
  onRequestNewTech?: () => void;
  colorScheme?: 'indigo' | 'emerald' | 'blue';
  icon?: React.ReactNode;
  required?: boolean;
}

export const TechnicianSelector: React.FC<TechnicianSelectorProps> = ({
  label,
  value,
  onChange,
  technicians = [],
  placeholder = 'Chọn hoặc nhập KTV...',
  currentUser,
  isAdmin = false,
  onRequestNewTech,
  colorScheme = 'indigo',
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter only active technicians for standard usage
  const activeTechnicians = useMemo(() => {
    return technicians.filter((t) => t.status === 'active');
  }, [technicians]);

  // Filter based on search query inside dropdown
  const filteredList = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return activeTechnicians;
    return activeTechnicians.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.techId.toLowerCase().includes(q) ||
        (t.department && t.department.toLowerCase().includes(q))
    );
  }, [activeTechnicians, filterQuery]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTech = (tech: TechnicianItem) => {
    // Format: "Tên KTV (Mã ID)" or just name if preferred
    const formatted = `${tech.name} (${tech.techId})`;
    onChange(formatted, tech);
    setIsOpen(false);
    setFilterQuery('');
  };

  const handleAssignMe = () => {
    const myName = currentUser?.name || currentUser?.username || 'Kỹ thuật viên';
    // Try to find matching tech in list
    const matched = activeTechnicians.find(
      (t) =>
        t.name.toLowerCase() === myName.toLowerCase() ||
        (currentUser?.username && t.techId.toLowerCase() === currentUser.username.toLowerCase())
    );
    if (matched) {
      onChange(`${matched.name} (${matched.techId})`, matched);
    } else {
      onChange(myName);
    }
  };

  const isSelected = (tech: TechnicianItem) => {
    if (!value) return false;
    const cleanVal = value.toLowerCase();
    return (
      cleanVal.includes(tech.name.toLowerCase()) ||
      cleanVal.includes(`(${tech.techId.toLowerCase()})`)
    );
  };

  const themeClasses = {
    indigo: {
      borderFocus: 'focus:border-indigo-600',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      activeItem: 'bg-indigo-50 text-indigo-900 font-bold',
      pillSelected: 'bg-indigo-600 text-white border-indigo-700 font-bold',
      link: 'text-indigo-700 hover:text-indigo-900',
    },
    emerald: {
      borderFocus: 'focus:border-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      activeItem: 'bg-emerald-50 text-emerald-950 font-bold',
      pillSelected: 'bg-emerald-600 text-white border-emerald-700 font-bold',
      link: 'text-emerald-700 hover:text-emerald-900',
    },
    blue: {
      borderFocus: 'focus:border-blue-600',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      activeItem: 'bg-blue-50 text-blue-900 font-bold',
      pillSelected: 'bg-blue-600 text-white border-blue-700 font-bold',
      link: 'text-blue-700 hover:text-blue-900',
    },
  }[colorScheme];

  return (
    <div className="relative" ref={containerRef}>
      {/* Label and Quick Actions */}
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-bold text-neutral-800 flex items-center gap-1">
          {icon || <Wrench className="w-3.5 h-3.5 text-neutral-600" />}
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-2">
          {currentUser?.name && (
            <button
              type="button"
              onClick={handleAssignMe}
              className={`text-[10px] font-bold hover:underline cursor-pointer ${themeClasses.link}`}
              title="Gán tên tôi vào ô này"
            >
              + Gán tôi
            </button>
          )}
          {onRequestNewTech && (
            <button
              type="button"
              onClick={onRequestNewTech}
              className={`text-[10px] ${isAdmin ? 'text-emerald-700 hover:text-emerald-900' : 'text-amber-700 hover:text-amber-900'} hover:underline font-bold flex items-center gap-0.5 cursor-pointer`}
              title={isAdmin ? "Thêm KTV mới vào hệ thống (Admin tạo trực tiếp không cần duyệt)" : "Đề xuất thêm KTV mới để Admin duyệt"}
            >
              <UserPlus className="w-3 h-3" />
              <span>{isAdmin ? '+ Thêm KTV' : '+ Đề xuất KTV'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Input Box with Dropdown Toggle */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setFilterQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setFilterQuery('');
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full p-2 pr-14 bg-white border border-neutral-300 rounded text-xs text-neutral-900 font-semibold outline-none transition-all shadow-2xs ${themeClasses.borderFocus}`}
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setFilterQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              title="Xóa lựa chọn"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors"
            title="Mở danh sách kỹ thuật viên"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Dropdown Search Bar */}
          <div className="p-2 border-b border-neutral-100 bg-neutral-50/70 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Tìm theo Tên hoặc Mã ID kỹ thuật..."
              className="w-full bg-transparent text-xs text-neutral-800 placeholder-neutral-400 outline-none"
              autoFocus
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List of Technicians */}
          <div className="overflow-y-auto p-1 divide-y divide-neutral-50">
            {filteredList.length === 0 ? (
              <div className="p-3 text-center text-xs text-neutral-500">
                <p>Không tìm thấy KTV phù hợp với "{filterQuery}"</p>
                {onRequestNewTech && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onRequestNewTech();
                    }}
                    className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold hover:underline cursor-pointer ${
                      isAdmin ? 'text-emerald-700' : 'text-indigo-600'
                    }`}
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>{isAdmin ? '+ Thêm KTV này vào hệ thống' : 'Gửi yêu cầu thêm KTV này tới Admin'}</span>
                  </button>
                )}
              </div>
            ) : (
              filteredList.map((tech) => {
                const selected = isSelected(tech);
                return (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() => handleSelectTech(tech)}
                    className={`w-full text-left p-2 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      selected ? themeClasses.activeItem : 'hover:bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-neutral-200/80 text-neutral-800 border border-neutral-300 font-mono shrink-0">
                        {tech.techId}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-900 truncate">
                          {tech.name}
                        </div>
                        {tech.department && (
                          <div className="text-[10px] text-neutral-500 truncate">
                            {tech.department}
                          </div>
                        )}
                      </div>
                    </div>

                    {selected && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom Footer Actions */}
          <div className="p-2 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-[11px]">
            <span className="text-neutral-500 text-[10px]">
              {activeTechnicians.length} KTV chính thức
            </span>
            {onRequestNewTech && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onRequestNewTech();
                }}
                className={`font-bold flex items-center gap-1 cursor-pointer hover:underline ${
                  isAdmin ? 'text-emerald-700' : 'text-indigo-700'
                }`}
              >
                <UserPlus className="w-3 h-3" />
                <span>{isAdmin ? '+ Thêm KTV mới (Admin)' : '+ Đề xuất thêm KTV mới'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
