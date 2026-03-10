import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import type {
  ParseResult,
  ParseIssue,
  Service,
  Station,
  Locomotive,
  LocomotiveType,
} from '@gala-planner/shared';

// Common column name variations (same as CSV parser)
const COLUMN_MAPPINGS: Record<string, string[]> = {
  train: ['train', 'service', 'train number', 'service number', 'no', 'number'],
  locomotive: ['locomotive', 'loco', 'engine', 'traction'],
  type: ['type', 'traction type', 'loco type'],
  origin: ['origin', 'from', 'departure station', 'dep station', 'start'],
  destination: ['destination', 'to', 'arrival station', 'arr station', 'end'],
  depart: ['depart', 'departure', 'dep', 'departs', 'departure time'],
  arrive: ['arrive', 'arrival', 'arr', 'arrives', 'arrival time'],
  day: ['day', 'date', 'running date'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments'],
};

function normalizeColumnName(name: string): string {
  const lower = String(name).toLowerCase().trim();
  for (const [standard, variants] of Object.entries(COLUMN_MAPPINGS)) {
    if (variants.includes(lower)) {
      return standard;
    }
  }
  return lower;
}

function parseTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  // Handle Excel time as number (fraction of day)
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  const timeStr = String(value).trim();
  if (!timeStr) return null;

  // Handle HH:MM format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const mins = match[2];
    return `${hours}:${mins}`;
  }

  // Handle HHMM format
  const match2 = timeStr.match(/^(\d{2})(\d{2})$/);
  if (match2) {
    return `${match2[1]}:${match2[2]}`;
  }

  return null;
}

function parseLocomotiveType(typeStr: string): LocomotiveType {
  const lower = String(typeStr || '').toLowerCase().trim();
  if (lower.includes('steam')) return 'steam';
  if (lower.includes('diesel')) return 'diesel';
  if (lower.includes('electric')) return 'electric';
  return 'other';
}

function generateStationId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function generateLocoId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function parseDate(value: unknown): string {
  if (value === null || value === undefined) {
    return new Date().toISOString().split('T')[0];
  }

  // Handle Excel date as number (days since 1900)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  const dateStr = String(value).trim();
  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  return new Date().toISOString().split('T')[0];
}

export function parseXlsx(buffer: Buffer, fileName: string): ParseResult {
  const issues: ParseIssue[] = [];
  const services: Service[] = [];
  const stationMap = new Map<string, Station>();
  const locoMap = new Map<string, Locomotive>();

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  } catch (error) {
    issues.push({
      severity: 'error',
      message: `Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lineage: { fileName },
    });
    return {
      id: randomUUID(),
      fileName,
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues,
    };
  }

  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    issues.push({
      severity: 'error',
      message: 'No sheets found in Excel file',
      lineage: { fileName },
    });
    return {
      id: randomUUID(),
      fileName,
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues,
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (data.length === 0) {
    issues.push({
      severity: 'error',
      message: 'No data rows found in Excel file',
      lineage: { fileName },
    });
    return {
      id: randomUUID(),
      fileName,
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues,
    };
  }

  // Normalize column names
  const normalizedData = data.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeColumnName(key)] = value;
    }
    return normalized;
  });

  // Check for required columns
  const headers = Object.keys(normalizedData[0] || {});
  const requiredColumns = ['origin', 'destination', 'depart'];
  const missingColumns = requiredColumns.filter((col) => !headers.includes(col));

  if (missingColumns.length > 0) {
    issues.push({
      severity: 'error',
      message: `Missing required columns: ${missingColumns.join(', ')}. Found: ${headers.join(', ')}`,
      lineage: { fileName },
      suggestedFix: 'Ensure Excel has columns for origin, destination, and departure time',
    });
  }

  // Parse each row
  for (let i = 0; i < normalizedData.length; i++) {
    const row = normalizedData[i];
    const rowNum = i + 2; // +2 for 1-indexed and header row

    // Extract station names
    const originName = String(row.origin || '').trim();
    const destName = String(row.destination || '').trim();

    if (!originName || !destName) {
      issues.push({
        severity: 'warn',
        message: 'Missing origin or destination station',
        lineage: { fileName, row: rowNum },
      });
      continue;
    }

    // Add stations to map
    const originId = generateStationId(originName);
    const destId = generateStationId(destName);

    if (!stationMap.has(originId)) {
      stationMap.set(originId, { id: originId, name: originName, aliases: [] });
    }
    if (!stationMap.has(destId)) {
      stationMap.set(destId, { id: destId, name: destName, aliases: [] });
    }

    // Parse times
    const departTime = parseTime(row.depart);
    const arriveTime = parseTime(row.arrive);

    if (!departTime) {
      issues.push({
        severity: 'warn',
        message: `Invalid departure time: "${row.depart}"`,
        lineage: { fileName, row: rowNum, column: 'depart' },
      });
      continue;
    }

    // Parse locomotive
    const locoName = String(row.locomotive || '').trim();
    const locoIds: string[] = [];

    if (locoName) {
      const locoId = generateLocoId(locoName);
      locoIds.push(locoId);

      if (!locoMap.has(locoId)) {
        const locoType = parseLocomotiveType(String(row.type || ''));
        locoMap.set(locoId, { id: locoId, name: locoName, type: locoType });
      }
    }

    // Parse day
    const day = parseDate(row.day);

    // Create service
    const service: Service = {
      id: randomUUID(),
      day,
      originStationId: originId,
      destStationId: destId,
      departTime,
      arriveTime: arriveTime || departTime,
      locomotiveIds: locoIds,
      serviceNotes: String(row.notes || '').trim() ? [String(row.notes).trim()] : [],
      sourceConfidence: 1.0,
    };

    services.push(service);
  }

  // Add summary info
  if (services.length > 0) {
    issues.push({
      severity: 'info',
      message: `Successfully parsed ${services.length} services, ${stationMap.size} stations, ${locoMap.size} locomotives from sheet "${sheetName}"`,
      lineage: { fileName },
    });
  }

  return {
    id: randomUUID(),
    fileName,
    uploadedAt: new Date().toISOString(),
    services,
    stations: Array.from(stationMap.values()),
    locomotives: Array.from(locoMap.values()),
    issues,
  };
}
