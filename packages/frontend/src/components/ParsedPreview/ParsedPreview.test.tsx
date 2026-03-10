import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
  id: 'test-id-warning',
  issues: [
    {
      severity: 'warn',
      message: 'Missing arrival time for some services',
      lineage: { fileName: 'test-timetable.csv' },
    },
  ],
};

describe('ParsedPreview', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders file information', () => {
    const { container } = render(<ParsedPreview result={mockResult} onReset={vi.fn()} />);

    expect(screen.getByText('test-timetable.csv')).toBeInTheDocument();
    const headerActions = container.querySelector('.parsed-preview__header-actions');
    expect(headerActions).toBeTruthy();
    expect(within(headerActions as HTMLElement).getByRole('button', { name: 'Start over' })).toBeInTheDocument();
  });

  it('displays statistics', () => {
    const { container } = render(<ParsedPreview result={mockResult} onReset={vi.fn()} />);

    const statsBar = container.querySelector('.stats-bar');
    expect(statsBar).toBeTruthy();

    expect(within(statsBar as HTMLElement).getByText('Services')).toBeInTheDocument();
    expect(within(statsBar as HTMLElement).getByText('Stations')).toBeInTheDocument();
    expect(within(statsBar as HTMLElement).getByText('Locomotives')).toBeInTheDocument();
  });

  it('displays warning issues (not info)', () => {
    render(<ParsedPreview result={mockResultWithWarning} onReset={vi.fn()} />);

    expect(screen.getByText('Missing arrival time for some services')).toBeInTheDocument();
  });

  it('calls onReset when button is clicked', () => {
    const onReset = vi.fn();
    render(<ParsedPreview result={mockResult} onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));

    expect(onReset).toHaveBeenCalled();
  });

  it('shows plan controls and view tabs when services are present', () => {
    render(<ParsedPreview result={mockResult} onReset={vi.fn()} />);

    // Sidebar navigation uses buttons
    expect(screen.getByRole('button', { name: /Table/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Locos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plan/i })).toBeInTheDocument();

    // Plan controls appear when switching to Plan view
    fireEvent.click(screen.getByRole('button', { name: /Plan/i }));
    expect(screen.getByText('Plan Your Day')).toBeInTheDocument();
    expect(screen.getByText('Generate Plan')).toBeInTheDocument();
  });
});
