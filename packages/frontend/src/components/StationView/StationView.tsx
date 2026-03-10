import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Service, Station } from '@gala-planner/shared';
import './StationView.css';

interface StationViewProps {
  stations: Station[];
  services: Service[];
  onStationAdd?: (name: string) => void;
  onStationUpdate?: (id: string, updates: Partial<Station>) => void;
  onStationRemove?: (id: string) => void;
}

export function StationView({
  stations,
  services,
  onStationAdd,
  onStationUpdate,
  onStationRemove,
}: StationViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addValue, setAddValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Count services per station
  const serviceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const station of stations) {
      counts.set(station.id, 0);
    }
    for (const service of services) {
      const originCount = counts.get(service.originStationId) ?? 0;
      counts.set(service.originStationId, originCount + 1);
      if (service.destStationId !== service.originStationId) {
        const destCount = counts.get(service.destStationId) ?? 0;
        counts.set(service.destStationId, destCount + 1);
      }
    }
    return counts;
  }, [stations, services]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  const startEdit = useCallback((station: Station) => {
    setEditingId(station.id);
    setEditValue(station.name);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId && editValue.trim() && onStationUpdate) {
      onStationUpdate(editingId, { name: editValue.trim() });
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, onStationUpdate]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValue('');
  }, []);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitEdit();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit]
  );

  const handleAdd = useCallback(() => {
    const name = addValue.trim();
    if (!name || !onStationAdd) return;
    onStationAdd(name);
    setAddValue('');
    // Keep add row open for consecutive adds
  }, [addValue, onStationAdd]);

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleAdd();
      } else if (e.key === 'Escape') {
        setIsAdding(false);
        setAddValue('');
      }
    },
    [handleAdd]
  );

  const handleRemove = useCallback(
    (station: Station) => {
      if (!onStationRemove) return;
      const count = serviceCounts.get(station.id) ?? 0;
      if (count > 0) {
        const confirmed = window.confirm(
          `"${station.name}" is used by ${count} service${count === 1 ? '' : 's'}. Remove it anyway?`
        );
        if (!confirmed) return;
      }
      onStationRemove(station.id);
    },
    [onStationRemove, serviceCounts]
  );

  return (
    <div className="station-view">
      <div className="station-view__header">
        <h3 className="station-view__title">Stations</h3>
        {onStationAdd && (
          <button
            type="button"
            className="station-view__add-btn"
            onClick={() => setIsAdding(true)}
          >
            + Add station
          </button>
        )}
      </div>

      {stations.length === 0 && !isAdding ? (
        <div className="station-view__empty">
          <p>No stations yet</p>
        </div>
      ) : (
        <div className="station-view__list" role="list">
          {stations.map((station) => {
            const count = serviceCounts.get(station.id) ?? 0;
            const isEditing = editingId === station.id;

            return (
              <div key={station.id} className="station-view__row" role="listitem">
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    className="station-view__name-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onBlur={commitEdit}
                  />
                ) : (
                  <span
                    className="station-view__name"
                    onClick={() => onStationUpdate && startEdit(station)}
                    title={onStationUpdate ? 'Click to edit' : undefined}
                  >
                    {station.name}
                  </span>
                )}
                <span className="station-view__count">
                  {count} {count === 1 ? 'service' : 'services'}
                </span>
                {onStationRemove && (
                  <button
                    type="button"
                    className="station-view__remove-btn"
                    onClick={() => handleRemove(station)}
                    title={`Remove ${station.name}`}
                    aria-label={`Remove ${station.name}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}

          {isAdding && (
            <div className="station-view__add-row">
              <input
                ref={addInputRef}
                className="station-view__add-input"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder="Station name..."
              />
              <button
                type="button"
                className="station-view__add-confirm"
                onClick={handleAdd}
                disabled={!addValue.trim()}
              >
                Add
              </button>
              <button
                type="button"
                className="station-view__add-cancel"
                onClick={() => {
                  setIsAdding(false);
                  setAddValue('');
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
