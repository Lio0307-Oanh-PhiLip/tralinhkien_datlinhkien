import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
  checkCloudConnectionDetails,
  CloudConnectionStatus,
  isQuotaExceededState,
  setQuotaExceededState,
} from '../lib/firebase';
import { ShortageBookingItem, ShortageHistoryEntry, CustomerCallLog } from '../types/shortage';
import { LabelItem } from '../types/label';
import bundledDb from '../data/bundledDatabase.json';

export { testFirestoreConnection, checkCloudConnectionDetails };
export type { CloudConnectionStatus };

const COLLECTION_SHORTAGES = 'shortages';
const COLLECTION_USERS = 'users';
const COLLECTION_LOGS = 'activity_logs';
const COLLECTION_LABEL_CATALOG = 'label_catalog';

export interface UserSessionData {
  uid: string;
  username?: string;
  name?: string;
  password?: string;
  displayName: string;
  email?: string;
  role: 'admin' | 'staff';
  status: 'pending' | 'approved' | 'rejected';
  lastActive: string;
  online: boolean;
  device?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ActivityLogData {
  id: string;
  ticketNumber?: string;
  action: string;
  userName: string;
  userEmail?: string;
  timestamp: string;
  details?: string;
}

// Local Cache Helper Keys
const CACHE_KEY_SHORTAGES = 'label_studio_shortage_bookings_v1';
const CACHE_KEY_CATALOG = 'label_studio_catalog_labels_v1';

// Universal Deduplication for Label Items (by Part Code / Name / Model)
export function deduplicateLabelItems(items: LabelItem[]): LabelItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const map = new Map<string, LabelItem>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const code = item.code ? item.code.trim().toLowerCase() : '';
    const name = item.name ? item.name.trim().toLowerCase() : '';
    const model = item.model ? item.model.trim().toLowerCase() : '';

    const key = code
      ? `c:${code}`
      : name
      ? `n:${name}_${model}`
      : `i:${item.id || i}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      map.set(key, {
        ...existing,
        ...item,
        name: item.name || existing.name,
        code: item.code || existing.code,
        model: item.model || existing.model,
        category: item.category || existing.category,
        location: item.location || existing.location,
        quantity: Math.max(existing.quantity || 1, item.quantity || 1),
        price: item.price || existing.price,
        date: item.date || existing.date,
        selected: existing.selected !== undefined ? existing.selected : item.selected,
      });
    }
  }
  return Array.from(map.values());
}

// Helper to parse dates robustly supporting both ISO strings and Vietnamese slash format DD/MM/YYYY HH:mm
function parseDateToMillis(dateStr?: string): number {
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

function mergeHistory(
  h1: ShortageHistoryEntry[] | undefined,
  h2: ShortageHistoryEntry[] | undefined
): ShortageHistoryEntry[] {
  const list1 = Array.isArray(h1) ? h1 : [];
  const list2 = Array.isArray(h2) ? h2 : [];
  const combined = [...list1, ...list2];
  const seen = new Set<string>();
  const merged: ShortageHistoryEntry[] = [];

  for (const h of combined) {
    if (!h || !h.status) continue;
    const key = `${h.status}_${(h.timestamp || '').trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(h);
    }
  }

  return merged.sort((a, b) => {
    const tA = parseDateToMillis(a.timestamp);
    const tB = parseDateToMillis(b.timestamp);
    return tA - tB;
  });
}

