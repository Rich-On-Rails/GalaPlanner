import type { Plan } from '../types/plan';
import type { UserConstraints } from '../types/user-constraints';
import type { PlanAnalysis } from '../types/explanation';

/**
 * Request to generate plans
 */
export interface PlanRequest {
  /** ID of the uploaded parse result to plan from */
  parseResultId: string;
  /** User constraints for the plan */
  constraints: UserConstraints;
  /** Maximum number of plans to return */
  maxPlans?: number;
  /** Whether to include analysis */
  includeExplanations?: boolean;
  /** Day ID to filter services (for multi-day timetables) */
  dayId?: string;
}

/**
 * A plan with its analysis
 */
export interface PlanWithAnalysis {
  plan: Plan;
  analysis?: PlanAnalysis;
}

/**
 * Response from plan generation
 */
export interface PlanResponse {
  /** Whether planning succeeded */
  success: boolean;
  /** Generated plans (best first) */
  plans?: Plan[];
  /** Plans with analysis (if requested) */
  plansWithAnalysis?: PlanWithAnalysis[];
  /** Error message if failed */
  error?: string;
}
