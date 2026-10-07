import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard,
  Calendar,
  Filter,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ExternalLink,
  Search,
  Download,
  RefreshCw,
  Tag,
  Smartphone,
  PhoneCall,
  User,
  Activity,
  Layers,
  Sparkles,
  PieChart,
  BarChart3,
  Check,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { ShortageBookingItem, SHORTAGE_STATUS_CONFIG, SHORTAGE_CALL_SUBSTATUS_CONFIG } from '../types/shortage';
import { DeviceIotBookingItem } from '../types/deviceIot';
import { LabelItem } from '../types/label';
import { TechnicianItem } from '../types/technician';
import { UserSessionData } from '../services/firebaseShortageService';
import {
  parseDateToMillis,
  checkOverdue7Days,
  checkSvdPending3Days,
  checkStep1AgingWarning,
  checkStep2AgingWarning,
  checkStep3AgingWarning,
} from '../utils/shortageHelper';

export interface OverviewDashboardProps {
  shortageBookings: ShortageBookingItem[];
  deviceIotBookings: DeviceIotBookingItem[];
  catalogLabels: LabelItem[];
  customPrintItems: LabelItem[];
  techniciansList: TechnicianItem[];
  usersList: UserSessionData[];
  currentUser?: {
    name: string;
    role: 'admin' | 'staff';
    uid: string;
    username?: string;
    status?: 'pending' | 'approved' | 'rejected';
    displayName?: string;
  } | null;
  onNavigateToMode: (mode: 'labels' | 'shortage' | 'device_iot', subId?: string, tab?: 'editor' | 'split' | 'custom_print' | 'preview') => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshCloudData?: () => void;
  cloudSynced?: boolean;
  isRefreshing?: boolean;
}

