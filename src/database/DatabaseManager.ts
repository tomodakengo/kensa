import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import type { TestReport } from '../types';
import { ErrorHandler } from '../utils/ErrorHandler';
import { DatabaseError } from '../types';
import { ConnectionPool } from './ConnectionPool';

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

interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

interface MigrationRecord {
  version: number;
  name: string;
  executed_at: string;
}

export class DatabaseManager {
  private dbPath: string;
  private db: sqlite3.Database | null = null;
  private migrationsPath: string;
  private migrations: Migration[] = [];
  private connectionPool: ConnectionPool | null = null;
  private usePool: boolean = false;

  constructor(dbPath: string, migrationsPath: string = 'migrations', usePool: boolean = false) {
    this.dbPath = dbPath;
    this.migrationsPath = migrationsPath;
    this.usePool = usePool;
    
    if (usePool) {
      this.connectionPool = new ConnectionPool(dbPath);
    }
  }

  async connect(): Promise<void> {
    if (this.usePool && this.connectionPool) {
      await this.connectionPool.initialize();
    } else {
      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            reject(new DatabaseError('Connection failed', 'DB_CONNECT_ERROR', err));
          } else {
            resolve();
          }
        });
      });
    }
  }

  async run(query: string, params: any[] = []): Promise<DatabaseResult> {
    if (this.usePool && this.connectionPool) {
      return await this.connectionPool.execute(async (db) => {
        return await ErrorHandler.retryOperation(async () => {
          return new Promise<DatabaseResult>((resolve, reject) => {
            db.run(query, params, function (err) {
              if (err) {
                reject(err);
              } else {
                resolve({
                  lastID: this.lastID,
                  changes: this.changes
                });
              }
            });
          });
        });
      });
    } else {
      return await ErrorHandler.retryOperation(async () => {
        return new Promise<DatabaseResult>((resolve, reject) => {
          if (!this.db) {
            reject(new Error('Database not initialized'));
            return;
          }

          this.db.run(query, params, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({
                lastID: this.lastID,
                changes: this.changes
              });
            }
          });
        });
      });
    }
  }

  async get(query: string, params: any[] = []): Promise<any> {
    if (this.usePool && this.connectionPool) {
      return await this.connectionPool.execute(async (db) => {
        return await ErrorHandler.retryOperation(async () => {
          return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
              if (err) {
                reject(err);
              } else {
                resolve(row);
              }
            });
          });
        });
      });
    } else {
      return await ErrorHandler.retryOperation(async () => {
        return new Promise((resolve, reject) => {
          if (!this.db) {
            reject(new Error('Database not initialized'));
            return;
          }

          this.db.get(query, params, (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          });
        });
      });
    }
  }

  async all(query: string, params: any[] = []): Promise<any[]> {
    if (this.usePool && this.connectionPool) {
      return await this.connectionPool.execute(async (db) => {
        return await ErrorHandler.retryOperation(async () => {
          return new Promise<any[]>((resolve, reject) => {
            db.all(query, params, (err, rows) => {
              if (err) {
                reject(err);
              } else {
                resolve(rows || []);
              }
            });
          });
        });
      });
    } else {
      return await ErrorHandler.retryOperation(async () => {
        return new Promise<any[]>((resolve, reject) => {
          if (!this.db) {
            reject(new Error('Database not initialized'));
            return;
          }

          this.db.all(query, params, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows || []);
            }
          });
        });
      });
    }
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

  async backup(filename: string): Promise<void> {
    if (!this.db) {
      throw new DatabaseError('Database not connected', 'DB_NOT_CONNECTED');
    }

    return new Promise((resolve, reject) => {
      const backupDb = new sqlite3.Database(filename, (err) => {
        if (err) {
          reject(new DatabaseError('Backup failed', 'DB_BACKUP_ERROR', err));
          return;
        }

        // Note: sqlite3 library backup method might not be available
        // This is a simplified implementation
        try {
          // Use serialize/parallelize as alternative
          backupDb.close((closeErr) => {
            if (closeErr) {
              reject(new DatabaseError('Backup close failed', 'DB_BACKUP_CLOSE_ERROR', closeErr));
            } else {
              resolve();
            }
          });
        } catch (error) {
          reject(new DatabaseError('Backup operation failed', 'DB_BACKUP_OPERATION_ERROR', error));
        }
      });
    });
  }

  async close(): Promise<void> {
    if (this.usePool && this.connectionPool) {
      await this.connectionPool.close();
    } else if (this.db) {
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

  /**
   * データベースマイグレーション機能
   */
  async initializeMigrations(): Promise<void> {
    // マイグレーションテーブルの作成
    await this.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // マイグレーションファイルの読み込み
    await this.loadMigrations();
  }

  private async loadMigrations(): Promise<void> {
    try {
      if (!fs.existsSync(this.migrationsPath)) {
        fs.mkdirSync(this.migrationsPath, { recursive: true });
        await this.createBaseMigrations();
      }

      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      this.migrations = [];
      for (const file of files) {
        const filePath = path.join(this.migrationsPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const migration = this.parseMigrationFile(file, content);
        if (migration) {
          this.migrations.push(migration);
        }
      }
    } catch (error) {
      throw new DatabaseError('Failed to load migrations', 'MIGRATION_LOAD_ERROR', error);
    }
  }

  private parseMigrationFile(filename: string, content: string): Migration | null {
    try {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match || !match[1] || !match[2]) return null;

      const version = parseInt(match[1]);
      const name = match[2];

      const upMatch = content.match(/-- UP\s*(.*?)(?=-- DOWN|\s*$)/s);
      const downMatch = content.match(/-- DOWN\s*(.*?)$/s);

      if (!upMatch || !upMatch[1]) return null;

      return {
        version,
        name,
        up: upMatch[1].trim(),
        down: downMatch && downMatch[1] ? downMatch[1].trim() : ''
      };
    } catch (error) {
      console.error(`Error parsing migration file ${filename}:`, error);
      return null;
    }
  }

  private async createBaseMigrations(): Promise<void> {
    const baseMigrations = [
      {
        version: 1,
        name: 'create_tests_table',
        up: `
          CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            test_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `,
        down: 'DROP TABLE IF EXISTS tests;'
      },
      {
        version: 2,
        name: 'create_scenarios_table',
        up: `
          CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            test_data TEXT NOT NULL,
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `,
        down: 'DROP TABLE IF EXISTS scenarios;'
      },
      {
        version: 3,
        name: 'create_test_results_table',
        up: `
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
          );
        `,
        down: 'DROP TABLE IF EXISTS test_results;'
      },
      {
        version: 4,
        name: 'create_settings_table',
        up: `
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `,
        down: 'DROP TABLE IF EXISTS settings;'
      },
      {
        version: 5,
        name: 'create_locators_table',
        up: `
          CREATE TABLE IF NOT EXISTS locators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            selector TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `,
        down: 'DROP TABLE IF EXISTS locators;'
      }
    ];

    for (const migration of baseMigrations) {
      const filename = `${migration.version.toString().padStart(3, '0')}_${migration.name}.sql`;
      const filePath = path.join(this.migrationsPath, filename);
      const content = `-- UP\n${migration.up}\n\n-- DOWN\n${migration.down}`;
      fs.writeFileSync(filePath, content);
    }
  }

  async getCurrentSchemaVersion(): Promise<number> {
    try {
      const result = await this.get('SELECT MAX(version) as version FROM migrations');
      return result?.version || 0;
    } catch (error) {
      // migrationsテーブルが存在しない場合
      return 0;
    }
  }

  async getAvailableMigrations(): Promise<Migration[]> {
    return this.migrations.slice();
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const currentVersion = await this.getCurrentSchemaVersion();
    return this.migrations.filter(m => m.version > currentVersion);
  }

  async migrate(targetVersion?: number): Promise<void> {
    try {
      const pendingMigrations = await this.getPendingMigrations();

      if (targetVersion) {
        const targetMigrations = pendingMigrations.filter(m => m.version <= targetVersion);
        await this.executeMigrations(targetMigrations);
      } else {
        await this.executeMigrations(pendingMigrations);
      }
    } catch (error) {
      throw new DatabaseError('Migration failed', 'MIGRATION_ERROR', error);
    }
  }

  private async executeMigrations(migrations: Migration[]): Promise<void> {
    for (const migration of migrations) {
      await this.executeTransaction(async () => {
        // マイグレーションのUPスクリプトを実行
        const statements = migration.up.split(';').filter(s => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await this.run(statement.trim());
          }
        }

        // マイグレーション履歴に記録
        await this.run(
          'INSERT INTO migrations (version, name) VALUES (?, ?)',
          [migration.version, migration.name]
        );
      });
      
      console.log(`Migration ${migration.version}_${migration.name} executed successfully`);
    }
  }

  async rollback(targetVersion?: number): Promise<void> {
    try {
      const currentVersion = await this.getCurrentSchemaVersion();
      const migrationsToRollback = this.migrations
        .filter(m => m.version <= currentVersion && (!targetVersion || m.version > targetVersion))
        .sort((a, b) => b.version - a.version); // 降順でロールバック

      for (const migration of migrationsToRollback) {
        await this.executeTransaction(async () => {
          // マイグレーションのDOWNスクリプトを実行
          if (migration.down) {
            const statements = migration.down.split(';').filter(s => s.trim());
            for (const statement of statements) {
              if (statement.trim()) {
                await this.run(statement.trim());
              }
            }
          }

          // マイグレーション履歴から削除
          await this.run('DELETE FROM migrations WHERE version = ?', [migration.version]);
        });
        
        console.log(`Migration ${migration.version}_${migration.name} rolled back successfully`);
      }
    } catch (error) {
      throw new DatabaseError('Rollback failed', 'ROLLBACK_ERROR', error);
    }
  }

  async getMigrationHistory(): Promise<MigrationRecord[]> {
    return await this.all('SELECT * FROM migrations ORDER BY version DESC');
  }

  async createMigration(name: string): Promise<string> {
    const version = Math.max(...this.migrations.map(m => m.version), 0) + 1;
    const filename = `${version.toString().padStart(3, '0')}_${name}.sql`;
    const filePath = path.join(this.migrationsPath, filename);
    
    const template = `-- UP
-- Add your migration SQL here

-- DOWN
-- Add your rollback SQL here
`;

    fs.writeFileSync(filePath, template);
    return filePath;
  }

  /**
   * 接続プールの統計情報を取得
   */
  getConnectionPoolStats(): {
    totalConnections: number;
    inUseConnections: number;
    idleConnections: number;
    waitingRequests: number;
  } | null {
    if (this.usePool && this.connectionPool) {
      return this.connectionPool.getStats();
    }
    return null;
  }

  /**
   * 接続プールの使用状況を確認
   */
  isUsingConnectionPool(): boolean {
    return this.usePool;
  }
} 