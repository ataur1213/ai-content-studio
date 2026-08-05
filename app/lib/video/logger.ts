import type { LogLevel, LogEntry, LoggerConfig, JobId, WorkerId } from './types';
import { LOG_LEVEL_VALUES, DEFAULT_LOGGER_CONFIG } from './constants';

/**
 * Callback signature for handling structured log entries.
 * Receives the fully-formed LogEntry and the original raw arguments.
 */
export type LogHandler = (entry: LogEntry, ...args: unknown[]) => void;

/**
 * Optional context that can be attached to log entries.
 * Provides job or worker correlation without requiring explicit parameters on every call.
 */
export interface LogContext {
  readonly jobId?: JobId;
  readonly workerId?: WorkerId;
  readonly [key: string]: unknown;
}

/**
 * Configuration options for creating a Logger instance.
 * Extends LoggerConfig with handler registration and default context.
 */
export interface LoggerOptions extends LoggerConfig {
  readonly handler?: LogHandler;
  readonly context?: LogContext;
}

/**
 * Structured logging implementation with level-based filtering and contextual enrichment.
 *
 * Features:
 * - Level-based filtering using numeric severity comparison
 * - Automatic timestamp generation
 * - Contextual enrichment via constructor context and per-call overrides
 * - Configurable output handler (defaults to console)
 * - Immutable context chain—each log call produces an independent entry
 *
 * @example
 * ```typescript
 * const logger = new Logger({ minLevel: 'info' });
 * logger.info('Service started');
 *
 * const jobLogger = logger.withContext({ jobId: toJobId('job-123') });
 * jobLogger.error('Processing failed', { error: err });
 * ```
 */
export class Logger {
  private readonly config: LoggerConfig;
  private readonly handler: LogHandler;
  private readonly context: LogContext;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.config = {
      minLevel: options.minLevel ?? DEFAULT_LOGGER_CONFIG.minLevel,
      includeTimestamp: options.includeTimestamp ?? DEFAULT_LOGGER_CONFIG.includeTimestamp,
      includeContext: options.includeContext ?? DEFAULT_LOGGER_CONFIG.includeContext,
    };
    this.context = options.context ?? {};
    this.handler = options.handler ?? createDefaultLogHandler(this.config.includeTimestamp);
  }

  /**
   * Logs a message at debug level.
   * Intended for detailed diagnostic information during development or troubleshooting.
   */
  public debug(message: string, context?: LogContext, ...args: unknown[]): void {
    this.log('debug', message, context, ...args);
  }

  /**
   * Logs a message at info level.
   * Intended for general operational information about service behavior.
   */
  public info(message: string, context?: LogContext, ...args: unknown[]): void {
    this.log('info', message, context, ...args);
  }

  /**
   * Logs a message at warn level.
   * Intended for potentially harmful situations that are not yet errors.
   */
  public warn(message: string, context?: LogContext, ...args: unknown[]): void {
    this.log('warn', message, context, ...args);
  }

  /**
   * Logs a message at error level.
   * Intended for failure conditions that affect individual operations.
   */
  public error(message: string, context?: LogContext, ...args: unknown[]): void {
    this.log('error', message, context, ...args);
  }

  /**
   * Logs a message at fatal level.
   * Intended for catastrophic failures that require immediate attention.
   */
  public fatal(message: string, context?: LogContext, ...args: unknown[]): void {
    this.log('fatal', message, context, ...args);
  }

  /**
   * Creates a new Logger instance with merged context.
   * The returned logger inherits all configuration from this instance
   * but adds the provided context to every log entry.
   * Call-specific context takes precedence over logger context.
   *
   * @param additionalContext - Additional context to merge into all future log entries.
   * @returns A new Logger instance with the merged context.
   */
  public withContext(additionalContext: LogContext): Logger {
    const merged: LogContext = { ...this.context, ...additionalContext } as LogContext;
    const options: LoggerOptions = {
      minLevel: this.config.minLevel,
      includeTimestamp: this.config.includeTimestamp,
      includeContext: this.config.includeContext,
      handler: this.handler,
      context: merged,
    };
    return new Logger(options);
  }

  /**
   * Creates a new Logger instance with a different minimum log level.
   * All other configuration and context is preserved.
   *
   * @param level - The new minimum log level.
   * @returns A new Logger instance with the updated level.
   */
  public withLevel(level: LogLevel): Logger {
    const options: LoggerOptions = {
      minLevel: level,
      includeTimestamp: this.config.includeTimestamp,
      includeContext: this.config.includeContext,
      handler: this.handler,
      context: this.context,
    };
    return new Logger(options);
  }

  /**
   * Returns the current minimum log level.
   */
  public getLevel(): LogLevel {
    return this.config.minLevel;
  }

  /**
   * Checks whether a given log level would pass the current minimum level filter.
   *
   * @param level - The level to check.
   * @returns True if messages at this level would be logged.
   */
  public isEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.config.minLevel];
  }

  /**
   * Core logging method.
   * Constructs a LogEntry, applies filtering, and delegates to the handler.
   * Builds the entry immutably in a single assignment—no mutation after creation.
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    ...args: unknown[]
  ): void {
    if (!this.isEnabled(level)) {
      return;
    }

    const mergedContext = this.mergeContext(context);
    const error = extractError(args);

    const jobId: JobId | undefined = mergedContext.jobId;
    const workerId: WorkerId | undefined = mergedContext.workerId;

    let entryContext: LogEntry['context'] = undefined;
    if (this.config.includeContext) {
      const remaining: Record<string, unknown> = {};
      for (const key of Object.keys(mergedContext)) {
        if (key !== 'jobId' && key !== 'workerId') {
          remaining[key] = mergedContext[key];
        }
      }
      if (Object.keys(remaining).length > 0) {
        entryContext = remaining;
      }
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: entryContext,
      jobId,
      workerId,
      error: error ?? undefined,
    };

    this.handler(entry, ...args);
  }

  /**
   * Merges constructor context with call-specific context.
   * Call-specific context takes precedence.
   */
  private mergeContext(callContext?: LogContext): LogContext {
    if (!callContext || Object.keys(callContext).length === 0) {
      return this.context;
    }
    return { ...this.context, ...callContext } as LogContext;
  }
}

