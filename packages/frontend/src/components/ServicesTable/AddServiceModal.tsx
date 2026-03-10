import { useState } from 'react';
import type { Service, Station, Locomotive } from '@gala-planner/shared';
import './AddServiceModal.css';

interface AddServiceModalProps {
  stations: Station[];
  locomotives: Locomotive[];
  allTimes: string[];
  selectedDayId?: string;
  onAdd: (service: Omit<Service, 'id' | 'sourceConfidence' | 'isUserEdited'>) => void;
  onCancel: () => void;
}

export function AddServiceModal({
  stations,
  locomotives,
  allTimes,
  selectedDayId,
  onAdd,
  onCancel,
}: AddServiceModalProps) {
  const [departTime, setDepartTime] = useState(allTimes[0] || '09:00');
  const [arriveTime, setArriveTime] = useState(allTimes[1] || '09:30');
  const [originStationId, setOriginStationId] = useState(stations[0]?.id || '');
  const [destStationId, setDestStationId] = useState(stations[stations.length - 1]?.id || '');
  const [locomotiveId, setLocomotiveId] = useState(locomotives[0]?.id || '');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newService: Omit<Service, 'id' | 'sourceConfidence' | 'isUserEdited'> = {
      day: selectedDayId || new Date().toISOString().split('T')[0],
      departTime,
      arriveTime,
      originStationId,
      destStationId,
      locomotiveIds: locomotiveId ? [locomotiveId] : [],
      serviceNotes: notes
        .split(';')
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    };

    onAdd(newService);
  };

  return (
    <div className="add-service-modal__overlay" onClick={onCancel}>
      <div className="add-service-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="add-service-modal__title">Add New Service</h3>
        <form onSubmit={handleSubmit} className="add-service-modal__form">
          <div className="add-service-modal__row">
            <div className="add-service-modal__field">
              <label htmlFor="depart-time">Departure Time</label>
              <select
                id="depart-time"
                value={departTime}
                onChange={(e) => setDepartTime(e.target.value)}
                required
              >
                {allTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="add-service-modal__field">
              <label htmlFor="arrive-time">Arrival Time</label>
              <select
                id="arrive-time"
                value={arriveTime}
                onChange={(e) => setArriveTime(e.target.value)}
                required
              >
                {allTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="add-service-modal__row">
            <div className="add-service-modal__field">
              <label htmlFor="origin-station">From Station</label>
              <select
                id="origin-station"
                value={originStationId}
                onChange={(e) => setOriginStationId(e.target.value)}
                required
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="add-service-modal__field">
              <label htmlFor="dest-station">To Station</label>
              <select
                id="dest-station"
                value={destStationId}
                onChange={(e) => setDestStationId(e.target.value)}
                required
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="add-service-modal__field">
            <label htmlFor="locomotive">Locomotive</label>
            <select
              id="locomotive"
              value={locomotiveId}
              onChange={(e) => setLocomotiveId(e.target.value)}
            >
              <option value="">No locomotive assigned</option>
              {locomotives.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type})
                </option>
              ))}
            </select>
          </div>

          <div className="add-service-modal__field">
            <label htmlFor="notes">Notes (separate with semicolons)</label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Special service; Bank holiday extra"
            />
          </div>

          <div className="add-service-modal__actions">
            <button type="button" onClick={onCancel} className="add-service-modal__cancel-btn">
              Cancel
            </button>
            <button type="submit" className="add-service-modal__add-btn">
              Add Service
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
