import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import type { TestReport } from '../types';
import { errorHandler } from '../utils/ErrorHandler';

interface DatabaseResult {
  lastID: number;
  changes: number;
}

interface TestData {
  id?: number;
  name: string;
  description?: string;
  test_data: any;
  created_at?: string;
  updated_at?: string;
}

interface TestResult {
  id?: number;
  test_id?: number;
  scenario_id?: number;
  status: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  error_message?: string;
  report?: TestReport;
  created_at?: string;
}

interface Setting {
  key: string;
  value: string;
  updated_at?: string;
}

interface DatabaseStats {
  totalTests: number;
  totalScenarios: number;
  totalResults: number;
  recentResults: number;
}

export class DatabaseManager {
  private dbPath: string;
  private db: sqlite3.Database | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.initializeDatabase().catch(error => {
      errorHandler.error('Database initialization failed', { error });
    });
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          await errorHandler.error('Error opening database', { error: err, dbPath: this.dbPath });
          throw err;
        } else {
          await errorHandler.info('Connected to SQLite database', { dbPath: this.dbPath });
          await this.createTables();
        }
      });
    } catch (error) {
      await errorHandler.error('Failed to initialize database', { error, dbPath: this.dbPath });
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    try {
      // Tests table (legacy - for backward compatibility)
      await this.run(`
        CREATE TABLE IF NOT EXISTS tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          test_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Test results table
      await this.run(`
        CREATE TABLE IF NOT EXISTS test_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          test_id INTEGER,
          scenario_id INTEGER,
          status TEXT NOT NULL,
          start_time DATETIME,
          end_time DATETIME,
          duration INTEGER,
          error_message TEXT,
          report TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (test_id) REFERENCES tests(id),
          FOREIGN KEY (scenario_id) REFERENCES scenarios(id)
        )
      `);

      // Settings table
      await this.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await errorHandler.info('Database tables created successfully');
    } catch (error) {
      await errorHandler.error('Failed to create database tables', { error });
      throw error;
    }
  }

  // Promisified database methods
  async run(sql: string, params: any[] = []): Promise<DatabaseResult> {
    return await errorHandler.retry(async () => {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        this.db!.run(sql, params, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        });
      });
    }, {
      maxAttempts: 3,
      delay: 1000,
      timeout: 30000
    });
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    return await errorHandler.retry(async () => {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        this.db!.get(sql, params, (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    }, {
      maxAttempts: 3,
      delay: 1000,
      timeout: 30000
    });
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    return await errorHandler.retry(async () => {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        this.db!.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    }, {
      maxAttempts: 3,
      delay: 1000,
      timeout: 30000
    });
  }

  // Test management methods
  async saveTest(testData: Omit<TestData, 'id'>): Promise<TestData> {
    const { name, description, test_data } = testData;
    const result = await this.run(
      'INSERT INTO tests (name, description, test_data) VALUES (?, ?, ?)',
      [name, description, JSON.stringify(test_data)]
    );
    return { id: result.lastID, ...testData };
  }

  async getAllTests(): Promise<TestData[]> {
    const tests = await this.all('SELECT * FROM tests ORDER BY updated_at DESC');
    return tests.map(test => ({
      ...test,
      test_data: JSON.parse(test.test_data)
    }));
  }

  async getTest(id: number): Promise<TestData | null> {
    const test = await this.get('SELECT * FROM tests WHERE id = ?', [id]);
    if (test) {
      test.test_data = JSON.parse(test.test_data);
    }
    return test;
  }

  async updateTest(id: number, updates: Partial<TestData>): Promise<TestData | null> {
    const { name, description, test_data } = updates;
    await this.run(
      'UPDATE tests SET name = ?, description = ?, test_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, JSON.stringify(test_data), id]
    );
    return await this.getTest(id);
  }

  async deleteTest(id: number): Promise<{ success: boolean }> {
    await this.run('DELETE FROM tests WHERE id = ?', [id]);
    return { success: true };
  }

  // Test results methods
  async saveTestResult(result: Omit<TestResult, 'id'>): Promise<TestResult> {
    const { test_id, scenario_id, status, start_time, end_time, duration, error_message, report } = result;
    const resultData = await this.run(
      `INSERT INTO test_results (test_id, scenario_id, status, start_time, end_time, duration, error_message, report) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [test_id, scenario_id, status, start_time, end_time, duration, error_message, JSON.stringify(report)]
    );
    return { id: resultData.lastID, ...result };
  }

  async getTestResults(testId?: number, limit: number = 50): Promise<TestResult[]> {
    let query = 'SELECT * FROM test_results';
    const params: any[] = [];

    if (testId) {
      query += ' WHERE test_id = ? OR scenario_id = ?';
      params.push(testId, testId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const results = await this.all(query, params);
    return results.map(result => ({
      ...result,
      report: result.report ? JSON.parse(result.report) : undefined
    }));
  }

  // Settings methods
  async getSetting(key: string): Promise<string | null> {
    const setting = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
    return setting ? setting.value : null;
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    await this.run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    );
    return { key, value };
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const settings = await this.all('SELECT * FROM settings');
    const result: Record<string, string> = {};
    settings.forEach(setting => {
      result[setting.key] = setting.value;
    });
    return result;
  }

  // Utility methods
  async vacuum(): Promise<void> {
    await this.run('VACUUM');
  }

  async getStats(): Promise<DatabaseStats> {
    const totalTests = await this.get('SELECT COUNT(*) as count FROM tests');
    const totalScenarios = await this.get('SELECT COUNT(*) as count FROM scenarios');
    const totalResults = await this.get('SELECT COUNT(*) as count FROM test_results');
    const recentResults = await this.get(
      'SELECT COUNT(*) as count FROM test_results WHERE created_at > datetime("now", "-7 days")'
    );

    return {
      totalTests: totalTests?.count || 0,
      totalScenarios: totalScenarios?.count || 0,
      totalResults: totalResults?.count || 0,
      recentResults: recentResults?.count || 0
    };
  }

  async backup(backupPath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const backupDb = new sqlite3.Database(backupPath);

      this.db!.backup(backupDb, (err) => {
        if (err) {
          reject(err);
        } else {
          backupDb.close();
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      });
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.get('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async beginTransaction(): Promise<void> {
    await this.run('BEGIN TRANSACTION');
  }

  async commitTransaction(): Promise<void> {
    await this.run('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    await this.run('ROLLBACK');
  }

  async executeTransaction<T>(callback: () => Promise<T>): Promise<T> {
    try {
      await this.beginTransaction();
      const result = await callback();
      await this.commitTransaction();
      return result;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }
} 