// Jest setup file
global.console = {
  ...console,
  // Suppress console.log during tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock edge-js for testing
jest.mock('edge-js', () => ({
  func: jest.fn(() => jest.fn())
}));

// Mock iohook for testing
jest.mock('iohook', () => ({
  on: jest.fn(),
  start: jest.fn(),
  stop: jest.fn()
}));

// Mock sqlite3 for testing
jest.mock('sqlite3', () => ({
  Database: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn()
  }))
})); 