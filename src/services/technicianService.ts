import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, isQuotaExceededState, setQuotaExceededState } from '../lib/firebase';
import { TechnicianItem, DEFAULT_INITIAL_TECHNICIANS } from '../types/technician';
import { apiFetch } from './firebaseShortageService';
import bundledDb from '../data/bundledDatabase.json';

const COLLECTION_TECHNICIANS = 'technicians';
const STORAGE_KEY_TECHNICIANS = 'app_technicians_v1';
const STORAGE_KEY_DELETED_TECHNICIANS = 'app_technicians_deleted_ids_v1';

// In-memory cache for ultra-responsive updates
let localTechniciansCache: TechnicianItem[] = [];

// Subscribers listener pool for immediate reactivity
const subscribers = new Set<(techs: TechnicianItem[]) => void>();

function notifySubscribers(list: TechnicianItem[]) {
  subscribers.forEach((cb) => {
    try {
      cb(list);
    } catch (e) {
      // ignore
    }
  });
}

// Get deleted IDs
function getDeletedTechnicianIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_TECHNICIANS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    // ignore
  }
  return new Set();
}

// Mark ID or techId as deleted
function markTechnicianDeleted(idOrTechId: string) {
  try {
    const deleted = getDeletedTechnicianIds();
    deleted.add(idOrTechId);
    localStorage.setItem(STORAGE_KEY_DELETED_TECHNICIANS, JSON.stringify(Array.from(deleted)));
  } catch (e) {
    // ignore
  }
}

// Unmark ID or techId as deleted (when re-created or updated)
function unmarkTechnicianDeleted(idOrTechId: string) {
  try {
    const deleted = getDeletedTechnicianIds();
    let changed = false;
    if (deleted.has(idOrTechId)) {
      deleted.delete(idOrTechId);
      changed = true;
    }
    const techKey = `techId_${idOrTechId.trim().toUpperCase()}`;
    if (deleted.has(techKey)) {
      deleted.delete(techKey);
      changed = true;
    }
    if (changed) {
      localStorage.setItem(STORAGE_KEY_DELETED_TECHNICIANS, JSON.stringify(Array.from(deleted)));
    }
  } catch (e) {
    // ignore
  }
}

// Helper to check and filter out legacy mock default technicians
export function isMockTechnician(item: { id?: string; techId?: string; phone?: string; name?: string }): boolean {
  if (!item) return false;
  const cleanId = (item.id || '').toLowerCase().trim();
  const cleanTechId = (item.techId || '').toUpperCase().trim();
  const name = ((item as any).name || '').toLowerCase().trim();
  const phone = (item.phone || '').trim();

  // Only remove legacy mock templates that had placeholder dummy names or dummy IDs
  if (
    cleanId === 'tech-ktv01' ||
    cleanId === 'tech-ktv02' ||
    cleanId === 'tech-ktv03' ||
    cleanId === 'tech-admin'
  ) {
    return true;
  }
  if (name === 'kỹ thuật viên mẫu' || name === 'ktv test' || name === 'admin mẫu') {
    return true;
  }
  if (
    (cleanTechId === 'ADMIN' && phone === '0901234999' && (name.includes('mẫu') || name.includes('test')))
  ) {
    return true;
  }
  return false;
}

// Deduplicate and filter out mock technicians with 2-pass merge (by ID & by techId)
export function deduplicateTechnicians(items: TechnicianItem[]): TechnicianItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  // Pass 1: Deduplicate by exact item ID
  const idMap = new Map<string, TechnicianItem>();

  for (const item of items) {
    if (!item || isMockTechnician(item)) continue;
    const cleanId = (item.id || (item.techId ? `tech_${item.techId}` : '')).trim();
    if (!cleanId) continue;

    const existing = idMap.get(cleanId);
    if (!existing) {
      idMap.set(cleanId, { ...item, id: cleanId });
    } else {
      const t1 = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const t2 = new Date(item.updatedAt || item.createdAt || 0).getTime();
      idMap.set(cleanId, t2 >= t1 ? { ...existing, ...item } : { ...item, ...existing });
    }
  }

  // Pass 2: Deduplicate by clean techId (Mã KTV) if techId is specified
  const techIdMap = new Map<string, TechnicianItem>();

  for (const item of idMap.values()) {
    const cleanTechId = (item.techId || '').trim().toUpperCase();
    if (!cleanTechId) {
      techIdMap.set(item.id, item);
      continue;
    }

    const existing = techIdMap.get(cleanTechId);
    if (!existing) {
      techIdMap.set(cleanTechId, item);
    } else {
      // Preference logic: prefer active status over pending/rejected, or newest updatedAt
      const t1 = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const t2 = new Date(item.updatedAt || item.createdAt || 0).getTime();

      let winner = existing;
      if (item.status === 'active' && existing.status !== 'active') {
        winner = item;
      } else if (existing.status === 'active' && item.status !== 'active') {
        winner = existing;
      } else if (t2 >= t1) {
        winner = item;
      }

      techIdMap.set(cleanTechId, { ...existing, ...winner });
    }
  }

  const list = Array.from(techIdMap.values());
  list.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return (a.techId || '').localeCompare(b.techId || '');
  });

  return list;
}