/**
 * Extracts the first Error instance from the arguments array.
 * Used to populate the dedicated error field on LogEntry.
 */
function extractError(args: readonly unknown[]): Error | null {
  for (const arg of args) {
    if (arg instanceof Error) {
      return arg;
    }
  }
  return null;
}

/**
 * Creates the default log handler with timestamp inclusion behavior captured in closure.
 *
 * @param includeTimestamp - Whether to include the ISO timestamp in formatted output.
 * @returns A LogHandler function configured with the specified timestamp behavior.
 */
function createDefaultLogHandler(includeTimestamp: boolean): LogHandler {
  return (entry: LogEntry, ...args: unknown[]): void => {
    const consoleMethod = consoleMethodForLevel(entry.level);
    const formatted = formatEntry(entry, includeTimestamp);

    if (entry.error) {
      consoleMethod(formatted, ...args, entry.error);
    } else {
      consoleMethod(formatted, ...args);
    }
  };
}

/**
 * Maps a LogLevel to the corresponding console method function reference.
 * Returns bound functions to preserve console context.
 */
function consoleMethodForLevel(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'debug':
      return console.debug.bind(console);
    case 'info':
      return console.info.bind(console);
    case 'warn':
      return console.warn.bind(console);
    case 'error':
    case 'fatal':
      return console.error.bind(console);
  }
}

/**
 * Formats a LogEntry into a human-readable string.
 *
 * @param entry - The log entry to format.
 * @param includeTimestamp - Whether to include the ISO 8601 timestamp in the output.
 * @returns The formatted log message string.
 */
function formatEntry(entry: LogEntry, includeTimestamp: boolean): string {
  const parts: string[] = [];

  if (includeTimestamp) {
    parts.push(entry.timestamp.toISOString());
  }

  parts.push(`[${entry.level.toUpperCase()}]`);

  if (entry.jobId) {
    parts.push(`[job:${entry.jobId}]`);
  }

  if (entry.workerId) {
    parts.push(`[worker:${entry.workerId}]`);
  }

  parts.push(entry.message);

  return parts.join(' ');
}