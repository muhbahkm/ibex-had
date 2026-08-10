/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SaleUnit {
  unit_name: string;
  conversion_factor: number;
  is_base_unit: boolean;
  is_default: boolean;
  enabled: boolean;
  kg_amount?: number;
  localId?: string; // stable identifier to prevent losing focus during editing
}

export type PricingMode = 'gallon' | 'weight' | 'piece';

export interface ParseResult {
  units: SaleUnit[];
  notes: string;
  gallon_weight_kg: number;
  pricing_mode: PricingMode;
}

const MARKER = '[IBEX_UNITS_JSON_V2]:';
const OLD_MARKER = '[IBEX_UNITS_JSON]:';

export function generateLocalId(): string {
  return 'unit_' + Math.random().toString(36).substring(2, 9);
}

export function getDefaultUnitsForGallon(weight: number): SaleUnit[] {
  return [
    { localId: generateLocalId(), unit_name: 'جالون', conversion_factor: 1, is_base_unit: true, is_default: true, enabled: true },
    { localId: generateLocalId(), unit_name: 'كيلو', conversion_factor: Number((1 / weight).toFixed(6)), is_base_unit: false, is_default: false, enabled: true, kg_amount: 1 },
    { localId: generateLocalId(), unit_name: 'نصف كيلو', conversion_factor: Number((0.5 / weight).toFixed(6)), is_base_unit: false, is_default: false, enabled: true, kg_amount: 0.5 },
    { localId: generateLocalId(), unit_name: 'ربع كيلو', conversion_factor: Number((0.25 / weight).toFixed(6)), is_base_unit: false, is_default: false, enabled: true, kg_amount: 0.25 }
  ];
}

export function getDefaultUnitsForWeightMode(): SaleUnit[] {
  return [
    { localId: generateLocalId(), unit_name: 'كيلو', conversion_factor: 1, is_base_unit: true, is_default: true, enabled: true, kg_amount: 1 },
    { localId: generateLocalId(), unit_name: 'نصف كيلو', conversion_factor: 0.5, is_base_unit: false, is_default: false, enabled: true, kg_amount: 0.5 },
    { localId: generateLocalId(), unit_name: 'ربع كيلو', conversion_factor: 0.25, is_base_unit: false, is_default: false, enabled: true, kg_amount: 0.25 },
    { localId: generateLocalId(), unit_name: '100 جرام', conversion_factor: 0.1, is_base_unit: false, is_default: false, enabled: true, kg_amount: 0.1 }
  ];
}

export function getDefaultUnitsForPiece(baseUnitName: string = 'علبة'): SaleUnit[] {
  return [
    { localId: generateLocalId(), unit_name: baseUnitName, conversion_factor: 1, is_base_unit: true, is_default: true, enabled: true }
  ];
}

export function getDefaultUnitsForWeight(weight: number): SaleUnit[] {
  return getDefaultUnitsForGallon(weight);
}

/**
 * Parses the product notes and extracts the units list, gallon weight, and user clinical notes.
 */
