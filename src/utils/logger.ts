type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'action' | 'error' | 'system';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  event: string;
  payload?: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
}

// Entries older than lastSyncedAt that haven't been flushed yet will be
// silently dropped if the buffer reaches MAX_BUFFER before the next sync tick.
// This is an accepted tradeoff: sync runs every 60s and the app generates
// far fewer than 100 log entries per minute under normal use.
const MAX_BUFFER = 100;

class Logger {
  private buffer: LogEntry[] = [];
  private lastSyncedAt = 0;

  private isTestMode(): boolean {
    return !!(window as unknown as Record<string, unknown>).__PLAYWRIGHT_TEST_USER__;
  }

  private push(entry: LogEntry): void {
    if (this.isTestMode()) return;
    if (this.buffer.length >= MAX_BUFFER) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  logAction(event: string, payload?: Record<string, unknown>): void {
    if (this.isTestMode()) return;
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'info',
      category: 'action',
      event,
      payload,
    };
    this.push(entry);
    if (import.meta.env.DEV) {
      console.info(`[logger] ${event}`, payload ?? '');
    }
  }

  logError(event: string, error: unknown, context?: Record<string, unknown>): void {
    if (this.isTestMode()) return;
    let errorMessage: string | undefined;
    let errorStack: string | undefined;
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error !== null && error !== undefined) {
      try { errorMessage = String(error); } catch { errorMessage = '[unstringifiable error]'; }
    }
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'error',
      category: 'error',
      event,
      payload: context,
      errorMessage,
      errorStack,
    };
    this.push(entry);
    if (import.meta.env.DEV) {
      console.error(`[logger] ${event}`, { error, context });
    }
  }

  getRecentLogs(): LogEntry[] {
    return [...this.buffer];
  }

  getUnsyncedEntries(): LogEntry[] {
    return this.buffer.filter(e => e.timestamp > this.lastSyncedAt);
  }

  markAllSynced(): void {
    this.lastSyncedAt = Date.now();
  }
}

export const logger = new Logger();
