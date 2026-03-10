import { useState, useCallback } from 'react';
import type { UserConstraints, Locomotive, Station, BreakPeriod } from '@gala-planner/shared';
import './PlanControls.css';

interface PlanControlsProps {
  locomotives: Locomotive[];
  stations: Station[];
  onGeneratePlan: (constraints: UserConstraints) => void;
  isGenerating: boolean;
}

export function PlanControls({ locomotives, stations, onGeneratePlan, isGenerating }: PlanControlsProps) {
  const [startStation, setStartStation] = useState('');
  const [endStation, setEndStation] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [transferBuffer, setTransferBuffer] = useState(5);
  const [mustSeeLocos, setMustSeeLocos] = useState<Set<string>>(new Set());
  const [breaks, setBreaks] = useState<BreakPeriod[]>([]);

  const handleLocoToggle = useCallback((locoId: string) => {
    setMustSeeLocos((prev) => {
      const next = new Set(prev);
      if (next.has(locoId)) {
        next.delete(locoId);
      } else {
        next.add(locoId);
      }
      return next;
    });
  }, []);

  const handleAddBreak = useCallback(() => {
    setBreaks((prev) => [...prev, { start: '12:00', durationMinutes: 60 }]);
  }, []);

  const handleRemoveBreak = useCallback((index: number) => {
    setBreaks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleBreakChange = useCallback(
    (index: number, field: keyof BreakPeriod, value: string | number | undefined) => {
      setBreaks((prev) =>
        prev.map((bp, i) => {
          if (i !== index) return bp;
          if (field === 'preferredStationId' && value === '') {
            const { preferredStationId: _, ...rest } = bp;
            return rest;
          }
          return { ...bp, [field]: value };
        })
      );
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const constraints: UserConstraints = {
        timeWindow: {
          start: startTime,
          end: endTime,
        },
        mustSeeLocoIds: [...mustSeeLocos],
        stationPreferences: {
          prefer: [],
          avoid: [],
        },
        breaks,
        transferBufferMinutes: transferBuffer,
        startStationId: startStation || undefined,
        endStationId: endStation || undefined,
      };
      onGeneratePlan(constraints);
    },
    [startStation, endStation, startTime, endTime, transferBuffer, mustSeeLocos, breaks, onGeneratePlan]
  );

  return (
    <form className="plan-controls" onSubmit={handleSubmit}>
      <h3 className="plan-controls__title">Plan Your Day</h3>

      {stations.length > 0 && (
        <div className="plan-controls__section">
          <div className="plan-controls__station-selects">
            <div className="plan-controls__station-select">
              <label className="plan-controls__label">Start Station</label>
              <select
                value={startStation}
                onChange={(e) => setStartStation(e.target.value)}
                className="plan-controls__input plan-controls__input--full"
              >
                <option value="">Any</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="plan-controls__station-select">
              <label className="plan-controls__label">End Station</label>
              <select
                value={endStation}
                onChange={(e) => setEndStation(e.target.value)}
                className="plan-controls__input plan-controls__input--full"
              >
                <option value="">Any</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="plan-controls__section">
        <label className="plan-controls__label">Time Window</label>
        <div className="plan-controls__time-inputs">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="plan-controls__input"
          />
          <span className="plan-controls__separator">to</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="plan-controls__input"
          />
        </div>
      </div>

      <div className="plan-controls__section">
        <label className="plan-controls__label">Transfer Buffer</label>
        <div className="plan-controls__buffer">
          <input
            type="number"
            min="0"
            max="60"
            value={transferBuffer}
            onChange={(e) => setTransferBuffer(Number(e.target.value))}
            className="plan-controls__input plan-controls__input--small"
          />
          <span className="plan-controls__unit">minutes between trains</span>
        </div>
      </div>

      <div className="plan-controls__section">
        <label className="plan-controls__label">
          Breaks
          {breaks.length > 0 && (
            <span className="plan-controls__count">({breaks.length})</span>
          )}
        </label>
        <div className="plan-controls__breaks">
          {breaks.map((bp, index) => (
            <div key={index} className="plan-controls__break-row">
              <div className="plan-controls__break-inputs">
                <input
                  type="time"
                  value={bp.start}
                  onChange={(e) => handleBreakChange(index, 'start', e.target.value)}
                  className="plan-controls__input"
                />
                <input
                  type="number"
                  min="5"
                  max="240"
                  value={bp.durationMinutes}
                  onChange={(e) => handleBreakChange(index, 'durationMinutes', Number(e.target.value))}
                  className="plan-controls__input plan-controls__input--small"
                />
                <span className="plan-controls__unit">mins</span>
                <input
                  type="text"
                  value={bp.label || ''}
                  onChange={(e) => handleBreakChange(index, 'label', e.target.value || undefined)}
                  placeholder="e.g. Lunch"
                  className="plan-controls__input plan-controls__input--label"
                />
                <button
                  type="button"
                  className="plan-controls__break-remove"
                  onClick={() => handleRemoveBreak(index)}
                  aria-label="Remove break"
                >
                  &times;
                </button>
              </div>
              {stations.length > 0 && (
                <div className="plan-controls__break-station">
                  <span className="plan-controls__unit">Station:</span>
                  <select
                    value={bp.preferredStationId || ''}
                    onChange={(e) => handleBreakChange(index, 'preferredStationId', e.target.value)}
                    className="plan-controls__input plan-controls__input--select"
                  >
                    <option value="">Any</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className="plan-controls__break-add"
            onClick={handleAddBreak}
          >
            + Add break
          </button>
        </div>
      </div>

      {locomotives.length > 0 && (
        <div className="plan-controls__section">
          <label className="plan-controls__label">
            Must-See Locomotives
            {mustSeeLocos.size > 0 && (
              <span className="plan-controls__count">({mustSeeLocos.size} selected)</span>
            )}
          </label>
          <div className="plan-controls__locos">
            {locomotives.map((loco) => (
              <label key={loco.id} className="plan-controls__loco">
                <input
                  type="checkbox"
                  checked={mustSeeLocos.has(loco.id)}
                  onChange={() => handleLocoToggle(loco.id)}
                  className="plan-controls__checkbox"
                />
                <span className="plan-controls__loco-name">{loco.name}</span>
                <span className="plan-controls__loco-type">({loco.type})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        className="plan-controls__submit"
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate Plan'}
      </button>
    </form>
  );
}
