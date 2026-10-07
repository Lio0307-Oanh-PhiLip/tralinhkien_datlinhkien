import {
  collection,
  doc,
  getDocs,
  setDoc,
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
  isQuotaExceededState,
  setQuotaExceededState,
} from '../lib/firebase';
import { DeviceIotBookingItem, DeviceIotHistoryEntry, DeviceIotCallLog } from '../types/deviceIot';
import { apiFetch } from './firebaseShortageService';
import {
  loadLocalDeviceIotBookings,
  saveLocalDeviceIotBookings,
} from '../utils/deviceIotHelper';

const COLLECTION_DEVICE_IOTS = 'device_iot_bookings';

export function parseDateToMillis(dateStr: any): number {
  if (!dateStr) return 0;
  const trimmed = String(dateStr).trim();
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
  h1: DeviceIotHistoryEntry[] | undefined,
  h2: DeviceIotHistoryEntry[] | undefined
): DeviceIotHistoryEntry[] {
  const list1 = Array.isArray(h1) ? h1 : [];
  const list2 = Array.isArray(h2) ? h2 : [];
  const combined = [...list1, ...list2];
  const seen = new Set<string>();
  const merged: DeviceIotHistoryEntry[] = [];
  
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
    return tA - tB; // chronological order (oldest first)
  });
}

