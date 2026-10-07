import { DeviceIotBookingItem, DeviceIotStatus, DeviceIotFlowType, DeviceIotCategory } from '../types/deviceIot';
import * as XLSX from 'xlsx';
import bundledDb from '../data/bundledDatabase.json';

export const INITIAL_DEVICE_IOT_DATA: DeviceIotBookingItem[] = [];

const STORAGE_KEY = 'label_studio_device_iot_bookings_v1';

export function loadLocalDeviceIotBookings(): DeviceIotBookingItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load local device & IoT bookings:', e);
  }

  if (bundledDb && Array.isArray(bundledDb.deviceIots) && bundledDb.deviceIots.length > 0) {
    return bundledDb.deviceIots as unknown as DeviceIotBookingItem[];
  }

  return [];
}

export function saveLocalDeviceIotBookings(items: DeviceIotBookingItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    localStorage.setItem('label_studio_device_iot_initialized', 'true');
  } catch (e) {
    console.warn('Failed to save local device & IoT bookings:', e);
  }
}

export function formatDateTimeVi(date: Date = new Date()): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hr = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hr}:${min}`;
}

// User standard loan format: 29/8/2026 ; 9H13
export function formatLoanTimeVi(date: Date = new Date()): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const hr = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ; ${hr}H${min}`;
}

export function formatDateVi(date: Date = new Date()): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function generateDeviceIotTicketNumber(existingCount: number = 0): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(existingCount + 1).padStart(3, '0');
  return `DM-${yy}${mm}-${seq}`;
}

// Format: VN001021-AS2608290003
export function generateLoanTicketNumber(existingCount: number = 0): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seq = String(existingCount + 1).padStart(4, '0');
  return `VN001021-AS${yy}${mm}${dd}${seq}`;
}

function parseDateToMillis(dateStr?: string): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hours = match[4] ? parseInt(match[4], 10) : 0;
    const minutes = match[5] ? parseInt(match[5], 10) : 0;
    return new Date(year, month, day, hours, minutes).getTime() || 0;
  }
  const iso = new Date(trimmed).getTime();
  return isNaN(iso) ? 0 : iso;
}

