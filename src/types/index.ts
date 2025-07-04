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
  pageName?: string;
  locatorName?: string;
}

export interface TestResult {
  id: number;
  scenarioId: number;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  message: string;
  timestamp: string;
  duration: number;
  screenshot?: string;
  error?: string;
  stack?: string;
}

export interface Assertion {
  id: number;
  type: 'visible' | 'text' | 'value' | 'enabled' | 'checked' | 'count' | 'contains-text' | 'attribute' | 'focused' | 'matches-snapshot';
  locator: string;
  expected: string | number | boolean | { name: string; value: string };
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

export interface RecordedAction {
  type: string;
  timestamp: number;
  element?: UIAutomationElement;
  selector?: string;
  value?: string;
  coordinates?: { x: number; y: number };
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  key?: string;
}

export interface AssertionResult {
  type: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  message: string;
  timestamp: number;
  error?: string;
  stack?: string;
}

export interface TestExecutionResult {
  testName: string;
  status: 'passed' | 'failed' | 'error';
  startTime: number;
  endTime: number;
  duration: number;
  steps: StepResult[];
  error?: string;
  stack?: string;
}

export interface StepResult {
  step: number;
  action: string;
  status: 'passed' | 'failed' | 'running' | 'skipped';
  startTime: number;
  endTime?: number;
  duration?: number;
  description?: string;
  error?: string;
  stack?: string;
  screenshot?: string;
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

// Database types
export interface Scenario {
  id: number;
  name: string;
  description?: string;
  folder_id?: number;
  created_at: string;
  updated_at: string;
  test_data: TestScenario;
}

export interface Folder {
  id: number;
  name: string;
  parent_id?: number;
}

// Configuration types
export interface UIConfig {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  fontSize: number;
  showTooltips: boolean;
  autoSave: boolean;
}

export interface TestingConfig {
  defaultTimeout: number;
  retryAttempts: number;
  screenshotOnFailure: boolean;
  videoRecording: boolean;
  parallelExecution: boolean;
  maxParallelTests: number;
}

export interface ReportingConfig {
  outputFormat: 'html' | 'json' | 'xml';
  includeScreenshots: boolean;
  detailedLogs: boolean;
  customReportPath?: string;
}

export interface DatabaseConfig {
  path: string;
  version: string;
  tables: string[];
  backupEnabled: boolean;
  backupInterval: number;
}

export interface AutomationConfig {
  implicitWait: number;
  pageLoadTimeout: number;
  elementHighlight: boolean;
  slowMotion: number;
}

export interface NetworkConfig {
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  userAgent?: string;
  extraHeaders?: Record<string, string>;
}

export type AppConfig = UIConfig & TestingConfig & ReportingConfig & DatabaseConfig & AutomationConfig & NetworkConfig;

// Element handling types
export interface ElementCriteria {
  automationId?: string;
  name?: string;
  className?: string;
}

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
  delay?: number;
}

export interface TypeOptions {
  delay?: number;
  clearFirst?: boolean;
}

export interface ElementHandle {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  properties: Record<string, any>;
}

export interface MousePosition {
  x: number;
  y: number;
}

// Assertion types
export type AssertionHandler = (element: any, expected: any) => Promise<AssertionResult>;

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