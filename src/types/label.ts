export interface LabelItem {
  id: string;
  code: string;       // Mã SP (Cột A)
  name: string;       // Tên linh kiện (Cột B)
  model: string;      // Model máy (Cột C)
  category: string;   // Phân loại (Cột D)
  quantity: number;   // Số lượng tem cần in
  price?: string;     // Giá tiền (nếu có)
  location?: string;  // Vị trí kệ / kho (nếu có)
  date?: string;      // Ngày nhập / bảo hành
  note?: string;      // Ghi chú
  selected?: boolean; // Chọn in theo nhóm
}

export type TemplateType = 'standard_3x2' | 'price_warehouse' | 'large_qr' | 'bold_barcode' | 'compact_clean' | 'split_horizontal';

export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'UPC' | 'ITF14';

export interface LabelConfig {
  template: TemplateType;
  widthInch: number;      // default 3
  heightInch: number;     // default 2
  widthMm: number;        // default 76.2
  heightMm: number;       // default 50.8
  unit: 'inch' | 'mm';
  
  // QR Config
  showQr: boolean;
  qrSizePx: number;       // default 58
  qrFormat: 'full_info' | 'code_name_location' | 'code_name' | 'code_only' | 'name_only' | 'json' | 'custom_url';
  qrCustomPrefix: string;
  showDate: boolean;      // Hiển thị ngày nhập kho dưới QR
  dateFontSizePt: number; // default 7.5pt
  
  // Barcode Config
  showBarcode: boolean;
  barcodeFormat: BarcodeFormat;
  barcodeHeight: number;  // px in preview / pt in print
  barcodeWidth: number;   // bar width scale (slender: 0.85 - 1.0)
  showBarcodeText: boolean;
  showBarcodeBorders: boolean;
  
  // Typography & Layout
  fontFamily: string;
  modelFontSizePt: number;
  modelFontBold: boolean;
  codeFontSizePt: number;
  codeFontBold: boolean;
  categoryFontSizePt: number;
  categoryFontBold: boolean;
  nameFontSizePt: number;
  nameFontBold: boolean;
  nameMaxLines: number;
  showLocation: boolean;  // Hiển thị mã kệ / vị trí kho
  locationFontSizePt: number;
  locationFontBold: boolean;
  
  // Printer Calibration
  offsetXPx: number;
  offsetYPx: number;
  rotation: 0 | 90 | 180 | 270;
  
  // Visuals
  previewDashedBorder: boolean;
  showCutLine: boolean;
  respectQuantity: boolean; // In theo số lượng quy định của từng mục
}

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  template: 'standard_3x2',
  widthInch: 3,
  heightInch: 2,
  widthMm: 76.2,
  heightMm: 50.8,
  unit: 'inch',
  
  showQr: true,
  qrSizePx: 56,
  qrFormat: 'code_only',
  qrCustomPrefix: '',
  showDate: true,
  dateFontSizePt: 7.5,
  
  showBarcode: true,
  barcodeFormat: 'CODE128',
  barcodeHeight: 9,
  barcodeWidth: 1.8,
  showBarcodeText: false,
  showBarcodeBorders: false,
  
  fontFamily: 'Arial, sans-serif',
  modelFontSizePt: 13,
  modelFontBold: true,
  codeFontSizePt: 13,
  codeFontBold: true,
  categoryFontSizePt: 13,
  categoryFontBold: true,
  nameFontSizePt: 11,
  nameFontBold: true,
  nameMaxLines: 1,
  showLocation: true,
  locationFontSizePt: 9.5,
  locationFontBold: true,
  
  offsetXPx: 0,
  offsetYPx: 0,
  rotation: 0,
  
  previewDashedBorder: true,
  showCutLine: false,
  respectQuantity: true,
};

export const PRESET_DIMENSIONS = [
  { name: '3" x 2" (76.2 x 50.8 mm) - Chuẩn tem linh kiện', widthInch: 3, heightInch: 2, widthMm: 76.2, heightMm: 50.8 },
  { name: '50mm x 30mm - Tem cuộn nhỏ', widthInch: 1.97, heightInch: 1.18, widthMm: 50, heightMm: 30 },
  { name: '75mm x 50mm - Tem nhiệt tiêu chuẩn', widthInch: 2.95, heightInch: 1.97, widthMm: 75, heightMm: 50 },
  { name: '100mm x 50mm - Tem linh kiện lớn', widthInch: 3.94, heightInch: 1.97, widthMm: 100, heightMm: 50 },
  { name: '100mm x 75mm - Tem kiện hàng / kho', widthInch: 3.94, heightInch: 2.95, widthMm: 100, heightMm: 75 },
  { name: '4" x 6" (101.6 x 152.4 mm) - Vận đơn / Thùng hàng', widthInch: 4, heightInch: 6, widthMm: 101.6, heightMm: 152.4 },
];
