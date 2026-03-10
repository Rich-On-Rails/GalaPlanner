import { useState, useCallback } from 'react';
import type { ParseResult } from '@gala-planner/shared';
import { uploadFile } from '../api/client';
import { randomUUID } from '../utils/uuid';

export interface UseUploadState {
  isUploading: boolean;
  error: string | null;
  result: ParseResult | null;
}

export interface UseUploadReturn extends UseUploadState {
  upload: (file: File) => Promise<void>;
  createBlank: () => void;
  reset: () => void;
}

export function useUpload(): UseUploadReturn {
  const [state, setState] = useState<UseUploadState>({
    isUploading: false,
    error: null,
    result: null,
  });

  const upload = useCallback(async (file: File) => {
    setState({ isUploading: true, error: null, result: null });

    const response = await uploadFile(file);

    if (response.success && response.data) {
      setState({ isUploading: false, error: null, result: response.data });
    } else {
      setState({
        isUploading: false,
        error: response.error || 'Upload failed',
        result: null,
      });
    }
  }, []);

  const createBlank = useCallback(() => {
    const blankResult: ParseResult = {
      id: randomUUID(),
      fileName: 'New Timetable',
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues: [],
    };
    setState({ isUploading: false, error: null, result: blankResult });
  }, []);

  const reset = useCallback(() => {
    setState({ isUploading: false, error: null, result: null });
  }, []);

  return { ...state, upload, createBlank, reset };
}
