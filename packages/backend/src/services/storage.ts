import type { ParseResult } from '@gala-planner/shared';

/**
 * In-memory storage for uploaded files and parse results
 * MVP implementation - replace with persistent storage later
 */
class InMemoryStorage {
  private parseResults: Map<string, ParseResult> = new Map();
  private fileBuffers: Map<string, Buffer> = new Map();

  /**
   * Store a file buffer temporarily
   */
  storeFile(id: string, buffer: Buffer): void {
    this.fileBuffers.set(id, buffer);
  }

  /**
   * Retrieve a stored file buffer
   */
  getFile(id: string): Buffer | undefined {
    return this.fileBuffers.get(id);
  }

  /**
   * Delete a stored file
   */
  deleteFile(id: string): boolean {
    return this.fileBuffers.delete(id);
  }

  /**
   * Store a parse result
   */
  storeParseResult(result: ParseResult): void {
    this.parseResults.set(result.id, result);
  }

  /**
   * Retrieve a parse result
   */
  getParseResult(id: string): ParseResult | undefined {
    return this.parseResults.get(id);
  }

  /**
   * List all parse results
   */
  listParseResults(): ParseResult[] {
    return Array.from(this.parseResults.values());
  }

  /**
   * Delete a parse result and associated file
   */
  deleteParseResult(id: string): boolean {
    this.fileBuffers.delete(id);
    return this.parseResults.delete(id);
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    this.parseResults.clear();
    this.fileBuffers.clear();
  }
}

// Export singleton instance
export const storage = new InMemoryStorage();