function mergeCallLogs(
  c1: CustomerCallLog[] | undefined,
  c2: CustomerCallLog[] | undefined
): CustomerCallLog[] {
  const list1 = Array.isArray(c1) ? c1 : [];
  const list2 = Array.isArray(c2) ? c2 : [];
  const combined = [...list1, ...list2];
  const seen = new Set<string>();
  const merged: CustomerCallLog[] = [];

  for (const c of combined) {
    if (!c) continue;
    const key = c.id || `${(c.calledDate || '').trim()}_${c.subStatus}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }

  return merged.sort((a, b) => {
    const tA = parseDateToMillis(a.calledDate || a.createdAt);
    const tB = parseDateToMillis(b.calledDate || b.createdAt);
    return tA - tB;
  });
}

// Universal Merger for Two Shortage Items (clean deterministic merge strictly preferring newer timestamps)
export function mergeTwoShortageItems(
  item1: ShortageBookingItem,
  item2: ShortageBookingItem
): ShortageBookingItem {
  if (!item1) return item2;
  if (!item2) return item1;

  const t1 = parseDateToMillis(item1.updatedAt || item1.createdAt);
  const t2 = parseDateToMillis(item2.updatedAt || item2.createdAt);

  let base: ShortageBookingItem;
  let fallback: ShortageBookingItem;

  if (t2 > t1) {
    base = { ...item2 };
    fallback = item1;
  } else if (t1 > t2) {
    base = { ...item1 };
    fallback = item2;
  } else {
    // If timestamps are exactly equal:
    // 1. Prefer item with longer history log
    const h1 = item1.history?.length || 0;
    const h2 = item2.history?.length || 0;
    if (h2 > h1) {
      base = { ...item2 };
      fallback = item1;
    } else if (h1 > h2) {
      base = { ...item1 };
      fallback = item2;
    } else {
      // 2. Prefer item with more partsList items
      const p1 = item1.partsList?.length || 0;
      const p2 = item2.partsList?.length || 0;
      if (p2 > p1) {
        base = { ...item2 };
        fallback = item1;
      } else {
        base = { ...item1 };
        fallback = item2;
      }
    }
  }

  // Preserve metadata fields if they are missing/empty in the base but present in the fallback
  if (!base.createdBy && fallback.createdBy) {
    base.createdBy = fallback.createdBy;
  }
  if (!base.createdByUid && fallback.createdByUid) {
    base.createdByUid = fallback.createdByUid;
  }
  if (!base.creatorTechnician && fallback.creatorTechnician) {
    base.creatorTechnician = fallback.creatorTechnician;
  }
  if (!base.requestedDate && fallback.requestedDate) {
    base.requestedDate = fallback.requestedDate;
  }
  if (!base.createdAt && fallback.createdAt) {
    base.createdAt = fallback.createdAt;
  }
  if ((!base.partsList || base.partsList.length === 0) && fallback.partsList && fallback.partsList.length > 0) {
    base.partsList = fallback.partsList;
  }

  // Smart merge history arrays and call logs
  base.history = mergeHistory(base.history, fallback.history);
  base.callLogs = mergeCallLogs(base.callLogs, fallback.callLogs);

  // If base has call logs, ensure the top-level call fields accurately reflect the latest call log
  if (Array.isArray(base.callLogs) && base.callLogs.length > 0) {
    const latestCall = base.callLogs[base.callLogs.length - 1];
    if (latestCall) {
      const latestCallTime = parseDateToMillis(latestCall.calledDate);
      const baseCallTime = parseDateToMillis(base.calledCustomerDate);
      if (latestCallTime >= baseCallTime || !base.calledCustomerDate) {
        base.calledCustomerDate = latestCall.calledDate;
        base.callSubStatus = latestCall.subStatus as any;
        base.appointmentDate = latestCall.appointmentDate;
        base.callNote = latestCall.note;
      }
    }
  }

  return base;
}

// Universal Deduplication for Shortage Bookings (by Ticket Number & ID)
export function deduplicateShortages(items: ShortageBookingItem[]): ShortageBookingItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const idMap = new Map<string, ShortageBookingItem>();
  for (const item of items) {
    if (!item || !item.id) continue;
    const existing = idMap.get(item.id);
    if (!existing) {
      idMap.set(item.id, { ...item });
    } else {
      idMap.set(item.id, mergeTwoShortageItems(existing, item));
    }
  }

  // Deduplicate tickets if duplicate ticketNumbers exist across different IDs
  const ticketMap = new Map<string, ShortageBookingItem>();
  for (const item of idMap.values()) {
    const ticket = (item.ticketNumber || '').trim().toUpperCase();
    if (ticket) {
      const existing = ticketMap.get(ticket);
      if (!existing) {
        ticketMap.set(ticket, item);
      } else {
        ticketMap.set(ticket, mergeTwoShortageItems(existing, item));
      }
    } else {
      ticketMap.set(item.id, item);
    }
  }

  return sortShortagesStably(Array.from(ticketMap.values()));
}

// Deterministic stable sorting function to prevent tickets jumping around
export function sortShortagesStably(items: ShortageBookingItem[]): ShortageBookingItem[] {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    // 1. Sort by Booking Date or CreatedAt (newest first)
    const tA = parseDateToMillis(a.bookingDate || a.createdAt || a.updatedAt);
    const tB = parseDateToMillis(b.bookingDate || b.createdAt || b.updatedAt);
    if (tB !== tA) {
      return tB - tA;
    }
    // 2. Secondary sort: Ticket number descending (e.g. BJQL26082503 > BJQL26082501)
    const ticketA = (a.ticketNumber || '').trim();
    const ticketB = (b.ticketNumber || '').trim();
    if (ticketA && ticketB) {
      return ticketB.localeCompare(ticketA);
    }
    return (b.id || '').localeCompare(a.id || '');
  });
}

// Production Cloud Run Backend URLs for packaged Desktop apps (AppImage / EXE / Windows / Linux)
export const PRIMARY_CLOUD_SERVER_URL = 'https://ais-dev-25zqqhfhavqkf7k3te25ij-670519460440.asia-southeast1.run.app';
export const SECONDARY_CLOUD_SERVER_URL = 'https://ais-pre-25zqqhfhavqkf7k3te25ij-670519460440.asia-southeast1.run.app';
export const DEFAULT_CLOUD_SERVER_URL = PRIMARY_CLOUD_SERVER_URL;

export function isDesktopOrElectronApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).electronAPI?.isElectron ||
    navigator.userAgent.toLowerCase().includes('electron') ||
    window.location.protocol === 'file:' ||
    window.location.protocol === 'app:' ||
    window.location.protocol === 'vscode-webview:' ||
    (!window.location.hostname.includes('run.app') &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === ''))
  );
}

export function getApiBaseUrl(): string {
  // 1. Check custom user override in localStorage
  try {
    const custom = localStorage.getItem('label_studio_custom_cloud_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch (e) {
    // ignore
  }

  // 2. If running directly in a web browser on Cloud Run (e.g. *.run.app)
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    if ((protocol === 'http:' || protocol === 'https:') && hostname && hostname.includes('run.app')) {
      return ''; // Relative URLs will be routed to current backend host
    }
  }

  // 3. For Electron / Desktop (AppImage / EXE / file:// / local dev)
  return PRIMARY_CLOUD_SERVER_URL;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : '/' + path;

  // If web browser on Cloud Run, fetch directly using relative URL
  if (!base) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(normalizedPath, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // If Desktop App / AppImage / EXE / outside Cloud Run:
  const primaryUrl = `${base}${normalizedPath}`;
  const endpoints = [
    primaryUrl,
    `${SECONDARY_CLOUD_SERVER_URL}${normalizedPath}`,
    `${PRIMARY_CLOUD_SERVER_URL}${normalizedPath}`,
  ];
  // Remove duplicates while preserving order
  const uniqueEndpoints = Array.from(new Set(endpoints));

  for (let i = 0; i < uniqueEndpoints.length; i++) {
    const targetUrl = uniqueEndpoints[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(targetUrl, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok || response.status < 500) {
        return response;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`Endpoint ${targetUrl} unavailable, trying next...`);
    }
  }

  // Fallback offline response for isolated desktop apps
  if (typeof window !== 'undefined' && isDesktopOrElectronApp()) {
    return new Response(JSON.stringify({ offline: true, error: 'Cloud offline fallback' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  throw new Error('All cloud server endpoints unreachable');
}

export function setCustomCloudUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem('label_studio_custom_cloud_url', url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('label_studio_custom_cloud_url');
    }
  } catch (e) {
    // ignore
  }
}

export function getCurrentCloudUrl(): string {
  try {
    const custom = localStorage.getItem('label_studio_custom_cloud_url');
    if (custom && custom.trim()) {
      return custom.trim();
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_CLOUD_SERVER_URL;
}

export function filterShortages(items: ShortageBookingItem[]): ShortageBookingItem[] {
  if (!Array.isArray(items)) return [];
  // Clean up legacy keys if present so valid cloud items are NEVER filtered out
  try {
    localStorage.removeItem('label_studio_shortages_clear_all_timestamp');
    localStorage.removeItem('label_studio_shortage_deleted_ids');
  } catch (e) {}

  return items.filter((item) => item && item.id && (item.ticketNumber || item.partName || item.customerName));
}

export function getLocalShortagesCache(): ShortageBookingItem[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY_SHORTAGES);
    let items: ShortageBookingItem[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        items = parsed;
      }
    }
    if (items.length > 0) {
      return filterShortages(items);
    }
  } catch (e) {
    console.warn('Failed to parse local shortages cache:', e);
  }

  // Pre-bundled database snapshot fallback (guarantees instant 100% data on desktop app boot)
  if (bundledDb && Array.isArray(bundledDb.shortages) && bundledDb.shortages.length > 0) {
    return filterShortages(bundledDb.shortages as unknown as ShortageBookingItem[]);
  }

  return [];
}

export function saveLocalShortagesCache(items: ShortageBookingItem[]): void {
  try {
    localStorage.setItem(CACHE_KEY_SHORTAGES, JSON.stringify(items));
    localStorage.setItem('label_studio_shortage_initialized', 'true');
  } catch (e) {
    console.warn('Failed to save local shortages cache:', e);
  }
}

export const DEFAULT_CATALOG_FALLBACK_ITEMS: LabelItem[] = [
  { id: 'cat-default-1', code: '621033000403', name: 'Nắp Pin Find X8 Pro (Trắng)', model: 'Find X8 Pro', category: 'Vỏ', location: 'A-01', quantity: 1 },
  { id: 'cat-default-2', code: '621033000404', name: 'Màn Hình Oppo Find X8', model: 'Find X8', category: 'Màn', location: 'B-04', quantity: 1 },
  { id: 'cat-default-3', code: '621033000405', name: 'Pin Oppo Reno 11 Pro 5G', model: 'Reno 11 Pro', category: 'Pin', location: 'C-02', quantity: 1 },
  { id: 'cat-default-4', code: '621033000406', name: 'Màn Hình Oppo Reno 12 5G', model: 'Reno 12', category: 'Màn', location: 'B-02', quantity: 1 },
  { id: 'cat-default-5', code: '621033000407', name: 'Pin Oppo A3x', model: 'Oppo A3x', category: 'Pin', location: 'C-05', quantity: 1 },
  { id: 'cat-default-6', code: '621033000408', name: 'Nắp Pin Oppo Reno 10 5G', model: 'Reno 10', category: 'Vỏ', location: 'A-03', quantity: 1 },
  { id: 'cat-default-7', code: '621033000409', name: 'Màn Hình Cụm Oppo A58 4G', model: 'Oppo A58', category: 'Màn', location: 'B-01', quantity: 1 },
  { id: 'cat-default-8', code: '621033000410', name: 'Camera Sau Chính Oppo Find X7 Ultra', model: 'Find X7 Ultra', category: 'Camera', location: 'D-01', quantity: 1 },
];

export function getLocalCatalogCache(): LabelItem[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY_CATALOG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse local catalog cache:', e);
  }

  try {
    const fallbackRaw = localStorage.getItem('label_studio_items_v1') || localStorage.getItem('oppo_label_studio_items');
    if (fallbackRaw) {
      const parsedFallback = JSON.parse(fallbackRaw);
      if (Array.isArray(parsedFallback) && parsedFallback.length > 0) return parsedFallback;
    }
  } catch (e) {
    // ignore
  }

  // Pre-bundled catalog snapshot fallback (5,730 catalog parts instant fallback)
  if (bundledDb && Array.isArray(bundledDb.catalog) && bundledDb.catalog.length > 0) {
    return bundledDb.catalog as LabelItem[];
  }

  return DEFAULT_CATALOG_FALLBACK_ITEMS;
}

export function saveLocalCatalogCache(items: LabelItem[]): void {
  try {
    localStorage.setItem(CACHE_KEY_CATALOG, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to save local catalog cache:', e);
  }
}

// Global Connection Checker supporting both direct Cloud Firestore and REST Server
export async function testServerConnection(): Promise<{
  ok: boolean;
  provider: string;
  version?: string;
  details?: string;
}> {
  // 1. Check Direct Google Firebase Cloud Firestore (Always accessible globally)
  try {
    const firestoreOk = await testFirestoreConnection();
    if (firestoreOk) {
      return {
        ok: true,
        provider: 'Google Cloud Firestore Real-time DB',
        version: 'v2.5.3',
        details: 'Đã kết nối trực tiếp cơ sở dữ liệu đám mây Google Firebase thành công!',
      };
    }
  } catch (err: any) {
    console.warn('Firestore connection check notice:', err);
  }

  // 2. Check REST API / Cloud Server (for web deployment or custom endpoint)
  try {
    const res = await apiFetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'ok') {
        return {
          ok: true,
          provider: data.provider || 'Máy Chủ Cloud SQL & Node.js',
          version: data.version || '2.5.3',
          details: 'Kết nối máy chủ Backend thành công',
        };
      }
    }
  } catch (e) {
    // REST API failed
  }

  // 3. Graceful fallback
  return {
    ok: false,
    provider: 'Chế độ Cục bộ Ngoại tuyến (Offline Cache)',
    details: 'Đang hoạt động ngoại tuyến an toàn trên máy tính',
  };
}

// Force full sync across all collections for PC Windows apps
export async function forceFullCloudSync(): Promise<{
  success: boolean;
  shortagesCount: number;
  catalogCount: number;
  message: string;
}> {
  try {
    const shortages = await pullLatestShortagesFromCloud();
    const catalog = await fetchCatalogLabelsFromCloud();
    return {
      success: true,
      shortagesCount: shortages.length,
      catalogCount: catalog.length,
      message: `Đã đồng bộ thành công ${shortages.length} phiếu đặt chờ và ${catalog.length} tem mẫu từ Cloud!`,
    };
  } catch (e: any) {
    return {
      success: false,
      shortagesCount: 0,
      catalogCount: 0,
      message: `Lỗi đồng bộ Cloud: ${e?.message || 'Không thể kết nối máy chủ'}`,
    };
  }
}

// ----------------------------------------------------
// APP VERSION & LIVE OTA UPDATE MANAGEMENT
// ----------------------------------------------------

export interface AppVersionInfo {
  version: string;
  buildId: string;
  releaseDate?: string;
  releaseNotes?: string;
  windowsDownloadUrl?: string;
  forceUpdate?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

// Real-time Cloud Firestore listener for App Version / Windows Updates
export function subscribeToRemoteAppVersion(
  callback: (info: AppVersionInfo) => void
): () => void {
  if (isQuotaExceededState()) return () => {};
  try {
    const versionRef = doc(db, 'system_config', 'app_version');
    let unsub: (() => void) | null = null;
    unsub = onSnapshot(
      versionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as AppVersionInfo;
          if (data && data.version) {
            callback(data);
            return;
          }
        }
      },
      (err) => {
        if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
          setQuotaExceededState(true);
          if (unsub) {
            unsub();
            unsub = null;
          }
        }
      }
    );
    return () => {
      if (unsub) unsub();
    };
  } catch (e) {
    return () => {};
  }
}

// Publish a new App Version update to Cloud Firestore (Master Admin)
export async function publishAppVersionToCloud(
  info: AppVersionInfo,
  publisherName = 'Admin'
): Promise<boolean> {
  try {
    if (!isQuotaExceededState()) {
      try {
        const versionRef = doc(db, 'system_config', 'app_version');
        const payload = {
          version: info.version.trim(),
          buildId: info.buildId.trim(),
          releaseDate: info.releaseDate || new Date().toLocaleDateString('vi-VN'),
          releaseNotes: info.releaseNotes || 'Cập nhật hệ thống in tem & đồng bộ Cloud mới nhất.',
          windowsDownloadUrl: info.windowsDownloadUrl || '',
          forceUpdate: Boolean(info.forceUpdate),
          updatedAt: new Date().toISOString(),
          updatedBy: publisherName,
        };
        await setDoc(versionRef, payload, { merge: true });
      } catch (e: any) {
        if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
          setQuotaExceededState(true);
        }
      }
    }

    // Also log activity
    await recordActivityLog({
      action: 'Phát hành bản cập nhật mới',
      userName: publisherName,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      details: `Phát hành phiên bản v${info.version} (Build: ${info.buildId})`,
    });
    return true;
  } catch (e) {
    console.error('Error publishing version to Cloud:', e);
    return false;
  }
}

// ----------------------------------------------------
// SHORTAGE BOOKINGS (Dual: Firestore + Cloud SQL + Local Cache)
// ----------------------------------------------------

// Pull latest shortages from Cloud SQL PostgreSQL and Firestore (Seamless dual-backend merge)
export async function pullLatestShortagesFromCloud(forceCloud = false): Promise<ShortageBookingItem[]> {
  const cloudMap = new Map<string, ShortageBookingItem>();
  let cloudQuerySuccess = false;

  // 1. Direct Firestore query (instant real-time cloud data)
  if (!isQuotaExceededState()) {
    try {
      const q = query(collection(db, COLLECTION_SHORTAGES), limit(1000));
      const snap = await getDocs(q);
      cloudQuerySuccess = true;
      snap.forEach((d) => {
        const item = { id: d.id, ...(d.data() as any) } as ShortageBookingItem;
        if (item && item.id) {
          cloudMap.set(item.id, item);
        }
      });
    } catch (err: any) {
      if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
      console.warn('Firestore shortages pull notice:', err);
    }
  }

  // 2. Query Cloud SQL PostgreSQL API
  try {
    const res = await apiFetch('/api/shortages', { cache: 'no-store' });
    if (res.ok) {
      cloudQuerySuccess = true;
      const sqlItems = await res.json();
      if (Array.isArray(sqlItems)) {
        sqlItems.forEach((remoteItem: ShortageBookingItem) => {
          if (remoteItem && remoteItem.id) {
            const existing = cloudMap.get(remoteItem.id);
            if (!existing) {
              cloudMap.set(remoteItem.id, remoteItem);
            } else {
              cloudMap.set(remoteItem.id, mergeTwoShortageItems(existing, remoteItem));
            }
          }
        });
      }
    }
  } catch (e) {
    // ignore
  }

  if (cloudQuerySuccess) {
    const cloudList = Array.from(cloudMap.values());
    const filteredCloud = filterShortages(cloudList);
    const sorted = sortShortagesStably(deduplicateShortages(filteredCloud));
    saveLocalShortagesCache(sorted);
    return sorted;
  }

  // Fallback to local cache if offline
  return sortShortagesStably(deduplicateShortages(getLocalShortagesCache()));
}

// Helper to notify Firestore signal doc for instant real-time broadcast to all clients for Shortages
export async function notifyShortagesSignal(authorName: string, count: number): Promise<void> {
  if (isQuotaExceededState()) return;
  try {
    const signalRef = doc(db, 'system_shortages', 'master_signal');
    await setDoc(
      signalRef,
      {
        updatedAt: serverTimestamp(),
        updatedBy: authorName,
        count,
        version: Date.now(),
      },
      { merge: true }
    );
  } catch (e: any) {
    if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
      setQuotaExceededState(true);
    }
  }
}

// Subscribe to changes in Shortages collection (Local-first + Firestore Realtime + PostgreSQL)
export function subscribeToShortages(
  onData: (items: ShortageBookingItem[]) => void,
  onError?: (err: any) => void
): () => void {
  // 1. Emit local cache instantly (0ms delay)
  const cached = sortShortagesStably(deduplicateShortages(getLocalShortagesCache()));
  onData(cached);

  let isFetching = false;
  const fetchShortages = async () => {
    if (isFetching) return;
    isFetching = true;
    try {
      const items = await pullLatestShortagesFromCloud();
      if (Array.isArray(items)) {
        const sorted = sortShortagesStably(deduplicateShortages(items));
        onData(sorted);
      }
    } catch (err) {
      if (onError) onError(err);
    } finally {
      isFetching = false;
    }
  };

  // 2. Real-time Firestore Listener on Shortages Signal and Collection (bypassed if quota exceeded)
  let unsubSignal: (() => void) | null = null;
  let unsubCollection: (() => void) | null = null;

  if (!isQuotaExceededState()) {
    try {
      const signalRef = doc(db, 'system_shortages', 'master_signal');
      unsubSignal = onSnapshot(
        signalRef,
        (snapshot) => {
          if (snapshot.exists()) {
            fetchShortages();
          }
        },
        (err) => {
          if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
            setQuotaExceededState(true);
            if (unsubSignal) {
              unsubSignal();
              unsubSignal = null;
            }
          }
        }
      );
    } catch (e) {
      // ignore
    }

    try {
      const shortagesCol = collection(db, COLLECTION_SHORTAGES);
      unsubCollection = onSnapshot(
        shortagesCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const items: ShortageBookingItem[] = [];
            snapshot.forEach((d) => {
              items.push({ id: d.id, ...(d.data() as any) });
            });
            const filtered = filterShortages(items);
            if (filtered.length > 0) {
              const sorted = sortShortagesStably(deduplicateShortages(filtered));
              saveLocalShortagesCache(sorted);
              onData(sorted);
            }
          } else {
            // Snapshot empty in Firestore - check Cloud SQL / bundled cache before wiping
            fetchShortages();
          }
        },
        (err) => {
          if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
            setQuotaExceededState(true);
            if (unsubCollection) {
              unsubCollection();
              unsubCollection = null;
            }
          } else {
            console.warn('Firestore shortages snapshot error, fallback to REST:', err);
          }
          fetchShortages();
        }
      );
    } catch (e) {
      // ignore
    }
  }

  // Initial fetch
  fetchShortages();

  // Periodic sync polling every 3.5s for Desktop AppImage/EXE & Web (visibility-aware to optimize Firebase quota)
  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) {
      return; // Save resources when in background or minimized
    }
    fetchShortages();
  }, 3500);

  return () => {
    if (unsubSignal) unsubSignal();
    if (unsubCollection) unsubCollection();
    clearInterval(interval);
  };
}

// Sanitizer helper for Firestore (removes undefined fields and converts to clean JSON object)
export function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (value === undefined ? null : value))
  );
}

// Save or Update a single Shortage record (Local-first + Firestore + PostgreSQL)
export async function saveShortageToCloud(
  item: ShortageBookingItem,
  authorName = 'Nhân viên'
): Promise<void> {
  const nowIso = new Date().toISOString();
  const payload: ShortageBookingItem = {
    ...item,
    updatedAt: nowIso,
  };
  const cleanPayload = sanitizeForFirestore(payload);

  // 1. Optimistically update local cache
  const localItems = getLocalShortagesCache();
  const existingIdx = localItems.findIndex((i) => i.id === item.id);
  if (existingIdx >= 0) {
    localItems[existingIdx] = cleanPayload;
  } else {
    localItems.unshift(cleanPayload);
  }
  saveLocalShortagesCache(localItems);

  // 2. Direct write to Cloud Firestore AND Cloud SQL in parallel before signaling
  const firestoreWrite = (async () => {
    if (isQuotaExceededState()) return;
    try {
      const docRef = doc(db, COLLECTION_SHORTAGES, item.id);
      await setDoc(docRef, cleanPayload, { merge: true });
    } catch (firestoreErr: any) {
      if (firestoreErr?.message?.toLowerCase().includes('quota') || firestoreErr?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
    }
  })();

  const sqlWrite = (async () => {
    try {
      await apiFetch('/api/shortages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload),
      });

      recordActivityLog({
        action: item.status === 'da_nhap_kho' ? 'Nhập kho linh kiện' : item.status === 'da_goi_kh' ? 'Đã gọi khách hàng' : 'Cập nhật phiếu',
        ticketNumber: item.ticketNumber,
        userName: authorName,
        details: `${item.partName} (${item.partCode}) - KH: ${item.customerName}`,
        timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
      }).catch(() => {});
    } catch (error) {
      console.warn('Cloud SQL save notice:', error);
    }
  })();

  await Promise.allSettled([firestoreWrite, sqlWrite]);

  // 3. Notify signal after both storage writes complete
  await notifyShortagesSignal(authorName, localItems.length);
}

// Bulk sync / initial migration from local to cloud
export async function batchSyncShortagesToCloud(items: ShortageBookingItem[], authorName = 'Nhân viên'): Promise<void> {
  if (!items || items.length === 0) return;
  const cleanItems = items.map(i => sanitizeForFirestore(i));
  saveLocalShortagesCache(cleanItems);

  // Direct Firestore batch write
  if (!isQuotaExceededState()) {
    try {
      const chunks: ShortageBookingItem[][] = [];
      for (let i = 0; i < cleanItems.length; i += 400) {
        chunks.push(cleanItems.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const docRef = doc(db, COLLECTION_SHORTAGES, item.id);
          batch.set(docRef, item, { merge: true });
        });
        await batch.commit();
      }
      await notifyShortagesSignal(authorName, cleanItems.length);
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
      console.warn('Firestore bulk shortages warning:', e);
    }
  }

  try {
    await apiFetch('/api/shortages/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cleanItems }),
    });
  } catch (error) {
    console.warn('Batch sync to Cloud SQL notice:', error);
  }
}

// Delete a shortage record
export async function deleteShortageFromCloud(id: string, ticketNumber: string, authorName = 'Admin'): Promise<void> {
  // 1. Add to deleted IDs in localStorage immediately to prevent race conditions during UI updates or snapshot updates
  try {
    const deletedRaw = localStorage.getItem('label_studio_shortage_deleted_ids');
    const deletedArray = deletedRaw ? JSON.parse(deletedRaw) : [];
    if (!deletedArray.includes(id)) {
      deletedArray.push(id);
      localStorage.setItem('label_studio_shortage_deleted_ids', JSON.stringify(deletedArray));
    }
  } catch (e) {}

  // 2. Optimistically remove from local cache
  const localItems = getLocalShortagesCache();
  const filtered = localItems.filter((i) => i.id !== id);
  saveLocalShortagesCache(filtered);

  // 3. Delete from Cloud SQL PostgreSQL API FIRST to prevent race conditions
  try {
    await apiFetch(`/api/shortages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.warn('Cloud SQL delete notice:', error);
  }

  // 4. Direct Firestore deletion
  if (!isQuotaExceededState()) {
    try {
      await deleteDoc(doc(db, COLLECTION_SHORTAGES, id));
      await notifyShortagesSignal(authorName, filtered.length);
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
      console.warn('Firestore delete shortage warning:', e);
    }
  }

  try {
    recordActivityLog({
      action: 'Xóa phiếu đặt chờ',
      ticketNumber,
      userName: authorName,
      details: `Đã xóa phiếu ${ticketNumber} khỏi hệ thống`,
      timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
    }).catch(() => {});
  } catch (error) {}
}

