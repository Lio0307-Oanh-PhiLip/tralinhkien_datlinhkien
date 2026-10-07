export interface TechnicianItem {
  id: string; // Unique ID (e.g. tech-ktv01, or UUID)
  techId: string; // Mã / ID kỹ thuật (VD: KTV01, KTV02, CX01, ADMIN)
  name: string; // Tên kỹ thuật viên (VD: VÕ TẤN ĐẠT, CX Huy, CX Khả)
  phone?: string; // Số điện thoại liên hệ
  department?: string; // Bộ phận / Chi nhánh (VD: Kỹ thuật phần cứng, HCM4, CS...)
  status: 'active' | 'pending' | 'rejected'; // active = Đã duyệt, pending = Chờ Admin duyệt, rejected = Từ chối
  requestedBy?: string; // Người gửi yêu cầu (nếu nhân viên gửi)
  requestedAt?: string; // Thời gian gửi yêu cầu
  approvedBy?: string; // Admin đã phê duyệt
  approvedAt?: string; // Thời gian phê duyệt
  note?: string; // Ghi chú thêm
  createdAt: string; // Ngày tạo ISO
  updatedAt: string; // Ngày cập nhật ISO
}

export const DEFAULT_INITIAL_TECHNICIANS: TechnicianItem[] = [];
