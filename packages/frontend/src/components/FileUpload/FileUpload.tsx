import { useCallback, useRef, useState } from 'react';
import './FileUpload.css';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  acceptedTypes?: string;
  onCreateBlank?: () => void;
}

export function FileUpload({
  onFileSelect,
  isUploading,
  acceptedTypes = '.pdf,.xlsx,.xls,.csv',
  onCreateBlank,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    []
  );

  return (
    <div className="file-upload__wrapper">
      <div
        className={`file-upload ${isDragOver ? 'file-upload--drag-over' : ''} ${isUploading ? 'file-upload--uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Upload a timetable file"
        aria-busy={isUploading}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes}
          onChange={handleFileChange}
          className="file-upload__input"
          disabled={isUploading}
          aria-hidden="true"
          tabIndex={-1}
        />

        <div className="file-upload__content">
          {isUploading ? (
            <>
              <div className="file-upload__spinner" aria-hidden="true" />
              <p className="file-upload__text">Uploading...</p>
            </>
          ) : (
            <>
              <div className="file-upload__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="file-upload__text">Drop a timetable file here or click to browse</p>
              <p className="file-upload__hint">Supports PDF, XLSX, and CSV files</p>
            </>
          )}
        </div>
      </div>

      {onCreateBlank && !isUploading && (
        <>
          <div className="file-upload__divider">
            <span>or</span>
          </div>
          <button
            type="button"
            className="file-upload__blank-btn"
            onClick={onCreateBlank}
          >
            Start from scratch
          </button>
        </>
      )}
    </div>
  );
}
