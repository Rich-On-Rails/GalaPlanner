import './ViewTabs.css';

export type ViewType = 'plan' | 'timeline' | 'locos' | 'table';

interface ViewTabsProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  hasPlans: boolean;
}

const TABS: { id: ViewType; label: string; icon: string }[] = [
  { id: 'plan', label: 'Plan', icon: '📋' },
  { id: 'timeline', label: 'Timeline', icon: '📊' },
  { id: 'locos', label: 'Locos', icon: '🚂' },
  { id: 'table', label: 'Table', icon: '📃' },
];

export function ViewTabs({ activeView, onViewChange, hasPlans }: ViewTabsProps) {
  return (
    <div className="view-tabs" role="tablist" aria-label="View selection">
      {TABS.map((tab) => {
        const isDisabled = tab.id === 'plan' && !hasPlans;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeView === tab.id}
            aria-controls={`panel-${tab.id}`}
            disabled={isDisabled}
            className={`view-tabs__tab ${activeView === tab.id ? 'view-tabs__tab--active' : ''} ${isDisabled ? 'view-tabs__tab--disabled' : ''}`}
            onClick={() => onViewChange(tab.id)}
          >
            <span className="view-tabs__icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="view-tabs__label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