// Clear all shortage records from Cloud & Local cache
export async function clearAllShortagesFromCloud(authorName = 'Admin'): Promise<void> {
  // 1. Set clear all timestamp to now
  try {
    localStorage.setItem('label_studio_shortages_clear_all_timestamp', new Date().toISOString());
    // Also clear deleted IDs list since we cleared everything
    localStorage.setItem('label_studio_shortage_deleted_ids', JSON.stringify([]));
  } catch (e) {}

  // 2. Optimistically clear local cache and mark initialized
  saveLocalShortagesCache([]);
  try {
    localStorage.setItem('label_studio_shortage_initialized', 'true');
    localStorage.setItem(CACHE_KEY_SHORTAGES, JSON.stringify([]));
    localStorage.setItem('oppo_shortage_bookings_v2', JSON.stringify([]));
  } catch (e) {}

  // 3. Clear from Cloud SQL PostgreSQL API first
  try {
    await apiFetch('/api/shortages/clear/all', {
      method: 'DELETE',
    });
  } catch (error) {
    console.warn('Cloud SQL clear all notice:', error);
  }

  // 4. Direct Firestore deletion of all documents
  if (!isQuotaExceededState()) {
    try {
      const q = query(collection(db, COLLECTION_SHORTAGES), limit(1000));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
      await notifyShortagesSignal(authorName, 0);

      recordActivityLog({
        action: 'Xóa trắng toàn bộ danh sách đặt chờ linh kiện',
        ticketNumber: 'ALL',
        userName: authorName,
        details: `Đã xóa trắng toàn bộ danh sách phiếu đặt chờ khỏi hệ thống`,
        timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
      }).catch(() => {});
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
      console.warn('Firestore clear all shortages warning:', e);
    }
  }
}

