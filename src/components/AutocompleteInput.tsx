/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface AutocompleteInputProps {
  placeholder: string;
  onSearch: (query: string) => Promise<any[]>;
  onSelect: (item: any) => void;
  getDisplayValue: (item: any) => string;
  getSecondaryDisplayValue?: (item: any) => string | undefined;
  idAttribute?: string;
  initialValue?: string;
  allowCustomEntry?: boolean;
  onCustomEntryChange?: (val: string) => void;
  icon?: React.ReactNode;
  inputClassName?: string;
  dropdownClassName?: string;
}

export default function AutocompleteInput({
  placeholder,
  onSearch,
  onSelect,
  getDisplayValue,
  getSecondaryDisplayValue,
  idAttribute = 'id',
  initialValue = '',
  allowCustomEntry = true,
  onCustomEntryChange,
  icon,
  inputClassName,
  dropdownClassName
}: AutocompleteInputProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update query if initialValue changes
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  // Debounced search
  useEffect(() => {
    if (!isOpen || query.trim() === '') {
      setResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await onSearch(query);
        setResults(res || []);
      } catch (err) {
        console.error('Autocomplete search error', err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(handler);
  }, [query, isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    if (onCustomEntryChange) {
      onCustomEntryChange(val);
    }
  };

  const handleSelect = (item: any) => {
    const displayVal = getDisplayValue(item);
    setQuery(displayVal);
    setIsOpen(false);
    onSelect(item);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={inputClassName || "w-full bg-[#161616] border border-[#2C2C2E] hover:border-[#3a3a3d] focus:border-[#00E5FF] rounded-xl py-3 px-10 text-white placeholder-[#98989D] text-sm outline-none transition-all"}
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#98989D]">
          {icon ? icon : <Search className="w-4 h-4" />}
        </div>
        {loading && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00E5FF]">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
      </div>

      {isOpen && (query.trim() !== '' || results.length > 0) && (
        <div className={dropdownClassName || "absolute z-50 w-full mt-2 bg-[#1E1E1E] border border-[#2C2C2E] rounded-xl shadow-2xl max-h-64 overflow-y-auto"}>
          {results.length > 0 ? (
            <div className="py-1">
              {results.map((item, index) => (
                <button
                  key={`${item[idAttribute] || 'item'}-${index}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full px-4 py-2.5 text-right flex items-center justify-between text-sm transition-colors border-b last:border-0 ${
                    inputClassName 
                      ? 'hover:bg-[#FFFDF8] text-[#1E1A14] border-[#E8DDCC]/35' 
                      : 'hover:bg-[#252525] text-white border-[#2C2C2E]/30'
                  }`}
                >
                  <span className="font-medium">{getDisplayValue(item)}</span>
                  {getSecondaryDisplayValue && (
                    <span className={`text-xs font-mono select-none ${inputClassName ? 'text-[#8A8276]' : 'text-[#98989D]'}`}>
                      {getSecondaryDisplayValue(item)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            allowCustomEntry && query.trim() !== '' && (
              <div className="p-4 text-center">
                <p className={`text-xs mb-2 ${inputClassName ? 'text-[#8A8276]' : 'text-[#98989D]'}`}>الصنف أو العميل هذا غير موجود بالملف</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onSelect({ is_new_entry: true, value: query });
                  }}
                  className={`hover:underline text-xs font-semibold ${inputClassName ? 'text-honey' : 'text-[#00E5FF]'}`}
                >
                  اضغط هنا لاعتماده كإدخال جديد: "{query}"
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
