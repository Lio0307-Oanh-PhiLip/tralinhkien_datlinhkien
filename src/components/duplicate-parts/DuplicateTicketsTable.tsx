import React from 'react';
import { ShortageBookingItem, ShortageStatus, SHORTAGE_STATUS_CONFIG } from '../../types/shortage';
import {
  Tag,
  User,
  Phone,
  Clock,
  UserCircle,
  Wrench,
  Edit2,
  Eye,
  Check,
  Copy,
  PhoneCall,
  Sparkles,
  Trash2,
} from 'lucide-react';

export interface UniqueTicketGroupItem {
  ticket: ShortageBookingItem;
  parts: {
    partGroupKey: string;
    partName: string;
    partCode: string;
    model: string;
    quantity: number;
    status: ShortageStatus;
  }[];
  totalQuantity: number;
  hasHold: boolean;
  hasKeepsPart: boolean;
}

interface DuplicateTicketsTableProps {
  tickets: UniqueTicketGroupItem[];
  totalTicketsCount: number;
  totalPiecesCount: number;
  copiedId: string | null;
  isAdmin?: boolean;
  onCopy: (text: string, id: string, label?: string) => void;
  onOpenEditModal: (ticket: ShortageBookingItem) => void;
  onRequestDeleteOrCancel?: (ticket: ShortageBookingItem) => void;
  onSelectDuplicatePartKey: (key: string | null) => void;
  onCloseModal: () => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
  startIndex: number;
}