// Record an audit log entry (Firestore + Cloud SQL)
export async function recordActivityLog(log: Omit<ActivityLogData, 'id'>): Promise<void> {
  const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const payload: ActivityLogData = { ...log, id: logId };

  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_LOGS, logId), payload);
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
    }
  }

  try {
    await apiFetch('/api/activity-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // ignore
  }
}

// Subscribe to real-time activity logs for Admin panel
export function subscribeToActivityLogs(
  onData: (logs: ActivityLogData[]) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;
  if (!isQuotaExceededState()) {
    try {
      const logsCol = collection(db, COLLECTION_LOGS);
      unsubFirestore = onSnapshot(
        logsCol,
        (snap) => {
          if (!snap.empty) {
            const list: ActivityLogData[] = [];
            snap.forEach((d) => list.push(d.data() as ActivityLogData));
            list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            onData(list.slice(0, 100));
          }
        },
        (err) => {
          if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
            setQuotaExceededState(true);
            if (unsubFirestore) unsubFirestore();
          }
        }
      );
    } catch (e) {
      // ignore
    }
  }

  const fetchLogs = () => {
    apiFetch('/api/activity-logs')
      .then((res) => res.json())
      .then((logs) => {
        if (Array.isArray(logs)) {
          onData(logs);
        }
      })
      .catch(() => {});
  };

  fetchLogs();
  const interval = setInterval(fetchLogs, 10000);
  return () => {
    if (unsubFirestore) unsubFirestore();
    clearInterval(interval);
  };
}

// ----------------------------------------------------
// USER ACCOUNTS & SESSIONS (Dual: Firestore + Cloud SQL)
// ----------------------------------------------------

export async function setUserPresence(uid: string, online: boolean): Promise<void> {
  // Dual-presence optimized: Write presence strictly to Cloud SQL PostgreSQL to prevent exceeding Firestore daily free write limit (20k writes/day Spark Plan).
  // Cloud SQL has no daily write limits and fully handles online/offline synchronization for all active users.
  try {
    await apiFetch('/api/users/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, online }),
    });
  } catch (err) {
    // ignore
  }
}

export async function updateUserSession(user: {
  uid: string;
  displayName: string;
  username?: string;
  email?: string;
  role: 'admin' | 'staff';
  status?: 'pending' | 'approved' | 'rejected';
}): Promise<void> {
  const now = new Date().toISOString();
  let effectiveRole = user.role;
  if (
    user.username === 'nhanvien' ||
    user.username === 'staff' ||
    user.username === 'kythuat' ||
    user.uid.startsWith('staff-demo')
  ) {
    effectiveRole = 'staff';
  } else if (user.role === 'admin' || user.username === 'admin' || user.uid === 'admin-master') {
    effectiveRole = 'admin';
  }

  const payload: Partial<UserSessionData> = {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email || '',
    role: effectiveRole,
    lastActive: now,
    online: true,
    device: typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') ? 'PC Windows' : 'Máy tính',
  };
  if (user.username !== undefined) payload.username = user.username;
  if (user.status !== undefined) payload.status = user.status;

  // Cloud SQL
  try {
    await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // ignore
  }

  // Direct Firestore
  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_USERS, user.uid), payload, { merge: true });
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
    }
  }
}