export function getCachedTechnicians(): TechnicianItem[] {
  let cached: TechnicianItem[] = [];
  if (localTechniciansCache.length > 0) {
    cached = localTechniciansCache;
  } else {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TECHNICIANS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cached = parsed;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (cached.length === 0 && bundledDb && Array.isArray(bundledDb.technicians) && bundledDb.technicians.length > 0) {
    cached = bundledDb.technicians as unknown as TechnicianItem[];
  }

  const clean = deduplicateTechnicians(cached);
  localTechniciansCache = clean;
  return clean;
}

function saveLocalCache(list: TechnicianItem[]) {
  const clean = deduplicateTechnicians(list);
  localTechniciansCache = clean;
  try {
    localStorage.setItem(STORAGE_KEY_TECHNICIANS, JSON.stringify(clean));
  } catch (e) {
    // ignore
  }
  notifySubscribers(clean);
}

// Fetch Cloud Technicians from Firestore and PostgreSQL API (Dual merge)
export async function fetchTechniciansFromCloud(): Promise<TechnicianItem[]> {
  const local = getCachedTechnicians();
  const cloudItemsMap = new Map<string, TechnicianItem>();
  let hasRemoteSuccess = false;

  // 1. Fetch from Firestore COLLECTION_TECHNICIANS
  if (!isQuotaExceededState()) {
    try {
      const snap = await getDocs(collection(db, COLLECTION_TECHNICIANS));
      if (!snap.empty) {
        hasRemoteSuccess = true;
        snap.forEach((d) => {
          const data = d.data() as any;
          if (!isMockTechnician({ id: d.id, ...data })) {
            const item: TechnicianItem = { id: d.id, ...data };
            const key = (item.techId || item.id).trim().toUpperCase();
            if (key) cloudItemsMap.set(key, item);
          }
        });
      }
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
      console.warn('Firestore fetch technicians notice:', e);
    }
  }

  // 2. Fetch from Express / Cloud SQL API
  try {
    const res = await apiFetch('/api/technicians', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        hasRemoteSuccess = true;
        data.forEach((item: any) => {
          if (!isMockTechnician(item)) {
            const key = (item.techId || item.id || '').trim().toUpperCase();
            if (key) {
              const existing = cloudItemsMap.get(key);
              if (!existing) {
                cloudItemsMap.set(key, item);
              } else {
                const t1 = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                const t2 = new Date(item.updatedAt || item.createdAt || 0).getTime();
                cloudItemsMap.set(key, t2 >= t1 ? { ...existing, ...item } : { ...item, ...existing });
              }
            }
          }
        });
      }
    }
  } catch (e) {
    // ignore
  }

  const cloudItems = Array.from(cloudItemsMap.values());

  // 3. Cloud items are authoritative when remote query succeeded
  if (cloudItems.length > 0) {
    const cleanCloud = deduplicateTechnicians(cloudItems);
    saveLocalCache(cleanCloud);
    return cleanCloud;
  }

  // If remote was queried and empty, return local if exists
  return local;
}

export async function fetchTechniciansFromApi(): Promise<TechnicianItem[]> {
  return fetchTechniciansFromCloud();
}

