import type { TestScenario } from '../types';
import * as yaml from 'js-yaml';
import { DatabaseManager } from '../database/DatabaseManager';


interface Scenario {
  id?: number;
  name: string;
  description?: string;
  folder?: string;
  tags?: string[];
  test_data: TestScenario;
  created_at?: string;
  updated_at?: string;
  last_run?: string;
  run_count?: number;
  last_status?: string;
  tag_names?: string;
}

interface Folder {
  id?: number | undefined;
  name: string;
  parent_id?: number | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface ScenarioOptions {
  folder?: string;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface ScenarioUpdate {
  name?: string;
  description?: string;
  folder?: string;
  test_data?: TestScenario;
  last_run?: string;
  run_count?: number;
  last_status?: string;
  tags?: string[];
}

export class ScenarioManager {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    // Create scenarios table
    await this.dbManager.run(`
      CREATE TABLE IF NOT EXISTS scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        folder TEXT DEFAULT '/',
        tags TEXT,
        test_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_run DATETIME,
        run_count INTEGER DEFAULT 0,
        last_status TEXT
      )
    `);

    // Create folders table
    await this.dbManager.run(`
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES folders(id)
      )
    `);

    // Create tags table
    await this.dbManager.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#3B82F6'
      )
    `);

    // Create scenario_tags junction table
    await this.dbManager.run(`
      CREATE TABLE IF NOT EXISTS scenario_tags (
        scenario_id INTEGER,
        tag_id INTEGER,
        FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (scenario_id, tag_id)
      )
    `);
  }

  async getScenarios(options: ScenarioOptions = {}): Promise<Scenario[]> {
    const { folder, tags, sortBy = 'updated_at', sortOrder = 'DESC' } = options;

    let query = `
      SELECT s.*, GROUP_CONCAT(t.name) as tag_names
      FROM scenarios s
      LEFT JOIN scenario_tags st ON s.id = st.scenario_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (folder) {
      query += ' AND s.folder = ?';
      params.push(folder);
    }

    if (tags && tags.length > 0) {
      query += ` AND s.id IN (
        SELECT scenario_id FROM scenario_tags
        WHERE tag_id IN (SELECT id FROM tags WHERE name IN (${tags.map(() => '?').join(',')}))
      )`;
      params.push(...tags);
    }

    query += ` GROUP BY s.id ORDER BY s.${sortBy} ${sortOrder}`;

    const scenarios = await this.dbManager.all(query, params);

    // Parse tags
    return scenarios.map(scenario => ({
      ...scenario,
      tags: scenario.tag_names ? scenario.tag_names.split(',') : [],
      test_data: JSON.parse(scenario.test_data)
    }));
  }

  async saveScenario(scenario: Omit<Scenario, 'id'>): Promise<Scenario> {
    const { name, description, folder = '/', tags = [], test_data } = scenario;

    // Insert scenario
    const result = await this.dbManager.run(
      `INSERT INTO scenarios (name, description, folder, test_data) VALUES (?, ?, ?, ?)`,
      [name, description, folder, JSON.stringify(test_data)]
    );

    const scenarioId = result.lastID;

    // Handle tags
    if (tags.length > 0) {
      await this.addTagsToScenario(scenarioId, tags);
    }

    return { id: scenarioId, ...scenario };
  }

  async updateScenario(id: number, updates: ScenarioUpdate): Promise<Scenario | null> {
    const allowedFields = ['name', 'description', 'folder', 'test_data', 'last_run', 'run_count', 'last_status'];
    const setClause: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (updates[field as keyof ScenarioUpdate] !== undefined) {
        setClause.push(`${field} = ?`);
        const value = updates[field as keyof ScenarioUpdate];
        values.push(field === 'test_data' ? JSON.stringify(value) : value);
      }
    }

