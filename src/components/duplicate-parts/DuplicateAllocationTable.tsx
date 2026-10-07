import React from 'react';
import { DuplicatePartGroup, GCSM_STOCK_URL } from '../../types/shortage';
import { Copy, Check, ExternalLink, Eye, PhoneCall, Sparkles } from 'lucide-react';

interface DuplicateAllocationTableProps {
  groups: DuplicatePartGroup[];
  selectedDuplicatePartKey: string | null;
  copiedId: string | null;
  onSelectDuplicatePartKey: (key: string | null) => void;
  onCopy: (text: string, id: string, label?: string) => void;
  onCloseModal: () => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
  startIndex: number;
}

export const DuplicateAllocationTable: React.FC<DuplicateAllocationTableProps> = ({
  groups,
  selectedDuplicatePartKey,
  copiedId,
  onSelectDuplicatePartKey,
  onCopy,
  onCloseModal,
  onShowToast,
  startIndex,
}) => {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-900 text-white font-bold text-[11px] uppercase tracking-wider border-b border-neutral-800">
              <th className="py-3 px-3 w-12 text-center">STT</th>
              <th className="py-3 px-3 min-w-[130px]">Mã Linh Kiện</th>
              <th className="py-3 px-3 min-w-[200px]">Tên Linh Kiện & Model</th>
              <th className="py-3 px-3 text-center min-w-[110px] bg-purple-900/50">
                <span className="block text-purple-200">Số Phiếu Chờ</span>
                <span className="text-[10px] text-purple-300/80 font-normal">Chưa hoàn tất</span>
              </th>
              <th className="py-3 px-3 text-center min-w-[110px] bg-amber-900/50">
                <span className="block text-amber-200">SL Đang Đặt</span>
                <span className="text-[10px] text-amber-300/80 font-normal">Nợ khách</span>
              </th>
              <th className="py-3 px-3 text-center min-w-[180px]">
                <span className="block">Phân Bổ Theo Tiến Độ</span>
                <span className="text-[10px] text-indigo-300/80 font-normal">B1+B2a / B2 / B3+B4 / B5</span>
              </th>
              <th className="py-3 px-3 min-w-[160px]">Gợi Ý Phân Bổ / Xin Thêm</th>
              <th className="py-3 px-3 text-center min-w-[130px]">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {groups.map((group, idx) => {
              const isSelected = selectedDuplicatePartKey === group.key;
              const rowIndex = startIndex + idx + 1;

              return (
                <tr
                  key={group.key}
                  className={`hover:bg-purple-50/40 transition-colors ${
                    isSelected ? 'bg-purple-100/50 ring-1 ring-purple-400' : idx % 2 === 1 ? 'bg-neutral-50/50' : 'bg-white'
                  }`}
                >
                  {/* STT */}
                  <td className="py-3 px-3 text-center font-bold text-neutral-500">
                    #{rowIndex}
                  </td>

                  {/* Mã LK */}
                  <td className="py-3 px-3">
                    {group.partCode && group.partCode !== 'N/A' ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-neutral-900 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded text-xs">
                          {group.partCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => onCopy(group.partCode, `matrix-code-${group.key}`, 'Mã LK')}
                          className="text-neutral-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                          title="Sao chép mã linh kiện"
                        >
                          {copiedId === `matrix-code-${group.key}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={GCSM_STOCK_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 p-0.5"
                          title="Check tồn kho GCSM"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-neutral-400 italic">Chưa có mã</span>
                    )}
                  </td>

                  {/* Tên LK & Model */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-neutral-900 leading-snug">
                      {group.partName}
                    </div>
                    {group.model && (
                      <span className="inline-block mt-0.5 text-[11px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                        {group.model}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {group.hasCallHold && (
                        <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <PhoneCall className="w-3 h-3 text-blue-600" />
                          <span>Gọi giữ</span>
                        </span>
                      )}
                      {group.hasSvdKeep && (
                        <span className="text-[10px] font-bold text-fuchsia-900 bg-fuchsia-50 border border-fuchsia-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3 text-fuchsia-600" />
                          <span>SVD</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Số Phiếu Chờ (Active Tickets Count) */}
                  <td className="py-3 px-3 text-center bg-purple-50/40">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-black border ${
                        group.activeCount >= 2
                          ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                          : group.activeCount === 1
                          ? 'bg-purple-100 text-purple-900 border-purple-300 font-bold'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                      }`}
                    >
                      {group.activeCount} phiếu
                    </span>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      Tổng {group.ticketCount} lượt đặt
                    </div>
                  </td>

                  {/* Tổng SL Đang Đặt (Active Quantity) */}
                  <td className="py-3 px-3 text-center bg-amber-50/40">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-black border ${
                        group.activeQuantity > 0
                          ? 'bg-amber-500 text-amber-950 border-amber-600 shadow-2xs'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                      }`}
                    >
                      {group.activeQuantity} cái
                    </span>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      Tổng: {group.totalQuantity} cái
                    </div>
                  </td>

                  {/* Phân Bổ Theo Tiến Độ (Pills breakdown) */}
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {/* Cần xin GCSM: B1 + B2a */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          group.neededToRequestQty > 0
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                        }`}
                        title="Bước 1 + Bước 2a: Cần tạo xin trên GCSM"
                      >
                        Cần xin: {group.neededToRequestQty}
                      </span>

                      {/* Đang chờ cấp: B2 */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          group.requestedWaitingQty > 0
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                        }`}
                        title="Bước 2: Đã gửi yêu cầu, đang chờ trung tâm cấp về kho"
                      >
                        Chờ cấp: {group.requestedWaitingQty}
                      </span>

                      {/* Đã về kho: B3 + B4 */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          group.stockedWaitingCustomerQty > 0
                            ? 'bg-purple-100 text-purple-900 border-purple-300'
                            : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                        }`}
                        title="Bước 3 + Bước 4: Linh kiện đã về kho, đang chờ khách lên thay"
                      >
                        Ở kho: {group.stockedWaitingCustomerQty}
                      </span>

                      {/* Đã xong: B5 */}
                      {group.completedQuantity > 0 && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-200"
                          title="Bước 5: Khách đã lên nhận máy và hoàn tất"
                        >
                          Xong: {group.completedQuantity}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Gợi Ý Phân Bổ / Xin Thêm */}
                  <td className="py-3 px-3">
                    {group.neededToRequestQty > 0 ? (
                      <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 p-1.5 rounded-lg leading-tight">
                        ⚠️ Cần đặt thêm <strong>{group.neededToRequestQty} cái</strong> trên GCSM
                      </div>
                    ) : group.stockedWaitingCustomerQty > 0 ? (
                      <div className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 p-1.5 rounded-lg leading-tight">
                        📦 Đã có <strong>{group.stockedWaitingCustomerQty} cái</strong> tại kho, ưu tiên gọi khách sớm nhất
                      </div>
                    ) : group.requestedWaitingQty > 0 ? (
                      <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 p-1.5 rounded-lg leading-tight">
                        ⏳ Đang đợi trung tâm giao {group.requestedWaitingQty} cái về kho
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg leading-tight">
                        ✓ Đã hoàn tất toàn bộ {group.completedCount} phiếu
                      </div>
                    )}
                  </td>

                  {/* Thao Tác */}
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectDuplicatePartKey(group.key);
                          onCloseModal();
                          onShowToast(`Đang lọc ${group.ticketCount} phiếu đặt linh kiện "${group.partName}"`, 'info');
                        }}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                        title="Lọc xem riêng danh sách các phiếu này trên giao diện chính"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lọc Phiếu</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const textToCopy = `${group.partCode !== 'N/A' ? `[${group.partCode}] ` : ''}${group.partName} - ${group.model}: Cần xin ${group.neededToRequestQty > 0 ? group.neededToRequestQty : group.activeQuantity} cái`;
                          onCopy(textToCopy, `row-copy-${group.key}`, 'Đã chép thông tin đặt LK');
                        }}
                        className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition-colors cursor-pointer"
                        title="Sao chép thông tin xin linh kiện"
                      >
                        {copiedId === `row-copy-${group.key}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
