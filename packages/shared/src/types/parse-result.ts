import type { Service } from './service';
import type { Station } from './station';
import type { Locomotive } from './locomotive';
import type { ParseIssue } from './parse-issue';

/**
 * Represents a day/date found in the timetable
 */
export interface TimetableDay {
  /** Unique identifier for this day (e.g., "2025-01-03") */
  id: string;
  /** Display label (e.g., "Saturday 3 January") */
  label: string;
  /** Number of services on this day */
  serviceCount: number;
}

/**
 * Result of parsing an uploaded file
 */
export interface ParseResult {
  /** Unique ID for this parse result */
  id: string;
  /** Original filename */
  fileName: string;
  /** When the file was uploaded (ISO timestamp) */
  uploadedAt: string;
  /** Extracted services */
  services: Service[];
  /** Extracted stations */
  stations: Station[];
  /** Extracted locomotives */
  locomotives: Locomotive[];
  /** Issues encountered during parsing */
  issues: ParseIssue[];
  /** Available days in the timetable (for multi-day files) */
  availableDays?: TimetableDay[];
}
