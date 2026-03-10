import { useMemo } from 'react';
import type { Service, Station, Locomotive } from '@gala-planner/shared';
import './TimelineView.css';

interface TimelineViewProps {
  services: Service[];
  stations: Station[];
  locomotives: Locomotive[];
  highlightedLocoIds?: string[];
}

function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function minutesToPosition(minutes: number, startMinutes: number, endMinutes: number): number {
  return ((minutes - startMinutes) / (endMinutes - startMinutes)) * 100;
}

export function TimelineView({
  services,
  stations,
  locomotives,
  highlightedLocoIds = [],
}: TimelineViewProps) {
  const stationMap = useMemo(
    () => new Map(stations.map((s) => [s.id, s.name])),
    [stations]
  );
  const locoMap = useMemo(
    () => new Map(locomotives.map((l) => [l.id, l])),
    [locomotives]
  );

  // Calculate time bounds
  const { startMinutes, endMinutes, hourMarkers } = useMemo(() => {
    if (services.length === 0) {
      return { startMinutes: 9 * 60, endMinutes: 17 * 60, hourMarkers: [] };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const service of services) {
      const depart = timeToMinutes(service.departTime);
      const arrive = timeToMinutes(service.arriveTime);
      minTime = Math.min(minTime, depart);
      maxTime = Math.max(maxTime, arrive);
    }

    // Round to nearest hour with padding
    const start = Math.floor(minTime / 60) * 60;
    const end = Math.ceil(maxTime / 60) * 60;

    // Generate hour markers
    const markers: number[] = [];
    for (let h = start; h <= end; h += 60) {
      markers.push(h);
    }

    return { startMinutes: start, endMinutes: end, hourMarkers: markers };
  }, [services]);

  // Group services by locomotive for better visualization
  const locoColors: Record<string, string> = useMemo(() => {
    const colors = [
      'var(--timeline-color-1)',
      'var(--timeline-color-2)',
      'var(--timeline-color-3)',
      'var(--timeline-color-4)',
      'var(--timeline-color-5)',
    ];
    const map: Record<string, string> = {};
    locomotives.forEach((loco, i) => {
      map[loco.id] = colors[i % colors.length];
    });
    return map;
  }, [locomotives]);

  const getStationName = (id: string) => stationMap.get(id) || id;
  const getLocoName = (id: string) => locoMap.get(id)?.name || id;

  if (services.length === 0) {
    return (
      <div className="timeline-view timeline-view--empty">
        <p>No services to display</p>
      </div>
    );
  }

  return (
    <div className="timeline-view" role="img" aria-label="Timeline of train services">
      <div className="timeline-view__header">
        <h3 className="timeline-view__title">Timeline</h3>
        <div className="timeline-view__legend">
          {locomotives.map((loco) => (
            <div
              key={loco.id}
              className={`timeline-view__legend-item ${highlightedLocoIds.includes(loco.id) ? 'timeline-view__legend-item--highlighted' : ''}`}
            >
              <span
                className="timeline-view__legend-color"
                style={{ backgroundColor: locoColors[loco.id] }}
              />
              <span className="timeline-view__legend-name">{loco.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="timeline-view__container">
        {/* Hour markers */}
        <div className="timeline-view__hours">
          {hourMarkers.map((minutes) => (
            <div
              key={minutes}
              className="timeline-view__hour-marker"
              style={{
                left: `${minutesToPosition(minutes, startMinutes, endMinutes)}%`,
              }}
            >
              <span className="timeline-view__hour-label">
                {String(Math.floor(minutes / 60)).padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        {/* Services */}
        <div className="timeline-view__services">
          {services.map((service) => {
            const departPos = minutesToPosition(
              timeToMinutes(service.departTime),
              startMinutes,
              endMinutes
            );
            const arrivePos = minutesToPosition(
              timeToMinutes(service.arriveTime),
              startMinutes,
              endMinutes
            );
            const width = arrivePos - departPos;
            const locoId = service.locomotiveIds[0];
            const isHighlighted =
              highlightedLocoIds.length === 0 ||
              service.locomotiveIds.some((id) => highlightedLocoIds.includes(id));

            return (
              <div
                key={service.id}
                className={`timeline-view__service ${!isHighlighted ? 'timeline-view__service--dimmed' : ''}`}
                style={{
                  left: `${departPos}%`,
                  width: `${Math.max(width, 2)}%`,
                  backgroundColor: locoId ? locoColors[locoId] : 'var(--color-text-muted)',
                }}
                title={`${service.departTime}-${service.arriveTime}: ${getStationName(service.originStationId)} → ${getStationName(service.destStationId)} (${locoId ? getLocoName(locoId) : 'Unknown'})`}
                role="listitem"
                aria-label={`${service.departTime} to ${service.arriveTime}, ${getStationName(service.originStationId)} to ${getStationName(service.destStationId)}, hauled by ${locoId ? getLocoName(locoId) : 'unknown locomotive'}`}
              >
                <span className="timeline-view__service-text">
                  {getStationName(service.originStationId).substring(0, 3)} →{' '}
                  {getStationName(service.destStationId).substring(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
