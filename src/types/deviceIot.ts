export type DeviceIotFlowType = 'direct_exchange' | 'request_device' | 'customer_loan';

export type DeviceIotStatus =
  | 'co_san_may'    // Có sẵn máy (Đổi trực tiếp) - quy trình direct_exchange
  | 'cho_xin_may'   // 1. Chờ xin máy - quy trình request_device
  | 'da_xin_may'    // 2. Đã xin máy
  | 'da_nhap_kho'   // 3. Đã nhập kho
  | 'da_goi_kh'     // 4. Đã gọi khách lên
  | 'da_hoan_tat'   // 5. Khách đã lên (Hoàn thành)
  | 'dang_muon'     // Khách đang mượn máy - quy trình customer_loan
  | 'da_tra';       // Khách đã trả máy - quy trình customer_loan

export type DeviceIotCategory = 'phone' | 'pad' | 'watch' | 'audio' | 'iot' | 'accessory' | 'other';

export type DeviceIotCallSubStatus =
  | 'hen_ngay'           // 1. Hẹn ngày/giờ khách lên
  | 'khong_nghe_may'     // 2. Không nghe máy / Máy bận
  | 'cho_them_thoi_gian' // 3. Báo chờ thêm thời gian
  | 'khach_bao_huy';     // 4. Báo hủy không đổi/nhận nữa

export interface DeviceIotCallLog {
  id: string;
  calledDate: string;                 // Thời gian gọi (VD: 29/08/2026 16:22)
  subStatus: DeviceIotCallSubStatus;  // Kết quả cuộc gọi
  appointmentDate?: string;          // Ngày/giờ hẹn khách lên
  note?: string;                     // Ghi chú cuộc gọi
  callerName?: string;               // Tên KTV / nhân viên gọi
  createdAt?: string;                // Timestamp tạo bản ghi
}

export interface DeviceIotHistoryEntry {
  status: DeviceIotStatus;
  timestamp: string;
  note?: string;
  user?: string;
}

export interface DeviceIotBookingItem {
  id: string;
  ticketNumber: string;               // Số phiếu (VD: VN001021-AS2608290003 hoặc DM-2608-001)
  customerName: string;               // Tên Khách hàng
  customerPhone: string;              // Số điện thoại
  deviceModel: string;                // Model máy (VD: RENO 3 PRO, Find X8 Pro, CPH2551...)
  deviceName: string;                 // Tên máy (VD: OPPO Reno 3 Pro Đen, Find X8 Pro 5G...)
  skuCode?: string;                   // Mã SKU
  imeiOrIot: string;                  // Imei máy ( or IOT )
  deviceCategory?: DeviceIotCategory; // Phân loại: Điện thoại, Máy tính bảng, Smartwatch, Tai nghe, IOT...
  flowType: DeviceIotFlowType;        // 'direct_exchange' | 'request_device' | 'customer_loan'
  status: DeviceIotStatus;            // Trạng thái hiện tại
  
  bookingDate: string;                // Ngày tiếp nhận phiếu (VD: 29/08/2026)
  requestedDate?: string;             // Ngày xin máy
  stockedInDate?: string;             // Ngày máy nhập kho
  location?: string;                  // Vị trí tủ / kệ lưu máy & IOT (VD: Tủ A-01, Kệ Đổi Máy)
  
  // Thông tin máy khách mượn (Customer Loan Fields)
  hasDeposit?: boolean;               // Có cọc hay không (true/false)
  depositType?: 'khong_coc' | 'co_coc' | 'giu_giay_to'; // Phân loại cọc: Không cọc | Có cọc | Giữ giấy tờ
  depositAmount?: number | string;    // Số tiền cọc nếu có (VD: 1.000.000đ)
  borrowedDate?: string;              // Thời gian khách đã mượn (VD: 29/8/2026 ; 9H13)
  returnedDate?: string;              // Thời gian khách đã trả (VD: 30/8/2026 ; 15H30)
  loanHandoverBy?: string;            // KTV bàn giao máy mượn
  loanReceivedBy?: string;            // KTV nhận máy hoàn trả
  loanCondition?: string;             // Tình trạng máy khi cho mượn (màn đẹp, sườn trầy nhẹ...)
  loanAccessories?: string;           // Phụ kiện đi kèm (Củ sạc, cáp sạc, ốp lưng...)
  citizenId?: string;                 // Số CMND/CCCD của Bên B
  fileNumber?: string;                // Số Hồ Sơ
  repairModel?: string;               // Model máy gửi sửa
  repairColor?: string;               // Màu sắc máy gửi sửa
  repairSn?: string;                  // S/N máy gửi sửa
  repairImei?: string;                // IMEI máy gửi sửa
  repairDate?: string;                // Ngày gửi sửa
  repairDays?: string;                // Số ngày dự kiến sửa
  loanDevicePrice?: string;           // Giá máy mượn
  depositAmountInWords?: string;      // Số tiền cọc bằng chữ
  paymentMethod?: string;             // Phương thức thanh toán
  warrantyCenterName?: string;        // Tên trung tâm bảo hành bên A được chọn
  warrantyCenterPhone?: string;       // SĐT trung tâm bảo hành bên A được chọn

  calledCustomerDate?: string;        // Ngày gọi khách hàng (lần gần nhất)
  callSubStatus?: DeviceIotCallSubStatus; // Trạng thái cuộc gọi chi tiết (lần gần nhất)
  appointmentDate?: string;          // Ngày/giờ hẹn khách lên
  callNote?: string;                 // Ghi chú cuộc gọi (lần gần nhất)
  callLogs?: DeviceIotCallLog[];     // Danh sách lịch sử các lần gọi khách hàng
  
