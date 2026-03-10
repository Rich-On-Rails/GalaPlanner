import { randomUUID } from 'crypto';
import type {
  Service,
  Station,
  Locomotive,
  UserConstraints,
  BreakPeriod,
  Plan,
  PlanLeg,
  PlanExplanation,
} from '@gala-planner/shared';
import { filterFeasibleServices, canTransfer, canStartService } from './feasibility';
import { timeToMinutes, timeDifferenceMinutes } from './time-utils';

interface PlannerInput {
  services: Service[];
  stations: Station[];
  locomotives: Locomotive[];
  constraints: UserConstraints;
  maxPlans: number;
}

interface CandidatePlan {
  legs: PlanLeg[];
  locomotivesSeen: Set<string>;
  lastService: Service | null;
  totalIdleMinutes: number;
}

/**
 * Expand services at all intermediate stops into partial rides.
 * For a service with stops [A, B, C, D], creates virtual services
 * for every pair: A→B, A→C, A→D, B→C, B→D, C→D.
 * This allows the planner to board/alight at any intermediate station.
 * The full service (A→D) retains its original ID.
 */
function expandAllServiceStops(services: Service[]): Service[] {
  const expanded: Service[] = [];

  for (const service of services) {
    if (!service.stops || service.stops.length <= 2) {
      expanded.push(service);
      continue;
    }

    for (let i = 0; i < service.stops.length; i++) {
      for (let j = i + 1; j < service.stops.length; j++) {
        const fromStop = service.stops[i];
        const toStop = service.stops[j];
        const isFullService = i === 0 && j === service.stops.length - 1;

        expanded.push({
          ...service,
          id: isFullService ? service.id : `${service.id}__${i}_${j}`,
          originStationId: fromStop.stationId,
          destStationId: toStop.stationId,
          departTime: fromStop.time,
          arriveTime: toStop.time,
          stops: service.stops.slice(i, j + 1),
        });
      }
    }
  }

  return expanded;
}

/**
 * Extract the parent (physical) service ID from a virtual service ID.
 * Virtual IDs use the format "{parentId}__{fromIdx}_{toIdx}".
 */
function getParentServiceId(serviceId: string): string {
  const idx = serviceId.indexOf('__');
  return idx >= 0 ? serviceId.substring(0, idx) : serviceId;
}

/**
 * Get station name from ID
 */
function getStationName(stations: Station[], id: string): string {
  return stations.find((s) => s.id === id)?.name || id;
}

/**
 * Compute locos seen from platforms during gaps between legs.
 * When waiting at a station, any service passing through counts as a sighting.
 */
function computePlatformSightings(
  legs: PlanLeg[],
  allServices: Service[]
): Set<string> {
  const platformLocos = new Set<string>();

  for (let i = 0; i < legs.length - 1; i++) {
    const waitStation = legs[i].alightStationId;
    const gapStart = timeToMinutes(legs[i].service.arriveTime);
    const gapEnd = timeToMinutes(legs[i + 1].service.departTime);
    if (gapEnd <= gapStart) continue;

    for (const svc of allServices) {
      if (!svc.stops) continue;
      for (const stop of svc.stops) {
        if (stop.stationId === waitStation) {
          const stopTime = timeToMinutes(stop.time);
          if (stopTime >= gapStart && stopTime <= gapEnd) {
            for (const locoId of svc.locomotiveIds) {
              platformLocos.add(locoId);
            }
          }
          break;
        }
      }
    }
  }

  return platformLocos;
}

/**
 * Generate optimal viewing plans
 */