type TimeRangeFilter = 'all' | 'this_month' | 'last_month' | 'custom_month' | 'last_7_days' | 'last_30_days' | 'this_quarter';

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  shortageBookings = [],
  deviceIotBookings = [],
  catalogLabels = [],
  customPrintItems = [],
  techniciansList = [],
  usersList = [],
  currentUser,
  onNavigateToMode,
  onShowToast,
  onRefreshCloudData,
  cloudSynced = true,
  isRefreshing = false,
}) => {
  // Current Date references
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Time filter state
  const [timeFilter, setTimeFilter] = useState<TimeRangeFilter>('this_month');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Active Report sub-tab in Overview
  const [activeReportTab, setActiveReportTab] = useState<'pipeline' | 'technicians' | 'parts' | 'device_iot' | 'alerts'>('pipeline');
  const [ktvSearchQuery, setKtvSearchQuery] = useState('');
  const [partSearchQuery, setPartSearchQuery] = useState('');

  // 1. Calculate time boundaries based on timeFilter
  const { startDateMs, endDateMs, periodLabel } = useMemo(() => {
    let startMs = 0;
    let endMs = Infinity;
    let label = 'Toàn bộ thời gian';

    if (timeFilter === 'this_month') {
      const start = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
      startMs = start.getTime();
      endMs = end.getTime();
      label = `Tháng ${String(currentMonth).padStart(2, '0')}/${currentYear}`;
    } else if (timeFilter === 'last_month') {
      const lastM = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastY = currentMonth === 1 ? currentYear - 1 : currentYear;
      const start = new Date(lastY, lastM - 1, 1, 0, 0, 0, 0);
      const end = new Date(lastY, lastM, 0, 23, 59, 59, 999);
      startMs = start.getTime();
      endMs = end.getTime();
      label = `Tháng ${String(lastM).padStart(2, '0')}/${lastY} (Tháng trước)`;
    } else if (timeFilter === 'custom_month') {
      const start = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
      const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      startMs = start.getTime();
      endMs = end.getTime();
      label = `Tháng ${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
    } else if (timeFilter === 'last_7_days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startMs = start.getTime();
      endMs = now.getTime();
      label = '7 ngày gần nhất';
    } else if (timeFilter === 'last_30_days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startMs = start.getTime();
      endMs = now.getTime();
      label = '30 ngày gần nhất';
    } else if (timeFilter === 'this_quarter') {
      const quarter = Math.floor((now.getMonth()) / 3);
      const start = new Date(currentYear, quarter * 3, 1, 0, 0, 0, 0);
      const end = new Date(currentYear, (quarter + 1) * 3, 0, 23, 59, 59, 999);
      startMs = start.getTime();
      endMs = end.getTime();
      label = `Quý ${quarter + 1}/${currentYear}`;
    }

    return { startDateMs: startMs, endDateMs: endMs, periodLabel: label };
  }, [timeFilter, selectedMonth, selectedYear, now, currentMonth, currentYear]);

  // 2. Filter Shortage Bookings by period
  const filteredShortages = useMemo(() => {
    if (timeFilter === 'all') return shortageBookings;
    return shortageBookings.filter((item) => {
      const ts = parseDateToMillis(item.bookingDate || item.createdAt);
      if (ts === 0) return true; // Keep if no valid date to avoid losing
      return ts >= startDateMs && ts <= endDateMs;
    });
  }, [shortageBookings, timeFilter, startDateMs, endDateMs]);

  // 3. Filter Device / IOT Bookings by period
  const filteredDeviceIots = useMemo(() => {
    if (timeFilter === 'all') return deviceIotBookings;
    return deviceIotBookings.filter((item) => {
      const ts = parseDateToMillis(item.bookingDate || item.createdAt);
      if (ts === 0) return true;
      return ts >= startDateMs && ts <= endDateMs;
    });
  }, [deviceIotBookings, timeFilter, startDateMs, endDateMs]);

  // 4. Detailed Shortage Metrics Calculation
  const shortageStats = useMemo(() => {
    const total = filteredShortages.length;
    let step1_created = 0;
    let step2_requested = 0;
    let step3_stocked = 0;
    let step4_called = 0;
    let step5_completed = 0;
    let step6_closed = 0;

    let svdCount = 0;
    let callHoldCount = 0;
    let pendingApprovalCount = 0;

    // Call substatuses
    let call_hen_ngay = 0;
    let call_khong_nghe = 0;
    let call_cho_them = 0;
    let call_bao_huy = 0;

    // Overdue alerts
    let overdue7Days = 0;
    let svdOverdue3Days = 0;
    let step1Aging = 0;
    let step2Aging = 0;
    let step3Aging = 0;

    filteredShortages.forEach((item) => {
      switch (item.status) {
        case 'da_tao_phieu':
          step1_created++;
          break;
        case 'da_xin_lk':
        case 'chua_xin_du_lk':
          step2_requested++;
          break;
        case 'da_nhap_kho':
          step3_stocked++;
          break;
        case 'da_goi_kh':
          step4_called++;
          break;
        case 'da_hoan_tat':
          step5_completed++;
          break;
        case 'da_bo_mau':
          step6_closed++;
          break;
        default:
          break;
      }

      if (item.customerKeepsPart) svdCount++;
      if (item.isCustomerCallHold) callHoldCount++;
      if (item.cancelRequested || item.editRequested) pendingApprovalCount++;

      if (item.callSubStatus === 'hen_ngay') call_hen_ngay++;
      else if (item.callSubStatus === 'khong_nghe_may') call_khong_nghe++;
      else if (item.callSubStatus === 'cho_them_thoi_gian') call_cho_them++;
      else if (item.callSubStatus === 'khach_bao_huy') call_bao_huy++;

      if (checkOverdue7Days(item).isOverdue) overdue7Days++;
      if (checkSvdPending3Days(item).isSvdPending3Days) svdOverdue3Days++;
      if (checkStep1AgingWarning(item).hasWarning) step1Aging++;
      if (checkStep2AgingWarning(item).hasWarning) step2Aging++;
      if (checkStep3AgingWarning(item).hasWarning) step3Aging++;
    });

    const activeProcessing = step1_created + step2_requested + step3_stocked + step4_called;
    const completedOrClosed = step5_completed + step6_closed;
    const completionRate = total > 0 ? Math.round((step5_completed / total) * 100) : 0;
    const totalAlerts = overdue7Days + svdOverdue3Days + step1Aging + step2Aging + step3Aging;

    return {
      total,
      step1_created,
      step2_requested,
      step3_stocked,
      step4_called,
      step5_completed,
      step6_closed,
      activeProcessing,
      completedOrClosed,
      completionRate,
      svdCount,
      callHoldCount,
      pendingApprovalCount,
      callSubStats: {
        hen_ngay: call_hen_ngay,
        khong_nghe_may: call_khong_nghe,
        cho_them_thoi_gian: call_cho_them,
        khach_bao_huy: call_bao_huy,
      },
      alerts: {
        totalAlerts,
        overdue7Days,
        svdOverdue3Days,
        step1Aging,
        step2Aging,
        step3Aging,
      },
    };
  }, [filteredShortages]);

  // 5. Device & IOT Stats
  const deviceIotStats = useMemo(() => {
    const total = filteredDeviceIots.length;
    let pending = 0;
    let repairing = 0;
    let waitingPart = 0;
    let completed = 0;
    let delivered = 0;

    let phoneCount = 0;
    let padCount = 0;
    let watchCount = 0;
    let earphoneIotCount = 0;

    filteredDeviceIots.forEach((item) => {
      const st = item.status;
      if (st === 'co_san_may' || st === 'cho_xin_may') pending++;
      else if (st === 'da_xin_may' || st === 'dang_muon') repairing++;
      else if (st === 'da_nhap_kho' || st === 'da_goi_kh') waitingPart++;
      else if (st === 'da_hoan_tat' || st === 'da_tra') completed++;
      else delivered++;

      const category = item.deviceCategory;
      if (category === 'phone' || !category) {
        phoneCount++;
      } else if (category === 'pad') {
        padCount++;
      } else if (category === 'watch') {
        watchCount++;
      } else {
        earphoneIotCount++;
      }
    });

    const completionRate = total > 0 ? Math.round(((completed + delivered) / total) * 100) : 0;

    return {
      total,
      pending,
      repairing,
      waitingPart,
      completed,
      delivered,
      completionRate,
      deviceTypes: {
        phone: phoneCount,
        pad: padCount,
        watch: watchCount,
        iot: earphoneIotCount,
      },
    };
  }, [filteredDeviceIots]);

  // 6. Technician Performance Leaderboard
  const technicianStats = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        createdCount: number;
        completedCount: number;
        activeCount: number;
        alertsCount: number;
      }
    > = {};

    filteredShortages.forEach((item) => {
      const creator = (item.creatorTechnician || item.createdBy || 'Chưa phân bổ').trim();
      if (!map[creator]) {
        map[creator] = {
          name: creator,
          createdCount: 0,
          completedCount: 0,
          activeCount: 0,
          alertsCount: 0,
        };
      }
      map[creator].createdCount++;
      if (item.status === 'da_hoan_tat') {
        map[creator].completedCount++;
      } else if (item.status !== 'da_bo_mau') {
        map[creator].activeCount++;
      }

      if (checkOverdue7Days(item).isOverdue || checkSvdPending3Days(item).isSvdPending3Days || checkStep1AgingWarning(item).hasWarning) {
        map[creator].alertsCount++;
      }
    });

    const list = Object.values(map).sort((a, b) => b.createdCount - a.createdCount);
    return list;
  }, [filteredShortages]);

  // 7. Top Demanded Parts and Models
  const topDemandedParts = useMemo(() => {
    const map: Record<
      string,
      {
        code: string;
        name: string;
        model: string;
        count: number;
        completedCount: number;
        stockedCount: number;
      }
    > = {};

    filteredShortages.forEach((item) => {
      const code = (item.partCode || 'KHONG_MA').trim();
      const key = `${code}-${item.partName || ''}`;
      if (!map[key]) {
        map[key] = {
          code: item.partCode || '-',
          name: item.partName || 'Chưa đặt tên',
          model: item.model || '-',
          count: 0,
          completedCount: 0,
          stockedCount: 0,
        };
      }
      map[key].count++;
      if (item.status === 'da_hoan_tat') map[key].completedCount++;
      if (item.status === 'da_nhap_kho' || item.status === 'da_goi_kh' || item.status === 'da_hoan_tat') {
        map[key].stockedCount++;
      }
    });

    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 15);
  }, [filteredShortages]);

  // 8. Warehouse and Catalog Summary
  const catalogStats = useMemo(() => {
    const total = catalogLabels.length;
    let withLocation = 0;
    const catMap: Record<string, number> = {};

    catalogLabels.forEach((item) => {
      if (item.location && item.location.trim() && item.location !== '-') {
        withLocation++;
      }
      const cat = (item.category || 'Khác').trim();
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    const categoryList = Object.entries(catMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      withLocation,
      withoutLocation: total - withLocation,
      locationAssignedRate: total > 0 ? Math.round((withLocation / total) * 100) : 0,
      categories: categoryList,
    };
  }, [catalogLabels]);

  const customPrintTotalLabels = useMemo(() => {
    return customPrintItems.reduce((acc, i) => acc + Math.max(1, i.quantity || 1), 0);
  }, [customPrintItems]);

  // 9. Export Comprehensive Excel Report
  const handleExportExcelReport = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Tổng quan chỉ số
      const summaryRows = [
        ['BÁO CÁO TỔNG QUAN HỆ THỐNG - HCM4 PHÚ LÂM (G-CSM)'],
        [`Kỳ báo cáo: ${periodLabel}`],
        [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`],
        [`Người xuất: ${currentUser?.name || 'Quản Trị Viên'}`],
        [],
        ['CHỈ SỐ TỔNG QUAN', 'SỐ LƯỢNG', 'GHI CHÚ / TỶ LỆ'],
        ['1. ĐẶT CHỜ LINH KIỆN', '', ''],
        ['- Tổng số phiếu trong kỳ', shortageStats.total, 'Phiếu'],
        ['- Hoàn tất (Đã thay)', shortageStats.step5_completed, `${shortageStats.completionRate}%`],
        ['- Đang xử lý / Chờ linh kiện', shortageStats.activeProcessing, 'Phiếu'],
        ['- Bước 1: Đã tạo phiếu', shortageStats.step1_created, 'Phiếu'],
        ['- Bước 2: Đã xin linh kiện', shortageStats.step2_requested, 'Phiếu'],
        ['- Bước 3: Linh kiện đã về kho', shortageStats.step3_stocked, 'Phiếu'],
        ['- Bước 4: Đã gọi báo khách', shortageStats.step4_called, 'Phiếu'],
        ['- Bỏ mẫu / Đóng phiếu', shortageStats.step6_closed, 'Phiếu'],
        ['- Cảnh báo rủi ro / Quá hạn', shortageStats.alerts.totalAlerts, 'Phiếu cần xử lý'],
        [],
        ['2. ĐẶT CHỜ MÁY & IOT', '', ''],
        ['- Tổng máy & IOT tiếp nhận', deviceIotStats.total, 'Máy'],
        ['- Đã sửa xong / Đã bàn giao', deviceIotStats.completed + deviceIotStats.delivered, `${deviceIotStats.completionRate}%`],
        ['- Đang sửa chữa', deviceIotStats.repairing, 'Máy'],
        ['- Đang chờ linh kiện', deviceIotStats.waitingPart, 'Máy'],
        [],
        ['3. KHO LINH KIỆN & TEM IN', '', ''],
        ['- Tổng mã linh kiện catalog', catalogStats.total, 'Mã'],
        ['- Đã xếp vị trí kệ kho', catalogStats.withLocation, `${catalogStats.locationAssignedRate}%`],
        ['- Tem trong hàng đợi in tùy chỉnh', `${customPrintItems.length} mã (${customPrintTotalLabels} tem)`, ''],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Quan_Chi_So');

      // Sheet 2: Danh sách Phiếu Đặt Chờ Linh Kiện
      const shortageDataRows = filteredShortages.map((item, idx) => ({
        STT: idx + 1,
        'Số Phiếu': item.ticketNumber || '-',
        'Mã SP': item.partCode || '-',
        'Tên Linh Kiện': item.partName || '-',
        Model: item.model || '-',
        'Trạng Thái': SHORTAGE_STATUS_CONFIG[item.status]?.label || item.status,
        'Khách Hàng': item.customerName || '-',
        'SĐT Khách': item.customerPhone || '-',
        'Ngày Đặt': item.bookingDate || '-',
        'KTV Tạo Phiếu': item.creatorTechnician || item.createdBy || '-',
        'KTV Xử Lý': item.technicianName || '-',
        'Vị Trí Kệ': item.location || '-',
        'Khách Giữ LK (SVD)': item.customerKeepsPart ? 'Có' : 'Không',
        'Chi Tiết Cuộc Gọi': item.callSubStatus ? SHORTAGE_CALL_SUBSTATUS_CONFIG[item.callSubStatus]?.label : '-',
        'Ghi Chú': item.note || '-',
      }));
      const wsShortage = XLSX.utils.json_to_sheet(shortageDataRows);
      XLSX.utils.book_append_sheet(wb, wsShortage, 'Dat_Cho_Linh_Kien');

      // Sheet 3: Thống kê Kỹ Thuật Viên
      const ktvDataRows = technicianStats.map((k, idx) => ({
        Hạng: idx + 1,
        'Kỹ Thuật Viên': k.name,
        'Tổng Phiếu Tạo': k.createdCount,
        'Hoàn Tất': k.completedCount,
        'Đang Phụ Trách': k.activeCount,
        'Cảnh Báo Quá Hạn': k.alertsCount,
        'Tỷ Lệ Hoàn Tất (%)': k.createdCount > 0 ? `${Math.round((k.completedCount / k.createdCount) * 100)}%` : '0%',
      }));
      const wsKtv = XLSX.utils.json_to_sheet(ktvDataRows);
      XLSX.utils.book_append_sheet(wb, wsKtv, 'Thong_Ke_KTV');

      // Sheet 4: Top Linh Kiện Nhu Cầu Cao
      const partDataRows = topDemandedParts.map((p, idx) => ({
        Top: idx + 1,
        'Mã Linh Kiện': p.code,
        'Tên Linh Kiện': p.name,
        Model: p.model,
        'Số Lượt Đặt': p.count,
        'Đã Nhập Kho': p.stockedCount,
        'Đã Thay / Hoàn Tất': p.completedCount,
      }));
      const wsParts = XLSX.utils.json_to_sheet(partDataRows);
      XLSX.utils.book_append_sheet(wb, wsParts, 'Top_Linh_Kien_Hot');

      // Sheet 5: Đặt chờ máy & IOT
      if (filteredDeviceIots.length > 0) {
        const iotDataRows = filteredDeviceIots.map((d, idx) => ({
          STT: idx + 1,
          'Số Phiếu': d.ticketNumber || '-',
          'Model Máy': d.deviceModel || '-',
          'Tên Thiết Bị': d.deviceName || '-',
          'IMEI / Số Seri': d.imeiOrIot || '-',
          'Phân Loại': d.deviceCategory || 'phone',
          'Quy Trình': d.flowType || '-',
          'Trạng Thái': d.status || '-',
          'Khách Hàng': d.customerName || '-',
          'SĐT Khách': d.customerPhone || '-',
          'Ngày Tiếp Nhận': d.bookingDate || '-',
          'KTV Tiếp Nhận': d.creatorTechnician || d.createdBy || '-',
          'Ghi Chú': d.note || '-',
        }));
        const wsIot = XLSX.utils.json_to_sheet(iotDataRows);
        XLSX.utils.book_append_sheet(wb, wsIot, 'Dat_Cho_May_IOT');
      }

      // Download file
      const fileName = `Bao_Cao_Tong_Quan_HCM4_${timeFilter}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      onShowToast(`Đã xuất báo cáo Excel thành công: ${fileName}`, 'success');
    } catch (err) {
      console.error('Export Excel error:', err);
      onShowToast('Có lỗi khi tạo file Excel báo cáo.', 'error');
    }
  };

  // 10. Direct Print Report Window
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      onShowToast('Trình duyệt đã chặn cửa sổ pop-up in. Vui lòng cho phép pop-up.', 'error');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Báo Cáo Tổng Quan Hệ Thống - HCM4 Phú Lâm</title>
        <style>
          @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
          body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #1f2937; padding: 20px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; color: #065f46; margin: 0 0 4px 0; }
          .subtitle { font-size: 13px; color: #4b5563; }
          .meta-box { text-align: right; font-size: 12px; color: #6b7280; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .kpi-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; text-align: center; }
          .kpi-title { font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; margin-bottom: 4px; }
          .kpi-value { font-size: 24px; font-weight: 800; color: #059669; }
          .kpi-sub { font-size: 11px; color: #6b7280; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
          th { background: #f3f4f6; font-weight: 700; color: #374151; }
          .sec-title { font-size: 14px; font-weight: 700; color: #111827; margin: 16px 0 8px 0; border-left: 4px solid #059669; padding-left: 8px; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; page-break-inside: avoid; }
          .sig-box { width: 200px; font-size: 12px; }
          .sig-line { margin-top: 60px; border-top: 1px solid #374151; padding-top: 4px; font-weight: 700; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">BÁO CÁO TỔNG QUAN TOÀN HỆ THỐNG</h1>
            <div class="subtitle">OPPO Experience & Service Store HCM4 - Phú Lâm</div>
            <div style="font-weight: 600; color: #059669; margin-top: 4px;">Kỳ Báo Cáo: ${periodLabel}</div>
          </div>
          <div class="meta-box">
            <div>Ngày in: ${new Date().toLocaleDateString('vi-VN')}</div>
            <div>Giờ in: ${new Date().toLocaleTimeString('vi-VN')}</div>
            <div>Người lập: ${currentUser?.name || 'Quản Trị Viên'}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Đặt Chờ Linh Kiện</div>
            <div class="kpi-value">${shortageStats.total}</div>
            <div class="kpi-sub">Hoàn tất: ${shortageStats.step5_completed} (${shortageStats.completionRate}%)</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Đặt Chờ Máy & IOT</div>
            <div class="kpi-value">${deviceIotStats.total}</div>
            <div class="kpi-sub">Đã bàn giao: ${deviceIotStats.delivered + deviceIotStats.completed}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Kho Mã Tem In</div>
            <div class="kpi-value">${catalogStats.total}</div>
            <div class="kpi-sub">Đã xếp kệ: ${catalogStats.locationAssignedRate}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Cảnh Báo Quá Hạn</div>
            <div class="kpi-value" style="color: #dc2626;">${shortageStats.alerts.totalAlerts}</div>
            <div class="kpi-sub">>7 ngày: ${shortageStats.alerts.overdue7Days} | B1: ${shortageStats.alerts.step1Aging} | B2: ${shortageStats.alerts.step2Aging} | B3: ${shortageStats.alerts.step3Aging}</div>
          </div>
        </div>

        <div class="sec-title">1. TIẾN ĐỘ XỬ LÝ ĐẶT CHỜ LINH KIỆN THEO 6 BƯỚC</div>
        <table>
          <thead>
            <tr>
              <th>Tiến Độ / Bước Nghiệp Vụ</th>
              <th style="text-align: center;">Số Lượng Phiếu</th>
              <th style="text-align: center;">Tỷ Lệ (%)</th>
              <th>Mô Tả & Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Bước 1:</strong> Đã tạo phiếu chờ</td>
              <td style="text-align: center; font-weight: bold;">${shortageStats.step1_created}</td>
              <td style="text-align: center;">${shortageStats.total > 0 ? Math.round((shortageStats.step1_created / shortageStats.total) * 100) : 0}%</td>
              <td>Tiếp nhận mới, chưa xin linh kiện lên G-CSM</td>
            </tr>
            <tr>
              <td><strong>Bước 2:</strong> Đã xin đủ linh kiện</td>
              <td style="text-align: center; font-weight: bold;">${shortageStats.step2_requested}</td>
              <td style="text-align: center;">${shortageStats.total > 0 ? Math.round((shortageStats.step2_requested / shortageStats.total) * 100) : 0}%</td>
              <td>Đã gửi yêu cầu xin linh kiện, chờ kho điều chuyển</td>
            </tr>
            <tr>
              <td><strong>Bước 3:</strong> Linh kiện đã nhập kho</td>
              <td style="text-align: center; font-weight: bold;">${shortageStats.step3_stocked}</td>
              <td style="text-align: center;">${shortageStats.total > 0 ? Math.round((shortageStats.step3_stocked / shortageStats.total) * 100) : 0}%</td>
              <td>Linh kiện đã về chi nhánh, sẵn sàng gọi báo khách</td>
            </tr>
            <tr>
              <td><strong>Bước 4:</strong> Đã gọi khách báo có LK</td>
              <td style="text-align: center; font-weight: bold;">${shortageStats.step4_called}</td>
              <td style="text-align: center;">${shortageStats.total > 0 ? Math.round((shortageStats.step4_called / shortageStats.total) * 100) : 0}%</td>
              <td>Đã liên hệ, khách hẹn ngày hoặc cần chờ thêm</td>
            </tr>
            <tr style="background: #ecfdf5;">
              <td><strong>Bước 5:</strong> Khách đã lên (Hoàn tất)</td>
              <td style="text-align: center; font-weight: bold; color: #059669;">${shortageStats.step5_completed}</td>
              <td style="text-align: center; font-weight: bold; color: #059669;">${shortageStats.completionRate}%</td>
              <td>Kỹ thuật viên đã thay xong linh kiện & bàn giao máy</td>
            </tr>
            <tr>
              <td><strong>Bước 6:</strong> Linh kiện bỏ mẫu / Đóng phiếu</td>
              <td style="text-align: center; font-weight: bold;">${shortageStats.step6_closed}</td>
              <td style="text-align: center;">${shortageStats.total > 0 ? Math.round((shortageStats.step6_closed / shortageStats.total) * 100) : 0}%</td>
              <td>Khách hủy, không liên lạc được hoặc không thay</td>
            </tr>
          </tbody>
        </table>

        <div class="sec-title">2. XẾP HẠNG & HIỆU SUẤT THEO KỸ THUẬT VIÊN</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Kỹ Thuật Viên</th>
              <th style="text-align: center;">Phiếu Tạo</th>
              <th style="text-align: center;">Hoàn Tất</th>
              <th style="text-align: center;">Đang Chờ</th>
              <th style="text-align: center;">Tồn Đọng Cảnh Báo</th>
              <th style="text-align: center;">Tỷ Lệ (%)</th>
            </tr>
          </thead>
          <tbody>
            ${technicianStats.slice(0, 10).map((k, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${k.name}</strong></td>
                <td style="text-align: center; font-weight: bold;">${k.createdCount}</td>
                <td style="text-align: center; color: #059669; font-weight: bold;">${k.completedCount}</td>
                <td style="text-align: center;">${k.activeCount}</td>
                <td style="text-align: center; color: ${k.alertsCount > 0 ? '#dc2626' : '#4b5563'}; font-weight: ${k.alertsCount > 0 ? 'bold' : 'normal'};">${k.alertsCount}</td>
                <td style="text-align: center; font-weight: bold;">${k.createdCount > 0 ? Math.round((k.completedCount / k.createdCount) * 100) : 0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div class="sig-box">
            <div><strong>Người Lập Báo Cáo</strong></div>
            <div style="color: #6b7280; font-size: 11px;">(Ký & ghi rõ họ tên)</div>
            <div class="sig-line">${currentUser?.name || 'Nhân Viên'}</div>
          </div>
          <div class="sig-box">
            <div><strong>Trưởng Nhóm / Quản Lý Kho</strong></div>
            <div style="color: #6b7280; font-size: 11px;">(Ký & ghi rõ họ tên)</div>
            <div class="sig-line">Xác nhận</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 max-w-7xl mx-auto w-full">
      {/* Header & Filter Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Title and Scope Info */}
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl text-white shadow-xs">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                Tổng Quan Báo Cáo Hệ Thống
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-2xs">
                HCM4 - Phú Lâm
              </span>
              {cloudSynced ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Cloud Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Offline Cache
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Trung tâm phân tích số liệu toàn diện: Đặt chờ linh kiện, Đặt chờ máy & IOT, Kho linh kiện và Tem in.
            </p>
          </div>
        </div>

        {/* Action Tools: Refresh Cloud Data, Export Excel, Print Report */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRefreshCloudData && (
            <button
              type="button"
              onClick={onRefreshCloudData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
              title="Làm mới và đồng bộ dữ liệu mới nhất từ Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-stone-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcelReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            title="Xuất toàn bộ báo cáo phân tích ra file Excel đa trang tính"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Báo Cáo Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            title="In trang báo cáo tổng quan tiêu chuẩn A4 hoặc lưu PDF"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>In Báo Cáo</span>
          </button>
        </div>
      </div>

      {/* Time Filter Bar (Lựa chọn theo tháng / thời gian) */}
      <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-stone-700 flex items-center gap-1 mr-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Kỳ báo cáo:</span>
          </span>

          <button
            type="button"
            onClick={() => setTimeFilter('this_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'this_month'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
            }`}
          >
            Tháng Này ({String(currentMonth).padStart(2, '0')}/{currentYear})
          </button>

          <button
            type="button"
            onClick={() => setTimeFilter('last_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'last_month'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
            }`}
          >
            Tháng Trước
          </button>

          <button
            type="button"
            onClick={() => setTimeFilter('custom_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'custom_month'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
            }`}
          >
            Chọn Tháng Cụ Thể
          </button>

          <button
            type="button"
            onClick={() => setTimeFilter('last_30_days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'last_30_days'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
            }`}
          >
            30 Ngày Qua
          </button>

          <button
            type="button"
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
            }`}
          >
            Tất Cả Thời Gian
          </button>
        </div>

        {/* Custom Month / Year Selectors when 'custom_month' is active */}
        {timeFilter === 'custom_month' && (
          <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-300 px-2.5 py-1 rounded-lg animate-in fade-in duration-150">
            <span className="text-xs font-bold text-emerald-900">Tháng:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-white border border-emerald-300 rounded px-2 py-0.5 text-xs font-bold text-stone-800 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>

            <span className="text-xs font-bold text-emerald-900">Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-white border border-emerald-300 rounded px-2 py-0.5 text-xs font-bold text-stone-800 cursor-pointer"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current Active Period Badge */}
        <div className="flex items-center gap-1.5 text-xs text-stone-600 bg-stone-50 border border-stone-200 px-3 py-1 rounded-lg">
          <span className="font-semibold">Đang hiển thị:</span>
          <strong className="text-emerald-700 font-bold">{periodLabel}</strong>
          <span className="text-stone-300">|</span>
          <span className="font-mono font-bold text-stone-700">{filteredShortages.length} phiếu LK</span>
        </div>
      </div>

      {/* Key KPI Metric Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Đặt Chờ Linh Kiện */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Đặt Chờ Linh Kiện
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-stone-900 font-mono">
                  {shortageStats.total}
                </span>
                <span className="text-xs font-semibold text-stone-500">phiếu trong kỳ</span>
              </div>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-700 border border-emerald-200">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Hoàn tất (Đã thay):
              </span>
              <span className="font-bold text-emerald-700 font-mono">
                {shortageStats.step5_completed} ({shortageStats.completionRate}%)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Đang xử lý / Xin LK:
              </span>
              <span className="font-bold text-blue-700 font-mono">{shortageStats.activeProcessing}</span>
            </div>

            <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden mt-1">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${shortageStats.completionRate}%` }}
              ></div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToMode('shortage', 'shortage-main')}
            className="mt-3 w-full inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
          >
            <span>Mở phiếu đặt chờ LK</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Đặt Chờ Máy & IOT */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Đặt Chờ Máy & IOT
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-stone-900 font-mono">
                  {deviceIotStats.total}
                </span>
                <span className="text-xs font-semibold text-stone-500">thiết bị</span>
              </div>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-700 border border-blue-200">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Đã bàn giao khách:
              </span>
              <span className="font-bold text-emerald-700 font-mono">
                {deviceIotStats.delivered + deviceIotStats.completed} ({deviceIotStats.completionRate}%)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Đang sửa / Chờ LK:
              </span>
              <span className="font-bold text-amber-700 font-mono">
                {deviceIotStats.repairing + deviceIotStats.waitingPart}
              </span>
            </div>

            <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden mt-1">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${deviceIotStats.completionRate}%` }}
              ></div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToMode('device_iot', 'device-main')}
            className="mt-3 w-full inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
          >
            <span>Mở phiếu máy & IOT</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Kho Linh Kiện & Tem In */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Kho Linh Kiện & Tem In
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-stone-900 font-mono">
                  {catalogStats.total.toLocaleString('vi-VN')}
                </span>
                <span className="text-xs font-semibold text-stone-500">mã kho</span>
              </div>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-700 border border-indigo-200">
              <Tag className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Đã gán vị trí kệ kho:
              </span>
              <span className="font-bold text-indigo-700 font-mono">
                {catalogStats.withLocation} ({catalogStats.locationAssignedRate}%)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Hàng đợi in tùy chỉnh:
              </span>
              <span className="font-bold text-emerald-700 font-mono">
                {customPrintItems.length} mã ({customPrintTotalLabels} tem)
              </span>
            </div>

            <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden mt-1">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${catalogStats.locationAssignedRate}%` }}
              ></div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToMode('labels', 'labels-split', 'split')}
            className="mt-3 w-full inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
          >
            <span>Mở kho & in tem 3x2</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 4: Cảnh Báo & Tồn Đọng Rủi Ro */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Cảnh Báo & Tồn Đọng
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
                  {shortageStats.alerts.totalAlerts}
                </span>
                <span className="text-xs font-semibold text-rose-500">cảnh báo</span>
              </div>
            </div>
            <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 border border-rose-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                <span className="truncate">Quá hạn gọi &gt; 7 ngày:</span>
              </span>
              <span className="font-bold text-rose-600 font-mono shrink-0">
                {shortageStats.alerts.overdue7Days} phiếu
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span className="truncate">B1: Chưa xin LK (&gt;24h):</span>
              </span>
              <span className="font-bold text-amber-700 font-mono shrink-0">
                {shortageStats.alerts.step1Aging} phiếu
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0"></span>
                <span className="truncate">B2: Đã xin chờ điều phối:</span>
              </span>
              <span className="font-bold text-amber-800 font-mono shrink-0">
                {shortageStats.alerts.step2Aging} phiếu
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                <span className="truncate">B3: Về kho chưa gọi khách:</span>
              </span>
              <span className="font-bold text-blue-700 font-mono shrink-0">
                {shortageStats.alerts.step3Aging} phiếu
              </span>
            </div>

            {shortageStats.alerts.svdOverdue3Days > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-stone-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                  <span className="truncate">SVD giữ máy &gt; 3 ngày:</span>
                </span>
                <span className="font-bold text-purple-700 font-mono shrink-0">
                  {shortageStats.alerts.svdOverdue3Days} phiếu
                </span>
              </div>
            )}

            {shortageStats.pendingApprovalCount > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-dashed border-stone-200">
                <span className="text-purple-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                  <span className="truncate font-medium">Chờ duyệt hủy/sửa:</span>
                </span>
                <span className="font-bold text-purple-700 font-mono shrink-0">
                  {shortageStats.pendingApprovalCount} phiếu
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateToMode('shortage', 'shortage-warnings')}
            className="mt-3 w-full inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
          >
            <span>Xử lý danh sách cảnh báo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Analysis Sections Tab Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        {/* Navigation Tab Pills */}
        <div className="border-b border-neutral-200 px-4 pt-3 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveReportTab('pipeline')}
            className={`pb-3 px-3.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeReportTab === 'pipeline'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Tiến Độ 6 Bước Đặt Chờ</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono">
              {shortageStats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReportTab('technicians')}
            className={`pb-3 px-3.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeReportTab === 'technicians'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Hiệu Suất Kỹ Thuật Viên</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-700 text-[10px] font-mono">
              {technicianStats.length} KTV
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReportTab('parts')}
            className={`pb-3 px-3.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeReportTab === 'parts'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Top Linh Kiện Nhu Cầu Cao</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-700 text-[10px] font-mono">
              Top 15
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReportTab('device_iot')}
            className={`pb-3 px-3.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeReportTab === 'device_iot'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Báo Cáo Máy & IOT</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono">
              {deviceIotStats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReportTab('alerts')}
            className={`pb-3 px-3.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeReportTab === 'alerts'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>Cảnh Báo Cần Xử Lý Ngay</span>
            {shortageStats.alerts.totalAlerts > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold animate-pulse">
                {shortageStats.alerts.totalAlerts}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Tiến Độ 6 Bước Đặt Chờ LK */}
        {activeReportTab === 'pipeline' && (
          <div className="p-4 sm:p-5 space-y-5">
            {/* Visual Funnel Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Bước 1 */}
              <div className="border border-neutral-200 rounded-xl p-4 bg-stone-50/50 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700">Bước 1: Đã tạo phiếu chờ</span>
                  <span className="font-mono font-black text-base text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                    {shortageStats.step1_created}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Phiếu vừa tiếp nhận, chưa thực hiện gửi yêu cầu xin linh kiện trên cổng G-CSM.
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-200">
                  <span>Tỷ lệ: {shortageStats.total > 0 ? Math.round((shortageStats.step1_created / shortageStats.total) * 100) : 0}%</span>
                  {shortageStats.alerts.step1Aging > 0 && (
                    <span className="text-amber-700 font-bold">⚠️ {shortageStats.alerts.step1Aging} quá 24h</span>
                  )}
                </div>
              </div>

              {/* Bước 2 */}
              <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">Bước 2: Đã xin đủ linh kiện</span>
                  <span className="font-mono font-black text-base text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">
                    {shortageStats.step2_requested}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Đã tạo PO xin linh kiện trên hệ thống G-CSM, đang chờ kho tổng điều chuyển về trung tâm.
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-blue-100">
                  <span>Tỷ lệ: {shortageStats.total > 0 ? Math.round((shortageStats.step2_requested / shortageStats.total) * 100) : 0}%</span>
                  {shortageStats.alerts.step2Aging > 0 && (
                    <span className="text-amber-700 font-bold">⚠️ {shortageStats.alerts.step2Aging} chờ lâu</span>
                  )}
                </div>
              </div>

              {/* Bước 3 */}
              <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/30 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900">Bước 3: Linh kiện đã về kho</span>
                  <span className="font-mono font-black text-base text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    {shortageStats.step3_stocked}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Linh kiện đã nhập kho chi nhánh, sẵn sàng gọi điện thông báo cho khách hàng mang máy lên.
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-indigo-100">
                  <span>Tỷ lệ: {shortageStats.total > 0 ? Math.round((shortageStats.step3_stocked / shortageStats.total) * 100) : 0}%</span>
                  {shortageStats.alerts.step3Aging > 0 && (
                    <span className="text-amber-700 font-bold">⚠️ {shortageStats.alerts.step3Aging} chưa gọi</span>
                  )}
                </div>
              </div>

              {/* Bước 4 */}
              <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/30 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900">Bước 4: Đã gọi báo khách hàng</span>
                  <span className="font-mono font-black text-base text-purple-900 bg-white px-2 py-0.5 rounded border border-purple-200">
                    {shortageStats.step4_called}
                  </span>
                </div>
                <div className="text-xs text-stone-600 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>• Hẹn ngày khách lên:</span>
                    <strong className="text-stone-800">{shortageStats.callSubStats.hen_ngay}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>• Không nghe máy / bận:</span>
                    <strong className="text-stone-800">{shortageStats.callSubStats.khong_nghe_may}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>• Chờ thêm (công tác...):</span>
                    <strong className="text-stone-800">{shortageStats.callSubStats.cho_them_thoi_gian}</strong>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-purple-100">
                  <span>Tỷ lệ: {shortageStats.total > 0 ? Math.round((shortageStats.step4_called / shortageStats.total) * 100) : 0}%</span>
                  {shortageStats.alerts.overdue7Days > 0 && (
                    <span className="text-rose-700 font-bold">🚨 {shortageStats.alerts.overdue7Days} quá 7 ngày</span>
                  )}
                </div>
              </div>

              {/* Bước 5 */}
              <div className="border border-emerald-300 rounded-xl p-4 bg-emerald-50/40 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">Bước 5: Khách đã lên (Hoàn tất)</span>
                  <span className="font-mono font-black text-base text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                    {shortageStats.step5_completed}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-2">
                  Kỹ thuật viên đã thay xong linh kiện thành công, đóng phiếu và bàn giao máy cho khách hàng.
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-emerald-900 pt-2 border-t border-emerald-200">
                  <span className="font-bold">Tỷ lệ thành công:</span>
                  <strong className="text-emerald-700 font-extrabold text-sm">{shortageStats.completionRate}%</strong>
                </div>
              </div>

              {/* Bước 6 */}
              <div className="border border-neutral-200 rounded-xl p-4 bg-stone-50/50 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700">Bước 6: Bỏ mẫu / Đóng phiếu</span>
                  <span className="font-mono font-black text-base text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                    {shortageStats.step6_closed}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Linh kiện không còn sản xuất, khách báo hủy hoặc quá hạn không liên hệ được.
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-200">
                  <span>Tỷ lệ: {shortageStats.total > 0 ? Math.round((shortageStats.step6_closed / shortageStats.total) * 100) : 0}%</span>
                  <span>Đã đóng phiếu</span>
                </div>
              </div>
            </div>

            {/* Special Indicators Summary (SVD, Call Holds) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-800">
                    Khách Giữ LK (SVD): <span className="text-purple-700 font-mono">{shortageStats.svdCount} phiếu</span>
                  </div>
                  <div className="text-[11px] text-stone-500">Khách cầm máy hoặc linh kiện cũ về</div>
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-800">
                    Khách Gọi Đặt Giữ: <span className="text-blue-700 font-mono">{shortageStats.callHoldCount} phiếu</span>
                  </div>
                  <div className="text-[11px] text-stone-500">Khách gọi điện thoại đặt trước chưa gửi máy</div>
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-800">
                    Yêu Cầu Duyệt Hủy/Sửa: <span className="text-amber-700 font-mono">{shortageStats.pendingApprovalCount} phiếu</span>
                  </div>
                  <div className="text-[11px] text-stone-500">Chờ Quản Trị Viên phê duyệt</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hiệu Suất Kỹ Thuật Viên */}
        {activeReportTab === 'technicians' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Search Bar for KTV */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên Kỹ thuật viên..."
                  value={ktvSearchQuery}
                  onChange={(e) => setKtvSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
              <span className="text-xs text-stone-500">
                Hiển thị <strong>{technicianStats.length}</strong> Kỹ thuật viên có phát sinh phiếu trong kỳ.
              </span>
            </div>

            {/* Table of Technicians */}
            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                  <tr>
                    <th className="p-2.5 w-12 text-center">#</th>
                    <th className="p-2.5">Kỹ Thuật Viên</th>
                    <th className="p-2.5 text-center w-24">Phiếu Tạo</th>
                    <th className="p-2.5 text-center w-24">Hoàn Tất</th>
                    <th className="p-2.5 text-center w-24">Đang Chờ</th>
                    <th className="p-2.5 text-center w-28">Cảnh Báo Quá Hạn</th>
                    <th className="p-2.5 text-center w-28">Tỷ Lệ Hoàn Tất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {technicianStats
                    .filter((k) => k.name.toLowerCase().includes(ktvSearchQuery.toLowerCase()))
                    .map((ktv, idx) => {
                      const rate = ktv.createdCount > 0 ? Math.round((ktv.completedCount / ktv.createdCount) * 100) : 0;
                      return (
                        <tr key={ktv.name} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="p-2.5 text-center font-bold text-stone-500">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-stone-900 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {ktv.name.charAt(0)}
                            </div>
                            <span>{ktv.name}</span>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-stone-800">
                            {ktv.createdCount}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                            {ktv.completedCount}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-blue-700">
                            {ktv.activeCount}
                          </td>
                          <td className="p-2.5 text-center font-mono">
                            {ktv.alertsCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[11px]">
                                {ktv.alertsCount} phiếu
                              </span>
                            ) : (
                              <span className="text-stone-400">-</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-mono font-bold text-xs text-stone-800">{rate}%</span>
                              <div className="w-16 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-600 h-full rounded-full"
                                  style={{ width: `${rate}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {technicianStats.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-stone-400">
                        Chưa có dữ liệu kỹ thuật viên trong kỳ báo cáo này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Top Linh Kiện Nhu Cầu Cao */}
        {activeReportTab === 'parts' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Search Bar for Parts */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Tìm theo mã SP, tên linh kiện, model..."
                  value={partSearchQuery}
                  onChange={(e) => setPartSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
              <span className="text-xs text-stone-500">
                Top 15 linh kiện có nhu cầu đặt chờ cao nhất giúp thủ kho chủ động đề xuất nhập kho.
              </span>
            </div>

            {/* Table of Top Parts */}
            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                  <tr>
                    <th className="p-2.5 w-12 text-center">Top</th>
                    <th className="p-2.5 w-32">Mã SP</th>
                    <th className="p-2.5">Tên Linh Kiện</th>
                    <th className="p-2.5 w-32">Model</th>
                    <th className="p-2.5 text-center w-24">Số Lượt Đặt</th>
                    <th className="p-2.5 text-center w-24">Đã Về Kho</th>
                    <th className="p-2.5 text-center w-24">Đã Thay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {topDemandedParts
                    .filter((p) =>
                      `${p.code} ${p.name} ${p.model}`.toLowerCase().includes(partSearchQuery.toLowerCase())
                    )
                    .map((part, idx) => (
                      <tr key={`${part.code}-${idx}`} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="p-2.5 text-center">
                          <span
                            className={`w-5 h-5 rounded-full inline-flex items-center justify-center font-bold text-[11px] ${
                              idx === 0
                                ? 'bg-amber-400 text-amber-950 shadow-xs'
                                : idx === 1
                                ? 'bg-stone-300 text-stone-900'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'text-stone-500'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-800">{part.code}</td>
                        <td className="p-2.5 font-bold text-stone-900">{part.name}</td>
                        <td className="p-2.5 text-stone-600">{part.model}</td>
                        <td className="p-2.5 text-center font-mono font-black text-stone-900 bg-stone-50">
                          {part.count}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-indigo-700">
                          {part.stockedCount}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                          {part.completedCount}
                        </td>
                      </tr>
                    ))}
                  {topDemandedParts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-stone-400">
                        Chưa có dữ liệu linh kiện trong kỳ báo cáo này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Báo Cáo Máy & IOT */}
        {activeReportTab === 'device_iot' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl">
                <span className="text-xs font-bold text-blue-900">Điện Thoại OPPO:</span>
                <div className="text-2xl font-black font-mono text-blue-900 mt-1">
                  {deviceIotStats.deviceTypes.phone}
                </div>
                <span className="text-[11px] text-blue-700">Find X, Reno, A Series...</span>
              </div>

              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                <span className="text-xs font-bold text-indigo-900">Máy Tính Bảng (Pad):</span>
                <div className="text-2xl font-black font-mono text-indigo-900 mt-1">
                  {deviceIotStats.deviceTypes.pad}
                </div>
                <span className="text-[11px] text-indigo-700">OPPO Pad, Pad Air...</span>
              </div>

              <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl">
                <span className="text-xs font-bold text-purple-900">Đồng Hồ / Vòng Đeo:</span>
                <div className="text-2xl font-black font-mono text-purple-900 mt-1">
                  {deviceIotStats.deviceTypes.watch}
                </div>
                <span className="text-[11px] text-purple-700">OPPO Watch, Watch Free...</span>
              </div>

              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <span className="text-xs font-bold text-emerald-900">Tai Nghe / IOT Khác:</span>
                <div className="text-2xl font-black font-mono text-emerald-900 mt-1">
                  {deviceIotStats.deviceTypes.iot}
                </div>
                <span className="text-[11px] text-emerald-700">Enco Air, Enco X, Router...</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => onNavigateToMode('device_iot', 'device-main')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <span>Mở quản lý chi tiết Máy & IOT</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Cảnh Báo Cần Xử Lý Ngay */}
        {activeReportTab === 'alerts' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Danh sách phiếu đang có cờ cảnh báo SLA trong kỳ ({shortageStats.alerts.totalAlerts} phiếu)</span>
              </h3>

              <button
                type="button"
                onClick={() => onNavigateToMode('shortage', 'shortage-warnings')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                <span>Mở tab Cảnh Báo chi tiết</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5 w-28">Số Phiếu</th>
                    <th className="p-2.5">Linh Kiện / Model</th>
                    <th className="p-2.5 w-36">Khách Hàng & SĐT</th>
                    <th className="p-2.5 w-32">KTV Phụ Trách</th>
                    <th className="p-2.5 w-44">Loại Cảnh Báo</th>
                    <th className="p-2.5 text-center w-24">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredShortages
                    .filter(
                      (item) =>
                        checkOverdue7Days(item).isOverdue ||
                        checkSvdPending3Days(item).isSvdPending3Days ||
                        checkStep1AgingWarning(item).hasWarning ||
                        checkStep2AgingWarning(item).hasWarning ||
                        checkStep3AgingWarning(item).hasWarning ||
                        item.cancelRequested ||
                        item.editRequested
                    )
                    .map((item, idx) => {
                      const is7d = checkOverdue7Days(item).isOverdue;
                      const isSvd3d = checkSvdPending3Days(item).isSvdPending3Days;
                      const isStep1 = checkStep1AgingWarning(item).hasWarning;
                      const isStep2 = checkStep2AgingWarning(item).hasWarning;
                      const isStep3 = checkStep3AgingWarning(item).hasWarning;
                      return (
                        <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                          <td className="p-2.5 text-center font-bold text-stone-400">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-emerald-800">{item.ticketNumber || '-'}</td>
                          <td className="p-2.5">
                            <div className="font-bold text-stone-900">{item.partName}</div>
                            <div className="text-[11px] text-stone-500">{item.partCode} • {item.model}</div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-stone-800">{item.customerName}</div>
                            <div className="text-[11px] text-stone-500">{item.customerPhone}</div>
                          </td>
                          <td className="p-2.5 text-stone-700">
                            {item.creatorTechnician || item.createdBy || '-'}
                          </td>
                          <td className="p-2.5">
                            <div className="flex flex-wrap gap-1">
                              {is7d && (
                                <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[11px] border border-rose-200">
                                  🚨 Quá hạn 7 ngày
                                </span>
                              )}
                              {isSvd3d && (
                                <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[11px] border border-purple-200">
                                  ⚠️ SVD &gt; 3 ngày
                                </span>
                              )}
                              {isStep1 && (
                                <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200">
                                  ⏳ B1: Chưa xin LK &gt; 24h
                                </span>
                              )}
                              {isStep2 && (
                                <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300">
                                  📦 B2: Đã xin chờ lâu
                                </span>
                              )}
                              {isStep3 && (
                                <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200">
                                  📞 B3: Về kho chưa gọi
                                </span>
                              )}
                              {item.cancelRequested && (
                                <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[11px] border border-rose-300">
                                  🛑 Chờ duyệt hủy
                                </span>
                              )}
                              {item.editRequested && (
                                <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-300">
                                  📝 Chờ duyệt sửa
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => onNavigateToMode('shortage', 'shortage-warnings')}
                              className="px-2 py-1 bg-stone-100 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-xs transition-colors cursor-pointer"
                            >
                              Xử lý →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {shortageStats.alerts.totalAlerts === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-emerald-700 font-bold">
                        🎉 Tuyệt vời! Hiện không có phiếu nào bị quá hạn hoặc cảnh báo trong kỳ báo cáo này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
