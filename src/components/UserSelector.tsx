import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserCircle, ChevronDown, Check, Search, X, Lock, ShieldCheck, User } from 'lucide-react';
import { UserSessionData, subscribeToUsers } from '../services/firebaseShortageService';

interface UserSelectorProps {
  label?: string;
  value: string;
  onChange: (value: string, user?: UserSessionData) => void;
  currentUser?: {
    uid?: string;
    username?: string;
    name?: string;
    displayName?: string;
    role?: string;
    status?: string;
  } | null;
  isAdmin?: boolean;
  users?: UserSessionData[];
  existingUserNames?: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  label = 'User Tạo Phiếu:',
  value,
  onChange,
  currentUser,
  isAdmin = false,
  users: externalUsers,
  existingUserNames = [],
  placeholder = 'Chọn hoặc nhập User tạo phiếu...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [cloudUsers, setCloudUsers] = useState<UserSessionData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to system users if not provided externally
  useEffect(() => {
    if (externalUsers && externalUsers.length > 0) return;
    const unsub = subscribeToUsers((list) => {
      setCloudUsers(list);
    });
    return () => unsub();
  }, [externalUsers]);

  // Combine and deduplicate users
  const userOptions = useMemo(() => {
    const map = new Map<string, { name: string; username?: string; role?: string; rawUser?: UserSessionData }>();

    const sourceUsers = (externalUsers && externalUsers.length > 0) ? externalUsers : cloudUsers;

    // 1. Add current user
    if (currentUser?.name) {
      map.set(currentUser.name.trim(), {
        name: currentUser.name.trim(),
        username: currentUser.username,
        role: currentUser.role,
      });
    }

    // 2. Add system registered users (only approved users or admins)
    sourceUsers.forEach((u) => {
      const isApproved = u.status === 'approved' || u.role === 'admin' || u.username === 'admin';
      if (!isApproved) return;
      const uName = (u.name || u.displayName || u.username || '').trim();
      if (uName) {
        map.set(uName, {
          name: uName,
          username: u.username,
          role: u.role,
          rawUser: u,
        });
      }
    });

    // 3. Add existing users from ticket records
    existingUserNames.forEach((n) => {
      const trimmed = (n || '').trim();
      if (trimmed && !map.has(trimmed)) {
        map.set(trimmed, {
          name: trimmed,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Prioritize admins, then alphabetical
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [externalUsers, cloudUsers, currentUser, existingUserNames]);

  // Filter based on search query
  const filteredUsers = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return userOptions;
    return userOptions.filter((u) => {
      return (
        u.name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
      );
    });
  }, [userOptions, filterQuery]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const canEdit = isAdmin && !disabled;

  const handleSelectUser = (userName: string, rawUser?: UserSessionData) => {
    onChange(userName, rawUser);
    setIsOpen(false);
    setFilterQuery('');
  };

  const handleAssignMe = () => {
    if (!currentUser?.name) return;
    onChange(currentUser.name);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full relative" ref={containerRef}>
      {/* Header Label and Admin Badge / Assign Me */}
      <div className="flex items-center justify-between">
        <label className="font-bold text-neutral-900 flex items-center gap-1.5 text-xs">
          <UserCircle className="w-4 h-4 text-indigo-600" />
          <span>{label}</span>
          {canEdit ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
              title="Tài khoản Admin có toàn quyền đổi User tạo phiếu"
            >
              <ShieldCheck className="w-3 h-3 text-amber-600" />
              <span>Admin: Có quyền đổi User</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200"
              title="Chỉ Admin mới có quyền đổi User tạo phiếu"
            >
              <Lock className="w-2.5 h-2.5 text-neutral-400" />
              <span>Chỉ Admin</span>
            </span>
          )}
        </label>

        {canEdit && currentUser?.name && (
          <button
            type="button"
            onClick={handleAssignMe}
            className="text-[11px] text-indigo-700 hover:underline font-bold cursor-pointer transition-colors"
            title="Gán nhanh tên của bạn"
          >
            + Đặt là tôi ({currentUser.name})
          </button>
        )}
      </div>

      {/* Input Control */}
      {canEdit ? (
        <div className="relative">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full p-2.5 bg-white border rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
              isOpen
                ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                : 'border-neutral-300 hover:border-indigo-400'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              {value ? (
                <span className="text-neutral-900 font-bold truncate">{value}</span>
              ) : (
                <span className="text-neutral-400 font-normal">{placeholder}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {value && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                  }}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
                  title="Xóa lựa chọn"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <ChevronDown
                className={`w-4 h-4 text-neutral-500 transition-transform duration-150 ${
                  isOpen ? 'rotate-180 text-indigo-600' : ''
                }`}
              />
            </div>
          </div>

          {/* Dropdown Menu for Admin */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Search Box */}
              <div className="p-2 border-b border-neutral-100 bg-neutral-50">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Tìm theo tên user hoặc username..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg outline-none focus:border-indigo-500 font-medium"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Users List */}
              <div className="max-h-52 overflow-y-auto divide-y divide-neutral-50 p-1">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => {
                    const isSelected = value.trim() === u.name.trim();
                    return (
                      <button
                        key={u.name}
                        type="button"
                        onClick={() => handleSelectUser(u.name, u.rawUser)}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-900 font-bold'
                            : 'hover:bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              u.role === 'admin'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="font-semibold truncate">{u.name}</div>
                            {u.username && (
                              <div className="text-[10px] text-neutral-400 font-mono">
                                @{u.username}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {u.role === 'admin' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Admin
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-neutral-500 text-xs">
                    Không tìm thấy user phù hợp
                  </div>
                )}
              </div>

              {/* Custom Input for Admin */}
              <div className="p-2 border-t border-neutral-100 bg-neutral-50 flex items-center gap-2">
                <span className="text-[11px] text-neutral-500 whitespace-nowrap">Nhập khác:</span>
                <input
                  type="text"
                  placeholder="Gõ tên user tùy ý..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filterQuery.trim()) {
                      e.preventDefault();
                      handleSelectUser(filterQuery.trim());
                    }
                  }}
                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-neutral-300 rounded outline-none focus:border-indigo-600"
                />
                {filterQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelectUser(filterQuery.trim())}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    Chọn
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Read-Only State for Non-Admin */
        <div
          className="w-full p-2.5 bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 font-semibold text-xs flex items-center justify-between cursor-not-allowed select-none"
          title="Chỉ tài khoản Quản Trị Viên (Admin) mới có quyền thay đổi User tạo phiếu"
        >
          <div className="flex items-center gap-2 truncate">
            <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="truncate">{value || 'Hệ thống'}</span>
          </div>
          <span className="text-[10px] text-neutral-400 font-normal italic shrink-0">
            Không có quyền đổi
          </span>
        </div>
      )}
    </div>
  );
};
