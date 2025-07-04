const path = require('path');
const fs = require('fs').promises;

class ScenarioManager {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.initializeDatabase();
  }

  async initializeDatabase() {
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

  async getScenarios(options = {}) {
    const { folder, tags, sortBy = 'updated_at', sortOrder = 'DESC' } = options;
    
    let query = `
      SELECT s.*, GROUP_CONCAT(t.name) as tag_names
      FROM scenarios s
      LEFT JOIN scenario_tags st ON s.id = st.scenario_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE 1=1
    `;
    const params = [];

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

  async saveScenario(scenario) {
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

  async updateScenario(id, updates) {
    const allowedFields = ['name', 'description', 'folder', 'test_data', 'last_run', 'run_count', 'last_status'];
    const setClause = [];
    const values = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = ?`);
        values.push(field === 'test_data' ? JSON.stringify(updates[field]) : updates[field]);
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

  async deleteScenario(id) {
    await this.dbManager.run('DELETE FROM scenarios WHERE id = ?', [id]);
    return { success: true };
  }

  async searchScenarios(query) {
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

  async getScenario(id) {
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

  async createFolder(name, parentId = null) {
    const result = await this.dbManager.run(
      'INSERT INTO folders (name, parent_id) VALUES (?, ?)',
      [name, parentId]
    );
    
    return { id: result.lastID, name, parent_id: parentId };
  }

  async getFolders() {
    return await this.dbManager.all(
      'SELECT * FROM folders ORDER BY parent_id, name'
    );
  }

  async createTag(name, color = '#3B82F6') {
    const result = await this.dbManager.run(
      'INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)',
      [name, color]
    );
    
    return { id: result.lastID, name, color };
  }

  async getTags() {
    return await this.dbManager.all('SELECT * FROM tags ORDER BY name');
  }

  async addTagsToScenario(scenarioId, tagNames) {
    for (const tagName of tagNames) {
      // Create tag if it doesn't exist
      await this.createTag(tagName);
      
      // Get tag ID
      const tag = await this.dbManager.get(
        'SELECT id FROM tags WHERE name = ?',
        [tagName]
      );
      
      // Add to junction table
      if (tag) {
        await this.dbManager.run(
          'INSERT OR IGNORE INTO scenario_tags (scenario_id, tag_id) VALUES (?, ?)',
          [scenarioId, tag.id]
        );
      }
    }
  }

  async updateScenarioTags(scenarioId, tagNames) {
    // Remove existing tags
    await this.dbManager.run(
      'DELETE FROM scenario_tags WHERE scenario_id = ?',
      [scenarioId]
    );
    
    // Add new tags
    await this.addTagsToScenario(scenarioId, tagNames);
  }

  async exportScenarios(scenarioIds, format = 'yaml') {
    const scenarios = await Promise.all(
      scenarioIds.map(id => this.getScenario(id))
    );
    
    if (format === 'yaml') {
      const yaml = require('js-yaml');
      return yaml.dump({ scenarios });
    } else if (format === 'json') {
      return JSON.stringify({ scenarios }, null, 2);
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  async importScenarios(data, format = 'yaml') {
    let scenarios;
    
    if (format === 'yaml') {
      const yaml = require('js-yaml');
      scenarios = yaml.load(data).scenarios;
    } else if (format === 'json') {
      scenarios = JSON.parse(data).scenarios;
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }
    
    const results = [];
    for (const scenario of scenarios) {
      const result = await this.saveScenario(scenario);
      results.push(result);
    }
    
    return results;
  }
}

module.exports = { ScenarioManager };