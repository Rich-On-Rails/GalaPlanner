import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParsedPreview } from './ParsedPreview';
import type { ParseResult } from '@gala-planner/shared';

const mockResult: ParseResult = {
  id: 'test-id',
  fileName: 'test-timetable.csv',
  uploadedAt: '2024-01-01T00:00:00.000Z',
  services: [
    {
      id: 'service-1',
      day: '2024-10-05',
      originStationId: 'pickering',
      destStationId: 'grosmont',
      departTime: '09:00',
      arriveTime: '09:45',
      locomotiveIds: ['flying-scotsman'],
      serviceNotes: [],
      sourceConfidence: 1.0,
    },
  ],
  stations: [
    { id: 'pickering', name: 'Pickering', aliases: [] },
    { id: 'grosmont', name: 'Grosmont', aliases: [] },
  ],
  locomotives: [{ id: 'flying-scotsman', name: '4472 Flying Scotsman', type: 'steam' }],
  issues: [
    {
      severity: 'info',
      message: 'File uploaded successfully',
      lineage: { fileName: 'test-timetable.csv' },
    },
  ],
};

const mockResultWithWarning: ParseResult = {
  ...mockResult,
  issues: [
    {
      severity: 'warn',
      message: 'Missing arrival time for some services',
      lineage: { fileName: 'test-timetable.csv' },
    },
  ],
};

describe('ParsedPreview', () => {
  it('renders file information', () => {
    render(<ParsedPreview result={mockResult} onReset={vi.fn()} />);

    expect(screen.getByText('test-timetable.csv')).toBeInTheDocument();
    expect(screen.getByText('Upload another file')).toBeInTheDocument();
  });

  it('displays statistics', () => {
    render(<ParsedPreview result={mockResult} onReset={vi.fn()} />);

    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Stations')).toBeInTheDocument();
    expect(screen.getByText('Locomotives')).toBeInTheDocument();
  });

  it('displays warning issues (not info)', () => {
    render(<ParsedPreview result={mockResultWithWarning} onReset={vi.fn()} />);

    expect(screen.getByText('Missing arrival time for some services')).toBeInTheDocument();
  });

  it('calls onReset when button is clicked', () => {
    const onReset = vi.fn();
    render(<ParsedPreview result={mockResult} onReset={onReset} />);

    fireEvent.click(screen.getByText('Upload another file'));

    expect(onReset).toHaveBeenCalled();
  });

  it('shows plan controls and view tabs when services are present', () => {
    render(<ParsedPreview result={mockResult} onReset={vi.fn()} />);

    // Check plan controls are shown
    expect(screen.getByText('Plan Your Day')).toBeInTheDocument();
    expect(screen.getByText('Generate Plan')).toBeInTheDocument();

    // Check view tabs are available
    expect(screen.getByRole('tab', { name: /Timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Locos/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Table/i })).toBeInTheDocument();
  });
});