// Admin: Approve, Reject, or Change user
export async function approveUserSession(
  targetUid: string,
  updates: {
    status: 'pending' | 'approved' | 'rejected';
    username?: string;
    role?: 'admin' | 'staff';
    displayName?: string;
    password?: string;
  },
  adminName = 'Admin'
): Promise<void> {
  const now = `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;
  const payload: any = {
    uid: targetUid,
    ...updates,
    approvedBy: adminName,
    approvedAt: now,
    lastActive: now,
  };
  if (updates.username) payload.username = updates.username.toLowerCase();

  // If updating password for admin, sync Master PIN
  if (updates.password && (targetUid === 'admin-master' || updates.username?.toLowerCase() === 'admin')) {
    cachedMasterPin = updates.password.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('oppo_master_admin_pin', updates.password.trim());
    }
  }

  // 1. Direct Firestore write
  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_USERS, targetUid), payload, { merge: true });
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
      console.warn('Firestore user update warning:', e);
    }
  }

  // 2. Cloud SQL
  try {
    await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Cloud SQL user update notice:', err);
  }

  // 3. Log activity
  try {
    await recordActivityLog({
      action: updates.status === 'approved' ? 'Duyệt tài khoản người dùng' : updates.status === 'rejected' ? 'Từ chối / Khóa tài khoản' : 'Cập nhật thông tin User',
      userName: adminName,
      details: `User UID: ${targetUid} - Tên: ${updates.displayName || targetUid} - Trạng thái: ${updates.status} ${updates.username ? `(User: @${updates.username})` : ''}`,
      timestamp: now,
    });
  } catch (err) {
    // ignore
  }
}

// Admin: Delete a user record
export async function deleteUserSession(targetUid: string, adminName = 'Admin'): Promise<void> {
  // 1. Direct Firestore delete
  if (!isQuotaExceededState()) {
    try {
      await deleteDoc(doc(db, COLLECTION_USERS, targetUid));
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
    }
  }

  // 2. Cloud SQL delete
  try {
    await apiFetch(`/api/users/${encodeURIComponent(targetUid)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    // ignore
  }

  // 3. Log activity
  try {
    await recordActivityLog({
      action: 'Xóa người dùng khỏi hệ thống',
      userName: adminName,
      details: `Đã xóa tài khoản user UID: ${targetUid}`,
      timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
    });
  } catch (err) {
    // ignore
  }
}

// Subscribe to active users list (Dual sync: Firestore Realtime + Cloud SQL) with strict username deduplication
export function subscribeToUsers(onData: (users: UserSessionData[]) => void): () => void {
  let firestoreUsers: UserSessionData[] = [];
  let sqlUsers: UserSessionData[] = [];

  const emitMergedUsers = () => {
    const userByUsername = new Map<string, UserSessionData>();
    const orphanUidsToDelete: string[] = [];

    // Merge both sources, preferring whichever is already approved or canonical
    const combined = [...firestoreUsers, ...sqlUsers];

    combined.forEach((u) => {
      if (!u) return;
      const cleanUsername = (u.username || u.uid || '').toLowerCase().trim();
      if (!cleanUsername) return;

      const existing = userByUsername.get(cleanUsername);

      if (!existing) {
        const defaultStatus = (cleanUsername === 'admin' || u.uid === 'admin-master') ? 'approved' : 'pending';
        userByUsername.set(cleanUsername, {
          ...u,
          username: cleanUsername,
          status: u.status || defaultStatus,
        });
      } else {
        // Resolve duplicate records for same username:
        // Prefer canonical UID (admin-master or user_<username>), or approved status
        const existingIsCanonical = existing.uid === 'admin-master' || existing.uid === `user_${cleanUsername}`;
        const newIsCanonical = u.uid === 'admin-master' || u.uid === `user_${cleanUsername}`;

        let winner = existing;
        let loserUid = u.uid;

        if (newIsCanonical && !existingIsCanonical) {
          winner = { ...existing, ...u };
          loserUid = existing.uid;
        } else if (u.status === 'approved' && existing.status !== 'approved') {
          winner = { ...existing, ...u };
          loserUid = existing.uid;
        } else {
          winner = { ...existing, ...u };
          loserUid = u.uid;
        }

        const defaultStatus = (cleanUsername === 'admin' || winner.uid === 'admin-master') ? 'approved' : 'pending';
        userByUsername.set(cleanUsername, {
          ...winner,
          username: cleanUsername,
          status: winner.status || defaultStatus,
        });

        if (loserUid && loserUid !== winner.uid && loserUid !== 'admin-master') {
          orphanUidsToDelete.push(loserUid);
        }
      }
    });

    // Auto-clean orphan duplicate docs from Firestore and Cloud SQL
    if (orphanUidsToDelete.length > 0 && !isQuotaExceededState()) {
      orphanUidsToDelete.forEach((orphanUid) => {
        deleteDoc(doc(db, COLLECTION_USERS, orphanUid)).catch(() => {});
        apiFetch(`/api/users/${encodeURIComponent(orphanUid)}`, { method: 'DELETE' }).catch(() => {});
      });
    }

    const list = Array.from(userByUsername.values());
    list.sort((a, b) => (a.displayName || a.username || a.uid || '').localeCompare(b.displayName || b.username || b.uid || ''));
    if (list.length > 0) {
      onData(list);
    }
  };

  let unsubFirestore: (() => void) | null = null;
  if (!isQuotaExceededState()) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, COLLECTION_USERS),
        (snap) => {
          if (!snap.empty) {
            const list: UserSessionData[] = [];
            snap.forEach((d) => {
              list.push({ uid: d.id, ...(d.data() as any) });
            });
            firestoreUsers = list;
            emitMergedUsers();
          }
        },
        (err) => {
          if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
            setQuotaExceededState(true);
            if (unsubFirestore) unsubFirestore();
          }
        }
      );
    } catch (e) {
      // ignore
    }
  }

  const fetchUsersFromSQL = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const users = await res.json();
        if (Array.isArray(users) && users.length > 0) {
          sqlUsers = users;
          emitMergedUsers();
          const adminAcc = users.find(
            (u) => u.uid === 'admin-master' || (u.username && u.username.toLowerCase() === 'admin')
          );
          if (adminAcc && adminAcc.password && adminAcc.password.trim()) {
            cachedMasterPin = adminAcc.password.trim();
            if (typeof window !== 'undefined') {
              localStorage.setItem('oppo_master_admin_pin', adminAcc.password.trim());
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  };

  fetchUsersFromSQL();
  const interval = setInterval(fetchUsersFromSQL, 10000);

  return () => {
    if (unsubFirestore) unsubFirestore();
    clearInterval(interval);
  };
}

// Cached Master Admin PIN
let cachedMasterPin = typeof window !== 'undefined' && localStorage.getItem('oppo_master_admin_pin') 
  ? localStorage.getItem('oppo_master_admin_pin')! 
  : 'OPPO@2026';

// Update Master Admin PIN
export async function updateMasterAdminPin(newPin: string, adminName = 'Admin'): Promise<boolean> {
  const cleanPin = newPin.trim();
  if (!cleanPin || cleanPin.length < 4) {
    throw new Error('Mã PIN Quản trị tối cao phải từ 4 ký tự trở lên');
  }

  cachedMasterPin = cleanPin;
  if (typeof window !== 'undefined') {
    localStorage.setItem('oppo_master_admin_pin', cleanPin);
  }

  // Save to Firestore
  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_USERS, 'admin-master'), {
        uid: 'admin-master',
        username: 'admin',
        displayName: 'Quản Trị Viên (Admin Master)',
        password: cleanPin,
        role: 'admin',
        status: 'approved',
        lastActive: new Date().toISOString(),
      }, { merge: true });
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
    }
  }

  // Save to Cloud SQL
  try {
    await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: 'admin-master',
        username: 'admin',
        displayName: 'Quản Trị Viên (Admin Master)',
        password: cleanPin,
        role: 'admin',
        status: 'approved',
        lastActive: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // ignore
  }

  // Record Activity Log
  try {
    await recordActivityLog({
      action: 'Đổi Mã PIN Quản Trị Tối Cao (Master Admin)',
      userName: adminName,
      details: 'Đã cập nhật mã PIN Quản trị tối cao mới. Mọi mã PIN cũ ngay lập tức bị vô hiệu hóa!',
      timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
    });
  } catch (err) {
    // ignore
  }

  return true;
}

// Check master admin passcode
export function checkMasterAdminPasscode(passcode: string): boolean {
  const cleanInput = passcode.trim();
  const currentPin = (typeof window !== 'undefined' && localStorage.getItem('oppo_master_admin_pin')) 
    || cachedMasterPin 
    || 'OPPO@2026';

  return cleanInput === currentPin || cleanInput.toLowerCase() === currentPin.toLowerCase();
}

