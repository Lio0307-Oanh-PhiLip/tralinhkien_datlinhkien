import { LabelConfig, LabelItem } from '../types/label';
import { formatQrContent } from './barcodeHelper';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

/**
 * Generates an SVG string for a barcode synchronously using JsBarcode
 */
export function generateBarcodeSvgString(code: string, config: LabelConfig): string {
  if (!code) return '';
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    let validFormat = config.barcodeFormat;
    const cleanText = code.trim();
    if (config.barcodeFormat === 'EAN13' && !/^\d{12,13}$/.test(cleanText)) {
      validFormat = 'CODE128';
    } else if (config.barcodeFormat === 'UPC' && !/^\d{11,12}$/.test(cleanText)) {
      validFormat = 'CODE128';
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

    JsBarcode(svg, cleanText, {
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

    return svg.outerHTML;
  } catch (e) {
    return '';
  }
}

/**
 * Creates a standalone printable HTML string for all labels
 */
export async function generatePrintableHtml(
  items: LabelItem[],
  config: LabelConfig,
  autoTriggerPrint = false,
  showFloatingButton = false
): Promise<string> {
  const multipliedItems: LabelItem[] = [];
  items.forEach((item) => {
    const count = config.respectQuantity ? Math.max(1, item.quantity || 1) : 1;
    for (let i = 0; i < count; i++) {
      multipliedItems.push(item);
    }
  });

  const widthCss = config.unit === 'inch' ? `${config.widthInch}in` : `${config.widthMm}mm`;
  const heightCss = config.unit === 'inch' ? `${config.heightInch}in` : `${config.heightMm}mm`;

  // Pre-generate QR data URLs with caching to prevent UI freeze on duplicated items
  const qrCache = new Map<string, Promise<string>>();
  const getQrDataUrl = (item: LabelItem): Promise<string> => {
    const content = formatQrContent(item, config);
    if (!config.showQr || !content) return Promise.resolve('');
    const cacheKey = `${content}_${config.qrSizePx}`;
    if (qrCache.has(cacheKey)) {
      return qrCache.get(cacheKey)!;
    }
    const p = QRCode.toDataURL(content, {
      width: Math.max(512, config.qrSizePx * 4),
      margin: 1,
      errorCorrectionLevel: 'L',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    }).catch(() => '');
    qrCache.set(cacheKey, p);
    return p;
  };

  const qrPromises = multipliedItems.map(getQrDataUrl);
  const qrDataUrls = await Promise.all(qrPromises);

  // Barcode SVG cache
  const barcodeCache = new Map<string, string>();
  const getBarcodeSvg = (code: string): string => {
    if (!config.showBarcode || !code) return '';
    if (barcodeCache.has(code)) return barcodeCache.get(code)!;
    const svg = generateBarcodeSvgString(code, config);
    barcodeCache.set(code, svg);
    return svg;
  };

  let labelsHtml = '';

  if (config.template === 'split_horizontal') {
    for (let i = 0; i < multipliedItems.length; i += 2) {
      const topItem = multipliedItems[i];
      const bottomItem = multipliedItems[i + 1];

      const qrSrcTop = qrDataUrls[i];
      const barcodeSvgTop = getBarcodeSvg(topItem.code);

      const qrSrcBottom = bottomItem ? qrDataUrls[i + 1] : '';
      const barcodeSvgBottom = bottomItem ? getBarcodeSvg(bottomItem.code) : '';

      const renderHalfHtml = (halfItem: LabelItem | undefined, qrSrc: string, barcodeSvg: string) => {
        if (!halfItem) {
          return `<div class="split-half empty-half" style="background-color: #fff; min-height: 0;"></div>`;
        }
        return `
          <div class="split-half">
            <div class="split-inner">
              <!-- Top Header -->
              <div class="split-top-header">
                 <span class="split-model">${halfItem.model || '-'}</span>
                 <div class="split-top-right">
                    ${config.showDate !== false && halfItem.date ? `<span class="split-date">${halfItem.date}</span>` : ''}
                    <span class="split-category">${halfItem.category || ''}</span>
                    ${halfItem.location && config.showLocation !== false ? `<span class="split-location">${(halfItem.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')}</span>` : ''}
                 </div>
              </div>
              
              <!-- Middle Content -->
              <div class="split-middle">
                ${config.showQr && qrSrc ? `
                  <div class="split-qr-box">
                    <img src="${qrSrc}" alt="QR" class="split-qr-img" />
                  </div>
                ` : ''}
                <div class="split-barcode-col">
                  <span class="split-code">${halfItem.code || ''}</span>
                  ${config.showBarcode && barcodeSvg ? `
                    <div class="split-barcode-box ${config.showBarcodeBorders ? 'with-borders' : ''}">
                      ${barcodeSvg}
                    </div>
                  ` : ''}
                </div>
              </div>
              
              <!-- Bottom Content -->
              <div class="split-name">${halfItem.name || ''}</div>
            </div>
          </div>
        `;
      };

      labelsHtml += `
        <div class="label-page split-container">
          ${renderHalfHtml(topItem, qrSrcTop, barcodeSvgTop)}
          <div class="split-divider"></div>
          ${renderHalfHtml(bottomItem, qrSrcBottom, barcodeSvgBottom)}
        </div>
      `;
    }
  } else {
    labelsHtml = multipliedItems
      .map((item, idx) => {
        const qrSrc = qrDataUrls[idx];
        const barcodeSvg = getBarcodeSvg(item.code);

        // Default (standard_3x2) - also covers price_warehouse and others for now if not explicitly added
        return `
        <div class="label-page">
          <div class="label-card">
            <!-- Top Row -->
          <div class="top-row">
            <div class="qr-col">
              <div class="qr-box">
                ${
                  config.showQr && qrSrc
                    ? `<img src="${qrSrc}" alt="QR" style="width: ${config.qrSizePx}px; height: ${config.qrSizePx}px;" />`
                    : `<div class="qr-placeholder">QR</div>`
                }
              </div>
              ${
                config.showDate !== false && item.date
                  ? `<div class="import-date-text" style="font-size: ${config.dateFontSizePt || 7.5}pt;">${item.date}</div>`
                  : ''
              }
            </div>
            <div class="model-box">
              <div class="model-text" style="font-size: ${config.modelFontSizePt}pt; font-family: ${config.fontFamily};">
                ${item.model || ''}
              </div>
              ${
                item.location && config.showLocation !== false
                  ? `<div class="location-badge" style="font-size: ${config.locationFontSizePt || 9.5}pt;">
                      <span class="location-val">${(item.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')}</span>
                    </div>`
                  : ''
              }
            </div>
          </div>

          <!-- Bottom Row -->
          <div class="bottom-row">
            <div class="code-cat-row">
              <span class="code-text" style="font-size: ${config.codeFontSizePt}pt;">${item.code || ''}</span>
              <span class="cat-text" style="font-size: ${config.categoryFontSizePt}pt;">${item.category || ''}</span>
            </div>

            ${
              config.showBarcode && barcodeSvg
                ? `
              <div class="barcode-container ${config.showBarcodeBorders ? 'with-borders' : ''}">
                ${barcodeSvg}
              </div>
            `
                : ''
            }

            <div class="name-text" style="font-size: ${config.nameFontSizePt}pt;">
              ${item.name || ''}
            </div>
          </div>
        </div>
      </div>
    `;
      })
      .join('\n');
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HCM4 tra linh kiện in tem & đặt chờ linh kiện (${multipliedItems.length} tem)</title>
  <style>
    @page {
      size: ${widthCss} ${heightCss};
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: Arial, "Helvetica Neue", sans-serif;
    }
    .label-page {
      width: ${widthCss};
      height: ${heightCss};
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .label-card {
      width: ${widthCss};
      height: ${heightCss};
      padding: 4pt 10pt 2pt 10pt;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
    }
    .top-row {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8pt;
      margin-top: 2pt;
      box-sizing: border-box;
      padding: 0 2pt;
    }
    .qr-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      flex-shrink: 0;
    }
    .qr-box {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-box img, img[alt*="QR"] {
      image-rendering: pixelated;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    .import-date-text {
      text-align: center;
      font-family: monospace, Arial, sans-serif;
      font-weight: 700;
      color: #000;
      margin-top: 3.5pt;
      letter-spacing: -0.2pt;
      line-height: 1;
    }
    .qr-placeholder {
      border: 1px dashed #ccc;
      width: ${config.qrSizePx}px;
      height: ${config.qrSizePx}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      color: #999;
    }
    .model-box {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      padding-right: 2pt;
    }
    .model-text {
      font-weight: ${config.modelFontBold ?? true ? 800 : 500};
      text-align: right;
      line-height: 1.15;
      word-break: break-word;
    }
    .location-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-top: 2pt;
      padding: 0.5pt 4pt;
      border: 0.8pt solid #333;
      border-radius: 2px;
      background: #f4f4f5;
      font-weight: ${config.locationFontBold ?? true ? 900 : 600};
      letter-spacing: 0.2pt;
    }
    .location-val {
      font-weight: ${config.locationFontBold ?? true ? 900 : 600};
      color: #000;
    }
    .bottom-row {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 3pt;
    }
    .code-cat-row {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1pt;
    }
    .code-text {
      font-weight: ${config.codeFontBold ?? true ? 700 : 500};
      letter-spacing: 0.5pt;
      padding-left: 2pt;
    }
    .cat-text {
      font-weight: ${config.categoryFontBold ?? true ? 700 : 500};
      padding-right: 4pt;
    }
    .barcode-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2pt 0;
      margin: 0.5pt 0;
      box-sizing: border-box;
      min-height: 14pt;
    }
    .barcode-container.with-borders {
      border-top: 0.8pt solid #000;
      border-bottom: 0.8pt solid #000;
    }
    .barcode-container svg {
      max-width: 100%;
      height: ${config.barcodeHeight || 10}px;
      display: block;
      shape-rendering: crispEdges;
      margin: 0 auto;
    }
    .name-text {
      width: 100%;
      text-align: center;
      font-weight: ${config.nameFontBold ?? true ? 800 : 500};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0;
    }
    .floating-print-btn {
      position: fixed;
      top: 15px;
      right: 15px;
      z-index: 9999;
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: bold;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
    }
    .floating-print-btn:hover {
      background: #1d4ed8;
    }
    @media print {
      .floating-print-btn {
        display: none !important;
      }
    }

    /* SPLIT HORIZONTAL TEMPLATE STYLES */
    .split-container {
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
      padding: 0;
    }
    .split-half {
      flex: 1;
      width: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      padding: 0;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
    }
    .split-inner {
      width: 100%;
      height: 100%;
      max-height: 0.76in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 2pt 4pt 2.5pt 4pt;
      box-sizing: border-box;
    }
    .split-divider {
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      border-top: 1pt dashed #000;
      opacity: 0.8;
      z-index: 10;
    }
    .split-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      line-height: 1;
      margin-bottom: 1pt;
      flex-shrink: 0;
    }
    .split-model {
      font-weight: ${config.modelFontBold ?? true ? 800 : 500};
      font-size: ${Math.min(config.modelFontSizePt, 9.5)}pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 3pt;
      line-height: 1;
    }
    .split-top-right {
      display: flex;
      align-items: center;
      gap: 2pt;
      flex-shrink: 0;
    }
    .split-category {
      font-weight: ${config.categoryFontBold ?? true ? 700 : 500};
      font-size: ${Math.min(config.categoryFontSizePt, 8.5)}pt;
      line-height: 1;
    }
    .split-date {
      font-family: monospace, Arial, sans-serif;
      font-weight: 700;
      font-size: ${Math.min(config.dateFontSizePt, 6.5)}pt;
      line-height: 1;
    }
    .split-location {
      font-size: ${Math.min(config.locationFontSizePt, 6.5)}pt;
      font-weight: ${config.locationFontBold ?? true ? 900 : 600};
      background: #f4f4f5;
      border: 0.5pt solid #333;
      padding: 0.2pt 1.5pt;
      border-radius: 2px;
      line-height: 1;
    }
    .split-middle {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 0;
      flex: 1;
      padding: 0;
      margin: auto 0;
    }
    .split-qr-box {
      flex-shrink: 0;
      margin-right: 3pt;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .split-qr-img {
      width: ${Math.max(38, Math.min(45, Math.round(config.qrSizePx * 0.75)))}px;
      height: ${Math.max(38, Math.min(45, Math.round(config.qrSizePx * 0.75)))}px;
      max-height: 45px;
      display: block;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    .split-barcode-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-width: 0;
    }
    .split-code {
      font-weight: ${config.codeFontBold ?? true ? 700 : 500};
      font-size: ${Math.min(config.codeFontSizePt, 12.0)}pt;
      line-height: 1.0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      text-align: center;
      letter-spacing: 0.2pt;
    }
    .split-barcode-box {
      margin-top: 0.5pt;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0.5pt 0;
      box-sizing: border-box;
    }
    .split-barcode-box.with-borders {
      border-top: 0.8pt solid #000;
      border-bottom: 0.8pt solid #000;
      margin-top: 0.5pt;
      margin-bottom: 0.5pt;
    }
    .split-barcode-box svg {
      max-width: 100%;
      height: ${Math.min(config.barcodeHeight || 9, 8)}pt;
      display: block;
      shape-rendering: crispEdges;
      margin: 0 auto;
    }
    .split-name {
      font-size: ${Math.min(config.nameFontSizePt, 10.0)}pt;
      font-weight: ${config.nameFontBold ?? true ? 800 : 500};
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      text-align: center;
      margin-top: 1pt;
      margin-bottom: 0;
      padding-bottom: 1pt;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  ${showFloatingButton ? '<button class="floating-print-btn" onclick="window.print()">🖨️ Bấm In Tem (Ctrl+P)</button>' : ''}
  ${labelsHtml}
  ${
    autoTriggerPrint
      ? `<script>
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    });
  </script>`
      : ''
  }
</body>
</html>`;
}

/**
 * Opens a dedicated top-level print window and triggers the system print dialog immediately
 */
export async function openPrintWindow(
  items: LabelItem[],
  config: LabelConfig,
  title = 'In Tem Linh Kiện'
): Promise<boolean> {
  if (!items || items.length === 0) return false;

  // Open window synchronously on user click to prevent popup blockers
  let printWin: Window | null = null;
  try {
    printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 50px 20px; color: #333; background: #f9fafb; }
            .loader { display: inline-block; width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px; }
            @keyframes spin { to { transform: rotate(360deg); } }
            h2 { margin: 0 0 8px 0; font-size: 18px; color: #111; }
            p { margin: 0; font-size: 13px; color: #666; }
          </style>
        </head>
        <body>
          <div class="loader"></div>
          <h2>Đang chuẩn bị ${items.length} bản in tem...</h2>
          <p>Hộp thoại in của máy in sẽ tự động xuất hiện ngay.</p>
        </body>
        </html>
      `);
    }
  } catch (e) {
    console.warn('Could not open blank window synchronously:', e);
  }

  try {
    const html = await generatePrintableHtml(items, config, true, true);

    if (printWin && !printWin.closed) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();

      // Trigger focus and print
      setTimeout(() => {
        try {
          printWin?.focus();
          printWin?.print();
        } catch (err) {
          console.warn('Error invoking printWin.print():', err);
        }
      }, 350);

      return true;
    }

    // Fallback if window.open was blocked
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener,noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Lỗi khi chuẩn bị trang in:', err);
    return false;
  }
}

/**
 * Downloads a self-contained HTML file for offline printing
 */
export async function downloadPrintableHtmlFile(items: LabelItem[], config: LabelConfig) {
  const html = await generatePrintableHtml(items, config, false, true);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Danh_Sach_In_Tem_${config.widthInch}x${config.heightInch}in.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