export const DuplicateTicketsTable: React.FC<DuplicateTicketsTableProps> = ({
  tickets,
  totalTicketsCount,
  totalPiecesCount,
  copiedId,
  isAdmin = false,
  onCopy,
  onOpenEditModal,
  onRequestDeleteOrCancel,
  onSelectDuplicatePartKey,
  onCloseModal,
  onShowToast,
  startIndex,
}) => {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
      <div className="p-3 bg-neutral-100/70 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-neutral-800 flex items-center gap-2">
          <Tag className="w-4 h-4 text-indigo-600" />
          <span>
            Danh Sách <strong>{totalTicketsCount} Phiếu</strong> Khách Hàng (Tổng nợ <strong>{totalPiecesCount} cái</strong> linh kiện)
          </span>
          <span className="text-[11px] font-normal text-neutral-500">
            • Đã xếp theo thứ tự ưu tiên & ngày đặt
          </span>
        </div>
        <div className="text-[11px] text-neutral-500">
          Bấm <strong>Sửa</strong> để cập nhật tiến độ hoặc kỹ thuật xử lý
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="p-8 text-center text-xs text-neutral-500">
          Không có phiếu nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-900 text-white font-bold text-[11px] uppercase tracking-wider border-b border-neutral-800">
                <th className="py-2.5 px-3 w-12 text-center">STT</th>
                <th className="py-2.5 px-3 min-w-[160px]">Số Phiếu</th>
                <th className="py-2.5 px-3 min-w-[160px]">Khách Hàng</th>
                <th className="py-2.5 px-3 min-w-[220px]">Linh Kiện Trùng & Model</th>
                <th className="py-2.5 px-3 text-center min-w-[80px]">Tổng SL</th>
                <th className="py-2.5 px-3 min-w-[150px]">Tiến Độ Phiếu</th>
                <th className="py-2.5 px-3 min-w-[150px]">Người Tạo & Kỹ Thuật</th>
                <th className="py-2.5 px-3 min-w-[130px]">Ngày Đặt / Ghi Chú</th>
                <th className="py-2.5 px-3 text-center min-w-[110px]">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {tickets.map((item, idx) => {
                const { ticket, parts, totalQuantity } = item;
                const statusConfig = SHORTAGE_STATUS_CONFIG[ticket.status] || SHORTAGE_STATUS_CONFIG.da_tao_phieu;
                const isCompleted = ticket.status === 'da_hoan_tat';
                const rowIndex = startIndex + idx + 1;

                return (
                  <tr
                    key={`ticket-row-${ticket.id}-${idx}`}
                    className={`hover:bg-indigo-50/40 transition-colors ${
                      isCompleted ? 'bg-neutral-50/70 opacity-75' : idx % 2 === 1 ? 'bg-neutral-50/40' : 'bg-white'
                    }`}
                  >
                    {/* STT */}
                    <td className="py-2.5 px-3 text-center font-bold text-neutral-500">
                      #{rowIndex}
                    </td>

                    {/* Số Phiếu */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-neutral-900 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded text-xs">
                          {ticket.ticketNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => onCopy(ticket.ticketNumber, `table-ticket-${ticket.id}`, 'Số phiếu')}
                          className="text-neutral-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                          title="Sao chép số phiếu"
                        >
                          {copiedId === `table-ticket-${ticket.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {ticket.isCustomerCallHold && (
                          <span className="text-[10px] font-bold text-blue-900 bg-blue-100 border border-blue-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <PhoneCall className="w-3 h-3 text-blue-700" />
                            <span>Gọi giữ</span>
                          </span>
                        )}
                        {ticket.customerKeepsPart && (
                          <span className="text-[10px] font-bold text-fuchsia-950 bg-fuchsia-100 border border-fuchsia-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Sparkles className="w-3 h-3 text-fuchsia-700" />
                            <span>SVD</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Khách Hàng */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-neutral-900 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{ticket.customerName || 'Khách vãng lai'}</span>
                      </div>
                      {ticket.customerPhone && (
                        <div className="text-xs font-mono text-neutral-600 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-neutral-400" />
                          <a href={`tel:${ticket.customerPhone}`} className="hover:text-indigo-600 hover:underline">
                            {ticket.customerPhone}
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Linh Kiện & Model (Hiển thị các LK trùng của phiếu này) */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-1.5">
                        {parts.map((p, pIdx) => (
                          <div key={`part-${p.partGroupKey}-${pIdx}`} className="space-y-0.5">
                            <div className="font-bold text-neutral-900 leading-snug">
                              {p.partName}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.partCode && p.partCode !== 'N/A' && (
                                <span className="font-mono text-[11px] font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-200">
                                  {p.partCode}
                                </span>
                              )}
                              {p.model && (
                                <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                  {p.model}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded">
                                SL: {p.quantity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Tổng Số Lượng */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-950 font-black rounded-lg text-xs">
                        {totalQuantity} cái
                      </span>
                    </td>

                    {/* Tiến Độ */}
                    <td className="py-2.5 px-3">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusConfig.badgeBg}`}>
                        {statusConfig.label}
                      </span>
                    </td>

                    {/* Người Tạo & KTV */}
                    <td className="py-2.5 px-3 space-y-1">
                      <div className="text-[11px] text-neutral-600 flex items-center gap-1">
                        <UserCircle className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span>
                          Tạo: <strong className="text-neutral-800">{ticket.createdBy || 'Hệ thống'}</strong>
                          {ticket.creatorTechnician && ticket.creatorTechnician !== ticket.createdBy && (
                            <span className="text-indigo-700 ml-1 font-medium">
                              (KT: {ticket.creatorTechnician})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-600 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>KTV: <strong className={ticket.technicianName ? 'text-emerald-800' : 'text-neutral-400 font-normal italic'}>{ticket.technicianName || 'Chưa phân công'}</strong></span>
                      </div>
                    </td>

                    {/* Ngày Đặt & Ghi Chú */}
                    <td className="py-2.5 px-3">
                      <div className="text-neutral-700 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        <span>{ticket.bookingDate || 'Chưa ghi'}</span>
                      </div>
                      {ticket.note && (
                        <div className="text-[11px] text-neutral-500 italic truncate max-w-[150px] mt-0.5" title={ticket.note}>
                          {ticket.note}
                        </div>
                      )}
                    </td>

                    {/* Thao Tác */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(ticket)}
                          className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-neutral-200"
                          title="Chỉnh sửa phiếu này"
                        >
                          <Edit2 className="w-3 h-3 text-neutral-600" />
                          <span>Sửa</span>
                        </button>

                        {onRequestDeleteOrCancel && (
                          isAdmin ? (
                            <button
                              type="button"
                              onClick={() => onRequestDeleteOrCancel(ticket)}
                              className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 hover:border-red-200 cursor-pointer transition-colors"
                              title="Xóa phiếu này (Quyền Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : ticket.cancelRequested ? (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                              title="Đang chờ Quản trị viên duyệt hủy"
                            >
                              Chờ hủy
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onRequestDeleteOrCancel(ticket)}
                              className="p-1 text-neutral-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg border border-neutral-200 cursor-pointer transition-colors"
                              title="Gửi yêu cầu hủy phiếu đặt chờ này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}

                        {parts[0] && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectDuplicatePartKey(parts[0].partGroupKey);
                              onCloseModal();
                              onShowToast(`Đang lọc phiếu theo linh kiện "${parts[0].partName}"`, 'info');
                            }}
                            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                            title="Lọc trên giao diện chính"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
