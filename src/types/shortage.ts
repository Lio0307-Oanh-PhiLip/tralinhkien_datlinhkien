export type ShortageStatus =
  | 'da_tao_phieu'        // 1. Đã tạo phiếu chờ
  | 'chua_xin_du_lk'      // 2a. Chưa xin đủ LK (kéo lên trước 2. Đã xin LK)
  | 'da_xin_lk'           // 2. Đã xin đủ linh kiện
  | 'nhap_kho_chua_du_lk' // 3a. Nhập kho chưa đủ LK (tất cả LK đã xin, 1/nhiều LK đã về kho nhưng chưa đủ 100%)
  | 'da_nhap_kho'         // 3. Linh kiện đã nhập kho
  | 'da_goi_kh'           // 4. Đã gọi khách hàng báo có Linh Kiện
  | 'da_hoan_tat'        // 5. Khách đã lên (Kỹ thuật đã xử lý)
  | 'da_bo_mau';         // 6. Linh kiện bỏ mẫu (Hoàn tất)

export type ShortageCallSubStatus =
  | 'hen_ngay'           // 1. Gọi khách hẹn ngày/giờ khách lên
  | 'khong_nghe_may'     // 2. Gọi khách không nghe máy, máy bận
  | 'cho_them_thoi_gian' // 3. Gọi khách báo chờ thêm thời gian do đi công tác
  | 'khach_bao_huy';     // 4. Gọi khách báo hủy không đặt nữa/ không thay

export const SHORTAGE_CALL_SUBSTATUS_CONFIG: Record<
  ShortageCallSubStatus,
  {
    label: string;
    shortLabel: string;
    badgeBg: string;
    textColor: string;
    borderColor: string;
    description: string;
  }
> = {
  hen_ngay: {
    label: 'Hẹn ngày/giờ khách lên',
    shortLabel: 'Hẹn ngày lên',
    badgeBg: 'bg-neutral-100',
    textColor: 'text-neutral-900',
    borderColor: 'border-neutral-300',
    description: 'Khách đã chốt ngày giờ cụ thể mang máy lên trung tâm',
  },
  khong_nghe_may: {
    label: 'Không nghe máy / Máy bận',
    shortLabel: 'K.Nghe máy/Bận',
    badgeBg: 'bg-neutral-100',
    textColor: 'text-neutral-800',
    borderColor: 'border-neutral-300',
    description: 'Đã liên hệ nhưng khách không bắt máy hoặc máy bận',
  },
  cho_them_thoi_gian: {
    label: 'Báo chờ thêm thời gian (Đi công tác...)',
    shortLabel: 'Chờ thêm (Công tác)',
    badgeBg: 'bg-neutral-100',
    textColor: 'text-neutral-800',
    borderColor: 'border-neutral-300',
    description: 'Khách hàng đi công tác hoặc cần thời gian sắp xếp',
  },
  khach_bao_huy: {
    label: 'Báo hủy / Không thay',
    shortLabel: 'Báo hủy/Không thay',
    badgeBg: 'bg-rose-50',
    textColor: 'text-rose-800',
    borderColor: 'border-rose-200',
    description: 'Khách hàng đổi ý không muốn đặt nữa hoặc không thay linh kiện',
  },
};

export interface ShortageHistoryEntry {
  status: ShortageStatus;
  timestamp: string; // ISO or formatted
  note?: string;
}

export interface ShortagePartSubItem {
  id: string;
  partCode: string;
  partName: string;
  model?: string;
  quantity?: number; // Số lượng linh kiện cần đặt/xin (Mặc định: 1, Tối thiểu: 1)
  isRequested?: boolean; // Tích chọn: true nếu linh kiện này ĐÃ ĐƯỢC XIN (đã xin đủ), false nếu CHƯA xin
  requestedQuantity?: number; // Số lượng linh kiện ĐÃ XIN (0 <= requestedQuantity <= quantity)
  isStockedIn?: boolean; // Tích chọn: true nếu linh kiện này ĐÃ NHẬN / VỀ KHO (đã nhận đủ), false nếu CHƯA NHẬN
  stockedInQuantity?: number; // Số lượng linh kiện ĐÃ NHẬN / VỀ KHO (0 <= stockedInQuantity <= quantity)
  stockedInDate?: string; // Thời gian / Ngày nhận linh kiện này về kho (VD: 24/08/2026 09:30)
}

export interface CustomerCallLog {
  id: string;
  calledDate: string;           // Thời gian gọi (VD: 29/08/2026 16:22)
  subStatus: ShortageCallSubStatus; // Kết quả cuộc gọi
  appointmentDate?: string;     // Ngày/giờ hẹn nếu có (VD: 05/09/2026 16:00)
  note?: string;                // Ghi chú chi tiết cuộc gọi
  callerName?: string;          // Tên KTV / nhân viên gọi
  createdAt?: string;           // Timestamp tạo bản ghi
}

