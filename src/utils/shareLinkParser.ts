import { LabelItem } from '../types/label';
import * as XLSX from 'xlsx';

// Keywords and patterns that identify CSS, JS, HTML or UI framework junk
const JUNK_KEYWORDS = [
  'VAR--',
  '--GEM-',
  '--BARD-',
  '--GDS-',
  'TYPOGRAPHY',
  'PLACEHOLDER',
  'EMPHASIZED',
  'CONTAINER',
  'BORDER',
  'PADDING',
  'MARGIN',
  'DISPLAY',
  'COLOR',
  'STYLE',
  'SCRIPT',
  'CLASS',
  'HOVER',
  'FOCUS',
  'ACTIVE',
  'SELECT',
  'INPUT',
  'TEXTAREA',
  'BUTTON',
  'TRANSITION',
  'ANIMATION',
  'FLEX',
  'GRID',
  'ROOT',
  'HTML',
  'BODY',
  'HEAD',
  'TABLE',
  'TBODY',
  'THEAD',
  'TD',
  'TH',
  'TR',
  'DIV',
  'SPAN',
  'SVG',
  'PATH',
  'NULL',
  'UNDEFINED',
  'OBJECT',
  'ARRAY',
  'FUNCTION',
  'CONST',
  'RETURN',
  'IMPORT',
  'EXPORT',
  'HTTP',
  'HTTPS',
  'URL',
  'DATE(',
  'EXCEL',
  'ACTION',
  'REPORT UNSAFE',
  'TRY GEMINI',
];

// Header label keywords
const HEADER_KEYWORDS = [
  'CODE',
  'MÃ SP',
  'MA SP',
  'MÃ LK',
  'PRODUCT NAME',
  'TÊN LINH KIỆN',
  'TEN LINH KIEN',
  'MODEL',
  'TYPE',
  'LOẠI',
  'DÒNG MÁY',
  'DONG MAY',
  'NGÀY NHẬP',
  'NGAY NHAP',
  'VỊ TRÍ',
  'VI TRI',
  'STT',
  'HIỂN THỊ',
  'XUẤT EXCEL',
  'TAI BACKUP',
  'NAP BACKUP',
  'CHECK TỒN',
  'INFO',
  'ONLINE',
];

/**
 * Validates if a string looks like a legitimate product / part code.
 */
export function isValidProductCode(rawCode: string): boolean {
  if (!rawCode) return false;
  const clean = rawCode.trim().toUpperCase();

  // Length check: part codes are typically 3-20 chars
  if (clean.length < 3 || clean.length > 25) return false;

  // Must not contain consecutive hyphens or start with hyphens
  if (clean.startsWith('-') || clean.includes('--')) return false;

  // Must not contain CSS variable indicators
  if (clean.includes('VAR-') || clean.includes('--GEM') || clean.includes('--BARD')) return false;

  // Must not contain junk keywords
  for (const junk of JUNK_KEYWORDS) {
    if (clean.includes(junk)) return false;
  }

  // Must not be an exact header keyword
  for (const header of HEADER_KEYWORDS) {
    if (clean === header) return false;
  }

  // Must contain allowed characters (A-Z, 0-9, hyphens, underscores)
  if (!/^[A-Z0-9\-_]+$/i.test(clean)) return false;

  // Must have at least one digit OR be a recognized model/series prefix
  const hasDigit = /\d/.test(clean);
  const isKnownPrefix = /^(OPPO|CPH|PBAM|PBEM|PACM|PBDM|R1|F11|A5|A3|A9|A7|A1k|A15|A16|A31|A53|A54|A55|A57|A73|A74|A76|A77|A78|A92|A93|A94|A95|A96|RENO|FIND|IOT)/i.test(clean);

  return hasDigit || isKnownPrefix;
}

/**
 * Clean cell text from StockSync Hub action buttons (Info, Check tồn, copy icons)
 * Example input: "612122000195 Info Check tồn" -> "612122000195"
 */
