import { randomUUID } from 'crypto';
import type {
  ParseResult,
  ParseIssue,
  Service,
  ServiceStop,
  Station,
  Locomotive,
  LocomotiveType,
  TimetableDay,
} from '@gala-planner/shared';

interface PdfPage {
  text: string;
  pageNum: number;
  day?: string; // e.g., "Saturday 3 January"
  dayId?: string; // e.g., "2025-01-03"
}

interface PdfParseResult {
  text: string;
  numPages: number;
  pages: PdfPage[];
}

// Regex patterns for extracting timetable data
// Match times with colon (09:00) or 4-digit format (0900)
const TIME_PATTERN = /\b(\d{1,2})[:.:](\d{2})\b/g;
const TIME_SINGLE_PATTERN = /\b(\d{1,2})[:.:](\d{2})\b/;
const TIME_4DIGIT_PATTERN = /\b([01]?\d|2[0-3])([0-5]\d)\b/g;

// Common station name patterns (can be expanded)
const STATION_KEYWORDS = [
  'station',
  'halt',
  'junction',
  'road',
  'park',
  'central',
  'north',
  'south',
  'east',
  'west',
];

interface ExtractedRow {
  times: string[];
  text: string;
  confidence: number;
}

// Day pattern to extract day labels from timetable
const DAY_PATTERN =
  /(?:Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\s+(\d+)\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i;

const MONTH_MAP: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

/**
 * Extract day information from text
 */
function extractDayFromText(text: string): { day: string; dayId: string } | null {
  const match = text.match(DAY_PATTERN);
  if (match) {
    const dayOfMonth = match[1].padStart(2, '0');
    const monthName = match[2].toLowerCase();
    const month = MONTH_MAP[monthName];
    // Assume current or next year for now
    const year = new Date().getFullYear();
    return {
      day: match[0],
      dayId: `${year}-${month}-${dayOfMonth}`,
    };
  }
  return null;
}

/**
 * Extract text from a PDF buffer using pdf-parse
 */
async function extractPdfText(buffer: Buffer): Promise<PdfParseResult> {
  // Dynamic import for ES module compatibility
  const { PDFParse, VerbosityLevel } = await import('pdf-parse');

  // pdf-parse v2.x uses a class-based API
  // Pass the buffer as Uint8Array in the data option
  const parser = new PDFParse({
    verbosity: VerbosityLevel.ERRORS,
    data: new Uint8Array(buffer),
  });

  // getText() auto-loads and returns a TextResult object with .text property
  const textResult = await parser.getText();
  // getInfo() returns an InfoResult object with .total for page count
  const info = await parser.getInfo();

  // Extract individual pages with day detection
  const pages: PdfPage[] = [];
  if (textResult?.pages) {
    for (const page of textResult.pages) {
      const dayInfo = extractDayFromText(page.text || '');
      pages.push({
        text: page.text || '',
        pageNum: page.num || pages.length + 1,
        day: dayInfo?.day,
        dayId: dayInfo?.dayId,
      });
    }
  }

  return {
    text: textResult?.text || '',
    numPages: info?.total || 0,
    pages,
  };
}

function normalizeTime(timeStr: string): string | null {
  const match = timeStr.match(/^(\d{1,2})[:.:](\d{2})$/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const mins = match[2];
    const h = parseInt(hours);
    if (h >= 0 && h < 24) {
      return `${hours}:${mins}`;
    }
  }
  return null;
}

function generateStationId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateLocoId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extracts potential station names from text
 */
function extractStationNames(text: string): string[] {
  const stations: string[] = [];
  // Look for capitalized words that might be station names
  const words = text.split(/\s+/);
  let currentStation = '';

  for (const word of words) {
    // Skip times and numbers
    if (TIME_SINGLE_PATTERN.test(word) || /^\d+$/.test(word)) {
      if (currentStation) {
        stations.push(currentStation.trim());
        currentStation = '';
      }
      continue;
    }

    // Check if word starts with capital or is a known station keyword
    const isCapitalized = /^[A-Z]/.test(word);
    const isStationKeyword = STATION_KEYWORDS.some((kw) =>
      word.toLowerCase().includes(kw)
    );

    if (isCapitalized || isStationKeyword) {
      currentStation += (currentStation ? ' ' : '') + word;
    } else if (currentStation) {
      stations.push(currentStation.trim());
      currentStation = '';
    }
  }

  if (currentStation) {
    stations.push(currentStation.trim());
  }

  // Filter out very short names (likely not stations)
  return stations.filter((s) => s.length > 2);
}

/**
 * Extracts locomotive information from text
 */
function extractLocomotives(
  text: string
): Array<{ name: string; type: LocomotiveType }> {
  const locos: Array<{ name: string; type: LocomotiveType }> = [];

  // Common locomotive number patterns (e.g., "4472 Flying Scotsman", "D1023", "47xxx")
  const locoPatterns = [
    /\b(\d{4,5})\s+([A-Z][a-zA-Z\s]+)/g, // Number followed by name
    /\b([A-Z]\d{3,4})\b/g, // Class designation like D1023
    /\b(No\.?\s*\d+)\b/gi, // "No. 123" format
  ];

  for (const pattern of locoPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[0].trim();
      if (name.length > 2 && !locos.some((l) => l.name === name)) {
        // Try to determine type from context
        const contextStart = Math.max(0, match.index - 50);
        const contextEnd = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.substring(contextStart, contextEnd).toLowerCase();

        let type: LocomotiveType = 'other';
        if (context.includes('steam')) type = 'steam';
        else if (context.includes('diesel')) type = 'diesel';
        else if (context.includes('electric')) type = 'electric';

        locos.push({ name, type });
      }
    }
  }

  return locos;
}

