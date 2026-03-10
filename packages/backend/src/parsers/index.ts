import { randomUUID } from 'crypto';
import type { ParseResult } from '@gala-planner/shared';
import { parseCsv } from './csv-parser.js';
import { parseXlsx } from './xlsx-parser.js';
import { parsePdf } from './pdf-parser.js';

export type SupportedMimeType =
  | 'text/csv'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel'
  | 'application/pdf';

// Sync parsers for CSV and Excel
const SYNC_PARSERS: Record<string, (buffer: Buffer, fileName: string) => ParseResult> = {
  'text/csv': parseCsv,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': parseXlsx,
  'application/vnd.ms-excel': parseXlsx,
};

/**
 * Parse a file and return the structured result.
 * This function is async to support PDF parsing which requires async operations.
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParseResult> {
  // Handle PDF separately (async)
  if (mimeType === 'application/pdf') {
    return parsePdf(buffer, fileName);
  }

  // Handle sync parsers
  const parser = SYNC_PARSERS[mimeType];

  if (!parser) {
    return {
      id: randomUUID(),
      fileName,
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues: [
        {
          severity: 'error',
          message: `Unsupported file type: ${mimeType}`,
          lineage: { fileName },
        },
      ],
    };
  }

  return parser(buffer, fileName);
}

export { parseCsv } from './csv-parser.js';
export { parseXlsx } from './xlsx-parser.js';
export { parsePdf } from './pdf-parser.js';