// Real-time synchronization (Immediate SQL + Firestore real-time)
export function subscribeToTechnicians(
  onUpdate: (techs: TechnicianItem[]) => void
): () => void {
  subscribers.add(onUpdate);

  // 1. Immediately emit cached data
  const initial = getCachedTechnicians();
  onUpdate(initial);

  // 2. Immediate fetch from Cloud (SQL + Firestore) for new devices with empty cache
  fetchTechniciansFromCloud().then((items) => {
    if (Array.isArray(items) && items.length > 0) {
      onUpdate(items);
    }
  }).catch(() => {});

  let unsubFirestore: (() => void) | null = null;

  // 3. Listen to Firestore real-time changes
  if (!isQuotaExceededState()) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, COLLECTION_TECHNICIANS),
        (snap) => {
          const list: TechnicianItem[] = [];
          snap.forEach((d) => {
            const data = d.data() as any;
            if (!isMockTechnician({ id: d.id, ...data })) {
              list.push({ id: d.id, ...data });
            }
          });

          if (list.length > 0) {
            const clean = deduplicateTechnicians(list);
            saveLocalCache(clean);
          } else if (snap.empty) {
            // Do not wipe local cache; instead fetch from SQL API
            fetchTechniciansFromCloud().catch(() => {});
          }
        },
        (error) => {
          if (error?.code === 'resource-exhausted' || error?.message?.toLowerCase().includes('quota')) {
            setQuotaExceededState(true);
            if (unsubFirestore) unsubFirestore();
          } else {
            console.warn('Firestore technician listener note:', error?.message);
          }
          fetchTechniciansFromCloud().catch(() => {});
        }
      );
    } catch (e) {
      console.warn('Firestore technician subscribe fallback:', e);
    }
  }

  // 4. Periodic cloud sync every 5s for multi-machine real-time parity
  const interval = setInterval(async () => {
    try {
      const items = await fetchTechniciansFromCloud();
      if (Array.isArray(items) && items.length > 0) {
        notifySubscribers(items);
      }
    } catch (e) {
      // ignore
    }
  }, 5000);

  return () => {
    subscribers.delete(onUpdate);
    if (unsubFirestore) unsubFirestore();
    clearInterval(interval);
  };
}

// Disabled auto-seeding mock technicians to Firestore
async function seedInitialTechniciansToFirestore() {
  return;
}

// User / Staff sends a request to add a new technician (status: pending)
export async function requestNewTechnician(params: {
  techId: string;
  name: string;
  phone?: string;
  department?: string;
  note?: string;
  requestedBy: string;
}): Promise<TechnicianItem> {
  const now = new Date().toISOString();
  const cleanTechId = params.techId.trim().toUpperCase();
  const cleanName = params.name.trim();
  const id = `tech_${cleanTechId.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;

  unmarkTechnicianDeleted(id);
  unmarkTechnicianDeleted(cleanTechId);

  const newTech: TechnicianItem = {
    id,
    techId: cleanTechId,
    name: cleanName,
    phone: params.phone?.trim() || '',
    department: params.department?.trim() || 'Kỹ thuật',
    status: 'pending', // Chờ Admin duyệt
    requestedBy: params.requestedBy,
    requestedAt: now,
    note: params.note?.trim() || '',
    createdAt: now,
    updatedAt: now,
  };

  // Update local cache and notify subscribers instantly
  const current = getCachedTechnicians();
  const updated = deduplicateTechnicians([newTech, ...current]);
  saveLocalCache(updated);

  // Sync to Firestore
  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_TECHNICIANS, id), newTech);
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
      console.warn('Firestore set technician note:', e);
    }
  }

  // Sync to backend API
  try {
    await apiFetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTech),
    });
  } catch (e) {
    // ignore
  }

  return newTech;
}

// Admin directly creates a technician (status: active immediately)
export async function adminCreateTechnician(params: {
  techId: string;
  name: string;
  phone?: string;
  department?: string;
  note?: string;
  approvedBy: string;
}): Promise<TechnicianItem> {
  const now = new Date().toISOString();
  const cleanTechId = params.techId.trim().toUpperCase();
  const cleanName = params.name.trim();
  const id = `tech_${cleanTechId.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;

  unmarkTechnicianDeleted(id);
  unmarkTechnicianDeleted(cleanTechId);

  const newTech: TechnicianItem = {
    id,
    techId: cleanTechId,
    name: cleanName,
    phone: params.phone?.trim() || '',
    department: params.department?.trim() || 'Kỹ thuật',
    status: 'active', // Admin tạo trực tiếp
    approvedBy: params.approvedBy,
    approvedAt: now,
    note: params.note?.trim() || '',
    createdAt: now,
    updatedAt: now,
  };

  // Update local cache and notify subscribers instantly
  const current = getCachedTechnicians();
  const updated = deduplicateTechnicians([newTech, ...current]);
  saveLocalCache(updated);

  // Sync to Firestore
  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_TECHNICIANS, id), newTech);
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
      console.warn('Firestore adminCreateTechnician note:', e);
    }
  }

  // Sync to API
  try {
    await apiFetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTech),
    });
  } catch (e) {
    // ignore
  }

  return newTech;
}