export function extractCleanCode(rawCell: string): string {
  if (!rawCell) return '';
  let str = rawCell.trim();

  // Remove common button labels found in StockSync Hub
  str = str.replace(/\b(info|check\s*tồn|check|tồn|copy)\b/gi, '').trim();

  // Extract primary code matching 5-16 alphanumeric or numeric characters
  const match = str.match(/([0-9]{6,14}|[A-Z0-9\-_]{4,18})/i);
  if (match) {
    const candidate = match[1].toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
    if (isValidProductCode(candidate)) {
      return candidate;
    }
  }

  const cleanDirect = str.toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
  return isValidProductCode(cleanDirect) ? cleanDirect : '';
}

/**
 * Parses raw text or copied table from StockSync Hub / Gemini into LabelItems
 */
export function parseContentToLabelItems(rawContent: string): {
  items: LabelItem[];
  junkFilteredCount: number;
  detectedTabs: string[];
} {
  const items: LabelItem[] = [];
  const seenCodes = new Set<string>();
  const detectedTabsSet = new Set<string>();
  let junkFilteredCount = 0;

  if (!rawContent || !rawContent.trim()) {
    return { items, junkFilteredCount, detectedTabs: [] };
  }

  let textToParse = rawContent;

  // Step 1: Pre-clean HTML if present (remove scripts, styles, SVGs, CSS variables)
  if (
    textToParse.includes('<html') ||
    textToParse.includes('<body') ||
    textToParse.includes('<table') ||
    textToParse.includes('<div') ||
    textToParse.includes('var(--')
  ) {
    textToParse = textToParse
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/var\(--[\w-]+\)/gi, '')
      .replace(/--[\w-]{5,}/gi, '');

    if (textToParse.includes('<tr')) {
      textToParse = textToParse
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, '\t')
        .replace(/<\/th>/gi, '\t')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');
    } else {
      textToParse = textToParse.replace(/<[^>]+>/g, ' ');
    }
  }

  // Step 2: Check for embedded JSON array (e.g. from Tải Backup)
  const jsonMatch =
    textToParse.match(/(\[\s*\{\s*"[a-zA-Z0-9_]+"[\s\S]*?\}\s*\])/i) ||
    textToParse.match(/(\[\s*\[\s*"[A-Z0-9]{4,}"[\s\S]*?\]\s*\])/i);

  if (jsonMatch) {
    try {
      const parsedJson = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsedJson) && parsedJson.length > 0) {
        parsedJson.forEach((row, idx) => {
          let code = '';
          let name = '';
          let model = '';
          let category = 'OTHERS';
          let location = '-';

          if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
            code = extractCleanCode(String(row.code || row.mã || row.code_sp || row.CODE || ''));
            name = String(row.product_name || row.productName || row.name || row.tên || row['PRODUCT NAME'] || '').trim();
            model = String(row.model || row.MODEL || '').trim();
            category = String(row.type || row.TYPE || row.category || row.loại || 'OTHERS').trim();
            location = String(row.dong_may || row.dòng_máy || row['DÒNG MÁY'] || row.location || '-').trim();
          } else if (Array.isArray(row)) {
            code = extractCleanCode(String(row[0] || ''));
            name = String(row[1] || '').trim();
            model = String(row[2] || '').trim();
            category = String(row[3] || 'OTHERS').trim();
            location = String(row[4] || '-').trim();
          }

          if (code && isValidProductCode(code)) {
            if (!seenCodes.has(code)) {
              seenCodes.add(code);
              if (location && location !== '-' && location.length < 20) {
                detectedTabsSet.add(location);
              }
              items.push({
                id: `item_sync_json_${code.toLowerCase()}_${idx}`,
                code,
                model: model || 'OPPO',
                name: name || `Linh kiện ${code}`,
                category: category || 'OTHERS',
                quantity: 1,
                price: '',
                location: location || '-',
                date: new Date().toLocaleDateString('vi-VN'),
                note: 'Đồng bộ từ StockSync Hub',
                selected: true,
              });
            }
          }
        });

        if (items.length > 0) {
          return { items, junkFilteredCount, detectedTabs: Array.from(detectedTabsSet) };
        }
      }
    } catch (e) {
      // Continue to line-by-line parsing if JSON parse failed
    }
  }

  // Step 3: Line-by-line parsing
  const lines = textToParse.split('\n');

  let colMap = {
    code: 0,
    name: 1,
    model: 2,
    type: 3,
    dongMay: 4,
  };
  let headerFound = false;

  lines.forEach((line, lineIdx) => {
    let cleanLine = line.trim();
    if (!cleanLine) return;

    // Detect and discard CSS variables or CSS block junk
    if (
      cleanLine.startsWith('--') ||
      cleanLine.includes('var(--') ||
      cleanLine.includes('font-wght') ||
      cleanLine.includes('typography') ||
      cleanLine.includes('container') ||
      cleanLine.includes('{') ||
      cleanLine.includes('}')
    ) {
      junkFilteredCount++;
      return;
    }

    const upperLine = cleanLine.toUpperCase();

    // Check if line is a table header
    if (
      upperLine.includes('CODE') ||
      upperLine.includes('PRODUCT NAME') ||
      upperLine.includes('MÃ SP') ||
      upperLine.includes('TÊN LINH KIỆN')
    ) {
      const parts = cleanLine.includes('\t')
        ? cleanLine.split('\t')
        : cleanLine.includes('|')
        ? cleanLine.split('|').filter((p, i, a) => (i > 0 && i < a.length - 1) || p.trim().length > 0)
        : cleanLine.split(',');

      parts.forEach((p, idx) => {
        const h = p.trim().toUpperCase();
        if (h.includes('CODE') || h.includes('MÃ')) colMap.code = idx;
        else if (h.includes('PRODUCT NAME') || h.includes('TÊN')) colMap.name = idx;
        else if (h.includes('MODEL')) colMap.model = idx;
        else if (h.includes('TYPE') || h.includes('LOẠI')) colMap.type = idx;
        else if (h.includes('DÒNG MÁY') || h.includes('VỊ TRÍ') || h.includes('LOCATION')) colMap.dongMay = idx;
      });
      headerFound = true;
      return;
    }

    if (upperLine.includes('---') || upperLine.includes('HIỂN THỊ:') || upperLine.includes('XUẤT EXCEL')) {
      return;
    }

    let rawCode = '';
    let name = '';
    let model = '';
    let category = 'OTHERS';
    let location = '-';

    let parts: string[] = [];

    // Format 1: Tab separated (standard browser copy from HTML table)
    if (cleanLine.includes('\t')) {
      parts = cleanLine.split('\t').map((p) => p.trim());
    }
    // Format 2: Markdown table pipe separated
    else if (cleanLine.includes('|')) {
      parts = cleanLine
        .split('|')
        .map((p) => p.trim())
        .filter((p, i, a) => (i > 0 && i < a.length - 1) || p.length > 0);
    }
    // Format 3: CSV comma separated
    else if (cleanLine.includes(',')) {
      parts = cleanLine.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    }
    // Format 4: Multi-space separation (at least 2 consecutive spaces)
    else if (/\s{2,}/.test(cleanLine)) {
      parts = cleanLine.split(/\s{2,}/).map((p) => p.trim());
    }

    if (parts.length >= 2) {
      if (headerFound) {
        rawCode = parts[colMap.code] || parts[0] || '';
        name = parts[colMap.name] || '';
        model = parts[colMap.model] || '';
        category = parts[colMap.type] || 'OTHERS';
        location = parts[colMap.dongMay] || '-';
      } else {
        // StockSync Hub structure: [CODE (with buttons), PRODUCT NAME, MODEL, TYPE, DÒNG MÁY, NGÀY NHẬP]
        rawCode = parts[0] || '';

        // If parts[1] is descriptive ("Phím âm lượng ngoài A3x") and parts[2] is model ("A3x")
        if (parts.length >= 3 && parts[1].length > parts[2].length && parts[2].length <= 20) {
          name = parts[1];
          model = parts[2];
          if (parts.length >= 4) category = parts[3];
          if (parts.length >= 5) location = parts[4];
        } else {
          // Standard OPPO: [Mã SP, Model, Tên linh kiện, Loại, Vị trí]
          model = parts[1] || '';
          name = parts[2] || parts[1] || '';
          if (parts.length >= 4) category = parts[3];
          if (parts.length >= 5) location = parts[4];
        }
      }
    } else {
      // Regex single line pattern e.g. "612122000195 Phím âm lượng ngoài A3x"
      const match = cleanLine.match(/^([A-Z0-9\-_]{4,18})\s+(.+)/i);
      if (match) {
        rawCode = match[1];
        name = match[2];
      }
    }

    const code = extractCleanCode(rawCode);
    model = model.trim();
    name = name.trim();
    category = category.trim().toUpperCase();
    location = location.trim();

    if (code && isValidProductCode(code)) {
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        if (location && location !== '-' && location.length < 20) {
          detectedTabsSet.add(location);
        }
        items.push({
          id: `item_sync_${code.toLowerCase()}_${Date.now()}_${lineIdx}`,
          code,
          model: model || 'OPPO',
          name: name || `Linh kiện ${code}`,
          category: category || 'OTHERS',
          quantity: 1,
          price: '',
          location: location || '-',
          date: new Date().toLocaleDateString('vi-VN'),
          note: 'Đồng bộ từ StockSync Hub',
          selected: true,
        });
      }
    } else {
      junkFilteredCount++;
    }
  });

  return {
    items,
    junkFilteredCount,
    detectedTabs: Array.from(detectedTabsSet),
  };
}