/**
 * Extract 4-digit times from a line (e.g., "0900" -> "09:00")
 */
function extract4DigitTimes(line: string): string[] {
  const times: string[] = [];
  const regex = new RegExp(TIME_4DIGIT_PATTERN);
  let match;

  while ((match = regex.exec(line)) !== null) {
    const hours = match[1].padStart(2, '0');
    const mins = match[2];
    const h = parseInt(hours);
    // Only accept valid hours (0-23) and filter out likely loco numbers (4+ digits or > 2359)
    if (h >= 0 && h < 24) {
      const fullMatch = match[0];
      // Skip if it looks like a loco number (part of a longer number sequence)
      const beforeIdx = match.index - 1;
      const afterIdx = match.index + fullMatch.length;
      const before = beforeIdx >= 0 ? line[beforeIdx] : ' ';
      const after = afterIdx < line.length ? line[afterIdx] : ' ';
      if (!/\d/.test(before) && !/\d/.test(after)) {
        times.push(`${hours}:${mins}`);
      }
    }
  }

  return times;
}

/**
 * Parsed service from heritage timetable
 */
interface HeritageServiceStop {
  station: string;
  time: string;
}

interface HeritageService {
  locoId: string;
  originStation: string;
  destStation: string;
  departTime: string;
  arriveTime: string;
  direction: 'down' | 'up';
  stops: HeritageServiceStop[];
}

/**
 * Item with its character position in the line (for column alignment)
 */
interface PositionedItem {
  value: string;
  position: number; // Character position in the original line
}

/**
 * Extract loco numbers with their positions from a line
 */
function extractLocosWithPositions(line: string): PositionedItem[] {
  const locos: PositionedItem[] = [];
  const regex = /\d{4,5}/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    locos.push({
      value: match[0],
      position: match.index,
    });
  }

  return locos;
}

/**
 * Extract 4-digit times with their positions from a line
 */
function extractTimesWithPositions(line: string): PositionedItem[] {
  const times: PositionedItem[] = [];
  const regex = /\b([01]?\d|2[0-3])([0-5]\d)\b/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    const hours = match[1].padStart(2, '0');
    const mins = match[2];
    const h = parseInt(hours);

    // Only accept valid hours (0-23)
    if (h >= 0 && h < 24) {
      const fullMatch = match[0];
      // Skip if it looks like a loco number (part of a longer number sequence)
      const beforeIdx = match.index - 1;
      const afterIdx = match.index + fullMatch.length;
      const before = beforeIdx >= 0 ? line[beforeIdx] : ' ';
      const after = afterIdx < line.length ? line[afterIdx] : ' ';

      if (!/\d/.test(before) && !/\d/.test(after)) {
        times.push({
          value: `${hours}:${mins}`,
          position: match.index,
        });
      }
    }
  }

  return times;
}

