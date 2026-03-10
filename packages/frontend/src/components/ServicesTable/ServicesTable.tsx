import { useState, useCallback, useMemo } from 'react';
import type { Service, Station, Locomotive } from '@gala-planner/shared';
import { EditableCell, EditableNotes } from './EditableCell';
import { AddServiceModal } from './AddServiceModal';
import { AddLocoModal } from './AddLocoModal';
import './ServicesTable.css';

interface ServicesTableProps {
  services: Service[];
  stations: Station[];
  locomotives: Locomotive[];
  allTimes?: string[];
  selectedDayId?: string | null;
  onServiceUpdate?: (id: string, updates: Partial<Service>) => void;
  onServiceAdd?: (service: Omit<Service, 'id' | 'sourceConfidence' | 'isUserEdited'>) => string;
  onServiceDelete?: (id: string) => void;
  onServiceRestore?: (id: string) => void;
  onLocoAdd?: (name: string, type: Locomotive['type']) => string;
}

type StatusClass = 'edited' | 'added' | 'deleted' | 'high' | 'medium' | 'low';

/**
 * Get status class for styling based on editStatus and confidence
 */
function getStatusClass(service: Service): StatusClass {
  if (service.editStatus) return service.editStatus;
  if (service.sourceConfidence >= 0.9) return 'high';
  if (service.sourceConfidence >= 0.7) return 'medium';
  return 'low';
}

/**
 * Get status label for accessibility
 */
function getStatusLabel(service: Service): string {
  switch (service.editStatus) {
    case 'edited': return 'Edited by user';
    case 'added': return 'Added by user';
    case 'deleted': return 'Deleted';
    default:
      if (service.sourceConfidence >= 0.9) return 'High confidence';
      if (service.sourceConfidence >= 0.7) return 'Medium confidence';
      return 'Low confidence - please verify';
  }
}

/**
 * Get status badge text
 */
function getStatusBadgeText(service: Service): string {
  switch (service.editStatus) {
    case 'edited': return 'Edited';
    case 'added': return 'Added';
    case 'deleted': return 'Deleted';
    default: return `${Math.round(service.sourceConfidence * 100)}%`;
  }
}

/**
 * Validate and normalize a time string to HH:MM format
 */
function normalizeTime(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}