export interface ShortageBookingItem {
  id: string;
  ticketNumber: string;        // Số phiếu đặt chờ (VD: PC-2608-001 hoặc số phiếu GCSM)
  partCode: string;            // Mã linh kiện chính (VD: 621033000403)
  partName: string;            // Tên linh kiện chính (VD: Nắp pin Find X8 Pro)
  model?: string;              // Model máy (VD: Find X8 Pro)
  quantity?: number;           // Số lượng linh kiện chính
  requestedQuantity?: number;  // Số lượng đã xin của linh kiện chính
  stockedInQuantity?: number;  // Số lượng đã nhận về kho của linh kiện chính
  partsList?: ShortagePartSubItem[]; // Danh sách linh kiện chi tiết cần xin cho phiếu này
  bookingDate: string;         // Thời gian đặt chờ ngày/tháng/năm (VD: 19/08/2026)
  requestedDate?: string;      // Tiến độ 2: Thời gian / Ngày xin linh kiện (VD: 19/08/2026 09:15)
  customerName: string;        // Tên khách hàng (VD: Nguyễn Văn A)
  customerPhone: string;       // Số điện thoại (VD: 0901234567)
  status: ShortageStatus;      // Trạng thái hiện tại
  location?: string;           // Vị trí kệ khi đã nhập kho (VD: A-01)
  stockedInDate?: string;      // Thời gian / Ngày linh kiện nhập kho (VD: 19/08/2026 10:15)
  calledCustomerDate?: string; // Thời gian / Ngày gọi khách hàng báo có LK (lần gần nhất)
  callSubStatus?: ShortageCallSubStatus; // Trạng thái cuộc gọi chi tiết (lần gần nhất)
  appointmentDate?: string;   // Ngày/giờ hẹn khách lên (VD: 2026-08-28 14:00)
  callNote?: string;          // Ghi chú cuộc gọi (lần gần nhất)
  callLogs?: CustomerCallLog[]; // Danh sách lịch sử các lần gọi khách hàng
  customerArrivedDate?: string;// Tiến độ 5: Thời gian khách lên / hoàn tất xử lý (VD: 19/08/2026 15:45)
  creatorTechnician?: string;  // Kỹ thuật tạo phiếu (Tên + ID KTV tạo phiếu, VD: VÕ TẤN ĐẠT (KTV01))
  technicianName?: string;     // Tiến độ 5: Tên kỹ thuật viên tiếp nhận & đã xử lý (VD: Nguyễn Văn Kỹ Thuật)
  note?: string;               // Ghi chú chi tiết
  cancelRequested?: boolean;   // Đánh dấu nhân viên yêu cầu hủy / xóa phiếu
  cancelReason?: string;       // Lý do xin hủy phiếu
  cancelRequestedBy?: string;  // Tên nhân viên xin hủy
  cancelRequestedAt?: string;  // Thời gian gửi yêu cầu
  editRequested?: boolean;     // Đánh dấu nhân viên yêu cầu sửa thông tin phiếu (chờ admin duyệt)
  editReason?: string;         // Lý do yêu cầu sửa
  editRequestedBy?: string;    // Tên nhân viên yêu cầu sửa
  editRequestedAt?: string;    // Thời gian yêu cầu sửa
  pendingEditData?: Partial<ShortageBookingItem>; // Dữ liệu đề xuất sửa đổi chờ admin duyệt
  customerKeepsPart?: boolean; // Khách giữ linh kiện cũ mang về (SVD)
  isCustomerCallHold?: boolean;// Khách gọi điện thoại đặt giữ linh kiện trước (chưa gửi máy)
  hasAvailableParts?: boolean; // Tình trạng linh kiện: true = có sẵn tại kho (nhảy bước 3), false = chưa có (bắt đầu bước 1)
  step2Extended?: boolean;     // Xác nhận tiếp tục chờ linh kiện ở Bước 2
  step2ExtendedAt?: string;    // Thời gian xác nhận tiếp tục chờ linh kiện ở Bước 2
  isCompletedWithoutRepair?: boolean; // Đóng hoàn tất phiếu nhưng khách không thay (hoặc quá 7 ngày)
  closureReason?: string;      // Lý do đóng hoàn tất phiếu (VD: Khách không lên, Quá hạn 7 ngày,...)
  closureNote?: string;        // Ghi chú đóng hoàn tất chi tiết
  closureBy?: string;          // Nhân viên / KTV thực hiện đóng hoàn tất
  createdAt: string;           // Thời gian tạo
  updatedAt: string;           // Thời gian cập nhật
  history?: ShortageHistoryEntry[];
  createdBy?: string;
  createdByUid?: string;
}

export const GCSM_SHORTAGE_URL = 'https://oln-cs.myoppo.com/main/#/index';
export const GCSM_STOCK_URL = 'https://gcsm-sg.oppoit.com/part/stocks/stock-query';
export const GCSM_SHORTAGE_REGISTER_URL = 'https://gcsm-sg.oppoit.com/part/part-shortage-register';

