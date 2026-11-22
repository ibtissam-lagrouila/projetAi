/**
 * Standard English formatting utilities for Datalift
 * Ensures consistent date, number, percent, and plural display across all modalities.
 */

const enGBDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

const enGBDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const enUSNumberFormatter = new Intl.NumberFormat('en-US');

/**
 * Formats a date into an unambiguous English format (e.g. "9 Nov 2026")
 */
export function formatDate(date: string | number | Date | null | undefined): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    return enGBDateFormatter.format(d);
  } catch {
    return String(date);
  }
}

/**
 * Formats a date and time in 24-hour English format (e.g. "9 Nov 2026, 14:30")
 */
export function formatDateTime(date: string | number | Date | null | undefined): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    return enGBDateTimeFormatter.format(d);
  } catch {
    return String(date);
  }
}

/**
 * Formats a number using English grouping commas (e.g. 1000 -> "1,000")
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return enUSNumberFormatter.format(value);
}

/**
 * Formats a percentage in English format (e.g. 0.125 -> "12.5%", 12.5 -> "12.5%")
 */
export function formatPercent(value: number | null | undefined, isFraction = false, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  const num = isFraction ? value * 100 : value;
  return `${num.toFixed(decimals)}%`;
}

/**
 * Handles grammatical English plurals cleanly to prevent "1 texts" errors.
 * Example:
 * pluralize(1, 'version') => "1 version"
 * pluralize(4, 'version') => "4 versions"
 * pluralize(1, 'text') => "1 text"
 * pluralize(2, 'text') => "2 texts"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const p = plural || (singular.endsWith('s') ? `${singular}es` : `${singular}s`);
  return count === 1 ? `1 ${singular}` : `${formatNumber(count)} ${p}`;
}

export type ModalityType = 'tabular' | 'text' | 'image';

/**
 * Categorizes a dataset into tabular, text, or image modality
 * based on its name and description.
 */
export function getDatasetModality(dataset: { name: string; description?: string | null }): ModalityType {
  const name = (dataset.name || '').toLowerCase();
  const desc = (dataset.description || '').toLowerCase();

  // 1. Image criteria
  if (
    desc.includes('image') ||
    desc.includes('vision') ||
    desc.includes('defect') ||
    name.includes('image') ||
    name.includes('defect') ||
    name.includes('photo') ||
    name.includes('vision') ||
    name.includes('chat') ||
    name.includes('chien') ||
    name.endsWith('.zip') ||
    name.endsWith('.tar') ||
    name.endsWith('.tar.gz') ||
    name.endsWith('/')
  ) {
    return 'image';
  }

  // 2. Text criteria
  if (
    desc.includes('text') ||
    desc.includes('corpus') ||
    desc.includes('nlp') ||
    name.endsWith('.txt') ||
    name.endsWith('.jsonl') ||
    name.endsWith('.json') ||
    name.includes('review') ||
    name.includes('nlp') ||
    name.includes('texte') ||
    name.includes('text') ||
    name.includes('ticket') ||
    name.includes('corpus')
  ) {
    return 'text';
  }

  // 3. Tabular criteria (CSV, TSV, tables)
  return 'tabular';
}

/**
 * Filters a list of datasets to strictly match the requested modality.
 */
export function filterDatasetsByModality<T extends { name: string; description?: string | null }>(
  datasets: T[],
  modality: ModalityType
): T[] {
  return datasets.filter((d) => getDatasetModality(d) === modality);
}

