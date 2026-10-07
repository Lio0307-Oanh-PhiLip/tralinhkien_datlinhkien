import React from 'react';
import { DuplicatePartGroup, ShortageBookingItem, SHORTAGE_STATUS_CONFIG } from '../../types/shortage';
import { LabelItem } from '../../types/label';
import {
  Copy,
  Check,
  Eye,
  Printer,
  ChevronRight,
  PhoneCall,
  Sparkles,
  User,
  Phone,
  Clock,
  UserCircle,
  Wrench,
  Edit2,
  Trash2,
  Boxes,
  CheckSquare,
} from 'lucide-react';

interface DuplicateCardsListProps {
  groups: DuplicatePartGroup[];
  selectedDuplicatePartKey: string | null;
  expandedKeys: Record<string, boolean>;
  copiedId: string | null;
  startIndex: number;
  isAdmin?: boolean;
  onToggleExpand: (key: string) => void;
  onSelectDuplicatePartKey: (key: string | null) => void;
  onSendToLabelStudio: (item: LabelItem) => void;
  onOpenEditModal: (ticket: ShortageBookingItem) => void;
  onRequestDeleteOrCancel?: (ticket: ShortageBookingItem) => void;
  onCopy: (text: string, id: string, label?: string) => void;
  onCloseModal: () => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
}

