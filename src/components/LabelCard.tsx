import React, { useEffect, useRef, useState, memo } from 'react';
import { LabelConfig, LabelItem } from '../types/label';
import { formatQrContent, generateQrDataUrl, getCachedQrDataUrl, renderBarcodeSvg } from '../utils/barcodeHelper';
import { extractBarcodePartCode } from '../utils/barcodeExtractor';
import { Copy, Printer, Check, Edit2, Trash2, Eye, Boxes, ExternalLink } from 'lucide-react';

const GCSM_STOCK_URL = 'https://gcsm-sg.oppoit.com/part/stocks/stock-query';

interface LabelCardProps {
  item: LabelItem;
  itemBottom?: LabelItem;
  config: LabelConfig;
  index: number;
  isPrintMode?: boolean;
  isFocused?: boolean;
  onSelectFocus?: (id: string) => void;
  onPrintSingle?: (item: LabelItem) => void;
  onEdit?: (item: LabelItem) => void;
  onUpdateItem?: (updated: LabelItem) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  showStockCheckButton?: boolean;
}

const LabelCardInner: React.FC<LabelCardProps> = ({
  item,
  itemBottom,
  config,
  index,
  isPrintMode = false,
  isFocused = false,
  onSelectFocus,
  onPrintSingle,
  onEdit,
  onUpdateItem,
  onDelete,
  isAdmin = false,
  showStockCheckButton = true,
}) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const barcodeRef2 = useRef<SVGSVGElement | null>(null);

  const cleanCode = extractBarcodePartCode(item.code) || item.code || '';
  const cleanItem = item.code !== cleanCode ? { ...item, code: cleanCode } : item;

  const cleanCodeBottom = itemBottom ? (extractBarcodePartCode(itemBottom.code) || itemBottom.code || '') : '';
  const cleanItemBottom = itemBottom
    ? (itemBottom.code !== cleanCodeBottom ? { ...itemBottom, code: cleanCodeBottom } : itemBottom)
    : undefined;
  
  const qrContent = formatQrContent(cleanItem, config);
  const [qrSrc, setQrSrc] = useState<string>(() => {
    return config.showQr && qrContent ? (getCachedQrDataUrl(qrContent, config.qrSizePx * 2) || '') : '';
  });

  const qrContentBottom = cleanItemBottom ? formatQrContent(cleanItemBottom, config) : '';
  const [qrSrcBottom, setQrSrcBottom] = useState<string>(() => {
    return config.showQr && qrContentBottom ? (getCachedQrDataUrl(qrContentBottom, config.qrSizePx * 2) || '') : '';
  });

  const [copied, setCopied] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [tempLocation, setTempLocation] = useState(
    (item.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')
  );

  useEffect(() => {
    setTempLocation((item.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, ''));
  }, [item.location]);

  // Generate QR code Data URL with caching (Top)
  useEffect(() => {
    let isMounted = true;
    if (config.showQr && qrContent) {
      const cached = getCachedQrDataUrl(qrContent, config.qrSizePx * 2);
      if (cached) {
        setQrSrc(cached);
        return;
      }
      generateQrDataUrl(qrContent, config.qrSizePx * 2).then((dataUrl) => {
        if (isMounted) {
          setQrSrc(dataUrl);
        }
      });
    } else {
      setQrSrc('');
    }
    return () => {
      isMounted = false;
    };
  }, [qrContent, config.showQr, config.qrSizePx]);

  // Generate QR code Data URL with caching (Bottom)
  useEffect(() => {
    let isMounted = true;
    if (config.showQr && qrContentBottom) {
      const cached = getCachedQrDataUrl(qrContentBottom, config.qrSizePx * 2);
      if (cached) {
        setQrSrcBottom(cached);
        return;
      }
      generateQrDataUrl(qrContentBottom, config.qrSizePx * 2).then((dataUrl) => {
        if (isMounted) {
          setQrSrcBottom(dataUrl);
        }
      });
    } else {
      setQrSrcBottom('');
    }
    return () => {
      isMounted = false;
    };
  }, [qrContentBottom, config.showQr, config.qrSizePx]);

  // Render Barcode SVG
  useEffect(() => {
    if (config.showBarcode) {
      if (cleanCode && barcodeRef.current) {
        renderBarcodeSvg(barcodeRef.current, cleanCode, config);
      }
      if (cleanCodeBottom && barcodeRef2.current) {
        renderBarcodeSvg(barcodeRef2.current, cleanCodeBottom, config);
      } else if (!cleanItemBottom && cleanCode && barcodeRef2.current) {
        // Fallback: render same code if itemBottom is null but we are duplicating
        renderBarcodeSvg(barcodeRef2.current, cleanCode, config);
      }
    }
  }, [cleanCode, cleanCodeBottom, cleanItemBottom, config.showBarcode, config.barcodeFormat, config.barcodeHeight, config.barcodeWidth, config.showBarcodeText, config.template]);

  const handleCopyCode = () => {
    if (cleanCode) {
      navigator.clipboard.writeText(cleanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Dimensions
  const widthStyle = config.unit === 'inch' ? `${config.widthInch}in` : `${config.widthMm}mm`;
  const heightStyle = config.unit === 'inch' ? `${config.heightInch}in` : `${config.heightMm}mm`;

  // Render template layouts
  const renderTemplateContent = () => {
    switch (config.template) {
      case 'split_horizontal': {
        const splitQrSize = Math.max(38, Math.min(45, Math.round(config.qrSizePx * 0.75))); // Balanced 38-45px QR code for easier scanning without overlap

        const renderHalf = (isTop: boolean, halfItem: LabelItem | undefined, qrSrcData: string) => {
          if (!halfItem) {
             return <div className="flex-1 min-h-0 w-full flex flex-col px-[4pt] py-[2pt] box-border overflow-hidden bg-white" />;
          }
          return (
            <div className="flex-1 min-h-0 w-full flex flex-col justify-end items-center box-border relative overflow-hidden">
              <div className="w-full flex flex-col justify-between px-[4pt] pt-[2pt] pb-[2.5pt]" style={{ maxHeight: '0.76in', height: '100%' }}>
                {/* Top Header */}
                <div className="flex justify-between items-center w-full leading-none shrink-0 mb-[1pt]">
                   <span className="truncate pr-1 font-extrabold" style={{ fontSize: `${Math.min(config.modelFontSizePt, 9.5)}pt` }}>{halfItem.model || '-'}</span>
                   <div className="flex items-center gap-[2pt] shrink-0">
                      {config.showDate !== false && halfItem.date && (
                        <span className="font-mono font-bold leading-none" style={{ fontSize: `${Math.min(config.dateFontSizePt, 6.5)}pt` }}>{halfItem.date}</span>
                      )}
                      <span className="leading-none" style={{ fontSize: `${Math.min(config.categoryFontSizePt, 8.5)}pt`, fontWeight: config.categoryFontBold ?? true ? 700 : 500 }}>{halfItem.category || ''}</span>
                      {halfItem.location && config.showLocation !== false && (
                        <span className="bg-neutral-100 border border-neutral-400 px-[1.5pt] py-[0.2pt] rounded-xs shrink-0 leading-none" style={{ fontSize: `${Math.min(config.locationFontSizePt, 6.5)}pt`, fontWeight: config.locationFontBold ?? true ? 900 : 600 }}>
                          {(halfItem.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')}
                        </span>
                      )}
                   </div>
                </div>
                
                {/* Middle Content */}
                <div className="flex items-center w-full min-h-0 my-auto">
                  {config.showQr && qrSrcData && (
                    <div className="shrink-0 mr-[3pt] flex items-center justify-center">
                      <img src={qrSrcData} alt="QR" className="block object-contain" style={{ width: `${splitQrSize}px`, height: `${splitQrSize}px`, maxHeight: '45px', imageRendering: 'pixelated' }} />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col justify-center items-center min-w-0">
                    <span className="leading-[1.0] truncate text-center w-full tracking-[0.2pt]" style={{ fontSize: `${Math.min(config.codeFontSizePt, 12.0)}pt`, fontWeight: config.codeFontBold ?? true ? 700 : 500 }}>{halfItem.code}</span>
                    {config.showBarcode && halfItem.code && (
                      <div className={`mt-[0.5pt] w-full flex justify-center py-[0.5pt] ${config.showBarcodeBorders ? 'border-t-[0.8pt] border-b-[0.8pt] border-black my-[0.5pt]' : ''}`}>
                        <svg
                          ref={isTop ? barcodeRef : barcodeRef2}
                          className="max-w-full block"
                          style={{
                            shapeRendering: 'crispEdges',
                            height: `${Math.min(config.barcodeHeight || 9, 8)}pt`,
                            margin: '0 auto',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Content */}
                <div className="leading-[1.2] truncate w-full text-center shrink-0 mt-[1pt] pb-[1pt] mb-0" style={{ fontSize: `${Math.min(config.nameFontSizePt, 10.0)}pt`, fontWeight: config.nameFontBold ?? true ? 800 : 500 }}>{halfItem.name}</div>
              </div>
            </div>
          );
        };

        return (
          <div className="flex flex-col h-full w-full select-none text-black relative bg-white">
            {renderHalf(true, item, qrSrc)}
            <div className="absolute top-1/2 left-0 w-full border-t-[1pt] border-dashed border-black opacity-80 z-10" />
            {renderHalf(false, itemBottom || item, itemBottom ? qrSrcBottom : qrSrc)}
          </div>
        );
      }

      case 'price_warehouse':
        return (
          <div className="flex flex-col justify-between h-full w-full select-none text-black">
            {/* Top Row: QR + Date + Model + Price */}
            <div className="w-full flex items-center justify-between gap-[8pt] mt-[2pt] px-[2pt]">
              <div className="flex flex-col items-center justify-start shrink-0">
                {config.showQr && qrSrc ? (
                  <div className="w-[56px] h-[56px] flex items-center justify-start">
                    <img src={qrSrc} alt="QR" className="w-[56px] h-[56px] block object-contain" style={{ imageRendering: 'pixelated' }} />
                  </div>
                ) : (
                  <div className="w-[56px] h-[56px] border border-dashed border-neutral-300 flex items-center justify-center text-[8pt] text-neutral-400">
                    QR
                  </div>
                )}
                {config.showDate !== false && (
                  <div
                    className="text-center font-mono font-bold text-black mt-[3.5pt] tracking-tight leading-none"
                    style={{ fontSize: `${config.dateFontSizePt || 7.5}pt` }}
                  >
                    {item.date || ''}
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col items-end pr-[2pt]">
                <div
                  className="text-right leading-tight break-words w-full"
                  style={{ fontSize: `${config.modelFontSizePt}pt`, fontFamily: config.fontFamily, fontWeight: config.modelFontBold ?? true ? 800 : 500 }}
                >
                  {item.model || 'Model'}
                </div>
                {item.price && (
                  <div className="text-right text-[11pt] font-black text-black mt-[1pt]">
                    {item.price}
                  </div>
                )}
                {item.location && config.showLocation !== false && (
                  <div className="text-right text-[9pt] text-neutral-800 bg-neutral-100 border border-neutral-400 px-1.5 py-[0.5pt] rounded-xs mt-[1pt]" style={{ fontWeight: config.locationFontBold ?? true ? 900 : 600 }}>
                    {(item.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row */}
            <div className="w-full flex flex-col items-center mt-[3pt]">
              <div className="w-full flex justify-between items-center mb-[1pt]">
                <span
                  className="tracking-tight pl-[2pt]"
                  style={{ fontSize: `${config.codeFontSizePt}pt`, fontWeight: config.codeFontBold ?? true ? 700 : 500 }}
                >
                  {item.code || 'MÃ SP'}
                </span>
                <span
                  className="pr-[4pt]"
                  style={{ fontSize: `${config.categoryFontSizePt}pt`, fontWeight: config.categoryFontBold ?? true ? 700 : 500 }}
                >
                  {item.category || ''}
                </span>
              </div>

              {config.showBarcode && item.code && (
                <div
                  className={`w-full flex justify-center items-center py-[2pt] my-[0.5pt] box-border ${
                    config.showBarcodeBorders ? 'border-t-[0.8pt] border-b-[0.8pt] border-black' : ''
                  }`}
                  style={{ minHeight: '14pt' }}
                >
                  <svg
                    ref={barcodeRef}
                    className="max-w-full block"
                    style={{
                      shapeRendering: 'crispEdges',
                      height: `${config.barcodeHeight || 10}px`,
                      margin: '0 auto',
                    }}
                  />
                </div>
              )}

              <div
                className="w-full text-center truncate mt-[0pt]"
                style={{ fontSize: `${config.nameFontSizePt}pt`, fontWeight: config.nameFontBold ?? true ? 800 : 500 }}
                title={item.name}
              >
                {item.name || 'Tên linh kiện'}
              </div>
            </div>
          </div>
        );

      case 'large_qr':
        return (
          <div className="flex items-center justify-between h-full w-full select-none text-black px-[4pt]">
            {/* Left Big QR + Date */}
            <div className="flex flex-col items-center justify-center shrink-0">
              {config.showQr && qrSrc && (
                <div className="w-[74px] h-[74px] flex items-center justify-center">
                  <img src={qrSrc} alt="QR" className="w-[74px] h-[74px] block object-contain" style={{ imageRendering: 'pixelated' }} />
                </div>
              )}
              {config.showDate !== false && (
                <div
                  className="text-center font-mono font-bold text-black mt-[1pt] tracking-tight leading-none"
                  style={{ fontSize: `${config.dateFontSizePt || 7.5}pt` }}
                >
                  {item.date || ''}
                </div>
              )}
            </div>
            
            {/* Right Info */}
            <div className="flex-1 flex flex-col justify-center pl-[8pt] text-left">
              <div className="flex justify-between items-center">
                <div className="leading-tight truncate" style={{ fontSize: `${config.modelFontSizePt}pt`, fontWeight: config.modelFontBold ?? true ? 800 : 500 }}>{item.model || '-'}</div>
                {item.location && config.showLocation !== false && (
                  <span className="bg-neutral-100 border border-neutral-400 px-1.5 py-[0.5pt] rounded-xs" style={{ fontSize: `${config.locationFontSizePt || 8.5}pt`, fontWeight: config.locationFontBold ?? true ? 900 : 600 }}>
                    {(item.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')}
                  </span>
                )}
              </div>
              <div className="mt-[2pt]" style={{ fontSize: `${config.codeFontSizePt || 12}pt`, fontWeight: config.codeFontBold ?? true ? 700 : 500 }}>{item.code}</div>
              <div className="text-neutral-800" style={{ fontSize: `${config.categoryFontSizePt || 10}pt`, fontWeight: config.categoryFontBold ?? true ? 600 : 500 }}>{item.category}</div>
              <div className="leading-tight line-clamp-2 mt-[2pt]" style={{ fontSize: `${config.nameFontSizePt || 9.5}pt`, fontWeight: config.nameFontBold ?? true ? 500 : 400 }}>{item.name}</div>
            </div>
          </div>
        );

      case 'bold_barcode':
        return (
          <div className="flex flex-col justify-between h-full w-full select-none text-black">
            <div className="w-full flex justify-between items-center px-[2pt] pt-[2pt]">
              <span className="font-extrabold text-[13pt]">{item.model || ''}</span>
              <div className="flex items-center gap-1.5">
                {item.date && (
                  <span className="font-mono text-[8pt] font-semibold text-neutral-700 mr-1">
                    {item.date}
                  </span>
                )}
                {item.location && config.showLocation !== false && (
                  <span className="text-[8.5pt] font-black text-black bg-neutral-100 border border-neutral-400 px-1.5 py-[0.5pt] rounded-xs">
                    {(item.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')}
                  </span>
                )}
                <span className="font-bold text-[12pt]">{item.category || ''}</span>
              </div>
            </div>

            <div className="w-full flex flex-col items-center justify-center py-[2pt]">
              <span className="font-mono font-bold text-[14pt] tracking-wide mb-[2pt]">{item.code}</span>
              {config.showBarcode && item.code && (
                <div className={`w-full flex justify-center items-center py-[2pt] ${config.showBarcodeBorders ? 'border-t border-b border-black' : ''}`}>
                  <svg ref={barcodeRef} className="max-w-full h-[18pt] block" style={{ shapeRendering: 'crispEdges' }} />
                </div>
              )}
            </div>

            <div className="w-full text-center font-semibold text-[11pt] truncate pb-[2pt]">
              {item.name}
            </div>
          </div>
        );

      case 'standard_3x2':
      default:
        return (
          <div className="flex flex-col justify-between h-full w-full select-none text-black">
            {/* Top Section */}
            <div className="w-full flex items-center justify-between gap-[8pt] mt-[2pt] px-[2pt]">
              {/* QR Code top-left + Ngày nhập kho directly below QR */}
              <div className="flex flex-col items-center justify-start shrink-0">
                <div
                  className="flex items-center justify-center"
                  style={{ width: `${config.qrSizePx}px`, height: `${config.qrSizePx}px` }}
                >
                  {config.showQr && qrSrc ? (
                    <img
                      src={qrSrc}
                      alt="QR Code"
                      style={{ width: `${config.qrSizePx}px`, height: `${config.qrSizePx}px`, imageRendering: 'pixelated' }}
                      className="block object-contain"
                    />
                  ) : (
                    <div
                      className="border border-dashed border-neutral-300 flex items-center justify-center text-[8pt] text-neutral-400"
                      style={{ width: `${config.qrSizePx}px`, height: `${config.qrSizePx}px` }}
                    >
                      QR
                    </div>
                  )}
                </div>

                {/* Ngày nhập kho */}
                {config.showDate !== false && (
                  <div
                    className="text-center font-mono font-bold text-black mt-[3.5pt] tracking-tight leading-none"
                    style={{ fontSize: `${config.dateFontSizePt || 7.5}pt` }}
                    title={`Ngày nhập kho: ${item.date || 'Chưa đặt'}`}
                  >
                    {item.date || ''}
                  </div>
                )}
              </div>

              {/* Model text & Shelf location right-aligned */}
              <div className="flex-1 min-w-0 flex flex-col items-end justify-center pr-[2pt]">
                <div
                  className="text-right leading-[1.15] break-words w-full"
                  style={{
                    fontSize: `${config.modelFontSizePt}pt`,
                    fontFamily: config.fontFamily,
                    fontWeight: config.modelFontBold ?? true ? 800 : 500,
                  }}
                >
                  {item.model}
                </div>

                {/* Editable Location Section */}
                {config.showLocation !== false && (
                  <>
                    {isEditingLocation ? (
                      <div className="mt-[2pt] flex items-center gap-1 z-20">
                        <input
                          type="text"
                          autoFocus
                          value={tempLocation}
                          onChange={(e) => setTempLocation(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingLocation(false);
                              onUpdateItem?.({ ...item, location: tempLocation.trim() });
                            } else if (e.key === 'Escape') {
                              setIsEditingLocation(false);
                              setTempLocation(
                                (item.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')
                              );
                            }
                          }}
                          onBlur={() => {
                            setIsEditingLocation(false);
                            onUpdateItem?.({ ...item, location: tempLocation.trim() });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[72px] text-right font-black text-black bg-white border border-blue-600 rounded px-1 py-[0.5pt] shadow-xs outline-none text-[9pt]"
                          placeholder="VD: A-01"
                        />
                      </div>
                    ) : item.location ? (
                      <div
                        onClick={(e) => {
                          if (!isPrintMode && onUpdateItem) {
                            e.stopPropagation();
                            setIsEditingLocation(true);
                          }
                        }}
                        title={!isPrintMode && onUpdateItem ? 'Nhấp đúp hoặc nhấp để đổi mã kệ' : undefined}
                        className={`text-right text-black mt-[2pt] tracking-tight inline-flex items-center justify-center bg-neutral-100/90 border border-neutral-400 px-1.5 py-[0.5pt] rounded-xs ${
                          !isPrintMode && onUpdateItem
                            ? 'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 cursor-pointer transition-colors'
                            : ''
                        }`}
                        style={{ fontSize: `${config.locationFontSizePt || 9.5}pt`, fontWeight: config.locationFontBold ?? true ? 900 : 600 }}
                      >
                        <span>{(item.location || '').replace(/^(kệ|ke|vị trí|kho)\s*:?\s*/i, '')}</span>
                      </div>
                    ) : !isPrintMode && onUpdateItem ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditingLocation(true);
                        }}
                        title="Nhấp để thêm mã kệ"
                        className="text-right text-[7.5pt] text-neutral-400 hover:text-blue-600 mt-[2pt] font-medium border border-dashed border-neutral-300 hover:border-blue-400 px-1 py-[0.2pt] rounded cursor-pointer transition-colors"
                      >
                        + Mã kệ
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="w-full flex flex-col items-center mt-[2.5pt]">
              {/* Row Code & Category */}
              <div className="w-full flex justify-between items-center mb-[1pt]">
                <span
                  className="tracking-[0.5pt] pl-[2pt]"
                  style={{ fontSize: `${config.codeFontSizePt}pt`, fontWeight: config.codeFontBold ?? true ? 700 : 500 }}
                >
                  {item.code}
                </span>
                <span
                  className="pr-[4pt]"
                  style={{ fontSize: `${config.categoryFontSizePt}pt`, fontWeight: config.categoryFontBold ?? true ? 700 : 500 }}
                >
                  {item.category}
                </span>
              </div>

              {/* Slender Barcode Section */}
              {config.showBarcode && item.code && (
                <div
                  className={`w-full flex justify-center items-center py-[2pt] my-[0.5pt] box-border ${
                    config.showBarcodeBorders ? 'border-t-[0.8pt] border-b-[0.8pt] border-black' : ''
                  }`}
                  style={{ minHeight: '14pt' }}
                >
                  <svg
                    ref={barcodeRef}
                    className="max-w-full block"
                    style={{
                      shapeRendering: 'crispEdges',
                      height: `${config.barcodeHeight || 10}px`,
                      margin: '0 auto',
                    }}
                  />
                </div>
              )}

              {/* Component Name */}
              <div
                className="w-full text-center truncate mt-[0pt] mb-[0pt]"
                style={{ fontSize: `${config.nameFontSizePt}pt`, fontWeight: config.nameFontBold ?? true ? 800 : 500 }}
                title={item.name}
              >
                {item.name}
              </div>
            </div>
          </div>
        );
    }
  };

  // If inside @media print container
  if (isPrintMode) {
    return (
      <div
        className="print-label-item bg-white text-black box-border relative overflow-hidden"
        style={{
          width: widthStyle,
          height: heightStyle,
          padding: '5pt 12pt 2pt 12pt',
          transform: config.rotation ? `rotate(${config.rotation}deg)` : undefined,
          marginLeft: config.offsetXPx ? `${config.offsetXPx}px` : undefined,
          marginTop: config.offsetYPx ? `${config.offsetYPx}px` : undefined,
        }}
      >
        {renderTemplateContent()}
      </div>
    );
  }

  // Interactive Screen Preview Card
  const isSelected = item.selected !== false;

  return (
    <div
      id={`label-card-${item.id}`}
      onClick={() => onSelectFocus?.(item.id)}
      className="flex flex-col items-center group transition-all duration-300 scroll-mt-6"
    >
      {/* Selection / Focus Indicator Badge */}
      <div className="flex items-center gap-1.5 mb-1.5 min-h-[22px]">
        {isFocused && (
          <div className="text-[11px] font-bold text-blue-700 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1.5 animate-pulse">
            <span>🎯</span>
            <span>Đang chọn</span>
          </div>
        )}
        {!isSelected && (
          <div className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
            <span>Bỏ chọn in</span>
          </div>
        )}
      </div>

      {/* Label container mimicking physical thermal 3x2 inch */}
      <div
        className={`bg-white text-black box-border relative transition-all duration-300 ${
          isFocused
            ? 'ring-3 ring-blue-500 ring-offset-2 border-blue-500 shadow-xl scale-[1.02]'
            : !isSelected
            ? 'border border-neutral-300 opacity-60 grayscale-[15%] hover:opacity-90'
            : config.previewDashedBorder
            ? 'border border-dashed border-neutral-400 hover:border-blue-500 shadow-sm'
            : 'border border-neutral-200 shadow-sm'
        } hover:shadow-md rounded-none overflow-hidden flex flex-col justify-between cursor-pointer`}
        style={{
          width: widthStyle,
          height: heightStyle,
          padding: '5pt 12pt 2pt 12pt',
        }}
      >
        {renderTemplateContent()}
      </div>

      {/* Action buttons below label */}
      <div className="flex items-center gap-1.5 mt-2.5 opacity-90 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectFocus?.(item.id);
          }}
          className={`p-1 rounded border cursor-pointer transition-colors ${
            isFocused
              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
              : 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border-blue-200'
          }`}
          title="Xem vị trí dòng linh kiện này trong bảng dữ liệu"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        {onPrintSingle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrintSingle(item);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            title="In riêng tem này"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In tem này</span>
            {item.quantity > 1 && (
              <span className="bg-blue-800 text-[10px] px-1 py-0.2 rounded-full font-mono">
                x{item.quantity}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyCode();
          }}
          className="p-1 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-200 cursor-pointer transition-colors"
          title="Sao chép mã SP"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-600" />}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (item.code) {
              navigator.clipboard.writeText(item.code);
            }
            window.open(GCSM_STOCK_URL, '_blank', 'noopener,noreferrer');
          }}
          className={`p-1.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 cursor-pointer transition-all hover:scale-105 shadow-2xs ${
            showStockCheckButton ? 'inline-flex' : 'hidden group-hover:inline-flex'
          }`}
          title="Check tồn kho mã này trên GCSM (https://gcsm-sg.oppoit.com/part/stocks/stock-query)"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>

        {isAdmin && onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="p-1 text-neutral-600 hover:text-blue-600 bg-neutral-100 hover:bg-blue-50 rounded border border-neutral-200 cursor-pointer transition-colors"
            title="Chỉnh sửa tem"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {isAdmin && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="p-1 text-neutral-600 hover:text-red-600 bg-neutral-100 hover:bg-red-50 rounded border border-neutral-200 cursor-pointer transition-colors"
            title="Xóa tem"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export const LabelCard = memo(LabelCardInner);
