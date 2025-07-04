// 共通型定義

export interface TestStep {
  id: number;
  action: string;
  locator?: string;
  value?: string;
  timestamp: string;
  description?: string;
}

export interface TestScenario {
  id: number;
  name: string;
  description?: string;
  tags?: string[];
  steps: TestStep[];
  createdAt: string;
  updatedAt: string;
  version?: string;
}

export interface Locator {
  id: number;
  name: string;
  selector: string;
  description?: string;
  type: 'css' | 'xpath' | 'id' | 'name';
  createdAt: string;
  updatedAt: string;
}

export interface TestResult {
  id: number;
  scenarioId: number;
  status: 'passed' | 'failed' | 'skipped';
  message: string;
  timestamp: string;
  duration: number;
  screenshot?: string;
  error?: string;
}

export interface Assertion {
  id: number;
  type: 'visible' | 'text' | 'value' | 'enabled' | 'checked' | 'count';
  locator: string;
  expected: string | number | boolean;
  actual?: string | number | boolean;
  timestamp: string;
}

export interface Snapshot {
  id: number;
  name: string;
  path: string;
  timestamp: string;
  description?: string;
}

export interface TestReport {
  id: number;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  details: TestResult[];
}

export interface UIAutomationElement {
  id: string;
  name: string;
  className: string;
  controlType: string;
  isEnabled: boolean;
  isVisible: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  properties: Record<string, any>;
}

export interface RecordingEvent {
  type: 'click' | 'type' | 'hover' | 'keypress' | 'scroll';
  timestamp: number;
  element?: UIAutomationElement;
  value?: string;
  coordinates?: { x: number; y: number };
  key?: string;
}

export interface AppSettings {
  defaultWaitTime: number;
  screenshotPath: string;
  reportPath: string;
  databasePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  autoSave: boolean;
  theme: 'light' | 'dark';
}

export interface DatabaseConfig {
  path: string;
  version: string;
  tables: string[];
}

// Electron IPC通信の型定義
export interface IpcChannels {
  'start-recording': () => Promise<RecordingEvent[]>;
  'stop-recording': () => Promise<RecordingEvent[]>;
  'run-test': (scenario: TestScenario) => Promise<TestResult[]>;
  'pause-test': () => void;
  'take-snapshot': () => Promise<Snapshot>;
  'save-locator': (locator: Locator) => Promise<void>;
  'save-settings': (settings: AppSettings) => Promise<void>;
  'generate-report': () => Promise<TestReport>;
}

// エラータイプ
export class AutomationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AutomationError';
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
} 