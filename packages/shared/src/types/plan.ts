import type { Service } from './service';

/**
 * One leg of a plan
 */
export interface PlanLeg {
  /** The service being ridden */
  service: Service;
  /** Which station to board at */
  boardStationId: string;
  /** Which station to alight at */
  alightStationId: string;
  /** Locomotives seen on this leg */
  locomotivesSeen: string[];
}

/**
 * Explanation for a plan decision
 */
export interface PlanExplanation {
  /** Type of explanation */
  type: 'included' | 'excluded' | 'conflict' | 'tradeoff';
  /** Human-readable explanation */
  message: string;
  /** Related locomotive IDs */
  relatedLocoIds?: string[];
  /** Related service IDs */
  relatedServiceIds?: string[];
}

/**
 * A complete viewing plan
 */
export interface Plan {
  /** Unique identifier */
  id: string;
  /** Ordered list of legs */
  legs: PlanLeg[];
  /** Unique locomotive IDs seen in this plan */
  uniqueLocosSeen: string[];
  /** Computed score */
  score: number;
  /** Explanations for plan decisions */
  explanations: PlanExplanation[];
}
