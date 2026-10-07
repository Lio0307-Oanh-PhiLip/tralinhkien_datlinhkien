import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import {
  ShortageBookingItem,
  ShortageStatus,
  SHORTAGE_STATUS_CONFIG,
  SHORTAGE_CALL_SUBSTATUS_CONFIG,
  GCSM_SHORTAGE_URL,
  ShortagePartSubItem,
} from '../types/shortage';
import { LabelItem } from '../types/label';

export const INITIAL_SHORTAGE_DATA: ShortageBookingItem[] = [];

export function getTodayDateString(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getCurrentDateTimeString(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export const SHORTAGE_CLOSURE_REASONS = [
  { id: 'khach_doi_y', label: 'Khách đổi ý không thay', shortLabel: 'Khách đổi ý' },
  { id: 'cho_lau_khach_huy', label: 'Thời gian chờ linh kiện lâu khách hủy', shortLabel: 'Chờ lâu khách hủy' },
  { id: 'toan_quoc_con_it_khong_xin_duoc', label: 'Linh kiện toàn quốc còn ít không xin được linh kiện', shortLabel: 'Hết/Ít LK toàn quốc' },
  { id: 'khach_khong_len', label: 'Khách không lên nhận máy / không lên thay linh kiện', shortLabel: 'Khách không lên' },
  { id: 'khach_khong_len_svd', label: 'Kết thúc đợt Ngày Dịch Vụ SVD (10-12) khách không lên thay - Đóng phiếu tránh treo', shortLabel: 'Hết hạn SVD (10-12)' },
  { id: 'khach_tu_choi', label: 'Khách từ chối thay (Đã mua máy mới / sửa nơi khác / không còn nhu cầu)', shortLabel: 'Khách từ chối' },
  { id: 'khong_lien_lac_duoc', label: 'Không liên lạc được với khách (Gọi nhiều lần không nghe máy / Thuê bao)', shortLabel: 'Không nghe máy' },
  { id: 'qua_7_ngay_tu_dong', label: 'Quá hạn 7 ngày từ khi gọi báo có LK - Đóng hoàn tất phiếu', shortLabel: 'Quá hạn 7 ngày' },
  { id: 'khach_chuyen_noi_khac', label: 'Khách chuyển sửa tại trung tâm bảo hành khác', shortLabel: 'Chuyển TTBH khác' },
  { id: 'ly_do_khac', label: 'Lý do khác (Nhập ghi chú chi tiết bên dưới)', shortLabel: 'Lý do khác' },
];

export function parseDateToMillis(dateStr?: string): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  if (!trimmed) return 0;

  // 1. If it's already a numeric timestamp
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // 2. If it's in Vietnamese slash format: DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm or DD/MM/YYYY
  const vnRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/;
  const match = trimmed.match(vnRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hours = match[4] ? parseInt(match[4], 10) : 0;
    const minutes = match[5] ? parseInt(match[5], 10) : 0;
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // 3. Fallback to standard JS Date parsing (ISO, GMT, etc.)
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed.getTime();

  return 0;
}

export function parseVNFormattedDate(str?: string): Date | null {
  if (!str) return null;
  const ms = parseDateToMillis(str);
  if (ms > 0) return new Date(ms);
  return null;
}

export function getTicketCreationTimestamp(item: ShortageBookingItem): number {
  if (!item) return 0;
  // 1. Ưu tiên Ngày đặt chờ / Ngày tạo phiếu nghiệp vụ (bookingDate)
  if (item.bookingDate && item.bookingDate.trim()) {
    const ts = parseDateToMillis(item.bookingDate);
    if (ts > 0) return ts;
  }
  // 2. Kiểm tra lịch sử tạo phiếu (da_tao_phieu hoặc lịch sử đầu tiên)
  if (Array.isArray(item.history) && item.history.length > 0) {
    const createdEntry = item.history.find((h) => h.status === 'da_tao_phieu');
    if (createdEntry?.timestamp) {
      const ts = parseDateToMillis(createdEntry.timestamp);
      if (ts > 0) return ts;
    }
    const firstEntry = item.history[0];
    if (firstEntry?.timestamp) {
      const ts = parseDateToMillis(firstEntry.timestamp);
      if (ts > 0) return ts;
    }
  }
  // 3. Kiểm tra createdAt ISO string
  if (item.createdAt) {
    const ts = parseDateToMillis(item.createdAt);
    if (ts > 0) return ts;
  }
  // 4. Fallback updatedAt
  if (item.updatedAt) {
    const ts = parseDateToMillis(item.updatedAt);
    if (ts > 0) return ts;
  }
  // 5. Kiểm tra ID timestamp nếu có dạng shortage-172...
  if (item.id && item.id.startsWith('shortage-')) {
    const num = parseInt(item.id.replace('shortage-', ''), 10);
    if (!isNaN(num) && num > 1000000000) return num;
  }
  return 0;
}

/**
 * Đánh số thứ tự (STT) chuẩn nghiệp vụ:
 * - Thông tin phiếu tạo trước (sớm nhất về thời gian) sẽ là STT = 1.
 * - Các phiếu tiếp theo lần lượt là 2, 3... N (phiếu mới nhất là N).
 * - Khi hiển thị trên bảng sắp xếp từ Mới nhất xuống Cũ nhất, STT từ trên xuống dưới
 *   sẽ đánh ngược từ N xuống 1 (N, N-1, ..., 2, 1).
 */
export function buildTicketSttMap(bookings: ShortageBookingItem[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(bookings) || bookings.length === 0) return map;

  // Sắp xếp danh sách từ CŨ NHẤT đến MỚI NHẤT (tạo sớm nhất đứng trước = 1, 2, 3... N)
  const sorted = [...bookings].sort((a, b) => {
    // 1. So sánh thời gian tạo thực tế (tạo sớm hơn đứng trước)
    const tA = getTicketCreationTimestamp(a);
    const tB = getTicketCreationTimestamp(b);
    if (tA !== tB) {
      return tA - tB;
    }
    // 2. Nếu cùng thời gian, so sánh số phiếu theo thứ tự tăng dần (BJQL...01 trước BJQL...03)
    const ticketA = (a.ticketNumber || '').trim();
    const ticketB = (b.ticketNumber || '').trim();
    if (ticketA && ticketB && ticketA !== ticketB) {
      return ticketA.localeCompare(ticketB);
    }
    // 3. Cuối cùng so sánh ID
    return (a.id || '').localeCompare(b.id || '');
  });

  sorted.forEach((item, index) => {
    if (item && item.id) {
      map.set(item.id, index + 1);
    }
  });

  return map;
}

export function getDaysSinceCalled(calledDateStr?: string, fallbackIso?: string): number {
  const d = parseVNFormattedDate(calledDateStr) || (fallbackIso ? new Date(fallbackIso) : null);
  if (!d || isNaN(d.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function getFirstCallDate(item: ShortageBookingItem): string | undefined {
  const candidateTimestamps: Array<{ dateStr: string; timestamp: number }> = [];

  // 1. From callLogs (sorted to find the earliest call)
  if (Array.isArray(item.callLogs) && item.callLogs.length > 0) {
    item.callLogs.forEach((log) => {
      if (log.calledDate && log.calledDate.trim()) {
        const d = parseVNFormattedDate(log.calledDate);
        if (d && !isNaN(d.getTime())) {
          candidateTimestamps.push({ dateStr: log.calledDate, timestamp: d.getTime() });
        }
      }
    });
  }

  // 2. From calledCustomerDate
  if (item.calledCustomerDate && item.calledCustomerDate.trim()) {
    const d = parseVNFormattedDate(item.calledCustomerDate);
    if (d && !isNaN(d.getTime())) {
      candidateTimestamps.push({ dateStr: item.calledCustomerDate, timestamp: d.getTime() });
    }
  }

  // 3. From history logs (when status was first moved to da_goi_kh)
  if (Array.isArray(item.history) && item.history.length > 0) {
    item.history.forEach((h) => {
      if (h.status === 'da_goi_kh' && h.timestamp) {
        const d = parseVNFormattedDate(h.timestamp);
        if (d && !isNaN(d.getTime())) {
          candidateTimestamps.push({ dateStr: h.timestamp, timestamp: d.getTime() });
        }
      }
    });
  }

  if (candidateTimestamps.length > 0) {
    candidateTimestamps.sort((a, b) => a.timestamp - b.timestamp);
    return candidateTimestamps[0].dateStr;
  }

  return item.calledCustomerDate;
}

export function checkOverdue7Days(item: ShortageBookingItem): {
  isOverdue: boolean;
  daysPassed: number;
  daysSinceCalled: number;
  firstCallDate?: string;
} {
  if (item.status !== 'da_goi_kh') {
    return { isOverdue: false, daysPassed: 0, daysSinceCalled: 0 };
  }
  const firstCallDate = getFirstCallDate(item) || item.calledCustomerDate;
  const daysPassed = getDaysSinceCalled(firstCallDate, item.updatedAt || item.createdAt);
  return {
    isOverdue: daysPassed >= 7,
    daysPassed,
    daysSinceCalled: daysPassed,
    firstCallDate,
  };
}

export function checkSvdPending1Day(item: ShortageBookingItem): {
  isSvdPendingUrgent: boolean;
  daysPending: number;
} {
  // SVD applies when customerKeepsPart is true (representing SVD booking)
  if (!item.customerKeepsPart) {
    return { isSvdPendingUrgent: false, daysPending: 0 };
  }
  // If the booking is already requested, stocked in, called customer, or completed, it's not pending request
  if (item.status !== 'da_tao_phieu' && item.status !== 'chua_xin_du_lk') {
    return { isSvdPendingUrgent: false, daysPending: 0 };
  }

  // Calculate days since bookingDate or createdAt
  const startDate = parseVNFormattedDate(item.bookingDate) || (item.createdAt ? new Date(item.createdAt) : null);
  if (!startDate || isNaN(startDate.getTime())) {
    return { isSvdPendingUrgent: false, daysPending: 0 };
  }

  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  if (diffMs <= 0) return { isSvdPendingUrgent: false, daysPending: 0 };
  const daysPending = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    isSvdPendingUrgent: daysPending >= 1,
    daysPending,
  };
}

export function checkSvdPending3Days(item: ShortageBookingItem): {
  isSvdPending3Days: boolean;
  daysPending: number;
} {
  const res = checkSvdPending1Day(item);
  return {
    isSvdPending3Days: res.isSvdPendingUrgent,
    daysPending: res.daysPending,
  };
}

export interface SvdMultiDayProgressResult {
  isSvdBooking: boolean;
  hasPartsReady: boolean;
  hasReminder: boolean;
  stage: 'none' | 'before_svd' | 'day_10' | 'day_11' | 'day_12' | 'after_svd_ended';
  title: string;
  message: string;
  actionRecommendation: string;
  badgeBg: string;
  badgeTextColor: string;
  badgeBorderColor: string;
  severity: 'info' | 'warning' | 'urgent';
  currentDayOfMonth: number;
  targetSvdMonth: number;
  targetSvdYear: number;
  isAppliedNextMonth: boolean;
  targetSvdLabel: string;
  suggestedCallNote: string;
  isUrgent: boolean;
}

/**
 * Kiểm tra tiến độ hẹn Ngày Dịch Vụ SVD (ngày 10, 11, 12 hằng tháng) khi đã có linh kiện:
 * - ĐIỀU KIỆN ĐẶC BIỆT: Phiếu tạo sau ngày 12 của tháng (khi đợt SVD tháng đó đã kết thúc)
 *   mặc định áp dụng cho đợt Ngày Dịch Vụ SVD của THÁNG TIẾP THEO (Tháng + 1).
 * - Phiếu tạo từ ngày 1 đến ngày 12: Áp dụng cho đợt SVD của chính tháng đó.
 * - Ngày 10 khách chưa lên -> Nhắc nhở tiếp tục gọi khách vào ngày 11
 * - Ngày 11 khách vẫn chưa lên -> Nhắc nhở tiếp tục gọi vào ngày 12
 * - Kết thúc ngày 12 (ngày 13+ hoặc sau đợt SVD) khách chưa lên -> Nhắc nhở gọi xác nhận và quyết định đóng phiếu hoặc chờ tiếp đợt sau (tránh treo phiếu)
 */
export function checkSvdMultiDayAppointmentProgress(item: ShortageBookingItem): SvdMultiDayProgressResult {
  // 1. Kiểm tra có phải phiếu đặt giữ SVD hoặc hẹn ngày SVD 10-12 hay không
  const isSvdTagged = Boolean(item.customerKeepsPart);
  const appointmentLower = (item.appointmentDate || '').toLowerCase();
  const noteLower = ((item.note || '') + ' ' + (item.callNote || '')).toLowerCase();
  const isSvdAppointment =
    appointmentLower.includes('svd') ||
    appointmentLower.includes('10-12') ||
    appointmentLower.includes('10,11,12') ||
    noteLower.includes('svd') ||
    noteLower.includes('ngày dịch vụ');

  const isSvdBooking = isSvdTagged || isSvdAppointment;

  if (!isSvdBooking) {
    return {
      isSvdBooking: false,
      hasPartsReady: false,
      hasReminder: false,
      stage: 'none',
      title: '',
      message: '',
      actionRecommendation: '',
      badgeBg: '',
      badgeTextColor: '',
      badgeBorderColor: '',
      severity: 'info',
      currentDayOfMonth: 0,
      targetSvdMonth: 0,
      targetSvdYear: 0,
      isAppliedNextMonth: false,
      targetSvdLabel: '',
      suggestedCallNote: '',
      isUrgent: false,
    };
  }

  // 2. Đã hoàn tất hoặc bỏ mẫu thì không còn cần nhắc nhở
  if (item.status === 'da_hoan_tat' || item.status === 'da_bo_mau') {
    return {
      isSvdBooking: true,
      hasPartsReady: true,
      hasReminder: false,
      stage: 'none',
      title: 'Đã hoàn tất xử lý SVD',
      message: 'Khách đã lên và được kỹ thuật viên xử lý hoàn tất.',
      actionRecommendation: 'Hoàn thành',
      badgeBg: 'bg-emerald-50',
      badgeTextColor: 'text-emerald-800',
      badgeBorderColor: 'border-emerald-200',
      severity: 'info',
      currentDayOfMonth: 0,
      targetSvdMonth: 0,
      targetSvdYear: 0,
      isAppliedNextMonth: false,
      targetSvdLabel: '',
      suggestedCallNote: '',
      isUrgent: false,
    };
  }

  // 3. Kiểm tra linh kiện đã sẵn sàng tại kho hoặc đã gọi khách
  const hasPartsReady =
    Boolean(item.hasAvailableParts) ||
    item.status === 'da_nhap_kho' ||
    item.status === 'da_goi_kh';

  // Nếu chưa có linh kiện (đang ở bước 1 hoặc bước 2 chờ xin LK), không kích hoạt chuỗi nhắc ngày 10-11-12 mà theo dõi tiến độ xin LK
  if (!hasPartsReady) {
    return {
      isSvdBooking: true,
      hasPartsReady: false,
      hasReminder: false,
      stage: 'none',
      title: 'Chưa có LK sẵn (Đang chờ xin)',
      message: 'Phiếu đặt giữ SVD đang ở bước xin linh kiện.',
      actionRecommendation: 'Tiến hành xin LK',
      badgeBg: 'bg-amber-50',
      badgeTextColor: 'text-amber-800',
      badgeBorderColor: 'border-amber-200',
      severity: 'info',
      currentDayOfMonth: 0,
      targetSvdMonth: 0,
      targetSvdYear: 0,
      isAppliedNextMonth: false,
      targetSvdLabel: '',
      suggestedCallNote: '',
      isUrgent: false,
    };
  }

  // 4. Xác định thời gian tạo phiếu và tính toán chu kỳ SVD áp dụng chuẩn xác
  const creationMs = getTicketCreationTimestamp(item);
  const creationDate = creationMs > 0 ? new Date(creationMs) : (item.createdAt ? new Date(item.createdAt) : new Date());

  // Kiểm tra nếu phiếu đã từng được nhân viên bấm "Chờ đợt sau" / gia hạn sang đợt tiếp theo
  let latestExtensionDate: Date | null = null;
  if (Array.isArray(item.history)) {
    for (const h of item.history) {
      const note = (h.note || '').toLowerCase();
      if (note.includes('chờ sang đợt ngày dịch vụ svd') || note.includes('đợt tiếp theo') || note.includes('chờ đợt svd sau') || note.includes('chờ đợt sau')) {
        const ms = parseDateToMillis(h.timestamp);
        if (ms > 0) {
          const d = new Date(ms);
          if (!latestExtensionDate || d > latestExtensionDate) {
            latestExtensionDate = d;
          }
        }
      }
    }
  }

  let targetSvdYear: number;
  let targetSvdMonth: number;
  let isAppliedNextMonth = false;

  if (latestExtensionDate) {
    // Nếu có lịch sử gia hạn sang đợt tiếp theo:
    const extDay = latestExtensionDate.getDate();
    const extMonth = latestExtensionDate.getMonth() + 1;
    const extYear = latestExtensionDate.getFullYear();
    let m = extMonth;
    let y = extYear;
    if (extDay > 12) {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    targetSvdMonth = m;
    targetSvdYear = y;
    isAppliedNextMonth = true;
  } else {
    // Tính theo thời gian tạo phiếu (bookingDate / createdAt)
    const createdDay = creationDate.getDate();
    const createdMonth = creationDate.getMonth() + 1; // 1 - 12
    const createdYear = creationDate.getFullYear();

    // QUY TẮC NGHIỆP VỤ SVD:
    // Phiếu tạo SAU ngày SVD (tức là từ ngày 13 trở đi của tháng M)
    // -> Mặc định áp dụng cho đợt SVD của THÁNG TIẾP THEO (Tháng M + 1, 10-12/M+1)!
    // Phiếu tạo từ ngày 1 đến ngày 12 của tháng M
    // -> Áp dụng cho đợt SVD của chính tháng M (10-12/M).
    if (createdDay > 12) {
      let m = createdMonth + 1;
      let y = createdYear;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      targetSvdMonth = m;
      targetSvdYear = y;
      isAppliedNextMonth = true;
    } else {
      targetSvdMonth = createdMonth;
      targetSvdYear = createdYear;
      isAppliedNextMonth = false;
    }
  }

  const targetSvdLabel = `SVD Tháng ${targetSvdMonth} (10-12/${targetSvdMonth})`;

  // 5. So sánh thời gian thực tế hiện tại với chu kỳ Ngày Dịch Vụ SVD mục tiêu
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const isBeforeTargetMonth = currentYear < targetSvdYear || (currentYear === targetSvdYear && currentMonth < targetSvdMonth);
  const isInTargetMonth = currentYear === targetSvdYear && currentMonth === targetSvdMonth;
  const isPastTargetMonth = currentYear > targetSvdYear || (currentYear === targetSvdYear && currentMonth > targetSvdMonth);

  // TRƯỜNG HỢP 1: Hiện tại đang trước tháng diễn ra đợt SVD mục tiêu
  // (Ví dụ: Phiếu tạo 22/09 -> áp dụng SVD Tháng 10. Hiện tại 22-30/09 là trước tháng 10)
  if (isBeforeTargetMonth) {
    return {
      isSvdBooking: true,
      hasPartsReady: true,
      hasReminder: false,
      stage: 'before_svd',
      title: `${targetSvdLabel} - Sẵn sàng LK`,
      message: `Phiếu tạo sau ngày 12 → Mặc định áp dụng cho đợt ${targetSvdLabel}. Linh kiện đã có sẵn tại kho, chờ đến đợt 10-12/${targetSvdMonth} để liên hệ khách.`,
      actionRecommendation: `Áp dụng ${targetSvdLabel}`,
      badgeBg: 'bg-purple-50',
      badgeTextColor: 'text-purple-900',
      badgeBorderColor: 'border-purple-200',
      severity: 'info',
      currentDayOfMonth: currentDay,
      targetSvdMonth,
      targetSvdYear,
      isAppliedNextMonth,
      targetSvdLabel,
      suggestedCallNote: `Khách đặt giữ linh kiện áp dụng đợt ${targetSvdLabel}`,
      isUrgent: false,
    };
  }

  // TRƯỜNG HỢP 2: Đang ở đúng tháng diễn ra đợt SVD mục tiêu (Ví dụ: Tháng 10)
  if (isInTargetMonth) {
    // Trước ngày 10 (Từ ngày 1 đến ngày 9): Chuẩn bị cho đợt SVD
    if (currentDay < 10) {
      const daysLeft = 10 - currentDay;
      return {
        isSvdBooking: true,
        hasPartsReady: true,
        hasReminder: false,
        stage: 'before_svd',
        title: `${targetSvdLabel} sắp tới (Còn ${daysLeft} ngày)`,
        message: `Linh kiện đã sẵn sàng tại kho. Chuẩn bị đợt Ngày Dịch Vụ SVD (ngày 10-12/${currentMonth}). Hiện còn ${daysLeft} ngày đến ngày 10/${currentMonth}.`,
        actionRecommendation: `Chuẩn bị trước ngày 10/${currentMonth}`,
        badgeBg: 'bg-indigo-50',
        badgeTextColor: 'text-indigo-900',
        badgeBorderColor: 'border-indigo-200',
        severity: 'info',
        currentDayOfMonth: currentDay,
        targetSvdMonth,
        targetSvdYear,
        isAppliedNextMonth,
        targetSvdLabel,
        suggestedCallNote: `Gọi báo khách linh kiện SVD đã sẵn sàng trước đợt ngày 10-12/${currentMonth}`,
        isUrgent: false,
      };
    }

    // Ngày 10: Khách chưa lên -> Nhắc nhở tiếp tục gọi vào ngày 11
    if (currentDay === 10) {
      return {
        isSvdBooking: true,
        hasPartsReady: true,
        hasReminder: true,
        stage: 'day_10',
        title: `SVD Ngày 10/${currentMonth}: Khách chưa lên`,
        message: `Ngày 10/${currentMonth} khách chưa lên → Tiếp tục gọi nhắc khách vào ngày 11 (Ngày thứ 2 đợt SVD Tháng ${currentMonth})`,
        actionRecommendation: `Gọi nhắc khách Ngày 11/${currentMonth}`,
        badgeBg: 'bg-amber-50',
        badgeTextColor: 'text-amber-900',
        badgeBorderColor: 'border-amber-300',
        severity: 'warning',
        currentDayOfMonth: currentDay,
        targetSvdMonth,
        targetSvdYear,
        isAppliedNextMonth,
        targetSvdLabel,
        suggestedCallNote: `Gọi nhắc khách SVD Ngày 11/${currentMonth} (sau khi ngày 10 chưa lên)`,
        isUrgent: false,
      };
    }

    // Ngày 11: Khách vẫn chưa lên -> Nhắc nhở tiếp tục gọi vào ngày 12
    if (currentDay === 11) {
      return {
        isSvdBooking: true,
        hasPartsReady: true,
        hasReminder: true,
        stage: 'day_11',
        title: `SVD Ngày 11/${currentMonth}: Khách vẫn chưa lên`,
        message: `Ngày 11/${currentMonth} khách vẫn chưa lên → Tiếp tục nhắc nhở gọi vào ngày 12 (Ngày cuối đợt SVD Tháng ${currentMonth})`,
        actionRecommendation: `Gọi nhắc khách Ngày 12/${currentMonth} (Ngày cuối SVD)`,
        badgeBg: 'bg-orange-50',
        badgeTextColor: 'text-orange-950',
        badgeBorderColor: 'border-orange-300',
        severity: 'warning',
        currentDayOfMonth: currentDay,
        targetSvdMonth,
        targetSvdYear,
        isAppliedNextMonth,
        targetSvdLabel,
        suggestedCallNote: `Gọi nhắc khách SVD Ngày 12/${currentMonth} (ngày cuối đợt SVD sau khi ngày 11 chưa lên)`,
        isUrgent: true,
      };
    }

    // Ngày 12: Ngày cuối đợt SVD khách chưa lên -> Gọi nhắc khách đến trong ngày hôm nay
    if (currentDay === 12) {
      return {
        isSvdBooking: true,
        hasPartsReady: true,
        hasReminder: true,
        stage: 'day_12',
        title: `SVD Ngày 12/${currentMonth}: Ngày cuối đợt SVD`,
        message: `Ngày 12/${currentMonth} (Hôm nay kết thúc đợt SVD) khách chưa lên → Gọi nhắc khách đến trong ngày hôm nay`,
        actionRecommendation: `Gọi nhắc khách đến trong ngày 12/${currentMonth}`,
        badgeBg: 'bg-rose-50',
        badgeTextColor: 'text-rose-900',
        badgeBorderColor: 'border-rose-300',
        severity: 'urgent',
        currentDayOfMonth: currentDay,
        targetSvdMonth,
        targetSvdYear,
        isAppliedNextMonth,
        targetSvdLabel,
        suggestedCallNote: `Gọi nhắc khách đến thay linh kiện trong ngày 12/${currentMonth} (ngày cuối SVD)`,
        isUrgent: true,
      };
    }

    // Kết thúc ngày 12 (Từ ngày 13 trở đi của tháng SVD):
    // Khách chưa lên -> Nhắc nhở gọi xác nhận và quyết định đóng phiếu hoặc chờ tiếp đợt sau
    if (currentDay > 12) {
      return {
        isSvdBooking: true,
        hasPartsReady: true,
        hasReminder: true,
        stage: 'after_svd_ended',
        title: `🚨 Đã kết thúc Ngày Dịch Vụ SVD (10-12/${currentMonth}) khách chưa lên`,
        message: `Kết thúc ngày 12/${currentMonth} khách chưa lên → Nhắc nhở gọi xác nhận với khách và quyết định Đóng phiếu (Khách không thay) hoặc Chờ tiếp đợt sau (tránh treo phiếu trên hệ thống)`,
        actionRecommendation: 'Gọi xác nhận: Đóng phiếu hoặc Chờ tiếp đợt sau',
        badgeBg: 'bg-rose-100',
        badgeTextColor: 'text-rose-950',
        badgeBorderColor: 'border-rose-400',
        severity: 'urgent',
        currentDayOfMonth: currentDay,
        targetSvdMonth,
        targetSvdYear,
        isAppliedNextMonth,
        targetSvdLabel,
        suggestedCallNote: `Gọi xác nhận với khách sau khi kết thúc đợt SVD 10-12/${currentMonth} để quyết định đóng phiếu hoặc chờ đợt sau`,
        isUrgent: true,
      };
    }
  }

  // TRƯỜNG HỢP 3: Hiện tại đã qua tháng diễn ra đợt SVD mục tiêu (Ví dụ: Mục tiêu Tháng 8, hiện tại Tháng 9 trở đi)
  if (isPastTargetMonth) {
    return {
      isSvdBooking: true,
      hasPartsReady: true,
      hasReminder: true,
      stage: 'after_svd_ended',
      title: `🚨 Quá hạn Ngày Dịch Vụ SVD (10-12/${targetSvdMonth}) chưa xử lý`,
      message: `Đợt SVD Tháng ${targetSvdMonth}/${targetSvdYear} đã kết thúc nhưng phiếu chưa được xử lý hoàn tất → Cần gọi xác nhận đóng phiếu hoặc gia hạn sang đợt SVD tiếp theo.`,
      actionRecommendation: 'Đóng phiếu hoặc Gia hạn SVD',
      badgeBg: 'bg-rose-100',
      badgeTextColor: 'text-rose-950',
      badgeBorderColor: 'border-rose-400',
      severity: 'urgent',
      currentDayOfMonth: currentDay,
      targetSvdMonth,
      targetSvdYear,
      isAppliedNextMonth,
      targetSvdLabel,
      suggestedCallNote: `Gọi xác nhận với khách do quá hạn đợt SVD Tháng ${targetSvdMonth}`,
      isUrgent: true,
    };
  }

  return {
    isSvdBooking: true,
    hasPartsReady: true,
    hasReminder: false,
    stage: 'none',
    title: targetSvdLabel,
    message: '',
    actionRecommendation: '',
    badgeBg: 'bg-neutral-50',
    badgeTextColor: 'text-neutral-800',
    badgeBorderColor: 'border-neutral-200',
    severity: 'info',
    currentDayOfMonth: currentDay,
    targetSvdMonth,
    targetSvdYear,
    isAppliedNextMonth,
    targetSvdLabel,
    suggestedCallNote: '',
    isUrgent: false,
  };
}

export function checkStep1AgingWarning(item: ShortageBookingItem): {
  hasWarning: boolean;
  daysPassed: number;
} {
  if (item.status !== 'da_tao_phieu') {
    return { hasWarning: false, daysPassed: 0 };
  }
  const startDate = parseVNFormattedDate(item.bookingDate) || (item.createdAt ? new Date(item.createdAt) : null);
  if (!startDate || isNaN(startDate.getTime())) {
    return { hasWarning: false, daysPassed: 0 };
  }
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  if (diffMs <= 0) return { hasWarning: false, daysPassed: 0 };
  const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return {
    hasWarning: daysPassed >= 2,
    daysPassed,
  };
}

export function checkStep2AgingWarning(item: ShortageBookingItem): {
  hasWarning: boolean;
  warningLevel: number; // 0: no warning, 1: first warning (> 3 days), 2: second warning (> 5 days)
  daysPassed: number;
} {
  if (item.status !== 'da_xin_lk' && item.status !== 'chua_xin_du_lk') {
    return { hasWarning: false, warningLevel: 0, daysPassed: 0 };
  }
  // Try using requestedDate; fallback to bookingDate or createdAt if requestedDate isn't set yet
  const startDate = parseVNFormattedDate(item.requestedDate || item.bookingDate) || (item.createdAt ? new Date(item.createdAt) : null);
  if (!startDate || isNaN(startDate.getTime())) {
    return { hasWarning: false, warningLevel: 0, daysPassed: 0 };
  }
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  if (diffMs <= 0) return { hasWarning: false, warningLevel: 0, daysPassed: 0 };
  const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (item.step2Extended) {
    return {
      hasWarning: daysPassed >= 5,
      warningLevel: daysPassed >= 5 ? 2 : 0,
      daysPassed,
    };
  } else {
    return {
      hasWarning: daysPassed >= 3,
      warningLevel: daysPassed >= 3 ? 1 : 0,
      daysPassed,
    };
  }
}

export function checkStep3AgingWarning(item: ShortageBookingItem): {
  hasWarning: boolean;
  daysPassed: number;
} {
  if (item.status !== 'da_nhap_kho') {
    return { hasWarning: false, daysPassed: 0 };
  }
  const startDate = parseVNFormattedDate(item.stockedInDate) || (item.createdAt ? new Date(item.createdAt) : null);
  if (!startDate || isNaN(startDate.getTime())) {
    return { hasWarning: false, daysPassed: 0 };
  }
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  if (diffMs <= 0) return { hasWarning: false, daysPassed: 0 };
  const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return {
    hasWarning: daysPassed >= 2,
    daysPassed,
  };
}

export function generateShortageTicketNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `PC-${yy}${mm}${dd}-${rand}`;
}

export interface ShortagePartsCalculationResult {
  status: ShortageStatus;
  totalRequiredQty: number;
  totalRequestedQty: number;
  totalStockedQty: number;
  isFullyRequested: boolean;
  isFullyStocked: boolean;
  hasAnyRequested: boolean;
  hasAnyStocked: boolean;
  summaryText: string;
}

/**
 * Normalizes parts list for a booking item, ensuring quantities, requestedQuantity, and stockedInQuantity are well-defined.
 */
export function getNormalizedBookingParts(item: ShortageBookingItem): ShortagePartSubItem[] {
  if (item.partsList && item.partsList.length > 0) {
    return item.partsList.map((p, idx) => {
      const quantity = Math.max(1, p.quantity && !isNaN(Number(p.quantity)) ? Number(p.quantity) : 1);
      
      let requestedQuantity: number;
      if (typeof p.requestedQuantity === 'number' && !isNaN(p.requestedQuantity)) {
        requestedQuantity = Math.max(0, Math.min(quantity, p.requestedQuantity));
      } else if (p.isRequested !== undefined) {
        requestedQuantity = p.isRequested ? quantity : 0;
      } else if (item.status !== 'da_tao_phieu' && item.status !== 'chua_xin_du_lk') {
        requestedQuantity = quantity;
      } else {
        requestedQuantity = 0;
      }

      let stockedInQuantity: number;
      if (typeof p.stockedInQuantity === 'number' && !isNaN(p.stockedInQuantity)) {
        stockedInQuantity = Math.max(0, Math.min(quantity, p.stockedInQuantity));
      } else if (p.isStockedIn !== undefined) {
        stockedInQuantity = p.isStockedIn ? quantity : 0;
      } else if (item.status === 'da_nhap_kho' || item.status === 'da_goi_kh' || item.status === 'da_hoan_tat') {
        stockedInQuantity = quantity;
      } else {
        stockedInQuantity = 0;
      }

      return {
        ...p,
        id: p.id || `part-${item.id}-${idx}`,
        quantity,
        requestedQuantity,
        stockedInQuantity,
        isRequested: requestedQuantity >= quantity,
        isStockedIn: stockedInQuantity >= quantity,
      };
    });
  }

  const quantity = Math.max(1, item.quantity && !isNaN(Number(item.quantity)) ? Number(item.quantity) : 1);
  const isReq = item.status !== 'da_tao_phieu' && item.status !== 'chua_xin_du_lk';
  const isStock = item.status === 'da_nhap_kho' || item.status === 'da_goi_kh' || item.status === 'da_hoan_tat';
  const reqQty = typeof item.requestedQuantity === 'number' ? Math.max(0, Math.min(quantity, item.requestedQuantity)) : (isReq ? quantity : 0);
  const stockQty = typeof item.stockedInQuantity === 'number' ? Math.max(0, Math.min(quantity, item.stockedInQuantity)) : (isStock ? quantity : 0);

  return [
    {
      id: `p-${item.id}`,
      partCode: item.partCode || '',
      partName: item.partName || '',
      model: item.model || '',
      quantity,
      requestedQuantity: reqQty,
      stockedInQuantity: stockQty,
      isRequested: reqQty >= quantity,
      isStockedIn: stockQty >= quantity,
    },
  ];
}

/**
 * Calculates shortage status and stats based on part quantities:
 * - Đã tạo phiếu (1): Chưa xin LK nào (totalRequestedQty === 0).
 * - Chưa đủ LK (2a): Xin hoặc nhận chưa đủ (0 < totalRequestedQty < totalRequiredQty HOẶC nhận về kho 0 < totalStockedQty < totalRequiredQty).
 * - Đã xin LK (2): Đã xin đủ 100% linh kiện (totalRequestedQty >= totalRequiredQty) nhưng chưa có LK nào về kho (totalStockedQty === 0).
 * - Nhập kho (3) / Chờ khách lên (4 nếu SVD): Đã nhận đủ 100% linh kiện về kho (totalStockedQty >= totalRequiredQty).
 */
export function calculateShortageStatusFromParts(
  parts: ShortagePartSubItem[],
  currentStatus: ShortageStatus,
  isSvd: boolean = false
): ShortagePartsCalculationResult {
  let totalRequiredQty = 0;
  let totalRequestedQty = 0;
  let totalStockedQty = 0;

  for (const p of parts) {
    const qty = Math.max(1, p.quantity && !isNaN(Number(p.quantity)) ? Number(p.quantity) : 1);
    totalRequiredQty += qty;

    const reqQty = typeof p.requestedQuantity === 'number'
      ? Math.max(0, Math.min(qty, p.requestedQuantity))
      : (p.isRequested ? qty : 0);
    totalRequestedQty += reqQty;

    const stockQty = typeof p.stockedInQuantity === 'number'
      ? Math.max(0, Math.min(qty, p.stockedInQuantity))
      : (p.isStockedIn ? qty : 0);
    totalStockedQty += stockQty;
  }

  const isFullyRequested = totalRequestedQty >= totalRequiredQty && totalRequiredQty > 0;
  const isFullyStocked = totalStockedQty >= totalRequiredQty && totalRequiredQty > 0;
  const hasAnyRequested = totalRequestedQty > 0;
  const hasAnyStocked = totalStockedQty > 0;

  let calculatedStatus: ShortageStatus;

  if (isFullyStocked) {
    // 100% parts received in warehouse
    if (isSvd) {
      calculatedStatus = currentStatus === 'da_hoan_tat' ? 'da_hoan_tat' : 'da_goi_kh';
    } else {
      if (currentStatus === 'da_goi_kh' || currentStatus === 'da_hoan_tat') {
        calculatedStatus = currentStatus;
      } else {
        calculatedStatus = 'da_nhap_kho';
      }
    }
  } else if (!isFullyRequested) {
    // NGUYÊN TẮC BƯỚC 2a:
    // Phiếu có nhiều linh kiện mà trong đó có bất kỳ linh kiện nào chưa xin (!isFullyRequested)
    // thì phiếu VẪN GIỮ NGUYÊN ở bước 2a. Chưa xin đủ LK (kể cả khi đã có một số linh kiện nhận/nhập kho).
    if (hasAnyRequested || hasAnyStocked) {
      calculatedStatus = 'chua_xin_du_lk';
    } else {
      calculatedStatus = 'da_tao_phieu';
    }
  } else {
    // NGUYÊN TẮC BƯỚC 3a:
    // Tất cả các linh kiện trong phiếu ĐÃ ĐƯỢC TICK ĐÃ XIN (100% đã xin LK -> isFullyRequested = true).
    // Và có ít nhất 1 linh kiện đã nhận/nhập kho (hasAnyStocked = true) nhưng chưa đầy đủ tất cả.
    if (hasAnyStocked) {
      calculatedStatus = 'nhap_kho_chua_du_lk';
    } else {
      calculatedStatus = 'da_xin_lk';
    }
  }

  let summaryText = '';
  if (isFullyStocked) {
    summaryText = `Đã về đủ kho (${totalStockedQty}/${totalRequiredQty})`;
  } else if (!isFullyRequested) {
    if (hasAnyRequested || hasAnyStocked) {
      summaryText = `Chưa xin đủ LK (${totalRequestedQty}/${totalRequiredQty} đã xin, ${totalStockedQty}/${totalRequiredQty} đã về - Bước 2a)`;
    } else {
      summaryText = `Chưa xin LK nào (0/${totalRequiredQty})`;
    }
  } else {
    if (hasAnyStocked) {
      summaryText = `Đã xin đủ LK, đã nhận ${totalStockedQty}/${totalRequiredQty} LK về kho (Nhập kho chưa đủ LK - Bước 3a)`;
    } else {
      summaryText = `Đã xin đủ ${totalRequestedQty}/${totalRequiredQty} LK (Chờ về kho - Bước 2)`;
    }
  }

  return {
    status: calculatedStatus,
    totalRequiredQty,
    totalRequestedQty,
    totalStockedQty,
    isFullyRequested,
    isFullyStocked,
    hasAnyRequested,
    hasAnyStocked,
    summaryText,
  };
}

// Convert a Shortage item to a LabelItem for standard 3x2 warehouse label printing
export function shortageToLabelItem(item: ShortageBookingItem): LabelItem {
  return {
    id: `label-from-${item.id}`,
    code: item.partCode,
    name: item.partName,
    model: item.model || 'Linh Kiện',
    category: 'Đặt Chờ',
    quantity: 1,
    location: item.location || '',
    date: item.stockedInDate ? item.stockedInDate.split(' ')[0] : item.bookingDate,
    note: `Phiếu: ${item.ticketNumber} - KH: ${item.customerName} (${item.customerPhone})`,
    selected: true,
  };
}

// Export Shortage Bookings to Excel
export function exportShortageToExcel(items: ShortageBookingItem[], filename = 'danh-sach-dat-cho-linh-kien.xlsx') {
  // Tính STT theo thời gian tạo: tạo trước là 1 và tăng dần 2, 3... N
  const sttMap = buildTicketSttMap(items);

  const data = items.map((item, idx) => ({
    'STT': sttMap.get(item.id) ?? (idx + 1),
    'Số Phiếu Đặt Chờ': item.ticketNumber,
    'User Tạo Phiếu': item.createdBy || 'Hệ thống',
    'Kỹ Thuật Xử Lý': item.technicianName || '',
    'Mã Linh Kiện': item.partCode,
    'Tên Linh Kiện': item.partName,
    'Model Máy': item.model || '',
    'Ngày Đặt Chờ': item.bookingDate,
    'Thời Gian Nhập Kho': item.stockedInDate || '',
    'Thời Gian Gọi Khách': item.calledCustomerDate || '',
    'Số Lần Gọi KH': item.callLogs && item.callLogs.length > 0 ? item.callLogs.length : (item.calledCustomerDate ? 1 : 0),
    'Kết Quả Gọi KH': item.callSubStatus ? (SHORTAGE_CALL_SUBSTATUS_CONFIG[item.callSubStatus]?.label || item.callSubStatus) : '',
    'Khách Hẹn Lên': item.appointmentDate || '',
    'Ghi Chú Cuộc Gọi': item.callNote || '',
    'Lịch Sử Các Lần Gọi': item.callLogs && item.callLogs.length > 0
      ? item.callLogs.map((c, i) => `[Lần ${i + 1}] ${c.calledDate}: ${SHORTAGE_CALL_SUBSTATUS_CONFIG[c.subStatus]?.shortLabel || c.subStatus}${c.appointmentDate ? ` (Hẹn: ${c.appointmentDate})` : ''}${c.note ? ` - ${c.note}` : ''}${c.callerName ? ` (${c.callerName})` : ''}`).join(' | ')
      : (item.callNote || ''),
    'Thời Gian Khách Lên': item.customerArrivedDate || '',
    'Tên Khách Hàng': item.customerName,
    'Số Điện Thoại': item.customerPhone,
    'Trạng Thái': SHORTAGE_STATUS_CONFIG[item.status]?.label || item.status,
    'Kết Quả Xử Lý': item.status === 'da_hoan_tat'
      ? (item.isCompletedWithoutRepair ? `Đóng phiếu: ${item.closureReason || 'Khách không thay'}` : 'Thay LK thành công')
      : '',
    'Lý Do Đóng / Hủy': item.closureReason || item.cancelReason || '',
    'Ghi Chú Đóng Phiếu': item.closureNote || '',
    'Người Đóng / KTV': item.closureBy || item.technicianName || '',
    'Khách Gọi Đặt Giữ': item.isCustomerCallHold ? 'Có' : 'Không',
    'Khách Đặt Giữ SVD': item.customerKeepsPart ? 'Có' : 'Không',
    'Vị Trí Kệ': item.location || '',
    'Ghi Chú': item.note || '',
    'Link Tra Cứu GCSM': GCSM_SHORTAGE_URL,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DatChoLinhKien');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 18 }, // Số phiếu
    { wch: 20 }, // User tạo phiếu
    { wch: 20 }, // Kỹ thuật xử lý
    { wch: 16 }, // Mã LK
    { wch: 32 }, // Tên LK
    { wch: 16 }, // Model
    { wch: 14 }, // Ngày đặt
    { wch: 18 }, // Thời gian nhập kho
    { wch: 18 }, // Thời gian gọi khách
    { wch: 24 }, // Kết quả gọi KH
    { wch: 18 }, // Khách hẹn lên
    { wch: 18 }, // Thời gian khách lên
    { wch: 22 }, // Tên KH
    { wch: 15 }, // SĐT
    { wch: 26 }, // Trạng thái
    { wch: 28 }, // Kết quả xử lý
    { wch: 30 }, // Lý do đóng/hủy
    { wch: 30 }, // Ghi chú đóng phiếu
    { wch: 20 }, // Người đóng/KTV
    { wch: 18 }, // Khách gọi đặt giữ
    { wch: 18 }, // Khách giữ LK cũ
    { wch: 12 }, // Vị trí kệ
    { wch: 30 }, // Ghi chú
    { wch: 35 }, // Link GCSM
  ];

  XLSX.writeFile(workbook, filename);
}

// Import Shortage Bookings from Excel
export async function importShortageFromExcel(file: File): Promise<ShortageBookingItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rawData || rawData.length === 0) {
          resolve([]);
          return;
        }

        // Detect headers
        const headerRow = rawData[0] || [];
        let ticketIdx = -1;
        let codeIdx = -1;
        let nameIdx = -1;
        let modelIdx = -1;
        let dateIdx = -1;
        let stockedDateIdx = -1;
        let calledDateIdx = -1;
        let arrivedDateIdx = -1;
        let techIdx = -1;
        let custNameIdx = -1;
        let phoneIdx = -1;
        let statusIdx = -1;
        let locIdx = -1;
        let noteIdx = -1;
        let callHoldIdx = -1;
        let keepsPartIdx = -1;
        let creatorIdx = -1;

        headerRow.forEach((col: any, idx: number) => {
          const str = String(col || '').toLowerCase();
          if (str.includes('phiếu') || str.includes('ticket')) ticketIdx = idx;
          else if (str.includes('user tạo') || str.includes('người tạo') || str.includes('tạo bởi') || str.includes('creator') || str.includes('created by')) creatorIdx = idx;
          else if (str.includes('mã') || str.includes('code') || str.includes('part')) codeIdx = idx;
          else if (str.includes('tên l') || str.includes('tên linh') || (str.includes('tên') && !str.includes('khách') && !str.includes('kỹ thuật'))) nameIdx = idx;
          else if (str.includes('model') || str.includes('dòng máy')) modelIdx = idx;
          else if (str.includes('khách lên') || str.includes('đã lên') || str.includes('arrived')) arrivedDateIdx = idx;
          else if (str.includes('kỹ thuật') || str.includes('ktv') || str.includes('technician') || str.includes('xử lý')) techIdx = idx;
          else if (str.includes('nhập kho') || str.includes('về kho') || str.includes('stocked')) stockedDateIdx = idx;
          else if (str.includes('gọi khách') || str.includes('báo khách') || str.includes('called')) calledDateIdx = idx;
          else if (str.includes('gọi đặt') || str.includes('đặt giữ') || str.includes('đặt trước') || str.includes('call hold')) callHoldIdx = idx;
          else if (str.includes('svd') || str.includes('dịch vụ') || str.includes('dich vu') || str.includes('giữ lk') || str.includes('giữ linh') || str.includes('keeps part')) keepsPartIdx = idx;
          else if (str.includes('ngày đặt') || str.includes('ngày') || str.includes('date')) {
            if (dateIdx === -1) dateIdx = idx;
          }
          else if (str.includes('khách') || str.includes('customer')) custNameIdx = idx;
          else if (str.includes('thoại') || str.includes('phone') || str.includes('sđt') || str.includes('tel')) phoneIdx = idx;
          else if (str.includes('trạng thái') || str.includes('status')) statusIdx = idx;
          else if (str.includes('kệ') || str.includes('vị trí') || str.includes('kho')) locIdx = idx;
          else if (str.includes('ghi chú') || str.includes('note')) noteIdx = idx;
        });

        // Fallbacks
        if (codeIdx === -1) codeIdx = 1;
        if (nameIdx === -1) nameIdx = 2;
        if (ticketIdx === -1) ticketIdx = 0;

        const results: ShortageBookingItem[] = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const partCode = String(row[codeIdx] || '').trim();
          const partName = String(row[nameIdx] || '').trim();
          if (!partCode && !partName) continue;

          const ticketNumber = String(row[ticketIdx] || '').trim() || generateShortageTicketNumber();
          const model = modelIdx !== -1 ? String(row[modelIdx] || '').trim() : '';
          const bookingDate = dateIdx !== -1 ? String(row[dateIdx] || '').trim() : getTodayDateString();
          const stockedInDate = stockedDateIdx !== -1 ? String(row[stockedDateIdx] || '').trim() : undefined;
          const calledCustomerDate = calledDateIdx !== -1 ? String(row[calledDateIdx] || '').trim() : undefined;
          const customerArrivedDate = arrivedDateIdx !== -1 ? String(row[arrivedDateIdx] || '').trim() : undefined;
          const technicianName = techIdx !== -1 ? String(row[techIdx] || '').trim() : undefined;
          const createdBy = creatorIdx !== -1 ? String(row[creatorIdx] || '').trim() : undefined;
          const customerName = custNameIdx !== -1 ? String(row[custNameIdx] || '').trim() : 'Khách hàng';
          const customerPhone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
          const location = locIdx !== -1 ? String(row[locIdx] || '').trim() : '';
          const note = noteIdx !== -1 ? String(row[noteIdx] || '').trim() : '';
          const callHoldVal = callHoldIdx !== -1 ? String(row[callHoldIdx] || '').toLowerCase() : '';
          const isCustomerCallHold = callHoldVal.includes('có') || callHoldVal.includes('yes') || callHoldVal.includes('true') || callHoldVal.includes('1');
          const keepsPartVal = keepsPartIdx !== -1 ? String(row[keepsPartIdx] || '').toLowerCase() : '';
          const customerKeepsPart = keepsPartVal.includes('có') || keepsPartVal.includes('yes') || keepsPartVal.includes('true') || keepsPartVal.includes('1');

          let status: ShortageStatus = 'da_tao_phieu';
          const rawStatusStr = statusIdx !== -1 ? String(row[statusIdx] || '').toLowerCase() : '';
          if (rawStatusStr.includes('khách đã lên') || rawStatusStr.includes('đã lên') || rawStatusStr.includes('hoàn tất') || rawStatusStr.includes('giao') || customerArrivedDate) {
            status = 'da_hoan_tat';
          } else if (rawStatusStr.includes('gọi') || rawStatusStr.includes('báo')) {
            status = 'da_goi_kh';
          } else if (rawStatusStr.includes('nhập kho') || rawStatusStr.includes('về kho') || rawStatusStr.includes('có lk')) {
            status = 'da_nhap_kho';
          } else if (rawStatusStr.includes('chưa xin đủ') || rawStatusStr.includes('thiếu lk') || rawStatusStr.includes('chưa đủ') || rawStatusStr.includes('1 phần')) {
            status = 'chua_xin_du_lk';
          } else if (rawStatusStr.includes('xin') || rawStatusStr.includes('yêu cầu')) {
            status = 'da_xin_lk';
          }

          results.push({
            id: `shortage-import-${Date.now()}-${i}`,
            ticketNumber,
            partCode,
            partName,
            model,
            bookingDate,
            stockedInDate: stockedInDate || (status === 'da_nhap_kho' || status === 'da_goi_kh' || status === 'da_hoan_tat' ? bookingDate : undefined),
            calledCustomerDate: calledCustomerDate || (status === 'da_goi_kh' || status === 'da_hoan_tat' ? bookingDate : undefined),
            customerArrivedDate: customerArrivedDate || (status === 'da_hoan_tat' ? bookingDate : undefined),
            technicianName: technicianName || undefined,
            createdBy: createdBy || undefined,
            customerName,
            customerPhone,
            status,
            location,
            note,
            customerKeepsPart: customerKeepsPart || undefined,
            isCustomerCallHold: isCustomerCallHold || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        resolve(results);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsBinaryString(file);
  });
}

// Generate Single Shortage Card HTML
export async function generateSingleShortageCardHtml(params: {
  item: ShortageBookingItem;
  partCode?: string;
  partName?: string;
  model?: string;
  quantity?: number;
  partIndex?: number;
  totalParts?: number;
  location?: string;
}): Promise<string> {
  const { item, partIndex, totalParts } = params;
  const pCode = (params.partCode || item.partCode || '').trim();
  const pName = (params.partName || item.partName || 'Linh kiện').trim();
  const pModel = (params.model || item.model || '').trim();
  const pLoc = (params.location || item.location || '').trim();
  const pQty = params.quantity && params.quantity > 1 ? params.quantity : 1;

  const partSuffix = totalParts && totalParts > 1 ? ` (${partIndex}/${totalParts})` : '';
  const cleanTicket = (item.ticketNumber || '').trim();
  // Primary QR Content: concise, ultra-scannable format "pCode-ticketNumber" (e.g. "4906134-VN001021-BJQL26092403") or "ticketNumber"
  // Reduces QR matrix version from 15 to 2 (large, bold, sharp square modules scannable instantly by camera & barcode gun)
  const qrContent = pCode ? `${pCode}-${cleanTicket}` : cleanTicket;

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(qrContent, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (e) {
    console.error('Failed to generate QR for shortage label:', e);
  }

  let barcodeSvg = '';
  try {
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgNode, item.ticketNumber.replace(/[^A-Za-z0-9_-]/g, ''), {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 24,
      width: 1.2,
    });
    barcodeSvg = svgNode.outerHTML;
  } catch (e) {
    console.warn('Failed to generate barcode for shortage ticket:', e);
  }

  const badgeText = totalParts && totalParts > 1
    ? `${item.ticketNumber} [${partIndex}/${totalParts}]`
    : item.ticketNumber;

  return `
  <div class="label">
    <div class="header">
      <span class="title">PHIẾU ĐẶT CHỜ LINH KIỆN</span>
      <span class="ticket-badge">${badgeText}</span>
    </div>

    <div class="main-body">
      <div class="info-col">
        <div class="part-name">${pName}${pQty > 1 ? ` (SL: ${pQty})` : ''}</div>
        <div>Mã LK: <strong>${pCode}</strong> ${pModel ? `| ${pModel}` : ''}</div>
        <div class="customer-info">KH: <strong>${item.customerName}</strong> - <strong>${item.customerPhone}</strong></div>
        ${pLoc ? `<div>Vị trí kệ: <strong>${pLoc}</strong></div>` : ''}
        ${item.stockedInDate ? `<div class="time-info">📥 Nhập kho: <strong>${item.stockedInDate}</strong></div>` : ''}
        ${item.calledCustomerDate ? `<div class="time-info">📞 Đã gọi KH: <strong>${item.calledCustomerDate}</strong></div>` : ''}
        ${item.customerArrivedDate ? `<div class="time-info">🧑‍🔧 Khách lên & KT: <strong>${item.customerArrivedDate}${item.technicianName ? ` (${item.technicianName})` : ''}</strong></div>` : item.technicianName ? `<div class="time-info">🧑‍🔧 KT xử lý: <strong>${item.technicianName}</strong></div>` : ''}
      </div>
      <div class="qr-col">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : ''}
        <span class="date-tag">${item.bookingDate}</span>
      </div>
    </div>

    <div class="footer">
      <div class="status-badge">
        ${SHORTAGE_STATUS_CONFIG[item.status]?.label || item.status}
      </div>
      <div class="barcode-box">
        ${barcodeSvg}
      </div>
    </div>
  </div>`;
}

// Generate Printable HTML for a 3x2 inch Shortage Ticket Label
export async function printShortageLabel(item: ShortageBookingItem): Promise<void> {
  return printBatchShortageLabels([item]);
}

// Batch Print 3x2 inch Shortage Ticket Labels for Selected Tickets
export async function printBatchShortageLabels(items: ShortageBookingItem[]): Promise<void> {
  if (!items || items.length === 0) return;

  // Generate cards for all items and their parts (support multi-part tickets)
  const labelCardsHtml: string[] = [];

  for (const item of items) {
    if (item.partsList && item.partsList.length > 0) {
      for (let idx = 0; idx < item.partsList.length; idx++) {
        const p = item.partsList[idx];
        const cardHtml = await generateSingleShortageCardHtml({
          item,
          partCode: p.partCode || item.partCode,
          partName: p.partName || item.partName,
          model: p.model || item.model,
          quantity: p.quantity,
          location: item.location,
          partIndex: idx + 1,
          totalParts: item.partsList.length,
        });
        labelCardsHtml.push(cardHtml);
      }
    } else {
      const cardHtml = await generateSingleShortageCardHtml({
        item,
        partCode: item.partCode,
        partName: item.partName,
        model: item.model,
        location: item.location,
      });
      labelCardsHtml.push(cardHtml);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>In ${labelCardsHtml.length} Tem Phiếu Đặt Chờ</title>
  <style>
    @page {
      size: 3in 2in;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, sans-serif;
    }
    .label {
      width: 3in;
      height: 2in;
      padding: 5pt 7pt;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid #000;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    .label:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5pt solid #000;
      padding-bottom: 2pt;
    }
    .title {
      font-size: 10.5pt;
      font-weight: 900;
      letter-spacing: -0.2pt;
    }
    .ticket-badge {
      font-size: 8.5pt;
      font-weight: 800;
      font-family: monospace;
      background: #000;
      color: #fff;
      padding: 1pt 3pt;
      border-radius: 2pt;
    }
    .main-body {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 2pt 0;
    }
    .info-col {
      flex: 1;
      font-size: 8.5pt;
      line-height: 1.25;
      overflow: hidden;
    }
    .part-name {
      font-weight: 800;
      font-size: 9.5pt;
      margin-bottom: 1.5pt;
      line-height: 1.2;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .customer-info {
      font-weight: 700;
      color: #111;
    }
    .time-info {
      font-size: 7.5pt;
      color: #222;
      margin-top: 1pt;
    }
    .qr-col {
      width: 84px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-left: 3pt;
      flex-shrink: 0;
    }
    .qr-col img {
      width: 80px;
      height: 80px;
      display: block;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    .date-tag {
      font-size: 6.5pt;
      font-weight: 800;
      font-family: monospace;
      margin-top: 2pt;
      text-align: center;
    }
    .footer {
      border-top: 1pt dashed #000;
      padding-top: 2pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
    }
    .status-badge {
      font-weight: 800;
      border: 1pt solid #000;
      padding: 0.5pt 3pt;
      border-radius: 2pt;
    }
    .barcode-box svg {
      height: 15px;
      max-width: 120px;
      display: block;
    }
  </style>
</head>
<body>
  ${labelCardsHtml.join('\n')}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

  // On Desktop App (Electron): Use printHtml with silent: false to directly open standard Windows print dialog
  if (typeof window !== 'undefined' && (window as any).electronAPI?.printHtml) {
    try {
      await (window as any).electronAPI.printHtml({
        html,
        options: {
          silent: false,
          printBackground: true,
          margins: { marginType: 'none' },
        },
      });
      return;
    } catch (e) {
      console.warn('Electron printHtml failed for shortage ticket, fallback to window.open:', e);
    }
  }

  const printWindow = window.open('', '_blank', 'width=650,height=500');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

/**
 * Lấy danh sách toàn bộ các phiếu có cảnh báo hoặc nhắc nhở tiến độ còn hiệu lực.
 * Chuẩn hóa duy nhất 100% cho toàn bộ hệ thống: SidebarNav, KPI Cards, Danh sách phiếu,
 * Taskbar icon OS, Window title và Notification Center!
 */
export function getActiveShortageWarningTickets(bookings: ShortageBookingItem[], isAdmin: boolean = false): ShortageBookingItem[] {
  if (!Array.isArray(bookings)) return [];
  return bookings.filter((b) => {
    // Phiếu đã hoàn tất thành công hoặc đã hủy bỏ mẫu thì không còn cảnh báo
    if (b.status === 'da_hoan_tat' || b.status === 'da_bo_mau') return false;

    return (
      checkOverdue7Days(b).isOverdue ||
      checkStep1AgingWarning(b).hasWarning ||
      checkStep2AgingWarning(b).hasWarning ||
      checkStep3AgingWarning(b).hasWarning ||
      checkSvdPending3Days(b).isSvdPending3Days ||
      checkSvdMultiDayAppointmentProgress(b).hasReminder ||
      (isAdmin && (Boolean(b.cancelRequested) || Boolean(b.editRequested)))
    );
  });
}

