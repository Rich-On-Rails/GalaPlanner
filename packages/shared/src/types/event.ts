/**
 * Represents a train gala event
 */
export interface Event {
  /** Unique identifier for the event */
  id: string;
  /** Display name of the event */
  name: string;
  /** Location/venue of the event */
  location: string;
  /** IANA timezone string (e.g., "Europe/London") */
  timezone: string;
  /** Event date(s) as ISO date strings */
  dates: string[];
}