/**
 * Parse heritage railway timetable format with column position tracking
 *
 * Structure per day:
 * - TOP table (DOWN direction): Kidderminster → Bridgnorth
 *   - Loco header row: locomotive numbers at column positions
 *   - Continuation lines: extra locos for double-headed services (stacked in same column)
 *   - dep/arr rows: times at corresponding column positions
 * - BOTTOM table (UP direction): Bridgnorth → Kidderminster
 *   - Same structure for return journeys
 *
 * Key insight: Match locos to times by INDEX (order), not position
 */
function parseHeritageFormat(text: string): HeritageService[] {
  const services: HeritageService[] = [];
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  // Stations in order for DOWN direction
  const downStations = ['Kidderminster', 'Bewdley', 'Arley', 'Highley', 'Hampton Loade', 'Bridgnorth'];
  const upStations = [...downStations].reverse();

  // Track parsing state for current table
  let currentLocoPositions: PositionedItem[] = [];
  let currentDepRows: PositionedItem[][] = [];
  let currentArrRows: PositionedItem[][] = [];
  let inDownTable = true;
  let tableCount = 0;
  let lastWasLocoRow = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Detect loco header row (numbers like 7802, 1450, 13268)
    // Only consider lines that are primarily numbers with optional parentheses
    if (/^[\d\s()\/]+$/.test(trimmedLine) && trimmedLine.match(/\d{4,5}/)) {
      const locoPositions = extractLocosWithPositions(line);

      // Main loco row: has multiple locos (>= 3 to distinguish from continuation)
      if (locoPositions.length >= 3) {
        // If we already have data, process previous table
        if (currentLocoPositions.length > 0 && (currentDepRows.length > 0 || currentArrRows.length > 0)) {
          const tableServices = buildServicesFromTableWithPositions(
            currentLocoPositions,
            currentDepRows,
            currentArrRows,
            inDownTable ? downStations : upStations,
            inDownTable ? 'down' : 'up'
          );
          services.push(...tableServices);
          tableCount++;

          // After first table, switch direction
          if (tableCount === 1) {
            inDownTable = false;
          }
        }

        // Start new table
        currentLocoPositions = locoPositions;
        currentDepRows = [];
        currentArrRows = [];
        lastWasLocoRow = true;
        continue;
      }

      // Continuation row: 1-2 locos right after a main loco row
      // These represent double-headed services (e.g., "7714" on main row, "1450" below)
      if (locoPositions.length >= 1 && lastWasLocoRow && currentLocoPositions.length > 0) {
        // Append continuation locos to the end of the current list
        // They represent additional locos for the last N columns
        for (const loco of locoPositions) {
          currentLocoPositions.push(loco);
        }
        // Still in loco row mode
        lastWasLocoRow = true;
        continue;
      }
    }

    // Skip Service row but continue
    if (trimmedLine.toLowerCase().startsWith('service')) {
      lastWasLocoRow = false;
      continue;
    }

    // Detect dep/arr rows with times
    if (trimmedLine.startsWith('dep') || trimmedLine.startsWith('arr')) {
      const timePositions = extractTimesWithPositions(line);
      if (timePositions.length > 0) {
        if (trimmedLine.startsWith('dep')) {
          currentDepRows.push(timePositions);
        } else {
          currentArrRows.push(timePositions);
        }
      }
      lastWasLocoRow = false;
    }
  }

  // Process last table
  if (currentLocoPositions.length > 0 && (currentDepRows.length > 0 || currentArrRows.length > 0)) {
    const tableServices = buildServicesFromTableWithPositions(
      currentLocoPositions,
      currentDepRows,
      currentArrRows,
      inDownTable ? downStations : upStations,
      inDownTable ? 'down' : 'up'
    );
    services.push(...tableServices);
  }

  return services;
}

/**
 * Build services from parsed table data
 *
 * NEW APPROACH: Track each train through ALL station rows to find where it terminates.
 * This captures both through-trains AND short-haul services.
 *
 * Row structure for DOWN direction:
 * - depRows[0] = Kidderminster dep
 * - arrRows[0] = Bewdley arr
 * - depRows[1] = Bewdley dep
 * - depRows[2] = Arley dep
 * - depRows[3] = Highley dep
 * - depRows[4] = Hampton Loade dep
 * - arrRows[1] = Bridgnorth arr
 *
 * For each origin departure, trace through rows to find terminus.
 */
