/**
 * Type of locomotive traction
 */
export type LocomotiveType = 'steam' | 'diesel' | 'electric' | 'dmu' | 'other';

/**
 * Represents a locomotive at the gala
 */
export interface Locomotive {
  /** Unique identifier */
  id: string;
  /** Name or number of the locomotive */
  name: string;
  /** Type of traction */
  type: LocomotiveType;
}
