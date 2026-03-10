/**
 * Detailed analysis of a generated plan
 */
export interface PlanAnalysis {
  /** Natural language summary of the plan */
  summary: string;
  /** Key highlights about the plan */
  highlights: string[];
  /** Explanations for locomotives not included in the plan */
  missedLocos: MissedLocoExplanation[];
  /** How constraints affected the plan */
  constraintImpacts: ConstraintImpact[];
  /** Suggestions for improving the plan */
  suggestions: Suggestion[];
}

/**
 * Explanation for why a locomotive was missed
 */
export interface MissedLocoExplanation {
  locoId: string;
  locoName: string;
  reason: MissedReason;
  details: string;
  fixOption?: string;
}

/**
 * Reasons why a locomotive might be missed
 */
export type MissedReason =
  | 'time_window'
  | 'transfer_impossible'
  | 'overlap'
  | 'no_services'
  | 'station_preference';

/**
 * Impact of a constraint on the plan
 */
export interface ConstraintImpact {
  constraint: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

/**
 * Suggestion for improving a plan
 */
export interface Suggestion {
  type: 'arrival' | 'departure' | 'must_see' | 'transfer_buffer' | 'break';
  description: string;
  potentialGain: string;
}