function buildServicesFromTableWithPositions(
  locoPositions: PositionedItem[],
  depRows: PositionedItem[][],
  arrRows: PositionedItem[][],
  stations: string[],
  direction: 'down' | 'up'
): HeritageService[] {
  const services: HeritageService[] = [];

  if (depRows.length === 0) {
    return services;
  }

  const originDepTimes = depRows[0];
  const originStation = stations[0];

  // Build a combined row list in travel order
  // For DOWN: Kidd dep, Bewdley arr, Bewdley dep, Arley, Highley, Hampton Loade, Bridgnorth arr
  interface StationRow {
    times: PositionedItem[];
    station: string;
    isArr: boolean;
  }

  const allRows: StationRow[] = [];

  // Interleave dep and arr rows based on station order
  // DOWN: Kidderminster(dep), Bewdley(arr,dep), Arley(dep), Highley(dep), Hampton Loade(dep), Bridgnorth(arr)
  let depIdx = 0;
  let arrIdx = 0;

  for (let stationIdx = 0; stationIdx < stations.length; stationIdx++) {
    const stationName = stations[stationIdx];

    if (stationIdx === 0) {
      // Origin station - only departure
      if (depIdx < depRows.length) {
        allRows.push({ times: depRows[depIdx], station: stationName, isArr: false });
        depIdx++;
      }
    } else if (stationIdx === stations.length - 1) {
      // Terminus station - only arrival
      if (arrIdx < arrRows.length) {
        allRows.push({ times: arrRows[arrIdx], station: stationName, isArr: true });
        arrIdx++;
      }
    } else if (stationIdx === 1) {
      // First intermediate station (Bewdley) - has both arr and dep
      if (arrIdx < arrRows.length) {
        allRows.push({ times: arrRows[arrIdx], station: stationName, isArr: true });
        arrIdx++;
      }
      if (depIdx < depRows.length) {
        allRows.push({ times: depRows[depIdx], station: stationName, isArr: false });
        depIdx++;
      }
    } else {
      // Other intermediate stations - only departure (passing time)
      if (depIdx < depRows.length) {
        allRows.push({ times: depRows[depIdx], station: stationName, isArr: false });
        depIdx++;
      }
    }
  }

  // Distance threshold for loco matching
  const MAX_LOCO_DISTANCE = 8;

  // For each origin departure, trace its journey
  for (let trainIdx = 0; trainIdx < originDepTimes.length; trainIdx++) {
    const originDep = originDepTimes[trainIdx];
    const originMinutes = timeToMinutes(originDep.value);

    // Find the loco for this train (by position, left-to-right)
    let locoId = 'DMU';
    for (let i = 0; i < locoPositions.length; i++) {
      const distance = Math.abs(originDep.position - locoPositions[i].position);
      if (distance <= MAX_LOCO_DISTANCE) {
        locoId = locoPositions[i].value;
        break;
      }
    }

    // Trace through subsequent rows to find terminus, collecting intermediate stops
    let lastTime = originMinutes;
    let lastStation = originStation;
    let arriveTime = originDep.value;
    const stops: HeritageServiceStop[] = [{ station: originStation, time: originDep.value }];

    for (let rowIdx = 1; rowIdx < allRows.length; rowIdx++) {
      const row = allRows[rowIdx];

      // Find a time in this row that's a valid continuation (after lastTime, within reasonable increment)
      // Use index-based matching first (same column), then time-based fallback
      let foundTime: PositionedItem | null = null;

      // Max time between stations - needs to be generous (25 min) for longer segments
      const MAX_STATION_INTERVAL = 25;

      // Try index-based: if this row has enough entries, check same index
      if (trainIdx < row.times.length) {
        const candidateTime = row.times[trainIdx];
        const candidateMinutes = timeToMinutes(candidateTime.value);
        // Valid if time is after lastTime and within reasonable increment
        if (candidateMinutes > lastTime && candidateMinutes <= lastTime + MAX_STATION_INTERVAL) {
          foundTime = candidateTime;
        }
      }

      // Fallback: search for any time that's a valid progression
      if (!foundTime) {
        for (const t of row.times) {
          const tMinutes = timeToMinutes(t.value);
          if (tMinutes > lastTime && tMinutes <= lastTime + MAX_STATION_INTERVAL) {
            foundTime = t;
            break;
          }
        }
      }

      if (foundTime) {
        lastTime = timeToMinutes(foundTime.value);
        lastStation = row.station;
        // Always update arriveTime to the last known time for this train
        arriveTime = foundTime.value;
        // Record this intermediate stop (deduplicate same station arr+dep — keep latest time)
        if (stops.length > 0 && stops[stops.length - 1].station === row.station) {
          stops[stops.length - 1].time = foundTime.value;
        } else {
          stops.push({ station: row.station, time: foundTime.value });
        }
      } else {
        // Train terminates before this station
        break;
      }
    }

    // Create service from origin to terminus
    // Only create if we reached at least one other station
    if (lastStation !== originStation) {
      services.push({
        locoId,
        originStation,
        destStation: lastStation,
        departTime: originDep.value,
        arriveTime,
        direction,
        stops,
      });
    }
  }

  // Sort services by departure time
  services.sort((a, b) => timeToMinutes(a.departTime) - timeToMinutes(b.departTime));

  return services;
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}


