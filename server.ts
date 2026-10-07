import './src/consoleStub';
import express from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, setLogLevel, doc, setDoc, deleteDoc, writeBatch, collection, getDocs } from 'firebase/firestore';

try {
  setLogLevel('silent');
} catch (e) {
  // ignore
}
import { db } from './src/db/index';
import { shortageBookings, labelCatalog, activityLogs, appStats, technicians, deviceIotBookings } from './src/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// Initialize Cloud Firestore Bridge on Server
let firestoreDb: any = null;
try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const rawCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    const fbApp = getApps().length > 0 ? getApp() : initializeApp(rawCfg);
    firestoreDb = getFirestore(fbApp, rawCfg.firestoreDatabaseId);
    console.log('Server successfully connected to Cloud Firestore bridge.');
  }
} catch (e) {
  console.warn('Server firestore bridge init notice:', e);
}

function sanitizeForFirestore(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (value === undefined ? null : value))
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // CORS middleware for desktop packaged apps (Electron / AppImage / Win) and cross-origin clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  const SERVER_BOOT_TIME = 1755670000000; // Fixed stable timestamp
  const CURRENT_APP_VERSION = '2.5.3';
  const CURRENT_BUILD_ID = 'build-v253-part-autosuggest-sync';

  // API Routes for Cloud SQL PostgreSQL
  
  // 1. Health check & Version check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', provider: 'Cloud SQL PostgreSQL', version: CURRENT_APP_VERSION, buildId: CURRENT_BUILD_ID });
  });

  app.get('/install-linux-icon.sh', (req, res) => {
    const publicScript = path.join(process.cwd(), 'public/install-linux-icon.sh');
    const rootScript = path.join(process.cwd(), 'install-linux-icon.sh');
    const scriptPath = fs.existsSync(publicScript) ? publicScript : rootScript;
    if (fs.existsSync(scriptPath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.sendFile(scriptPath);
    } else {
      res.status(404).send('#!/bin/bash\necho "Error: install-linux-icon.sh not found"\nexit 1\n');
    }
  });

  app.get('/api/version', (req, res) => {
    res.json({
      version: CURRENT_APP_VERSION,
      buildId: CURRENT_BUILD_ID,
      buildDate: '2026-08-20',
      timestamp: SERVER_BOOT_TIME,
      appName: 'OPPO Label Studio & Shortage Hub',
      cloudSync: true,
      features: ['Live Cloud Sync', 'OTA Auto-update', 'Cloud SQL PostgreSQL', 'GCSM Stock Checker']
    });
  });

  // 2. Shortages API
  app.get('/api/shortages', async (req, res) => {
    try {
      const items = await db.select().from(shortageBookings).orderBy(desc(shortageBookings.updatedAt));
      return res.json(items);
    } catch (error) {
      console.error('Error fetching shortages from SQL:', error);
      if (firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'shortages'));
          if (!snap.empty) {
            const fallbackItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            return res.json(fallbackItems);
          }
        } catch (fsErr) {
          console.warn('Fallback fetch shortages from Firestore notice:', fsErr);
        }
      }
      return res.json([]);
    }
  });

  app.post('/api/shortages', async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id) {
        return res.status(400).json({ error: 'Missing shortage item ID' });
      }

      await db.insert(shortageBookings)
        .values({
          id: item.id,
          ticketNumber: item.ticketNumber || '',
          partCode: item.partCode || '',
          partName: item.partName || '',
          model: item.model || '',
          partsList: item.partsList || [],
          bookingDate: item.bookingDate || '',
          requestedDate: item.requestedDate || null,
          customerName: item.customerName || '',
          customerPhone: item.customerPhone || '',
          status: item.status || 'da_tao_phieu',
          location: item.location || '',
          stockedInDate: item.stockedInDate || null,
          calledCustomerDate: item.calledCustomerDate || null,
          callSubStatus: item.callSubStatus || null,
          appointmentDate: item.appointmentDate || null,
          callNote: item.callNote || null,
          callLogs: item.callLogs || [],
          customerArrivedDate: item.customerArrivedDate || null,
          technicianName: item.technicianName || '',
          note: item.note || '',
          cancelRequested: Boolean(item.cancelRequested),
          cancelReason: item.cancelReason || null,
          cancelRequestedBy: item.cancelRequestedBy || null,
          cancelRequestedAt: item.cancelRequestedAt || null,
          customerKeepsPart: Boolean(item.customerKeepsPart),
          isCustomerCallHold: Boolean(item.isCustomerCallHold),
          isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
          closureReason: item.closureReason || null,
          closureNote: item.closureNote || null,
          closureBy: item.closureBy || null,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
          history: item.history || [],
          createdBy: item.createdBy || null,
          createdByUid: item.createdByUid || null,
          creatorTechnician: item.creatorTechnician || null,
        })
        .onConflictDoUpdate({
          target: shortageBookings.id,
          set: {
            ticketNumber: item.ticketNumber || '',
            partCode: item.partCode || '',
            partName: item.partName || '',
            model: item.model || '',
            partsList: item.partsList || [],
            bookingDate: item.bookingDate || '',
            requestedDate: item.requestedDate || null,
            customerName: item.customerName || '',
            customerPhone: item.customerPhone || '',
            status: item.status || 'da_tao_phieu',
            location: item.location || '',
            stockedInDate: item.stockedInDate || null,
            calledCustomerDate: item.calledCustomerDate || null,
            callSubStatus: item.callSubStatus || null,
            appointmentDate: item.appointmentDate || null,
            callNote: item.callNote || null,
            callLogs: item.callLogs || [],
            customerArrivedDate: item.customerArrivedDate || null,
            technicianName: item.technicianName || '',
            note: item.note || '',
            cancelRequested: Boolean(item.cancelRequested),
            cancelReason: item.cancelReason || null,
            cancelRequestedBy: item.cancelRequestedBy || null,
            cancelRequestedAt: item.cancelRequestedAt || null,
            customerKeepsPart: Boolean(item.customerKeepsPart),
            isCustomerCallHold: Boolean(item.isCustomerCallHold),
            isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
            closureReason: item.closureReason || null,
            closureNote: item.closureNote || null,
            closureBy: item.closureBy || null,
            updatedAt: item.updatedAt || new Date().toISOString(),
            history: item.history || [],
            createdBy: item.createdBy || null,
            createdByUid: item.createdByUid || null,
            creatorTechnician: item.creatorTechnician || null,
          },
        });

      res.json({ success: true, item });

      // Parallel sync to Cloud Firestore
      if (firestoreDb) {
        try {
          const cleanItem = sanitizeForFirestore(item);
          await setDoc(doc(firestoreDb, 'shortages', item.id), cleanItem, { merge: true });
          setDoc(doc(firestoreDb, 'system_shortages', 'master_signal'), {
            updatedAt: new Date().toISOString(),
            updatedBy: 'Server API Sync',
            count: 1,
            version: Date.now(),
          }, { merge: true }).catch(() => {});
          setDoc(doc(firestoreDb, 'system_signals', 'shortages_sync'), {
            lastUpdated: new Date().toISOString(),
            updatedBy: 'Server API Sync',
          }, { merge: true }).catch(() => {});
        } catch (fe) {
          console.warn('Server sync to Firestore notice:', fe);
        }
      }
    } catch (error) {
      console.error('Error saving shortage to SQL:', error);
      res.status(500).json({ error: 'Failed to save shortage' });
    }
  });

  // Clear all shortages
  app.delete('/api/shortages/clear/all', async (req, res) => {
    try {
      await db.delete(shortageBookings);
      res.json({ success: true, message: 'Cleared all shortages' });

      if (firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'shortages'));
          const batchPromises = snap.docs.map((d) => deleteDoc(d.ref));
          await Promise.all(batchPromises);

          setDoc(doc(firestoreDb, 'system_shortages', 'master_signal'), {
            updatedAt: new Date().toISOString(),
            updatedBy: 'Server API Clear All',
            count: 0,
            version: Date.now(),
          }, { merge: true }).catch(() => {});
        } catch (fe) {
          console.warn('Server clear all Firestore notice:', fe);
        }
      }
    } catch (error) {
      console.error('Error clearing all shortages from SQL:', error);
      res.status(500).json({ error: 'Failed to clear shortages' });
    }
  });

  app.delete('/api/shortages/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(shortageBookings).where(eq(shortageBookings.id, id));
      res.json({ success: true, id });

      // Parallel sync deletion to Cloud Firestore
      if (firestoreDb) {
        try {
          await deleteDoc(doc(firestoreDb, 'shortages', id));
          setDoc(doc(firestoreDb, 'system_shortages', 'master_signal'), {
            updatedAt: new Date().toISOString(),
            updatedBy: 'Server API Delete',
            count: 1,
            version: Date.now(),
          }, { merge: true }).catch(() => {});
          setDoc(doc(firestoreDb, 'system_signals', 'shortages_sync'), {
            lastUpdated: new Date().toISOString(),
            updatedBy: 'Server API Delete',
          }, { merge: true }).catch(() => {});
        } catch (fe) {
          console.warn('Server delete from Firestore notice:', fe);
        }
      }
    } catch (error) {
      console.error('Error deleting shortage from SQL:', error);
      res.status(500).json({ error: 'Failed to delete shortage' });
    }
  });

  // Bulk sync shortages
  app.post('/api/shortages/bulk', async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items must be an array' });
      }

      const CHUNK_SIZE = 50;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (item) => {
            if (!item || !item.id) return;
            await db.insert(shortageBookings)
              .values({
                id: item.id,
                ticketNumber: item.ticketNumber || '',
                partCode: item.partCode || '',
                partName: item.partName || '',
                model: item.model || '',
                partsList: item.partsList || [],
                bookingDate: item.bookingDate || '',
                requestedDate: item.requestedDate || null,
                customerName: item.customerName || '',
                customerPhone: item.customerPhone || '',
                status: item.status || 'da_tao_phieu',
                location: item.location || '',
                stockedInDate: item.stockedInDate || null,
                calledCustomerDate: item.calledCustomerDate || null,
                callSubStatus: item.callSubStatus || null,
                appointmentDate: item.appointmentDate || null,
                callNote: item.callNote || null,
                callLogs: item.callLogs || [],
                customerArrivedDate: item.customerArrivedDate || null,
                technicianName: item.technicianName || '',
                note: item.note || '',
                cancelRequested: Boolean(item.cancelRequested),
                cancelReason: item.cancelReason || null,
                cancelRequestedBy: item.cancelRequestedBy || null,
                cancelRequestedAt: item.cancelRequestedAt || null,
                customerKeepsPart: Boolean(item.customerKeepsPart),
                isCustomerCallHold: Boolean(item.isCustomerCallHold),
                isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
                closureReason: item.closureReason || null,
                closureNote: item.closureNote || null,
                closureBy: item.closureBy || null,
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: item.updatedAt || new Date().toISOString(),
                history: item.history || [],
                createdBy: item.createdBy || null,
                createdByUid: item.createdByUid || null,
                creatorTechnician: item.creatorTechnician || null,
              })
              .onConflictDoUpdate({
                target: shortageBookings.id,
                set: {
                  ticketNumber: item.ticketNumber || '',
                  partCode: item.partCode || '',
                  partName: item.partName || '',
                  model: item.model || '',
                  partsList: item.partsList || [],
                  bookingDate: item.bookingDate || '',
                  requestedDate: item.requestedDate || null,
                  customerName: item.customerName || '',
                  customerPhone: item.customerPhone || '',
                  status: item.status || 'da_tao_phieu',
                  location: item.location || '',
                  stockedInDate: item.stockedInDate || null,
                  calledCustomerDate: item.calledCustomerDate || null,
                  callSubStatus: item.callSubStatus || null,
                  appointmentDate: item.appointmentDate || null,
                  callNote: item.callNote || null,
                  callLogs: item.callLogs || [],
                  customerArrivedDate: item.customerArrivedDate || null,
                  technicianName: item.technicianName || '',
                  note: item.note || '',
                  cancelRequested: Boolean(item.cancelRequested),
                  cancelReason: item.cancelReason || null,
                  cancelRequestedBy: item.cancelRequestedBy || null,
                  cancelRequestedAt: item.cancelRequestedAt || null,
                  customerKeepsPart: Boolean(item.customerKeepsPart),
                  isCustomerCallHold: Boolean(item.isCustomerCallHold),
                  isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
                  closureReason: item.closureReason || null,
                  closureNote: item.closureNote || null,
                  closureBy: item.closureBy || null,
                  updatedAt: item.updatedAt || new Date().toISOString(),
                  history: item.history || [],
                  createdBy: item.createdBy || null,
                  createdByUid: item.createdByUid || null,
                  creatorTechnician: item.creatorTechnician || null,
                },
              });
          })
        );
      }

      res.json({ success: true, count: items.length });

      // Parallel bulk sync to Cloud Firestore
      if (firestoreDb) {
        try {
          const batch = writeBatch(firestoreDb);
          let count = 0;
          for (const item of items) {
            if (item && item.id && count < 400) {
              batch.set(doc(firestoreDb, 'shortages', item.id), sanitizeForFirestore(item), { merge: true });
              count++;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
          setDoc(doc(firestoreDb, 'system_shortages', 'master_signal'), {
            updatedAt: new Date().toISOString(),
            updatedBy: 'Server Bulk Sync',
            count: items.length,
            version: Date.now(),
          }, { merge: true }).catch(() => {});
          setDoc(doc(firestoreDb, 'system_signals', 'shortages_sync'), {
            lastUpdated: new Date().toISOString(),
            updatedBy: 'Server Bulk Sync',
          }, { merge: true }).catch(() => {});
        } catch (fe) {
          console.warn('Server bulk sync to Firestore notice:', fe);
        }
      }
    } catch (error) {
      console.error('Error bulk saving shortages to SQL:', error);
      res.status(500).json({ error: 'Failed to bulk save shortages' });
    }
  });

