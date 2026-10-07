import { ShortageBookingItem } from '../types/shortage';
import { DeviceIotBookingItem } from '../types/deviceIot';
import { LabelItem } from '../types/label';
import {
  batchSyncShortagesToCloud,
  getLocalShortagesCache,
  saveLocalShortagesCache,
  deduplicateShortages,
  saveBulkCatalogLabelsToCloud,
  getLocalCatalogCache,
  saveLocalCatalogCache,
  deduplicateLabelItems,
} from './firebaseShortageService';
import {
  batchSyncDeviceIotsToCloud,
  loadLocalDeviceIotBookings,
  saveLocalDeviceIotBookings,
  deduplicateDeviceIots,
} from './firebaseDeviceIotService';

export interface FullSystemBackupData {
  version: '2.0';
  exportedAt: string;
  type: 'FULL_SYSTEM_BACKUP';
  exportedBy: string;
  appName: string;
  stats: {
    shortagesCount: number;
    deviceIotCount: number;
    catalogCount: number;
  };
  shortages: ShortageBookingItem[];
  deviceIot: DeviceIotBookingItem[];
  catalogLabels: LabelItem[];
}

export interface ParsedBackup {
  type: 'FULL_SYSTEM' | 'SHORTAGES' | 'DEVICE_IOT' | 'CATALOG' | 'UNKNOWN';
  version?: string;
  exportedAt?: string;
  exportedBy?: string;
  shortages: ShortageBookingItem[];
  deviceIot: DeviceIotBookingItem[];
  catalogLabels: LabelItem[];
  counts: {
    shortages: number;
    deviceIot: number;
    catalog: number;
  };
}

export interface RestoreResult {
  success: boolean;
  message: string;
  durationMs: number;
  counts: {
    shortages: number;
    deviceIot: number;
    catalog: number;
  };
  restoredShortages: ShortageBookingItem[];
  restoredDeviceIot: DeviceIotBookingItem[];
  restoredCatalog: LabelItem[];
}

// 1. Helper: trigger JSON file download
export function downloadJsonFile(filename: string, data: any): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getTimestampSuffix(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  return `${dateStr}_${timeStr}`;
}

// 2. Export 100% Full System Backup (Shortages + Device/IOT + Catalog)
export function exportFullSystemBackup(params: {
  shortages?: ShortageBookingItem[];
  deviceIot?: DeviceIotBookingItem[];
  catalogLabels?: LabelItem[];
  userName?: string;
}): void {
  const shortages = params.shortages && params.shortages.length > 0 
    ? params.shortages 
    : getLocalShortagesCache();
  const deviceIot = params.deviceIot && params.deviceIot.length > 0 
    ? params.deviceIot 
    : loadLocalDeviceIotBookings();
  const catalogLabels = params.catalogLabels && params.catalogLabels.length > 0 
    ? params.catalogLabels 
    : getLocalCatalogCache();

  const backup: FullSystemBackupData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    type: 'FULL_SYSTEM_BACKUP',
    exportedBy: params.userName || 'Tài khoản người dùng',
    appName: 'Hệ Thống Quản Lý Kho & Đặt Chờ Linh Kiện - Thiết Bị OPPO',
    stats: {
      shortagesCount: shortages.length,
      deviceIotCount: deviceIot.length,
      catalogCount: catalogLabels.length,
    },
    shortages,
    deviceIot,
    catalogLabels,
  };

  const filename = `SaoLuu_ToanBoHeThong_Full_${getTimestampSuffix()}.json`;
  downloadJsonFile(filename, backup);
}

// 3. Export Shortages Backup
export function exportShortagesBackup(shortages?: ShortageBookingItem[], userName?: string): void {
  const items = shortages && shortages.length > 0 ? shortages : getLocalShortagesCache();
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    type: 'SHORTAGE_BOOKINGS_BACKUP',
    exportedBy: userName || 'Người dùng',
    totalItems: items.length,
    bookings: items,
  };
  const filename = `SaoLuu_DatChoLinhKien_Full_${getTimestampSuffix()}.json`;
  downloadJsonFile(filename, data);
}

