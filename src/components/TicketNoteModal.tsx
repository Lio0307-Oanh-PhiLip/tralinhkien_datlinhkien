import React, { useState, useEffect, useRef } from 'react';
import {
  StickyNote,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { formatViDateTime } from './DateTimePicker';

export interface TicketNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketNumber: string;
  customerName: string;
  currentNote?: string;
  currentUserName?: string;
  initialMode?: 'edit' | 'append' | 'add';
  onSaveNote: (newNote: string) => void;
  onDeleteNote?: () => void;
}

const QUICK_NOTE_SUGGESTIONS = [
  'Khách hẹn ngày OPPO Service Day (10 hàng tháng)',
  'Khách dặn giữ lại linh kiện cũ sau khi thay',
  'Khách cần lấy máy gấp trong ngày',
  'Khách dặn gọi trước 30 phút khi máy xong',
  'Khách mang theo củ sạc + cáp sạc',
  'Khách báo màn hình bị sọc nhẹ, cần test kỹ',
  'Đã báo giá trước và khách đã đồng ý',
  'Linh kiện ưu tiên xin sớm cho khách',
];

export const TicketNoteModal: React.FC<TicketNoteModalProps> = ({
  isOpen,
  onClose,
  ticketNumber,
  customerName,
  currentNote = '',
  currentUserName = 'Nhân viên',
  initialMode = 'edit',
  onSaveNote,
  onDeleteNote,
}) => {
  // Hàm xác định mode ban đầu: Nếu là 'add' / 'append' hoặc phiếu chưa có ghi chú, luôn mở ở ô thêm ghi chú
  const determineInitialMode = (initMode?: 'edit' | 'append' | 'add', note?: string): 'edit' | 'append' => {
    if (initMode === 'add' || initMode === 'append') return 'append';
    if (!note || !note.trim()) return 'append';
    return 'edit';
  };

  const [mode, setMode] = useState<'edit' | 'append'>(
    determineInitialMode(initialMode, currentNote)
  );

  // Full note text (dùng khi mode === 'edit')
  const [fullNote, setFullNote] = useState<string>('');
  // Checkbox tự động gắn tên & thời gian người sửa khi ở mode 'edit'
  const [includeEditUserTag, setIncludeEditUserTag] = useState<boolean>(true);

  // Additional note text (dùng khi mode === 'append')
  const [appendContent, setAppendContent] = useState<string>('');
  // Checkbox tự động gắn tên & thời gian khi ở mode 'append'
  const [includeUserTag, setIncludeUserTag] = useState<boolean>(true);

  // Confirm delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  const appendTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      const cleanNote = currentNote || '';
      setFullNote(cleanNote);
      setAppendContent('');
      const chosenMode = determineInitialMode(initialMode, cleanNote);
      setMode(chosenMode);
      setShowDeleteConfirm(false);
      setIncludeUserTag(true);
      setIncludeEditUserTag(true);

      // Focus ô nhập tương ứng sau khi mở modal
      setTimeout(() => {
        if (chosenMode === 'append') {
          appendTextareaRef.current?.focus();
        } else {
          editTextareaRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, currentNote, initialMode]);

  if (!isOpen) return null;

  // Xử lý chèn gợi ý nhanh
  const handleInsertSuggestion = (text: string) => {
    if (mode === 'append') {
      setAppendContent((prev) => (prev ? `${prev}. ${text}` : text));
      appendTextareaRef.current?.focus();
    } else {
      setFullNote((prev) => (prev ? `${prev}\n- ${text}` : text));
      editTextareaRef.current?.focus();
    }
  };

  // Tính preview nội dung khi append (Thêm ghi chú)
  const getAppendedPreview = () => {
    const trimmed = appendContent.trim();
    if (!trimmed) return currentNote || '';

    const timestamp = formatViDateTime();
    const tag = includeUserTag ? `[${timestamp} - ${currentUserName}]: ` : '';
    const newEntry = `${tag}${trimmed}`;

    if (!currentNote || !currentNote.trim()) {
      return newEntry;
    }
    return `${currentNote.trim()}\n${newEntry}`;
  };

  // Tính preview nội dung khi edit (Sửa ghi chú)
  const getEditedPreview = () => {
    const trimmed = fullNote.trim();
    if (!trimmed) return '';
    if (!includeEditUserTag) return trimmed;

    const timestamp = formatViDateTime();
    const tag = `[${timestamp} - ${currentUserName}]: `;

    // Nếu người dùng đã tự gõ hoặc nội dung đã bắt đầu bằng đúng tag này
    if (trimmed.startsWith(`[${timestamp} - ${currentUserName}]`)) {
      return trimmed;
    }

    // Nếu trước đó ghi chú bắt đầu bằng 1 tag thời gian người khác e.g. [04/09/2026 10:00 - Nguyễn Văn A]:
    // Thay thế tag cũ bằng tag người sửa mới
    const leadingTagRegex = /^\[\d{2}\/\d{2}(\/\d{4})?\s+\d{2}:\d{2}\s*-\s*[^\]]+\]:\s*/;
    if (leadingTagRegex.test(trimmed)) {
      return trimmed.replace(leadingTagRegex, tag);
    }

    // Nếu chưa có tag, gắn tag người sửa vào đầu ghi chú
    return `${tag}${trimmed}`;
  };

  // Submit Lưu
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'append') {
      const finalNote = getAppendedPreview();
      onSaveNote(finalNote);
    } else {
      const finalNote = getEditedPreview();
      onSaveNote(finalNote);
    }
    onClose();
  };

  // Xóa ghi chú
  const handleConfirmDelete = () => {
    if (onDeleteNote) {
      onDeleteNote();
    } else {
      onSaveNote('');
    }
    onClose();
  };

  const hasExistingNote = Boolean(currentNote && currentNote.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 rounded-xl border border-blue-500/40">
              <StickyNote className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                <span>Quản Lý Ghi Chú Phiếu</span>
              </h3>
              <p className="text-xs text-blue-200/80 font-mono flex items-center gap-1.5 mt-0.5">
                <span>Phiếu #{ticketNumber}</span>
                <span>•</span>
                <span className="font-semibold text-white">{customerName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('append');
                setTimeout(() => appendTextareaRef.current?.focus(), 50);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'append'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{hasExistingNote ? '+ Thêm nội dung vào ghi chú' : '+ Thêm ghi chú mới'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('edit');
                setTimeout(() => editTextareaRef.current?.focus(), 50);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'edit'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Chỉnh sửa toàn bộ ghi chú</span>
            </button>
          </div>

          {/* Ô THÊM GHI CHÚ / BỔ SUNG GHI CHÚ (mode === 'append') */}
          {mode === 'append' && (
            <div className="space-y-3">
              {/* Existing note reference box (nếu đã có ghi chú) */}
              {hasExistingNote ? (
                <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Ghi chú hiện tại:
                  </div>
                  <div className="text-[11px] text-neutral-700 italic max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    "{currentNote}"
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-800 font-medium p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80 flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Phiếu này chưa có ghi chú. Nhập nội dung bên dưới để tạo ghi chú mới cho phiếu.</span>
                </div>
              )}

              {/* Input for new note */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-neutral-800 text-xs flex items-center justify-between">
                  <span>{hasExistingNote ? 'Nội dung mới muốn thêm:' : 'Nội dung ghi chú:'}</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {appendContent.length} ký tự
                  </span>
                </label>
                <textarea
                  ref={appendTextareaRef}
                  rows={4}
                  value={appendContent}
                  onChange={(e) => setAppendContent(e.target.value)}
                  placeholder={
                    hasExistingNote
                      ? 'Nhập nội dung bạn muốn bổ sung thêm vào ghi chú...'
                      : 'Nhập ghi chú cho phiếu (VD: Khách hẹn ngày Service Day 10/9, dặn giữ linh kiện cũ...)'
                  }
                  className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Auto user tag checkbox */}
              <label className="flex items-center gap-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeUserTag}
                  onChange={(e) => setIncludeUserTag(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-[11px] text-emerald-950 font-semibold flex items-center gap-1.5 flex-wrap">
                  <span>Tự động đính kèm tên & thời gian:</span>
                  <strong className="text-emerald-800 font-mono text-[10px] bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200">
                    [{formatViDateTime()} - {currentUserName}]
                  </strong>
                </span>
              </label>

              {/* Preview of note */}
              {appendContent.trim() && (
                <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] space-y-1 animate-in fade-in">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                    Xem trước ghi chú sau khi lưu:
                  </span>
                  <div className="text-neutral-800 whitespace-pre-wrap font-medium leading-relaxed">
                    {getAppendedPreview()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ô SỬA TOÀN BỘ GHI CHÚ (mode === 'edit') */}
          {mode === 'edit' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-neutral-800 text-xs flex items-center gap-1.5">
                    <span>Nội dung ghi chú của phiếu:</span>
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {fullNote.length} ký tự
                  </span>
                </div>

                <textarea
                  ref={editTextareaRef}
                  rows={5}
                  value={fullNote}
                  onChange={(e) => setFullNote(e.target.value)}
                  placeholder="Nhập ghi chú cho phiếu (VD: Khách hẹn ngày Service Day, dặn giữ linh kiện cũ...)"
                  className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Tùy chọn tự động gắn tên & thời gian sửa - Giúp cả đội ngũ biết ai vừa sửa */}
              <label className="flex items-center gap-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeEditUserTag}
                  onChange={(e) => setIncludeEditUserTag(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-[11px] text-amber-950 font-semibold flex items-center gap-1.5 flex-wrap">
                  <span>Tự động gắn tên & thời gian người sửa:</span>
                  <strong className="text-amber-800 font-mono text-[10px] bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300">
                    [{formatViDateTime()} - {currentUserName}]
                  </strong>
                </span>
              </label>

              {/* Preview of edited note */}
              {includeEditUserTag && fullNote.trim() && (
                <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] space-y-1 animate-in fade-in">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                    Xem trước ghi chú sau khi lưu sửa:
                  </span>
                  <div className="text-neutral-800 whitespace-pre-wrap font-medium leading-relaxed">
                    {getEditedPreview()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Note Suggestions */}
          <div className="space-y-1.5 pt-1 border-t border-neutral-100">
            <div className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Gợi ý mẫu ghi chú nhanh (Bấm để chèn):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTE_SUGGESTIONS.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleInsertSuggestion(sug)}
                  className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-amber-100 text-neutral-700 hover:text-amber-900 text-[10px] font-medium border border-neutral-200 transition-colors cursor-pointer text-left"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Delete Confirm Box if requested */}
          {showDeleteConfirm && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Xác nhận xóa hoàn toàn ghi chú của phiếu này?</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Hành động này sẽ xóa sạch nội dung ghi chú. Bạn có chắc chắn muốn xóa không?
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-700 font-bold text-[11px] rounded-lg border border-neutral-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xác Nhận Xóa</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-neutral-200 flex items-center justify-between gap-2">
            <div>
              {hasExistingNote && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Xóa toàn bộ ghi chú của phiếu này"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Xóa Ghi Chú</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl border border-neutral-300 transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className={`px-5 py-2 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 text-white ${
                  mode === 'append'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {mode === 'append'
                    ? hasExistingNote
                      ? 'Lưu & Bổ Sung Ghi Chú'
                      : 'Lưu Ghi Chú Mới'
                    : 'Lưu Ghi Chú Đã Sửa'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
