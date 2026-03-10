import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUpload } from './FileUpload';

describe('FileUpload', () => {
  it('renders upload prompt', () => {
    render(<FileUpload onFileSelect={vi.fn()} isUploading={false} />);

    expect(screen.getByText(/drop a timetable file/i)).toBeInTheDocument();
    expect(screen.getByText(/supports pdf, xlsx, and csv/i)).toBeInTheDocument();
  });

  it('shows uploading state', () => {
    render(<FileUpload onFileSelect={vi.fn()} isUploading={true} />);

    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    expect(screen.queryByText(/drop a timetable file/i)).not.toBeInTheDocument();
  });

  it('calls onFileSelect when file is selected', () => {
    const onFileSelect = vi.fn();
    render(<FileUpload onFileSelect={onFileSelect} isUploading={false} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('has correct accessibility attributes', () => {
    render(<FileUpload onFileSelect={vi.fn()} isUploading={false} />);

    const dropzone = screen.getByRole('button');
    expect(dropzone).toHaveAttribute('aria-label', 'Upload a timetable file');
    expect(dropzone).toHaveAttribute('tabIndex', '0');
  });

  it('sets aria-busy when uploading', () => {
    render(<FileUpload onFileSelect={vi.fn()} isUploading={true} />);

    const dropzone = screen.getByRole('button');
    expect(dropzone).toHaveAttribute('aria-busy', 'true');
  });
});
