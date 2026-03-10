/**
 * Time window constraint
 */
export interface TimeWindow {
  /** Earliest time user can start (HH:MM) */
  start: string;
  /** Latest time user needs to finish (HH:MM) */
  end: string;
}

/**
 * Break period the user needs
 */
export interface BreakPeriod {
  /** Start time of break (HH:MM) */
  start: string;
  /** Duration in minutes */
  durationMinutes: number;
  /** Optional label */
  label?: string;
  /** Optional preferred station to be at during break */
  preferredStationId?: string;
}

/**
 * User-defined constraints for planning
 */
export interface UserConstraints {
  /** Time window for the day */
  timeWindow?: TimeWindow;
  /** Locomotives the user must see */
  mustSeeLocoIds: string[];
  /** Stations to prefer or avoid */
  stationPreferences: {
    prefer: string[];
    avoid: string[];
  };
  /** Break periods */
  breaks: BreakPeriod[];
  /** Minimum minutes needed to transfer between trains */
  transferBufferMinutes: number;
  /** Station where the user starts their day */
  startStationId?: string;
  /** Station where the user needs to return to */
  endStationId?: string;
}
