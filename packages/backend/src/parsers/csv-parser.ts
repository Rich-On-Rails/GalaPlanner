import Papa from 'papaparse';
import { randomUUID } from 'crypto';
import type {
  ParseResult,
  ParseIssue,
  Service,
  Station,
  Locomotive,
  LocomotiveType,
} from '@gala-planner/shared';

interface CsvRow {
  [key: string]: string;
}

// Common column name variations
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
  const lower = name.toLowerCase().trim();
  for (const [standard, variants] of Object.entries(COLUMN_MAPPINGS)) {
    if (variants.includes(lower)) {
      return standard;
    }
  }
  return lower;
}

function parseTime(timeStr: string): string | null {
  if (!timeStr) return null;
  const cleaned = timeStr.trim();

  // Handle HH:MM format
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const mins = match[2];
    return `${hours}:${mins}`;
  }

  // Handle HHMM format
  const match2 = cleaned.match(/^(\d{2})(\d{2})$/);
  if (match2) {
    return `${match2[1]}:${match2[2]}`;
  }

  return null;
}

function parseLocomotiveType(typeStr: string): LocomotiveType {
  const lower = typeStr.toLowerCase().trim();
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

export function parseCsv(buffer: Buffer, fileName: string): ParseResult {
  const content = buffer.toString('utf-8');
  const issues: ParseIssue[] = [];
  const services: Service[] = [];
  const stationMap = new Map<string, Station>();
  const locoMap = new Map<string, Locomotive>();

  // Parse CSV
  const parsed = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => normalizeColumnName(header),
  });

  if (parsed.errors.length > 0) {
    for (const error of parsed.errors) {
      issues.push({
        severity: 'warn',
        message: `CSV parsing warning: ${error.message}`,
        lineage: { fileName, row: error.row },
      });
    }
  }

  if (parsed.data.length === 0) {
    issues.push({
      severity: 'error',
      message: 'No data rows found in CSV',
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

  // Check for required columns
  const headers = Object.keys(parsed.data[0] || {});
  const requiredColumns = ['origin', 'destination', 'depart'];
  const missingColumns = requiredColumns.filter((col) => !headers.includes(col));

  if (missingColumns.length > 0) {
    issues.push({
      severity: 'error',
      message: `Missing required columns: ${missingColumns.join(', ')}. Found: ${headers.join(', ')}`,
      lineage: { fileName },
      suggestedFix: 'Ensure CSV has columns for origin, destination, and departure time',
    });
  }

  // Parse each row
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNum = i + 2; // +2 for 1-indexed and header row

    // Extract station names
    const originName = row.origin?.trim();
    const destName = row.destination?.trim();

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
    const locoName = row.locomotive?.trim();
    const locoIds: string[] = [];

    if (locoName) {
      const locoId = generateLocoId(locoName);
      locoIds.push(locoId);

      if (!locoMap.has(locoId)) {
        const locoType = parseLocomotiveType(row.type || '');
        locoMap.set(locoId, { id: locoId, name: locoName, type: locoType });
      }
    }

    // Parse day
    const day = row.day?.trim() || new Date().toISOString().split('T')[0];

    // Create service
    const service: Service = {
      id: randomUUID(),
      day,
      originStationId: originId,
      destStationId: destId,
      departTime,
      arriveTime: arriveTime || departTime, // Fallback to depart if no arrive
      locomotiveIds: locoIds,
      serviceNotes: row.notes?.trim() ? [row.notes.trim()] : [],
      sourceConfidence: 1.0, // High confidence for CSV
    };

    services.push(service);
  }

  // Add summary info
  if (services.length > 0) {
    issues.push({
      severity: 'info',
      message: `Successfully parsed ${services.length} services, ${stationMap.size} stations, ${locoMap.size} locomotives`,
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
