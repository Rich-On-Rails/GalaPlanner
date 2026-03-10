import type { Service, UserConstraints, BreakPeriod } from '@gala-planner/shared';
import { timeToMinutes } from './time-utils.js';

/**
 * Check if a service falls within the user's time window
 */
export function isServiceInTimeWindow(
  service: Service,
  constraints: UserConstraints
): boolean {
  if (!constraints.timeWindow) return true;

  const { start, end } = constraints.timeWindow;
  const departMinutes = timeToMinutes(service.departTime);
  const arriveMinutes = timeToMinutes(service.arriveTime);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  // Service must start after window start and end before window end
  return departMinutes >= startMinutes && arriveMinutes <= endMinutes;
}

/**
 * Check if a break period overlaps with a service
 */
export function doesBreakOverlapService(
  breakPeriod: BreakPeriod,
  service: Service
): boolean {
  const breakStart = timeToMinutes(breakPeriod.start);
  const breakEnd = breakStart + breakPeriod.durationMinutes;
  const serviceDepart = timeToMinutes(service.departTime);
  const serviceArrive = timeToMinutes(service.arriveTime);

  // Overlap if break starts before service ends AND break ends after service starts
  return breakStart < serviceArrive && breakEnd > serviceDepart;
}

/**
 * Check if a service conflicts with any break periods
 */
export function doesServiceConflictWithBreaks(
  service: Service,
  breaks: BreakPeriod[]
): boolean {
  return breaks.some((b) => doesBreakOverlapService(b, service));
}

/**
 * Check if we can transfer from service A to service B
 * considering transfer buffer time and station connectivity
 */
export function canTransfer(
  fromService: Service,
  toService: Service,
  transferBufferMinutes: number
): boolean {
  // Must arrive at a station that connects to the next service's origin
  // For simplicity, we allow transfer if:
  // 1. We arrive at the same station the next train departs from, OR
  // 2. We're at the destination of a service that the next train also visits

  const arriveStation = fromService.destStationId;
  const departStation = toService.originStationId;

  // Same station transfer
  const sameStation = arriveStation === departStation;

  // Check timing: arrival + buffer <= departure
  const arriveMinutes = timeToMinutes(fromService.arriveTime);
  const departMinutes = timeToMinutes(toService.departTime);
  const hasEnoughTime = arriveMinutes + transferBufferMinutes <= departMinutes;

  // For now, require same-station transfers
  // Future: could add station connectivity graph for walking between nearby stations
  return sameStation && hasEnoughTime;
}

/**
 * Check if we can start a service from our current position
 * (used for the first service in a plan, when we arrive at the gala)
 */
export function canStartService(
  service: Service,
  arrivalTime: string,
  arrivalStation: string | null,
  transferBufferMinutes: number
): boolean {
  const serviceDepart = timeToMinutes(service.departTime);
  const arrival = timeToMinutes(arrivalTime);

  // Must have enough time to get there
  if (arrival + transferBufferMinutes > serviceDepart) {
    return false;
  }

  // If we have a specific arrival station, must match
  if (arrivalStation && arrivalStation !== service.originStationId) {
    return false;
  }

  return true;
}

/**
 * Filter services that are feasible given constraints
 */
export function filterFeasibleServices(
  services: Service[],
  constraints: UserConstraints
): Service[] {
  return services.filter((service) => {
    // Must be in time window
    if (!isServiceInTimeWindow(service, constraints)) {
      return false;
    }

    // Must not conflict with breaks
    if (doesServiceConflictWithBreaks(service, constraints.breaks)) {
      return false;
    }

    // Must not be at avoided stations
    const avoided = constraints.stationPreferences.avoid;
    if (
      avoided.includes(service.originStationId) ||
      avoided.includes(service.destStationId)
    ) {
      return false;
    }

    return true;
  });
}
