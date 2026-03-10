/**
 * Severity level of a parsing issue
 */
export type ParseIssueSeverity = 'info' | 'warn' | 'error';

/**
 * Describes where in the source file an issue occurred
 */
export interface IssueLineage {
  /** Original filename */
  fileName?: string;
  /** Page number (for PDFs) */
  page?: number;
  /** Table index on the page */
  table?: number;
  /** Row number */
  row?: number;
  /** Column name or index */
  column?: string | number;
}

/**
 * Represents an issue found during parsing
 */
export interface ParseIssue {
  /** Severity of the issue */
  severity: ParseIssueSeverity;
  /** Human-readable description */
  message: string;
  /** Location in source file */
  lineage: IssueLineage;
  /** Suggested resolution (optional) */
  suggestedFix?: string;
}
