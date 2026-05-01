/**
 * dateUtils.ts — Timezone-Safe Date Utilities
 *
 * Problem: new Date().toISOString() returns UTC time.
 * For users in UTC+3, a transaction at 23:30 local time
 * is recorded as 20:30 UTC → appears as "yesterday" in the DB.
 *
 * Solution: Read local device fields (getFullYear, getMonth, getDate)
 * which always reflect the user's local timezone, regardless of UTC offset.
 *
 * Time Complexity: O(1). Zero external deps.
 */

/**
 * Returns a YYYY-MM-DD string using the LOCAL device date.
 * Safe for any UTC offset (UTC-12 to UTC+14).
 *
 * @param d - Date object (defaults to now)
 * @returns "YYYY-MM-DD" in local timezone
 */
export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
