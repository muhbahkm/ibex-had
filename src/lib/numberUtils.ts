/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes Eastern Arabic / Indic / Persian digits (e.g., ١, ۲) to standard Western Latin digits (0-9).
 * Also replaces Arabic/Persian decimal and thousands separators to standard English counterparts.
 */
export const normalizeDigits = (value: string): string => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/٬/g, ',')
    .replace(/٫/g, '.');
};

/**
 * Parses any value (string/number) safely, normalizing Indic digits if it's a string,
 * and returning a valid float or 0.
 */
export const parseNormalizedFloat = (value: any): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  const normalizedStr = normalizeDigits(String(value))
    .replace(/,/g, ''); // strip thousands separators if any
  const parsed = parseFloat(normalizedStr);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Parses any value (string/number) safely as integer.
 */
export const parseNormalizedInt = (value: any): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : Math.floor(value);
  
  const normalizedStr = normalizeDigits(String(value))
    .replace(/,/g, '');
  const parsed = parseInt(normalizedStr, 10);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Formats a number with standard 'en-US' grouping and precision limits, 
 * guaranteeing standard Latin 0-9 digits across all browser environments.
 */
export const formatNumber = (value: number | string | null | undefined, maximumFractionDigits: number = 2): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'number' ? value : parseNormalizedFloat(value);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(num);
};

/**
 * Formats monetary amounts in Latin digits, appending standard currency tags/names.
 */
export const formatMoney = (value: number | string | null | undefined, currency?: string): string => {
  const formatted = formatNumber(value);
  if (currency) {
    return `${formatted} ${currency}`;
  }
  return formatted;
};

/**
 * Formats a Date using Arabic linguistic locale keys but strictly enforcing the 'latn' numbering system (0-9).
 */
export const formatDate = (date: Date | string | number | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('ar-YE-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (e) {
    return d.toLocaleString('en-US');
  }
};

/**
 * Converts an amount from one currency to another using the provided exchange rates.
 * Rates must be given relative to YER (e.g., 1 SAR = 410 YER, 1 USD = 1530 YER).
 */
export const convertCurrency = (
  amount: number,
  from: string,
  to: string,
  sarRate: number,
  usdRate: number
): number => {
  const fromClean = (from || 'YER').toUpperCase();
  const toClean = (to || 'YER').toUpperCase();
  
  if (fromClean === toClean) return amount;
  
  // 1. Convert "from" to YER (the base currency)
  let yemeniRials = amount;
  if (fromClean === 'SAR') {
    yemeniRials = amount * sarRate;
  } else if (fromClean === 'USD') {
    yemeniRials = amount * usdRate;
  }

  // 2. Convert YER to "to" currency
  if (toClean === 'YER') {
    return yemeniRials;
  } else if (toClean === 'SAR') {
    return sarRate > 0 ? yemeniRials / sarRate : 0;
  } else if (toClean === 'USD') {
    return usdRate > 0 ? yemeniRials / usdRate : 0;
  }

  return amount;
};