/**
 * Result of table detection - either heritage services or generic rows
 */
interface TableDetectionResult {
  type: 'heritage' | 'generic';
  heritageServices?: HeritageService[];
  genericRows?: ExtractedRow[];
  confidence: number;
}

/**
 * Tries to detect table structure from PDF text
 */
function detectTableStructure(text: string): TableDetectionResult | null {
  // First try heritage railway format
  const heritageServices = parseHeritageFormat(text);
  if (heritageServices.length > 0) {
    return {
      type: 'heritage',
      heritageServices,
      confidence: 0.9,
    };
  }

  // Fall back to generic detection
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const rows: ExtractedRow[] = [];

  for (const line of lines) {
    // Extract times from the line (both formats)
    const colonTimes: string[] = [];
    let match;
    const timeRegex = new RegExp(TIME_PATTERN);

    while ((match = timeRegex.exec(line)) !== null) {
      const normalized = normalizeTime(match[0]);
      if (normalized) {
        colonTimes.push(normalized);
      }
    }

    // Also try 4-digit times
    const fourDigitTimes = extract4DigitTimes(line);
    const times = colonTimes.length > 0 ? colonTimes : fourDigitTimes;

    // If line has at least one time, it might be a timetable row
    if (times.length >= 1) {
      let confidence = 0.5;
      if (times.length >= 2) confidence = 0.7;
      if (times.length >= 3) confidence = 0.6;

      rows.push({
        times,
        text: line,
        confidence,
      });
    }
  }

  if (rows.length === 0) {
    return null;
  }

  const avgConfidence = rows.reduce((sum, r) => sum + r.confidence, 0) / rows.length;

  return {
    type: 'generic',
    genericRows: rows,
    confidence: avgConfidence,
  };
}

/**
 * Convert HeritageService[] to Service[] with proper station/loco maps
 */
function convertHeritageServices(
  heritageServices: HeritageService[],
  dayId: string,
  dayLabel: string
): {
  services: Service[];
  stations: Map<string, Station>;
  locomotives: Map<string, Locomotive>;
} {
  const services: Service[] = [];
  const stationMap = new Map<string, Station>();
  const locoMap = new Map<string, Locomotive>();

  // Add all known stations
  const knownStations = ['Kidderminster', 'Bewdley', 'Arley', 'Highley', 'Hampton Loade', 'Bridgnorth'];
  for (const name of knownStations) {
    const id = generateStationId(name);
    stationMap.set(id, { id, name, aliases: [] });
  }

  for (const hs of heritageServices) {
    // Handle locomotive - check if it's a DMU service (no loco)
    const isDMU = hs.locoId === 'DMU';
    let locoIds: string[] = [];
    let serviceNotes: string[] = [];

    if (isDMU) {
      // DMU service - no locomotive, add note
      serviceNotes.push('DMU service');
    } else {
      // Steam/diesel loco service
      const locoId = generateLocoId(hs.locoId);
      locoIds = [locoId];

      if (!locoMap.has(locoId)) {
        locoMap.set(locoId, { id: locoId, name: hs.locoId, type: 'steam' });
      }
    }

    // Convert heritage stops to ServiceStops
    const stops: ServiceStop[] = hs.stops.map((s) => ({
      stationId: generateStationId(s.station),
      time: s.time,
    }));

    // Create service
    const service: Service = {
      id: randomUUID(),
      day: dayId,
      dayLabel: dayLabel,
      originStationId: generateStationId(hs.originStation),
      destStationId: generateStationId(hs.destStation),
      departTime: hs.departTime,
      arriveTime: hs.arriveTime,
      locomotiveIds: locoIds,
      serviceNotes,
      sourceConfidence: isDMU ? 0.75 : 0.85,
      stops: stops.length > 2 ? stops : undefined,
    };

    services.push(service);
  }

  return { services, stations: stationMap, locomotives: locoMap };
}

