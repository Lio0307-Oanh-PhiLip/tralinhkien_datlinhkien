import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { LabelItem } from '../types/label';
import { Check, Sparkles, MapPin, Tag, Box, ArrowRight } from 'lucide-react';
import { extractBarcodePartCode, findMasterItemByBarcode } from '../utils/barcodeExtractor';

interface PartAutocompleteCellProps {
  value: string;
  field: 'code' | 'model' | 'name';
  placeholder: string;
  className?: string;
  inputClassName?: string;
  masterItems: LabelItem[];
  onValueChange: (val: string) => void;
  onSelectMasterItem: (item: LabelItem) => void;
  autoFocus?: boolean;
  rowId?: string;
}

export const PartAutocompleteCell: React.FC<PartAutocompleteCellProps> = ({
  value,
  field,
  placeholder,
  className = '',
  inputClassName = '',
  masterItems,
  onValueChange,
  onSelectMasterItem,
  autoFocus = false,
  rowId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [justAutoFilled, setJustAutoFilled] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const ignoreBurstUntilRef = useRef<number>(0);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Calculate if dropdown should open upward or downward
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      // If less than 280px below and more space above, open upward
      if (spaceBelow < 280 && rect.top > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen]);

  // Fast & Smart multi-token filter from master items
  const suggestions = useMemo(() => {
    const rawClean = value.trim().toLowerCase();
    if (!rawClean || rawClean.length < 1) return [];

    // Extract prefix before delimiters or letters for barcode scans
    const cleanPrefix = (field === 'code')
      ? extractBarcodePartCode(rawClean, masterItems).toLowerCase()
      : rawClean;

    // Split query into tokens for flexible search (e.g. "reno 12 màn" or "621035")
    const queryTokens = (cleanPrefix || rawClean).split(/\s+/).filter(Boolean);

    const matches: { item: LabelItem; cleanCode: string }[] = [];
    const maxResults = 12;

    for (const item of masterItems) {
      const code = (item.code || '').toLowerCase();
      const cleanItemCode = extractBarcodePartCode(code, masterItems).toLowerCase();
      const model = (item.model || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const loc = (item.location || '').toLowerCase();

      // Combined searchable text
      const fullText = `${code} ${cleanItemCode} ${model} ${name} ${cat} ${loc}`;

      // Check if all tokens match or if exact code matches clean prefix
      const isExactCode = (cleanPrefix && (code === cleanPrefix || cleanItemCode === cleanPrefix));
      const allTokensMatch = isExactCode || queryTokens.every((token) => fullText.includes(token));

      if (allTokensMatch) {
        matches.push({ item, cleanCode: cleanItemCode });
        if (matches.length >= maxResults * 3) break; // Optimization limit
      }
    }

    // Smart Sorting: prioritizing exact match on clean prefix, then startsWith
    return matches
      .sort((aObj, bObj) => {
        const a = aObj.item;
        const b = bObj.item;
        const aCode = (a.code || '').toLowerCase();
        const bCode = (b.code || '').toLowerCase();
        const aCleanCode = aObj.cleanCode;
        const bCleanCode = bObj.cleanCode;

        // 1. Exact code match with cleanPrefix (e.g. 4909107 from 4909107-A0000)
        const aExact = aCode === cleanPrefix || aCleanCode === cleanPrefix;
        const bExact = bCode === cleanPrefix || bCleanCode === cleanPrefix;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aField = ((field === 'code' ? a.code : field === 'model' ? a.model : a.name) || '').toLowerCase();
        const bField = ((field === 'code' ? b.code : field === 'model' ? b.model : b.name) || '').toLowerCase();

        const aStarts = aField.startsWith(cleanPrefix) || aField.startsWith(rawClean);
        const bStarts = bField.startsWith(cleanPrefix) || bField.startsWith(rawClean);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return 0;
      })
      .slice(0, maxResults)
      .map((m) => m.item);
  }, [value, field, masterItems]);

  const handleSelect = useCallback(
    (item: LabelItem) => {
      onSelectMasterItem(item);
      setIsOpen(false);
      setJustAutoFilled(true);
      setTimeout(() => setJustAutoFilled(false), 2200);
    },
    [onSelectMasterItem]
  );

  // Auto-fill on exact code match if user finishes typing or tabs out
  const handleBlur = () => {
    ignoreBurstUntilRef.current = 0;
    if (field === 'code' && value.trim()) {
      const cleanVal = extractBarcodePartCode(value, masterItems);
      if (cleanVal !== value) {
        onValueChange(cleanVal);
        if (inputRef.current) {
          inputRef.current.value = cleanVal;
        }
      }
      const exactMatch = findMasterItemByBarcode(cleanVal, masterItems);
      if (exactMatch) {
        handleSelect(exactMatch);
      }
    }
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
      }
    }, 220);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        ignoreBurstUntilRef.current = 0;
        if (field === 'code' && value.trim()) {
          const cleanVal = extractBarcodePartCode(value, masterItems);
          if (cleanVal !== value) {
            onValueChange(cleanVal);
            if (inputRef.current) {
              inputRef.current.value = cleanVal;
            }
          }
          const exactMatch = findMasterItemByBarcode(cleanVal, masterItems);
          if (exactMatch) {
            handleSelect(exactMatch);
            return;
          }
        }
        setIsOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ignoreBurstUntilRef.current = 0;
      if (suggestions[highlightedIndex]) {
        handleSelect(suggestions[highlightedIndex]);
      } else if (field === 'code' && value.trim()) {
        const cleanVal = extractBarcodePartCode(value, masterItems);
        if (cleanVal !== value) {
          onValueChange(cleanVal);
          if (inputRef.current) {
            inputRef.current.value = cleanVal;
          }
        }
        const exactMatch = findMasterItemByBarcode(cleanVal, masterItems);
        if (exactMatch) {
          handleSelect(exactMatch);
        } else {
          setIsOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Custom input change handler: automatically strips barcode suffixes and checks for instant match
  const handleInputChange = (rawVal: string) => {
    if (field === 'code') {
      // Discard trailing keystrokes from a scanner burst if clean code was already locked
      if (Date.now() < ignoreBurstUntilRef.current) {
        if (inputRef.current) {
          inputRef.current.value = value;
        }
        return;
      }

      const cleanVal = extractBarcodePartCode(rawVal, masterItems);

      // If rawVal contains excess characters behind the clean code (e.g. 4909107-A0000 or 4909107A0000P...)
      if (cleanVal !== rawVal) {
        // Suppress trailing keystrokes from this hardware scan burst
        ignoreBurstUntilRef.current = Date.now() + 150;

        onValueChange(cleanVal);
        if (inputRef.current) {
          inputRef.current.value = cleanVal;
        }

        // Check if exact match exists in catalog
        const exactMatch = findMasterItemByBarcode(cleanVal, masterItems);
        if (exactMatch) {
          handleSelect(exactMatch);
        } else {
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      onValueChange(rawVal);
      setIsOpen(true);
      setHighlightedIndex(0);

      // If user typed exact code
      const exactMatch = findMasterItemByBarcode(rawVal, masterItems);
      if (exactMatch && exactMatch.code?.trim().toLowerCase() === rawVal.trim().toLowerCase()) {
        // Can be auto-filled if desired, or user can press Enter
      }
      return;
    }

    onValueChange(rawVal);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  // Paste handler: handles pasted barcodes like "4909107-A0000P-26314-..." or "4909107A0000P2631430117*2"
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (field === 'code') {
      const pasted = e.clipboardData.getData('text');
      if (pasted) {
        const cleanVal = extractBarcodePartCode(pasted, masterItems);
        if (cleanVal) {
          e.preventDefault();
          onValueChange(cleanVal);
          if (inputRef.current) {
            inputRef.current.value = cleanVal;
          }

          const exactMatch = findMasterItemByBarcode(cleanVal, masterItems);
          if (exactMatch) {
            handleSelect(exactMatch);
          } else {
            setIsOpen(true);
            setHighlightedIndex(0);
          }
          return;
        }
      }
    }
  };

  // Scroll active item into view smoothly
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className}`}>
      <div className="relative flex items-center min-w-0 w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          data-row-id={rowId}
          data-field={field}
          autoFocus={autoFocus}
          placeholder={placeholder}
          title={value || placeholder}
          onChange={(e) => handleInputChange(e.target.value)}
          onPaste={handlePaste}
          onFocus={() => {
            if (value.trim().length >= 1 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`w-full min-w-0 px-2 py-1 text-xs rounded transition-all focus:outline-none ${
            justAutoFilled
              ? 'bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500 font-semibold shadow-2xs'
              : 'bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
          } ${inputClassName}`}
        />

        {justAutoFilled && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded shadow-2xs pointer-events-none">
            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Đã tự điền</span>
          </div>
        )}
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && suggestions.length > 0 && (
        <div
          className={`absolute left-0 ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          } w-[450px] max-w-[95vw] bg-white rounded-xl shadow-2xl border border-neutral-300 z-50 overflow-hidden`}
          style={{ minWidth: '360px' }}
        >
          {/* Header */}
          <div className="p-2 bg-neutral-900 text-white flex items-center justify-between text-[11px] font-semibold border-b border-neutral-800">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
              <span>Gợi ý linh kiện từ kho tổng (Click để tự điền)</span>
            </div>
            <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded font-mono text-neutral-300 border border-neutral-700">
              {suggestions.length} linh kiện
            </span>
          </div>

          {/* List items */}
          <ul ref={listRef} className="max-h-72 overflow-y-auto divide-y divide-neutral-100 p-1 bg-white">
            {suggestions.map((item, idx) => {
              const isSelected = idx === highlightedIndex;
              return (
                <li
                  key={`${item.id || item.code}-${idx}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur before click registers
                    handleSelect(item);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-2.5 rounded-lg cursor-pointer transition-all text-xs flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400 font-medium'
                      : 'hover:bg-neutral-50 text-neutral-800'
                  }`}
                  title={`${item.code || ''} - ${item.model || ''} - ${item.name || ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-900 text-[12px] truncate" title={item.code}>
                      <Box className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{item.code || 'Chưa có mã'}</span>
                    </div>

                    {item.model && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-extrabold text-[10.5px] truncate max-w-[200px] shadow-2xs" title={item.model}>
                        {item.model}
                      </span>
                    )}
                  </div>

                  <div className="font-semibold text-neutral-900 text-[11.5px] leading-tight break-words flex items-start justify-between gap-1" title={item.name}>
                    <span className="line-clamp-2">{item.name || 'Không có tên linh kiện'}</span>
                    <span className="text-[10px] text-emerald-600 shrink-0 flex items-center font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Chọn <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-medium mt-0.5">
                    {item.category && (
                      <span className="flex items-center gap-0.5 text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded" title={item.category}>
                        <Tag className="w-2.5 h-2.5 text-neutral-400" />
                        {item.category}
                      </span>
                    )}
                    {item.location && (
                      <span className="flex items-center gap-0.5 text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-semibold" title={`Kệ: ${item.location}`}>
                        <MapPin className="w-2.5 h-2.5 text-amber-600" />
                        Kệ: {item.location}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Footer Guide */}
          <div className="p-1.5 bg-neutral-50 border-t border-neutral-100 text-[10.5px] text-neutral-500 text-center flex items-center justify-center gap-2">
            <span>Dùng phím <kbd className="px-1 py-0.5 bg-neutral-200 text-neutral-800 rounded font-mono text-[9px]">▲</kbd> <kbd className="px-1 py-0.5 bg-neutral-200 text-neutral-800 rounded font-mono text-[9px]">▼</kbd> để duyệt, <kbd className="px-1 py-0.5 bg-neutral-200 text-neutral-800 rounded font-mono text-[9px]">Enter</kbd> hoặc click để tự điền</span>
          </div>
        </div>
      )}
    </div>
  );
};