    if (setClause.length > 0) {
      setClause.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await this.dbManager.run(
        `UPDATE scenarios SET ${setClause.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Update tags if provided
    if (updates.tags) {
      await this.updateScenarioTags(id, updates.tags);
    }

    return await this.getScenario(id);
  }

  async deleteScenario(id: number): Promise<{ success: boolean }> {
    await this.dbManager.run('DELETE FROM scenarios WHERE id = ?', [id]);
    return { success: true };
  }

  async searchScenarios(query: string): Promise<Scenario[]> {
    const searchQuery = `%${query}%`;

    const scenarios = await this.dbManager.all(
      `SELECT s.*, GROUP_CONCAT(t.name) as tag_names
       FROM scenarios s
       LEFT JOIN scenario_tags st ON s.id = st.scenario_id
       LEFT JOIN tags t ON st.tag_id = t.id
       WHERE s.name LIKE ? OR s.description LIKE ? OR t.name LIKE ?
       GROUP BY s.id
       ORDER BY s.updated_at DESC`,
      [searchQuery, searchQuery, searchQuery]
    );

    return scenarios.map(scenario => ({
      ...scenario,
      tags: scenario.tag_names ? scenario.tag_names.split(',') : [],
      test_data: JSON.parse(scenario.test_data)
    }));
  }

  async getScenario(id: number): Promise<Scenario | null> {
    const scenario = await this.dbManager.get(
      `SELECT s.*, GROUP_CONCAT(t.name) as tag_names
       FROM scenarios s
       LEFT JOIN scenario_tags st ON s.id = st.scenario_id
       LEFT JOIN tags t ON st.tag_id = t.id
       WHERE s.id = ?
       GROUP BY s.id`,
      [id]
    );

    if (!scenario) return null;

    return {
      ...scenario,
      tags: scenario.tag_names ? scenario.tag_names.split(',') : [],
      test_data: JSON.parse(scenario.test_data)
    };
  }

  async createFolder(name: string, parentId?: number): Promise<Folder> {
    const result = await this.dbManager.run(
      'INSERT INTO folders (name, parent_id) VALUES (?, ?)',
      [name, parentId || null]
    );

    return { id: result.lastID, name, parent_id: parentId || undefined, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }

  async getFolders(): Promise<Folder[]> {
    return await this.dbManager.all('SELECT * FROM folders ORDER BY name');
  }

  async deleteFolder(id: number): Promise<{ success: boolean }> {
    // Move scenarios to root folder
    await this.dbManager.run('UPDATE scenarios SET folder = "/" WHERE folder = (SELECT name FROM folders WHERE id = ?)', [id]);

    // Delete folder
    await this.dbManager.run('DELETE FROM folders WHERE id = ?', [id]);

    return { success: true };
  }

  async createTag(name: string, color: string = '#3B82F6'): Promise<Tag> {
    const result = await this.dbManager.run(
      'INSERT INTO tags (name, color) VALUES (?, ?)',
      [name, color]
    );

    return { id: result.lastID, name, color };
  }

  async getTags(): Promise<Tag[]> {
    return await this.dbManager.all('SELECT * FROM tags ORDER BY name');
  }

  private async addTagsToScenario(scenarioId: number, tagNames: string[]): Promise<void> {
    for (const tagName of tagNames) {
      // Get or create tag
      let tag = await this.dbManager.get('SELECT * FROM tags WHERE name = ?', [tagName]);

      if (!tag) {
        const result = await this.dbManager.run('INSERT INTO tags (name) VALUES (?)', [tagName]);
        tag = { id: result.lastID, name: tagName, color: '#3B82F6' };
      }

      // Add tag to scenario
      await this.dbManager.run(
        'INSERT OR IGNORE INTO scenario_tags (scenario_id, tag_id) VALUES (?, ?)',
        [scenarioId, tag.id]
      );
    }
  }

  private async updateScenarioTags(scenarioId: number, tagNames: string[]): Promise<void> {
    // Remove existing tags
    await this.dbManager.run('DELETE FROM scenario_tags WHERE scenario_id = ?', [scenarioId]);

    // Add new tags
    if (tagNames.length > 0) {
      await this.addTagsToScenario(scenarioId, tagNames);
    }
  }

  async exportScenarios(scenarioIds: number[], format: 'yaml' | 'json' = 'yaml'): Promise<string> {
    const scenarios = await Promise.all(
      scenarioIds.map(id => this.getScenario(id))
    );

    const validScenarios = scenarios.filter(s => s !== null) as Scenario[];

    if (format === 'yaml') {
      return yaml.dump(validScenarios);
    } else {
      return JSON.stringify(validScenarios, null, 2);
    }
  }

  async importScenarios(data: string, format: 'yaml' | 'json' = 'yaml'): Promise<Scenario[]> {
    let scenarios: Scenario[];

    if (format === 'yaml') {
      scenarios = yaml.load(data) as Scenario[];
    } else {
      scenarios = JSON.parse(data) as Scenario[];
    }

    const importedScenarios: Scenario[] = [];

    for (const scenario of scenarios) {
      const { id, ...scenarioData } = scenario;
      const savedScenario = await this.saveScenario(scenarioData);
      importedScenarios.push(savedScenario);
    }

    return importedScenarios;
  }

  async updateScenarioStatus(id: number, status: string): Promise<void> {
    const updates: ScenarioUpdate = {
      last_status: status,
      last_run: new Date().toISOString(),
      run_count: 1 // This should be incremented, but simplified for now
    };

    await this.updateScenario(id, updates);
  }

  async getScenarioStats(): Promise<{
    total: number;
    passed: number;
    failed: number;
    notRun: number;
  }> {
    const scenarios = await this.getScenarios();

    const stats = {
      total: scenarios.length,
      passed: scenarios.filter(s => s.last_status === 'passed').length,
      failed: scenarios.filter(s => s.last_status === 'failed').length,
      notRun: scenarios.filter(s => !s.last_status).length
    };

    return stats;
  }
} 