// Admin updates technician details
export async function adminUpdateTechnician(
  id: string,
  updates: Partial<TechnicianItem>
): Promise<void> {
  unmarkTechnicianDeleted(id);
  if (updates.techId) unmarkTechnicianDeleted(updates.techId);

  const now = new Date().toISOString();
  const current = getCachedTechnicians();
  const updated = current.map((t) => {
    if (t.id === id || (t.techId && updates.techId && t.techId.toUpperCase() === updates.techId.toUpperCase())) {
      return { ...t, ...updates, updatedAt: now };
    }
    return t;
  });
  saveLocalCache(updated);

  const payload = { ...updates, updatedAt: now };

  if (!isQuotaExceededState()) {
    try {
      await setDoc(doc(db, COLLECTION_TECHNICIANS, id), payload, { merge: true });
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
      console.warn('Firestore adminUpdateTechnician note:', e);
    }
  }

  try {
    await apiFetch(`/api/technicians/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // ignore
  }
}

// Admin approves a pending technician
export async function adminApproveTechnician(
  id: string,
  adminName: string
): Promise<void> {
  const now = new Date().toISOString();
  await adminUpdateTechnician(id, {
    status: 'active',
    approvedBy: adminName,
    approvedAt: now,
  });
}

// Admin rejects a pending technician
export async function adminRejectTechnician(
  id: string,
  adminName: string
): Promise<void> {
  const now = new Date().toISOString();
  await adminUpdateTechnician(id, {
    status: 'rejected',
    approvedBy: adminName,
    approvedAt: now,
  });
}

// Admin permanently deletes a technician
export async function adminDeleteTechnician(id: string): Promise<void> {
  const current = getCachedTechnicians();
  const target = current.find((t) => t.id === id || t.techId === id);

  if (target) {
    markTechnicianDeleted(target.id);
    if (target.techId) {
      markTechnicianDeleted(`techId_${target.techId.trim().toUpperCase()}`);
    }
  } else {
    markTechnicianDeleted(id);
  }

  const updated = current.filter((t) => t.id !== id && t.techId !== id);
  saveLocalCache(updated);

  if (!isQuotaExceededState()) {
    try {
      await deleteDoc(doc(db, COLLECTION_TECHNICIANS, id));
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('quota') || e?.code === 'resource-exhausted') {
        setQuotaExceededState(true);
      }
      console.warn('Firestore adminDeleteTechnician note:', e);
    }
  }

  try {
    await apiFetch(`/api/technicians/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (e) {
    // ignore
  }
}

// Batch import technicians from Excel data
export async function batchImportTechnicians(
  items: Array<{
    techId: string;
    name: string;
    department?: string;
    phone?: string;
    note?: string;
    status?: 'active' | 'pending';
  }>
): Promise<{ successCount: number }> {
  let successCount = 0;

  for (const item of items) {
    if (!item.techId || !item.name) continue;
    const cleanTechId = item.techId.trim().toUpperCase();
    const cleanName = item.name.trim();
    if (!cleanTechId || !cleanName) continue;

    unmarkTechnicianDeleted(cleanTechId);
    unmarkTechnicianDeleted(`tech_${cleanTechId.toLowerCase()}`);

    const docId = `tech_${cleanTechId.toLowerCase()}`;
    const now = new Date().toISOString();

    const techObj: TechnicianItem = {
      id: docId,
      techId: cleanTechId,
      name: cleanName,
      department: (item.department || 'Kỹ thuật / CS').trim(),
      phone: (item.phone || '').trim(),
      note: (item.note || 'Nhập từ Excel').trim(),
      status: item.status || 'active',
      createdAt: now,
      updatedAt: now,
    };

    try {
      if (!isQuotaExceededState()) {
        await setDoc(doc(db, COLLECTION_TECHNICIANS, docId), techObj, { merge: true });
      }
      successCount++;
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
      console.warn('batchImportTechnicians error:', e);
    }

    try {
      await apiFetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(techObj),
      });
    } catch (e) {
      // ignore
    }
  }

  await fetchTechniciansFromCloud();
  return { successCount };
}