export function generatePlans(input: PlannerInput): Plan[] {
  const { services, stations, constraints, maxPlans } = input;

  // Expand all services at intermediate stops into partial rides BEFORE
  // feasibility filtering, so partial rides that don't overlap with breaks
  // survive even when the full service would be filtered out.
  const expandedServices = expandAllServiceStops(services);

  // Filter to feasible services
  const feasibleServices = filterFeasibleServices(expandedServices, constraints);

  if (feasibleServices.length === 0) {
    return [];
  }

  // Sort services by departure time
  const sortedServices = [...feasibleServices].sort((a, b) =>
    timeToMinutes(a.departTime) - timeToMinutes(b.departTime)
  );

  // Generate candidate plans using depth-first search
  const candidates: CandidatePlan[] = [];
  const startTime = constraints.timeWindow?.start || '00:00';

  // Limit starting services to prevent explosion
  const MAX_STARTS = 20;
  const startStation = constraints.startStationId || null;
  const startableServices = sortedServices
    .filter((s) => canStartService(s, startTime, startStation, constraints.transferBufferMinutes))
    .slice(0, MAX_STARTS);

  // Try starting from each feasible service
  for (const firstService of startableServices) {
    if (candidates.length >= 2000) break;

    const initialPlan: CandidatePlan = {
      legs: [createLeg(firstService)],
      locomotivesSeen: new Set(firstService.locomotiveIds),
      lastService: firstService,
      totalIdleMinutes: 0,
    };

    // Recursively extend this plan
    extendPlan(initialPlan, sortedServices, constraints, candidates, 0);
  }

  // Also add single-service plans if we haven't found any
  if (candidates.length === 0) {
    for (const service of sortedServices) {
      candidates.push({
        legs: [createLeg(service)],
        locomotivesSeen: new Set(service.locomotiveIds),
        lastService: service,
        totalIdleMinutes: 0,
      });
    }
  }

  // Score and sort plans
  const scoredPlans = candidates.map((candidate) =>
    scorePlan(candidate, constraints, input.locomotives, services, stations)
  );

  // Sort by score (descending) and take top N
  scoredPlans.sort((a, b) => b.score - a.score);

  // Remove duplicates (plans with same legs)
  const uniquePlans = deduplicatePlans(scoredPlans);

  return uniquePlans.slice(0, maxPlans);
}

/**
 * Create a plan leg from a service
 */
function createLeg(service: Service): PlanLeg {
  return {
    service,
    boardStationId: service.originStationId,
    alightStationId: service.destStationId,
    locomotivesSeen: [...service.locomotiveIds],
  };
}

/**
 * Recursively extend a plan with additional services
 */
function extendPlan(
  current: CandidatePlan,
  services: Service[],
  constraints: UserConstraints,
  results: CandidatePlan[],
  depth: number
): void {
  // Limit recursion depth to avoid explosion
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) {
    results.push({ ...current });
    return;
  }

  // Limit total results to avoid memory explosion
  const MAX_RESULTS = 2000;
  if (results.length >= MAX_RESULTS) {
    return;
  }

  // Find all services we can transfer to
  const possibleNext = services.filter((s) => {
    // Don't use another segment of a service we're already riding
    const parentId = getParentServiceId(s.id);
    if (current.legs.some((leg) => getParentServiceId(leg.service.id) === parentId)) {
      return false;
    }

    // Must be able to transfer from current position
    if (!current.lastService) return true;
    return canTransfer(current.lastService, s, constraints.transferBufferMinutes);
  });

  // If no more services, save this plan
  if (possibleNext.length === 0) {
    results.push({ ...current });
    return;
  }

  // Save longer plans as intermediates so we don't only get terminal plans.
  // Threshold of 4+ avoids flooding the pool with short 2-3 leg plans,
  // letting the DFS explore deeper and produce day-filling plans.
  if (current.legs.length >= 4) {
    results.push({ ...current });
  }

  // Limit branching to avoid explosion - only try best candidates
  const MAX_BRANCHES = 5;
  const lastArriveMinutes = current.lastService
    ? timeToMinutes(current.lastService.arriveTime)
    : 0;
  const sortedNext = [...possibleNext]
    .map((s) => ({
      service: s,
      // Score by new locos seen
      newLocos: s.locomotiveIds.filter((id) => !current.locomotivesSeen.has(id)).length,
      // Score by must-see locos
      mustSee: s.locomotiveIds.filter((id) => constraints.mustSeeLocoIds.includes(id)).length,
      // Idle time to this service (lower is better as tiebreaker)
      idleTime: timeToMinutes(s.departTime) - lastArriveMinutes,
    }))
    .sort((a, b) => {
      const locoScore = (b.newLocos + b.mustSee * 2) - (a.newLocos + a.mustSee * 2);
      if (locoScore !== 0) return locoScore;
      // When loco scores are equal, prefer shorter waits (fill the day)
      return a.idleTime - b.idleTime;
    })
    .slice(0, MAX_BRANCHES);

  // Try extending with each possible next service
  for (const { service: nextService } of sortedNext) {
    if (results.length >= MAX_RESULTS) break;

    // Calculate idle time
    let idleMinutes = 0;
    if (current.lastService) {
      idleMinutes = timeDifferenceMinutes(
        current.lastService.arriveTime,
        nextService.departTime
      );
    }

    const extended: CandidatePlan = {
      legs: [...current.legs, createLeg(nextService)],
      locomotivesSeen: new Set([
        ...current.locomotivesSeen,
        ...nextService.locomotiveIds,
      ]),
      lastService: nextService,
      totalIdleMinutes: current.totalIdleMinutes + idleMinutes,
    };

    extendPlan(extended, services, constraints, results, depth + 1);
  }
}