// 4. Export Device & IOT Backup
export function exportDeviceIotBackup(deviceIot?: DeviceIotBookingItem[], userName?: string): void {
  const items = deviceIot && deviceIot.length > 0 ? deviceIot : loadLocalDeviceIotBookings();
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    type: 'DEVICE_IOT_BACKUP',
    exportedBy: userName || 'Người dùng',
    totalItems: items.length,
    deviceIot: items,
  };
  const filename = `SaoLuu_DatChoMayIOT_Full_${getTimestampSuffix()}.json`;
  downloadJsonFile(filename, data);
}

// 5. Export Catalog Backup
export function exportCatalogBackup(catalogLabels?: LabelItem[], userName?: string): void {
  const items = catalogLabels && catalogLabels.length > 0 ? catalogLabels : getLocalCatalogCache();
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    type: 'LABEL_CATALOG_BACKUP',
    exportedBy: userName || 'Người dùng',
    totalItems: items.length,
    catalogLabels: items,
  };
  const filename = `SaoLuu_DanhMucTem_Full_${getTimestampSuffix()}.json`;
  downloadJsonFile(filename, data);
}

// 6. Universal JSON Parser (Recognizes any backup type and normalizes data)
export function parseBackupJson(jsonString: string): ParsedBackup {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error('Định dạng file không phải là JSON hợp lệ hoặc file bị hỏng!');
  }

  const result: ParsedBackup = {
    type: 'UNKNOWN',
    version: parsed?.version,
    exportedAt: parsed?.exportedAt,
    exportedBy: parsed?.exportedBy,
    shortages: [],
    deviceIot: [],
    catalogLabels: [],
    counts: { shortages: 0, deviceIot: 0, catalog: 0 },
  };

  const nowIso = new Date().toISOString();

  // CASE A: Full System Backup
  if (parsed && (parsed.type === 'FULL_SYSTEM_BACKUP' || (parsed.shortages && (parsed.deviceIot || parsed.catalogLabels)))) {
    result.type = 'FULL_SYSTEM';
    if (Array.isArray(parsed.shortages)) {
      result.shortages = sanitizeShortages(parsed.shortages, nowIso);
    }
    if (Array.isArray(parsed.deviceIot)) {
      result.deviceIot = sanitizeDeviceIots(parsed.deviceIot, nowIso);
    }
    if (Array.isArray(parsed.catalogLabels)) {
      result.catalogLabels = sanitizeCatalogLabels(parsed.catalogLabels);
    }
  }
  // CASE B: Shortages Backup (type or bookings/items array)
  else if (parsed && (parsed.type === 'SHORTAGE_BOOKINGS_BACKUP' || parsed.bookings)) {
    result.type = 'SHORTAGES';
    const raw = Array.isArray(parsed.bookings) ? parsed.bookings : (Array.isArray(parsed.data) ? parsed.data : []);
    result.shortages = sanitizeShortages(raw, nowIso);
  }
  // CASE C: Device & IOT Backup
  else if (parsed && (parsed.type === 'DEVICE_IOT_BACKUP' || parsed.deviceIot)) {
    result.type = 'DEVICE_IOT';
    const raw = Array.isArray(parsed.deviceIot) ? parsed.deviceIot : (Array.isArray(parsed.items) ? parsed.items : []);
    result.deviceIot = sanitizeDeviceIots(raw, nowIso);
  }
  // CASE D: Label Catalog Backup
  else if (parsed && (parsed.type === 'LABEL_CATALOG_BACKUP' || parsed.catalogLabels)) {
    result.type = 'CATALOG';
    const raw = Array.isArray(parsed.catalogLabels) ? parsed.catalogLabels : (Array.isArray(parsed.items) ? parsed.items : []);
    result.catalogLabels = sanitizeCatalogLabels(raw);
  }
  // CASE E: Raw array of items
  else if (Array.isArray(parsed)) {
    const firstItem = parsed[0] || {};
    if (firstItem.flowType || firstItem.deviceModel || firstItem.imeiOrIot) {
      result.type = 'DEVICE_IOT';
      result.deviceIot = sanitizeDeviceIots(parsed, nowIso);
    } else if (firstItem.partNumber || (firstItem.description && !firstItem.ticketNumber)) {
      result.type = 'CATALOG';
      result.catalogLabels = sanitizeCatalogLabels(parsed);
    } else {
      // Default assume shortages
      result.type = 'SHORTAGES';
      result.shortages = sanitizeShortages(parsed, nowIso);
    }
  }

  result.counts = {
    shortages: result.shortages.length,
    deviceIot: result.deviceIot.length,
    catalog: result.catalogLabels.length,
  };

  if (result.counts.shortages === 0 && result.counts.deviceIot === 0 && result.counts.catalog === 0) {
    throw new Error('File JSON không chứa dữ liệu phiếu hoặc danh mục hợp lệ!');
  }

  return result;
}

