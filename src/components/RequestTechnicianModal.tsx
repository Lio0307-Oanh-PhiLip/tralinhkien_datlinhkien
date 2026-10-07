import React, { useState } from 'react';
import { X, Wrench, ShieldCheck, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { requestNewTechnician, adminCreateTechnician } from '../services/technicianService';
import { TechnicianItem } from '../types/technician';

interface RequestTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    uid?: string;
    username?: string;
    name?: string;
    displayName?: string;
    role?: string;
    status?: string;
  } | null;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onCreated?: (tech: TechnicianItem) => void;
}

export const RequestTechnicianModal: React.FC<RequestTechnicianModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShowToast,
  onCreated,
}) => {
  const [techId, setTechId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Kỹ thuật Phần cứng');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast?.('Vui lòng nhập Tên kỹ thuật viên!', 'error');
      return;
    }
    if (!techId.trim()) {
      onShowToast?.('Vui lòng nhập Mã/ID kỹ thuật (VD: KTV04)!', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const creatorName = currentUser?.name || currentUser?.username || 'Nhân viên';

      if (isAdmin) {
        // Admin creates directly - immediately active
        const createdTech = await adminCreateTechnician({
          techId: techId.trim(),
          name: name.trim(),
          phone: phone.trim(),
          department: department.trim(),
          note: note.trim(),
          approvedBy: creatorName,
        });

        onShowToast?.(
          `Đã thêm thành công KTV [${name.trim()}] (Mã: ${techId.trim().toUpperCase()}) vào danh mục hệ thống!`,
          'success'
        );
        onCreated?.(createdTech);
      } else {
        // Staff requests - pending approval
        const requestedTech = await requestNewTechnician({
          techId: techId.trim(),
          name: name.trim(),
          phone: phone.trim(),
          department: department.trim(),
          note: note.trim(),
          requestedBy: creatorName,
        });

        onShowToast?.(
          `Đã gửi yêu cầu thêm KTV [${name.trim()}] (Mã: ${techId.trim().toUpperCase()})! Đang chờ Admin phê duyệt.`,
          'success'
        );
        onCreated?.(requestedTech);
      }

      setTechId('');
      setName('');
      setPhone('');
      setNote('');
      onClose();
    } catch (err: any) {
      onShowToast?.(err?.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại!', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center border border-blue-500/40">
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-blue-300" />
              ) : (
                <Wrench className="w-4 h-4 text-blue-300" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {isAdmin ? 'Thêm Kỹ Thuật Viên Mới (Admin)' : 'Đề Xuất Kỹ Thuật Viên Mới'}
              </h3>
              <p className="text-[11px] text-blue-200/80">
                {isAdmin
                  ? 'Tạo trực tiếp kỹ thuật viên vào hệ thống và kích hoạt ngay'
                  : 'Gửi thông tin kỹ thuật viên để Quản trị viên (Admin) phê duyệt'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        {isAdmin ? (
          <div className="p-3.5 bg-emerald-50 border-b border-emerald-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 leading-relaxed">
              <strong>Quyền Quản Trị Viên:</strong> Kỹ thuật viên mới sẽ được <strong>tạo trực tiếp và kích hoạt ngay</strong> vào danh sách lựa chọn toàn hệ thống mà không cần gửi duyệt.
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong>Quy định hệ thống:</strong> Danh sách kỹ thuật viên chính thức do <strong>Admin quản lý</strong>. Sau khi bạn gửi đề xuất, Admin sẽ xem xét và phê duyệt trước khi KTV xuất hiện trong danh sách lựa chọn chung.
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Tên Kỹ Thuật Viên <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Võ Tấn Đạt, Nguyễn Văn A..."
              className={`w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-900 outline-none ${
                isAdmin ? 'focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600' : 'focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Mã / ID Kỹ Thuật <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                placeholder="VD: KTV04, CX02..."
                className={`w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs font-bold uppercase outline-none ${
                  isAdmin ? 'text-emerald-800 focus:border-emerald-600' : 'text-indigo-700 focus:border-indigo-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Số Điện Thoại
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0901234567"
                className={`w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs text-neutral-900 outline-none ${
                  isAdmin ? 'focus:border-emerald-600' : 'focus:border-indigo-600'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Bộ Phận / Vị Trí
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="VD: Kỹ thuật phần cứng, CS, Tiếp nhận..."
              className={`w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs text-neutral-900 outline-none ${
                isAdmin ? 'focus:border-emerald-600' : 'focus:border-indigo-600'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              {isAdmin ? 'Ghi Chú Kỹ Thuật Viên' : 'Lý Do / Ghi Chú Đề Xuất'}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isAdmin ? "VD: Kỹ thuật viên chính thức cơ sở..." : "VD: Kỹ thuật mới tiếp nhận công việc từ ngày 01/09..."}
              className={`w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs text-neutral-900 outline-none resize-none ${
                isAdmin ? 'focus:border-emerald-600' : 'focus:border-indigo-600'
              }`}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                isAdmin ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isAdmin ? 'Đang thêm...' : 'Đang gửi...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isAdmin ? 'Thêm KTV & Kích Hoạt Ngay' : 'Gửi Yêu Cầu Duyệt'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

