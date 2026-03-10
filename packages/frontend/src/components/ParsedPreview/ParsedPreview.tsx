import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ParseResult, UserConstraints, PlanWithAnalysis, Service, Locomotive } from '@gala-planner/shared';
import { ServicesTable } from '../ServicesTable';
import { PlanControls } from '../PlanControls';
import { PlanDisplay } from '../PlanDisplay';
import { TimelineView } from '../TimelineView';
import { LocoView } from '../LocoView';
import { StationView } from '../StationView';
import { generatePlan } from '../../api/client';
import { useEditedServices } from '../../hooks/useEditedServices';
import './ParsedPreview.css';

type ViewType = 'plan' | 'timeline' | 'locos' | 'stations' | 'table';

const NAV_ITEMS: { id: ViewType; label: string; icon: string }[] = [
  { id: 'table', label: 'Table', icon: '📃' },
  { id: 'timeline', label: 'Timeline', icon: '📊' },
  { id: 'locos', label: 'Locos', icon: '🚂' },
  { id: 'stations', label: 'Stations', icon: '🚉' },
  { id: 'plan', label: 'Plan', icon: '📋' },
];

interface ParsedPreviewProps {
  result: ParseResult;
  onReset: () => void;
}

export function ParsedPreview({ result, onReset }: ParsedPreviewProps) {
  const [plansWithAnalysis, setPlansWithAnalysis] = useState<PlanWithAnalysis[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('table');
  const [selectedLocoId, setSelectedLocoId] = useState<string | null>(null);

  // Use edited services hook for localStorage persistence
  const {
    result: editedResult,
    activeServices,
    updateService,
    addService,
    deleteService,
    restoreService,
    addLocomotive,
    removeLocomotive,
    addStation,
    updateStation,
    removeStation,
    resetToOriginal,
    hasEdits,
  } = useEditedServices(result);

  // Day selection for multi-day timetables
  const hasMultipleDays = (editedResult.availableDays?.length ?? 0) > 1;
  const [selectedDayId, setSelectedDayId] = useState<string | null>(
    editedResult.availableDays?.[0]?.id ?? null
  );

  // Reset selected day when result changes (new file uploaded)
  useEffect(() => {
    setSelectedDayId(editedResult.availableDays?.[0]?.id ?? null);
    // Also clear any existing plans when file changes
    setPlansWithAnalysis([]);
    setPlanError(null);
  }, [editedResult.id]);

  // Filter all services by selected day (includes deleted - for table view)
  const filteredAllServices: Service[] = useMemo(() => {
    if (!hasMultipleDays || !selectedDayId) {
      return editedResult.services;
    }
    return editedResult.services.filter((s) => s.day === selectedDayId);
  }, [editedResult.services, hasMultipleDays, selectedDayId]);

  // Filter active services by selected day (excludes deleted - for other views)
  const filteredActiveServices: Service[] = useMemo(() => {
    if (!hasMultipleDays || !selectedDayId) {
      return activeServices;
    }
    return activeServices.filter((s) => s.day === selectedDayId);
  }, [activeServices, hasMultipleDays, selectedDayId]);

  // Get all unique times from current day's services (for time dropdowns)
  const allTimes = useMemo(() => {
    const times = new Set<string>();
    filteredAllServices.forEach((s) => {
      times.add(s.departTime);
      times.add(s.arriveTime);
    });
    return Array.from(times).sort();
  }, [filteredAllServices]);

  // Handle adding a new station
  const handleAddStation = useCallback(
    (name: string) => {
      const newStation = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        aliases: [],
      };
      addStation(newStation);
    },
    [addStation]
  );

  // Handle adding a new locomotive
  const handleAddLocomotive = useCallback(
    (name: string, type: Locomotive['type']) => {
      const newLoco: Locomotive = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        type,
      };
      addLocomotive(newLoco);
      return newLoco.id;
    },
    [addLocomotive]
  );

  // Extract just the plans for compatibility
  const plans = plansWithAnalysis.map((p) => p.plan);

  const handleGeneratePlan = useCallback(
    async (constraints: UserConstraints) => {
      setIsGenerating(true);
      setPlanError(null);

      const response = await generatePlan({
        parseResultId: editedResult.id,
        constraints,
        maxPlans: 5,
        includeExplanations: true,
        // Pass selected day for multi-day timetables
        dayId: hasMultipleDays ? (selectedDayId ?? undefined) : undefined,
      });

      setIsGenerating(false);

      if (response.success) {
        // Prefer plansWithAnalysis if available, otherwise fall back to plans
        if (response.plansWithAnalysis) {
          setPlansWithAnalysis(response.plansWithAnalysis);
        } else if (response.plans) {
          setPlansWithAnalysis(response.plans.map((plan) => ({ plan })));
        }
      } else {
        setPlanError(response.error || 'Failed to generate plan');
        setPlansWithAnalysis([]);
      }
    },
    [editedResult.id, hasMultipleDays, selectedDayId]
  );

  const handleSelectLoco = useCallback((locoId: string | null) => {
    setSelectedLocoId(locoId);
  }, []);

  // Get highlighted locos from selected loco or current plan
  const highlightedLocoIds = selectedLocoId
    ? [selectedLocoId]
    : plans.length > 0
      ? plans[0].uniqueLocosSeen
      : [];

  return (
    <div className="parsed-preview-layout">
      {/* Stats pills bar */}
      <div className="stats-bar">
        <div className="stats-bar__pill">
          <span className="stats-bar__value">{filteredActiveServices.length}</span>
          <span className="stats-bar__label">Services{hasMultipleDays ? ' (today)' : ''}</span>
        </div>
        <div className="stats-bar__pill">
          <span className="stats-bar__value">{editedResult.stations.length}</span>
          <span className="stats-bar__label">Stations</span>
        </div>
        <div className="stats-bar__pill">
          <span className="stats-bar__value">{editedResult.locomotives.length}</span>
          <span className="stats-bar__label">Locomotives</span>
        </div>
      </div>

      {/* Sidebar + content body */}
      <div className="parsed-preview-layout__body">
        {/* Sidebar navigation */}
        <nav className="sidebar-nav" aria-label="View selection">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav__item ${isActive ? 'sidebar-nav__item--active' : ''}`}
                onClick={() => setActiveView(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="sidebar-nav__icon" aria-hidden="true">{item.icon}</span>
                <span className="sidebar-nav__label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content card */}
        <div className="parsed-preview">
          <header className="parsed-preview__header">
            <h2 className="parsed-preview__title">{editedResult.fileName}</h2>
            <div className="parsed-preview__header-actions">
              {hasMultipleDays && editedResult.availableDays && (
                <div className="parsed-preview__day-selector">
                  <label htmlFor="day-select" className="parsed-preview__day-label">
                    Day:
                  </label>
                  <select
                    id="day-select"
                    className="parsed-preview__day-select"
                    value={selectedDayId || ''}
                    onChange={(e) => setSelectedDayId(e.target.value)}
                  >
                    {editedResult.availableDays.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.label} ({day.serviceCount} services)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {hasEdits && (
                <button
                  onClick={resetToOriginal}
                  className="parsed-preview__reset-edits-btn"
                  type="button"
                  title="Discard all manual edits"
                >
                  Reset edits
                </button>
              )}
              <button onClick={onReset} className="parsed-preview__reset-btn" type="button">
                Start over
              </button>
            </div>
          </header>

          {editedResult.issues.filter((i) => i.severity !== 'info').length > 0 && (
            <div className="parsed-preview__issues">
              <ul className="parsed-preview__issues-list" role="list">
                {editedResult.issues
                  .filter((i) => i.severity !== 'info')
                  .map((issue, index) => (
                    <li
                      key={index}
                      className={`parsed-preview__issue parsed-preview__issue--${issue.severity}`}
                    >
                      <span className="parsed-preview__issue-badge" aria-hidden="true">
                        {issue.severity === 'error' ? '!' : '?'}
                      </span>
                      <span className="parsed-preview__issue-message">{issue.message}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="parsed-preview__view-panel" id={`panel-${activeView}`}>
            {activeView === 'plan' && (
              <>
                <PlanControls
                  locomotives={editedResult.locomotives}
                  stations={editedResult.stations}
                  onGeneratePlan={handleGeneratePlan}
                  isGenerating={isGenerating}
                />

                {planError && (
                  <div className="parsed-preview__error" role="alert">
                    {planError}
                  </div>
                )}

                {plansWithAnalysis.length > 0 && (
                  <PlanDisplay
                    plansWithAnalysis={plansWithAnalysis}
                    stations={editedResult.stations}
                    locomotives={editedResult.locomotives}
                  />
                )}
              </>
            )}

            {activeView === 'timeline' && (
              <>
                <TimelineView
                  services={filteredActiveServices}
                  stations={editedResult.stations}
                  locomotives={editedResult.locomotives}
                  highlightedLocoIds={highlightedLocoIds}
                />
                {filteredActiveServices.length > 0 && (
                  <div className="parsed-preview__edit-hint">
                    Data not quite right?{' '}
                    <button
                      type="button"
                      className="parsed-preview__edit-hint-link"
                      onClick={() => setActiveView('table')}
                    >
                      Switch to Table view to edit
                    </button>
                  </div>
                )}
              </>
            )}

            {activeView === 'locos' && (
              <>
                <LocoView
                  services={filteredActiveServices}
                  stations={editedResult.stations}
                  locomotives={editedResult.locomotives}
                  selectedLocoId={selectedLocoId}
                  onSelectLoco={handleSelectLoco}
                  onLocoAdd={handleAddLocomotive}
                  onLocoRemove={removeLocomotive}
                />
                {filteredActiveServices.length > 0 && (
                  <div className="parsed-preview__edit-hint">
                    Data not quite right?{' '}
                    <button
                      type="button"
                      className="parsed-preview__edit-hint-link"
                      onClick={() => setActiveView('table')}
                    >
                      Switch to Table view to edit
                    </button>
                  </div>
                )}
              </>
            )}

            {activeView === 'stations' && (
              <StationView
                stations={editedResult.stations}
                services={filteredActiveServices}
                onStationAdd={handleAddStation}
                onStationUpdate={updateStation}
                onStationRemove={removeStation}
              />
            )}

            {activeView === 'table' && (
              <div className="parsed-preview__services">
                <ServicesTable
                  services={filteredAllServices}
                  stations={editedResult.stations}
                  locomotives={editedResult.locomotives}
                  allTimes={allTimes}
                  selectedDayId={selectedDayId}
                  onServiceUpdate={updateService}
                  onServiceAdd={addService}
                  onServiceDelete={deleteService}
                  onServiceRestore={restoreService}
                  onLocoAdd={handleAddLocomotive}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
