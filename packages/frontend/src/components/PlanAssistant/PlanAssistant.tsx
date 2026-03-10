import type { PlanAnalysis, Suggestion, ConstraintImpact, MissedLocoExplanation } from '@gala-planner/shared';
import './PlanAssistant.css';

interface PlanAssistantProps {
  analysis: PlanAnalysis;
  onSuggestionClick?: (suggestion: Suggestion) => void;
}

function getImpactIcon(impact: ConstraintImpact['impact']): string {
  switch (impact) {
    case 'positive':
      return '+';
    case 'negative':
      return '-';
    default:
      return '~';
  }
}

function getMissedReasonLabel(reason: MissedLocoExplanation['reason']): string {
  switch (reason) {
    case 'time_window':
      return 'Outside time window';
    case 'transfer_impossible':
      return 'No transfer possible';
    case 'overlap':
      return 'Schedule conflict';
    case 'no_services':
      return 'No services today';
    case 'station_preference':
      return 'Station avoided';
    default:
      return 'Other';
  }
}

export function PlanAssistant({ analysis, onSuggestionClick }: PlanAssistantProps) {
  return (
    <div className="plan-assistant" role="region" aria-label="Plan Analysis">
      {/* Summary */}
      <div className="plan-assistant__summary">
        <p className="plan-assistant__summary-text">{analysis.summary}</p>
      </div>

      {/* Highlights */}
      {analysis.highlights.length > 0 && (
        <div className="plan-assistant__section">
          <h4 className="plan-assistant__section-title">Highlights</h4>
          <ul className="plan-assistant__highlights" role="list">
            {analysis.highlights.map((highlight, index) => (
              <li key={index} className="plan-assistant__highlight">
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Constraint Impacts */}
      {analysis.constraintImpacts.length > 0 && (
        <div className="plan-assistant__section">
          <h4 className="plan-assistant__section-title">Your Constraints</h4>
          <ul className="plan-assistant__impacts" role="list">
            {analysis.constraintImpacts.map((impact, index) => (
              <li
                key={index}
                className={`plan-assistant__impact plan-assistant__impact--${impact.impact}`}
              >
                <span
                  className="plan-assistant__impact-icon"
                  aria-hidden="true"
                >
                  {getImpactIcon(impact.impact)}
                </span>
                <span className="plan-assistant__impact-text">
                  <strong>{impact.constraint}:</strong> {impact.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missed Locomotives */}
      {analysis.missedLocos.length > 0 && (
        <div className="plan-assistant__section">
          <h4 className="plan-assistant__section-title">
            Locomotives Not Included ({analysis.missedLocos.length})
          </h4>
          <ul className="plan-assistant__missed" role="list">
            {analysis.missedLocos.slice(0, 5).map((missed) => (
              <li key={missed.locoId} className="plan-assistant__missed-item">
                <div className="plan-assistant__missed-header">
                  <span className="plan-assistant__missed-name">{missed.locoName}</span>
                  <span className="plan-assistant__missed-reason">
                    {getMissedReasonLabel(missed.reason)}
                  </span>
                </div>
                <p className="plan-assistant__missed-details">{missed.details}</p>
                {missed.fixOption && (
                  <p className="plan-assistant__missed-fix">
                    <strong>Tip:</strong> {missed.fixOption}
                  </p>
                )}
              </li>
            ))}
            {analysis.missedLocos.length > 5 && (
              <li className="plan-assistant__missed-more">
                +{analysis.missedLocos.length - 5} more locomotives not shown
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="plan-assistant__section">
          <h4 className="plan-assistant__section-title">Suggestions</h4>
          <ul className="plan-assistant__suggestions" role="list">
            {analysis.suggestions.map((suggestion, index) => (
              <li key={index} className="plan-assistant__suggestion">
                <button
                  type="button"
                  className="plan-assistant__suggestion-btn"
                  onClick={() => onSuggestionClick?.(suggestion)}
                  aria-label={`Apply suggestion: ${suggestion.description}`}
                >
                  <span className="plan-assistant__suggestion-text">
                    {suggestion.description}
                  </span>
                  <span className="plan-assistant__suggestion-gain">
                    {suggestion.potentialGain}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
