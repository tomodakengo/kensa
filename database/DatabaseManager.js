const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.initializeDatabase();
  }

  initializeDatabase() {
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        this.createTables();
      }
    });
  }

  createTables() {
    // Tests table (legacy - for backward compatibility)
    this.run(`
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
    this.run(`
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
    this.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Promisified database methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Test management methods
  async saveTest(testData) {
    const { name, description, test_data } = testData;
    const result = await this.run(
      'INSERT INTO tests (name, description, test_data) VALUES (?, ?, ?)',
      [name, description, JSON.stringify(test_data)]
    );
    return { id: result.lastID, ...testData };
  }

  async getAllTests() {
    const tests = await this.all('SELECT * FROM tests ORDER BY updated_at DESC');
    return tests.map(test => ({
      ...test,
      test_data: JSON.parse(test.test_data)
    }));
  }

  async getTest(id) {
    const test = await this.get('SELECT * FROM tests WHERE id = ?', [id]);
    if (test) {
      test.test_data = JSON.parse(test.test_data);
    }
    return test;
  }

  async updateTest(id, updates) {
    const { name, description, test_data } = updates;
    await this.run(
      'UPDATE tests SET name = ?, description = ?, test_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, JSON.stringify(test_data), id]
    );
    return await this.getTest(id);
  }

  async deleteTest(id) {
    await this.run('DELETE FROM tests WHERE id = ?', [id]);
    return { success: true };
  }

  // Test results methods
  async saveTestResult(result) {
    const { test_id, scenario_id, status, start_time, end_time, duration, error_message, report } = result;
    const resultData = await this.run(
      `INSERT INTO test_results (test_id, scenario_id, status, start_time, end_time, duration, error_message, report) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [test_id, scenario_id, status, start_time, end_time, duration, error_message, JSON.stringify(report)]
    );
    return { id: resultData.lastID, ...result };
  }

  async getTestResults(testId = null, limit = 50) {
    let query = 'SELECT * FROM test_results';
    const params = [];
    
    if (testId) {
      query += ' WHERE test_id = ? OR scenario_id = ?';
      params.push(testId, testId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const results = await this.all(query, params);
    return results.map(result => ({
      ...result,
      report: result.report ? JSON.parse(result.report) : null
    }));
  }

  // Settings methods
  async getSetting(key) {
    const setting = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
    return setting ? setting.value : null;
  }

  async setSetting(key, value) {
    await this.run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    );
    return { key, value };
  }

  async getAllSettings() {
    const settings = await this.all('SELECT * FROM settings');
    const result = {};
    settings.forEach(setting => {
      result[setting.key] = setting.value;
    });
    return result;
  }

  // Utility methods
  async vacuum() {
    await this.run('VACUUM');
  }

  async getStats() {
    const totalTests = await this.get('SELECT COUNT(*) as count FROM tests');
    const totalScenarios = await this.get('SELECT COUNT(*) as count FROM scenarios');
    const totalResults = await this.get('SELECT COUNT(*) as count FROM test_results');
    const recentResults = await this.all(
      `SELECT status, COUNT(*) as count 
       FROM test_results 
       WHERE created_at > datetime('now', '-7 days')
       GROUP BY status`
    );
    
    return {
      totalTests: totalTests.count,
      totalScenarios: totalScenarios.count,
      totalResults: totalResults.count,
      recentResults: recentResults
    };
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = { DatabaseManager };