// Authenticate user with username and password
export async function authenticateUser(
  usernameInput: string,
  passwordInput: string
): Promise<{
  success: boolean;
  message: string;
  user?: UserSessionData;
  status?: 'approved' | 'pending' | 'rejected' | 'wrong_password' | 'not_found';
}> {
  const cleanUsername = usernameInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  // 1. Built-in Admin credentials
  if (cleanUsername === 'admin') {
    if (!checkMasterAdminPasscode(cleanPassword)) {
      return {
        success: false,
        message: 'Mật khẩu Quản trị viên (Admin) không chính xác. Mã admin123 đã bị vô hiệu hóa!',
        status: 'wrong_password',
      };
    }
    const adminUser: UserSessionData = {
      uid: `admin-master`,
      displayName: 'Quản Trị Viên (Admin)',
      username: 'admin',
      role: 'admin',
      status: 'approved',
      lastActive: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
      online: true,
    };
    return {
      success: true,
      message: 'Xác thực Quản Trị Viên (Admin) thành công!',
      user: adminUser,
      status: 'approved',
    };
  }

  // 2. Query Firestore & Cloud SQL for user account
  let matchedUser: UserSessionData | null = null;

  // Try Firestore direct query first
  if (!isQuotaExceededState()) {
    try {
      const snap = await getDocs(collection(db, COLLECTION_USERS));
      if (!snap.empty) {
        snap.forEach((d) => {
          const u = { uid: d.id, ...(d.data() as any) } as UserSessionData;
          if (
            (u.username && u.username.toLowerCase() === cleanUsername) ||
            (u.uid && u.uid.toLowerCase() === cleanUsername)
          ) {
            matchedUser = u;
          }
        });
      }
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
    }
  }

  // If not found in Firestore, try Cloud SQL
  if (!matchedUser) {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const allUsers: UserSessionData[] = await res.json();
        if (Array.isArray(allUsers)) {
          matchedUser = allUsers.find(
            (data) =>
              (data.username && data.username.toLowerCase() === cleanUsername) ||
              (data.uid && data.uid.toLowerCase() === cleanUsername)
          ) || null;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (!matchedUser) {
    // Demo fallback for default testing accounts
    const isDemoStaff = cleanUsername === 'nhanvien' || cleanUsername === 'staff' || cleanUsername === 'kythuat';
    if (isDemoStaff) {
      const fallbackUser: UserSessionData = {
        uid: `staff-demo-${cleanUsername}`,
        displayName: 'Nhân Viên Kỹ Thuật HCM4',
        username: cleanUsername,
        role: 'staff',
        status: 'approved',
        lastActive: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
        online: true,
      };
      return {
        success: true,
        message: 'Đăng nhập thành công tài khoản Kỹ thuật!',
        user: fallbackUser,
        status: 'approved',
      };
    }

    return {
      success: false,
      message: 'Tài khoản không tồn tại trên hệ thống. Vui lòng bấm "Yêu Cầu Cấp Quyền" để đăng ký tài khoản mới!',
      status: 'not_found',
    };
  }

  const targetUser = matchedUser as UserSessionData;

  // Password Verification
  if (!cleanPassword) {
    return {
      success: false,
      message: 'Vui lòng nhập mật khẩu tài khoản!',
      status: 'wrong_password',
    };
  }

  if (targetUser.role === 'admin' || targetUser.username?.toLowerCase() === 'admin') {
    if (!checkMasterAdminPasscode(cleanPassword)) {
      return {
        success: false,
        message: 'Mật khẩu Quản trị viên (Admin) không chính xác!',
        status: 'wrong_password',
      };
    }
  } else {
    if (targetUser.password && targetUser.password.trim() !== cleanPassword) {
      return {
        success: false,
        message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!',
        status: 'wrong_password',
      };
    }
  }

  // Status Verification
  if (targetUser.status === 'pending') {
    return {
      success: false,
      message: 'Tài khoản của bạn đang chờ Quản trị viên (Admin) phê duyệt!',
      user: targetUser,
      status: 'pending',
    };
  }

  if (targetUser.status === 'rejected') {
    return {
      success: false,
      message: 'Tài khoản này đã bị từ chối hoặc khóa bởi Quản trị viên!',
      user: targetUser,
      status: 'rejected',
    };
  }

  return {
    success: true,
    message: `Đăng nhập thành công: ${targetUser.displayName}`,
    user: targetUser,
    status: 'approved',
  };
}

// Request / Register new user access
export async function requestUserAccess(userData: {
  uid: string;
  displayName: string;
  username: string;
  password: string;
  role: 'admin' | 'staff';
  device?: string;
}): Promise<{ success: boolean; message: string }> {
  const cleanUsername = userData.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cleanUsername) {
    throw new Error('Tên truy cập không hợp lệ');
  }

  const canonicalUid = cleanUsername === 'admin' ? 'admin-master' : `user_${cleanUsername}`;

  // Check if account already exists with this username
  let existingUser: any = null;
  if (!isQuotaExceededState()) {
    try {
      const snap = await getDocs(collection(db, COLLECTION_USERS));
      if (!snap.empty) {
        snap.forEach((d) => {
          const u = d.data() as UserSessionData;
          if (u && u.username && u.username.toLowerCase().trim() === cleanUsername) {
            existingUser = u;
          }
        });
      }
    } catch (e) {
      // ignore
    }
  }

  if (existingUser && existingUser.status === 'approved') {
    return {
      success: false,
      message: `Tài khoản "@${cleanUsername}" đã tồn tại và đã được phê duyệt. Vui lòng chuyển sang tab Đăng Nhập!`,
    };
  }

  const now = `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;
  const isMasterAdmin = (canonicalUid === 'admin-master' || cleanUsername === 'admin');
  const payload: UserSessionData = {
    uid: canonicalUid,
    displayName: userData.displayName.trim(),
    username: cleanUsername,
    password: userData.password.trim(),
    role: userData.role,
    status: isMasterAdmin ? 'approved' : 'pending',
    lastActive: now,
    online: true,
    device: userData.device || (typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') ? 'PC Windows' : 'Máy tính'),
  };

  // 1. Direct Firestore write
  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_USERS, canonicalUid), payload, { merge: true });
    } catch (firestoreErr: any) {
      if (firestoreErr?.code === 'resource-exhausted' || firestoreErr?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
      console.warn('Firestore register warning:', firestoreErr);
    }
  }

  // 2. Cloud SQL write
  try {
    await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // ignore
  }

  recordActivityLog({
    action: 'Đăng ký tài khoản mới',
    userName: userData.displayName,
    details: `User @${cleanUsername} (${userData.displayName}) đăng ký quyền ${userData.role === 'admin' ? 'Quản trị viên' : 'Kỹ thuật viên'} - Đang chờ duyệt`,
    timestamp: now,
  }).catch(() => {});

  return {
    success: true,
    message: 'Đã gửi thông tin đăng ký lên hệ thống. Vui lòng chờ Admin duyệt!',
  };
}

// Admin: Save or update user
export async function adminSaveUser(
  user: UserSessionData,
  adminName = 'Admin'
): Promise<void> {
  const now = `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;
  const payload: UserSessionData = {
    ...user,
    lastActive: user.lastActive || now,
  };

  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_USERS, user.uid), payload, { merge: true });
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
    }
  }

  try {
    await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // ignore
  }

  recordActivityLog({
    action: 'Cập nhật tài khoản người dùng',
    userName: adminName,
    details: `Admin cập nhật tài khoản: @${user.username} (${user.displayName}) - Vai trò: ${user.role} - Trạng thái: ${user.status}`,
    timestamp: now,
  }).catch(() => {});
}

// Subscribe to a specific user's status
export function subscribeToUserStatus(
  uid: string,
  onUpdate: (user: UserSessionData | null) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;
  if (!isQuotaExceededState()) {
    try {
      unsubFirestore = onSnapshot(
        doc(db, COLLECTION_USERS, uid),
        (snap) => {
          if (snap.exists()) {
            const data = { uid: snap.id, ...(snap.data() as any) };
            const defaultStatus = data.role === 'admin' || data.username === 'admin' || data.uid === 'admin-master' ? 'approved' : 'pending';
            onUpdate({ ...data, status: data.status || defaultStatus });
          }
        },
        (err) => {
          if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
            setQuotaExceededState(true);
            if (unsubFirestore) unsubFirestore();
          }
        }
      );
    } catch (e) {
      // ignore
    }
  }

  const fetchStatusFromSQL = async () => {
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.uid) {
          const defaultStatus = data.role === 'admin' || data.username === 'admin' || data.uid === 'admin-master' ? 'approved' : 'pending';
          onUpdate({ ...data, status: data.status || defaultStatus });
        }
      }
    } catch (e) {
      // ignore
    }
  };

  fetchStatusFromSQL();
  const interval = setInterval(fetchStatusFromSQL, 10000);

  return () => {
    if (unsubFirestore) unsubFirestore();
    clearInterval(interval);
  };
}

// ----------------------------------------------------
// TAB 1: MASTER LABEL CATALOG (Dual: Cloud SQL + Local Cache + Firestore Signal)
// ----------------------------------------------------

export function subscribeToCatalogLabels(
  onData: (items: LabelItem[]) => void,
  _onError?: (err: any) => void
): () => void {
  const cached = deduplicateLabelItems(getLocalCatalogCache());
  if (cached.length > 0) {
    onData(cached);
  }

  const fetchCatalog = async () => {
    try {
      const items = await fetchCatalogLabelsFromCloud();
      if (Array.isArray(items) && items.length > 0) {
        onData(items);
      }
    } catch (err) {
      // ignore
    }
  };

  let unsubSignal: (() => void) | null = null;

  if (!isQuotaExceededState()) {
    try {
      const signalRef = doc(db, 'system_catalog', 'master_signal');
      unsubSignal = onSnapshot(
        signalRef,
        () => {
          fetchCatalog();
        },
        (err) => {
          if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
            setQuotaExceededState(true);
            if (unsubSignal) unsubSignal();
          } else {
            console.warn('Catalog signal snapshot notice:', err);
          }
        }
      );
    } catch (e) {
      // ignore
    }
  }

  fetchCatalog();

  const interval = setInterval(fetchCatalog, 10000);

  return () => {
    if (unsubSignal) unsubSignal();
    clearInterval(interval);
  };
}