function mergeCallLogs(
  c1: DeviceIotCallLog[] | undefined,
  c2: DeviceIotCallLog[] | undefined
): DeviceIotCallLog[] {
  const list1 = Array.isArray(c1) ? c1 : [];
  const list2 = Array.isArray(c2) ? c2 : [];
  const combined = [...list1, ...list2];
  const seen = new Set<string>();
  const merged: DeviceIotCallLog[] = [];

  for (const c of combined) {
    if (!c) continue;
    const key = c.id || `${(c.calledDate || '').trim()}_${c.subStatus}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }

  return merged.sort((a, b) => {
    const tA = parseDateToMillis(a.calledDate);
    const tB = parseDateToMillis(b.calledDate);
    return tA - tB; // chronological order
  });
}

export function mergeTwoDeviceIotItems(
  item1: DeviceIotBookingItem,
  item2: DeviceIotBookingItem
): DeviceIotBookingItem {
  if (!item1) return item2;
  if (!item2) return item1;

  const t1 = parseDateToMillis(item1.updatedAt || item1.createdAt);
  const t2 = parseDateToMillis(item2.updatedAt || item2.createdAt);

  let base: DeviceIotBookingItem;
  let fallback: DeviceIotBookingItem;

  if (t2 > t1) {
    base = { ...item2 };
    fallback = item1;
  } else if (t1 > t2) {
    base = { ...item1 };
    fallback = item2;
  } else {
    // If timestamps are equal, prefer the one with more history log entries
    const h1 = item1.history?.length || 0;
    const h2 = item2.history?.length || 0;
    if (h2 > h1) {
      base = { ...item2 };
      fallback = item1;
    } else {
      base = { ...item1 };
      fallback = item2;
    }
  }

  // Preserve metadata fields if they are missing/empty in base but present in fallback
  const fieldsToPreserve: (keyof DeviceIotBookingItem)[] = [
    'createdBy',
    'createdByUid',
    'creatorTechnician',
    'createdAt',
    'ticketNumber',
    'customerName',
    'customerPhone',
    'deviceModel',
    'deviceName',
    'skuCode',
    'imeiOrIot',
    'deviceCategory',
    'flowType',
    'bookingDate',
    'requestedDate',
    'stockedInDate',
    'location',
    'calledCustomerDate',
    'callSubStatus',
    'appointmentDate',
    'callNote',
    'customerArrivedDate',
    'technicianName',
    'note',
    'isCompletedWithoutExchange',
    'closureReason',
    'closureNote',
    'closureBy',
    'cancelRequestedBy',
    'cancelRequestedAt',
    'cancelReason',
    'warrantyCenterName',
    'warrantyCenterPhone',
    'citizenId',
    'fileNumber',
    'repairModel',
    'repairColor',
    'repairSn',
    'repairImei',
    'repairDate',
    'repairDays',
    'loanDevicePrice',
    'depositAmountInWords',
    'paymentMethod',
  ];

  for (const field of fieldsToPreserve) {
    if (base[field] === undefined || base[field] === null || base[field] === '') {
      if (fallback[field] !== undefined && fallback[field] !== null && fallback[field] !== '') {
        (base as any)[field] = fallback[field];
      }
    }
  }

  if (base.cancelRequested === undefined || base.cancelRequested === null) {
    if (fallback.cancelRequested !== undefined && fallback.cancelRequested !== null) {
      base.cancelRequested = fallback.cancelRequested;
    }
  }

  // Smart merge history arrays and call logs
  base.history = mergeHistory(base.history, fallback.history);
  base.callLogs = mergeCallLogs(base.callLogs, fallback.callLogs);

  return base;
}

export function deduplicateDeviceIots(items: DeviceIotBookingItem[]): DeviceIotBookingItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const map = new Map<string, DeviceIotBookingItem>();
  for (const item of items) {
    if (!item || !item.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, { ...item });
    } else {
      map.set(item.id, mergeTwoDeviceIotItems(existing, item));
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const tA = parseDateToMillis(a.createdAt || a.bookingDate || a.updatedAt);
    const tB = parseDateToMillis(b.createdAt || b.bookingDate || b.updatedAt);
    return tB - tA;
  });
}

export function filterDeviceIots(items: DeviceIotBookingItem[]): DeviceIotBookingItem[] {
  if (!Array.isArray(items)) return [];
  // Clean up legacy keys if present so valid items are never filtered out
  try {
    localStorage.removeItem('label_studio_device_iot_clear_all_timestamp');
    localStorage.removeItem('label_studio_device_iot_deleted_ids');
  } catch (e) {}

  return items.filter((item) => item && item.id && (item.ticketNumber || item.customerName));
}

// 1. Subscribe in real-time with Cloud SQL Signal and Firestore snapshot
export function subscribeToDeviceIots(
  callback: (items: DeviceIotBookingItem[], isFromCloud: boolean) => void,
  onError?: (err: any) => void
): () => void {
  // Emit local cache immediately
  const localCached = filterDeviceIots(loadLocalDeviceIotBookings());
  if (Array.isArray(localCached) && localCached.length > 0) {
    callback(localCached, false);
  }

  let isFetching = false;
  let lastSignalVersion = 0;

  const refreshFromCloud = async () => {
    if (isFetching) return;
    isFetching = true;
    try {
      const items = await pullLatestDeviceIotsFromCloud();
      if (Array.isArray(items)) {
        callback(items, true);
      }
    } catch (e) {
      console.warn('Device IOT refresh notice:', e);
    } finally {
      isFetching = false;
    }
  };

  // Initial pull on mount
  refreshFromCloud();

  // Firestore real-time listener (when available)
  let unsubscribeSnapshot: (() => void) | null = null;
  if (!isQuotaExceededState()) {
    try {
      const q = query(collection(db, COLLECTION_DEVICE_IOTS), limit(500));
      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          const cloudItems: DeviceIotBookingItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            cloudItems.push({
              id: docSnap.id,
              ...data,
            } as DeviceIotBookingItem);
          });

          if (cloudItems.length > 0) {
            const local = loadLocalDeviceIotBookings();
            const combined = [...local, ...cloudItems];
            const merged = deduplicateDeviceIots(filterDeviceIots(combined));
            saveLocalDeviceIotBookings(merged);
            callback(merged, true);
          }
        },
        (err: any) => {
          console.warn('Firestore device_iot_bookings subscription notice:', err);
          if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
            setQuotaExceededState(true, err.message);
            if (unsubscribeSnapshot) {
              unsubscribeSnapshot();
              unsubscribeSnapshot = null;
            }
          }
          if (onError) onError(err);
        }
      );
    } catch (err) {
      console.warn('Failed to setup device_iot_bookings subscription:', err);
    }
  }

  // Signal check every 6 seconds against Server API (lightweight, zero Firestore quota consumption)
  const signalInterval = setInterval(async () => {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    try {
      const res = await apiFetch('/api/signals/device-iot', { cache: 'no-store' });
      if (res.ok) {
        const signal = await res.json();
        if (signal && signal.version && signal.version !== lastSignalVersion) {
          lastSignalVersion = signal.version;
          refreshFromCloud();
        }
      }
    } catch (e) {
      // ignore network hiccups
    }
  }, 6000);

  return () => {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    clearInterval(signalInterval);
  };
}

// 2. Save single item to Cloud (PostgreSQL + Firestore dual-write)
export async function saveDeviceIotToCloud(item: DeviceIotBookingItem): Promise<void> {
  if (!item || !item.id) return;

  const nowIso = new Date().toISOString();
  const updatedItem: DeviceIotBookingItem = {
    ...item,
    updatedAt: nowIso,
  };

  // 1. Optimistically update local cache
  const local = loadLocalDeviceIotBookings();
  const filtered = local.filter((b) => b.id !== item.id);
  const newLocal = deduplicateDeviceIots([updatedItem, ...filtered]);
  saveLocalDeviceIotBookings(newLocal);

  // 2. Save to Cloud SQL PostgreSQL API
  try {
    await apiFetch('/api/device-iot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem),
    });
  } catch (err) {
    console.warn('Save device_iot to SQL notice:', err);
  }

  // 3. Mirror to Firestore
  if (!isQuotaExceededState()) {
    try {
      const docRef = doc(db, COLLECTION_DEVICE_IOTS, item.id);
      const sanitized = JSON.parse(
        JSON.stringify(updatedItem, (_key, val) => (val === undefined ? null : val))
      );
      await setDoc(docRef, {
        ...sanitized,
        cloudSyncedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_DEVICE_IOTS}/${item.id}`);
    }
  }
}

