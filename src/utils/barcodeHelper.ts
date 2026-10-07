import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { BarcodeFormat, LabelConfig, LabelItem } from '../types/label';

// In-memory LRU-like cache for QR code Data URLs to prevent redundant Canvas allocations
const qrCache = new Map<string, string>();
const MAX_CACHE_SIZE = 3000;

export async function generateQrDataUrl(content: string, size = 150): Promise<string> {
  if (!content) return '';
  const cacheKey = `v6_png_${content}_${size}`;
  if (qrCache.has(cacheKey)) {
    return qrCache.get(cacheKey)!;
  }

  try {
    const dataUrl = await QRCode.toDataURL(content, {
      width: Math.max(512, size * 4),
      margin: 1,
      errorCorrectionLevel: 'L',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    if (qrCache.size >= MAX_CACHE_SIZE) {
      // Clear oldest 500 entries when cache gets large
      const keys = Array.from(qrCache.keys()).slice(0, 500);
      keys.forEach((k) => qrCache.delete(k));
    }
    qrCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error('QR code generation error:', err);
    return '';
  }
}

export function getCachedQrDataUrl(content: string, size = 150): string | null {
  const cacheKey = `v6_png_${content}_${size}`;
  return qrCache.get(cacheKey) || null;
}

export function formatQrContent(item: LabelItem, config: LabelConfig): string {
  const itemCode = (item.code || '').trim();
  let itemName = (item.name || '').trim();
  const itemModel = (item.model || '').trim();
  const itemCategory = (item.category || '').trim();
  const rawLoc = (item.location || '').trim();
  const cleanLoc = rawLoc.replace(/^(mã kệ|ma ke|kệ|ke|vị trí|kho)\s*:?\s*/i, '').trim();
  const itemLocation = cleanLoc || rawLoc;
  const itemDate = (item.date || '').trim();

  // Trim long name if included in QR to keep QR matrix size small & easily scannable
  if (itemName && itemName.length > 30) {
    itemName = itemName.substring(0, 30).trim();
  }

  switch (config.qrFormat) {
    case 'code_only':
      return itemCode || itemName;
    case 'name_only':
      return itemName || itemCode;
    case 'code_name_location':
    case 'code_name':
      // Mã SP + Tên linh kiện + Mã Kệ
      if (itemCode && itemName) {
        return itemLocation ? `${itemCode} - ${itemName} - ${itemLocation}` : `${itemCode} - ${itemName}`;
      }
      if (itemCode) {
        return itemLocation ? `${itemCode} - ${itemLocation}` : itemCode;
      }
      return itemLocation ? `${itemName} - ${itemLocation}` : itemName;
    case 'json':
      return JSON.stringify({
        code: itemCode,
        name: itemName,
        model: itemModel,
        category: itemCategory,
        location: itemLocation || undefined,
        date: itemDate || undefined,
        price: item.price || undefined,
      });
    case 'custom_url':
      if (config.qrCustomPrefix) {
        return `${config.qrCustomPrefix}${encodeURIComponent(itemCode)}`;
      }
      return itemCode ? `${itemCode} - ${itemName}${itemLocation ? ` - ${itemLocation}` : ''}` : itemName;
    case 'full_info':
    default: {
      const parts: string[] = [];
      if (itemCode) parts.push(`Mã SP: ${itemCode}`);
      if (itemName) parts.push(`Tên: ${itemName}`);
      if (itemModel) parts.push(`Model: ${itemModel}`);
      if (itemLocation) parts.push(`Mã Kệ: ${itemLocation}`);
      if (itemDate) parts.push(`Ngày nhập: ${itemDate}`);
      return parts.length > 0 ? parts.join('\n') : (itemCode && itemName ? `${itemCode} - ${itemName}` : itemCode || itemName);
    }
  }
}

export function renderBarcodeSvg(
  svgElement: SVGSVGElement | null,
  text: string,
  config: LabelConfig
) {
  if (!svgElement || !text) return;

  try {
    // Determine valid format
    let validFormat: string = config.barcodeFormat;
    let cleanText = text.trim();

    if (config.barcodeFormat === 'EAN13') {
      // EAN13 needs 12 or 13 digits
      if (!/^\d{12,13}$/.test(cleanText)) {
        validFormat = 'CODE128';
      }
    } else if (config.barcodeFormat === 'UPC') {
      if (!/^\d{11,12}$/.test(cleanText)) {
        validFormat = 'CODE128';
      }
    }

    const userWidth = config.barcodeWidth || 1.8;
    const codeLen = cleanText.length;
    let targetModuleWidth = userWidth;
    if (codeLen <= 8) {
      targetModuleWidth = Math.max(userWidth, 2.0);
    } else if (codeLen <= 12) {
      targetModuleWidth = Math.max(userWidth, 1.8);
    }
    const finalModuleWidth = Math.max(0.9, Math.min(targetModuleWidth, 2.6));

    JsBarcode(svgElement, cleanText, {
      format: validFormat,
      displayValue: config.showBarcodeText,
      fontSize: 10,
      textMargin: 0,
      height: Math.round((config.barcodeHeight || 9) * 1.333),
      width: finalModuleWidth,
      flat: true,
      margin: 2,
      background: 'transparent',
      lineColor: '#000000',
    });
  } catch (e) {
    // Fallback to CODE128 if specific format fails
    try {
      const userWidth = config.barcodeWidth || 1.8;
      const codeLen = text.trim().length;
      let targetModuleWidth = userWidth;
      if (codeLen <= 8) {
        targetModuleWidth = Math.max(userWidth, 2.0);
      } else if (codeLen <= 12) {
        targetModuleWidth = Math.max(userWidth, 1.8);
      }
      const finalModuleWidth = Math.max(0.9, Math.min(targetModuleWidth, 2.6));

      JsBarcode(svgElement, text.trim(), {
        format: 'CODE128',
        displayValue: false,
        height: Math.round((config.barcodeHeight || 9) * 1.333),
        width: finalModuleWidth,
        flat: true,
        margin: 2,
        background: 'transparent',
        lineColor: '#000000',
      });
    } catch (fallbackError) {
      console.warn('Could not render barcode for:', text, fallbackError);
    }
  }
}