export async function notifyCatalogSignal(authorName: string, count: number): Promise<void> {
  if (isQuotaExceededState()) return;
  try {
    const signalRef = doc(db, 'system_catalog', 'master_signal');
    await setDoc(
      signalRef,
      {
        updatedAt: serverTimestamp(),
        updatedBy: authorName,
        count,
        version: Date.now(),
      },
      { merge: true }
    );
  } catch (e: any) {
    if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
      setQuotaExceededState(true);
    }
  }
}

export async function saveCatalogLabelToCloud(
  item: LabelItem,
  authorName = 'Admin'
): Promise<void> {
  const code = (item.code || '').trim().toLowerCase();
  const name = (item.name || '').trim().toLowerCase();
  let safeId = item.id;
  if (code) {
    safeId = `code_${code.replace(/[\/\s#?.-]/g, '_')}`;
  } else if (name) {
    safeId = `name_${name.replace(/[\/\s#?.-]/g, '_')}`;
  }

  const processedItem = { ...item, id: safeId };

  const localItems = deduplicateLabelItems(getLocalCatalogCache());
  const idx = localItems.findIndex((i) => i.id === safeId || (code && (i.code || '').trim().toLowerCase() === code));
  if (idx >= 0) {
    localItems[idx] = processedItem;
  } else {
    localItems.unshift(processedItem);
  }
  const cleanList = deduplicateLabelItems(localItems);
  saveLocalCatalogCache(cleanList);

  // 1. Direct Firestore write (silent catch on quota error)
  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_LABEL_CATALOG, safeId), processedItem, { merge: true });
      await notifyCatalogSignal(authorName, cleanList.length);
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
    }
  }

  // 2. Cloud SQL write
  try {
    await apiFetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processedItem),
    });

    recordActivityLog({
      action: 'Cập nhật tem linh kiện gốc',
      userName: authorName,
      details: `Mã: ${processedItem.code} - Tên: ${processedItem.name}`,
      timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
    }).catch(() => {});
  } catch (error) {
    console.warn('Cloud SQL save catalog label notice:', error);
  }
}

export async function saveBulkCatalogLabelsToCloud(
  items: LabelItem[],
  authorName = 'Admin',
  onProgress?: (synced: number, total: number) => void,
  replace = true
): Promise<LabelItem[]> {
  if (!items || items.length === 0) return [];

  // Strictly deduplicate by Part Code / Name
  const uniqueItems = deduplicateLabelItems(items);

  const processedItems = uniqueItems.map((item, index) => {
    const code = (item.code || '').trim().toLowerCase();
    const name = (item.name || '').trim().toLowerCase();
    let safeId = item.id;
    if (code) {
      safeId = `code_${code.replace(/[\/\s#?.-]/g, '_')}`;
    } else if (name) {
      safeId = `name_${name.replace(/[\/\s#?.-]/g, '_')}`;
    } else {
      safeId = item.id || `item_${index}_${Date.now()}`;
    }
    return {
      ...item,
      id: safeId,
    };
  });

  const total = processedItems.length;
  saveLocalCatalogCache(processedItems);

  // 1. Primary storage: Cloud SQL Bulk API (no daily quota limits!)
  let sqlSuccess = false;
  try {
    await apiFetch('/api/catalog/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: processedItems, replace }),
    });
    sqlSuccess = true;
    if (onProgress) onProgress(total, total);
  } catch (err) {
    console.warn('Cloud SQL bulk save notice:', err);
  }

  // 2. Secondary sync: Firestore (wrapped in safe catch for resource-exhausted free tier limits)
  if (!isQuotaExceededState()) {
    try {
      if (replace) {
        const snap = await getDocs(collection(db, COLLECTION_LABEL_CATALOG));
        const existingDocs = snap.docs;
        const newIds = new Set(processedItems.map((p) => p.id));
        const docsToDelete = existingDocs.filter((d) => !newIds.has(d.id));

        const deletePromises = [];
        for (let i = 0; i < docsToDelete.length; i += 400) {
          const chunk = docsToDelete.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          deletePromises.push(batch.commit());
        }
        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
        }
      }

      const chunks: LabelItem[][] = [];
      for (let i = 0; i < processedItems.length; i += 400) {
        chunks.push(processedItems.slice(i, i + 400));
      }

      const CONCURRENCY = 2;
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const group = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(
          group.map((chunk) => {
            const batch = writeBatch(db);
            chunk.forEach((it) => {
              const docRef = doc(db, COLLECTION_LABEL_CATALOG, it.id);
              batch.set(docRef, it, { merge: true });
            });
            return batch.commit();
          })
        );
      }
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
      console.warn('Firestore bulk sync bypassed quota/network limit (Cloud SQL used):', e?.message || e);
    }
  }

  // Signal change to all connected clients
  await notifyCatalogSignal(authorName, total);

  if (onProgress) {
    onProgress(total, total);
  }

  recordActivityLog({
    action: 'Đồng bộ danh mục tem lên Cloud',
    userName: authorName,
    details: `Đã đồng bộ toàn bộ ${total} linh kiện mẫu lên Cloud (${sqlSuccess ? 'Cloud SQL' : 'Local Cache'})`,
    timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
  }).catch(() => {});

  return processedItems;
}

export async function fetchCatalogLabelsFromCloud(): Promise<LabelItem[]> {
  // 1. Cloud SQL first (fast & no quota limits!)
  try {
    const res = await apiFetch('/api/catalog');
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        const deduplicated = deduplicateLabelItems(items);
        saveLocalCatalogCache(deduplicated);
        return deduplicated;
      }
    }
  } catch (error) {
    // ignore
  }

  // 2. Firestore fallback
  if (!isQuotaExceededState()) {
    try {
      const snap = await getDocs(collection(db, COLLECTION_LABEL_CATALOG));
      if (!snap.empty) {
        const rawItems: LabelItem[] = [];
        snap.forEach((d) => rawItems.push({ id: d.id, ...(d.data() as any) }));
        const deduplicated = deduplicateLabelItems(rawItems);
        saveLocalCatalogCache(deduplicated);
        return deduplicated;
      }
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
      console.warn('Firestore fetch catalog notice:', e);
    }
  }

  return deduplicateLabelItems(getLocalCatalogCache());
}

export interface SystemAnalyticsData {
  totalVisits: number;
  onlineCount?: number;
  activeUsers?: string[];
  lastVisitAt?: string;
}

export async function trackAppVisit(): Promise<number> {
  const localKey = 'oppo_app_total_visits';
  let currentLocalVisits = parseInt(localStorage.getItem(localKey) || '1280', 10);
  currentLocalVisits += 1;
  localStorage.setItem(localKey, currentLocalVisits.toString());

  try {
    const res = await apiFetch('/api/analytics', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.totalVisits === 'number') {
        localStorage.setItem(localKey, data.totalVisits.toString());
        return data.totalVisits;
      }
    }
  } catch (err) {
    // ignore
  }
  return currentLocalVisits;
}

export function subscribeToAnalytics(onData: (data: SystemAnalyticsData) => void): () => void {
  const fetchStats = () => {
    apiFetch('/api/analytics')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.totalVisits === 'number') {
          onData(data);
        }
      })
      .catch(() => {});
  };

  fetchStats();
  const interval = setInterval(fetchStats, 15000);
  return () => clearInterval(interval);
}

