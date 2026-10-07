import * as XLSX from 'xlsx';
import { LabelItem } from '../types/label';
import { extractBarcodePartCode } from './barcodeExtractor';

export function getTodayFormattedDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseTsvData(text: string): LabelItem[] {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n');
  const items: LabelItem[] = [];
  const todayStr = getTodayFormattedDate();

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect separator (tab or comma or semicolon)
    let cols: string[];
    if (line.includes('\t')) {
      cols = line.split('\t');
    } else if (line.includes(';') && !line.includes(',')) {
      cols = line.split(';');
    } else if (line.includes(',')) {
      cols = line.split(',');
    } else {
      cols = [line];
    }

    const itemCode = cols[0] ? cols[0].trim() : '';
    const itemName = cols[1] ? cols[1].trim() : '';
    const modelName = cols[2] ? cols[2].trim() : '';
    const category = cols[3] ? cols[3].trim() : '';
    let quantity = 1;
    let price = '';
    let location = '';
    let date = todayStr;

    // Handle columns 4, 5, 6, 7
    if (cols[4]) {
      const val4 = cols[4].trim();
      const num4 = parseInt(val4, 10);
      
      if (cols[5]) {
        const val5 = cols[5].trim();
        const num5 = parseInt(val5, 10);
        
        if (!isNaN(num4) && /^\d+$/.test(val4) && isNaN(num5)) {
          quantity = Math.max(1, num4);
          location = val5;
        } else if (isNaN(num4) && !isNaN(num5) && /^\d+$/.test(val5)) {
          location = val4;
          quantity = Math.max(1, num5);
        } else {
          location = val4;
          if (val5.includes('đ') || val5.includes('$')) {
            price = val5;
          } else if (!isNaN(num5)) {
            quantity = Math.max(1, num5);
          } else if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(val5)) {
            date = val5;
          }
        }
      } else {
        location = val4;
      }
    }

    if (cols[6]) {
      const val6 = cols[6].trim();
      if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(val6)) {
        date = val6;
      } else if (!location) location = val6;
      else if (!price) price = val6;
    }

    if (cols[7]) {
      const val7 = cols[7].trim();
      if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(val7)) {
        date = val7;
      }
    }

    if (itemCode || itemName || modelName || category) {
      items.push({
        id: `item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
        code: itemCode,
        name: itemName,
        model: modelName,
        category: category,
        quantity: quantity,
        price: price,
        location: location,
        date: date,
        selected: true,
      });
    }
  });

  return items;
}

export function itemsToTsv(items: LabelItem[]): string {
  return items
    .map(item => {
      const parts = [
        item.code || '',
        item.name || '',
        item.model || '',
        item.category || '',
        item.location || '',
        (item.quantity || 1).toString(),
        item.date || '',
      ];
      return parts.join('\t');
    })
    .join('\n');
}

export async function readExcelFile(file: File): Promise<LabelItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        const items: LabelItem[] = [];
        let isFirstRowHeader = false;
        const todayStr = getTodayFormattedDate();

        // Check if first row is header
        if (jsonRows.length > 0) {
          const firstRow = jsonRows[0];
          const firstRowStr = firstRow.map(c => String(c || '').toLowerCase()).join(' ');
          if (
            firstRowStr.includes('mã') ||
            firstRowStr.includes('code') ||
            firstRowStr.includes('tên') ||
            firstRowStr.includes('name') ||
            firstRowStr.includes('model') ||
            firstRowStr.includes('loại')
          ) {
            isFirstRowHeader = true;
          }
        }

        const startIdx = isFirstRowHeader ? 1 : 0;

        for (let i = startIdx; i < jsonRows.length; i++) {
          const row = jsonRows[i];
          if (!row || row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === '')) {
            continue;
          }

          const code = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
          const name = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
          const model = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : '';
          const category = row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '';
          const qtyVal = row[4] !== undefined && row[4] !== null ? parseInt(String(row[4]).trim(), 10) : 1;
          const quantity = !isNaN(qtyVal) && qtyVal > 0 ? qtyVal : 1;
          const price = row[5] !== undefined && row[5] !== null ? String(row[5]).trim() : '';
          const location = row[6] !== undefined && row[6] !== null ? String(row[6]).trim() : '';
          const dateVal = row[7] !== undefined && row[7] !== null ? String(row[7]).trim() : todayStr;

          if (code || name || model || category) {
            items.push({
              id: `item-excel-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
              code,
              name,
              model,
              category,
              quantity,
              price,
              location,
              date: dateVal || todayStr,
              selected: true,
            });
          }
        }

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export function exportToExcel(items: LabelItem[], filename = 'danh_sach_tem_linh_kien.xlsx') {
  const data = [
    ['Mã SP (Code)', 'Tên linh kiện (Name)', 'Model máy (Model)', 'Phân loại (Category)', 'Số lượng tem (Quantity)', 'Giá (Price)', 'Vị trí kho (Location)', 'Ngày nhập kho (Date)'],
    ...items.map(item => [
      item.code,
      item.name,
      item.model,
      item.category,
      item.quantity,
      item.price || '',
      item.location || '',
      item.date || '',
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tem Linh Kiện');

  // Auto-width columns
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 35 },
    { wch: 20 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.writeFile(workbook, filename);
}

export function downloadSampleExcel() {
  const today = getTodayFormattedDate();
  const sampleItems: LabelItem[] = [
    { id: '1', code: '621033000403', name: 'Nắp Pin Find X8 Pro (Trắng)', model: 'Find X8 Pro', category: 'Vỏ', quantity: 1, price: '350.000đ', location: 'A-01', date: today, selected: true },
    { id: '2', code: '621033000404', name: 'Màn Hình Oppo Find X8', model: 'Find X8', category: 'Màn', quantity: 1, price: '1.850.000đ', location: 'B-04', date: today, selected: true },
    { id: '3', code: '621033000405', name: 'Pin Oppo Reno 11 Pro 5G', model: 'Reno 11 Pro', category: 'Pin', quantity: 1, price: '450.000đ', location: 'C-02', date: today, selected: true },
    { id: '4', code: '621033000406', name: 'Cụm Chân Sạc Type-C SuperVOOC', model: 'Reno 10 5G', category: 'Cáp sạc', quantity: 1, price: '220.000đ', location: 'A-05', date: today, selected: true },
    { id: '5', code: '621033000407', name: 'Camera Sau Chính 50MP Hasselblad', model: 'Find X7 Ultra', category: 'Camera', quantity: 1, price: '1.450.000đ', location: 'D-01', date: today, selected: true },
    { id: '6', code: '621033000408', name: 'Kính Ép Màn Hình AMOLED Cong', model: 'Reno 8T 5G', category: 'Kính', quantity: 1, price: '130.000đ', location: 'B-09', date: today, selected: true },
    { id: '7', code: '621033000409', name: 'Màn Hình Gập Trong LTPO OLED', model: 'Find N3', category: 'Màn', quantity: 1, price: '4.200.000đ', location: 'VIP-01', date: today, selected: true },
    { id: '8', code: '621033000410', name: 'Pin Zin 5000mAh Siêu Bền', model: 'OPPO A78 4G', category: 'Pin', quantity: 1, price: '280.000đ', location: 'C-06', date: today, selected: true },
  ];
  exportToExcel(sampleItems, 'Mau_Nhap_Tem_Linh_Kien_OPPO_3x2in.xlsx');
}

/**
 * Downloads a simple sample Excel file for the Custom Print List (Theo mã SP & số lượng & ngày nhập)
 */
export function downloadCustomPrintSampleExcel() {
  const today = getTodayFormattedDate();
  const data = [
    ['Mã SP (Cột bắt buộc)', 'Số lượng tem cần in', 'Mã kệ / Vị trí kho', 'Ngày nhập kho (DD/MM/YYYY)'],
    ['621035000389', 2, 'Kệ A-01', today],
    ['621035000395', 1, 'Kệ B-02', today],
    ['621035000401', 3, 'Kệ VIP', today],
    ['621035000410', 1, '', today],
    ['621035000418', 2, 'Kệ A-05', today],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DS Linh Kien Can In');

  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 25 },
  ];

  XLSX.writeFile(workbook, 'Mau_Danh_Sach_In_Theo_Ma.xlsx');
}

/**
 * Normalizes any date value (Excel serial number, Date instance, or string) to DD/MM/YYYY
 */
export function normalizeDateString(val: any): string {
  if (!val && val !== 0) return getTodayFormattedDate();
  if (val instanceof Date && !isNaN(val.getTime())) {
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (typeof val === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const day = String(parsed.d).padStart(2, '0');
        const month = String(parsed.m).padStart(2, '0');
        const year = parsed.y;
        return `${day}/${month}/${year}`;
      }
    } catch {
      // fallback
    }
  }
  const str = String(val).trim();
  if (!str) return getTodayFormattedDate();

  // Check DD/MM/YYYY or D/M/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}/${m}/${y}`;
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  return str;
}

/**
 * Exports Custom Print Queue items to Excel with dedicated "Ngày nhập kho" column
 */
export function exportCustomPrintToExcel(items: LabelItem[], filename = 'danh_sach_tem_can_in.xlsx') {
  const data = [
    ['Mã SP (Code)', 'Model máy (Model)', 'Tên linh kiện (Name)', 'Phân loại (Category)', 'Số lượng tem (Quantity)', 'Mã kệ (Location)', 'Ngày nhập kho (Date)', 'Ghi chú (Note)'],
    ...items.map((item) => [
      item.code || '',
      item.model || '',
      item.name || '',
      item.category || '',
      item.quantity || 1,
      item.location || '',
      item.date || getTodayFormattedDate(),
      item.note || '',
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DS Tem Cần In');

  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 35 },
    { wch: 15 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 25 },
  ];

  XLSX.writeFile(workbook, filename);
}

/**
 * Parses an Excel file for Custom Print List by matching Part Codes against Master Inventory
 * Maintains independent "Ngày nhập" for custom print queue items.
 */
export async function parseCustomPrintExcel(
  file: File,
  masterItems: LabelItem[]
): Promise<{ items: LabelItem[]; matchedCount: number; unmatchedCount: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (jsonRows.length === 0) {
          resolve({ items: [], matchedCount: 0, unmatchedCount: 0 });
          return;
        }

        // Build quick lookup map from master items by code (lowercase trimmed)
        const masterMap = new Map<string, LabelItem>();
        masterItems.forEach((item) => {
          if (item.code) {
            const cleanCode = item.code.trim().toLowerCase();
            if (!masterMap.has(cleanCode)) {
              masterMap.set(cleanCode, item);
            }
          }
        });

        // Determine if first row is header & detect column mapping
        let startIdx = 0;
        const firstRow = jsonRows[0] || [];
        const firstRowStr = firstRow.map((c) => String(c || '').toLowerCase()).join(' ');
        
        let colCode = -1;
        let colQty = -1;
        let colLocation = -1;
        let colDate = -1;
        let colName = -1;
        let colModel = -1;
        let colCategory = -1;
        let colPrice = -1;
        let colNote = -1;

        if (
          firstRowStr.includes('mã') ||
          firstRowStr.includes('code') ||
          firstRowStr.includes('part') ||
          firstRowStr.includes('stt') ||
          firstRowStr.includes('tên') ||
          firstRowStr.includes('sl') ||
          firstRowStr.includes('số lượng') ||
          firstRowStr.includes('ngày') ||
          firstRowStr.includes('date') ||
          firstRowStr.includes('kệ')
        ) {
          startIdx = 1;

          // Map column indices by header text
          firstRow.forEach((cellVal: any, colIdx: number) => {
            const h = String(cellVal || '').trim().toLowerCase();
            if (!h) return;
            if (colCode === -1 && (h.includes('mã') || h.includes('code') || h.includes('part'))) {
              colCode = colIdx;
            } else if (colDate === -1 && (h.includes('ngày') || h.includes('date') || h.includes('nhập') || h.includes('nhap'))) {
              colDate = colIdx;
            } else if (colLocation === -1 && (h.includes('kệ') || h.includes('ke') || h.includes('kho') || h.includes('vị trí') || h.includes('location'))) {
              colLocation = colIdx;
            } else if (colQty === -1 && (h.includes('sl') || h.includes('số lượng') || h.includes('so luong') || h.includes('quantity') || h.includes('qty'))) {
              colQty = colIdx;
            } else if (colModel === -1 && (h.includes('model') || h.includes('dòng máy'))) {
              colModel = colIdx;
            } else if (colName === -1 && (h.includes('tên') || h.includes('name') || h.includes('diễn giải') || h.includes('mô tả'))) {
              colName = colIdx;
            } else if (colCategory === -1 && (h.includes('loại') || h.includes('phân loại') || h.includes('category'))) {
              colCategory = colIdx;
            } else if (colPrice === -1 && (h.includes('giá') || h.includes('price'))) {
              colPrice = colIdx;
            } else if (colNote === -1 && (h.includes('ghi chú') || h.includes('note'))) {
              colNote = colIdx;
            }
          });
        }

        const items: LabelItem[] = [];
        let matchedCount = 0;
        let unmatchedCount = 0;
        const todayStr = getTodayFormattedDate();

        for (let i = startIdx; i < jsonRows.length; i++) {
          const row = jsonRows[i];
          if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || c === '')) {
            continue;
          }

          let rawCode = '';
          let rawQty = 1;
          let rawLocation = '';
          let rawNote = '';
          let rawName = '';
          let rawModel = '';
          let rawCategory = '';
          let rawPrice = '';
          let rawDate: any = null;

          if (colCode !== -1) {
            // Header-mapped extraction
            rawCode = row[colCode] !== undefined && row[colCode] !== null ? String(row[colCode]).trim() : '';
            if (colQty !== -1 && row[colQty] !== undefined && row[colQty] !== null) {
              const q = parseInt(String(row[colQty]).trim(), 10);
              if (!isNaN(q) && q > 0) rawQty = q;
            }
            if (colLocation !== -1 && row[colLocation] !== undefined && row[colLocation] !== null) {
              rawLocation = String(row[colLocation]).trim();
            }
            if (colDate !== -1 && row[colDate] !== undefined && row[colDate] !== null) {
              rawDate = row[colDate];
            }
            if (colName !== -1 && row[colName] !== undefined && row[colName] !== null) {
              rawName = String(row[colName]).trim();
            }
            if (colModel !== -1 && row[colModel] !== undefined && row[colModel] !== null) {
              rawModel = String(row[colModel]).trim();
            }
            if (colCategory !== -1 && row[colCategory] !== undefined && row[colCategory] !== null) {
              rawCategory = String(row[colCategory]).trim();
            }
            if (colPrice !== -1 && row[colPrice] !== undefined && row[colPrice] !== null) {
              rawPrice = String(row[colPrice]).trim();
            }
            if (colNote !== -1 && row[colNote] !== undefined && row[colNote] !== null) {
              rawNote = String(row[colNote]).trim();
            }
          } else {
            // Positional fallback
            if (row.length >= 2 && typeof row[0] === 'number' && row[0] < 10000 && String(row[1] || '').length >= 5) {
              // Probably col 0 is STT, col 1 is code
              rawCode = String(row[1] || '').trim();
              if (row[2] !== undefined && row[2] !== null) {
                const num2 = parseInt(String(row[2]).trim(), 10);
                if (!isNaN(num2) && num2 > 0) rawQty = num2;
                else rawName = String(row[2]).trim();
              }
              if (row[3] !== undefined && row[3] !== null) {
                rawLocation = String(row[3]).trim();
              }
              if (row[4] !== undefined && row[4] !== null) {
                rawDate = row[4];
              }
            } else {
              rawCode = String(row[0] || '').trim();

              if (row[1] !== undefined && row[1] !== null) {
                const str1 = String(row[1]).trim();
                const num1 = parseInt(str1, 10);
                if (!isNaN(num1) && /^\d+$/.test(str1) && num1 > 0 && num1 < 5000) {
                  rawQty = num1;
                } else {
                  rawName = str1;
                }
              }

              if (row[2] !== undefined && row[2] !== null) {
                const str2 = String(row[2]).trim();
                const num2 = parseInt(str2, 10);
                if (!isNaN(num2) && /^\d+$/.test(str2) && num2 > 0 && num2 < 5000 && rawQty === 1) {
                  rawQty = num2;
                } else if (!rawModel && isNaN(num2)) {
                  rawModel = str2;
                } else if (!rawLocation) {
                  rawLocation = str2;
                }
              }

              if (row[3] !== undefined && row[3] !== null) {
                const str3 = String(row[3]).trim();
                // Check if looks like date
                if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(str3)) {
                  rawDate = str3;
                } else if (!rawCategory) {
                  rawCategory = str3;
                }
              }

              if (row[4] !== undefined && row[4] !== null) {
                const str4 = String(row[4]).trim();
                const num4 = parseInt(str4, 10);
                if (!isNaN(num4) && num4 > 0) rawQty = num4;
                else if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(str4)) rawDate = str4;
              }

              if (row[5] !== undefined && row[5] !== null) {
                const str5 = String(row[5]).trim();
                if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(str5)) rawDate = str5;
                else if (!rawLocation) rawLocation = str5;
              }

              if (row[6] !== undefined && row[6] !== null) {
                const str6 = String(row[6]).trim();
                if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(str6)) rawDate = str6;
                else if (!rawLocation) rawLocation = str6;
              }

              if (row[7] !== undefined && row[7] !== null) {
                if (!rawDate) rawDate = row[7];
              }
            }
          }

          if (!rawCode && !rawName) continue;

          // Determine date: use Excel row date if given, else todayStr.
          // CRITICAL: Custom print queue import date is independent of master items catalog date!
          const itemDate = rawDate ? normalizeDateString(rawDate) : todayStr;

          // Clean barcode: only take code before hyphen (-) or underscore (_)
          const cleanCode = extractBarcodePartCode(rawCode, masterItems);
          const lookupKey = cleanCode.toLowerCase();
          const matchedMaster = masterMap.get(lookupKey) || masterMap.get(rawCode.toLowerCase());

          if (matchedMaster) {
            matchedCount++;
            items.push({
              id: `custom-print-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
              code: matchedMaster.code || cleanCode || rawCode,
              name: rawName || matchedMaster.name || '',
              model: rawModel || matchedMaster.model || '',
              category: rawCategory || matchedMaster.category || 'Linh Kiện',
              quantity: Math.max(1, rawQty),
              price: rawPrice || matchedMaster.price || '',
              location: rawLocation || matchedMaster.location || '',
              date: itemDate, // Independent date! Does NOT inherit matchedMaster.date
              note: rawNote || matchedMaster.note || '',
              selected: true,
            });
          } else {
            unmatchedCount++;
            items.push({
              id: `custom-print-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
              code: cleanCode || rawCode,
              name: rawName || `Linh kiện ${cleanCode || rawCode}`,
              model: rawModel || '',
              category: rawCategory || 'Linh Kiện',
              quantity: Math.max(1, rawQty),
              price: rawPrice || '',
              location: rawLocation || '',
              date: itemDate, // Independent date!
              note: rawNote || '',
              selected: true,
            });
          }
        }

        resolve({ items, matchedCount, unmatchedCount });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses raw text lines (pasted list of codes or code + quantity) and matches against Master Inventory
 */