  customerArrivedDate?: string;       // Ngày khách lên nhận / hoàn thành
  technicianName?: string;            // Nhân viên / KTV xử lý
  
  note?: string;                      // Ghi chú thêm
  isCompletedWithoutExchange?: boolean; // Đóng hoàn tất nhưng không đổi máy (khách hủy, quá hạn...)
  closureReason?: string;
  closureNote?: string;
  closureBy?: string;

  // Yêu cầu xóa / hủy phiếu từ User (User requests deletion from Admin)
  cancelRequested?: boolean;          // Đang có yêu cầu xóa / hủy phiếu
  cancelReason?: string;             // Lý do yêu cầu xóa / hủy
  cancelRequestedBy?: string;        // Tên nhân viên gửi yêu cầu xóa
  cancelRequestedAt?: string;        // Thời gian gửi yêu cầu xóa
  
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByUid?: string;
  creatorTechnician?: string; // Kỹ thuật tạo phiếu
  history?: DeviceIotHistoryEntry[];
}

export const DEVICE_IOT_CATEGORY_CONFIG: Record<
  DeviceIotCategory,
  { label: string; iconName: string; badgeClass: string }
> = {
  phone: { label: 'Điện Thoại', iconName: 'Smartphone', badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  pad: { label: 'Máy Tính Bảng (Pad)', iconName: 'Tablet', badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  watch: { label: 'Đồng Hồ / Vòng Đeo', iconName: 'Watch', badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  audio: { label: 'Tai Nghe / Loa', iconName: 'Headphones', badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  iot: { label: 'Thiết Bị IOT', iconName: 'Radio', badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  accessory: { label: 'Phụ Kiện', iconName: 'Cable', badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  other: { label: 'Khác', iconName: 'Boxes', badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
};

export const DEVICE_IOT_FLOW_CONFIG: Record<
  DeviceIotFlowType,
  { label: string; shortLabel: string; badgeClass: string; description: string }
> = {
  direct_exchange: {
    label: 'Có sẵn máy / IOT - Đổi trực tiếp',
    shortLabel: 'Có sẵn - Đổi trực tiếp',
    badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300 font-semibold',
    description: 'Có sẵn máy tại TTBH -> Đổi trực tiếp -> Gọi khách lên -> Khách đã lên (Hoàn thành)',
  },
  request_device: {
    label: 'Chờ xin máy / IOT - Quy trình xin máy',
    shortLabel: 'Chờ xin máy / IOT',
    badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300 font-semibold',
    description: 'Chờ xin máy -> Đã xin -> Nhập kho -> Gọi khách lên -> Khách đã lên (Hoàn thành)',
  },
  customer_loan: {
    label: 'Máy Khách Mượn (Máy Tạm Bảo Hành)',
    shortLabel: 'Máy Khách Mượn',
    badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300 font-semibold',
    description: 'Bàn giao máy mượn: Khách đang mượn -> Khách đã trả máy (Hoàn tất)',
  },
};

export const DEVICE_IOT_STATUS_CONFIG: Record<
  DeviceIotStatus,
  {
    label: string;
    step: number;
    badgeBg: string;
    badgeText: string;
    borderColor: string;
    description: string;
  }
> = {
  co_san_may: {
    label: '1. Có sẵn máy (Đổi trực tiếp)',
    step: 1,
    badgeBg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
    badgeText: 'text-neutral-800',
    borderColor: 'border-neutral-400',
    description: 'Máy/IOT đã có sẵn tại TTBH để đổi trực tiếp cho khách',
  },
  cho_xin_may: {
    label: '1. Chờ xin máy',
    step: 1,
    badgeBg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
    badgeText: 'text-neutral-800',
    borderColor: 'border-neutral-400',
    description: 'Phiếu đã tạo, đang chờ bộ phận liên quan gửi đơn xin máy/IOT',
  },
  da_xin_may: {
    label: '2. Đã xin máy',
    step: 2,
    badgeBg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
    badgeText: 'text-neutral-800',
    borderColor: 'border-neutral-400',
    description: 'Đã gửi yêu cầu xin máy/IOT lên hệ thống',
  },
  da_nhap_kho: {
    label: '3. Nhập kho',
    step: 3,
    badgeBg: 'bg-slate-100 text-slate-900 border-slate-300 font-semibold',
    badgeText: 'text-slate-900',
    borderColor: 'border-slate-400',
    description: 'Máy/IOT đã được vận chuyển về TTBH và nhập vào tủ/kệ lưu trữ',
  },
  da_goi_kh: {
    label: '4. Gọi khách lên',
    step: 4,
    badgeBg: 'bg-teal-50 text-teal-900 border-teal-200',
    badgeText: 'text-teal-900',
    borderColor: 'border-teal-400',
    description: 'Đã liên hệ với khách hàng để thông báo máy/IOT đã sẵn sàng',
  },
  da_hoan_tat: {
    label: '5. Khách đã lên (Hoàn thành)',
    step: 5,
    badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    badgeText: 'text-emerald-900',
    borderColor: 'border-emerald-400',
    description: 'Khách hàng đã đến nhận máy/IOT, hoàn tất thủ tục bàn giao',
  },
  dang_muon: {
    label: 'Đang mượn máy',
    step: 1,
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-300',
    badgeText: 'text-amber-900',
    borderColor: 'border-amber-400',
    description: 'Khách hàng đang mượn máy tạm để sử dụng trong lúc sửa chữa',
  },
  da_tra: {
    label: 'Khách đã trả máy (Hoàn thành)',
    step: 2,
    badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    badgeText: 'text-emerald-900',
    borderColor: 'border-emerald-400',
    description: 'Khách hàng đã hoàn trả lại máy mượn nguyên vẹn, nhận lại tiền cọc (nếu có)',
  },
};