/**
 * Parses an Excel / CSV File buffer or ArrayBuffer (e.g. from "Xuất Excel" in StockSync Hub)
 */
export function parseExcelFileToLabelItems(data: ArrayBuffer): {
  items: LabelItem[];
  detectedTabs: string[];
} {
  const workbook = XLSX.read(data, { type: 'array' });
  const items: LabelItem[] = [];
  const seenCodes = new Set<string>();
  const detectedTabsSet = new Set<string>();

  // Process all sheets in the Excel workbook
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    // Convert sheet to JSON array of arrays
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    if (!rows || rows.length === 0) return;

    let colMap = {
      code: 0,
      name: 1,
      model: 2,
      type: 3,
      dongMay: 4,
    };
    let headerRowIdx = -1;

    // Detect header row
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const joined = row.map((c) => String(c).toUpperCase()).join(' ');

      if (joined.includes('CODE') || joined.includes('MÃ') || joined.includes('PRODUCT NAME') || joined.includes('TÊN LINH KIỆN')) {
        headerRowIdx = i;
        row.forEach((col, idx) => {
          const val = String(col).trim().toUpperCase();
          if (val.includes('CODE') || val.includes('MÃ')) colMap.code = idx;
          else if (val.includes('PRODUCT NAME') || val.includes('TÊN')) colMap.name = idx;
          else if (val.includes('MODEL')) colMap.model = idx;
          else if (val.includes('TYPE') || val.includes('LOẠI')) colMap.type = idx;
          else if (val.includes('DÒNG MÁY') || val.includes('VỊ TRÍ') || val.includes('LOCATION')) colMap.dongMay = idx;
        });
        break;
      }
    }

    const startIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawCode = String(row[colMap.code] || row[0] || '');
      const code = extractCleanCode(rawCode);
      if (!code || !isValidProductCode(code)) continue;

      let name = String(row[colMap.name] || row[1] || '').trim();
      let model = String(row[colMap.model] || row[2] || '').trim();
      let category = String(row[colMap.type] || row[3] || 'OTHERS').trim().toUpperCase();
      let location = String(row[colMap.dongMay] || row[4] || '-').trim();

      // If sheetName represents a series like "Dòng A", "Find X"
      if ((!location || location === '-') && sheetName && !sheetName.startsWith('Sheet')) {
        location = sheetName;
      }

      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        if (location && location !== '-' && location.length < 20) {
          detectedTabsSet.add(location);
        }
        items.push({
          id: `item_excel_${code.toLowerCase()}_${Date.now()}_${i}`,
          code,
          model: model || 'OPPO',
          name: name || `Linh kiện ${code}`,
          category: category || 'OTHERS',
          quantity: 1,
          price: '',
          location: location || '-',
          date: new Date().toLocaleDateString('vi-VN'),
          note: 'Nạp từ Excel StockSync Hub',
          selected: true,
        });
      }
    }
  });

  return {
    items,
    detectedTabs: Array.from(detectedTabsSet),
  };
}