function fetchUrlContent(targetUrl: string, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects when fetching URL'));
    }

    try {
      const parsedUrl = new URL(targetUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const req = protocol.get(
        targetUrl,
        {
          maxHeaderSize: 512 * 1024, // 512 KB header size limit to prevent HeadersOverflowError
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/csv;q=0.8,*/*;q=0.7',
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            return fetchUrlContent(redirectUrl, maxRedirects - 1)
              .then(resolve)
              .catch(reject);
          }

          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
            return reject(new Error(`HTTP status code ${res.statusCode}`));
          }

          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        }
      );

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(25000, () => {
        req.destroy();
        reject(new Error('Request timeout after 25s'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

  // 3. Label Catalog API
  app.get('/api/sync-share-link', async (req, res) => {
    try {
      const targetUrl = (req.query.url as string) || 'https://gemini.google.com/share/ed3e5875fe9e';

      let text = '';
      try {
        text = await fetchUrlContent(targetUrl);
      } catch (err: any) {
        console.warn('fetchUrlContent warning, fallback to manual parse mode:', err?.message);
        return res.json({
          success: false,
          url: targetUrl,
          totalParsed: 0,
          parsedItems: [],
          message: err?.message || 'Could not fetch link content directly',
        });
      }

      const parsedItems: any[] = [];
      const seenCodes = new Set<string>();

      // Check if response is Google SPA / Canvas HTML which doesn't contain rendered DOM
      const isGoogleClientApp = text.includes('gemini.google.com') || text.includes('var(--gem-sys');

      let searchableText = text
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/var\(--[\w-]+\)/gi, '')
        .replace(/--[\w-]{5,}/gi, '');

      if (searchableText.includes('<table') || searchableText.includes('</td>') || searchableText.includes('</tr>')) {
        searchableText = searchableText
          .replace(/<\/tr>/gi, '\n')
          .replace(/<\/td>/gi, '\t')
          .replace(/<\/th>/gi, '\t')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, ' ');
      }

      const lines = searchableText.split('\n');

      lines.forEach((line, index) => {
        const clean = line.trim();
        if (!clean || clean.startsWith('--') || clean.includes('{') || clean.includes('var(')) return;
        if (clean.toLowerCase().includes('mã sp') || clean.toLowerCase().includes('tên linh kiện') || clean.includes('---')) return;

        let rawCode = '';
        let model = '';
        let name = '';
        let category = 'OTHERS';
        let location = '-';

        if (clean.includes('|')) {
          const parts = clean.split('|').map((p) => p.trim()).filter((p, i, arr) => (i > 0 && i < arr.length - 1) || p.length > 0);
          if (parts.length >= 2) {
            rawCode = parts[0] || '';
            if (parts.length >= 3) {
              name = parts[1] || '';
              model = parts[2] || '';
              category = parts[3] || 'OTHERS';
              location = parts[4] || '-';
            } else {
              name = parts[1] || '';
            }
          }
        } else if (clean.includes(',') || clean.includes('\t')) {
          const delimiter = clean.includes('\t') ? '\t' : ',';
          const parts = clean.split(delimiter).map((p) => p.trim().replace(/^"|"$/g, ''));
          if (parts.length >= 2) {
            rawCode = parts[0] || '';
            name = parts[1] || '';
            model = parts[2] || parts[1] || '';
            if (parts.length >= 4) category = parts[3];
            if (parts.length >= 5) location = parts[4];
          }
        } else {
          const match = clean.match(/^([A-Z0-9\-_]{4,18})\s+(.+)/i);
          if (match) {
            rawCode = match[1];
            name = match[2];
          }
        }

        // Clean out Info / Check tồn buttons
        rawCode = rawCode.replace(/\b(info|check\s*tồn|check|tồn|copy)\b/gi, '').trim();
        const codeMatch = rawCode.match(/([0-9]{6,14}|[A-Z0-9\-_]{4,18})/i);
        const code = codeMatch ? codeMatch[1].toUpperCase().replace(/[^A-Z0-9\-_]/g, '') : '';

        // Strict validation: must not be CSS junk
        const isJunk = !code ||
          code.length < 3 ||
          code.length > 20 ||
          code.startsWith('-') ||
          code.includes('--') ||
          code.includes('GEM') ||
          code.includes('TYPO') ||
          code.includes('FONT') ||
          code.includes('COLOR') ||
          code.includes('CONTAINER');

        if (!isJunk && !seenCodes.has(code)) {
          seenCodes.add(code);
          parsedItems.push({
            id: `item_link_${code.toLowerCase()}_${Date.now()}_${index}`,
            code: code,
            model: model || 'OPPO',
            name: name || `Linh kiện ${code}`,
            category: category || 'OTHERS',
            quantity: 1,
            price: '',
            location: location || '-',
            date: new Date().toLocaleDateString('vi-VN'),
            note: 'Cập nhật từ StockSync Hub',
            selected: true,
          });
        }
      });

      res.json({
        success: true,
        url: targetUrl,
        totalParsed: parsedItems.length,
        parsedItems,
      });
    } catch (error: any) {
      console.error('Error in /api/sync-share-link:', error);
      res.status(500).json({ error: error.message || 'Failed to sync share link' });
    }
  });

  app.get('/api/catalog', async (req, res) => {
    try {
      const items = await db.select().from(labelCatalog);
      return res.json(items);
    } catch (error) {
      console.error('Error fetching catalog from SQL:', error);
      return res.json([]);
    }
  });

  app.post('/api/catalog/bulk', async (req, res) => {
    try {
      const { items, replace } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items must be an array' });
      }

      if (replace) {
        await db.delete(labelCatalog);
      }

      const validItems = items.filter((item: any) => item && item.id);
      if (validItems.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      // Chunk array to avoid exceeding max SQL parameter limits
      const chunkSize = 1000;
      for (let i = 0; i < validItems.length; i += chunkSize) {
        const chunk = validItems.slice(i, i + chunkSize);
        
        const valuesToInsert = chunk.map((item: any) => ({
          id: String(item.id).replace(/[\/\s#?]/g, '_'),
          code: item.code || '',
          name: item.name || '',
          model: item.model || '',
          category: item.category || '',
          quantity: Number(item.quantity) || 1,
          price: item.price || '',
          location: item.location || '',
          date: item.date || '',
          note: item.note || '',
        }));

        await db.insert(labelCatalog)
          .values(valuesToInsert)
          .onConflictDoUpdate({
            target: labelCatalog.id,
            set: {
              code: sql`excluded.code`,
              name: sql`excluded.name`,
              model: sql`excluded.model`,
              category: sql`excluded.category`,
              quantity: sql`excluded.quantity`,
              price: sql`excluded.price`,
              location: sql`excluded.location`,
              date: sql`excluded.date`,
              note: sql`excluded.note`,
            },
          });
      }

      res.json({ success: true, count: validItems.length });
    } catch (error) {
      console.error('Error bulk saving catalog to SQL:', error);
      res.status(500).json({ error: 'Failed to bulk save catalog' });
    }
  });

  app.post('/api/catalog', async (req, res) => {
    try {
      const item = req.body;
      await db.insert(labelCatalog)
        .values({
          id: item.id,
          code: item.code || '',
          name: item.name || '',
          model: item.model || '',
          category: item.category || '',
          quantity: item.quantity || 1,
          price: item.price || '',
          location: item.location || '',
          date: item.date || '',
          note: item.note || '',
        })
        .onConflictDoUpdate({
          target: labelCatalog.id,
          set: {
            code: item.code || '',
            name: item.name || '',
            model: item.model || '',
            category: item.category || '',
            quantity: item.quantity || 1,
            price: item.price || '',
            location: item.location || '',
            date: item.date || '',
            note: item.note || '',
          },
        });
      res.json({ success: true, item });
    } catch (error) {
      console.error('Error saving catalog item to SQL:', error);
      res.status(500).json({ error: 'Failed to save catalog item' });
    }
  });

  app.delete('/api/catalog', async (req, res) => {
    try {
      await db.delete(labelCatalog);
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing catalog on SQL:', error);
      res.status(500).json({ error: 'Failed to clear catalog' });
    }
  });

  app.delete('/api/catalog/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(labelCatalog).where(eq(labelCatalog.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting catalog item from SQL:', error);
      res.status(500).json({ error: 'Failed to delete catalog item' });
    }
  });

  // 4. Activity Logs API
  app.get('/api/activity-logs', async (req, res) => {
    try {
      const logs = await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp));
      res.json(logs);
    } catch (error) {
      console.error('Error fetching activity logs from SQL:', error);
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  });

  app.post('/api/activity-logs', async (req, res) => {
    try {
      const log = req.body;
      const logId = log.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await db.insert(activityLogs).values({
        id: logId,
        action: log.action || '',
        ticketNumber: log.ticketNumber || '',
        userName: log.userName || '',
        timestamp: log.timestamp || new Date().toISOString(),
        details: log.details || '',
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error logging activity to SQL:', error);
      res.status(500).json({ error: 'Failed to log activity' });
    }
  });

  // 4b. Technicians API (Persistent with Cloud SQL PostgreSQL & Cloud Firestore Bridge)
  // Helper to sync all technicians from Firestore into PostgreSQL on demand or startup
  async function syncTechniciansFromFirestoreToSql(): Promise<void> {
    if (!firestoreDb) return;
    try {
      const snap = await getDocs(collection(firestoreDb, 'technicians'));
      if (!snap.empty) {
        for (const d of snap.docs) {
          const data = d.data() as any;
          if (data && data.name) {
            const cleanName = String(data.name).trim();
            const cleanTechId = String(data.techId || d.id).trim().toUpperCase();
            const record = {
              id: d.id,
              techId: cleanTechId,
              name: cleanName,
              phone: data.phone ? String(data.phone).trim() : '',
              department: data.department ? String(data.department).trim() : 'Kỹ thuật Phần cứng',
              status: data.status || 'active',
              requestedBy: data.requestedBy || null,
              requestedAt: data.requestedAt || null,
              approvedBy: data.approvedBy || null,
              approvedAt: data.approvedAt || null,
              note: data.note ? String(data.note).trim() : '',
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
            };
            const existing = await db.select().from(technicians).where(eq(technicians.id, d.id));
            if (existing.length === 0) {
              await db.insert(technicians).values(record);
            } else {
              await db.update(technicians).set(record).where(eq(technicians.id, d.id));
            }
          }
        }
      }
    } catch (fsErr) {
      console.warn('Sync technicians from Firestore to SQL notice:', fsErr);
    }
  }

  // Trigger initial background sync on server startup
  syncTechniciansFromFirestoreToSql().catch((e) => console.warn('Startup tech sync error:', e));

  app.get('/api/technicians', async (req, res) => {
    try {
      let items = await db.select().from(technicians).orderBy(desc(technicians.updatedAt));
      // If table is currently empty, sync from Firestore immediately
      if (items.length === 0 && firestoreDb) {
        await syncTechniciansFromFirestoreToSql();
        items = await db.select().from(technicians).orderBy(desc(technicians.updatedAt));
      }
      return res.json(items);
    } catch (error) {
      console.error('Error fetching technicians from SQL:', error);
      // Resilient fallback to Firestore so clients never suffer 500 error
      if (firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'technicians'));
          if (!snap.empty) {
            const fallbackItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            return res.json(fallbackItems);
          }
        } catch (fsErr) {
          console.warn('Fallback fetch technicians from Firestore notice:', fsErr);
        }
      }
      return res.json([]);
    }
  });

  app.post('/api/technicians', async (req, res) => {
    try {
      const tech = req.body;
      if (!tech || !tech.name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const cleanName = String(tech.name).trim();
      const cleanTechId = String(tech.techId || `tech_${Date.now()}`).trim().toUpperCase();
      const id = tech.id || `tech_${cleanTechId.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
      const nowIso = new Date().toISOString();

      const newTech = {
        id,
        techId: cleanTechId,
        name: cleanName,
        phone: tech.phone ? String(tech.phone).trim() : '',
        department: tech.department ? String(tech.department).trim() : 'Kỹ thuật Phần cứng',
        status: tech.status || 'active',
        requestedBy: tech.requestedBy || null,
        requestedAt: tech.requestedAt || null,
        approvedBy: tech.approvedBy || null,
        approvedAt: tech.approvedAt || null,
        note: tech.note ? String(tech.note).trim() : '',
        createdAt: tech.createdAt || nowIso,
        updatedAt: tech.updatedAt || nowIso,
      };

      // 1. Save to Cloud SQL PostgreSQL
      const existing = await db.select().from(technicians).where(eq(technicians.id, id));
      if (existing.length > 0) {
        await db.update(technicians).set(newTech).where(eq(technicians.id, id));
      } else {
        await db.insert(technicians).values(newTech);
      }

      // 2. Mirror to Firestore Bridge
      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, 'technicians', id), sanitizeForFirestore(newTech), { merge: true });
        } catch (fsErr) {
          console.warn('Server Firestore sync technician notice:', fsErr);
        }
      }

      // 3. Log to activity_logs
      try {
        await db.insert(activityLogs).values({
          id: `log_${Date.now()}`,
          action: 'SAVE_TECHNICIAN',
          userName: tech.approvedBy || tech.requestedBy || 'Admin',
          timestamp: nowIso,
          details: `Lưu thông tin KTV: ${newTech.name} (${newTech.techId}) - Trạng thái: ${newTech.status}`,
        });
      } catch (e) {}

      res.json(newTech);
    } catch (error) {
      console.error('Error saving technician to SQL:', error);
      res.status(500).json({ error: 'Failed to save technician' });
    }
  });

  app.put('/api/technicians/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const nowIso = new Date().toISOString();
      const existing = await db.select().from(technicians).where(eq(technicians.id, id));
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Technician not found' });
      }
      const current = existing[0];
      const updatedTech = {
        ...current,
        ...updates,
        techId: updates.techId ? String(updates.techId).trim().toUpperCase() : current.techId,
        name: updates.name ? String(updates.name).trim() : current.name,
        phone: updates.phone !== undefined ? String(updates.phone).trim() : current.phone,
        department: updates.department ? String(updates.department).trim() : current.department,
        status: updates.status || current.status,
        note: updates.note !== undefined ? String(updates.note).trim() : current.note,
        updatedAt: nowIso,
      };

      await db.update(technicians).set(updatedTech).where(eq(technicians.id, id));

      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, 'technicians', id), sanitizeForFirestore(updatedTech), { merge: true });
        } catch (fsErr) {
          console.warn('Server Firestore update technician notice:', fsErr);
        }
      }

      res.json(updatedTech);
    } catch (error) {
      console.error('Error updating technician in SQL:', error);
      res.status(500).json({ error: 'Failed to update technician' });
    }
  });

  app.delete('/api/technicians/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(technicians).where(eq(technicians.id, id));

      if (firestoreDb) {
        try {
          await deleteDoc(doc(firestoreDb, 'technicians', id));
        } catch (fsErr) {
          console.warn('Server Firestore delete technician notice:', fsErr);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting technician from SQL:', error);
      res.status(500).json({ error: 'Failed to delete technician' });
    }
  });

  // 4c. Device & IOT Bookings API (Persistent with Cloud SQL PostgreSQL & Cloud Firestore Bridge)
  let deviceIotSignal = {
    version: Date.now(),
    updatedAt: new Date().toISOString(),
    count: 0,
    updatedBy: 'System Init',
  };

  async function syncDeviceIotsFromFirestoreToSql(): Promise<void> {
    if (!firestoreDb) return;
    try {
      const snap = await getDocs(collection(firestoreDb, 'device_iot_bookings'));
      if (!snap.empty) {
        for (const d of snap.docs) {
          const item = d.data() as any;
          if (item && (item.ticketNumber || item.customerName)) {
            const nowIso = new Date().toISOString();
            const record = {
              id: d.id,
              ticketNumber: item.ticketNumber || '',
              customerName: item.customerName || '',
              customerPhone: item.customerPhone || '',
              deviceModel: item.deviceModel || '',
              deviceName: item.deviceName || '',
              skuCode: item.skuCode || null,
              imeiOrIot: item.imeiOrIot || '',
              deviceCategory: item.deviceCategory || 'phone',
              flowType: item.flowType || 'request_device',
              status: item.status || 'cho_xin_may',
              bookingDate: item.bookingDate || '',
              requestedDate: item.requestedDate || null,
              stockedInDate: item.stockedInDate || null,
              location: item.location || '',
              hasDeposit: Boolean(item.hasDeposit),
              depositType: item.depositType || null,
              depositAmount: item.depositAmount ? String(item.depositAmount) : null,
              borrowedDate: item.borrowedDate || null,
              returnedDate: item.returnedDate || null,
              loanHandoverBy: item.loanHandoverBy || null,
              loanReceivedBy: item.loanReceivedBy || null,
              loanCondition: item.loanCondition || null,
              loanAccessories: item.loanAccessories || null,
              calledCustomerDate: item.calledCustomerDate || null,
              callSubStatus: item.callSubStatus || null,
              appointmentDate: item.appointmentDate || null,
              callNote: item.callNote || null,
              callLogs: item.callLogs || [],
              customerArrivedDate: item.customerArrivedDate || null,
              technicianName: item.technicianName || '',
              note: item.note || '',
              isCompletedWithoutExchange: Boolean(item.isCompletedWithoutExchange),
              closureReason: item.closureReason || null,
              closureNote: item.closureNote || null,
              closureBy: item.closureBy || null,
              cancelRequested: Boolean(item.cancelRequested),
              cancelReason: item.cancelReason || null,
              cancelRequestedBy: item.cancelRequestedBy || null,
              cancelRequestedAt: item.cancelRequestedAt || null,
              history: item.history || [],
              createdBy: item.createdBy || null,
              createdByUid: item.createdByUid || null,
              creatorTechnician: item.creatorTechnician || null,
              warrantyCenterName: item.warrantyCenterName || null,
              warrantyCenterPhone: item.warrantyCenterPhone || null,
              createdAt: item.createdAt || nowIso,
              updatedAt: item.updatedAt || nowIso,
            };

            const existing = await db.select().from(deviceIotBookings).where(eq(deviceIotBookings.id, d.id));
            if (existing.length === 0) {
              await db.insert(deviceIotBookings).values(record);
            } else {
              await db.update(deviceIotBookings).set(record).where(eq(deviceIotBookings.id, d.id));
            }
          }
        }
        console.log(`[DeviceIOT] Synced ${snap.size} device & IOT bookings from Firestore to SQL.`);
      }
    } catch (fsErr) {
      console.warn('[DeviceIOT] Sync from Firestore to SQL notice:', fsErr);
    }
  }

  // Trigger initial background sync for Device & IOT on server startup
  syncDeviceIotsFromFirestoreToSql().catch((e) => console.warn('Startup device IOT sync error:', e));

  app.get('/api/device-iot', async (req, res) => {
    try {
      let items = await db.select().from(deviceIotBookings).orderBy(desc(deviceIotBookings.updatedAt));
      if (items.length === 0 && firestoreDb) {
        await syncDeviceIotsFromFirestoreToSql();
        items = await db.select().from(deviceIotBookings).orderBy(desc(deviceIotBookings.updatedAt));
      }
      return res.json(items);
    } catch (error) {
      console.error('Error fetching device & IOT bookings from SQL:', error);
      if (firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'device_iot_bookings'));
          if (!snap.empty) {
            const fallbackItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            return res.json(fallbackItems);
          }
        } catch (fsErr) {
          console.warn('Fallback fetch device & IOT from Firestore notice:', fsErr);
        }
      }
      return res.json([]);
    }
  });

  app.post('/api/device-iot', async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id) {
        return res.status(400).json({ error: 'Missing device IOT item ID' });
      }

      const nowIso = new Date().toISOString();
      const record = {
        id: item.id,
        ticketNumber: item.ticketNumber || '',
        customerName: item.customerName || '',
        customerPhone: item.customerPhone || '',
        deviceModel: item.deviceModel || '',
        deviceName: item.deviceName || '',
        skuCode: item.skuCode || null,
        imeiOrIot: item.imeiOrIot || '',
        deviceCategory: item.deviceCategory || 'phone',
        flowType: item.flowType || 'request_device',
        status: item.status || 'cho_xin_may',
        bookingDate: item.bookingDate || '',
        requestedDate: item.requestedDate || null,
        stockedInDate: item.stockedInDate || null,
        location: item.location || '',
        hasDeposit: Boolean(item.hasDeposit),
        depositType: item.depositType || null,
        depositAmount: item.depositAmount ? String(item.depositAmount) : null,
        borrowedDate: item.borrowedDate || null,
        returnedDate: item.returnedDate || null,
        loanHandoverBy: item.loanHandoverBy || null,
        loanReceivedBy: item.loanReceivedBy || null,
        loanCondition: item.loanCondition || null,
        loanAccessories: item.loanAccessories || null,
        calledCustomerDate: item.calledCustomerDate || null,
        callSubStatus: item.callSubStatus || null,
        appointmentDate: item.appointmentDate || null,
        callNote: item.callNote || null,
        callLogs: item.callLogs || [],
        customerArrivedDate: item.customerArrivedDate || null,
        technicianName: item.technicianName || '',
        note: item.note || '',
        isCompletedWithoutExchange: Boolean(item.isCompletedWithoutExchange),
        closureReason: item.closureReason || null,
        closureNote: item.closureNote || null,
        closureBy: item.closureBy || null,
        cancelRequested: Boolean(item.cancelRequested),
        cancelReason: item.cancelReason || null,
        cancelRequestedBy: item.cancelRequestedBy || null,
        cancelRequestedAt: item.cancelRequestedAt || null,
        history: item.history || [],
        createdBy: item.createdBy || null,
        createdByUid: item.createdByUid || null,
        creatorTechnician: item.creatorTechnician || null,
        warrantyCenterName: item.warrantyCenterName || null,
        warrantyCenterPhone: item.warrantyCenterPhone || null,
        createdAt: item.createdAt || nowIso,
        updatedAt: item.updatedAt || nowIso,
      };

      await db
        .insert(deviceIotBookings)
        .values(record)
        .onConflictDoUpdate({
          target: deviceIotBookings.id,
          set: record,
        });

      // Mirror to Firestore
      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, 'device_iot_bookings', item.id), sanitizeForFirestore(record), {
            merge: true,
          });
        } catch (fe) {
          console.warn('[DeviceIOT] Firestore mirror notice:', fe);
        }
      }

      deviceIotSignal = {
        version: Date.now(),
        updatedAt: nowIso,
        count: 1,
        updatedBy: item.technicianName || item.createdBy || 'User',
      };

      res.json({ success: true, item: record });
    } catch (error) {
      console.error('Error saving device & IOT booking to SQL:', error);
      res.status(500).json({ error: 'Failed to save device & IOT booking' });
    }
  });

  app.post('/api/device-iot/batch', async (req, res) => {
    try {
      const items = Array.isArray(req.body) ? req.body : req.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const nowIso = new Date().toISOString();
      const CHUNK_SIZE = 50;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (item) => {
            if (!item || !item.id) return;
            const record = {
              id: item.id,
              ticketNumber: item.ticketNumber || '',
              customerName: item.customerName || '',
              customerPhone: item.customerPhone || '',
              deviceModel: item.deviceModel || '',
              deviceName: item.deviceName || '',
              skuCode: item.skuCode || null,
              imeiOrIot: item.imeiOrIot || '',
              deviceCategory: item.deviceCategory || 'phone',
              flowType: item.flowType || 'request_device',
              status: item.status || 'cho_xin_may',
              bookingDate: item.bookingDate || '',
              requestedDate: item.requestedDate || null,
              stockedInDate: item.stockedInDate || null,
              location: item.location || '',
              hasDeposit: Boolean(item.hasDeposit),
              depositType: item.depositType || null,
              depositAmount: item.depositAmount ? String(item.depositAmount) : null,
              borrowedDate: item.borrowedDate || null,
              returnedDate: item.returnedDate || null,
              loanHandoverBy: item.loanHandoverBy || null,
              loanReceivedBy: item.loanReceivedBy || null,
              loanCondition: item.loanCondition || null,
              loanAccessories: item.loanAccessories || null,
              calledCustomerDate: item.calledCustomerDate || null,
              callSubStatus: item.callSubStatus || null,
              appointmentDate: item.appointmentDate || null,
              callNote: item.callNote || null,
              callLogs: item.callLogs || [],
              customerArrivedDate: item.customerArrivedDate || null,
              technicianName: item.technicianName || '',
              note: item.note || '',
              isCompletedWithoutExchange: Boolean(item.isCompletedWithoutExchange),
              closureReason: item.closureReason || null,
              closureNote: item.closureNote || null,
              closureBy: item.closureBy || null,
              cancelRequested: Boolean(item.cancelRequested),
              cancelReason: item.cancelReason || null,
              cancelRequestedBy: item.cancelRequestedBy || null,
              cancelRequestedAt: item.cancelRequestedAt || null,
              history: item.history || [],
              createdBy: item.createdBy || null,
              createdByUid: item.createdByUid || null,
              creatorTechnician: item.creatorTechnician || null,
              warrantyCenterName: item.warrantyCenterName || null,
              warrantyCenterPhone: item.warrantyCenterPhone || null,
              createdAt: item.createdAt || nowIso,
              updatedAt: item.updatedAt || nowIso,
            };

            await db
              .insert(deviceIotBookings)
              .values(record)
              .onConflictDoUpdate({
                target: deviceIotBookings.id,
                set: record,
              });

            if (firestoreDb) {
              try {
                await setDoc(doc(firestoreDb, 'device_iot_bookings', item.id), sanitizeForFirestore(record), {
                  merge: true,
                });
              } catch (fe) {}
            }
          })
        );
      }

      deviceIotSignal = {
        version: Date.now(),
        updatedAt: nowIso,
        count: items.length,
        updatedBy: 'Batch Import',
      };

      res.json({ success: true, count: items.length });
    } catch (error) {
      console.error('Error batch saving device & IOT to SQL:', error);
      res.status(500).json({ error: 'Failed to batch save device & IOT' });
    }
  });

  app.delete('/api/device-iot/clear/all', async (req, res) => {
    try {
      await db.delete(deviceIotBookings);

      if (firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'device_iot_bookings'));
          const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
          await Promise.all(deletePromises);
        } catch (fe) {
          console.warn('[DeviceIOT] Server clear all Firestore notice:', fe);
        }
      }

      deviceIotSignal = {
        version: Date.now(),
        updatedAt: new Date().toISOString(),
        count: 0,
        updatedBy: 'Clear All',
      };

      res.json({ success: true, message: 'Cleared all device & IOT bookings' });
    } catch (error) {
      console.error('Error clearing all device & IOT bookings from SQL:', error);
      res.status(500).json({ error: 'Failed to clear device & IOT bookings' });
    }
  });

  app.delete('/api/device-iot/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(deviceIotBookings).where(eq(deviceIotBookings.id, id));

      if (firestoreDb) {
        try {
          await deleteDoc(doc(firestoreDb, 'device_iot_bookings', id));
        } catch (fe) {
          console.warn('[DeviceIOT] Server delete from Firestore notice:', fe);
        }
      }

      deviceIotSignal = {
        version: Date.now(),
        updatedAt: new Date().toISOString(),
        count: 1,
        updatedBy: 'Delete',
      };

      res.json({ success: true, id });
    } catch (error) {
      console.error('Error deleting device & IOT booking from SQL:', error);
      res.status(500).json({ error: 'Failed to delete device & IOT booking' });
    }
  });

  app.get('/api/signals/device-iot', (req, res) => {
    res.json(deviceIotSignal);
  });

  app.post('/api/signals/device-iot', (req, res) => {
    const { updatedBy, count } = req.body || {};
    deviceIotSignal = {
      version: Date.now(),
      updatedAt: new Date().toISOString(),
      count: typeof count === 'number' ? count : 1,
      updatedBy: updatedBy || 'Client Trigger',
    };
    res.json({ success: true, signal: deviceIotSignal });
  });


  // Helper to parse dates in either ISO 8601 or Vietnamese formatted strings
  function parseDateOrIso(dateStr?: string | null): number {
    if (!dateStr) return 0;
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) return parsed;
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const [_, d, m, y, h = '0', min = '0', s = '0'] = match;
      return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s)).getTime();
    }
    return 0;
  }

  function isUserRecentlyActive(lastActive?: string | null, windowMs = 120000): boolean {
    if (!lastActive) return false;
    const activeMs = parseDateOrIso(lastActive);
    if (activeMs === 0) return false;
    return (Date.now() - activeMs) <= windowMs;
  }

  // 5. Users API (Users, Sessions, Approval & Multi-Device Sync)
  app.get('/api/users', async (req, res) => {
    try {
      const { appUsers } = await import('./src/db/schema');
      const allUsers = await db.select().from(appUsers);

      // De-duplicate users by username (keep primary/approved record with latest active time)
      const userMap = new Map<string, any>();
      for (const u of allUsers) {
        const uname = (u.username || u.uid || '').trim().toLowerCase();
        const isOnline = isUserRecentlyActive(u.lastActive, 120000) && u.online !== false;
        const normalized = {
          ...u,
          online: isOnline,
        };

        if (!userMap.has(uname)) {
          userMap.set(uname, normalized);
        } else {
          const existing = userMap.get(uname);
          // Prefer 'admin-master' for admin, or record with more recent active time
          const existingMs = parseDateOrIso(existing.lastActive);
          const currentMs = parseDateOrIso(u.lastActive);
          if (u.uid === 'admin-master' || currentMs > existingMs) {
            userMap.set(uname, normalized);
          }
        }
      }

      res.json(Array.from(userMap.values()));
    } catch (error) {
      console.error('Error fetching users from SQL:', error);
      res.json([]);
    }
  });

  app.get('/api/users/:uid', async (req, res) => {
    try {
      const { appUsers } = await import('./src/db/schema');
      const { uid } = req.params;
      const users = await db.select().from(appUsers).where(eq(appUsers.uid, uid));
      if (users.length > 0) {
        const u = users[0];
        res.json({
          ...u,
          online: isUserRecentlyActive(u.lastActive, 120000) && u.online !== false,
        });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const { appUsers } = await import('./src/db/schema');
      const u = req.body;
      if (!u || (!u.uid && !u.username)) {
        return res.status(400).json({ error: 'Missing uid or username' });
      }

      const cleanUsername = (u.username || '').trim().toLowerCase();
      let targetUid = u.uid || `user_${cleanUsername}`;

      // Enforce singleton UID for Admin
      if (cleanUsername === 'admin') {
        targetUid = 'admin-master';
      } else if (cleanUsername) {
        // Multi-device sync: If this username already exists with an approved UID in database, re-use existing UID to prevent duplicate entries
        const existingUsers = await db.select().from(appUsers).where(eq(appUsers.username, cleanUsername));
        if (existingUsers.length > 0) {
          targetUid = existingUsers[0].uid;
        }
      }

      const nowIso = new Date().toISOString();
      const setObj: any = {
        lastActive: u.lastActive || nowIso,
      };
      if (u.username !== undefined) setObj.username = cleanUsername;
      if (u.password !== undefined) setObj.password = u.password;
      if (u.displayName !== undefined) setObj.displayName = u.displayName;
      if (u.role !== undefined) setObj.role = u.role;
      if (u.status !== undefined) setObj.status = u.status;
      if (u.online !== undefined) setObj.online = Boolean(u.online);
      if (u.approvedBy !== undefined) setObj.approvedBy = u.approvedBy;
      if (u.approvedAt !== undefined) setObj.approvedAt = u.approvedAt;

      await db.insert(appUsers)
        .values({
          uid: targetUid,
          username: cleanUsername || 'staff',
          password: u.password || '',
          displayName: u.displayName || cleanUsername || '',
          role: u.role || (cleanUsername === 'admin' ? 'admin' : 'staff'),
          status: u.status || (cleanUsername === 'admin' ? 'approved' : 'pending'),
          online: u.online !== undefined ? Boolean(u.online) : true,
          lastActive: u.lastActive || nowIso,
          approvedBy: u.approvedBy || null,
          approvedAt: u.approvedAt || null,
          createdAt: u.createdAt || nowIso,
        })
        .onConflictDoUpdate({
          target: appUsers.uid,
          set: setObj,
        });

      res.json({ success: true, uid: targetUid, user: { ...u, uid: targetUid } });
    } catch (error) {
      console.error('Error saving user to SQL:', error);
      res.status(500).json({ error: 'Failed to save user' });
    }
  });

  // User presence heartbeat / logout
  app.post('/api/users/presence', async (req, res) => {
    try {
      const { appUsers } = await import('./src/db/schema');
      const { uid, online } = req.body;
      if (uid) {
        await db.update(appUsers)
          .set({
            online: Boolean(online),
            lastActive: new Date().toISOString(),
          })
          .where(eq(appUsers.uid, uid));
      }
      res.json({ success: true });
    } catch (e) {
      res.json({ success: false });
    }
  });

  app.delete('/api/users/:uid', async (req, res) => {
    try {
      const { appUsers } = await import('./src/db/schema');
      const { uid } = req.params;
      await db.delete(appUsers).where(eq(appUsers.uid, uid));
      res.json({ success: true, uid });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // 6. Analytics API (Accurate Visits & Active Online Session Calculation)
  app.get('/api/analytics', async (req, res) => {
    try {
      const { appUsers } = await import('./src/db/schema');
      const stats = await db.select().from(appStats).where(eq(appStats.key, 'traffic'));
      
      let totalVisits = 1;
      if (stats.length > 0 && stats[0].value) {
        const val = stats[0].value as any;
        totalVisits = Number(val.totalVisits) || 1;
      }

      // Compute actual active online unique users in the last 2 minutes
      const allUsers = await db.select().from(appUsers);
      const activeUsernames = new Set<string>();
      for (const u of allUsers) {
        if (isUserRecentlyActive(u.lastActive, 120000) && u.online !== false) {
          activeUsernames.add((u.username || u.uid).toLowerCase());
        }
      }
      const onlineCount = Math.max(1, activeUsernames.size);

      res.json({
        totalVisits,
        onlineCount,
        activeUsers: Array.from(activeUsernames),
      });
    } catch (error) {
      res.json({ totalVisits: 1, onlineCount: 1 });
    }
  });

  app.post('/api/analytics', async (req, res) => {
    try {
      const stats = await db.select().from(appStats).where(eq(appStats.key, 'traffic'));
      let currentVisits = 0;
      if (stats.length > 0 && stats[0].value) {
        const val = stats[0].value as any;
        currentVisits = Number(val.totalVisits) || 0;
      }
      const newTotal = currentVisits + 1;
      const payload = {
        totalVisits: newTotal,
        lastVisitAt: new Date().toISOString(),
      };

      await db.insert(appStats)
        .values({
          key: 'traffic',
          value: payload,
        })
        .onConflictDoUpdate({
          target: appStats.key,
          set: { value: payload },
        });

      res.json(payload);
    } catch (error) {
      console.error('Error updating analytics to SQL:', error);
      res.status(500).json({ error: 'Failed to update analytics' });
    }
  });

  // 12. Gemini AI Multi-turn Chatbot API
  let geminiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!geminiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('Notice: GEMINI_API_KEY environment variable is not defined.');
      }
      geminiClient = new GoogleGenAI({
        apiKey: apiKey || '',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return geminiClient;
  }

  app.post('/api/chat', async (req, res) => {
    try {
      const {
        messages,
        model = 'gemini-3.8-flash',
        role = 'hardware_expert',
        customSystemInstruction,
        contextData,
      } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required and cannot be empty' });
      }

      const ai = getGeminiClient();

      // Specialized role instructions for OPPO Label Studio & Shortage Management
      const roleInstructions: Record<string, string> = {
        hardware_expert: `Bạn là "Chuyên gia Kỹ thuật OPPO & Tra cứu Linh kiện" chuyên nghiệp và tận tâm tại Trung tâm Bảo hành & Dịch vụ Khách hàng OPPO (HCM4).
Nhiệm vụ của bạn:
- Hỗ trợ kỹ thuật viên (KTV) tra cứu, nhận diện chính xác các mã linh kiện (màn hình LCD/AMOLED, nắp lưng/nắp pin, cụm camera, bo mạch chủ/mainboard, pin Li-Po, cáp nối sub, loa, bo sạc...) cho các dòng máy OPPO (Find N/Find X, Reno, A-series), Realme, OnePlus.
- Phân biệt chi tiết sự khác nhau về thiết kế, kết cấu, mã phụ tùng giữa các phiên bản (ví dụ: Reno 12 5G vs Reno 12 Pro 5G, Find X8 vs Find X8 Pro, A78 vs A79...).
- Giải thích quy cách tem nhãn chuẩn 3x2 inch, mã vạch Code 128, mã QR chuẩn GCSM.
- Hướng dẫn chẩn đoán lỗi phần cứng, phân tích pan bệnh điện thoại và gợi ý linh kiện thay thế chuẩn xác.
- Trả lời bằng tiếng Việt chuyên nghiệp, súc tích, mạch lạc, có cấu trúc rõ ràng, sử dụng bảng/danh sách dễ đọc.`,

        inventory_label: `Bạn là "Cố vấn Quản lý Kho & Tem Nhãn Barcode/QR" tại hệ thống OPPO Label Studio.
Nhiệm vụ của bạn:
- Hỗ trợ thủ kho và nhân viên quản lý tồn kho linh kiện, tối ưu hóa vị trí lưu kho (kệ, ô, ngăn), quy trình nhập/xuất file Excel dữ liệu linh kiện.
- Tư vấn về khổ in tem nhãn chuẩn 3x2 inch (in đơn / in đôi split), mã vạch Code 128 / Code 39 và mã QR.
- Hướng dẫn đối soát dữ liệu tồn kho với hệ thống GCSM, quản lý định mức tồn an toàn.
- Trả lời bằng tiếng Việt chuyên nghiệp, chính xác, có định dạng danh sách và bảng khi cần thiết.`,

        shortage_cs: `Bạn là "Trợ lý Đặt Chờ Linh Kiện & CSKH (Shortage Hub)" của OPPO.
Nhiệm vụ của bạn:
- Hỗ trợ nhân viên theo dõi tiến độ các phiếu đặt chờ linh kiện (Đã tạo phiếu, Đã duyệt, Đã nhập kho, Đã gọi hẹn khách, Khách đã đến, Hoàn tất không thay/đã thay, Hủy).
- Đề xuất kịch bản cuộc gọi chăm sóc khách hàng chuyên nghiệp (thông báo linh kiện về kho, nhắc lịch hẹn, xử lý khiếu nại nếu linh kiện về trễ quá hạn 7 ngày / 3 ngày SVD).
- Trả lời lịch sự, thân thiện, mang phong cách dịch vụ chuẩn mực của OPPO Service Center.`,

        data_analyst: `Bạn là "Chuyên gia Phân tích Dữ liệu & Báo cáo Vận hành" cho xưởng dịch vụ và kho linh kiện OPPO.
Nhiệm vụ của bạn:
- Phân tích xu hướng hỏng hóc, thống kê tỷ lệ đặt chờ, đánh giá hiệu suất xử lý của các kỹ thuật viên.
- Đưa ra giải pháp tối ưu hóa định mức tồn kho an toàn và cảnh báo rủi ro linh kiện tồn đọng lâu ngày.
- Trình bày câu trả lời kèm số liệu mẫu, phân tích SWOT hoặc biểu đồ tư duy trực quan bằng Markdown.`,
      };

      let baseInstruction = roleInstructions[role] || roleInstructions.hardware_expert;
      if (customSystemInstruction) {
        baseInstruction += `\n\nBổ sung chỉ dẫn: ${customSystemInstruction}`;
      }

      // Mandatory accurate hardware specs & anti-hallucination rules
      baseInstruction += `\n\n=== NGUYÊN TẮC BẮT BUỘC: TƯ DUY PHẢN HỒI NHANH, CHUẨN XÁC & TƯƠNG TÁC LÀM RÕ ===
1. TƯ DUY TÌM MÃ SẢN PHẨM & LINH KIỆN (TẬP TRUNG CỐT LÕI - PHẢN HỒI NHANH):
   - Khi người dùng hỏi về Mã sản phẩm / Tên linh kiện / Phụ tùng (ví dụ: "miếng dán màn hình A76", "pin Find X8", "màn hình Reno 11", "4886441"):
     * NÊU TRỰC TIẾP THÔNG TIN CỐT LÕI: **Mã SP (Cột A)** | **Tên Linh Kiện (Cột B)** | **Model (Cột C)** | **Vị trí kệ kho** | **Tồn kho thực tế** | **Đơn giá**.
     * BẮT BUỘC CHỈ SỬ DỤNG MÃ SP VÀ TÊN CÓ THỰC TRONG DỮ LIỆU ĐƯỢC CUNG CẤP (như '4886441', '621033000404', 'BLPA41'...). TUYỆT ĐỐI KHÔNG BỊA ĐẶT DÃY SỐ GIẢ.
     * Đính kèm nút hành động trực tiếp: [[ACTION:catalog?search=MÃ_SP|🔍 Xem mã [MÃ_SP] trong Bảng Dữ Liệu]] hoặc [[ACTION:shortage?search=MÃ_SP|📋 Phiếu đặt chờ]].
     * KHÔNG diễn giải lan man dài dòng. Phần chi tiết kỹ thuật/lý thuyết chỉ xuất hiện khi người dùng yêu cầu diễn giải thêm.

2. TƯƠNG TÁC LÀM RÕ KHI THIẾU THÔNG TIN HOẶC CÂU HỎI CHUNG CHUNG:
   - Nếu câu hỏi của người dùng còn chung chung (ví dụ: "A76", "màn hình", "pin", "tìm linh kiện") hoặc có nhiều kết quả tương tự:
     * Trả về bảng ngắn gọn các mã phù hợp nhất.
     * ĐỒNG THỜI tạo ngay các nút tương tác 1 chạm dạng: [[ACTION:ask:Câu hỏi cụ thể|Nhãn nút]] để người dùng bấm chọn nhánh mong muốn nhanh nhất mà không cần gõ lại.
     * Ví dụ: [[ACTION:ask:Miếng dán màn hình A76|📱 Miếng dán A76 (Mã 4886441)]] | [[ACTION:ask:Pin OPPO A76|🔋 Pin A76]]

3. XỬ LÝ NHANH CÂU HỎI VỀ TIẾN ĐỘ & KỸ THUẬT VIÊN:
   - Nêu ngay Thẻ KPI tổng quát (Tổng chờ, B1, B2, B3, B4, Cảnh báo quá hạn > 7 ngày / SVD > 3 ngày).
   - Xuất bảng tóm tắt phiếu cần xử lý gấp.
   - Nút hành động: [[ACTION:shortage?search=Tên_KTV|🔍 Xem phiếu KTV [Tên]]].

4. BẢNG MÃ PIN & THÔNG SỐ CHUẨN CỦA DÒNG MÁY OPPO/REALME:
   - OPPO Reno 13 F 5G/4G (CPH2699 / CPH2713): Pin BLPA63 / BLPA65 (5000 / 5800 mAh, sạc 45W). Màn AMOLED phẳng 6.67" 120Hz FHD+.
   - OPPO Find X8 (CPH2651 / PKB110): Pin BLPA41 (5630 mAh Silicon-Carbon Glacier, 80W/50W). Màn AMOLED phẳng 6.59" 1.5K. Camera 3 mắt 50MP Sony LYT-700.
   - OPPO Find X8 Pro (CPH2659 / PKC110): Pin BLPA45 (5910 mAh Glacier, 80W/50W). Màn Quad-Curved cong 4 cạnh 6.78" 1.5K. Camera 4 mắt (LYT-808 + IMX858 Tele 6X). Có phím Quick Button.
   - OPPO Reno 12 5G (CPH2625): Pin BLPA17 (5000 mAh, sạc 80W). Màn cong 2 bên. Lưng sóng nước Fluid Ripple.
   - OPPO Reno 12 Pro 5G (CPH2629): Pin BLPA19 (5000 mAh, sạc 80W). Màn Quad-Curved cong 4 cạnh. Lưng Two-Tone viền camera Clous de Paris.
   - OPPO Reno 12F 5G/4G (CPH2637/2687): Pin BLPA21 (5000 mAh, sạc 45W). Cụm camera tròn Halo Light.
   - OPPO Find N3 (CPH2499): Pin kép BLPA23 (2095 mAh) + BLPA25 (2710 mAh) = 4805 mAh, sạc 67W.
   - OPPO Reno 11 5G (CPH2599): Pin BLPA01 (5000 mAh, sạc 67W).
   - OPPO Reno 11 Pro 5G (CPH2607): Pin BLPA03 (4600 mAh, sạc 80W).
   - OPPO Reno 10 5G (CPH2531): Pin BLP993 (5000 mAh, sạc 67W).
   - OPPO Reno 10 Pro+ 5G (CPH2521): Pin BLPA07 (4700 mAh, sạc 100W).
   - OPPO A78 4G (CPH2565): Pin BLP987 (5000 mAh, sạc 67W). Màn AMOLED phẳng 6.43".
   - OPPO A78 5G (CPH2483): Pin BLP923 (5000 mAh, sạc 33W). Màn IPS LCD giọt nước 6.56".
   - OPPO A58 (CPH2577) / A38 (CPH2579) / A18 (CPH2591): Pin BLP997 (5000 mAh).
   - OPPO A60 (CPH2631): Pin BLPA15 (5000 mAh, sạc 45W).
   - OPPO A79 5G (CPH2557): Pin BLP993 (5000 mAh, sạc 33W).`;

      if (contextData) {
        baseInstruction += `\n\n--- DỮ LIỆU THỰC TẾ TỪ HỆ THỐNG HIỆN TẠI ---\n${typeof contextData === 'string' ? contextData : JSON.stringify(contextData, null, 2)}\n----------------------------------------\nHãy sử dụng dữ liệu thực tế trên khi giải đáp. Ưu tiên độ chính xác 100%, trả lời ngắn gọn, tạo nút tương tác nhanh [[ACTION:...]].`;
      }

      // Format conversation history for @google/genai SDK
      const contents = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(m.text || '') }],
      }));

      // Official Gemini Cascade for Auto Fallback & Quota Protection
      const MASTER_GEMINI_CASCADE = [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-2.5-pro',
        'gemini-1.5-flash',
      ];

      const inputModel = model || 'auto';
      let fallbackList: string[] = [];

      if (inputModel === 'auto') {
        fallbackList = [...MASTER_GEMINI_CASCADE];
      } else if (MASTER_GEMINI_CASCADE.includes(inputModel)) {
        // Start from requested model, then follow cascade
        const startIndex = MASTER_GEMINI_CASCADE.indexOf(inputModel);
        fallbackList = [
          ...MASTER_GEMINI_CASCADE.slice(startIndex),
          ...MASTER_GEMINI_CASCADE.slice(0, startIndex),
        ];
      } else {
        fallbackList = [inputModel, ...MASTER_GEMINI_CASCADE];
      }

      let lastError: any = null;
      let replyText: string | null = null;
      let actualModelUsed = fallbackList[0];

      for (const targetModel of fallbackList) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: targetModel,
              contents: contents,
              config: {
                systemInstruction: baseInstruction,
                temperature: 0.1,
              },
            });

            if (response && response.text) {
              replyText = response.text;
              actualModelUsed = targetModel;
              break; // Success!
            }
          } catch (apiErr: any) {
            lastError = apiErr;
            const errStr = String(apiErr?.message || apiErr || '');
            const isQuotaExhausted =
              apiErr?.status === 'RESOURCE_EXHAUSTED' ||
              apiErr?.code === 429 ||
              apiErr?.status === 429 ||
              errStr.includes('429') ||
              errStr.includes('RESOURCE_EXHAUSTED') ||
              errStr.includes('Quota exceeded');

            const isTransient =
              apiErr?.status === 'UNAVAILABLE' ||
              apiErr?.code === 503 ||
              apiErr?.status === 503 ||
              errStr.includes('503') ||
              errStr.includes('UNAVAILABLE') ||
              errStr.includes('high demand');

            if (isQuotaExhausted) {
              console.warn(`[Gemini Auto Fallback] Model ${targetModel} hit quota/429. Switching to next model in cascade...`);
            }

            if (isTransient && attempt === 0) {
              await new Promise((r) => setTimeout(r, 300));
              continue; // Retry once after 300ms delay
            }
            break; // Proceed to next fallback model
          }
        }
        if (replyText) break;
      }

      // If online Gemini succeeds, return directly
      if (replyText) {
        const isAutoSwitched = inputModel !== 'auto' && actualModelUsed !== inputModel;
        return res.json({
          text: replyText,
          model: actualModelUsed,
          role: role,
          autoSwitched: isAutoSwitched,
          switchedFrom: inputModel !== 'auto' ? inputModel : undefined,
        });
      }

      // If all Gemini calls encountered quota / rate limits, invoke intelligent Technical Knowledge Base
      console.warn('All Gemini online models exhausted quota/limits. Engaging built-in Hardware Knowledge Fallback...');
      const lastUserMsg = messages[messages.length - 1]?.text || '';
      const fallbackAnswer = generateHardwareKnowledgeFallback(lastUserMsg, role, contextData);

      return res.json({
        text: fallbackAnswer,
        model: 'oppo-knowledge-engine-v2',
        role: role,
        isFallback: true,
      });
    } catch (error: any) {
      console.error('Error calling Gemini API in /api/chat:', error);
      return res.status(500).json({
        error: error?.message || 'Có lỗi xảy ra khi xử lý phản hồi.',
      });
    }
  });

  // Built-in intelligent technical knowledge engine for OPPO/Realme hardware and workflows
  function generateHardwareKnowledgeFallback(query: string, role: string, contextData: any): string {
    const q = (query || '').toLowerCase();

    // 1. Check Exact Catalog Part Items Search Matches
    if (contextData?.danh_sach_linh_kien_trong_kho_khop_chinh_xac?.length > 0) {
      const matchedCatalog = contextData.danh_sach_linh_kien_trong_kho_khop_chinh_xac;
      const topItem = matchedCatalog[0];

      let res = `### 📦 Tra Cứu Linh Kiện Chính Xác Trong Kho\n\n`;
      res += `| Mã SP (Cột A) | Tên Linh Kiện (Cột B) | Model (Cột C) | Vị Trí Kho | Tồn Kho | Đơn Giá |\n`;
      res += `| :--- | :--- | :--- | :--- | :---: | :--- |\n`;

      matchedCatalog.slice(0, 6).forEach((item: any) => {
        res += `| **${item.ma_sp_cot_a}** | ${item.ten_linh_kien_cot_b} | **${item.model_cot_c || '-'}** | ${item.vi_tri_kho || 'Chưa gán'} | **${item.ton_kho_thuc_te}** | ${item.don_gia} |\n`;
      });

      if (contextData?.nut_tuong_tac_lam_ro?.interactiveOptions?.length > 0) {
        res += `\n> 🎯 **${contextData.nut_tuong_tac_lam_ro.promptMessage}**\n`;
        contextData.nut_tuong_tac_lam_ro.interactiveOptions.forEach((opt: string) => {
          res += `> * ${opt}\n`;
        });
      }

      res += `\n> 🔗 **Thao tác nhanh:**\n`;
      res += `> * ${topItem.action_deep_link || `[[ACTION:catalog?search=${encodeURIComponent(topItem.ma_sp_cot_a)}|🔍 Xem mã ${topItem.ma_sp_cot_a} trong Bảng Dữ Liệu Tem]]`}\n`;
      res += `> * [[ACTION:shortage?search=${encodeURIComponent(topItem.ma_sp_cot_a)}|📋 Kiểm tra phiếu đặt chờ của mã ${topItem.ma_sp_cot_a}]]\n`;
      return res;
    }

    // 2. Check Technician Workload Queries
    if (contextData?.thong_ke_nhan_su_va_ktv?.length > 0) {
      const techList = contextData.thong_ke_nhan_su_va_ktv;

      // Check if user is asking about a specific technician
      const matchedSingleTech = techList.find((t: any) => {
        const tName = (t.ten_nhan_vien || '').toLowerCase();
        const words = tName.split(/\s+/);
        const lastName = words[words.length - 1] || '';
        return q.includes(tName) || (lastName.length >= 2 && q.includes(lastName));
      });

      if (matchedSingleTech) {
        let res = `### 👤 Thống Kê Tiến Độ Phiếu của KTV: **${matchedSingleTech.ten_nhan_vien}**\n\n`;
        res += `* 📊 **Tổng phiếu phụ trách:** **${matchedSingleTech.tong_phieu_phu_trach}** phiếu\n`;
        res += `* ⏳ **Tổng phiếu đang chờ xử lý:** **${matchedSingleTech.tong_dang_cho_xu_ly}** phiếu\n`;
        if (matchedSingleTech.canh_bao_qua_7_ngay > 0) {
          res += `* ⚠️ **Cảnh báo quá hạn > 7 ngày:** <span className="text-rose-600 font-bold">${matchedSingleTech.canh_bao_qua_7_ngay} phiếu</span>\n`;
        }
        if (matchedSingleTech.canh_bao_svd_3_ngay > 0) {
          res += `* 🚨 **Cảnh báo SVD giữ máy > 3 ngày:** <span className="text-amber-600 font-bold">${matchedSingleTech.canh_bao_svd_3_ngay} phiếu</span>\n`;
        }
        res += `\n**Phân bổ chi tiết theo 5 bước tiến độ:**\n\n`;
        res += `| Bước Tiến Độ | Số Lượng | Trạng Thái |\n`;
        res += `| :--- | :--- | :--- |\n`;
        res += `| **Bước 1: Đã tạo phiếu** | **${matchedSingleTech.dang_cho_xu_ly_b1}** | Đang chờ duyệt & xin LK |\n`;
        res += `| **Bước 2: Đã xin LK** | **${matchedSingleTech.da_xin_lk_b2}** | Đang chờ kho điều phối |\n`;
        res += `| **Bước 3: Đã nhập kho** | **${matchedSingleTech.da_ve_kho_b3}** | LK đã về, cần gọi khách |\n`;
        res += `| **Bước 4: Đã gọi hẹn KH** | **${matchedSingleTech.da_goi_kh_b4}** | Chờ khách mang máy đến |\n`;
        res += `| **Bước 5: Đã hoàn tất** | **${matchedSingleTech.da_hoan_tat_b5}** | Đã thay xong / Xong việc |\n`;
        if (matchedSingleTech.bo_mau_dong_phieu > 0) {
          res += `| **Bỏ mẫu / Đóng phiếu** | **${matchedSingleTech.bo_mau_dong_phieu}** | Không thay / Bỏ mẫu |\n`;
        }

        if (matchedSingleTech.phieu_uu_tien_can_xu_ly && matchedSingleTech.phieu_uu_tien_can_xu_ly.length > 0) {
          res += `\n**Danh sách phiếu cần KTV ${matchedSingleTech.ten_nhan_vien} ưu tiên xử lý:**\n\n`;
          res += `| Mã Phiếu | Khách Hàng | SĐT | Model Máy | Linh Kiện | Trạng Thái | Ngày Tiếp Nhận |\n`;
          res += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
          matchedSingleTech.phieu_uu_tien_can_xu_ly.slice(0, 6).forEach((p: any) => {
            res += `| **${p.ticketNumber}** | ${p.customerName || 'N/A'} | ${p.customerPhone || 'N/A'} | ${p.model || 'N/A'} | ${p.partName || 'N/A'} | ${p.status} | ${p.bookingDate || 'N/A'} |\n`;
          });
        }

        res += `\n> 🎯 **Gợi ý thao tác:** ${matchedSingleTech.action_deep_link || `[[ACTION:shortage?search=${encodeURIComponent(matchedSingleTech.ten_nhan_vien)}|🔍 Xem phiếu của KTV ${matchedSingleTech.ten_nhan_vien} trong Đặt Chờ LK]]`}`;
        return res;
      }

      // General technician list ranking if asking generally about KTV workload
      if (q.includes('ktv') || q.includes('nhan vien') || q.includes('kỹ thuật') || q.includes('ai đang') || q.includes('danh sách')) {
        let res = `### 📊 Bảng Tổng Hợp Tải Công Việc Kỹ Thuật Viên & Nhân Sự (${techList.length} nhân sự)\n\n`;
        res += `| Kỹ Thuật Viên | Tổng Phụ Trách | Đang Chờ Xử Lý | Bước 1 (Chờ Xin) | Bước 3 (Về Kho) | Quá Hạn >7N |\n`;
        res += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        techList.forEach((t: any) => {
          res += `| **${t.ten_nhan_vien}** | ${t.tong_phieu_phu_trach} | **${t.tong_dang_cho_xu_ly}** | ${t.dang_cho_xu_ly_b1} | ${t.da_ve_kho_b3} | ${t.canh_bao_qua_7_ngay > 0 ? `🔴 ${t.canh_bao_qua_7_ngay}` : '0'} |\n`;
        });
        res += `\n> 💡 **Khuyến nghị điều phối:** Thủ kho và Quản lý nên ưu tiên hỗ trợ các KTV có nhiều phiếu Bước 1 hoặc có cảnh báo quá hạn.\n`;
        res += `> 🎯 **Xem danh sách đầy đủ:** [[ACTION:shortage?status=all|🔍 Mở Trung Tâm Quản Lý Đặt Chờ LK]]`;
        return res;
      }
    }

    // 2. Check Part Code & Customer Waitlist Queries
    if (contextData?.danh_sach_ma_linh_kien_va_khach_cho_dat?.length > 0) {
      const partList = contextData.danh_sach_ma_linh_kien_va_khach_cho_dat;
      const targetPart = partList[0]; // Take top matched part

      let res = `### 📦 Tra Cứu Linh Kiện & Danh Sách Khách Đang Chờ: **${targetPart.ma_linh_kien}**\n\n`;
      res += `* 🏷️ **Tên linh kiện:** **${targetPart.ten_linh_kien}**\n`;
      res += `* 📱 **Dòng máy (Model):** **${targetPart.model_may}**\n`;
      res += `* 📍 **Vị trí kệ kho:** **${targetPart.vi_tri_kho}**\n`;
      res += `* 📦 **Tồn kho thực tế:** **${targetPart.ton_kho_hien_tai}** cái\n`;
      if (targetPart.don_gia) {
        res += `* 💰 **Đơn giá:** **${targetPart.don_gia}**\n`;
      }
      res += `* 👥 **Số khách đang chờ đặt:** **${targetPart.so_khach_dang_cho}** khách\n`;
      res += `* ⚖️ **Cân đối cung - cầu:** **${targetPart.tinh_trang_cung_cau}**\n\n`;

      if (targetPart.danh_sach_khach_cho && targetPart.danh_sach_khach_cho.length > 0) {
        res += `**Danh sách khách hàng đang chờ nhận linh kiện:**\n\n`;
        res += `| Mã Phiếu | Tên Khách Hàng | Điện Thoại | Ngày Đặt | Trạng Thái | KTV Phụ Trách |\n`;
        res += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        targetPart.danh_sach_khach_cho.forEach((c: any) => {
          res += `| **${c.ticketNumber}** | ${c.customerName || 'N/A'} | ${c.customerPhone || 'N/A'} | ${c.bookingDate || 'N/A'} | ${c.status} | ${c.technicianName || 'Chưa gán'} |\n`;
        });
      }

      res += `\n> 🎯 **Gợi ý thao tác:** ${targetPart.action_deep_link || `[[ACTION:shortage?search=${encodeURIComponent(targetPart.ma_linh_kien)}|📋 Xem phiếu chờ đặt mã ${targetPart.ma_linh_kien}]]`}`;
      res += ` | [[ACTION:catalog?search=${encodeURIComponent(targetPart.ma_linh_kien)}|🏷️ Mở linh kiện trong In Tem / Kho]]`;
      return res;
    }

    // 3. Check Genuine Hardware Specs Queries
    if (contextData?.thong_so_phan_cung_chinh_xac_oppo?.length > 0) {
      const spec = contextData.thong_so_phan_cung_chinh_xac_oppo[0];
      let res = `### 📱 Thông Số Kỹ Thuật Chuẩn: **${spec.modelName}** (${spec.modelCodes.join(', ')})\n\n`;
      res += `* 🔋 **Mã Pin chuẩn:** **${spec.batteryCode}** (${spec.batteryCapacity}, sạc ${spec.chargingWatt})\n`;
      res += `* 🖥️ **Màn hình:** ${spec.displayType}\n`;
      res += `* 📸 **Cụm Camera:** ${spec.cameraSpecs}\n`;
      res += `* 🛡️ **Mặt lưng & Khung sườn:** ${spec.backCoverNotes}\n`;
      res += `* ⚠️ **Lưu ý tương thích:** **${spec.commonPartsNotes}**\n\n`;
      res += `> 🎯 **Gợi ý tra cứu:** [[ACTION:catalog?search=${encodeURIComponent(spec.modelCodes[0] || spec.modelName)}|🏷️ Tra cứu linh kiện ${spec.modelName} trong Kho]]`;
      return res;
    }

    // Hardware checks directly by name
    if (q.includes('reno 12') && (q.includes('nắp lưng') || q.includes('nap lung') || q.includes('phân biệt') || q.includes('phan biet') || q.includes('pro'))) {
      return `### 🔍 So sánh & Phân biệt Nắp lưng OPPO Reno 12 5G và Reno 12 Pro 5G

Theo tài liệu bảo hành và cấu trúc linh kiện chính hãng OPPO:

| Đặc điểm | OPPO Reno 12 5G (CPH2625) | OPPO Reno 12 Pro 5G (CPH2629) |
| :--- | :--- | :--- |
| **Thiết kế mặt lưng** | Kính bo cong 2.5D, hiệu ứng sóng nước **Fluid Ripple** hoặc nhám mờ đơn khối. | Thiết kế **Two-Tone (hai dải màu)** với dải ruy-băng kim loại chạy ngang nửa dưới. |
| **Cụm Camera** | Mô-đun camera viền kim loại phẳng, kích thước viền nhỏ hơn. | Cụm camera có viền khắc răng cưa họa tiết **Clous de Paris** (kim cương cao cấp). |
| **Vị trí Flash & Mic thu âm phụ** | Đèn Flash nằm sát ống kính thứ 3; vị trí viền phẳng. | Cụm nẹp kim loại dày hơn; vị trí cảm biến nhiệt độ màu và mic có viền vát cạnh. |
| **Chân tiếp xúc & Ăng-ten NFC** | Vị trí tiếp xúc ngàm cáp NFC & ăng-ten sóng bố trí khác biệt. | Ngàm ốc nẹp bo mạch và chân tiếp xúc dập sẵn theo khung sườn Pro. |

> ⚠️ **Lưu ý Kỹ thuật viên (KTV):**
> * **Không dùng chung nắp lưng** giữa Reno 12 và Reno 12 Pro do khác biệt về độ dày nẹp camera, vị trí ngàm ốc và cụm ăng-ten sóng.
> * Khi đặt hàng linh kiện, vui lòng kiểm tra chính xác model code trên vỏ máy (**CPH2625** cho Reno 12 5G hoặc **CPH2629** cho Reno 12 Pro 5G).
>
> 🎯 **Gợi ý:** [[ACTION:catalog?search=CPH2625|🏷️ Tra cứu linh kiện Reno 12]] | [[ACTION:catalog?search=CPH2629|🏷️ Tra cứu linh kiện Reno 12 Pro]]`;
    }

    if (q.includes('cph2699') || q.includes('cph2713') || q.includes('reno 13f') || q.includes('reno13 f') || q.includes('reno 13 f')) {
      return `### 📱 Thông Tin Chuẩn Model Máy & Linh Kiện: OPPO Reno13 F 5G / 4G (CPH2699 / CPH2713)

Theo cơ sở dữ liệu kỹ thuật bảo hành OPPO Service Center:

* **Tên thương mại**: OPPO Reno13 F 5G / 4G
* **Mã Model quốc tế**: **CPH2699** (bản 5G) / **CPH2713** (bản 4G)
* **Mã Pin (Battery)**: **BLPA63** / **BLPA65** (Dung lượng 5000 mAh / 5800 mAh, sạc 45W SuperVOOC)
* **Màn hình (Display)**: AMOLED phẳng 6.67 inch, 120Hz, FHD+ (2400 x 1080)
* **Mặt lưng & Camera**: Cụm camera vuông bo góc xẻ rãnh, 3 camera (Chính 50MP + Siêu rộng 8MP + Macro 2MP)

> ⚠️ **Cảnh báo Kỹ thuật viên (KTV):**
> * Model **CPH2699** là **OPPO Reno13 F 5G**, tuyệt đối **KHÔNG PHẢI** là dòng Find X8.
> * Linh kiện (màn hình, nắp lưng, pin BLPA63/65) của CPH2699 thiết kế riêng biệt, không dùng chung với Find X8 (CPH2651) hay Reno13 5G thường (CPH2689).
>
> 🎯 **Gợi ý:** [[ACTION:catalog?search=CPH2699|🏷️ Mở danh mục linh kiện Reno 13F]]`;
    }

    if (q.includes('find x8') || q.includes('cph2651') || q.includes('cph2659') || q.includes('cph2691')) {
      return `### 🔍 Bảng So Sánh & Mã Linh Kiện OPPO Find X8 (CPH2651) vs Find X8 Pro (CPH2659)

Theo danh mục kỹ thuật chuẩn OPPO Service Center:

| Bộ phận / Linh kiện | OPPO Find X8 (CPH2651) | OPPO Find X8 Pro (CPH2659) | Khả năng dùng chung |
| :--- | :--- | :--- | :--- |
| **Màn hình (Display)** | AMOLED phẳng 6.59 inch 1.5K, 120Hz, Gorilla Glass 7i | AMOLED Micro-Quad Curved (cong nhẹ 4 cạnh) 6.78" LTPO 120Hz | ❌ **Không dùng chung** (Khác kích thước và độ cong) |
| **Mã Pin (Battery)** | **BLPA41** (5630 mAh, Pin Silicon-Carbon Glacier) | **BLPA45** (5910 mAh, Pin Silicon-Carbon Glacier) | ❌ **Không dùng chung** (Khác mã pin & kích thước) |
| **Công suất sạc** | 80W SuperVOOC / 50W AirVOOC | 80W SuperVOOC / 50W AirVOOC | Chuẩn sạc tương thích |
| **Nắp lưng (Back Cover)** | Kính phẳng 4 cạnh, khung nhôm vuông vức | Kính cong nhẹ 4 cạnh, có khoét phím cảm ứng Quick Button | ❌ **Không dùng chung** (Khác ngàm và phím chụp ảnh) |
| **Cụm Camera sau** | 3 camera (Chính 50MP LYT-700 + 50MP JN5 + 50MP LYT-600) | 4 camera (Chính 50MP LYT-808 + 50MP JN5 + 50MP LYT-600 + 50MP Tele 6X IMX858) | ❌ **Không dùng chung** (Module camera hoàn toàn khác) |
| **Cáp sub & Bo sạc** | Cáp sạc CPH2651 riêng biệt | Cáp sạc CPH2659 riêng biệt | ❌ **Không dùng chung** |

> ⚠️ **Lưu ý Kỹ thuật viên (KTV):**
> * Find X8 (**CPH2651**) và Find X8 Pro (**CPH2659**) là 2 dòng máy hoàn toàn khác biệt.
> * Mã pin chuẩn của Find X8 là **BLPA41** (5630 mAh), Find X8 Pro là **BLPA45** (5910 mAh). Tuyệt đối không lắp chéo linh kiện giữa 2 model này.
>
> 🎯 **Gợi ý:** [[ACTION:catalog?search=CPH2651|🏷️ Linh kiện Find X8]] | [[ACTION:catalog?search=CPH2659|🏷️ Linh kiện Find X8 Pro]]`;
    }

    if (q.includes('tem') || q.includes('3x2') || q.includes('barcode') || q.includes('mã vạch')) {
      return `### 🏷️ Hướng dẫn Quy chuẩn In Tem 3x2 inch tại OPPO Service Center

1. **Khổ in tiêu chuẩn**: Kích thước **3 x 2 inch** (hoặc 76 x 50 mm), độ phân giải 203 DPI / 300 DPI.
2. **Loại mã vạch**:
   * **Code 128**: Dành cho mã linh kiện (Part Code) và số imei/phiếu.
   * **QR Code**: Dành cho tra cứu nhanh đường dẫn GCSM hoặc thông tin tổng hợp phiếu đặt chờ.
3. **In Đơn vs In Đôi (Split 2-in-1)**:
   * **In Đơn**: 1 tem lớn chứa đầy đủ Model, Tên LK, Mã LK, Vị trí kệ kho, Ngày nhập và Mã vạch.
   * **In Đôi (Split)**: Chia đôi 1 tem lớn thành 2 tem con (dán trực tiếp lên bao bì linh kiện nhỏ và dán lưu hồ sơ bảo hành).

> 🎯 **Gợi ý:** [[ACTION:labels?subTab=label-studio|🏷️ Mở Xưởng In Tem 3x2 Inch]]`;
    }

    if (q.includes('kịch bản') || q.includes('kich ban') || q.includes('gọi') || q.includes('goi') || q.includes('hẹn') || q.includes('cskh')) {
      return `### 📞 Kịch bản Gọi Điện Thông Báo Linh Kiện Đã Về Kho (OPPO Service Center)

* **Chào hỏi**: *"Dạ em chào Anh/Chị [Tên Khách Hàng], em là [Tên KTV/NV] gọi đến từ Trung tâm Bảo hành & Dịch vụ Khách hàng OPPO HCM4 ạ."*
* **Thông báo tin vui**: *"Em xin phép thông báo linh kiện [Tên Linh Kiện] cho máy [Model Máy] theo phiếu hẹn số **[Mã Phiếu]** của mình đã về đến trung tâm rồi ạ."*
* **Hẹn thời gian**: *"Dạ không biết hôm nay hoặc ngày mai Anh/Chị có tiện mang máy ghé trung tâm để bên em tiến hành thay thế và bàn giao máy cho mình không ạ? Thời gian thay thế dự kiến khoảng 45 - 60 phút ạ."*
* **Địa chỉ & Cảm ơn**: *"Địa chỉ trung tâm tại HCM4. Khi đến Anh/Chị chỉ cần báo mã phiếu [Mã Phiếu] là nhân viên sẽ hỗ trợ ngay ạ. Em cảm ơn Anh/Chị!"*

> 🎯 **Gợi ý:** [[ACTION:shortage?status=da_nhap_kho|📞 Mở danh sách phiếu Đã Nhập Kho cần gọi khách]]`;
    }

    // 4. Default overview response
    const summary = contextData?.thong_ke_tong_quan_he_thong;
    let fallback = `### 🛠️ Trung Tâm Trợ Lý AI - OPPO Label Studio & Shortage Hub\n\n`;
    fallback += `Tôi đã tiếp nhận yêu cầu của bạn: **"${query}"**.\n\n`;

    if (summary) {
      fallback += `**Tình hình tổng quan hệ thống hiện tại:**\n`;
      fallback += `* 📋 Tổng phiếu đặt chờ: **${summary.tong_phieu_dat_cho || 0}** phiếu (Đang chờ Bước 1: **${summary.phieu_b1_cho_xu_ly || 0}** phiếu, Đã về kho Bước 3: **${summary.phieu_b3_da_nhap_kho || 0}** phiếu)\n`;
      fallback += `* 📦 Danh mục linh kiện catalog: **${summary.tong_ma_catalog || 0}** mã linh kiện\n`;
      fallback += `* 👥 Kỹ thuật viên trực: **${summary.tong_ktv_truc || 0}** KTV\n\n`;
    }

    fallback += `**Bạn có thể hỏi tôi về:**\n`;
    fallback += `1. **Nhân viên & KTV:** *"KTV Đạt còn bao nhiêu linh kiện chờ chưa xử lý?"* hoặc *"Bảng thống kê toàn bộ KTV"*\n`;
    fallback += `2. **Mã linh kiện & Khách chờ:** *"Mã 621033000404 có bao nhiêu khách đang chờ đặt?"* hoặc *"Linh kiện màn hình A78"*\n`;
    fallback += `3. **Cảnh báo tiến độ:** *"Có bao nhiêu phiếu quá hạn 7 ngày?"* hoặc *"Phiếu SVD giữ máy"*\n`;
    fallback += `4. **Phần cứng chính hãng:** *"Tra cứu thông số pin và màn hình Find X8 Pro / Reno 13F / Reno 12"*\n\n`;
    fallback += `> 🎯 **Lối tắt nhanh:** [[ACTION:shortage?status=all|📋 Mở Đặt Chờ LK]] | [[ACTION:device_iot|📱 Mở Máy & IOT]] | [[ACTION:labels|🏷️ Mở In Tem]]`;

    return fallback;
  }

  // Serve production build if dist folder exists, otherwise use Vite middleware for development
  let distPath = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(path.join(distPath, 'index.html')) && fs.existsSync(path.join(process.cwd(), 'index.html'))) {
    distPath = process.cwd();
  }
  const indexHtmlPath = path.join(distPath, 'index.html');

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Vite middleware not available, falling back to static serving', e);
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        if (fs.existsSync(indexHtmlPath)) {
          res.sendFile(indexHtmlPath);
        } else {
          res.status(404).send('Application build not found.');
        }
      });
    }
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(404).send('Application build not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Proactive background backfill from Firestore to Cloud SQL on startup
    (async () => {
      if (!firestoreDb) return;
      try {
        console.log('Starting Firestore-to-SQL shortages backfill...');
        const snap = await getDocs(collection(firestoreDb, 'shortages'));
        let backfilledCount = 0;
        for (const d of snap.docs) {
          const item = d.data();
          if (item && item.id) {
            const hasCreatorInfo = item.createdBy || item.creatorTechnician || item.requestedDate;
            if (hasCreatorInfo) {
              const existingSql = await db.select().from(shortageBookings).where(eq(shortageBookings.id, item.id)).limit(1);
              if (existingSql.length > 0) {
                const sqlRow = existingSql[0];
                const sqlNeedsUpdate = !sqlRow.createdBy || !sqlRow.creatorTechnician || !sqlRow.requestedDate;
                if (sqlNeedsUpdate) {
                  await db.update(shortageBookings)
                    .set({
                      createdBy: sqlRow.createdBy || item.createdBy || null,
                      createdByUid: sqlRow.createdByUid || item.createdByUid || null,
                      creatorTechnician: sqlRow.creatorTechnician || item.creatorTechnician || null,
                      requestedDate: sqlRow.requestedDate || item.requestedDate || null,
                    })
                    .where(eq(shortageBookings.id, item.id));
                  backfilledCount++;
                }
              } else {
                await db.insert(shortageBookings).values({
                  id: item.id,
                  ticketNumber: item.ticketNumber || '',
                  partCode: item.partCode || '',
                  partName: item.partName || '',
                  model: item.model || '',
                  partsList: item.partsList || [],
                  bookingDate: item.bookingDate || '',
                  requestedDate: item.requestedDate || null,
                  customerName: item.customerName || '',
                  customerPhone: item.customerPhone || '',
                  status: item.status || 'da_tao_phieu',
                  location: item.location || '',
                  stockedInDate: item.stockedInDate || null,
                  calledCustomerDate: item.calledCustomerDate || null,
                  callSubStatus: item.callSubStatus || null,
                  appointmentDate: item.appointmentDate || null,
                  callNote: item.callNote || null,
                  callLogs: item.callLogs || [],
                  customerArrivedDate: item.customerArrivedDate || null,
                  technicianName: item.technicianName || '',
                  note: item.note || '',
                  cancelRequested: Boolean(item.cancelRequested),
                  cancelReason: item.cancelReason || null,
                  cancelRequestedBy: item.cancelRequestedBy || null,
                  cancelRequestedAt: item.cancelRequestedAt || null,
                  customerKeepsPart: Boolean(item.customerKeepsPart),
                  isCustomerCallHold: Boolean(item.isCustomerCallHold),
                  isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
                  closureReason: item.closureReason || null,
                  closureNote: item.closureNote || null,
                  closureBy: item.closureBy || null,
                  createdAt: item.createdAt || new Date().toISOString(),
                  updatedAt: item.updatedAt || new Date().toISOString(),
                  history: item.history || [],
                  createdBy: item.createdBy || null,
                  createdByUid: item.createdByUid || null,
                  creatorTechnician: item.creatorTechnician || null,
                }).onConflictDoNothing();
                backfilledCount++;
              }
            }
          }
        }
        console.log(`Firestore-to-SQL shortages backfill completed! Updated/Inserted ${backfilledCount} records.`);
      } catch (err) {
        console.error('Error during Firestore-to-SQL shortages backfill:', err);
      }
    })();
  });
}

startServer();
