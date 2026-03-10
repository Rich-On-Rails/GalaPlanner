/**
 * Convert HH:MM time string to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

/**
 * Convert minutes since midnight to HH:MM string
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if time A is before or equal to time B
 */
export function isTimeBeforeOrEqual(timeA: string, timeB: string): boolean {
  return timeToMinutes(timeA) <= timeToMinutes(timeB);
}

/**
 * Check if time A is after time B
 */
export function isTimeAfter(timeA: string, timeB: string): boolean {
  return timeToMinutes(timeA) > timeToMinutes(timeB);
}

/**
 * Get the difference in minutes between two times
 */
export function timeDifferenceMinutes(earlier: string, later: string): number {
  return timeToMinutes(later) - timeToMinutes(earlier);
}

/**
 * Check if a time falls within a window
 */
export function isTimeInWindow(
  time: string,
  windowStart: string,
  windowEnd: string
): boolean {
  const t = timeToMinutes(time);
  const start = timeToMinutes(windowStart);
  const end = timeToMinutes(windowEnd);
  return t >= start && t <= end;
}