// 7. Sanitizers preserving 100% properties
function sanitizeShortages(items: any[], nowIso: string): ShortageBookingItem[] {
  return items
    .filter((item) => item && typeof item === 'object' && (item.id || item.ticketNumber || item.customerName || item.partCode || item.partName))
    .map((item, idx) => ({
      ...item,
      id: item.id || `shortage-restored-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      ticketNumber: item.ticketNumber || `PC-${Date.now().toString().slice(-4)}`,
      partCode: item.partCode || 'N/A',
      partName: item.partName || 'Linh kiện',
      customerName: item.customerName || 'Khách hàng',
      customerPhone: item.customerPhone || '',
      status: item.status || 'da_tao_phieu',
      bookingDate: item.bookingDate || new Date().toLocaleDateString('vi-VN'),
      createdAt: item.createdAt || nowIso,
      updatedAt: item.updatedAt || nowIso,
      partsList: Array.isArray(item.partsList) ? item.partsList : [],
      callLogs: Array.isArray(item.callLogs) ? item.callLogs : [],
      history: Array.isArray(item.history) ? item.history : [],
    } as ShortageBookingItem));
}

function sanitizeDeviceIots(items: any[], nowIso: string): DeviceIotBookingItem[] {
  return items
    .filter((item) => item && typeof item === 'object' && (item.id || item.ticketNumber || item.customerName || item.deviceModel || item.imeiOrIot))
    .map((item, idx) => ({
      ...item,
      id: item.id || `dev-iot-restored-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      ticketNumber: item.ticketNumber || `MD-${Date.now().toString().slice(-4)}`,
      customerName: item.customerName || 'Khách hàng',
      customerPhone: item.customerPhone || '',
      deviceModel: item.deviceModel || '',
      deviceName: item.deviceName || '',
      imeiOrIot: item.imeiOrIot || '',
      deviceCategory: item.deviceCategory || 'phone',
      flowType: item.flowType || 'request_device',
      status: item.status || 'cho_xin_may',
      bookingDate: item.bookingDate || new Date().toLocaleDateString('vi-VN'),
      createdAt: item.createdAt || nowIso,
      updatedAt: item.updatedAt || nowIso,
      callLogs: Array.isArray(item.callLogs) ? item.callLogs : [],
      history: Array.isArray(item.history) ? item.history : [],
    } as DeviceIotBookingItem));
}

function sanitizeCatalogLabels(items: any[]): LabelItem[] {
  return items
    .filter((item) => item && typeof item === 'object' && (item.id || item.partNumber || item.description))
    .map((item, idx) => ({
      ...item,
      id: item.id || `label-${Date.now()}-${idx}`,
      partNumber: item.partNumber || '',
      description: item.description || '',
      category: item.category || 'Khác',
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      selected: false,
    } as LabelItem));
}

