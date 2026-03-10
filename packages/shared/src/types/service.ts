/**
 * An intermediate stop on a service
 */
export interface ServiceStop {
  /** Station ID */
  stationId: string;
  /** Time at this stop (HH:MM) */
  time: string;
}

/**
 * Represents a single train service/run
 */
export interface Service {
  /** Unique identifier */
  id: string;
  /** Which day of the gala (ISO date string, e.g., "2025-01-03") */
  day: string;
  /** Human-readable day label (e.g., "Saturday 3 January") */
  dayLabel?: string;
  /** Origin station ID */
  originStationId: string;
  /** Destination station ID */
  destStationId: string;
  /** Departure time (HH:MM format) */
  departTime: string;
  /** Arrival time (HH:MM format) */
  arriveTime: string;
  /** IDs of locomotives hauling this service */
  locomotiveIds: string[];
  /** Additional notes about the service */
  serviceNotes: string[];
  /** Confidence in the parsed data (0-1) */
  sourceConfidence: number;
  /** Whether this service has been manually edited by the user */
  isUserEdited?: boolean;
  /** Edit status for display: what the user did to this row */
  editStatus?: 'edited' | 'added' | 'deleted';
  /** Ordered intermediate stops (including origin and destination) */
  stops?: ServiceStop[];
}