export function parseCustomPrintText(
  text: string,
  masterItems: LabelItem[]
): { items: LabelItem[]; matchedCount: number; unmatchedCount: number } {
  if (!text || !text.trim()) {
    return { items: [], matchedCount: 0, unmatchedCount: 0 };
  }

  // Quick lookup map from master
  const masterMap = new Map<string, LabelItem>();
  masterItems.forEach((item) => {
    if (item.code) {
      const clean = item.code.trim().toLowerCase();
      if (!masterMap.has(clean)) {
        masterMap.set(clean, item);
      }
    }
  });

  const lines = text.split('\n');
  const items: LabelItem[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  const todayStr = getTodayFormattedDate();

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Split by tab, comma, semicolon, space, or colon
    let parts: string[] = [];
    if (trimmed.includes('\t')) parts = trimmed.split('\t');
    else if (trimmed.includes(',')) parts = trimmed.split(',');
    else if (trimmed.includes(';')) parts = trimmed.split(';');
    else if (trimmed.includes(' - ')) parts = trimmed.split(' - ');
    else if (trimmed.includes(':')) parts = trimmed.split(':');
    else if (/\s{2,}/.test(trimmed)) parts = trimmed.split(/\s{2,}/);
    else parts = [trimmed];

    const rawCode = parts[0] ? parts[0].trim() : '';
    let rawQty = 1;
    if (parts[1]) {
      const num = parseInt(parts[1].trim(), 10);
      if (!isNaN(num) && num > 0 && num < 1000) {
        rawQty = num;
      }
    }

    if (!rawCode) return;

    // Clean barcode: only take portion before hyphen (-) or underscore (_)
    const cleanCode = extractBarcodePartCode(rawCode, masterItems);
    const lookupKey = cleanCode.toLowerCase();
    const matchedMaster = masterMap.get(lookupKey) || masterMap.get(rawCode.toLowerCase());

    if (matchedMaster) {
      matchedCount++;
      items.push({
        id: `custom-pasted-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        code: matchedMaster.code || cleanCode || rawCode,
        name: matchedMaster.name || '',
        model: matchedMaster.model || '',
        category: matchedMaster.category || '',
        quantity: Math.max(1, rawQty),
        price: matchedMaster.price || '',
        location: matchedMaster.location || '',
        date: todayStr, // Independent from master items catalog date!
        note: matchedMaster.note || '',
        selected: true,
      });
    } else {
      unmatchedCount++;
      items.push({
        id: `custom-pasted-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        code: cleanCode || rawCode,
        name: `Linh kiện ${cleanCode || rawCode}`,
        model: '',
        category: 'Linh Kiện',
        quantity: Math.max(1, rawQty),
        price: '',
        location: '',
        date: todayStr,
        note: '',
        selected: true,
      });
    }
  });

  return { items, matchedCount, unmatchedCount };
}

