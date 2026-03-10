import { useState, useMemo, useCallback } from 'react';
import type { Service, Station, Locomotive } from '@gala-planner/shared';
import { AddLocoModal } from '../ServicesTable/AddLocoModal';
import './LocoView.css';

interface LocoViewProps {
  services: Service[];
  stations: Station[];
  locomotives: Locomotive[];
  selectedLocoId?: string | null;
  onSelectLoco?: (locoId: string | null) => void;
  onLocoAdd?: (name: string, type: Locomotive['type']) => string;
  onLocoRemove?: (locoId: string) => void;
}

export function LocoView({
  services,
  stations,
  locomotives,
  selectedLocoId,
  onSelectLoco,
  onLocoAdd,
  onLocoRemove,
}: LocoViewProps) {
  const [expandedLocoId, setExpandedLocoId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const stationMap = useMemo(
    () => new Map(stations.map((s) => [s.id, s.name])),
    [stations]
  );

  // Group services by locomotive
  const servicesByLoco = useMemo(() => {
    const map = new Map<string, Service[]>();

    for (const loco of locomotives) {
      map.set(loco.id, []);
    }

    for (const service of services) {
      for (const locoId of service.locomotiveIds) {
        const existing = map.get(locoId) || [];
        existing.push(service);
        map.set(locoId, existing);
      }
    }

    // Sort services by departure time
    for (const [, locoServices] of map) {
      locoServices.sort((a, b) => a.departTime.localeCompare(b.departTime));
    }

    return map;
  }, [services, locomotives]);

  const getStationName = (id: string) => stationMap.get(id) || id;

  const handleCardClick = (locoId: string) => {
    setExpandedLocoId((prev) => (prev === locoId ? null : locoId));
    if (onSelectLoco) {
      onSelectLoco(selectedLocoId === locoId ? null : locoId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, locoId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(locoId);
    }
  };

  const handleRemove = useCallback(
    (e: React.MouseEvent, locoId: string) => {
      e.stopPropagation();
      if (onLocoRemove) {
        onLocoRemove(locoId);
      }
    },
    [onLocoRemove]
  );

  const handleAddConfirm = useCallback(
    (name: string, type: Locomotive['type']) => {
      if (onLocoAdd) {
        onLocoAdd(name, type);
      }
      setShowAddModal(false);
    },
    [onLocoAdd]
  );

  return (
    <div className="loco-view">
      <div className="loco-view__header">
        <h3 className="loco-view__title">Locomotives</h3>
        {onLocoAdd && (
          <button
            type="button"
            className="loco-view__add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Add locomotive
          </button>
        )}
      </div>

      {locomotives.length === 0 ? (
        <div className="loco-view__empty">
          <p>No locomotives yet</p>
        </div>
      ) : (
        <div className="loco-view__grid" role="list">
          {locomotives.map((loco) => {
            const locoServices = servicesByLoco.get(loco.id) || [];
            const isSelected = selectedLocoId === loco.id;
            const isExpanded = expandedLocoId === loco.id;
            const displayServices = isExpanded ? locoServices : locoServices.slice(0, 4);
            const hasMore = locoServices.length > 4;

            return (
              <div
                key={loco.id}
                className={`loco-view__card ${isSelected ? 'loco-view__card--selected' : ''} ${isExpanded ? 'loco-view__card--expanded' : ''}`}
                onClick={() => handleCardClick(loco.id)}
                onKeyDown={(e) => handleKeyDown(e, loco.id)}
                role="listitem"
                tabIndex={0}
                aria-selected={isSelected}
                aria-expanded={isExpanded}
                aria-label={`${loco.name}, ${loco.type}, ${locoServices.length} services`}
              >
                <div className="loco-view__card-header">
                  <span className={`loco-view__type loco-view__type--${loco.type}`}>
                    {loco.type}
                  </span>
                  <div className="loco-view__card-header-right">
                    <span className="loco-view__count">
                      {locoServices.length} {locoServices.length === 1 ? 'run' : 'runs'}
                    </span>
                    {onLocoRemove && (
                      <button
                        type="button"
                        className="loco-view__remove-btn"
                        onClick={(e) => handleRemove(e, loco.id)}
                        title={`Remove ${loco.name}`}
                        aria-label={`Remove ${loco.name}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <h4 className="loco-view__name">{loco.name}</h4>
                {locoServices.length > 0 ? (
                  <div className="loco-view__schedule">
                    {displayServices.map((service) => (
                      <div key={service.id} className="loco-view__run">
                        <span className="loco-view__run-time">{service.departTime}</span>
                        <span className="loco-view__run-route">
                          {getStationName(service.originStationId)} →{' '}
                          {getStationName(service.destStationId)}
                        </span>
                      </div>
                    ))}
                    {hasMore && !isExpanded && (
                      <button
                        type="button"
                        className="loco-view__more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(loco.id);
                        }}
                      >
                        +{locoServices.length - 4} more
                      </button>
                    )}
                    {isExpanded && hasMore && (
                      <button
                        type="button"
                        className="loco-view__more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(loco.id);
                        }}
                      >
                        Show less
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="loco-view__no-runs">No scheduled runs</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddLocoModal
          onAdd={handleAddConfirm}
          onCancel={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
