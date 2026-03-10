import type {
  Plan,
  Service,
  Station,
  Locomotive,
  UserConstraints,
  PlanAnalysis,
  MissedLocoExplanation,
  ConstraintImpact,
  Suggestion,
} from '@gala-planner/shared';
import { timeToMinutes } from './time-utils.js';

interface ExplainerContext {
  services: Service[];
  stations: Station[];
  locomotives: Locomotive[];
  constraints: UserConstraints;
}

/**
 * Get station name from ID
 */
function getStationName(stations: Station[], id: string): string {
  const station = stations.find((s) => s.id === id);
  return station?.name || id;
}

/**
 * Get locomotive name from ID
 */
function getLocoName(locomotives: Locomotive[], id: string): string {
  const loco = locomotives.find((l) => l.id === id);
  return loco?.name || id;
}

/**
 * Find all services for a specific locomotive
 */
function getServicesForLoco(services: Service[], locoId: string): Service[] {
  return services.filter((s) => s.locomotiveIds.includes(locoId));
}

/**
 * Check if a service is within the user's time window
 */
function isWithinTimeWindow(service: Service, constraints: UserConstraints): boolean {
  if (!constraints.timeWindow) return true;

  const { start, end } = constraints.timeWindow;
  const departMins = timeToMinutes(service.departTime);
  const arriveMins = timeToMinutes(service.arriveTime);
  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);

  return departMins >= startMins && arriveMins <= endMins;
}

/**
 * Check if transfer is possible between two services
 */
function canTransfer(
  fromService: Service,
  toService: Service,
  bufferMinutes: number
): boolean {
  // Must be at the same station
  if (fromService.destStationId !== toService.originStationId) {
    return false;
  }

  // Must have enough time
  const arriveTime = timeToMinutes(fromService.arriveTime);
  const departTime = timeToMinutes(toService.departTime);
  return departTime - arriveTime >= bufferMinutes;
}

/**
 * Analyze why a locomotive was missed in the plan
 */
function analyzeMissedLoco(
  locoId: string,
  plan: Plan,
  context: ExplainerContext
): MissedLocoExplanation | null {
  const { services, locomotives, constraints } = context;

  const locoName = getLocoName(locomotives, locoId);
  const locoServices = getServicesForLoco(services, locoId);

  // Check if loco has no services at all
  if (locoServices.length === 0) {
    return {
      locoId,
      locoName,
      reason: 'no_services',
      details: `${locoName} has no scheduled services in this timetable.`,
    };
  }

  // Check if all services are outside time window
  const servicesInWindow = locoServices.filter((s) => isWithinTimeWindow(s, constraints));
  if (servicesInWindow.length === 0 && constraints.timeWindow) {
    const firstService = locoServices[0];
    const lastService = locoServices[locoServices.length - 1];
    return {
      locoId,
      locoName,
      reason: 'time_window',
      details: `${locoName}'s services (${firstService.departTime}-${lastService.arriveTime}) are outside your time window (${constraints.timeWindow.start}-${constraints.timeWindow.end}).`,
      fixOption: `Extend your time window to include services starting at ${firstService.departTime}.`,
    };
  }

  // Check for transfer impossibility - can we reach any of the loco's services from the plan?
  const planLegs = plan.legs;
  if (planLegs.length > 0) {
    const lastLeg = planLegs[planLegs.length - 1];
    const lastService = lastLeg.service;

    // Find if any loco service is reachable after the last plan leg
    const reachableServices = servicesInWindow.filter((locoSvc) => {
      return canTransfer(lastService, locoSvc, constraints.transferBufferMinutes);
    });

    if (reachableServices.length === 0) {
      return {
        locoId,
        locoName,
        reason: 'transfer_impossible',
        details: `Cannot transfer to ${locoName}'s services from your planned route. The stations or timing don't align.`,
        fixOption: 'Consider reducing the number of trains to leave time for transfer.',
      };
    }
  }

  // Check for overlap with existing plan legs
  for (const locoSvc of servicesInWindow) {
    const departMins = timeToMinutes(locoSvc.departTime);
    const arriveMins = timeToMinutes(locoSvc.arriveTime);

    for (const leg of planLegs) {
      const legService = leg.service;
      const legDepartMins = timeToMinutes(legService.departTime);
      const legArriveMins = timeToMinutes(legService.arriveTime);

      // Check overlap
      if (departMins < legArriveMins && arriveMins > legDepartMins) {
        return {
          locoId,
          locoName,
          reason: 'overlap',
          details: `${locoName}'s service (${locoSvc.departTime}-${locoSvc.arriveTime}) overlaps with a higher-priority train in your plan.`,
          fixOption: `To see ${locoName}, you would need to skip some other locomotives.`,
        };
      }
    }
  }

  return null;
}

