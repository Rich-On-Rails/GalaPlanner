import { useState } from 'react';
import type { Station, Locomotive, PlanWithAnalysis } from '@gala-planner/shared';
import { PlanAssistant } from '../PlanAssistant';
import './PlanDisplay.css';

interface PlanDisplayProps {
  plansWithAnalysis: PlanWithAnalysis[];
  stations: Station[];
  locomotives: Locomotive[];
}

export function PlanDisplay({ plansWithAnalysis, stations, locomotives }: PlanDisplayProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAssistant, setShowAssistant] = useState(false);

  const stationMap = new Map(stations.map((s) => [s.id, s.name]));
  const locoMap = new Map(locomotives.map((l) => [l.id, l]));

  const getStationName = (id: string) => stationMap.get(id) || id;
  const getLocoName = (id: string) => locoMap.get(id)?.name || id;

  if (plansWithAnalysis.length === 0) {
    return (
      <div className="plan-display plan-display--empty">
        <p>No feasible plans found with your constraints.</p>
        <p className="plan-display__hint">
          Try adjusting your time window or reducing must-see locomotives.
        </p>
      </div>
    );
  }

  const selectedPlanWithAnalysis = plansWithAnalysis[selectedIndex];
  const selectedPlan = selectedPlanWithAnalysis.plan;
  const selectedAnalysis = selectedPlanWithAnalysis.analysis;

  // Calculate total duration
  const firstDep = selectedPlan.legs[0]?.service.departTime || '00:00';
  const lastArr = selectedPlan.legs[selectedPlan.legs.length - 1]?.service.arriveTime || '00:00';

  return (
    <div className={`plan-display ${showAssistant ? 'plan-display--with-sidebar' : ''}`}>
      {/* Header with plan selection */}
      <div className="plan-display__header">
        <div className="plan-display__header-left">
          <h3 className="plan-display__title">Your Plan</h3>
          <span className="plan-display__duration">{firstDep} - {lastArr}</span>
        </div>
        <div className="plan-display__header-right">
          {plansWithAnalysis.length > 1 && (
            <div className="plan-display__tabs" role="tablist">
              {plansWithAnalysis.slice(0, 5).map((planWithAnalysis, i) => (
                <button
                  key={planWithAnalysis.plan.id}
                  type="button"
                  role="tab"
                  aria-selected={i === selectedIndex}
                  className={`plan-display__tab ${i === selectedIndex ? 'plan-display__tab--active' : ''}`}
                  onClick={() => setSelectedIndex(i)}
                >
                  {i === 0 ? 'Best' : `Alt ${i}`}
                </button>
              ))}
            </div>
          )}
          {selectedAnalysis && (
            <button
              type="button"
              className={`plan-display__sidebar-toggle ${showAssistant ? 'plan-display__sidebar-toggle--active' : ''}`}
              onClick={() => setShowAssistant(!showAssistant)}
              aria-expanded={showAssistant}
              title={showAssistant ? 'Hide analysis' : 'Show analysis'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="plan-display__body">
        {/* Main content */}
        <div className="plan-display__main">
          {/* Summary stats */}
          <div className="plan-display__summary">
            <div className="plan-display__stat">
              <span className="plan-display__stat-value">{selectedPlan.uniqueLocosSeen.length}</span>
              <span className="plan-display__stat-label">locos</span>
            </div>
            <div className="plan-display__stat">
              <span className="plan-display__stat-value">{selectedPlan.legs.length}</span>
              <span className="plan-display__stat-label">trains</span>
            </div>
            <div className="plan-display__locos">
              {selectedPlan.uniqueLocosSeen.map((id) => (
                <span key={id} className="plan-display__loco-chip">
                  {getLocoName(id)}
                </span>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="plan-display__timeline">
            {selectedPlan.legs.map((leg, i) => {
              const prevLeg = i > 0 ? selectedPlan.legs[i - 1] : null;
              const showTransfer = prevLeg && prevLeg.alightStationId !== leg.boardStationId;

              return (
                <div key={leg.service.id} className="plan-display__leg-wrapper">
                  {/* Transfer indicator */}
                  {i > 0 && (
                    <div className="plan-display__transfer">
                      <div className="plan-display__transfer-line" />
                      <span className="plan-display__transfer-text">
                        {showTransfer
                          ? `Walk to ${getStationName(leg.boardStationId)}`
                          : 'Wait for next train'}
                      </span>
                    </div>
                  )}

                  {/* Leg card */}
                  <div className="plan-display__leg">
                    <div className="plan-display__leg-times">
                      <time className="plan-display__leg-depart">{leg.service.departTime}</time>
                      <div className="plan-display__leg-duration-line" />
                      <time className="plan-display__leg-arrive">{leg.service.arriveTime}</time>
                    </div>
                    <div className="plan-display__leg-info">
                      <div className="plan-display__leg-route">
                        <span className="plan-display__leg-from">{getStationName(leg.boardStationId)}</span>
                        <svg
                          className="plan-display__leg-arrow"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        <span className="plan-display__leg-to">{getStationName(leg.alightStationId)}</span>
                      </div>
                      <div className="plan-display__leg-locos">
                        {leg.locomotivesSeen.map((id) => (
                          <span key={id} className="plan-display__leg-loco">
                            {getLocoName(id)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Explanations */}
          {selectedPlan.explanations.length > 0 && (
            <div className="plan-display__explanations">
              {selectedPlan.explanations.map((exp, i) => (
                <div
                  key={i}
                  className={`plan-display__explanation plan-display__explanation--${exp.type}`}
                >
                  {exp.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        {selectedAnalysis && (
          <aside
            className={`plan-display__sidebar ${showAssistant ? 'plan-display__sidebar--open' : ''}`}
            aria-hidden={!showAssistant}
          >
            <div className="plan-display__sidebar-header">
              <h4 className="plan-display__sidebar-title">Plan Analysis</h4>
              <button
                type="button"
                className="plan-display__sidebar-close"
                onClick={() => setShowAssistant(false)}
                aria-label="Close analysis"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="plan-display__sidebar-content">
              <PlanAssistant analysis={selectedAnalysis} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
