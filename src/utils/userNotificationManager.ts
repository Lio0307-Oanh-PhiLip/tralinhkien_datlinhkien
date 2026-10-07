import { ShortageBookingItem } from '../types/shortage';
import { DeviceIotBookingItem } from '../types/deviceIot';
import { TechnicianItem } from '../types/technician';
import { UserSessionData, syncUserReadNotifsToFirestore, fetchUserReadNotifsFromFirestore } from '../services/firebaseShortageService';
import { checkOverdue7Days, checkSvdPending3Days, checkSvdMultiDayAppointmentProgress } from './shortageHelper';
import { SystemNotificationItem } from '../components/SystemNotificationCenter';

/**
 * Derives a unique and persistent storage key for the current user
 */
export function getUserStorageKey(user?: { uid?: string; username?: string; name?: string } | null): string {
  if (!user) return 'user_guest';
  const cleanId = (user.username || user.uid || user.name || 'guest')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, '_');
  return `user_${cleanId}`;
}

/**
 * Gets the set of read notification IDs for a specific user
 */
export function getUserReadNotificationIds(userKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(`app_read_notifs_${userKey}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    console.warn('Error reading read notification IDs from localStorage:', e);
  }
  return new Set();
}

/**
 * Saves the set of read notification IDs for a specific user and syncs to Firestore
 */
export function saveUserReadNotificationIds(userKey: string, ids: Set<string> | string[]): void {
  try {
    const arr = Array.from(ids);
    localStorage.setItem(`app_read_notifs_${userKey}`, JSON.stringify(arr));
    
    // Background sync to Firestore database
    const seenWarnings = getUserSeenWarningIds(userKey);
    syncUserReadNotifsToFirestore(userKey, arr, Array.from(seenWarnings)).catch(() => {});
  } catch (e) {
    console.warn('Error saving read notification IDs to localStorage:', e);
  }
}

/**
 * Generates the full list of current active system notifications
 */
export function generateSystemNotifications(
  usersList: UserSessionData[],
  techniciansList: TechnicianItem[],
  shortageBookings: ShortageBookingItem[],
  deviceIotBookings: DeviceIotBookingItem[],
  hasNewCodeUpdate: boolean,
  serverVersion: string,
  clientVersion: string,
  readIds: Set<string>,
  userRole: 'admin' | 'staff' = 'staff'
): SystemNotificationItem[] {
  const list: SystemNotificationItem[] = [];
  const now = Date.now();
  const isAdmin = userRole === 'admin';

  // 1. Pending User Account Approvals (Admin ONLY)
  if (isAdmin) {
    const pendingUsers = usersList.filter((u) => u.status === 'pending');
    pendingUsers.forEach((u) => {
      const id = `user-pending-${u.uid || u.username}`;
      list.push({
        id,
        type: 'admin_user',
        category: 'admin',
        title: `Yêu cầu tạo tài khoản: @${u.username || u.displayName}`,
        description: `Nhân viên "${u.displayName || u.username}" vừa gửi yêu cầu đăng ký tài khoản mới cần Quản trị viên phê duyệt.`,
        timestamp: u.lastActive || 'Đang chờ duyệt',
        timestampMillis: now,
        priority: 'urgent',
        isRead: readIds.has(id),
        metadata: {
          uid: u.uid,
          username: u.username,
          requesterName: u.displayName,
          targetTab: 'approval',
        },
      });
    });
  }

  // 2. Pending Technician Registrations (Admin ONLY)
  if (isAdmin) {
    const pendingTechs = techniciansList.filter((t) => t.status === 'pending');
    pendingTechs.forEach((t) => {
      const id = `tech-pending-${t.id || t.techId}`;
      list.push({
        id,
        type: 'admin_tech',
        category: 'admin',
        title: `Yêu cầu thêm Kỹ Thuật Viên: ${t.name} (${t.techId})`,
        description: `Yêu cầu phê duyệt KTV mới: ${t.name} - Bộ phận: ${t.department || 'Kỹ thuật'} (Gửi bởi: ${t.requestedBy || 'Nhân viên'}).`,
        timestamp: t.requestedAt || t.createdAt || 'Đang chờ duyệt',
        timestampMillis: now,
        priority: 'urgent',
        isRead: readIds.has(id),
        metadata: {
          techId: t.techId,
          uid: t.id,
          requesterName: t.requestedBy,
          targetTab: 'technicians',
        },
      });
    });
  }

  // 3. Pending Shortage Ticket Cancellations (Admin ONLY)
  if (isAdmin) {
    const cancelShortages = shortageBookings.filter((b) => b.cancelRequested && b.status !== 'da_hoan_tat');
    cancelShortages.forEach((b) => {
      const id = `cancel-shortage-${b.id}`;
      list.push({
        id,
        type: 'admin_cancel_shortage',
        category: 'admin',
        title: `Yêu cầu hủy phiếu: ${b.ticketNumber || b.id}`,
        description: `KTV ${b.cancelRequestedBy || 'Nhân viên'} yêu cầu hủy phiếu LK "${b.partName || b.partCode}". Lý do: ${b.cancelReason || 'Không có lý do'}.`,
        timestamp: b.cancelRequestedAt || b.updatedAt || 'Vừa yêu cầu',
        timestampMillis: now - 1000,
        priority: 'urgent',
        isRead: readIds.has(id),
        metadata: {
          ticketId: b.id,
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          partName: b.partName,
          reason: b.cancelReason,
          requesterName: b.cancelRequestedBy,
          targetMode: 'shortage',
          targetTab: 'shortage-main',
          targetSearch: b.ticketNumber,
        },
      });
    });
  }

  // 4. Pending Device/IoT Ticket Cancellations (Admin ONLY)
  if (isAdmin) {
    const cancelDevices = deviceIotBookings.filter((d) => d.cancelRequested && d.status !== 'da_tra' && d.status !== 'da_hoan_tat');
    cancelDevices.forEach((d) => {
      const id = `cancel-device-${d.id}`;
      list.push({
        id,
        type: 'admin_cancel_device',
        category: 'admin',
        title: `Yêu cầu hủy máy/IoT: ${d.ticketNumber || d.id}`,
        description: `KTV ${d.cancelRequestedBy || 'Nhân viên'} xin hủy máy "${d.deviceModel || d.deviceName || d.imeiOrIot}". Lý do: ${d.cancelReason || 'Không có lý do'}.`,
        timestamp: d.cancelRequestedAt || d.updatedAt || 'Vừa yêu cầu',
        timestampMillis: now - 2000,
        priority: 'urgent',
        isRead: readIds.has(id),
        metadata: {
          ticketId: d.id,
          ticketNumber: d.ticketNumber,
          customerName: d.customerName,
          model: d.deviceModel || d.deviceName,
          reason: d.cancelReason,
          requesterName: d.cancelRequestedBy,
          targetMode: 'device_iot',
          targetTab: 'device-main',
          targetSearch: d.ticketNumber,
        },
      });
    });
  }

  // 5. Shortage Bookings Stocked In - Need to Call Customer (Bước 3: Đã nhập kho cần gọi khách)
  const stockedShortages = shortageBookings.filter((b) => b.status === 'da_nhap_kho');
  if (stockedShortages.length > 0) {
    const id = `stock-in-summary-${stockedShortages.length}-${stockedShortages.map((s) => s.id).slice(0, 5).join('_')}`;
    list.push({
      id,
      type: 'shortage_stocked',
      category: 'warning',
      title: `Có ${stockedShortages.length} phiếu LK đã nhập kho cần gọi khách!`,
      description: `Linh kiện đã về trung tâm (Vị trí kệ: ${stockedShortages.map((s) => s.location || 'Chưa xếp').slice(0, 3).join(', ')}...). Vui lòng liên hệ khách hàng hẹn ngày lên thay thế.`,
      timestamp: stockedShortages[0]?.stockedInDate || 'Cần xử lý ngay',
      timestampMillis: now - 3000,
      priority: 'warning',
      isRead: readIds.has(id),
      metadata: {
        targetMode: 'shortage',
        targetTab: 'shortage-main',
        targetFilter: 'da_nhap_kho',
      },
    });

    // Individual stocked tickets (up to 5 tickets)
    stockedShortages.slice(0, 5).forEach((b) => {
      const singleId = `stocked-ticket-${b.id}`;
      list.push({
        id: singleId,
        type: 'shortage_stocked',
        category: 'warning',
        title: `[Đã về kho] Phiếu ${b.ticketNumber || b.id}: Gọi ${b.customerName || 'Khách'}`,
        description: `Linh kiện "${b.partName || b.partCode}" (${b.model || ''}) đã về kho tại ${b.location || 'kệ lưu'}. SĐT: ${b.customerPhone || 'Chưa có'}. Bấm để xem phiếu.`,
        timestamp: b.stockedInDate || 'Về kho',
        timestampMillis: now - 3100,
        priority: 'warning',
        isRead: readIds.has(singleId),
        metadata: {
          ticketId: b.id,
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          targetMode: 'shortage',
          targetTab: 'shortage-main',
          targetFilter: 'da_nhap_kho',
          targetSearch: b.ticketNumber,
        },
      });
    });
  }

  // 5b. Shortage Bookings at Step 2a (Chưa đủ linh kiện / Cần bổ sung)
  const partialShortages = shortageBookings.filter((b) => {
    if (b.status === 'da_hoan_tat' || b.status === 'da_bo_mau') return false;
    if (b.status === 'chua_xin_du_lk') return true;
    const totalQty = Number(b.quantity) || 1;
    const reqQty = Number(b.requestedQuantity) || 0;
    const stockQty = Number(b.stockedInQuantity) || 0;
    return totalQty >= 2 && (reqQty < totalQty || stockQty < totalQty);
  });
  if (partialShortages.length > 0) {
    const id = `step2a-partial-summary-${partialShortages.length}-${partialShortages.map((s) => s.id).slice(0, 5).join('_')}`;
    list.push({
      id,
      type: 'shortage_warning',
      category: 'warning',
      title: `Có ${partialShortages.length} phiếu Chưa Đủ Linh Kiện (Bước 2a)`,
      description: `Phiếu đặt ${partialShortages.length} trường hợp chưa xin đủ hoặc kho chưa về đủ số lượng cần thiết. Bấm để lọc và tiếp tục gửi xin bổ sung.`,
      timestamp: 'Cần bổ sung LK',
      timestampMillis: now - 3500,
      priority: 'warning',
      isRead: readIds.has(id),
      metadata: {
        targetMode: 'shortage',
        targetTab: 'shortage-main',
        targetFilter: 'chua_xin_du_lk',
      },
    });

    // Individual partial shortage tickets (up to 4 tickets)
    partialShortages.slice(0, 4).forEach((b) => {
      const singleId = `step2a-ticket-${b.id}`;
      list.push({
        id: singleId,
        type: 'shortage_warning',
        category: 'warning',
        title: `[Chưa đủ LK] Phiếu ${b.ticketNumber || b.id}: ${b.customerName || ''}`,
        description: `Linh kiện "${b.partName || b.partCode}" (${b.model || ''}) cần SL: ${b.quantity || 1}, hiện tại đã xin: ${b.requestedQuantity || 0}, về kho: ${b.stockedInQuantity || 0}. Bấm để xem phiếu.`,
        timestamp: 'Bước 2a',
        timestampMillis: now - 3600,
        priority: 'warning',
        isRead: readIds.has(singleId),
        metadata: {
          ticketId: b.id,
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          targetMode: 'shortage',
          targetTab: 'shortage-main',
          targetFilter: 'chua_xin_du_lk',
          targetSearch: b.ticketNumber,
        },
      });
    });
  }

  // 5c. New Shortage Tickets at Step 1 (Mới tạo cần xin linh kiện)
  const step1Shortages = shortageBookings.filter((b) => b.status === 'da_tao_phieu');
  if (step1Shortages.length > 0) {
    const id = `step1-new-summary-${step1Shortages.length}-${step1Shortages.map((s) => s.id).slice(0, 5).join('_')}`;
    list.push({
      id,
      type: 'shortage_warning',
      category: 'warning',
      title: `Có ${step1Shortages.length} phiếu mới tạo chờ xin LK (Bước 1)`,
      description: `Có ${step1Shortages.length} phiếu đặt chờ vừa tạo đang chờ gửi yêu cầu xin linh kiện lên hệ thống trung tâm cấp cao.`,
      timestamp: step1Shortages[0]?.bookingDate || 'Chờ xin LK',
      timestampMillis: now - 3800,
      priority: 'info',
      isRead: readIds.has(id),
      metadata: {
        targetMode: 'shortage',
        targetTab: 'shortage-main',
        targetFilter: 'da_tao_phieu',
      },
    });

    // Individual Step 1 tickets (up to 4 tickets)
    step1Shortages.slice(0, 4).forEach((b) => {
      const singleId = `step1-ticket-${b.id}`;
      list.push({
        id: singleId,
        type: 'shortage_warning',
        category: 'warning',
        title: `[Chờ xin LK] Phiếu ${b.ticketNumber || b.id}: ${b.customerName || ''}`,
        description: `Phiếu mới tạo linh kiện "${b.partName || b.partCode}" (${b.model || ''}). KTV: ${b.creatorTechnician || b.technicianName || 'Chưa phân công'}. Bấm để mở phiếu xin LK.`,
        timestamp: b.bookingDate || 'Bước 1',
        timestampMillis: now - 3900,
        priority: 'info',
        isRead: readIds.has(singleId),
        metadata: {
          ticketId: b.id,
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          targetMode: 'shortage',
          targetTab: 'shortage-main',
          targetFilter: 'da_tao_phieu',
          targetSearch: b.ticketNumber,
        },
      });
    });
  }

  // 6. Overdue Shortages (> 7 Days / 14 Days)
  const overdueShortages = shortageBookings.filter((b) => {
    if (b.status === 'da_hoan_tat') return false;
    return checkOverdue7Days(b).isOverdue;
  });
  if (overdueShortages.length > 0) {
    const id = `overdue-7d-summary-${overdueShortages.length}-${overdueShortages.map((s) => s.id).slice(0, 5).join('_')}`;
    list.push({
      id,
      type: 'shortage_warning',
      category: 'warning',
      title: `Cảnh báo: ${overdueShortages.length} phiếu đặt chờ quá hạn 7 ngày!`,
      description: `Có ${overdueShortages.length} phiếu đã quá 7 ngày chưa lên hoặc chưa hoàn tất xử lý. Cần gọi lại hoặc xác nhận đóng phiếu.`,
      timestamp: 'Cảnh báo tiến độ',
      timestampMillis: now - 4000,
      priority: 'urgent',
      isRead: readIds.has(id),
      metadata: {
        targetMode: 'shortage',
        targetTab: 'warnings',
        warningBranch: 'overdue_7',
      },
    });

    // Individual overdue tickets (up to 5 tickets)
    overdueShortages.slice(0, 5).forEach((b) => {
      const overdueInfo = checkOverdue7Days(b);
      const singleId = `overdue-ticket-${b.id}`;
      list.push({
        id: singleId,
        type: 'shortage_warning',
        category: 'warning',
        title: `[Quá hạn ${overdueInfo.daysPassed} ngày] Phiếu ${b.ticketNumber || b.id}: ${b.customerName || 'Khách'}`,
        description: `Linh kiện "${b.partName || b.partCode}" (${b.model || ''}). Đã trễ hạn tiến độ, cần kiểm tra gấp. SĐT: ${b.customerPhone || 'Chưa có'}. Bấm để xem phiếu.`,
        timestamp: `${overdueInfo.daysPassed} ngày`,
        timestampMillis: now - 4100,
        priority: 'urgent',
        isRead: readIds.has(singleId),
        metadata: {
          ticketId: b.id,
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          targetMode: 'shortage',
          targetTab: 'warnings',
          warningBranch: 'overdue_7',
          targetSearch: b.ticketNumber,
        },
      });
    });
  }

  // 7. SVD / Customer Holds Pending (> 1 Day at Step 1 or Multi-day appointment follow-up)
  const svdPending = shortageBookings.filter((b) => {
    if (b.status === 'da_hoan_tat' || b.status === 'da_bo_mau') return false;
    return checkSvdPending3Days(b).isSvdPending3Days;
  });
  if (svdPending.length > 0) {
    const id = `svd-pending-3d-summary-${svdPending.length}-${svdPending.map((s) => s.id).slice(0, 5).join('_')}`;
    list.push({
      id,
      type: 'shortage_warning',
      category: 'warning',
      title: `Có ${svdPending.length} phiếu Đặt Giữ SVD ở Bước 1 > 1 ngày chưa xin LK`,
      description: `Khách hàng đặt giữ suất Ngày Dịch Vụ SVD. Cần tiến hành gửi yêu cầu xin linh kiện ngay.`,
      timestamp: 'Cảnh báo SVD',
      timestampMillis: now - 5000,
      priority: 'warning',
      isRead: readIds.has(id),
      metadata: {
        targetMode: 'shortage',
        targetTab: 'warnings',
        warningBranch: 'svd',
      },
    });

    // Individual SVD Pending tickets (up to 3 tickets)
    svdPending.slice(0, 3).forEach((b) => {
      const singleId = `svd-pending-ticket-${b.id}`;
      list.push({
        id: singleId,
        type: 'shortage_warning',
        category: 'warning',
        title: `[Giữ SVD >1 ngày] Phiếu ${b.ticketNumber || b.id}: ${b.customerName || 'Khách'}`,
        description: `Phiếu đặt giữ Ngày Dịch Vụ SVD linh kiện "${b.partName || b.partCode}" (${b.model || ''}) chưa gửi xin LK. Bấm để xử lý ngay.`,
        timestamp: 'Giữ SVD',
        timestampMillis: now - 5100,
        priority: 'warning',
        isRead: readIds.has(singleId),
        metadata: {
          ticketId: b.id,
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          targetMode: 'shortage',
          targetTab: 'warnings',
          warningBranch: 'svd',
          targetSearch: b.ticketNumber,
        },
      });
    });
  }

  // 7b. SVD Multi-day Appointment Reminders (Days 10, 11, 12 and After 12)
  const svdMultiDayReminders = shortageBookings.filter((b) => {
    if (b.status === 'da_hoan_tat' || b.status === 'da_bo_mau') return false;
    return checkSvdMultiDayAppointmentProgress(b).hasReminder;
  });
  if (svdMultiDayReminders.length > 0) {
    const firstCheck = checkSvdMultiDayAppointmentProgress(svdMultiDayReminders[0]);
    const id = `svd-multiday-summary-${svdMultiDayReminders.length}-${svdMultiDayReminders.map((s) => s.id).slice(0, 5).join('_')}`;
    list.push({
      id,
      type: 'shortage_warning',
      category: 'warning',
      title: `SVD (10-12): ${firstCheck.title} (${svdMultiDayReminders.length} phiếu)`,
      description: `${firstCheck.message}. Đảm bảo khách hàng được nhắc nhở đến thay linh kiện và xử lý tránh treo phiếu trên hệ thống.`,
      timestamp: firstCheck.actionRecommendation || 'Nhắc hẹn SVD',
      timestampMillis: now - 3000,
      priority: firstCheck.isUrgent ? 'urgent' : 'warning',
      isRead: readIds.has(id),
      metadata: {
        targetMode: 'shortage',
        targetTab: 'warnings',
        warningBranch: 'svd',
      },
    });

    // Individual SVD Reminders (up to 4 tickets)
    svdMultiDayReminders.slice(0, 4).forEach((b) => {
      const check = checkSvdMultiDayAppointmentProgress(b);
      const singleId = `svd-remind-ticket-${b.id}`;
      list.push({
        id: singleId,
        type: 'shortage_warning',
        category: 'warning',
        title: `[Nhắc hẹn SVD] Phiếu ${b.ticketNumber || b.id}: ${b.customerName || 'Khách'}`,
        description: `${check.message} (${b.partName || b.model || ''}). ${check.actionRecommendation}. Bấm để xem phiếu.`,
        timestamp: `SVD ${check.stage}`,
        timestampMillis: now - 3100,
        priority: check.isUrgent ? 'urgent' : 'warning',
        isRead: readIds.has(singleId),
        metadata: {
          ticketId: b.id,
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          targetMode: 'shortage',
          targetTab: 'warnings',
          warningBranch: 'svd',
          targetSearch: b.ticketNumber,
        },
      });
    });
  }

  // 8. Device / IoT Overdue Warnings
  const pendingDevices = deviceIotBookings.filter((d) => d.status !== 'da_tra' && d.status !== 'da_hoan_tat');
  if (pendingDevices.length > 0) {
    const id = `device-iot-summary-${pendingDevices.length}-${pendingDevices.map((s) => s.id).slice(0, 5).join('_')}`;
    list.push({
      id,
      type: 'device_warning',
      category: 'warning',
      title: `Quản lý Thiết Bị: ${pendingDevices.length} máy & IoT đang lưu kho / gửi đi`,
      description: `Theo dõi tiến độ nhận máy, kiểm tra gửi về trung tâm cấp cao và bàn giao cho khách hàng đúng hẹn.`,
      timestamp: 'Tiến độ IoT',
      timestampMillis: now - 6000,
      priority: 'info',
      isRead: readIds.has(id),
      metadata: {
        targetMode: 'device_iot',
        targetTab: 'device-main',
        targetFilter: 'active',
      },
    });

    // Individual device tickets (up to 4 tickets)
    pendingDevices.slice(0, 4).forEach((d) => {
      const singleId = `device-ticket-${d.id}`;
      list.push({
        id: singleId,
        type: 'device_warning',
        category: 'warning',
        title: `[Máy/IoT] Phiếu ${d.ticketNumber || d.id}: ${d.deviceModel || d.deviceName || ''}`,
        description: `Khách hàng: ${d.customerName || 'Khách'}. Hiện đang ở trạng thái: "${d.status}". Bấm để xem phiếu.`,
        timestamp: d.bookingDate || 'Lưu kho',
        timestampMillis: now - 6100,
        priority: 'info',
        isRead: readIds.has(singleId),
        metadata: {
          ticketId: d.id,
          ticketNumber: d.ticketNumber,
          customerName: d.customerName,
          targetMode: 'device_iot',
          targetTab: 'device-main',
          targetSearch: d.ticketNumber,
        },
      });
    });
  }

  // 9. OTA System Update Available
  if (hasNewCodeUpdate) {
    const id = `system-update-${serverVersion}`;
    list.push({
      id,
      type: 'system_ota',
      category: 'system',
      title: `Đã có bản cập nhật mới v${serverVersion}!`,
      description: `Phiên bản mới v${serverVersion} đã được phát hành trên Cloud với các tính năng nâng cấp và sửa lỗi. Bấm để nạp bản mới ngay.`,
      timestamp: 'Cập nhật OTA',
      timestampMillis: now + 1000,
      priority: 'urgent',
      isRead: readIds.has(id),
      metadata: {
        actionUrl: 'update',
      },
    });
  }

  // 10. System Active Operational Status (Info notification)
  const idSysInfo = `system-info-live-v${clientVersion}`;
  list.push({
    id: idSysInfo,
    type: 'system_info',
    category: 'system',
    title: `Hệ thống HCM4 Phú Lâm đang chạy v${clientVersion}`,
    description: `Đồng bộ dữ liệu hai chiều giữa Cloud Firestore và Cục bộ tốc độ cao. Trạng thái: 100% Sẵn sàng.`,
    timestamp: 'Hôm nay',
    timestampMillis: now - 10000,
    priority: 'info',
    isRead: readIds.has(idSysInfo),
    metadata: {},
  });

  return list;
}

/**
 * Gets the set of seen warning ticket IDs for a specific user
 */
export function getUserSeenWarningIds(userKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(`app_warnings_seen_${userKey}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    console.warn('Error reading seen warnings from localStorage:', e);
  }
  return new Set();
}

