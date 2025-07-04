import { contextBridge, ipcRenderer } from 'electron';
import type { 
  TestScenario, 
  TestResult, 
  Locator, 
  AppSettings, 
  TestReport,
  RecordingEvent,
  Snapshot 
} from './types';

// APIの型定義
interface ElectronAPI {
  // 記録関連
  startRecording: () => Promise<{ success: boolean }>;
  stopRecording: () => Promise<RecordingEvent[]>;
  
  // テスト実行
  runTest: (scenario: TestScenario) => Promise<TestResult[]>;
  pauseTest: () => Promise<{ success: boolean }>;
  
  // スナップショット
  takeSnapshot: () => Promise<Snapshot>;
  
  // ロケーター管理
  saveLocator: (locator: Locator) => Promise<{ success: boolean }>;
  getLocators: () => Promise<Locator[]>;
  
  // シナリオ管理
  saveScenario: (scenario: TestScenario) => Promise<{ success: boolean }>;
  getScenarios: () => Promise<TestScenario[]>;
  
  // レポート生成
  generateReport: () => Promise<TestReport>;
  
  // 設定管理
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;
  getSettings: () => Promise<AppSettings>;
  
  // ファイル操作
  openFileDialog: () => Promise<any>;
  saveFileDialog: (data: any) => Promise<{ success: boolean; path?: string }>;
}

// レンダラープロセスに公開するAPI
const electronAPI: ElectronAPI = {
  // 記録関連
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  
  // テスト実行
  runTest: (scenario: TestScenario) => ipcRenderer.invoke('run-test', scenario),
  pauseTest: () => ipcRenderer.invoke('pause-test'),
  
  // スナップショット
  takeSnapshot: () => ipcRenderer.invoke('take-snapshot'),
  
  // ロケーター管理
  saveLocator: (locator: Locator) => ipcRenderer.invoke('save-locator', locator),
  getLocators: () => ipcRenderer.invoke('get-locators'),
  
  // シナリオ管理
  saveScenario: (scenario: TestScenario) => ipcRenderer.invoke('save-scenario', scenario),
  getScenarios: () => ipcRenderer.invoke('get-scenarios'),
  
  // レポート生成
  generateReport: () => ipcRenderer.invoke('generate-report'),
  
  // 設定管理
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  // ファイル操作
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (data: any) => ipcRenderer.invoke('save-file-dialog', data)
};

// コンテキストブリッジを使用してAPIを公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 型定義の拡張
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 