/**
 * Calculate how many minutes of idle gaps between legs are covered by breaks
 */
function calculateBreakOverlapMinutes(
  legs: PlanLeg[],
  breaks: BreakPeriod[]
): number {
  if (breaks.length === 0 || legs.length < 2) return 0;

  let totalOverlap = 0;

  for (let i = 0; i < legs.length - 1; i++) {
    const gapStart = timeToMinutes(legs[i].service.arriveTime);
    const gapEnd = timeToMinutes(legs[i + 1].service.departTime);
    if (gapEnd <= gapStart) continue;

    for (const bp of breaks) {
      const breakStart = timeToMinutes(bp.start);
      const breakEnd = breakStart + bp.durationMinutes;

      const overlapStart = Math.max(gapStart, breakStart);
      const overlapEnd = Math.min(gapEnd, breakEnd);
      if (overlapEnd > overlapStart) {
        totalOverlap += overlapEnd - overlapStart;
      }
    }
  }

  return totalOverlap;
}

/**
 * Check if a plan has a leg arriving at a station around the time of a break
 */
function isAtStationDuringBreak(
  legs: PlanLeg[],
  stationId: string,
  bp: BreakPeriod
): boolean {
  const breakStart = timeToMinutes(bp.start);
  const breakEnd = breakStart + bp.durationMinutes;

  for (let i = 0; i < legs.length - 1; i++) {
    const arriveMinutes = timeToMinutes(legs[i].service.arriveTime);
    const departMinutes = timeToMinutes(legs[i + 1].service.departTime);

    // Check if the gap between these legs overlaps with the break
    // and the arrival station matches the preferred station
    if (arriveMinutes < breakEnd && departMinutes > breakStart) {
      if (legs[i].alightStationId === stationId) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Score a candidate plan
 */
function scorePlan(
  candidate: CandidatePlan,
  constraints: UserConstraints,
  locomotives: Locomotive[],
  allServices: Service[],
  stations: Station[]
): Plan {
  const explanations: PlanExplanation[] = [];

  // Compute platform sightings (locos seen from station while waiting)
  const platformLocos = computePlatformSightings(candidate.legs, allServices);
  const allSeenLocos = new Set([...candidate.locomotivesSeen, ...platformLocos]);
  const platformOnlyCount = [...platformLocos].filter(
    (id) => !candidate.locomotivesSeen.has(id)
  ).length;

  // Base score: number of unique locomotives seen (weighted heavily)
  const uniqueLocoCount = allSeenLocos.size;
  let score = uniqueLocoCount * 1000;

  // Bonus for must-see locomotives (includes platform sightings)
  const mustSeeFound = constraints.mustSeeLocoIds.filter((id) =>
    allSeenLocos.has(id)
  );
  const mustSeeMissing = constraints.mustSeeLocoIds.filter(
    (id) => !allSeenLocos.has(id)
  );

  score += mustSeeFound.length * 500;

  if (mustSeeFound.length > 0) {
    const locoNames = mustSeeFound
      .map((id) => locomotives.find((l) => l.id === id)?.name || id)
      .join(', ');
    explanations.push({
      type: 'included',
      message: `Includes must-see: ${locoNames}`,
      relatedLocoIds: mustSeeFound,
    });
  }

  if (mustSeeMissing.length > 0) {
    const locoNames = mustSeeMissing
      .map((id) => locomotives.find((l) => l.id === id)?.name || id)
      .join(', ');
    explanations.push({
      type: 'excluded',
      message: `Missing must-see: ${locoNames}`,
      relatedLocoIds: mustSeeMissing,
    });
  }

  // Penalty for idle time (prefer efficient plans)
  // Subtract break overlap so time spent on breaks isn't penalised
  const breakOverlap = calculateBreakOverlapMinutes(candidate.legs, constraints.breaks);
  score -= (candidate.totalIdleMinutes - breakOverlap) * 2;

  // Bonus for being at preferred break station
  for (const bp of constraints.breaks) {
    if (bp.preferredStationId && isAtStationDuringBreak(candidate.legs, bp.preferredStationId, bp)) {
      score += 200;
      explanations.push({
        type: 'included',
        message: `${bp.label || 'Break'} at preferred station`,
        relatedLocoIds: [],
      });
    }
  }

  // Bonus for preferred stations
  const preferredStations = constraints.stationPreferences.prefer;
  const visitedStations = new Set<string>();
  for (const leg of candidate.legs) {
    visitedStations.add(leg.boardStationId);
    visitedStations.add(leg.alightStationId);
  }
  const preferredVisited = preferredStations.filter((s) => visitedStations.has(s));
  score += preferredVisited.length * 100;

  // Bonus for more legs (more activity — fill the day with rides)
  score += candidate.legs.length * 200;

  // Bonus for covering more of the time window (prefer plans that fill the day)
  if (constraints.timeWindow && candidate.legs.length > 0) {
    const windowStart = timeToMinutes(constraints.timeWindow.start);
    const windowEnd = timeToMinutes(constraints.timeWindow.end);
    const windowDuration = windowEnd - windowStart;

    if (windowDuration > 0) {
      const planStart = timeToMinutes(candidate.legs[0].service.departTime);
      const planEnd = timeToMinutes(
        candidate.legs[candidate.legs.length - 1].service.arriveTime
      );
      const planDuration = planEnd - planStart;
      const coverageRatio = Math.min(planDuration / windowDuration, 1);
      score += Math.round(coverageRatio * 1000);
    }
  }

  // Bonus/penalty for ending at the required station
  if (constraints.endStationId) {
    const lastLeg = candidate.legs[candidate.legs.length - 1];
    if (lastLeg && lastLeg.alightStationId === constraints.endStationId) {
      score += 5000;
      explanations.push({
        type: 'included',
        message: `Returns to ${getStationName(stations, constraints.endStationId)}`,
        relatedLocoIds: [],
      });
    } else {
      score -= 5000;
      explanations.push({
        type: 'excluded',
        message: `Does not return to ${getStationName(stations, constraints.endStationId)}`,
        relatedLocoIds: [],
      });
    }
  }

  // Add explanation for coverage
  const coverageMsg = platformOnlyCount > 0
    ? `Sees ${uniqueLocoCount} unique locomotive${uniqueLocoCount !== 1 ? 's' : ''} across ${candidate.legs.length} train${candidate.legs.length !== 1 ? 's' : ''} (${platformOnlyCount} spotted from platform)`
    : `Sees ${uniqueLocoCount} unique locomotive${uniqueLocoCount !== 1 ? 's' : ''} across ${candidate.legs.length} train${candidate.legs.length !== 1 ? 's' : ''}`;
  explanations.push({
    type: 'included',
    message: coverageMsg,
    relatedLocoIds: [...allSeenLocos],
  });

  return {
    id: randomUUID(),
    legs: candidate.legs,
    uniqueLocosSeen: [...allSeenLocos],
    score,
    explanations,
  };
}

/**
 * Remove duplicate plans (same sequence of services)
 */
function deduplicatePlans(plans: Plan[]): Plan[] {
  const seen = new Set<string>();
  const unique: Plan[] = [];

  for (const plan of plans) {
    const key = plan.legs.map((l) => l.service.id).join(',');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(plan);
    }
  }

  return unique;
}
