/**
 * Represents a station/stop on the railway
 */
export interface Station {
  /** Unique identifier */
  id: string;
  /** Primary display name */
  name: string;
  /** Alternative names that map to this station */
  aliases: string[];
}