// Export to Excel
export function exportDeviceIotToExcel(items: DeviceIotBookingItem[], filename = 'Danh_Sach_May_Va_IOT.xlsx') {
  // Tính STT theo thời gian tạo: tạo trước là 1 và tăng dần
  const sorted = [...items].sort((a, b) => {
    const tA = parseDateToMillis(a.bookingDate || a.createdAt || a.updatedAt);
    const tB = parseDateToMillis(b.bookingDate || b.createdAt || b.updatedAt);
    if (tA !== tB) return tA - tB;
    const ticketA = (a.ticketNumber || '').trim();
    const ticketB = (b.ticketNumber || '').trim();
    if (ticketA && ticketB && ticketA !== ticketB) return ticketA.localeCompare(ticketB);
    return (a.id || '').localeCompare(b.id || '');
  });
  const sttMap = new Map<string, number>();
  sorted.forEach((item, index) => sttMap.set(item.id, index + 1));

  const data = items.map((item, idx) => {
    let flowLabel = 'Chờ xin máy';
    if (item.flowType === 'direct_exchange') flowLabel = 'Có sẵn máy - Đổi trực tiếp';
    if (item.flowType === 'customer_loan') flowLabel = 'Máy Khách Mượn';

    let statusLabel = '';
    switch (item.status) {
      case 'co_san_may':
        statusLabel = '1. Có sẵn máy (Đổi trực tiếp)';
        break;
      case 'cho_xin_may':
        statusLabel = '1. Chờ xin máy';
        break;
      case 'da_xin_may':
        statusLabel = '2. Đã xin máy';
        break;
      case 'da_nhap_kho':
        statusLabel = '3. Đã nhập kho';
        break;
      case 'da_goi_kh':
        statusLabel = '4. Đã gọi khách lên';
        break;
      case 'da_hoan_tat':
        statusLabel = '5. Khách đã lên (Hoàn thành)';
        break;
      case 'dang_muon':
        statusLabel = 'Đang mượn máy';
        break;
      case 'da_tra':
        statusLabel = 'Khách đã trả máy (Hoàn thành)';
        break;
    }

    const depositText = item.flowType === 'customer_loan'
      ? item.depositType === 'co_coc'
        ? `Có cọc (${item.depositAmount ? Number(item.depositAmount).toLocaleString('vi-VN') + 'đ' : 'Chưa nhập số tiền'})`
        : 'Không cọc'
      : '';

    return {
      'STT': sttMap.get(item.id) ?? (idx + 1),
      'Số Phiếu': item.ticketNumber,
      'Tên Khách Hàng': item.customerName,
      'Số Điện Thoại': item.customerPhone,
      'Model Máy': item.deviceModel,
      'Tên Máy / Thiết Bị': item.deviceName,
      'Mã SKU': item.skuCode || '',
      'IMEI Máy / IOT': item.imeiOrIot,
      'Quy Trình': flowLabel,
      'Trạng Thái': statusLabel,
      'Đặt Cọc (Nếu Mượn)': depositText,
      'TG Khách Mượn': item.borrowedDate || '',
      'TG Khách Trả': item.returnedDate || '',
      'Vị Trí Kệ / Tủ': item.location || '',
      'Ngày Tiếp Nhận': item.bookingDate,
      'Ngày Xin Máy': item.requestedDate || '',
      'Ngày Nhập Kho': item.stockedInDate || '',
      'Ngày Gọi Khách': item.calledCustomerDate || '',
      'Số Lần Gọi KH': item.callLogs && item.callLogs.length > 0 ? item.callLogs.length : (item.calledCustomerDate ? 1 : 0),
      'Kết Quả Gọi KH': item.callSubStatus || '',
      'Ngày Hẹn': item.appointmentDate || '',
      'Ghi Chú Cuộc Gọi': item.callNote || '',
      'Lịch Sử Các Lần Gọi': item.callLogs && item.callLogs.length > 0
        ? item.callLogs.map((c, i) => `[Lần ${i + 1}] ${c.calledDate}: ${c.subStatus}${c.appointmentDate ? ` (Hẹn: ${c.appointmentDate})` : ''}${c.note ? ` - ${c.note}` : ''}${c.callerName ? ` (${c.callerName})` : ''}`).join(' | ')
        : (item.callNote || ''),
      'Ngày Hoàn Tất': item.customerArrivedDate || '',
      'KTV Bàn Giao / Xử Lý': item.loanHandoverBy || item.technicianName || '',
      'KTV Nhận Máy Trả': item.loanReceivedBy || '',
      'Tình Trạng / Phụ Kiện': [item.loanCondition, item.loanAccessories].filter(Boolean).join(' | '),
      'Ghi Chú': item.note || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dat_Cho_Va_Muon_May');
  XLSX.writeFile(workbook, filename);
}

// Download Sample Template
export function downloadSampleDeviceIotExcel() {
  const sampleData = [
    {
      'Số Phiếu': 'VN001021-AS2608290003',
      'Tên Khách Hàng': 'Nguyễn Văn Minh',
      'Số Điện Thoại': '0909887766',
      'Model Máy': 'RENO 3 PRO',
      'Tên Máy': 'OPPO Reno 3 Pro Đen',
      'Mã SKU': '601011001890',
      'IMEI / IOT': '864291048821902',
      'Phân Loại': 'Điện thoại',
      'Quy Trình': 'Máy Khách Mượn',
      'Có Cọc Hay Không': 'Không cọc',
      'Số Tiền Cọc': '',
      'TG Khách Mượn': '29/8/2026 ; 9H13',
      'TG Khách Trả': '',
      'Vị Trí Tủ/Kệ': 'Tủ Máy Mượn - A1',
      'Ghi Chú': 'Mượn tạm trong lúc chờ linh kiện',
    },
    {
      'Số Phiếu': 'DM-2608-001',
      'Tên Khách Hàng': 'Trần Văn Hoàng',
      'Số Điện Thoại': '0901234567',
      'Model Máy': 'Find X8 Pro',
      'Tên Máy': 'OPPO Find X8 Pro 5G Trắng',
      'Mã SKU': '601011002341',
      'IMEI / IOT': '864192068899123',
      'Phân Loại': 'Điện thoại',
      'Quy Trình': 'Có sẵn máy - Đổi trực tiếp',
      'Có Cọc Hay Không': '',
      'Số Tiền Cọc': '',
      'TG Khách Mượn': '',
      'TG Khách Trả': '',
      'Vị Trí Tủ/Kệ': 'Tủ Đổi Máy - Kệ A1',
      'Ghi Chú': 'Lỗi nguồn trong 30 ngày',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_May_Va_IOT');
  XLSX.writeFile(wb, 'Mau_Nhap_May_Va_IOT.xlsx');
}

// Read Excel File
export function parseDeviceIotExcelFile(file: File): Promise<Partial<DeviceIotBookingItem>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        const parsedItems: Partial<DeviceIotBookingItem>[] = jsonData.map((row) => {
          const ticketNumber = String(row['Số Phiếu'] || row['Số phiếu'] || row['Mã Phiếu'] || row['ticketNumber'] || '').trim();
          const customerName = String(row['Tên Khách Hàng'] || row['Tên khách hàng'] || row['Khách Hàng'] || row['customerName'] || '').trim();
          const customerPhone = String(row['Số Điện Thoại'] || row['Số điện thoại'] || row['SĐT'] || row['customerPhone'] || '').trim();
          const deviceModel = String(row['Model Máy'] || row['Model máy'] || row['Model'] || row['deviceModel'] || '').trim();
          const deviceName = String(row['Tên Máy'] || row['Tên máy'] || row['Tên Máy / Thiết Bị'] || row['deviceName'] || '').trim();
          const skuCode = String(row['Mã SKU'] || row['Mã sku'] || row['SKU'] || row['skuCode'] || '').trim();
          const imeiOrIot = String(row['IMEI Máy / IOT'] || row['IMEI / IOT'] || row['Imei'] || row['IMEI'] || row['imeiOrIot'] || '').trim();
          const note = String(row['Ghi Chú'] || row['Ghi chú'] || row['note'] || '').trim();
          const location = String(row['Vị Trí Kệ / Tủ'] || row['Vị Trí'] || row['Vị trí'] || row['location'] || '').trim();
          const rawFlow = String(row['Quy Trình'] || row['Quy trình'] || row['flowType'] || '').toLowerCase();
          const rawDeposit = String(row['Có Cọc Hay Không'] || row['Có Cọc'] || row['Cọc'] || row['hasDeposit'] || '').toLowerCase();
          const depositAmount = row['Số Tiền Cọc'] || row['Tiền Cọc'] || row['depositAmount'] || '';
          const borrowedDate = String(row['TG Khách Mượn'] || row['Khách mượn'] || row['borrowedDate'] || '').trim();
          const returnedDate = String(row['TG Khách Trả'] || row['Khách trả'] || row['returnedDate'] || '').trim();

          let flowType: DeviceIotFlowType = 'request_device';
          if (rawFlow.includes('mượn') || rawFlow.includes('muon') || rawFlow.includes('loan')) {
            flowType = 'customer_loan';
          } else if (rawFlow.includes('có sẵn') || rawFlow.includes('co san') || rawFlow.includes('trực tiếp') || rawFlow.includes('direct')) {
            flowType = 'direct_exchange';
          }

          let status: DeviceIotStatus = 'cho_xin_may';
          if (flowType === 'direct_exchange') {
            status = 'co_san_may';
          } else if (flowType === 'customer_loan') {
            status = returnedDate ? 'da_tra' : 'dang_muon';
          }

          const hasDeposit = rawDeposit.includes('có') || rawDeposit.includes('co') || Boolean(depositAmount);
          const depositType: 'co_coc' | 'khong_coc' = hasDeposit ? 'co_coc' : 'khong_coc';

          return {
            ticketNumber,
            customerName,
            customerPhone,
            deviceModel,
            deviceName,
            skuCode,
            imeiOrIot,
            location,
            note,
            flowType,
            status,
            hasDeposit,
            depositType,
            depositAmount,
            borrowedDate: borrowedDate || (flowType === 'customer_loan' ? formatLoanTimeVi() : undefined),
            returnedDate: returnedDate || undefined,
            bookingDate: formatDateVi(),
          };
        }).filter((item) => item.customerName || item.ticketNumber || item.deviceModel || item.imeiOrIot);

        resolve(parsedItems);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