export async function deleteCatalogLabelFromCloud(
  itemId: string,
  authorName = 'Admin'
): Promise<void> {
  const localItems = getLocalCatalogCache();
  const filtered = localItems.filter((i) => i.id !== itemId);
  saveLocalCatalogCache(filtered);

  if (!isQuotaExceededState()) {
    try {
      await deleteDoc(doc(db, COLLECTION_LABEL_CATALOG, itemId));
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
    }
  }

  try {
    await apiFetch(`/api/catalog/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    });

    await recordActivityLog({
      action: 'Xóa tem linh kiện gốc',
      userName: authorName,
      details: `Đã xóa linh kiện ID: ${itemId}`,
      timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
    });
  } catch (err) {
    // ignore
  }
}

export async function clearCatalogLabelsOnCloud(
  authorName = 'Admin',
  onProgress?: (deleted: number, total: number) => void
): Promise<void> {
  saveLocalCatalogCache([]);

  // 1. Primary: Cloud SQL clear
  try {
    await apiFetch('/api/catalog', {
      method: 'DELETE',
    });
    if (onProgress) onProgress(1, 1);
  } catch (err) {
    console.warn('Cloud SQL clear notice:', err);
  }

  // 2. Secondary: Firestore purge (safely caught for quota limits)
  if (!isQuotaExceededState()) {
    try {
      const snap = await getDocs(collection(db, COLLECTION_LABEL_CATALOG));
      const docs = snap.docs;
      const totalDocs = docs.length;

      const chunks = [];
      for (let i = 0; i < totalDocs; i += 400) {
        chunks.push(docs.slice(i, i + 400));
      }

      const CONCURRENCY = 2;
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const group = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(
          group.map((chunk) => {
            const batch = writeBatch(db);
            chunk.forEach((d) => batch.delete(d.ref));
            return batch.commit();
          })
        );
      }
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
      console.warn('Firestore clear catalog notice (Cloud SQL used):', e?.message || e);
    }
  }

  await notifyCatalogSignal(authorName, 0);

  if (onProgress) {
    onProgress(1, 1);
  }

  recordActivityLog({
    action: 'Xóa sạch danh mục tem trên Cloud',
    userName: authorName,
    details: `Đã xóa toàn bộ danh mục tem mẫu khỏi Cloud`,
    timestamp: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
  }).catch(() => {});
}

// ----------------------------------------------------
// TAB 2: STAFF REQUEST CANCELLATION
// ----------------------------------------------------

export async function requestShortageCancel(
  ticketId: string,
  ticketNumber: string,
  reason: string,
  staffName: string
): Promise<void> {
  const localItems = getLocalShortagesCache();
  const item = localItems.find((i) => i.id === ticketId);
  const now = `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;

  if (item) {
    const updated = {
      ...item,
      cancelRequested: true,
      cancelReason: reason || 'Nhân viên yêu cầu hủy phiếu',
      cancelRequestedBy: staffName,
      cancelRequestedAt: now,
    };
    await saveShortageToCloud(updated, staffName);
  } else {
    const cloudItems = await pullLatestShortagesFromCloud();
    const cloudItem = cloudItems.find((i) => i.id === ticketId);
    if (cloudItem) {
      const updated = {
        ...cloudItem,
        cancelRequested: true,
        cancelReason: reason || 'Nhân viên yêu cầu hủy phiếu',
        cancelRequestedBy: staffName,
        cancelRequestedAt: now,
      };
      await saveShortageToCloud(updated, staffName);
    }
  }

  await recordActivityLog({
    action: 'Yêu cầu hủy phiếu đặt chờ',
    userName: staffName,
    ticketNumber,
    details: `Lý do: ${reason || 'Không nêu'}`,
    timestamp: now,
  }).catch(() => {});
}

export async function rejectShortageCancel(
  ticketId: string,
  ticketNumber: string,
  adminName: string
): Promise<void> {
  const localItems = getLocalShortagesCache();
  const item = localItems.find((i) => i.id === ticketId);
  const now = `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;

  if (item) {
    const updated = {
      ...item,
      cancelRequested: false,
      cancelReason: '',
      cancelRequestedBy: '',
      cancelRequestedAt: '',
    };
    await saveShortageToCloud(updated, adminName);
  } else {
    const cloudItems = await pullLatestShortagesFromCloud();
    const cloudItem = cloudItems.find((i) => i.id === ticketId);
    if (cloudItem) {
      const updated = {
        ...cloudItem,
        cancelRequested: false,
        cancelReason: '',
        cancelRequestedBy: '',
        cancelRequestedAt: '',
      };
      await saveShortageToCloud(updated, adminName);
    }
  }

  await recordActivityLog({
    action: 'Bác bỏ yêu cầu hủy phiếu',
    userName: adminName,
    ticketNumber,
    details: `Admin ${adminName} đã từ chối yêu cầu hủy phiếu ${ticketNumber}`,
    timestamp: now,
  }).catch(() => {});
}

// ----------------------------------------------------
// TAB 2: STAFF REQUEST EDIT TICKET & ADMIN APPROVAL
// ----------------------------------------------------

export async function requestShortageEdit(
  ticketId: string,
  ticketNumber: string,
  pendingData: Partial<ShortageBookingItem>,
  reason: string,
  staffName: string
): Promise<void> {
  const localItems = getLocalShortagesCache();
  const item = localItems.find((i) => i.id === ticketId);
  const now = `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;

  if (item) {
    const updated: ShortageBookingItem = {
      ...item,
      editRequested: true,
      editReason: reason || 'Nhân viên yêu cầu cập nhật thông tin phiếu',
      editRequestedBy: staffName,
      editRequestedAt: now,
      pendingEditData: pendingData,
    };
    await saveShortageToCloud(updated, staffName);
  } else {
    const cloudItems = await pullLatestShortagesFromCloud();
    const cloudItem = cloudItems.find((i) => i.id === ticketId);
    if (cloudItem) {
      const updated: ShortageBookingItem = {
        ...cloudItem,
        editRequested: true,
        editReason: reason || 'Nhân viên yêu cầu cập nhật thông tin phiếu',
        editRequestedBy: staffName,
        editRequestedAt: now,
        pendingEditData: pendingData,
      };
      await saveShortageToCloud(updated, staffName);
    }
  }

  await recordActivityLog({
    action: 'Yêu cầu sửa phiếu đặt chờ',
    userName: staffName,
    ticketNumber,
    details: `Lý do: ${reason || 'Không nêu'} (Chờ Admin duyệt)`,
    timestamp: now,
  }).catch(() => {});
}

export async function approveShortageEdit(
  ticketId: string,
  ticketNumber: string,
  adminName: string
): Promise<void> {
  const localItems = getLocalShortagesCache();
  const item = localItems.find((i) => i.id === ticketId);
  const now = `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;
  const nowIso = new Date().toISOString();

  let targetItem = item;
  if (!targetItem) {
    const cloudItems = await pullLatestShortagesFromCloud();
    targetItem = cloudItems.find((i) => i.id === ticketId);
  }

  if (targetItem && targetItem.pendingEditData) {
    const pending = targetItem.pendingEditData;
    const newHistory = [
      ...(targetItem.history || []),
      {
        status: (pending.status || targetItem.status) as any,
        timestamp: now,
        note: `Admin duyệt sửa đổi từ [${targetItem.editRequestedBy || 'Nhân viên'}]: ${targetItem.editReason || 'Cập nhật phiếu'}`,
      },
    ];

    const updated: ShortageBookingItem = {
      ...targetItem,
      ...pending,
      editRequested: false,
      editReason: undefined,
      editRequestedBy: undefined,
      editRequestedAt: undefined,
      pendingEditData: undefined,
      updatedAt: nowIso,
      history: newHistory,
    };

    await saveShortageToCloud(updated, adminName);

    await recordActivityLog({
      action: 'Duyệt yêu cầu sửa phiếu',
      userName: adminName,
      ticketNumber,
      details: `Admin ${adminName} đã phê duyệt các thay đổi cho phiếu ${ticketNumber}`,
      timestamp: now,
    }).catch(() => {});
  }
}

export async function rejectShortageEdit(
  ticketId: string,
  ticketNumber: string,
  adminName: string
): Promise<void> {
  const localItems = getLocalShortagesCache();
  const item = localItems.find((i) => i.id === ticketId);
  const now = `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;

  let targetItem = item;
  if (!targetItem) {
    const cloudItems = await pullLatestShortagesFromCloud();
    targetItem = cloudItems.find((i) => i.id === ticketId);
  }

  if (targetItem) {
    const updated: ShortageBookingItem = {
      ...targetItem,
      editRequested: false,
      editReason: undefined,
      editRequestedBy: undefined,
      editRequestedAt: undefined,
      pendingEditData: undefined,
    };
    await saveShortageToCloud(updated, adminName);

    await recordActivityLog({
      action: 'Từ chối yêu cầu sửa phiếu',
      userName: adminName,
      ticketNumber,
      details: `Admin ${adminName} đã bác bỏ yêu cầu chỉnh sửa phiếu ${ticketNumber}`,
      timestamp: now,
    }).catch(() => {});
  }
}

/**
 * Synchronizes user read notification IDs & seen warning IDs to Firestore database
 * so when logging in on a new device, read status is preserved across devices.
 */
export async function syncUserReadNotifsToFirestore(
  userKey: string,
  readNotificationIds: string[],
  seenWarningIds: string[]
): Promise<void> {
  if (!userKey || userKey === 'user_guest') return;
  if (isQuotaExceededState()) return;
  try {
    const docRef = doc(db, 'user_notif_reads', userKey);
    await setDoc(
      docRef,
      {
        userKey,
        readNotificationIds,
        seenWarningIds,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e: any) {
    if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
      setQuotaExceededState(true);
    }
    console.warn('Error syncing user read notifications to Firestore:', e);
  }
}

/**
 * Fetches user read notification IDs & seen warning IDs from Firestore database
 */
export async function fetchUserReadNotifsFromFirestore(
  userKey: string
): Promise<{ readNotificationIds: string[]; seenWarningIds: string[] } | null> {
  if (!userKey || userKey === 'user_guest') return null;
  if (isQuotaExceededState()) return null;
  try {
    const docRef = doc(db, 'user_notif_reads', userKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        readNotificationIds: Array.isArray(data.readNotificationIds) ? data.readNotificationIds : [],
        seenWarningIds: Array.isArray(data.seenWarningIds) ? data.seenWarningIds : [],
      };
    }
  } catch (e: any) {
    if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
      setQuotaExceededState(true);
    }
    console.warn('Error fetching user read notifications from Firestore:', e);
  }
  return null;
}


