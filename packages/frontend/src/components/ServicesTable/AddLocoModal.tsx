import { useState } from 'react';
import type { Locomotive } from '@gala-planner/shared';
import './AddLocoModal.css';

interface AddLocoModalProps {
  onAdd: (name: string, type: Locomotive['type']) => void;
  onCancel: () => void;
}

const LOCO_TYPES: Array<{ value: Locomotive['type']; label: string }> = [
  { value: 'steam', label: 'Steam' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Electric' },
  { value: 'dmu', label: 'DMU (Diesel Multiple Unit)' },
  { value: 'other', label: 'Other' },
];

export function AddLocoModal({ onAdd, onCancel }: AddLocoModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Locomotive['type']>('steam');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim(), type);
    }
  };

  return (
    <div className="add-loco-modal__overlay" onClick={onCancel}>
      <div className="add-loco-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="add-loco-modal__title">Add New Locomotive</h3>
        <form onSubmit={handleSubmit} className="add-loco-modal__form">
          <div className="add-loco-modal__field">
            <label htmlFor="loco-name">Locomotive Name/Number</label>
            <input
              id="loco-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 7802 Bradley Manor"
              required
              autoFocus
            />
          </div>

          <div className="add-loco-modal__field">
            <label htmlFor="loco-type">Type</label>
            <select
              id="loco-type"
              value={type}
              onChange={(e) => setType(e.target.value as Locomotive['type'])}
            >
              {LOCO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="add-loco-modal__actions">
            <button type="button" onClick={onCancel} className="add-loco-modal__cancel-btn">
              Cancel
            </button>
            <button type="submit" className="add-loco-modal__add-btn" disabled={!name.trim()}>
              Add Locomotive
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