export const SHORTAGE_STATUS_CONFIG: Record<
  ShortageStatus,
  {
    label: string;
    step: number;
    badgeBg: string;
    badgeText: string;
    borderColor: string;
    iconColor: string;
    description: string;
  }
> = {
  da_tao_phieu: {
    label: '1. Đã tạo phiếu',
    step: 1,
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300 font-semibold',
    badgeText: 'text-slate-800',
    borderColor: 'border-slate-300',
    iconColor: 'text-slate-600',
    description: 'Phiếu đã được ghi nhận trên hệ thống',
  },
  chua_xin_du_lk: {
    label: '2a. Chưa xin đủ LK',
    step: 2,
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    badgeText: 'text-amber-900',
    borderColor: 'border-amber-400',
    iconColor: 'text-amber-700',
    description: 'Khách cần nhiều LK nhưng mới xin được 1 phần / Chưa xin đủ',
  },
  da_xin_lk: {
    label: '2. Đã xin LK',
    step: 2,
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    badgeText: 'text-emerald-900',
    borderColor: 'border-emerald-400',
    iconColor: 'text-emerald-700',
    description: 'Đã gửi yêu cầu cấp đủ 100% linh kiện lên trung tâm',
  },
  nhap_kho_chua_du_lk: {
    label: '3a. Nhập kho chưa đủ LK',
    step: 3,
    badgeBg: 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold',
    badgeText: 'text-cyan-900',
    borderColor: 'border-cyan-400',
    iconColor: 'text-cyan-700',
    description: 'Phiếu có nhiều LK, tất cả đã xin, 1 hoặc nhiều LK đã về kho nhưng chưa đủ hết tất cả LK',
  },
  da_nhap_kho: {
    label: '3. Linh kiện đã nhập kho',
    step: 3,
    badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold',
    badgeText: 'text-indigo-900',
    borderColor: 'border-indigo-400',
    iconColor: 'text-indigo-700',
    description: 'Linh kiện đã về đủ 100% về kho, cần liên hệ khách gấp',
  },
  da_goi_kh: {
    label: '4. Đã gọi khách báo có LK',
    step: 4,
    badgeBg: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
    badgeText: 'text-blue-900',
    borderColor: 'border-blue-400',
    iconColor: 'text-blue-700',
    description: 'Đã thông báo cho khách hàng mang máy đến thay',
  },
  da_hoan_tat: {
    label: '5. Khách đã lên (Kỹ thuật đã xử lý)',
    step: 5,
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    badgeText: 'text-emerald-900',
    borderColor: 'border-emerald-400',
    iconColor: 'text-emerald-700',
    description: 'Khách hàng đã lên nhận máy và kỹ thuật viên đã hoàn tất xử lý',
  },
  da_bo_mau: {
    label: '6. Linh kiện bỏ mẫu (Đóng phiếu)',
    step: 6,
    badgeBg: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
    badgeText: 'text-rose-900',
    borderColor: 'border-rose-400',
    iconColor: 'text-rose-700',
    description: 'Linh kiện không còn cung cấp, phiếu đã được đóng',
  },
};

export interface DuplicatePartTicketItem {
  ticket: ShortageBookingItem;
  partQuantity: number;
  partModel?: string;
  partCode?: string;
  partName?: string;
  isPartStocked?: boolean;   // Linh kiện này đã nhận / về kho (kể cả trong phiếu ở bước 2a hoặc các bước khác)
  isPartRequested?: boolean; // Linh kiện này đã được xin trên GCSM
}

export interface DuplicatePartGroup {
  key: string;
  partCode: string;
  partName: string;
  model: string;
  totalQuantity: number;             // Tổng tất cả SL linh kiện (bao gồm cả phiếu đã xong)
  ticketCount: number;               // Tổng số phiếu liên quan
  tickets: DuplicatePartTicketItem[];// Toàn bộ danh sách phiếu
  statusBreakdown: Record<string, number>;
  activeCount: number;               // Số phiếu chưa hoàn tất (bước 1 -> 4, khách chưa lên)
  completedCount: number;            // Số phiếu đã hoàn tất (bước 5)
  activeQuantity: number;            // Tổng SL linh kiện khách chưa lên thay (đang nợ khách ở bước 1 -> 4)
  completedQuantity: number;         // Tổng SL linh kiện đã hoàn tất ở bước 5
  neededToRequestQty: number;        // Số lượng cần tạo xin thêm GCSM (Bước 1: da_tao_phieu + Bước 2a: chua_xin_du_lk)
  requestedWaitingQty: number;       // Số lượng đã gửi xin chờ cấp về kho (Bước 2: da_xin_lk)
  stockedWaitingCustomerQty: number; // Số lượng đã về kho chờ khách lên thay (Bước 3: da_nhap_kho + Bước 4: da_goi_kh)
  activeTickets: DuplicatePartTicketItem[]; // Danh sách các phiếu chưa hoàn tất
  isPendingDuplicate: boolean;       // Có từ 2 phiếu CHƯA HOÀN TẤT trở lên đặt trùng
  hasCallHold: boolean;
  hasSvdKeep: boolean;
}

