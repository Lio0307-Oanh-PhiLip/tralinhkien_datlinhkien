import React, { useState, useEffect } from 'react';
import {
  LabelConfig,
  DEFAULT_LABEL_CONFIG,
  PRESET_DIMENSIONS,
  TemplateType,
  BarcodeFormat,
} from '../types/label';
import {
  X,
  Sliders,
  RotateCcw,
  QrCode,
  Barcode,
  Type,
  Printer,
  Layout,
  Check,
  Bold,
  Cloud,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import {
  getCurrentCloudUrl,
  setCustomCloudUrl,
  DEFAULT_CLOUD_SERVER_URL,
  apiFetch,
  testServerConnection,
} from '../services/firebaseShortageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LabelConfig;
  onChangeConfig: (newConfig: LabelConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
}) => {
  const [cloudUrlInput, setCloudUrlInput] = useState(() => getCurrentCloudUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [serverInfo, setServerInfo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCloudUrlInput(getCurrentCloudUrl());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = <K extends keyof LabelConfig>(key: K, value: LabelConfig[K]) => {
    onChangeConfig({ ...config, [key]: value });
  };

  const handleSaveCloudUrl = () => {
    setCustomCloudUrl(cloudUrlInput);
    handleTestConnection();
  };

  const handleResetCloudUrl = () => {
    setCloudUrlInput(DEFAULT_CLOUD_SERVER_URL);
    setCustomCloudUrl(DEFAULT_CLOUD_SERVER_URL);
    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setServerInfo(null);
    try {
      const result = await testServerConnection();
      if (result.ok) {
        setTestStatus('success');
        setServerInfo(`Đã kết nối thành công: ${result.provider} (${result.version || 'v2.5.2'})`);
      } else {
        setTestStatus('error');
        setServerInfo(result.details || 'Không thể kết nối máy chủ Cloud');
      }
    } catch (e: any) {
      setTestStatus('error');
      setServerInfo('Lỗi kết nối: ' + (e?.message || 'Lỗi mạng'));
    }
  };

  const handleSelectPresetDimension = (preset: typeof PRESET_DIMENSIONS[0]) => {
    onChangeConfig({
      ...config,
      widthInch: preset.widthInch,
      heightInch: preset.heightInch,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
    });
  };

  const handleResetToDefault = () => {
    onChangeConfig(DEFAULT_LABEL_CONFIG);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-neutral-900 text-base">
              Cấu Hình & Tùy Chỉnh Tem In
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Settings */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm text-neutral-800">
          {/* Section 1: Template & Dimension */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 text-xs uppercase tracking-wider text-blue-700">
              <Layout className="w-4 h-4" />
              <span>1. Mẫu Tem & Kích Thước In</span>
            </div>

            {/* Template Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'standard_3x2', title: 'Chuẩn 3x2 Linh Kiện (Gốc)', desc: 'QR góc trái, Model góc phải, Mã vạch ở giữa' },
                { id: 'price_warehouse', title: 'Kèm Giá & Vị Trí Kho', desc: 'Có thêm giá bán và mã ngăn kệ lưu kho' },
                { id: 'large_qr', title: 'Tem QR Trung Tâm', desc: 'Mã QR lớn bên trái quét nhanh từ xa' },
                { id: 'bold_barcode', title: 'Tem Mã Vạch Đậm', desc: 'Mã vạch nét dày tối ưu máy quét 1D' },
                { id: 'split_horizontal', title: 'Tem Cắt Đôi (2 trong 1)', desc: 'Chia đôi trên/dưới có đường cắt kéo' },
              ].map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleUpdate('template', tpl.id as TemplateType)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    config.template === tpl.id
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-neutral-900">{tpl.title}</span>
                    {config.template === tpl.id && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-snug">{tpl.desc}</p>
                </div>
              ))}
            </div>

            {/* Preset Dimensions */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Kích thước giấy in nhiệt:
              </label>
              <select
                value={`${config.widthInch}x${config.heightInch}`}
                onChange={(e) => {
                  const found = PRESET_DIMENSIONS.find(
                    (p) => `${p.widthInch}x${p.heightInch}` === e.target.value
                  );
                  if (found) handleSelectPresetDimension(found);
                }}
                className="w-full p-2 text-xs bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              >
                {PRESET_DIMENSIONS.map((preset) => (
                  <option
                    key={preset.name}
                    value={`${preset.widthInch}x${preset.heightInch}`}
                  >
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: QR Code Settings */}
          <div className="space-y-3 pt-3 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-neutral-900 text-xs uppercase tracking-wider text-blue-700">
                <QrCode className="w-4 h-4" />
                <span>2. Cấu Hình Mã QR</span>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={config.showQr}
                  onChange={(e) => handleUpdate('showQr', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Hiển thị QR Code</span>
              </label>
            </div>

            {config.showQr && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-blue-200 bg-neutral-50/50 p-2.5 rounded-r-lg">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Nội dung mã hóa trong QR:
                  </label>
                  <select
                    value={config.qrFormat}
                    onChange={(e) => handleUpdate('qrFormat', e.target.value as any)}
                    className="w-full p-1.5 text-xs bg-white border border-neutral-300 rounded"
                  >
                    <option value="code_only">Chỉ Mã SP (Khuyên dùng - Quét nhanh 100% trên mọi máy quét kho & GCSM)</option>
                    <option value="code_name_location">Mã SP + Tên linh kiện + Mã Kệ</option>
                    <option value="code_name">Mã SP + Tên linh kiện (Kèm Kệ nếu có)</option>
                    <option value="full_info">Đầy đủ: Mã SP + Tên + Mã Kệ + Ngày nhập (Dày nét QR)</option>
                    <option value="name_only">Chỉ Tên linh kiện</option>
                    <option value="json">Chuỗi JSON chi tiết (Code, Name, Model, Location, Date)</option>
                    <option value="custom_url">Link Web / Tra cứu theo mã</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Kích thước QR: {config.qrSizePx}px
                  </label>
                  <input
                    type="range"
                    min="48"
                    max="96"
                    step="2"
                    value={config.qrSizePx}
                    onChange={(e) => handleUpdate('qrSizePx', parseInt(e.target.value, 10))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Show Date under QR settings */}
                <div className="col-span-full border-t border-neutral-200/80 pt-2 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={config.showDate !== false}
                        onChange={(e) => handleUpdate('showDate', e.target.checked)}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span className="font-medium text-neutral-800">Hiển thị Ngày nhập kho dưới mã QR</span>
                    </label>
                  </div>

                  {config.showDate !== false && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Cỡ chữ ngày nhập dưới QR: {config.dateFontSizePt || 7.5}pt
                      </label>
                      <input
                        type="range"
                        min="6"
                        max="11"
                        step="0.5"
                        value={config.dateFontSizePt || 7.5}
                        onChange={(e) => handleUpdate('dateFontSizePt', parseFloat(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  )}
                </div>

                {config.qrFormat === 'custom_url' && (
                  <div className="col-span-full">
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Tiền tố URL (ví dụ: https://kho.vn/kiem-tra/):
                    </label>
                    <input
                      type="text"
                      value={config.qrCustomPrefix}
                      onChange={(e) => handleUpdate('qrCustomPrefix', e.target.value)}
                      placeholder="https://mywebsite.com/part?code="
                      className="w-full p-1.5 text-xs bg-white border border-neutral-300 rounded font-mono"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Barcode Settings */}
          <div className="space-y-3 pt-3 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-neutral-900 text-xs uppercase tracking-wider text-blue-700">
                <Barcode className="w-4 h-4" />
                <span>3. Cấu Hình Mã Vạch (Barcode 1D)</span>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={config.showBarcode}
                  onChange={(e) => handleUpdate('showBarcode', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Hiển thị Barcode</span>
              </label>
            </div>

            {config.showBarcode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-blue-200 bg-neutral-50/50 p-2.5 rounded-r-lg">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Định dạng mã vạch:
                  </label>
                  <select
                    value={config.barcodeFormat}
                    onChange={(e) => handleUpdate('barcodeFormat', e.target.value as BarcodeFormat)}
                    className="w-full p-1.5 text-xs bg-white border border-neutral-300 rounded"
                  >
                    <option value="CODE128">CODE128 (Mọi chữ & số, thông dụng nhất)</option>
                    <option value="CODE39">CODE39 (Chữ in hoa & số)</option>
                    <option value="EAN13">EAN13 (Mã vạch 13 số thương phẩm)</option>
                    <option value="UPC">UPC (Chuẩn Mỹ 12 số)</option>
                    <option value="ITF14">ITF14 (Thùng carton)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Độ giãn rộng & độ dày nét vạch: {config.barcodeWidth || 1.8}x
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="2.5"
                    step="0.05"
                    value={config.barcodeWidth || 1.8}
                    onChange={(e) => handleUpdate('barcodeWidth', parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Hẹp (0.8)</span>
                    <span>Giãn rộng (2.5)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Độ cao thanh: {config.barcodeHeight}px
                  </label>
                  <input
                    type="range"
                    min="7"
                    max="20"
                    value={config.barcodeHeight}
                    onChange={(e) => handleUpdate('barcodeHeight', parseInt(e.target.value, 10))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="flex items-center gap-4 col-span-full pt-1 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showBarcodeBorders}
                      onChange={(e) => handleUpdate('showBarcodeBorders', e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Kẻ đường viền trên & dưới barcode</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showBarcodeText}
                      onChange={(e) => handleUpdate('showBarcodeText', e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Hiện chữ số dưới vạch</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Typography & Location Settings */}
          <div className="space-y-3 pt-3 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-neutral-900 text-xs uppercase tracking-wider text-blue-700">
                <Type className="w-4 h-4" />
                <span>4. Cỡ Chữ & Mã Kệ (Vị Trí Kho)</span>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showLocation !== false}
                  onChange={(e) => handleUpdate('showLocation', e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Hiện Mã Kệ trên tem</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-neutral-50 p-2.5 rounded-lg">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-neutral-600 font-medium">Model ({config.modelFontSizePt}pt)</label>
                  <label className="flex items-center gap-1 cursor-pointer bg-white px-1.5 py-0.5 rounded border border-neutral-200 hover:border-blue-400 transition-colors" title="Bật/Tắt chữ đậm">
                    <Bold className="w-[10px] h-[10px] text-neutral-700" />
                    <input
                      type="checkbox"
                      checked={config.modelFontBold ?? true}
                      onChange={(e) => handleUpdate('modelFontBold', e.target.checked)}
                      className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500 border-neutral-300"
                    />
                  </label>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="9"
                  max="20"
                  value={config.modelFontSizePt}
                  onChange={(e) => handleUpdate('modelFontSizePt', parseFloat(e.target.value) || 13)}
                  className="w-full p-1 text-xs border border-neutral-300 rounded bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-neutral-600 font-medium">Mã kệ ({config.locationFontSizePt || 9.5}pt)</label>
                  <label className="flex items-center gap-1 cursor-pointer bg-white px-1.5 py-0.5 rounded border border-neutral-200 hover:border-blue-400 transition-colors" title="Bật/Tắt chữ đậm">
                    <Bold className="w-[10px] h-[10px] text-neutral-700" />
                    <input
                      type="checkbox"
                      checked={config.locationFontBold ?? true}
                      onChange={(e) => handleUpdate('locationFontBold', e.target.checked)}
                      className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500 border-neutral-300"
                    />
                  </label>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="7"
                  max="16"
                  value={config.locationFontSizePt || 9.5}
                  onChange={(e) => handleUpdate('locationFontSizePt', parseFloat(e.target.value) || 9.5)}
                  className="w-full p-1 text-xs border border-neutral-300 rounded bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-neutral-600 font-medium">Mã SP ({config.codeFontSizePt}pt)</label>
                  <label className="flex items-center gap-1 cursor-pointer bg-white px-1.5 py-0.5 rounded border border-neutral-200 hover:border-blue-400 transition-colors" title="Bật/Tắt chữ đậm">
                    <Bold className="w-[10px] h-[10px] text-neutral-700" />
                    <input
                      type="checkbox"
                      checked={config.codeFontBold ?? true}
                      onChange={(e) => handleUpdate('codeFontBold', e.target.checked)}
                      className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500 border-neutral-300"
                    />
                  </label>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="9"
                  max="20"
                  value={config.codeFontSizePt}
                  onChange={(e) => handleUpdate('codeFontSizePt', parseFloat(e.target.value) || 12)}
                  className="w-full p-1 text-xs border border-neutral-300 rounded bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-neutral-600 font-medium">Phân loại ({config.categoryFontSizePt}pt)</label>
                  <label className="flex items-center gap-1 cursor-pointer bg-white px-1.5 py-0.5 rounded border border-neutral-200 hover:border-blue-400 transition-colors" title="Bật/Tắt chữ đậm">
                    <Bold className="w-[10px] h-[10px] text-neutral-700" />
                    <input
                      type="checkbox"
                      checked={config.categoryFontBold ?? true}
                      onChange={(e) => handleUpdate('categoryFontBold', e.target.checked)}
                      className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500 border-neutral-300"
                    />
                  </label>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="8"
                  max="18"
                  value={config.categoryFontSizePt}
                  onChange={(e) => handleUpdate('categoryFontSizePt', parseFloat(e.target.value) || 8)}
                  className="w-full p-1 text-xs border border-neutral-300 rounded bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-neutral-600 font-medium">Tên LK ({config.nameFontSizePt}pt)</label>
                  <label className="flex items-center gap-1 cursor-pointer bg-white px-1.5 py-0.5 rounded border border-neutral-200 hover:border-blue-400 transition-colors" title="Bật/Tắt chữ đậm">
                    <Bold className="w-[10px] h-[10px] text-neutral-700" />
                    <input
                      type="checkbox"
                      checked={config.nameFontBold ?? true}
                      onChange={(e) => handleUpdate('nameFontBold', e.target.checked)}
                      className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500 border-neutral-300"
                    />
                  </label>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="8"
                  max="16"
                  value={config.nameFontSizePt}
                  onChange={(e) => handleUpdate('nameFontSizePt', parseFloat(e.target.value) || 10)}
                  className="w-full p-1 text-xs border border-neutral-300 rounded bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Calibration Offsets for Physical Printers */}
          <div className="space-y-3 pt-3 border-t border-neutral-200">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 text-xs uppercase tracking-wider text-blue-700">
              <Printer className="w-4 h-4" />
              <span>5. Căn Chỉnh Lệch Máy In & Xoay Khổ</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 p-2.5 rounded-lg">
              <div>
                <label className="block text-[11px] text-neutral-600 mb-1">
                  Lệch ngang X ({config.offsetXPx}px)
                </label>
                <input
                  type="number"
                  value={config.offsetXPx}
                  onChange={(e) => handleUpdate('offsetXPx', parseInt(e.target.value, 10) || 0)}
                  className="w-full p-1 text-xs border border-neutral-300 rounded bg-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-600 mb-1">
                  Lệch dọc Y ({config.offsetYPx}px)
                </label>
                <input
                  type="number"
                  value={config.offsetYPx}
                  onChange={(e) => handleUpdate('offsetYPx', parseInt(e.target.value, 10) || 0)}
                  className="w-full p-1 text-xs border border-neutral-300 rounded bg-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-600 mb-1">Xoay chiều in:</label>
                <select
                  value={config.rotation}
                  onChange={(e) => handleUpdate('rotation', parseInt(e.target.value, 10) as any)}
                  className="w-full p-1 text-xs border border-neutral-300 rounded bg-white"
                >
                  <option value={0}>0° (Ngang tiêu chuẩn)</option>
                  <option value={90}>90° (Dọc xoay phải)</option>
                  <option value={180}>180° (Đảo ngược)</option>
                  <option value={270}>270° (Dọc xoay trái)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 6: Quantity Multiplication Control */}
          <div className="space-y-3 pt-3 border-t border-neutral-200">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 text-xs uppercase tracking-wider text-blue-700">
              <Sliders className="w-4 h-4" />
              <span>6. Chế Độ Số Lượng Tem In</span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg space-y-2 border border-neutral-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.respectQuantity}
                  onChange={(e) => handleUpdate('respectQuantity', e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-xs text-neutral-900 block">
                    In nhân bản theo cột "Số tem" (x2, x3, xN tem mỗi dòng)
                  </span>
                  <span className="text-[11px] text-neutral-500 block leading-normal mt-0.5">
                    Khi tắt (mặc định): Mỗi dòng linh kiện chỉ in đúng 1 tem. Khi bật: Tem sẽ in lặp lại theo số lượng bạn quy định trong bảng.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 7: Cloud Server & Auto-Update Configuration */}
          <div className="space-y-3 pt-3 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-neutral-900 text-xs uppercase tracking-wider text-emerald-700">
                <Cloud className="w-4 h-4 text-emerald-600" />
                <span>7. Máy Chủ Đám Mây & Cập Nhật Tự Động (Cloud OTA)</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Zap className="w-3 h-3 text-emerald-600" />
                Tự Động Cập Nhật Mã Nguồn
              </span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg space-y-2.5 border border-neutral-200">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Địa chỉ Cloud Server (Mặc định hoặc Tùy chỉnh):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cloudUrlInput}
                    onChange={(e) => setCloudUrlInput(e.target.value)}
                    placeholder="https://ais-dev-...run.app"
                    className="flex-1 p-1.5 text-xs border border-neutral-300 rounded font-mono bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCloudUrl}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors"
                  >
                    Lưu & Thử
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCloudUrl}
                    className="px-2.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 bg-white hover:bg-neutral-100 rounded cursor-pointer transition-colors"
                    title="Khôi phục máy chủ gốc"
                  >
                    Mặc định
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing'}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 text-blue-600 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                    <span>{testStatus === 'testing' ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
                  </button>
                  {serverInfo && (
                    <span
                      className={`text-xs font-medium ${
                        testStatus === 'success' ? 'text-emerald-700 font-semibold' : 'text-rose-600'
                      }`}
                    >
                      {serverInfo}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.electronAPI?.reloadWindow) {
                      window.electronAPI.reloadWindow();
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded cursor-pointer"
                  title="Tải lại toàn bộ giao diện từ Cloud mới nhất"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Nạp lại Code Cloud (F5)</span>
                </button>
              </div>

              <p className="text-[11px] text-neutral-500 leading-normal border-t border-neutral-200/60 pt-1.5">
                💡 <strong>Cơ chế cập nhật tự động:</strong> Mỗi khi code được cập nhật trên Cloud, ứng dụng Desktop sẽ tự động nhận diện và nạp phiên bản mới nhất mà bạn không cần phải tải lại source code hay chạy lại lệnh đóng gói.
              </p>
            </div>
          </div>

          {/* Section 8: Sửa Lỗi Mất Dữ Liệu & Khôi Phục Phiếu */}
          <div className="space-y-3 pt-3 border-t border-neutral-200">
            <div className="flex items-center gap-2 font-semibold text-rose-800 text-xs uppercase tracking-wider">
              <Zap className="w-4 h-4 text-rose-600" />
              <span>8. Sửa Lỗi Mất Dữ Liệu & Khôi Phục Phiếu Bị Ẩn (Trình Duyệt)</span>
            </div>

            <div className="p-3 bg-rose-50/50 rounded-lg space-y-2.5 border border-dashed border-rose-300">
              <p className="text-xs text-neutral-700 leading-relaxed">
                Nếu bạn gặp hiện tượng mất hoặc ẩn danh sách phiếu (đặt chờ máy, IOT, linh kiện) sau khi bấm "Xóa Trắng" hoặc do lỗi cache trình duyệt, hãy sử dụng tính năng dưới đây để reset toàn bộ bộ lọc tạm và kéo lại tất cả phiếu còn tồn tại trên Cloud Đám Mây về thiết bị của bạn.
              </p>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('firestore_quota_exceeded');
                    localStorage.removeItem('label_studio_device_iot_clear_all_timestamp');
                    localStorage.removeItem('label_studio_device_iot_deleted_ids');
                    localStorage.removeItem('label_studio_shortages_clear_all_timestamp');
                    localStorage.removeItem('label_studio_shortage_deleted_ids');
                    localStorage.removeItem('label_studio_device_iot_bookings_v1');
                    localStorage.removeItem('label_studio_shortage_bookings_v1');
                    localStorage.removeItem('label_studio_device_iot_initialized');
                    localStorage.removeItem('label_studio_shortage_initialized');
                    alert('Đã khôi phục bộ nhớ bộ lọc! Hệ thống sẽ tự động tải lại trang để nạp lại đầy đủ dữ liệu từ Cloud Firestore.');
                    if (typeof window !== 'undefined' && window.electronAPI?.reloadWindow) {
                      window.electronAPI.reloadWindow();
                    } else {
                      window.location.reload();
                    }
                  } catch (e: any) {
                    alert('Lỗi: ' + (e?.message || 'Không thể xóa cache bộ nhớ tạm'));
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Khôi Phục Danh Sách & Đồng Bộ Lại Cloud</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 rounded border border-neutral-300 bg-white hover:bg-neutral-100 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục mặc định</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer transition-colors"
          >
            Áp dụng & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