/**
 * Generate suggestions for improving the plan
 */
function generateSuggestions(
  plan: Plan,
  allLocos: Locomotive[],
  context: ExplainerContext
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const { services, constraints } = context;
  const missedLocos = allLocos.filter((l) => !plan.uniqueLocosSeen.includes(l.id));

  if (!constraints.timeWindow) return suggestions;

  // Suggest earlier arrival if locomotives are missed due to time window
  const earlyLocos = missedLocos.filter((loco) => {
    const locoServices = getServicesForLoco(services, loco.id);
    return locoServices.some((s) => {
      const departMins = timeToMinutes(s.departTime);
      const startMins = timeToMinutes(constraints.timeWindow!.start);
      return departMins < startMins;
    });
  });

  if (earlyLocos.length > 0) {
    const locoNames = earlyLocos.slice(0, 2).map((l) => l.name).join(' and ');
    suggestions.push({
      type: 'arrival',
      description: `Arrive earlier to potentially see ${locoNames}${earlyLocos.length > 2 ? ` and ${earlyLocos.length - 2} more` : ''}.`,
      potentialGain: `+${earlyLocos.length} locomotives`,
    });
  }

  // Suggest later departure if locomotives are missed
  const lateLocos = missedLocos.filter((loco) => {
    const locoServices = getServicesForLoco(services, loco.id);
    return locoServices.some((s) => {
      const arriveMins = timeToMinutes(s.arriveTime);
      const endMins = timeToMinutes(constraints.timeWindow!.end);
      return arriveMins > endMins;
    });
  });

  if (lateLocos.length > 0) {
    const locoNames = lateLocos.slice(0, 2).map((l) => l.name).join(' and ');
    suggestions.push({
      type: 'departure',
      description: `Stay later to potentially see ${locoNames}${lateLocos.length > 2 ? ` and ${lateLocos.length - 2} more` : ''}.`,
      potentialGain: `+${lateLocos.length} locomotives`,
    });
  }

  // Suggest adjusting breaks if preferred station wasn't reachable
  for (const bp of constraints.breaks) {
    if (bp.preferredStationId) {
      const breakStart = timeToMinutes(bp.start);
      const breakEnd = breakStart + bp.durationMinutes;
      let atPreferred = false;

      for (let i = 0; i < plan.legs.length - 1; i++) {
        const arriveMin = timeToMinutes(plan.legs[i].service.arriveTime);
        const departMin = timeToMinutes(plan.legs[i + 1].service.departTime);
        if (arriveMin < breakEnd && departMin > breakStart &&
            plan.legs[i].alightStationId === bp.preferredStationId) {
          atPreferred = true;
          break;
        }
      }

      if (!atPreferred) {
        const stationName = getStationName(context.stations, bp.preferredStationId);
        suggestions.push({
          type: 'break',
          description: `Couldn't route through ${stationName} for ${bp.label || 'break'} — consider changing the preferred station or adjusting the time.`,
          potentialGain: 'Break at preferred station',
        });
      }
    }
  }

  // Suggest reducing transfer buffer if it's high
  if (constraints.transferBufferMinutes > 10 && missedLocos.length > 0) {
    suggestions.push({
      type: 'transfer_buffer',
      description: `Reduce transfer buffer from ${constraints.transferBufferMinutes} to 10 minutes to allow tighter connections.`,
      potentialGain: 'More flexible scheduling',
    });
  }

  return suggestions;
}