/**
 * Saves the set of seen warning ticket IDs for a specific user and syncs to Firestore
 */
export function saveUserSeenWarningIds(userKey: string, ids: Set<string> | string[]): void {
  try {
    const arr = Array.from(ids);
    localStorage.setItem(`app_warnings_seen_${userKey}`, JSON.stringify(arr));

    // Background sync to Firestore database
    const readNotifs = getUserReadNotificationIds(userKey);
    syncUserReadNotifsToFirestore(userKey, Array.from(readNotifs), arr).catch(() => {});
  } catch (e) {
    console.warn('Error saving seen warnings to localStorage:', e);
  }
}

/**
 * Loads read notification IDs and seen warning IDs from Firestore database and merges with local storage.
 * Ensures cross-device persistence when logging in on a new device.
 */
export async function loadAndSyncUserReadNotifs(
  userKey: string,
  onLoaded: (data: { readIds: Set<string>; seenWarningIds: Set<string> }) => void
): Promise<void> {
  const localReadIds = getUserReadNotificationIds(userKey);
  const localSeenWarnings = getUserSeenWarningIds(userKey);

  // Return local first for instant UI response
  onLoaded({
    readIds: localReadIds,
    seenWarningIds: localSeenWarnings,
  });

  if (!userKey || userKey === 'user_guest') return;

  try {
    const remoteData = await fetchUserReadNotifsFromFirestore(userKey);
    if (remoteData) {
      let merged = false;
      const mergedReadIds = new Set(localReadIds);
      remoteData.readNotificationIds.forEach((id) => {
        if (!mergedReadIds.has(id)) {
          mergedReadIds.add(id);
          merged = true;
        }
      });

      const mergedSeenWarnings = new Set(localSeenWarnings);
      remoteData.seenWarningIds.forEach((id) => {
        if (!mergedSeenWarnings.has(id)) {
          mergedSeenWarnings.add(id);
          merged = true;
        }
      });

      if (merged) {
        localStorage.setItem(`app_read_notifs_${userKey}`, JSON.stringify(Array.from(mergedReadIds)));
        localStorage.setItem(`app_warnings_seen_${userKey}`, JSON.stringify(Array.from(mergedSeenWarnings)));
        onLoaded({
          readIds: mergedReadIds,
          seenWarningIds: mergedSeenWarnings,
        });
      }
    }
  } catch (e) {
    console.warn('Error syncing read notifications from Firestore:', e);
  }
}