export const DuplicateCardsList: React.FC<DuplicateCardsListProps> = ({
  groups,
  selectedDuplicatePartKey,
  expandedKeys,
  copiedId,
  startIndex,
  isAdmin = false,
  onToggleExpand,
  onSelectDuplicatePartKey,
  onSendToLabelStudio,
  onOpenEditModal,
  onRequestDeleteOrCancel,
  onCopy,
  onCloseModal,
  onShowToast,
}) => {
  return (
    <div className="space-y-4">
      {groups.map((group, idx) => {
        const isSelected = selectedDuplicatePartKey === group.key;
        const isExpanded = expandedKeys[group.key] !== false; // expanded by default
        const rankIndex = startIndex + idx + 1;

        return (
          <div
            key={group.key}
            className={`bg-white rounded-xl border transition-all shadow-xs overflow-hidden ${
              isSelected
                ? 'border-purple-600 ring-2 ring-purple-500/20 shadow-md'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            {/* Group Header Card */}
            <div className="p-3.5 md:p-4 bg-white flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 border-b border-neutral-100">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Rank Index / Badge */}
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-900 font-black text-xs flex items-center justify-center shrink-0 border border-purple-200/80 mt-0.5 shadow-2xs">
                  #{rankIndex}
                </div>

                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-extrabold text-sm md:text-base text-neutral-900 leading-snug break-words">
                      {group.partName}
                    </h4>

                    {group.partCode && group.partCode !== 'N/A' && (
                      <div className="flex items-center gap-1 bg-neutral-900 text-white px-2 py-0.5 rounded-md font-mono font-bold text-xs shrink-0 shadow-2xs">
                        <span>{group.partCode}</span>
                        <button
                          type="button"
                          onClick={() => onCopy(group.partCode, `code-${group.key}`, 'Mã LK')}
                          className="hover:text-indigo-300 cursor-pointer p-0.5 transition-colors"
                          title="Sao chép mã linh kiện"
                        >
                          {copiedId === `code-${group.key}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {group.model && (
                      <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-900 rounded-md border border-blue-200 shrink-0">
                        {group.model}
                      </span>
                    )}
                  </div>

                  {/* Summary Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 border border-purple-300 text-purple-950 font-black text-xs rounded-full">
                      <span>🔥 Khách chưa lên: {group.activeCount} phiếu ({group.activeQuantity} cái)</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-700 font-semibold text-[11px] rounded-full">
                      <span>Tổng: {group.ticketCount} phiếu ({group.totalQuantity} cái)</span>
                    </span>

                    {group.neededToRequestQty > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-900 font-bold text-[11px] rounded-full">
                        <span>🔴 Cần xin thêm: {group.neededToRequestQty} cái</span>
                      </span>
                    )}

                    {group.stockedWaitingCustomerQty > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-50 border border-purple-200 text-purple-900 font-bold text-[11px] rounded-full">
                        <span>🟣 Đã có ở kho: {group.stockedWaitingCustomerQty} cái</span>
                      </span>
                    )}

                    {group.hasCallHold && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 font-bold text-[11px] rounded-full">
                        <PhoneCall className="w-3 h-3 text-blue-600" />
                        <span>Gọi giữ</span>
                      </span>
                    )}

                    {group.hasSvdKeep && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800 font-bold text-[11px] rounded-full">
                        <Sparkles className="w-3 h-3 text-fuchsia-600" />
                        <span>Giữ SVD</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons for this Duplicate Part */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start xl:self-center">
                <button
                  type="button"
                  onClick={() => {
                    onSelectDuplicatePartKey(group.key);
                    onCloseModal();
                    onShowToast(`Đang lọc ${group.ticketCount} phiếu đặt linh kiện "${group.partName}"`, 'info');
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.02]"
                  title="Lọc xem riêng danh sách các phiếu này trên giao diện chính"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lọc Xem {group.ticketCount} Phiếu</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const labelItem: LabelItem = {
                      id: `lk-dup-${Date.now()}`,
                      code: group.partCode || '',
                      name: group.partName || '',
                      model: group.model || '',
                      category: 'Linh Kiện',
                      quantity: group.activeQuantity || group.totalQuantity || 1,
                      location: '',
                    };
                    onSendToLabelStudio(labelItem);
                    onShowToast(`Đã gửi linh kiện "${group.partName}" vào danh sách in tem 3x2`, 'success');
                  }}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-lg border border-neutral-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Thêm linh kiện này vào danh sách In Tem 3x2"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>In Tem</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleExpand(group.key)}
                  className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                  title={isExpanded ? 'Thu gọn danh sách phiếu' : 'Mở rộng danh sách phiếu'}
                >
                  <ChevronRight
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                  <span className="hidden sm:inline">{isExpanded ? 'Thu gọn' : 'Xem phiếu'}</span>
                </button>
              </div>
            </div>

            {/* Customer Tickets List */}
            {isExpanded && (
              <div className="bg-neutral-50/70 p-3 md:p-4 border-t border-neutral-100 space-y-3">
                <div className="text-[11px] font-bold text-neutral-700 flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="text-neutral-900 font-extrabold">Danh sách {group.tickets.length} phiếu đặt linh kiện này</span>
                    <span className="text-neutral-500 font-normal">
                      ({group.activeCount} khách chưa lên thay • Đã xếp thứ tự ưu tiên phân bổ)
                    </span>
                  </span>
                  <span className="text-[10px] text-neutral-500 bg-white px-2 py-0.5 rounded border border-neutral-200">
                    Bấm số phiếu để sao chép • Bấm Sửa để cập nhật tiến độ
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {group.tickets
                    .slice()
                    .sort((a, b) => {
                      const aDone = a.ticket.status === 'da_hoan_tat';
                      const bDone = b.ticket.status === 'da_hoan_tat';
                      if (aDone !== bDone) return aDone ? 1 : -1;
                      const aPriority = (a.ticket.isCustomerCallHold || a.ticket.customerKeepsPart) ? 1 : 0;
                      const bPriority = (b.ticket.isCustomerCallHold || b.ticket.customerKeepsPart) ? 1 : 0;
                      if (aPriority !== bPriority) return bPriority - aPriority;
                      return (a.ticket.bookingDate || '').localeCompare(b.ticket.bookingDate || '');
                    })
                    .map(({ ticket, partQuantity, isPartStocked, isPartRequested }, tIdx) => {
                      const statusConfig =
                        SHORTAGE_STATUS_CONFIG[ticket.status] || SHORTAGE_STATUS_CONFIG.da_tao_phieu;
                      const isCompleted = ticket.status === 'da_hoan_tat';

                      return (
                        <div
                          key={`${group.key}-${ticket.id}-${tIdx}`}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isCompleted
                              ? 'bg-neutral-50 border-neutral-200 opacity-80'
                              : 'bg-white border-neutral-200 shadow-2xs hover:border-indigo-300'
                          }`}
                        >
                          {/* Ticket details */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {!isCompleted && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  tIdx === 0
                                    ? 'bg-amber-400 text-amber-950 ring-1 ring-amber-500/50 shadow-2xs'
                                    : 'bg-neutral-200 text-neutral-700'
                                }`}>
                                  Ưu Tiên #{tIdx + 1}
                                </span>
                              )}

                              {/* Ticket Number */}
                              <div className="flex items-center gap-1 bg-neutral-900 text-white px-2 py-0.5 rounded-md font-mono font-bold text-xs shadow-2xs">
                                <span>{ticket.ticketNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => onCopy(ticket.ticketNumber, `ticket-${ticket.id}`, 'Số phiếu')}
                                  className="hover:text-indigo-300 cursor-pointer p-0.5 transition-colors"
                                  title="Sao chép số phiếu"
                                >
                                  {copiedId === `ticket-${ticket.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              {/* Status badge */}
                              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusConfig.badgeBg}`}>
                                {statusConfig.label}
                              </span>

                              {/* Part-specific status badge */}
                              {isPartStocked ? (
                                <span className="text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Boxes className="w-3 h-3 text-purple-700" />
                                  <span>LK này: Đã về kho</span>
                                </span>
                              ) : isPartRequested ? (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  <span>LK này: Đã xin chờ cấp</span>
                                </span>
                              ) : (ticket.status === 'da_tao_phieu' || ticket.status === 'chua_xin_du_lk') ? (
                                <span className="text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <span>🔴 LK này: Cần xin GCSM</span>
                                </span>
                              ) : null}

                              {/* Quantity */}
                              <span className="text-xs font-bold text-indigo-950 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                SL: {partQuantity || 1} cái
                              </span>

                              {/* Hold tags */}
                              {ticket.isCustomerCallHold && (
                                <span className="text-[10px] font-bold text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <PhoneCall className="w-3 h-3 text-blue-700" />
                                  <span>Gọi giữ trước</span>
                                </span>
                              )}

                              {ticket.customerKeepsPart && (
                                <span className="text-[10px] font-bold text-fuchsia-950 bg-fuchsia-100 border border-fuchsia-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-fuchsia-700" />
                                  <span>Giữ SVD</span>
                                </span>
                              )}
                            </div>

                            {/* Customer Info & Dates */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600 pt-0.5">
                              <div className="flex items-center gap-1 font-bold text-neutral-900">
                                <User className="w-3.5 h-3.5 text-neutral-400" />
                                <span>{ticket.customerName || 'Khách vãng lai'}</span>
                              </div>

                              {ticket.customerPhone && (
                                <div className="flex items-center gap-1 font-mono font-medium text-neutral-800">
                                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                                  <a
                                    href={`tel:${ticket.customerPhone}`}
                                    className="hover:text-indigo-600 hover:underline"
                                  >
                                    {ticket.customerPhone}
                                  </a>
                                </div>
                              )}

                              <div className="flex items-center gap-1 text-neutral-500">
                                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Ngày đặt: <strong>{ticket.bookingDate || 'Chưa ghi'}</strong></span>
                              </div>

                              {/* User & KT tạo phiếu */}
                              <div className="flex items-center gap-1 text-indigo-950 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                                <UserCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>
                                  Tạo: <strong className="text-indigo-900">{ticket.createdBy || 'Hệ thống'}</strong>
                                  {ticket.creatorTechnician && ticket.creatorTechnician !== ticket.createdBy && (
                                    <span className="text-indigo-700 font-normal ml-1">
                                      (KT: <strong className="text-indigo-900">{ticket.creatorTechnician}</strong>)
                                    </span>
                                  )}
                                </span>
                              </div>

                              {/* Kỹ thuật xử lý */}
                              <div
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  ticket.technicianName
                                    ? 'text-emerald-950 bg-emerald-50 border-emerald-300'
                                    : 'text-neutral-500 bg-neutral-100 border-neutral-200'
                                }`}
                              >
                                <Wrench className={`w-3.5 h-3.5 ${ticket.technicianName ? 'text-emerald-700' : 'text-neutral-400'} shrink-0`} />
                                <span>KTV: <strong className={ticket.technicianName ? 'text-emerald-900' : 'text-neutral-500 font-normal italic'}>{ticket.technicianName || 'Chưa phân công'}</strong></span>
                              </div>
                            </div>

                            {ticket.note && (
                              <div className="text-xs text-neutral-700 bg-neutral-100/90 px-2.5 py-1.5 rounded-lg border border-neutral-200/90 italic">
                                Ghi chú: {ticket.note}
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start md:self-center pt-1 md:pt-0">
                            <button
                              type="button"
                              onClick={() => onOpenEditModal(ticket)}
                              className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-neutral-200"
                              title="Mở form chỉnh sửa phiếu này"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-neutral-700" />
                              <span>Sửa</span>
                            </button>

                            {/* Delete (Admin) or Request Cancel (Staff) */}
                            {onRequestDeleteOrCancel && (
                              isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => onRequestDeleteOrCancel(ticket)}
                                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 hover:border-red-200 cursor-pointer transition-colors"
                                  title="Xóa phiếu này (Quyền Admin)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : ticket.cancelRequested ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200"
                                  title="Phiếu này đã gửi yêu cầu hủy và đang chờ Quản trị viên duyệt"
                                >
                                  <Clock className="w-3 h-3" /> Chờ hủy
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onRequestDeleteOrCancel(ticket)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-neutral-500 hover:text-amber-800 bg-neutral-100 hover:bg-amber-50 rounded-lg text-xs font-semibold border border-neutral-200 transition-colors cursor-pointer"
                                  title="Gửi yêu cầu hủy phiếu đặt chờ này cho Quản trị viên xác nhận"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Hủy</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