/**
 * Analyze constraint impacts on the plan
 */
function analyzeConstraintImpacts(
  plan: Plan,
  context: ExplainerContext
): ConstraintImpact[] {
  const impacts: ConstraintImpact[] = [];
  const { constraints } = context;

  // Time window impact
  if (constraints.timeWindow) {
    const windowHours =
      (timeToMinutes(constraints.timeWindow.end) -
        timeToMinutes(constraints.timeWindow.start)) /
      60;
    impacts.push({
      constraint: 'Time Window',
      impact: windowHours >= 6 ? 'positive' : windowHours >= 4 ? 'neutral' : 'negative',
      description:
        windowHours >= 6
          ? `${windowHours.toFixed(1)} hour window gives good coverage.`
          : `${windowHours.toFixed(1)} hour window limits options.`,
    });
  }

  // Must-see locos impact
  const mustSeeCount = constraints.mustSeeLocoIds.length;
  if (mustSeeCount > 0) {
    const seenMustSee = constraints.mustSeeLocoIds.filter((id) =>
      plan.uniqueLocosSeen.includes(id)
    );
    impacts.push({
      constraint: 'Must-See Locomotives',
      impact: seenMustSee.length === mustSeeCount ? 'positive' : 'negative',
      description:
        seenMustSee.length === mustSeeCount
          ? `All ${mustSeeCount} must-see locomotives included.`
          : `${seenMustSee.length} of ${mustSeeCount} must-see locomotives included.`,
    });
  }

  // Breaks impact
  if (constraints.breaks.length > 0) {
    impacts.push({
      constraint: 'Breaks',
      impact: 'neutral',
      description: `${constraints.breaks.length} break${constraints.breaks.length > 1 ? 's' : ''} scheduled, filtering out conflicting services.`,
    });
  }

  // Start/end station impact
  if (constraints.startStationId || constraints.endStationId) {
    const parts: string[] = [];
    if (constraints.startStationId) {
      parts.push(`starting at ${getStationName(context.stations, constraints.startStationId)}`);
    }
    if (constraints.endStationId) {
      parts.push(`returning to ${getStationName(context.stations, constraints.endStationId)}`);
    }
    impacts.push({
      constraint: 'Station Route',
      impact: 'neutral',
      description: `Plan constrained to ${parts.join(' and ')}.`,
    });
  }

  // Transfer buffer impact
  impacts.push({
    constraint: 'Transfer Buffer',
    impact:
      constraints.transferBufferMinutes <= 10
        ? 'positive'
        : constraints.transferBufferMinutes <= 20
          ? 'neutral'
          : 'negative',
    description: `${constraints.transferBufferMinutes} min buffer between trains.`,
  });

  return impacts;
}

/**
 * Generate a natural language summary of the plan
 */
function generateSummary(
  plan: Plan,
  totalLocos: number,
  context: ExplainerContext
): string {
  const { constraints, stations } = context;
  const coverage = ((plan.uniqueLocosSeen.length / totalLocos) * 100).toFixed(0);

  // Find first and last stations
  const firstLeg = plan.legs[0];
  const lastLeg = plan.legs[plan.legs.length - 1];

  let summary = `This plan sees ${plan.uniqueLocosSeen.length} of ${totalLocos} locomotives (${coverage}% coverage).`;

  if (firstLeg && lastLeg) {
    const startStation = getStationName(stations, firstLeg.service.originStationId);
    const endStation = getStationName(stations, lastLeg.service.destStationId);
    summary += ` Starting from ${startStation} at ${firstLeg.service.departTime} and ending at ${endStation} by ${lastLeg.service.arriveTime}.`;
  }

  // Mention must-sees
  const mustSeeCount = constraints.mustSeeLocoIds.length;
  if (mustSeeCount > 0) {
    const seenMustSee = constraints.mustSeeLocoIds.filter((id) =>
      plan.uniqueLocosSeen.includes(id)
    );
    if (seenMustSee.length === mustSeeCount) {
      summary += ` All ${mustSeeCount} must-see locomotives are included.`;
    } else if (seenMustSee.length > 0) {
      summary += ` Includes ${seenMustSee.length} of ${mustSeeCount} must-see locomotives.`;
    }
  }

  return summary;
}