export const SAMPLE_DATASETS = {
  oppoFind: `621033000403\tNắp Pin Find X8 Pro (Trắng)\tFind X8 Pro\tVỏ\tA-01
621033000404\tMàn Hình Oppo Find X8\tFind X8\tMàn\tB-04
621033000409\tMàn Hình Gập Trong LTPO OLED\tFind N3\tMàn\tVIP-01
621033000411\tPin Đôi Dung Lượng Cao\tFind N3 Flip\tPin\tC-02
621033000407\tCamera Sau 50MP Hasselblad\tFind X7 Ultra\tCamera\tD-01
621033000412\tCáp Nối Bo Gập Cơ Khí\tFind N2 Flip\tCáp\tA-05`,

  oppoReno: `621033000405\tPin Oppo Reno 11 Pro 5G\tReno 11 Pro\tPin\tC-02
621033000406\tCụm Chân Sạc SuperVOOC\tReno 10 5G\tSạc\tA-03
621033000408\tKính Ép Màn Hình Cong\tReno 8T 5G\tKính\tB-09
621033000413\tMàn Hình AMOLED 120Hz\tReno 11 5G\tMàn\tB-02
621033000414\tNắp Lưng Da Cam Sunset\tReno 7 4G\tVỏ\tA-08
621033000415\tCụm Loa Kép Stereo Ngoài\tReno 8 Pro\tLoa\tD-03`,

  oppoA: `621033000410\tPin Zin 5000mAh\tOPPO A78 4G\tPin\tC-06
621033000416\tMàn Hình IPS LCD 90Hz\tOPPO A58\tMàn\tB-07
621033000417\tCáp Phím Nguồn & Vân Tay\tOPPO A38\tCáp\tA-02
621033000418\tKhung Sườn Viền Kim Loại\tOPPO A98 5G\tKhung\tD-05
621033000419\tCụm Chân Sạc Type-C Zin\tOPPO A18\tSạc\tA-04
621033000420\tKính Camera Sau Chống Trầy\tOPPO A77s\tKính\tB-05`,

  oppoFull: `621033000403\tNắp Pin Find X8 Pro (Trắng)\tFind X8 Pro\tVỏ\tA-01
621033000404\tMàn Hình Oppo Find X8\tFind X8\tMàn\tB-04
621033000405\tPin Oppo Reno 11 Pro\tReno 11 Pro\tPin\tC-02
621033000406\tCụm Chân Sạc SuperVOOC\tReno 10 5G\tSạc\tA-03
621033000407\tCamera Sau 50MP Hasselblad\tFind X7 Ultra\tCamera\tD-01
621033000408\tKính Ép Màn Hình Cong\tReno 8T 5G\tKính\tB-09
621033000409\tMàn Hình Gập Trong LTPO\tFind N3\tMàn\tVIP-01
621033000410\tPin Zin 5000mAh\tOPPO A78\tPin\tC-06`,
};
