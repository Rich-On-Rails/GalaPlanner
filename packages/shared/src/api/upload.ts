import type { ParseResult } from '../types/parse-result';

/**
 * Response from POST /api/upload
 */
export interface UploadResponse {
  /** Whether the upload succeeded */
  success: boolean;
  /** The parse result (if successful) */
  data?: ParseResult;
  /** Error message (if failed) */
  error?: string;
}
