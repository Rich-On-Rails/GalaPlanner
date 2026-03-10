import { useState, useRef, useEffect } from 'react';
import './EditableCell.css';

interface EditableCellProps {
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  type?: 'text' | 'select';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}

/**
 * A cell that can switch between display and edit modes.
 * Supports text input or select dropdown.
 */
export function EditableCell({
  value,
  isEditing,
  onChange,
  type = 'text',
  options = [],
  placeholder = '',
  className = '',
}: EditableCellProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  if (!isEditing) {
    return (
      <span className={`editable-cell-display ${className}`}>
        {value || <span className="editable-cell-empty">{placeholder || '—'}</span>}
      </span>
    );
  }

  if (type === 'select') {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className={`editable-cell-select ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className={`editable-cell-input ${className}`}
    />
  );
}

interface EditableNotesProps {
  notes: string[];
  isEditing: boolean;
  onChange: (notes: string[]) => void;
}

/**
 * Special component for editing notes.
 * Click to edit in non-edit mode, always editable in edit mode.
 */
export function EditableNotes({ notes, isEditing, onChange }: EditableNotesProps) {
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [localValue, setLocalValue] = useState(notes.join('; '));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(notes.join('; '));
  }, [notes]);

  // Focus when starting to edit
  useEffect(() => {
    if ((isEditing || isLocalEditing) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing, isLocalEditing]);

  const handleBlur = () => {
    setIsLocalEditing(false);
    // Split by semicolon and trim each note
    const newNotes = localValue
      .split(';')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    onChange(newNotes);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setLocalValue(notes.join('; '));
      setIsLocalEditing(false);
    }
  };

  if (isEditing || isLocalEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Add notes..."
        className="editable-cell-input editable-notes-input"
      />
    );
  }

  return (
    <span
      className="editable-notes-display"
      onClick={() => setIsLocalEditing(true)}
      title="Click to edit"
    >
      {notes.length > 0 ? notes.join('; ') : <span className="editable-cell-empty">—</span>}
    </span>
  );
}