export function parseProductUnitsAndNotes(notesStr: string | null | undefined, baseUnitName?: string): ParseResult {
  const defaultWeight = 6.7;
  const normalizedBaseUnitName = baseUnitName?.trim() || 'جالون';

  if (!notesStr) {
    let mode: PricingMode = 'gallon';
    let units: SaleUnit[] = [];
    if (normalizedBaseUnitName === 'كيلو' || normalizedBaseUnitName === 'كيلو جرام') {
      mode = 'weight';
      units = getDefaultUnitsForWeightMode();
    } else if (normalizedBaseUnitName === 'علبة' || normalizedBaseUnitName === 'قطعة') {
      mode = 'piece';
      units = getDefaultUnitsForPiece(normalizedBaseUnitName);
    } else if (normalizedBaseUnitName === 'جالون') {
      mode = 'gallon';
      units = getDefaultUnitsForGallon(defaultWeight);
    } else {
      mode = 'piece';
      units = getDefaultUnitsForPiece(normalizedBaseUnitName);
    }
    return { units, notes: '', gallon_weight_kg: defaultWeight, pricing_mode: mode };
  }

  // 1. Try V2 Marker first
  let index = notesStr.indexOf(MARKER);
  if (index !== -1) {
    const jsonStart = index + MARKER.length;
    const newlineIndex = notesStr.indexOf('\n', jsonStart);
    const jsonStr = newlineIndex === -1 ? notesStr.substring(jsonStart) : notesStr.substring(jsonStart, newlineIndex);
    const remainingNotes = (notesStr.substring(0, index) + (newlineIndex === -1 ? '' : notesStr.substring(newlineIndex))).trim();

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        const weight = Number(parsed.gallon_weight_kg ?? defaultWeight);
        let mode: PricingMode = parsed.pricing_mode || 'gallon';
        
        let units: SaleUnit[] = [];
        if (Array.isArray(parsed.units)) {
          units = parsed.units.map((u: any) => ({
            localId: u.localId || generateLocalId(),
            unit_name: u.unit_name,
            conversion_factor: Number(u.conversion_factor),
            is_base_unit: !!u.is_base_unit,
            is_default: !!u.is_default,
            enabled: u.enabled !== false,
            kg_amount: u.kg_amount !== undefined ? Number(u.kg_amount) : undefined
          }));
        } else {
          if (mode === 'gallon') {
            units = getDefaultUnitsForGallon(weight);
          } else if (mode === 'weight') {
            units = getDefaultUnitsForWeightMode();
          } else {
            units = getDefaultUnitsForPiece(normalizedBaseUnitName);
          }
        }
        return { units, notes: remainingNotes, gallon_weight_kg: weight, pricing_mode: mode };
      }
    } catch (e) {
      console.warn('Failed to parse V2 units JSON', e);
    }
  }

  // 2. Try old Marker
  index = notesStr.indexOf(OLD_MARKER);
  if (index !== -1) {
    const jsonStart = index + OLD_MARKER.length;
    const newlineIndex = notesStr.indexOf('\n', jsonStart);
    const jsonStr = newlineIndex === -1 ? notesStr.substring(jsonStart) : notesStr.substring(jsonStart, newlineIndex);
    const remainingNotes = (notesStr.substring(0, index) + (newlineIndex === -1 ? '' : notesStr.substring(newlineIndex))).trim();

    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        const units = parsed.map((u: any) => ({
          localId: generateLocalId(),
          unit_name: u.unit_name || 'كيلو',
          conversion_factor: Number(u.conversion_factor ?? 1),
          is_base_unit: !!u.is_base_unit,
          is_default: !!u.is_default,
          enabled: true,
          kg_amount: u.unit_name?.includes('نصف') ? 0.5 : u.unit_name?.includes('ربع') ? 0.25 : u.is_base_unit ? undefined : 1
        }));
        
        // Detect mode
        const hasGallon = units.some(u => u.unit_name === 'جالون');
        const mode: PricingMode = hasGallon ? 'gallon' : 'weight';

        return { units, notes: remainingNotes, gallon_weight_kg: defaultWeight, pricing_mode: mode };
      }
    } catch (e) {
      console.warn('Failed to parse old units JSON', e);
    }
  }

  // No marker or failed parses - check if base unit is YER or if they are old products
  if (normalizedBaseUnitName === 'كيلو' || normalizedBaseUnitName === 'كيلو جرام') {
    const oldKiloUnits: SaleUnit[] = [
      { localId: generateLocalId(), unit_name: 'كيلو', conversion_factor: 1, is_base_unit: true, is_default: true, enabled: true, kg_amount: 1 },
      { localId: generateLocalId(), unit_name: 'نصف كيلو', conversion_factor: 0.5, is_base_unit: false, is_default: false, enabled: true, kg_amount: 0.5 },
      { localId: generateLocalId(), unit_name: 'ربع كيلو', conversion_factor: 0.25, is_base_unit: false, is_default: false, enabled: true, kg_amount: 0.25 }
    ];
    return { units: oldKiloUnits, notes: notesStr || '', gallon_weight_kg: 1, pricing_mode: 'weight' };
  }

  if (normalizedBaseUnitName === 'جالون') {
    return { units: getDefaultUnitsForGallon(defaultWeight), notes: notesStr || '', gallon_weight_kg: defaultWeight, pricing_mode: 'gallon' };
  }

  // Otherwise, default to piece mode
  return { units: getDefaultUnitsForPiece(normalizedBaseUnitName), notes: notesStr || '', gallon_weight_kg: 1, pricing_mode: 'piece' };
}

export function serializeProductUnitsAndNotes(units: SaleUnit[], notes: string, gallon_weight_kg: number, pricing_mode: PricingMode): string {
  // Strip localId to keep the JSON payload clean if desired, but we can also store it. Storing is fine or cleaning is fine. Let's clean.
  const cleanedUnits = units.map(u => ({
    unit_name: u.unit_name,
    conversion_factor: u.conversion_factor,
    is_base_unit: u.is_base_unit,
    is_default: u.is_default,
    enabled: u.enabled,
    kg_amount: u.kg_amount
  }));

  const data = {
    gallon_weight_kg,
    pricing_mode,
    units: cleanedUnits
  };
  const jsonStr = JSON.stringify(data);
  const markerLine = `${MARKER}${jsonStr}`;
  if (notes?.trim()) {
    return `${markerLine}\n${notes.trim()}`;
  }
  return markerLine;
}