export function ServicesTable({
  services,
  stations,
  locomotives,
  allTimes = [],
  selectedDayId,
  onServiceUpdate,
  onServiceAdd,
  onServiceDelete,
  onServiceRestore,
  onLocoAdd,
}: ServicesTableProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddLocoModal, setShowAddLocoModal] = useState(false);
  const [pendingLocoServiceId, setPendingLocoServiceId] = useState<string | null>(null);
  const [customTimes, setCustomTimes] = useState<string[]>([]);

  const stationMap = new Map(stations.map((s) => [s.id, s.name]));
  const locoMap = new Map(locomotives.map((l) => [l.id, l]));

  const getStationName = (id: string) => stationMap.get(id) || id;
  const getLocoInfo = (ids: string[]) => {
    return ids
      .map((id) => {
        const loco = locoMap.get(id);
        return loco ? `${loco.name} (${loco.type})` : id;
      })
      .join(', ');
  };

  const timeOptions = useMemo(() => {
    const timeSet = new Set([...allTimes, ...customTimes]);
    const sorted = Array.from(timeSet).sort(compareTime);
    return [
      ...sorted.map((t) => ({ value: t, label: t })),
      { value: '__add_custom__', label: '+ Enter custom time...' },
    ];
  }, [allTimes, customTimes]);

  const stationOptions = stations.map((s) => ({ value: s.id, label: s.name }));
  const locoOptions = [
    ...locomotives.map((l) => ({ value: l.id, label: `${l.name} (${l.type})` })),
    { value: '__add_new__', label: '+ Add new locomotive...' },
  ];

  // Sort services chronologically by departure time
  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => compareTime(a.departTime, b.departTime));
  }, [services]);

  const hasUncertainData = services.some((s) => !s.editStatus && s.sourceConfidence < 0.9);
  const hasEditedRows = services.some((s) => s.editStatus === 'edited');
  const hasAddedRows = services.some((s) => s.editStatus === 'added');
  const hasDeletedRows = services.some((s) => s.editStatus === 'deleted');

  const handleTimeChange = useCallback(
    (serviceId: string, field: 'departTime' | 'arriveTime', value: string) => {
      if (value === '__add_custom__') {
        const input = window.prompt('Enter time (HH:MM):');
        if (!input) return;
        const normalized = normalizeTime(input);
        if (!normalized) {
          window.alert('Invalid time format. Please use HH:MM (e.g., 12:43).');
          return;
        }
        setCustomTimes((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
        if (onServiceUpdate) {
          onServiceUpdate(serviceId, { [field]: normalized });
        }
      } else if (onServiceUpdate) {
        onServiceUpdate(serviceId, { [field]: value });
      }
    },
    [onServiceUpdate]
  );

  const handleFieldUpdate = useCallback(
    (serviceId: string, field: keyof Service, value: string | string[]) => {
      if (onServiceUpdate) {
        onServiceUpdate(serviceId, { [field]: value });
      }
    },
    [onServiceUpdate]
  );

  const handleLocoChange = useCallback(
    (serviceId: string, locoId: string) => {
      if (locoId === '__add_new__') {
        setPendingLocoServiceId(serviceId);
        setShowAddLocoModal(true);
      } else if (onServiceUpdate) {
        onServiceUpdate(serviceId, { locomotiveIds: [locoId] });
      }
    },
    [onServiceUpdate]
  );

  const handleAddLocoConfirm = useCallback(
    (name: string, type: Locomotive['type']) => {
      if (onLocoAdd && pendingLocoServiceId && onServiceUpdate) {
        const newLocoId = onLocoAdd(name, type);
        onServiceUpdate(pendingLocoServiceId, { locomotiveIds: [newLocoId] });
      }
      setShowAddLocoModal(false);
      setPendingLocoServiceId(null);
    },
    [onLocoAdd, pendingLocoServiceId, onServiceUpdate]
  );

  const handleAddService = useCallback(
    (service: Omit<Service, 'id' | 'sourceConfidence' | 'isUserEdited'>) => {
      if (onServiceAdd) {
        onServiceAdd(service);
      }
      setShowAddServiceModal(false);
    },
    [onServiceAdd]
  );

  const handleDeleteService = useCallback(
    (serviceId: string) => {
      if (onServiceDelete) {
        onServiceDelete(serviceId);
      }
    },
    [onServiceDelete]
  );

  const handleRestoreService = useCallback(
    (serviceId: string) => {
      if (onServiceRestore) {
        onServiceRestore(serviceId);
      }
    },
    [onServiceRestore]
  );

  const canEdit = onServiceUpdate && onServiceAdd && onServiceDelete;

  if (services.length === 0) {
    return (
      <div className="services-table">
        <div className="services-table__header">
          <h3 className="services-table__title">Services</h3>
          {canEdit && (
            <button
              className="services-table__add-btn"
              onClick={() => setShowAddServiceModal(true)}
            >
              + Add service
            </button>
          )}
        </div>
        <div className="services-table__empty">
          <p>No services yet</p>
        </div>

        {showAddServiceModal && (
          <AddServiceModal
            stations={stations}
            locomotives={locomotives}
            allTimes={[...new Set([...allTimes, ...customTimes])].sort(compareTime)}
            selectedDayId={selectedDayId || undefined}
            onAdd={handleAddService}
            onCancel={() => setShowAddServiceModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="services-table">
      <div className="services-table__header">
        {(hasUncertainData || hasEditedRows || hasAddedRows || hasDeletedRows) && (
          <div className="services-table__confidence-legend" role="note">
            <span className="services-table__legend-title">Status:</span>
            {hasAddedRows && (
              <span className="services-table__legend-item services-table__legend-item--added">
                Added
              </span>
            )}
            {hasEditedRows && (
              <span className="services-table__legend-item services-table__legend-item--edited">
                Edited
              </span>
            )}
            {hasDeletedRows && (
              <span className="services-table__legend-item services-table__legend-item--deleted">
                Deleted
              </span>
            )}
            <span className="services-table__legend-item services-table__legend-item--high">
              High
            </span>
            {hasUncertainData && (
              <>
                <span className="services-table__legend-item services-table__legend-item--medium">
                  Medium
                </span>
                <span className="services-table__legend-item services-table__legend-item--low">
                  Low
                </span>
              </>
            )}
          </div>
        )}
        {canEdit && (
          <button
            className={`services-table__edit-toggle ${isEditMode ? 'services-table__edit-toggle--active' : ''}`}
            onClick={() => setIsEditMode(!isEditMode)}
            type="button"
          >
            {isEditMode ? 'Done editing' : 'Edit mode'}
          </button>
        )}
      </div>

      <div className="services-table__scroll">
        <table className="services-table__table">
          <thead>
            <tr>
              <th className="services-table__th-confidence">Status</th>
              <th>Depart</th>
              <th>Arrive</th>
              <th>From</th>
              <th>To</th>
              <th>Locomotive</th>
              <th>Notes</th>
              {isEditMode && <th className="services-table__th-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedServices.map((service) => {
              const statusClass = getStatusClass(service);
              const statusLabel = getStatusLabel(service);
              const badgeText = getStatusBadgeText(service);
              const isDeleted = service.editStatus === 'deleted';
              const currentLocoId = service.locomotiveIds[0] || '';

              return (
                <tr
                  key={service.id}
                  className={`services-table__row services-table__row--${statusClass}`}
                >
                  <td className="services-table__confidence">
                    <span
                      className={`services-table__confidence-badge services-table__confidence-badge--${statusClass}`}
                      title={statusLabel}
                      aria-label={statusLabel}
                    >
                      {badgeText}
                    </span>
                  </td>
                  <td className="services-table__time">
                    {isDeleted ? (
                      <span className="services-table__deleted-text">{service.departTime}</span>
                    ) : (
                      <EditableCell
                        value={service.departTime}
                        isEditing={isEditMode}
                        onChange={(v) => handleTimeChange(service.id, 'departTime', v)}
                        type="select"
                        options={timeOptions}
                      />
                    )}
                  </td>
                  <td className="services-table__time">
                    {isDeleted ? (
                      <span className="services-table__deleted-text">{service.arriveTime}</span>
                    ) : (
                      <EditableCell
                        value={service.arriveTime}
                        isEditing={isEditMode}
                        onChange={(v) => handleTimeChange(service.id, 'arriveTime', v)}
                        type="select"
                        options={timeOptions}
                      />
                    )}
                  </td>
                  <td className="services-table__station">
                    {isDeleted ? (
                      <span className="services-table__deleted-text">
                        {getStationName(service.originStationId)}
                      </span>
                    ) : (
                      <>
                        <EditableCell
                          value={service.originStationId}
                          isEditing={isEditMode}
                          onChange={(v) => handleFieldUpdate(service.id, 'originStationId', v)}
                          type="select"
                          options={stationOptions}
                        />
                        {!isEditMode && getStationName(service.originStationId) !== service.originStationId && (
                          <span className="services-table__station-display">
                            {getStationName(service.originStationId)}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="services-table__station">
                    {isDeleted ? (
                      <span className="services-table__deleted-text">
                        {getStationName(service.destStationId)}
                      </span>
                    ) : (
                      <>
                        <EditableCell
                          value={service.destStationId}
                          isEditing={isEditMode}
                          onChange={(v) => handleFieldUpdate(service.id, 'destStationId', v)}
                          type="select"
                          options={stationOptions}
                        />
                        {!isEditMode && getStationName(service.destStationId) !== service.destStationId && (
                          <span className="services-table__station-display">
                            {getStationName(service.destStationId)}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="services-table__loco">
                    {isDeleted ? (
                      <span className="services-table__deleted-text">
                        {service.locomotiveIds.length > 0 ? getLocoInfo(service.locomotiveIds) : '—'}
                      </span>
                    ) : isEditMode ? (
                      <EditableCell
                        value={currentLocoId}
                        isEditing={true}
                        onChange={(v) => handleLocoChange(service.id, v)}
                        type="select"
                        options={locoOptions}
                        placeholder="Select loco..."
                      />
                    ) : (
                      <span>
                        {service.locomotiveIds.length > 0 ? getLocoInfo(service.locomotiveIds) : '—'}
                      </span>
                    )}
                  </td>
                  <td className="services-table__notes">
                    {isDeleted ? (
                      <span className="services-table__deleted-text">
                        {service.serviceNotes.length > 0 ? service.serviceNotes.join('; ') : ''}
                      </span>
                    ) : (
                      <EditableNotes
                        notes={service.serviceNotes}
                        isEditing={isEditMode}
                        onChange={(notes) => handleFieldUpdate(service.id, 'serviceNotes', notes)}
                      />
                    )}
                  </td>
                  {isEditMode && (
                    <td className="services-table__actions">
                      {isDeleted ? (
                        <button
                          className="services-table__restore-btn"
                          onClick={() => handleRestoreService(service.id)}
                          title="Restore service"
                          aria-label="Restore service"
                        >
                          ↩
                        </button>
                      ) : (
                        <button
                          className="services-table__delete-btn"
                          onClick={() => handleDeleteService(service.id)}
                          title="Delete service"
                          aria-label="Delete service"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEditMode && (
        <div className="services-table__footer">
          <button
            className="services-table__add-btn"
            onClick={() => setShowAddServiceModal(true)}
          >
            + Add service
          </button>
        </div>
      )}

      {showAddServiceModal && (
        <AddServiceModal
          stations={stations}
          locomotives={locomotives}
          allTimes={[...new Set([...allTimes, ...customTimes])].sort(compareTime)}
          selectedDayId={selectedDayId || undefined}
          onAdd={handleAddService}
          onCancel={() => setShowAddServiceModal(false)}
        />
      )}

      {showAddLocoModal && (
        <AddLocoModal
          onAdd={handleAddLocoConfirm}
          onCancel={() => {
            setShowAddLocoModal(false);
            setPendingLocoServiceId(null);
          }}
        />
      )}
    </div>
  );
}
