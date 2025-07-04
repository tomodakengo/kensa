import * as fs from 'fs-extra';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  error?: Error;
  context?: any;
  stack?: string;
}

export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
  timeout: number;
}

export class ErrorHandler {
  private logFile: string;
  private logLevel: LogLevel;
  private maxLogSize: number;
  private logs: LogEntry[] = [];

  constructor(options: {
    logFile?: string;
    logLevel?: LogLevel;
    maxLogSize?: number;
  } = {}) {
    this.logFile = options.logFile || path.join(process.cwd(), 'logs', 'app.log');
    this.logLevel = options.logLevel || LogLevel.INFO;
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    
    this.initializeLogging();
    this.setupGlobalErrorHandlers();
  }

  private async initializeLogging(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.logFile));
    } catch (error) {
      console.error('Failed to initialize logging:', error);
    }
  }

  private setupGlobalErrorHandlers(): void {
    // 未処理のPromise拒否をキャッチ
    process.on('unhandledRejection', (reason, promise) => {
      this.log(LogLevel.ERROR, 'Unhandled Promise Rejection', {
        reason,
        promise
      });
    });

    // 未処理の例外をキャッチ
    process.on('uncaughtException', (error) => {
      this.log(LogLevel.FATAL, 'Uncaught Exception', { error });
      
      // 致命的なエラーの場合はアプリケーションを終了
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Electronのレンダラープロセスエラー
    if (process.type === 'renderer') {
      window.addEventListener('error', (event) => {
        this.log(LogLevel.ERROR, 'Renderer Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.log(LogLevel.ERROR, 'Renderer Unhandled Rejection', {
          reason: event.reason
        });
      });
    }
  }

  async log(level: LogLevel, message: string, context?: any): Promise<void> {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack: context?.error?.stack
    };

    this.logs.push(entry);

    // コンソールに出力
    const levelName = LogLevel[level];
    const logMessage = `[${entry.timestamp}] ${levelName}: ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, context);
        break;
      case LogLevel.INFO:
        console.info(logMessage, context);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, context);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logMessage, context);
        break;
    }

    // ファイルに書き込み
    await this.writeToFile(entry);
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logFile, logLine);

      // ログファイルサイズチェック
      const stats = await fs.stat(this.logFile);
      if (stats.size > this.maxLogSize) {
        await this.rotateLogFile();
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async rotateLogFile(): Promise<void> {
    try {
      const backupFile = `${this.logFile}.${new Date().toISOString().replace(/[:.]/g, '-')}`;
      await fs.move(this.logFile, backupFile);
      
      // 古いログファイルを削除（30日以上古いもの）
      const logDir = path.dirname(this.logFile);
      const files = await fs.readdir(logDir);
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.startsWith(path.basename(this.logFile)) && file !== path.basename(this.logFile)) {
          const filePath = path.join(logDir, file);
          const stats = await fs.stat(filePath);
          if (stats.mtime.getTime() < thirtyDaysAgo) {
            await fs.remove(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  async retry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delay = 1000,
      backoffMultiplier = 2,
      timeout = 30000
    } = options;

    let lastError: Error;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // タイムアウト付きで実行
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Operation timeout')), timeout);
          })
        ]);

        if (attempt > 1) {
          this.log(LogLevel.INFO, `Operation succeeded after ${attempt} attempts`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        this.log(LogLevel.WARN, `Operation failed (attempt ${attempt}/${maxAttempts})`, {
          error: lastError,
          attempt,
          maxAttempts
        });

        if (attempt === maxAttempts) {
          break;
        }

        // 次の試行まで待機
        await this.sleep(currentDelay);
        currentDelay *= backoffMultiplier;
      }
    }

    throw new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 便利なログメソッド
  async debug(message: string, context?: any): Promise<void> {
    return this.log(LogLevel.DEBUG, message, context);
  }

  async info(message: string, context?: any): Promise<void> {
    return this.log(LogLevel.INFO, message, context);
  }

  async warn(message: string, context?: any): Promise<void> {
    return this.log(LogLevel.WARN, message, context);
  }

  async error(message: string, context?: any): Promise<void> {
    return this.log(LogLevel.ERROR, message, context);
  }

  async fatal(message: string, context?: any): Promise<void> {
    return this.log(LogLevel.FATAL, message, context);
  }

  // ログの取得
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level >= level);
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    
    return filteredLogs;
  }

  async getLogFileContent(limit?: number): Promise<string> {
    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      const lines = content.trim().split('\n');
      
      if (limit) {
        return lines.slice(-limit).join('\n');
      }
      
      return content;
    } catch (error) {
      return '';
    }
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

// シングルトンインスタンス
export const errorHandler = new ErrorHandler(); 