/**
 * Attempts to parse services from detected table structure
 */
function parseServicesFromTable(
  table: TableDetectionResult,
  issues: ParseIssue[],
  fileName: string,
  dayId?: string,
  dayLabel?: string
): {
  services: Service[];
  stations: Map<string, Station>;
  locomotives: Map<string, Locomotive>;
} {
  const effectiveDayId = dayId || new Date().toISOString().split('T')[0];
  const effectiveDayLabel = dayLabel || effectiveDayId;

  // Handle heritage format
  if (table.type === 'heritage' && table.heritageServices) {
    const result = convertHeritageServices(table.heritageServices, effectiveDayId, effectiveDayLabel);

    issues.push({
      severity: 'info',
      message: `Detected heritage railway timetable with ${result.services.length} services`,
      lineage: { fileName },
    });

    return result;
  }

  // Handle generic format
  const services: Service[] = [];
  const stationMap = new Map<string, Station>();
  const locoMap = new Map<string, Locomotive>();

  if (!table.genericRows) {
    return { services, stations: stationMap, locomotives: locoMap };
  }

  for (let i = 0; i < table.genericRows.length; i++) {
    const row = table.genericRows[i];
    const rowNum = i + 1;

    // Generic parsing (existing code)
    const stations = extractStationNames(row.text);
    const locos = extractLocomotives(row.text);

    if (stations.length < 2) {
      if (stations.length === 0) {
        issues.push({
          severity: 'warn',
          message: `Could not identify stations in row: "${row.text.substring(0, 60)}..."`,
          lineage: { fileName, row: rowNum },
        });
        continue;
      }
    }

    const originName = stations[0];
    const destName = stations.length > 1 ? stations[stations.length - 1] : stations[0];

    const originId = generateStationId(originName);
    const destId = generateStationId(destName);

    if (!stationMap.has(originId)) {
      stationMap.set(originId, { id: originId, name: originName, aliases: [] });
    }
    if (!stationMap.has(destId)) {
      stationMap.set(destId, { id: destId, name: destName, aliases: [] });
    }

    const departTime = row.times[0];
    const arriveTime = row.times.length > 1 ? row.times[row.times.length - 1] : row.times[0];

    const locoIds: string[] = [];
    for (const loco of locos) {
      const locoId = generateLocoId(loco.name);
      locoIds.push(locoId);
      if (!locoMap.has(locoId)) {
        locoMap.set(locoId, { id: locoId, name: loco.name, type: loco.type });
      }
    }

    let confidence = row.confidence;
    if (stations.length < 2) confidence *= 0.7;
    if (locos.length === 0) confidence *= 0.8;
    if (originId === destId) confidence *= 0.5;

    const service: Service = {
      id: randomUUID(),
      day: effectiveDayId,
      dayLabel: effectiveDayLabel,
      originStationId: originId,
      destStationId: destId,
      departTime,
      arriveTime,
      locomotiveIds: locoIds,
      serviceNotes: [],
      sourceConfidence: confidence,
    };

    services.push(service);
  }

  return { services, stations: stationMap, locomotives: locoMap };
}