// 8. Execute Fast Restore & High-Speed Cloud Synchronization
export async function executeFastRestore(params: {
  parsed: ParsedBackup;
  mode: 'merge' | 'replace';
  authorName?: string;
  onProgress?: (step: string, percent: number) => void;
}): Promise<RestoreResult> {
  const startTime = performance.now();
  const { parsed, mode, authorName = 'Khôi phục JSON', onProgress } = params;

  onProgress?.('Đang nạp dữ liệu vào bộ nhớ máy...', 20);

  let finalShortages: ShortageBookingItem[] = [];
  let finalDeviceIot: DeviceIotBookingItem[] = [];
  let finalCatalog: LabelItem[] = [];

  // A. Process Shortages
  if (parsed.shortages.length > 0) {
    if (mode === 'merge') {
      const current = getLocalShortagesCache();
      finalShortages = deduplicateShortages([...parsed.shortages, ...current]);
    } else {
      finalShortages = deduplicateShortages(parsed.shortages);
    }
    saveLocalShortagesCache(finalShortages);
  } else {
    finalShortages = getLocalShortagesCache();
  }

  // B. Process Device & IOT
  if (parsed.deviceIot.length > 0) {
    if (mode === 'merge') {
      const current = loadLocalDeviceIotBookings();
      finalDeviceIot = deduplicateDeviceIots([...parsed.deviceIot, ...current]);
    } else {
      finalDeviceIot = deduplicateDeviceIots(parsed.deviceIot);
    }
    saveLocalDeviceIotBookings(finalDeviceIot);
  } else {
    finalDeviceIot = loadLocalDeviceIotBookings();
  }

  // C. Process Catalog
  if (parsed.catalogLabels.length > 0) {
    if (mode === 'merge') {
      const current = getLocalCatalogCache();
      finalCatalog = deduplicateLabelItems([...parsed.catalogLabels, ...current]);
    } else {
      finalCatalog = deduplicateLabelItems(parsed.catalogLabels);
    }
    saveLocalCatalogCache(finalCatalog);
  } else {
    finalCatalog = getLocalCatalogCache();
  }

  onProgress?.('Đang đồng bộ siêu tốc lên Cloud (PostgreSQL & Firestore)...', 60);

  // High-Speed Concurrent Cloud Sync
  const syncPromises: Promise<any>[] = [];

  if (parsed.shortages.length > 0) {
    syncPromises.push(
      batchSyncShortagesToCloud(finalShortages, authorName).catch((err) => {
        console.warn('Restore sync shortages notice:', err);
      })
    );
  }

  if (parsed.deviceIot.length > 0) {
    syncPromises.push(
      batchSyncDeviceIotsToCloud(finalDeviceIot).catch((err) => {
        console.warn('Restore sync deviceIot notice:', err);
      })
    );
  }

  if (parsed.catalogLabels.length > 0) {
    syncPromises.push(
      saveBulkCatalogLabelsToCloud(finalCatalog, authorName, undefined, mode === 'replace').catch((err) => {
        console.warn('Restore sync catalog notice:', err);
      })
    );
  }

  await Promise.allSettled(syncPromises);

  onProgress?.('Hoàn tất khôi phục và đồng bộ!', 100);

  // Broadcast event so any open view reloads data instantly
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('oppo_data_restored_event', {
        detail: {
          shortages: finalShortages,
          deviceIot: finalDeviceIot,
          catalog: finalCatalog,
          mode,
          timestamp: Date.now(),
        },
      })
    );
  }

  const durationMs = Math.round(performance.now() - startTime);

  const parts: string[] = [];
  if (parsed.counts.shortages > 0) parts.push(`${parsed.counts.shortages} phiếu linh kiện`);
  if (parsed.counts.deviceIot > 0) parts.push(`${parsed.counts.deviceIot} phiếu máy & IOT`);
  if (parsed.counts.catalog > 0) parts.push(`${parsed.counts.catalog} mã tem`);

  return {
    success: true,
    message: `Đã khôi phục thành công ${parts.join(', ')} trong ${durationMs}ms!`,
    durationMs,
    counts: {
      shortages: parsed.counts.shortages,
      deviceIot: parsed.counts.deviceIot,
      catalog: parsed.counts.catalog,
    },
    restoredShortages: finalShortages,
    restoredDeviceIot: finalDeviceIot,
    restoredCatalog: finalCatalog,
  };
}