// 3. Delete single item from Cloud (PostgreSQL + Firestore)
export async function deleteDeviceIotFromCloud(id: string): Promise<void> {
  if (!id) return;

  // 1. Remove from local cache immediately
  const localCached = loadLocalDeviceIotBookings();
  const updated = localCached.filter((item) => item.id !== id);
  saveLocalDeviceIotBookings(updated);

  // 2. Delete from Cloud SQL PostgreSQL API
  try {
    await apiFetch(`/api/device-iot/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Delete device_iot from SQL notice:', err);
  }

  // 3. Delete from Firestore
  if (!isQuotaExceededState()) {
    try {
      const docRef = doc(db, COLLECTION_DEVICE_IOTS, id);
      await deleteDoc(docRef);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_DEVICE_IOTS}/${id}`);
    }
  }
}

// Clear all device & IoT bookings from Cloud & Local cache
export async function clearAllDeviceIotsFromCloud(): Promise<void> {
  // 1. Clear local cache
  saveLocalDeviceIotBookings([]);

  // 2. Clear from Cloud SQL
  try {
    await apiFetch('/api/device-iot/clear/all', {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Clear all device_iot from SQL notice:', err);
  }

  // 3. Clear from Firestore
  if (!isQuotaExceededState()) {
    try {
      const q = query(collection(db, COLLECTION_DEVICE_IOTS), limit(1000));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    } catch (err: any) {
      console.warn('Clear all device_iots from Firestore notice:', err);
    }
  }
}

// 3b. User requests deletion from Admin
export async function requestDeviceIotCancel(
  id: string,
  reason: string,
  requesterName: string
): Promise<void> {
  if (!id) return;
  const nowIso = new Date().toISOString();

  // Update in SQL
  try {
    const local = loadLocalDeviceIotBookings();
    const target = local.find((b) => b.id === id);
    if (target) {
      const updated = {
        ...target,
        cancelRequested: true,
        cancelReason: reason,
        cancelRequestedBy: requesterName,
        cancelRequestedAt: nowIso,
        updatedAt: nowIso,
      };
      await saveDeviceIotToCloud(updated);
      return;
    }
  } catch (e) {}

  if (!isQuotaExceededState()) {
    try {
      const docRef = doc(db, COLLECTION_DEVICE_IOTS, id);
      await setDoc(
        docRef,
        {
          cancelRequested: true,
          cancelReason: reason,
          cancelRequestedBy: requesterName,
          cancelRequestedAt: nowIso,
          updatedAt: nowIso,
          cloudSyncedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_DEVICE_IOTS}/${id}`);
    }
  }
}

// 3c. Admin rejects cancellation request
export async function rejectDeviceIotCancel(
  id: string,
  _ticketNumber?: string,
  _adminName?: string
): Promise<void> {
  if (!id) return;
  const nowIso = new Date().toISOString();

  try {
    const local = loadLocalDeviceIotBookings();
    const target = local.find((b) => b.id === id);
    if (target) {
      const updated = {
        ...target,
        cancelRequested: false,
        cancelReason: undefined,
        cancelRequestedBy: undefined,
        cancelRequestedAt: undefined,
        updatedAt: nowIso,
      };
      await saveDeviceIotToCloud(updated);
      return;
    }
  } catch (e) {}

  if (!isQuotaExceededState()) {
    try {
      const docRef = doc(db, COLLECTION_DEVICE_IOTS, id);
      await setDoc(
        docRef,
        {
          cancelRequested: false,
          cancelReason: null,
          cancelRequestedBy: null,
          cancelRequestedAt: null,
          updatedAt: nowIso,
          cloudSyncedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_DEVICE_IOTS}/${id}`);
    }
  }
}

// 4. Batch sync items to Cloud (PostgreSQL + Firestore)
export async function batchSyncDeviceIotsToCloud(items: DeviceIotBookingItem[]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;

  // 1. Update local cache immediately for instant UI responsiveness
  const local = loadLocalDeviceIotBookings();
  const merged = deduplicateDeviceIots([...items, ...local]);
  saveLocalDeviceIotBookings(merged);

  // 2. Run Cloud SQL and Firestore concurrently
  const sqlPromise = (async () => {
    try {
      await apiFetch('/api/device-iot/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
    } catch (err) {
      console.warn('Batch sync device_iot to SQL notice:', err);
    }
  })();

  const firestorePromise = (async () => {
    if (!isQuotaExceededState()) {
      try {
        const chunks: DeviceIotBookingItem[][] = [];
        for (let i = 0; i < items.length; i += 400) {
          chunks.push(items.slice(i, i + 400));
        }
        await Promise.all(
          chunks.map(async (chunk) => {
            const batch = writeBatch(db);
            for (const item of chunk) {
              if (!item.id) continue;
              const docRef = doc(db, COLLECTION_DEVICE_IOTS, item.id);
              const sanitized = JSON.parse(
                JSON.stringify(item, (_key, val) => (val === undefined ? null : val))
              );
              batch.set(docRef, {
                ...sanitized,
                updatedAt: item.updatedAt || new Date().toISOString(),
                cloudSyncedAt: serverTimestamp(),
              }, { merge: true });
            }
            await batch.commit();
          })
        );
      } catch (err: any) {
        console.warn('Batch sync device_iot to Firestore notice:', err);
      }
    }
  })();

  await Promise.allSettled([sqlPromise, firestorePromise]);
}

// 5. Pull latest items from Cloud (Dual: Cloud SQL PostgreSQL + Cloud Firestore)
export async function pullLatestDeviceIotsFromCloud(): Promise<DeviceIotBookingItem[]> {
  const cloudMap = new Map<string, DeviceIotBookingItem>();
  let hasRemoteData = false;

  // A. Query Cloud SQL PostgreSQL API
  try {
    const res = await apiFetch('/api/device-iot', { cache: 'no-store' });
    if (res.ok) {
      const sqlItems = await res.json();
      if (Array.isArray(sqlItems) && sqlItems.length > 0) {
        hasRemoteData = true;
        for (const item of sqlItems) {
          if (item && item.id) {
            cloudMap.set(item.id, item);
          }
        }
      }
    }
  } catch (sqlErr) {
    console.warn('Fetch device_iots from SQL API notice:', sqlErr);
  }

  // B. Query Cloud Firestore
  if (!isQuotaExceededState()) {
    try {
      const snap = await getDocs(collection(db, COLLECTION_DEVICE_IOTS));
      if (!snap.empty) {
        hasRemoteData = true;
        snap.forEach((docSnap) => {
          const fsItem = {
            id: docSnap.id,
            ...docSnap.data(),
          } as DeviceIotBookingItem;
          const existing = cloudMap.get(fsItem.id);
          if (!existing) {
            cloudMap.set(fsItem.id, fsItem);
          } else {
            cloudMap.set(fsItem.id, mergeTwoDeviceIotItems(existing, fsItem));
          }
        });
      }
    } catch (fsErr: any) {
      console.warn('Pull device_iots from Firestore notice:', fsErr);
    }
  }

  if (hasRemoteData && cloudMap.size > 0) {
    const allItems = Array.from(cloudMap.values());
    const cleanList = deduplicateDeviceIots(filterDeviceIots(allItems));
    saveLocalDeviceIotBookings(cleanList);
    try {
      localStorage.setItem('label_studio_device_iot_initialized', 'true');
    } catch (e) {}
    return cleanList;
  }

  // Fallback to local cache
  return deduplicateDeviceIots(filterDeviceIots(loadLocalDeviceIotBookings()));
}

export interface WarrantyCenter {
  id: string;
  name: string;
  phone: string;
}

export const DEFAULT_WARRANTY_CENTERS: WarrantyCenter[] = [
  { id: 'default-oppo', name: 'Trung tâm bảo hành OPPO (TTBH)', phone: '028.38551234' },
];

const COLLECTION_WARRANTY_CENTERS = 'warranty_centers';

export async function fetchWarrantyCenters(): Promise<WarrantyCenter[]> {
  try {
    let localList: WarrantyCenter[] = [];
    try {
      const raw = localStorage.getItem('oppo_warranty_centers_v1');
      if (raw) localList = JSON.parse(raw);
    } catch (e) {}

    if (isQuotaExceededState()) {
      return localList.length > 0 ? localList : DEFAULT_WARRANTY_CENTERS;
    }

    const snap = await getDocs(collection(db, COLLECTION_WARRANTY_CENTERS));
    const list: WarrantyCenter[] = [];
    snap.forEach((docSnap) => {
      list.push({
        id: docSnap.id,
        ...docSnap.data()
      } as WarrantyCenter);
    });

    if (list.length > 0) {
      try {
        localStorage.setItem('oppo_warranty_centers_v1', JSON.stringify(list));
      } catch (e) {}
      return list;
    }

    return localList.length > 0 ? localList : DEFAULT_WARRANTY_CENTERS;
  } catch (err) {
    console.warn('Error fetching warranty centers:', err);
    try {
      const raw = localStorage.getItem('oppo_warranty_centers_v1');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_WARRANTY_CENTERS;
  }
}

export async function saveWarrantyCenter(center: WarrantyCenter): Promise<void> {
  try {
    if (!isQuotaExceededState()) {
      await setDoc(doc(db, COLLECTION_WARRANTY_CENTERS, center.id), {
        name: center.name,
        phone: center.phone,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_WARRANTY_CENTERS}/${center.id}`);
  } finally {
    try {
      const current = await fetchWarrantyCenters();
      const filtered = current.filter(c => c.id !== center.id);
      filtered.push(center);
      localStorage.setItem('oppo_warranty_centers_v1', JSON.stringify(filtered));
    } catch (e) {}
  }
}

export async function deleteWarrantyCenter(id: string): Promise<void> {
  try {
    if (!isQuotaExceededState()) {
      await deleteDoc(doc(db, COLLECTION_WARRANTY_CENTERS, id));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_WARRANTY_CENTERS}/${id}`);
  } finally {
    try {
      const current = await fetchWarrantyCenters();
      const filtered = current.filter(c => c.id !== id);
      localStorage.setItem('oppo_warranty_centers_v1', JSON.stringify(filtered));
    } catch (e) {}
  }
}

export {
  loadLocalDeviceIotBookings,
  saveLocalDeviceIotBookings,
};



