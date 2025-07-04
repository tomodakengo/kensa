import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { UIAutomationClient } from './automation/UIAutomationClient';
import { TestRecorder } from './automation/TestRecorder';
import { TestRunner } from './automation/TestRunner';
import { DatabaseManager } from './database/DatabaseManager';
import { ScenarioManager } from './managers/ScenarioManager';
import { LocatorManager } from './managers/LocatorManager';
import { TestReporter } from './automation/TestReporter';
import { AssertionEngine } from './automation/AssertionEngine';
import { errorHandler } from './utils/ErrorHandler';
import { configManager } from './utils/ConfigManager';
import type {
  TestScenario,
  Locator,
  AppSettings,
  TestReport,
  RecordingEvent,
  TestResult
} from './types';

class MainProcess {
  private mainWindow: BrowserWindow | null = null;
  private uiClient!: UIAutomationClient;
  private testRecorder!: TestRecorder;
  private testRunner!: TestRunner;
  private databaseManager!: DatabaseManager;
  private scenarioManager!: ScenarioManager;
  private locatorManager!: LocatorManager;
  private testReporter!: TestReporter;
  private settings!: AppSettings;

  constructor() {
    this.setupEventHandlers();
  }

  private async initializeComponents(): Promise<void> {
    try {
      await errorHandler.info('Initializing application components');

      // 設定の初期化
      this.settings = this.loadSettings();

      // 設定の検証
      const configValidation = await configManager.validateCurrentConfig();
      if (!configValidation.valid) {
        await errorHandler.warn('Configuration validation failed', { errors: configValidation.errors });
      }

      // データベースの初期化
      this.databaseManager = new DatabaseManager(this.settings.databasePath);

      // マネージャーの初期化
      this.scenarioManager = new ScenarioManager(this.databaseManager);
      this.locatorManager = new LocatorManager('./locators');

      // 自動化コンポーネントの初期化
      this.uiClient = new UIAutomationClient();
      this.testRecorder = new TestRecorder(this.uiClient);
      this.testRunner = new TestRunner(this.uiClient);
      this.testReporter = new TestReporter(this.settings.reportPath);

      await errorHandler.info('Application components initialized successfully');
    } catch (error) {
      await errorHandler.error('Failed to initialize application components', { error });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // アプリケーションイベント
    app.whenReady().then(async () => {
      try {
        await this.initializeComponents();
        this.createWindow();
        this.setupIpcHandlers();
        await errorHandler.info('Application started successfully');
      } catch (error) {
        await errorHandler.error('Failed to start application', { error });
        app.quit();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('before-quit', async () => {
      await this.cleanup();
    });
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../assets/icon.ico'),
      titleBarStyle: 'default',
      show: false
    });

    // 開発モードの場合はDevToolsを開く
    if (process.argv.includes('--dev')) {
      this.mainWindow.webContents.openDevTools();
    }

    // メインウィンドウの読み込み
    this.mainWindow.loadFile(path.join(__dirname, '../index.html'));

    // ウィンドウが準備完了したら表示
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // ウィンドウが閉じられたときの処理
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupIpcHandlers(): void {
    // 記録関連
    ipcMain.handle('start-recording', async () => {
      try {
        await this.testRecorder.startRecording();
        return { success: true };
      } catch (error) {
        console.error('Recording start failed:', error);
        throw error;
      }
    });

    ipcMain.handle('stop-recording', async () => {
      try {
        const events = await this.testRecorder.stopRecording();
        return events;
      } catch (error) {
        console.error('Recording stop failed:', error);
        throw error;
      }
    });

    // テスト実行
    ipcMain.handle('run-test', async (_, scenario: TestScenario) => {
      try {
        const results = await this.testRunner.runTest(scenario);
        return results;
      } catch (error) {
        console.error('Test execution failed:', error);
        throw error;
      }
    });

    ipcMain.handle('pause-test', () => {
      try {
        this.testRunner.stop();
        return { success: true };
      } catch (error) {
        console.error('Test pause failed:', error);
        throw error;
      }
    });

    // スナップショット
    ipcMain.handle('take-snapshot', async () => {
      try {
        const screenshot = await this.uiClient.screenshot({ handle: 0 });
        return { path: screenshot };
      } catch (error) {
        console.error('Snapshot failed:', error);
        throw error;
      }
    });

    // ロケーター管理
    ipcMain.handle('save-locator', async (_, locator: Locator) => {
      try {
        // Ensure required properties are set
        if (!locator.pageName || !locator.locatorName) {
          throw new Error('Locator must have pageName and locatorName properties');
        }
        await this.locatorManager.saveLocator(locator);
        return { success: true };
      } catch (error) {
        console.error('Locator save failed:', error);
        throw error;
      }
    });

    ipcMain.handle('get-locators', async () => {
      try {
        return await this.locatorManager.getAllLocators();
      } catch (error) {
        console.error('Get locators failed:', error);
        throw error;
      }
    });

    // シナリオ管理
    ipcMain.handle('save-scenario', async (_, scenario: TestScenario) => {
      try {
        // Convert TestScenario to Scenario format for ScenarioManager
        const scenarioData = {
          name: scenario.name,
          description: scenario.description,
          folder_id: undefined,
          test_data: scenario
        };
        await this.scenarioManager.saveScenario(scenarioData);
        return { success: true };
      } catch (error) {
        console.error('Scenario save failed:', error);
        throw error;
      }
    });

    ipcMain.handle('get-scenarios', async () => {
      try {
        return await this.scenarioManager.getScenarios();
      } catch (error) {
        console.error('Get scenarios failed:', error);
        throw error;
      }
    });

    // レポート生成
    ipcMain.handle('generate-report', async () => {
      try {
        // Create empty test results for demonstration
        const testResults: TestResult[] = [];
        const report = await this.testReporter.generateReport(testResults);
        return report;
      } catch (error) {
        console.error('Report generation failed:', error);
        throw error;
      }
    });

    // 設定管理
    ipcMain.handle('save-settings', async (_, settings: AppSettings) => {
      try {
        await this.saveSettings(settings);
        this.settings = settings;
        return { success: true };
      } catch (error) {
        console.error('Settings save failed:', error);
        throw error;
      }
    });

    ipcMain.handle('get-settings', async () => {
      return this.settings;
    });

    // ファイル操作
    ipcMain.handle('open-file-dialog', async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow!, {
          properties: ['openFile'],
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          if (await fs.pathExists(filePath)) {
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
          }
        }
        return null;
      } catch (error) {
        console.error('File dialog failed:', error);
        throw error;
      }
    });

    ipcMain.handle('save-file-dialog', async (_, data: any) => {
      try {
        const result = await dialog.showSaveDialog(this.mainWindow!, {
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          await fs.writeFile(result.filePath, JSON.stringify(data, null, 2));
          return { success: true, path: result.filePath };
        }
        return { success: false };
      } catch (error) {
        console.error('Save dialog failed:', error);
        throw error;
      }
    });
  }

  private loadSettings(): AppSettings {
    const defaultSettings: AppSettings = {
      defaultWaitTime: 1000,
      screenshotPath: path.join(__dirname, '../screenshots'),
      reportPath: path.join(__dirname, '../reports'),
      databasePath: path.join(__dirname, '../test-data.db'),
      logLevel: 'info',
      autoSave: true,
      theme: 'light'
    };

    try {
      const settingsPath = path.join(__dirname, '../settings.json');
      if (fs.existsSync(settingsPath)) {
        const savedSettings = fs.readJsonSync(settingsPath);
        return { ...defaultSettings, ...savedSettings };
      }
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
    }

    return defaultSettings;
  }

  private async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const settingsPath = path.join(__dirname, '../settings.json');
      await fs.writeJson(settingsPath, settings, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // 記録を停止
      if (this.testRecorder && this.testRecorder.isRecording()) {
        await this.testRecorder.stopRecording();
      }

      // テスト実行を停止
      if (this.testRunner && this.testRunner.isRunning()) {
        this.testRunner.stop();
      }

      // データベース接続を閉じる
      if (this.databaseManager) {
        await this.databaseManager.close();
      }

      console.log('Cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

// アプリケーションの開始
new MainProcess(); 