/**
 * Generate highlights about the plan
 */
function generateHighlights(
  plan: Plan,
  context: ExplainerContext
): string[] {
  const { locomotives } = context;
  const highlights: string[] = [];

  // Highlight the locomotives seen
  if (plan.uniqueLocosSeen.length > 0) {
    const locoNames = plan.uniqueLocosSeen
      .slice(0, 3)
      .map((id) => getLocoName(locomotives, id));
    highlights.push(
      `See ${locoNames.join(', ')}${plan.uniqueLocosSeen.length > 3 ? ` and ${plan.uniqueLocosSeen.length - 3} more` : ''}.`
    );
  }

  // Highlight quick transfers
  const quickTransfers = plan.legs.filter((leg, i) => {
    if (i === 0) return false;
    const prevLeg = plan.legs[i - 1];
    const waitTime =
      timeToMinutes(leg.service.departTime) - timeToMinutes(prevLeg.service.arriveTime);
    return waitTime <= 15;
  });

  if (quickTransfers.length > 0) {
    highlights.push(`${quickTransfers.length} efficient transfer${quickTransfers.length > 1 ? 's' : ''} with minimal waiting.`);
  }

  // Highlight variety of stations
  const uniqueStations = new Set<string>();
  for (const leg of plan.legs) {
    uniqueStations.add(leg.service.originStationId);
    uniqueStations.add(leg.service.destStationId);
  }
  if (uniqueStations.size >= 3) {
    highlights.push(`Visit ${uniqueStations.size} different stations.`);
  }

  return highlights;
}

/**
 * Main function to analyze a plan
 */
export function explainPlan(
  plan: Plan,
  services: Service[],
  stations: Station[],
  locomotives: Locomotive[],
  constraints: UserConstraints
): PlanAnalysis {
  const context: ExplainerContext = {
    services,
    stations,
    locomotives,
    constraints,
  };

  // Find missed locomotives
  const missedLocoIds = locomotives
    .map((l) => l.id)
    .filter((id) => !plan.uniqueLocosSeen.includes(id));

  const missedLocos: MissedLocoExplanation[] = [];
  for (const locoId of missedLocoIds) {
    const explanation = analyzeMissedLoco(locoId, plan, context);
    if (explanation) {
      missedLocos.push(explanation);
    }
  }

  return {
    summary: generateSummary(plan, locomotives.length, context),
    highlights: generateHighlights(plan, context),
    missedLocos,
    constraintImpacts: analyzeConstraintImpacts(plan, context),
    suggestions: generateSuggestions(plan, locomotives, context),
  };
}

/**
 * Compare two plans and explain the differences
 */
export function comparePlans(
  plan1: Plan,
  plan2: Plan,
  locomotives: Locomotive[]
): string[] {
  const differences: string[] = [];

  // Compare locomotive coverage
  const plan1Only = plan1.uniqueLocosSeen.filter(
    (id) => !plan2.uniqueLocosSeen.includes(id)
  );
  const plan2Only = plan2.uniqueLocosSeen.filter(
    (id) => !plan1.uniqueLocosSeen.includes(id)
  );

  if (plan1Only.length > 0) {
    const names = plan1Only.map((id) => getLocoName(locomotives, id)).join(', ');
    differences.push(`Plan 1 includes ${names} which Plan 2 misses.`);
  }

  if (plan2Only.length > 0) {
    const names = plan2Only.map((id) => getLocoName(locomotives, id)).join(', ');
    differences.push(`Plan 2 includes ${names} which Plan 1 misses.`);
  }

  // Compare scores
  if (plan1.score !== plan2.score) {
    differences.push(
      `Plan 1 scores ${plan1.score} points vs Plan 2's ${plan2.score} points.`
    );
  }

  // Compare number of legs
  if (plan1.legs.length !== plan2.legs.length) {
    differences.push(
      `Plan 1 has ${plan1.legs.length} trains vs Plan 2's ${plan2.legs.length} trains.`
    );
  }

  return differences;
}