export async function parsePdf(buffer: Buffer, fileName: string): Promise<ParseResult> {
  const issues: ParseIssue[] = [];
  let services: Service[] = [];
  const stationMap = new Map<string, Station>();
  const locoMap = new Map<string, Locomotive>();
  const availableDays: TimetableDay[] = [];

  try {
    // Parse PDF
    const pdfData = await extractPdfText(buffer);

    // Check for meaningful text content (not just page markers like "-- 1 of 1 --")
    const cleanText = pdfData.text
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '') // Remove page markers
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText || cleanText.length < 20) {
      issues.push({
        severity: 'error',
        message: 'No text content found in PDF. The file appears to be image-based or scanned.',
        lineage: { fileName },
        suggestedFix:
          'This PDF does not contain extractable text. Please try one of these alternatives:\n' +
          '• Export your timetable from Excel as CSV format\n' +
          '• Use an XLSX file directly\n' +
          '• Ensure the PDF was created with selectable text (not scanned)',
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

    // Add info about PDF structure
    issues.push({
      severity: 'info',
      message: `PDF has ${pdfData.numPages} page(s) and ${pdfData.text.length} characters of text`,
      lineage: { fileName },
    });

    // Check if we have multiple pages with different days
    const pagesWithDays = pdfData.pages.filter((p) => p.dayId);
    const uniqueDays = new Map<string, { label: string; pages: PdfPage[] }>();

    for (const page of pagesWithDays) {
      if (page.dayId && page.day) {
        const existing = uniqueDays.get(page.dayId);
        if (existing) {
          existing.pages.push(page);
        } else {
          uniqueDays.set(page.dayId, { label: page.day, pages: [page] });
        }
      }
    }

    // Process based on whether we have multi-day or single-day PDF
    if (uniqueDays.size > 1) {
      // Multi-day PDF: process each day's pages separately
      issues.push({
        severity: 'info',
        message: `Detected ${uniqueDays.size} different days in PDF`,
        lineage: { fileName },
      });

      for (const [dayId, dayInfo] of uniqueDays) {
        // Combine text from all pages for this day
        const dayText = dayInfo.pages.map((p) => p.text).join('\n');

        // Detect table structure for this day's content
        const table = detectTableStructure(dayText);

        if (table) {
          const result = parseServicesFromTable(table, issues, fileName, dayId, dayInfo.label);

          // Add services for this day
          for (const service of result.services) {
            services.push(service);
          }

          // Merge stations and locomotives
          for (const [id, station] of result.stations) {
            stationMap.set(id, station);
          }
          for (const [id, loco] of result.locomotives) {
            locoMap.set(id, loco);
          }

          // Add to availableDays
          const dayServiceCount = result.services.length;
          availableDays.push({
            id: dayId,
            label: dayInfo.label,
            serviceCount: dayServiceCount,
          });
        }
      }

      // Sort availableDays by date
      availableDays.sort((a, b) => a.id.localeCompare(b.id));
    } else {
      // Single day or no day detected: process entire PDF as one
      const dayId = pagesWithDays[0]?.dayId || new Date().toISOString().split('T')[0];
      const dayLabel = pagesWithDays[0]?.day || dayId;

      // Try to detect table structure from full text
      const table = detectTableStructure(pdfData.text);

      if (!table) {
        issues.push({
          severity: 'warn',
          message: 'Could not detect timetable structure in PDF',
          lineage: { fileName },
          suggestedFix:
            'The PDF may not contain a recognizable timetable format. Try using CSV or Excel.',
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

      // Parse services from detected table
      const result = parseServicesFromTable(table, issues, fileName, dayId, dayLabel);
      services = result.services;

      // Merge stations and locomotives
      for (const [id, station] of result.stations) {
        stationMap.set(id, station);
      }
      for (const [id, loco] of result.locomotives) {
        locoMap.set(id, loco);
      }

      // Add single day to availableDays if we have services
      if (services.length > 0) {
        availableDays.push({
          id: dayId,
          label: dayLabel,
          serviceCount: services.length,
        });
      }
    }

    // Add confidence warning for PDF extraction
    const avgConfidence =
      services.length > 0
        ? services.reduce((sum, s) => sum + s.sourceConfidence, 0) / services.length
        : 0;

    if (avgConfidence < 0.7) {
      issues.push({
        severity: 'warn',
        message: `PDF extraction confidence is low (${Math.round(avgConfidence * 100)}%). Please review the extracted data.`,
        lineage: { fileName },
        suggestedFix: 'Consider using CSV or Excel format for more accurate results.',
      });
    }

    // Add summary
    if (services.length > 0) {
      const dayInfo = availableDays.length > 1
        ? ` across ${availableDays.length} days`
        : '';
      issues.push({
        severity: 'info',
        message: `Extracted ${services.length} services, ${stationMap.size} stations, ${locoMap.size} locomotives from PDF${dayInfo}`,
        lineage: { fileName },
      });
    } else {
      issues.push({
        severity: 'warn',
        message: 'No services could be extracted from the PDF',
        lineage: { fileName },
        suggestedFix: 'The timetable format may not be recognized. Try CSV or Excel format.',
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    issues.push({
      severity: 'error',
      message: `Failed to parse PDF: ${errorMessage}`,
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
    availableDays: availableDays.length > 0 ? availableDays : undefined,
  };
}
