import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);

    expect(screen.getByText('Rich On Rails - Train Gala Planner')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<App />);

    expect(screen.getByText(/upload your gala timetable/i)).toBeInTheDocument();
  });

  it('renders the file upload component initially', () => {
    render(<App />);

    expect(screen.getByText(/drop a timetable file/i)).toBeInTheDocument();
  });

  it('renders the footer', () => {
    render(<App />);

    expect(screen.getByText(/Rich On Rails/i)).toBeInTheDocument();
  });
});
