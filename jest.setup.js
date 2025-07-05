// Jest setup for all tests
global.console = {
  ...global.console,
  // 不要なログを非表示にする
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// テストタイムアウト設定
jest.setTimeout(30000);

// モック設定
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp'),
    getName: jest.fn(() => 'Test App'),
    getVersion: jest.fn(() => '1.0.0'),
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
    },
  })),
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn(),
  },
}));

// Node.jsモジュールのモック
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
  },
}));

// SQLite3のモック
jest.mock('sqlite3', () => ({
  Database: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn(),
  })),
}));

// PowerShellのモック
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(),
}));

// テスト環境でのグローバル変数設定
global.process = {
  ...global.process,
  platform: 'win32',
  env: {
    ...global.process.env,
    NODE_ENV: 'test',
  },
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  emit: jest.fn(),
  exit: jest.fn(),
  nextTick: jest.fn(callback => callback()),
};

// テスト後のクリーンアップ
afterEach(() => {
  jest.clearAllMocks();
});

// テストケースの前処理
beforeEach(() => {
  // 各テストケースの前に実行される処理
});

// テストスイートの前処理
beforeAll(() => {
  // 全テストの前に実行される処理
});

// テストスイートの後処理
afterAll(() => {
  // 全テストの後に実行される処理
}); 