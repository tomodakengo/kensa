import * as fs from 'fs-extra';
import * as path from 'path';
import { errorHandler } from './ErrorHandler';

export interface AppConfig {
  // UI設定
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    fontSize: number;
    showTooltips: boolean;
    autoSave: boolean;
  };

  // テスト実行設定
  test: {
    defaultTimeout: number;
    retryAttempts: number;
    screenshotOnFailure: boolean;
    videoRecording: boolean;
    parallelExecution: boolean;
    maxParallelTests: number;
  };

  // ログ設定
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    maxFileSize: number;
    retentionDays: number;
    enableConsole: boolean;
  };

  // データベース設定
  database: {
    path: string;
    backupEnabled: boolean;
    backupInterval: number;
    maxBackups: number;
  };

  // 自動化設定
  automation: {
    defaultWaitTimeout: number;
    elementTimeout: number;
    screenshotQuality: number;
    enableMouseTracking: boolean;
    enableKeyboardTracking: boolean;
  };

  // レポート設定
  reporting: {
    autoGenerate: boolean;
    includeScreenshots: boolean;
    includeVideos: boolean;
    format: 'html' | 'json' | 'xml';
    outputPath: string;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  ui: {
    theme: 'auto',
    language: 'ja',
    fontSize: 14,
    showTooltips: true,
    autoSave: true
  },
  test: {
    defaultTimeout: 30000,
    retryAttempts: 3,
    screenshotOnFailure: true,
    videoRecording: false,
    parallelExecution: false,
    maxParallelTests: 2
  },
  logging: {
    level: 'info',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    retentionDays: 30,
    enableConsole: true
  },
  database: {
    path: path.join(process.cwd(), 'data', 'app.db'),
    backupEnabled: true,
    backupInterval: 24 * 60 * 60 * 1000, // 24時間
    maxBackups: 10
  },
  automation: {
    defaultWaitTimeout: 5000,
    elementTimeout: 10000,
    screenshotQuality: 80,
    enableMouseTracking: true,
    enableKeyboardTracking: true
  },
  reporting: {
    autoGenerate: true,
    includeScreenshots: true,
    includeVideos: false,
    format: 'html',
    outputPath: path.join(process.cwd(), 'reports')
  }
};

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;
  private configDir: string;
  private listeners: Map<string, Set<(config: AppConfig) => void>> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'app.json');
    this.configDir = path.dirname(this.configPath);
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      await fs.ensureDir(this.configDir);

      if (await fs.pathExists(this.configPath)) {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(configData);

        // デフォルト設定とマージ
        this.config = this.mergeConfigs(DEFAULT_CONFIG, loadedConfig);
        await errorHandler.info('Configuration loaded successfully', { path: this.configPath });
      } else {
        // デフォルト設定でファイルを作成
        await this.saveConfig();
        await errorHandler.info('Default configuration created', { path: this.configPath });
      }
    } catch (error) {
      await errorHandler.error('Failed to load configuration', { error, path: this.configPath });
      // エラーの場合はデフォルト設定を使用
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await fs.ensureDir(this.configDir);
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      await errorHandler.debug('Configuration saved', { path: this.configPath });
    } catch (error) {
      await errorHandler.error('Failed to save configuration', { error, path: this.configPath });
      throw error;
    }
  }

  private mergeConfigs(defaultConfig: AppConfig, userConfig: Partial<AppConfig>): AppConfig {
    const merged = { ...defaultConfig };

    for (const section in userConfig) {
      if (userConfig.hasOwnProperty(section)) {
        const userSection = userConfig[section as keyof AppConfig];
        const defaultSection = defaultConfig[section as keyof AppConfig];

        if (userSection && typeof userSection === 'object' && !Array.isArray(userSection)) {
          merged[section as keyof AppConfig] = {
            ...defaultSection,
            ...userSection
          } as any;
        } else if (userSection !== undefined) {
          merged[section as keyof AppConfig] = userSection as any;
        }
      }
    }

    return merged;
  }

  // 設定の取得
  getConfig(): AppConfig {
    return { ...this.config };
  }

  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return { ...this.config[section] };
  }

  getValue<K extends keyof AppConfig, S extends keyof AppConfig[K]>(
    section: K,
    key: S
  ): AppConfig[K][S] {
    return this.config[section][key];
  }

  // 設定の更新
  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    this.config = this.mergeConfigs(this.config, updates);

    await this.saveConfig();
    await this.notifyListeners();
  }

  async updateSection<K extends keyof AppConfig>(
    section: K,
    updates: Partial<AppConfig[K]>
  ): Promise<void> {
    this.config[section] = {
      ...this.config[section],
      ...updates
    };

    await this.saveConfig();
    await this.notifyListeners();
  }

  async setValue<K extends keyof AppConfig, S extends keyof AppConfig[K]>(
    section: K,
    key: S,
    value: AppConfig[K][S]
  ): Promise<void> {
    this.config[section][key] = value;

    await this.saveConfig();
    await this.notifyListeners();
  }

  // 設定のリセット
  async resetConfig(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };

    await this.saveConfig();
    await this.notifyListeners();
    await errorHandler.info('Configuration reset to defaults');
  }

  async resetSection<K extends keyof AppConfig>(section: K): Promise<void> {
    this.config[section] = { ...DEFAULT_CONFIG[section] };

    await this.saveConfig();
    await this.notifyListeners();
    await errorHandler.info(`Configuration section '${section}' reset to defaults`);
  }

  // 設定のエクスポート
  async exportConfig(format: 'json' | 'yaml' = 'json'): Promise<string> {
    try {
      if (format === 'yaml') {
        const yaml = require('js-yaml');
        return yaml.dump(this.config);
      } else {
        return JSON.stringify(this.config, null, 2);
      }
    } catch (error) {
      await errorHandler.error('Failed to export configuration', { error, format });
      throw error;
    }
  }

  // 設定のインポート
  async importConfig(data: string, format: 'json' | 'yaml' = 'json'): Promise<void> {
    try {
      let importedConfig: Partial<AppConfig>;

      if (format === 'yaml') {
        const yaml = require('js-yaml');
        importedConfig = yaml.load(data);
      } else {
        importedConfig = JSON.parse(data);
      }

      // 設定の検証
      this.validateConfig(importedConfig);

      this.config = this.mergeConfigs(DEFAULT_CONFIG, importedConfig);

      await this.saveConfig();
      await this.notifyListeners();
      await errorHandler.info('Configuration imported successfully', { format });
    } catch (error) {
      await errorHandler.error('Failed to import configuration', { error, format });
      throw error;
    }
  }

  // 設定の検証
  private validateConfig(config: Partial<AppConfig>): boolean {
    // 基本的な型チェック
    if (config.ui && typeof config.ui !== 'object') {
      throw new Error('Invalid UI configuration');
    }

    if (config.test && typeof config.test !== 'object') {
      throw new Error('Invalid test configuration');
    }

    if (config.logging && typeof config.logging !== 'object') {
      throw new Error('Invalid logging configuration');
    }

    // 値の範囲チェック
    if (config.test?.defaultTimeout && config.test.defaultTimeout < 1000) {
      throw new Error('Default timeout must be at least 1000ms');
    }

    if (config.test?.retryAttempts && config.test.retryAttempts < 0) {
      throw new Error('Retry attempts must be non-negative');
    }

    if (config.automation?.screenshotQuality &&
      (config.automation.screenshotQuality < 1 || config.automation.screenshotQuality > 100)) {
      throw new Error('Screenshot quality must be between 1 and 100');
    }

    return true;
  }

  // イベントリスナー
  onConfigChange(callback: (config: AppConfig) => void): () => void {
    const id = Math.random().toString(36).substr(2, 9);
    this.listeners.set(id, new Set([callback]));

    return () => {
      this.listeners.delete(id);
    };
  }

  private async notifyListeners(): Promise<void> {
    for (const listeners of this.listeners.values()) {
      for (const listener of listeners) {
        try {
          listener(this.config);
        } catch (error) {
          await errorHandler.error('Error in config change listener', { error });
        }
      }
    }
  }

  // 設定の検証
  async validateCurrentConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      this.validateConfig(this.config);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
    }

    // ファイルパスの検証
    if (this.config.database.path) {
      try {
        await fs.ensureDir(path.dirname(this.config.database.path));
      } catch (error) {
        errors.push(`Invalid database path: ${this.config.database.path}`);
      }
    }

    if (this.config.reporting.outputPath) {
      try {
        await fs.ensureDir(this.config.reporting.outputPath);
      } catch (error) {
        errors.push(`Invalid reporting output path: ${this.config.reporting.outputPath}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 設定のバックアップ
  async backupConfig(): Promise<string> {
    try {
      const backupPath = path.join(
        this.configDir,
        `config_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      );

      await fs.copyFile(this.configPath, backupPath);
      await errorHandler.info('Configuration backed up', { backupPath });

      return backupPath;
    } catch (error) {
      await errorHandler.error('Failed to backup configuration', { error });
      throw error;
    }
  }

  // 設定の復元
  async restoreConfig(backupPath: string): Promise<void> {
    try {
      if (!await fs.pathExists(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      const backupData = await fs.readFile(backupPath, 'utf-8');
      const backupConfig = JSON.parse(backupData);

      // Validate backup config structure
      if (this.validateConfig(backupConfig)) {
        this.config = backupConfig;
        await this.saveConfig();
        await errorHandler.info('Configuration restored from backup', { backupPath });
      }
    } catch (error) {
      await errorHandler.error('Failed to restore configuration', { error, backupPath });
      throw error;
    }
  }

  // Removed duplicate methods - using existing implementations above
}

// シングルトンインスタンス
export const configManager = new ConfigManager(); 