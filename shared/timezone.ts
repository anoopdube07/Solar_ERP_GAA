/**
 * Solar ERP Timezone Utility
 * Authoritative Business Timezone: Asia/Kolkata (IST, UTC+05:30)
 */

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_MINUTES = 330; // 5.5 hours

/**
 * Returns current Date adjusted to Asia/Kolkata timezone
 */
export function getCurrentISTDate(): Date {
  const now = new Date();
  const utcMillis = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMillis + (IST_OFFSET_MINUTES * 60000));
}

/**
 * Format any Date/ISO string to IST readable string
 * e.g. "17 Sep 2026, 04:30 PM IST"
 */
export function formatToIST(dateInput: Date | string | null | undefined, includeTime = true): string {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: includeTime ? '2-digit' : undefined,
    minute: includeTime ? '2-digit' : undefined,
    hour12: true,
  }).format(date);
}

/**
 * Format any Date/ISO string to IST ISO-like string (YYYY-MM-DD HH:mm:ss)
 */
export function formatToISTIso(dateInput: Date | string): string {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(',', '');
}

/**
 * Validate that a scheduled datetime string is strictly in the future
 * relative to the current Asia/Kolkata timestamp.
 */
export function isStrictlyFutureIST(scheduledIsoOrString: string): boolean {
  const targetDate = new Date(scheduledIsoOrString);
  if (isNaN(targetDate.getTime())) return false;

  const now = new Date();
  // Strictly future: target must be greater than current time
  return targetDate.getTime() > now.getTime();
}

/**
 * Check if a date falls on "today" in Asia/Kolkata
 */
export function isTodayIST(dateInput: Date | string): boolean {
  const target = new Date(dateInput);
  if (isNaN(target.getTime())) return false;

  const targetParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(target);

  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return targetParts === todayParts;
}

/**
 * Check if a date in IST is overdue (in the past relative to now)
 */
export function isPastIST(dateInput: Date | string): boolean {
  const target = new Date(dateInput);
  if (isNaN(target.getTime())) return false;
  return target.getTime() < Date.now();
}
