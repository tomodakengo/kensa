const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { UIAutomationClient } = require('./automation/UIAutomationClient');
const { TestRecorder } = require('./automation/TestRecorder');
const { TestRunner } = require('./automation/TestRunner');
const { DatabaseManager } = require('./database/DatabaseManager');
const { ScenarioManager } = require('./managers/ScenarioManager');
const { LocatorManager } = require('./managers/LocatorManager');

let mainWindow;
let automationClient;
let testRecorder;
let testRunner;
let dbManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Initialize components
  automationClient = new UIAutomationClient();
  testRecorder = new TestRecorder(automationClient);
  testRunner = new TestRunner(automationClient);
  dbManager = new DatabaseManager('./test-data.db');
  scenarioManager = new ScenarioManager(dbManager);
  locatorManager = new LocatorManager('./locators');
}

app.whenReady().then(createWindow);

// IPC Handlers
ipcMain.handle('start-recording', async () => {
  return await testRecorder.startRecording();
});

ipcMain.handle('stop-recording', async () => {
  const actions = await testRecorder.stopRecording();
  return actions;
});

ipcMain.handle('run-test', async (event, testData) => {
  return await testRunner.runTest(testData);
});

ipcMain.handle('save-test', async (event, testData) => {
  return await dbManager.saveTest(testData);
});

ipcMain.handle('load-tests', async () => {
  return await dbManager.getAllTests();
});

ipcMain.handle('get-window-list', async () => {
  return await automationClient.getWindowList();
});

ipcMain.handle('inspect-element', async (event, point) => {
  return await automationClient.inspectElement(point);
});

// Scenario Management
ipcMain.handle('get-scenarios', async (event, options) => {
  return await scenarioManager.getScenarios(options);
});

ipcMain.handle('save-scenario', async (event, scenario) => {
  return await scenarioManager.saveScenario(scenario);
});

ipcMain.handle('update-scenario', async (event, id, updates) => {
  return await scenarioManager.updateScenario(id, updates);
});

ipcMain.handle('delete-scenario', async (event, id) => {
  return await scenarioManager.deleteScenario(id);
});

ipcMain.handle('search-scenarios', async (event, query) => {
  return await scenarioManager.searchScenarios(query);
});

// Locator Management
ipcMain.handle('get-locators', async () => {
  return await locatorManager.getAllLocators();
});

ipcMain.handle('save-locator', async (event, locator) => {
  return await locatorManager.saveLocator(locator);
});

ipcMain.handle('get-locator', async (event, name) => {
  return await locatorManager.getLocator(name);
});

ipcMain.handle('delete-locator', async (event, name) => {
  return await locatorManager.deleteLocator(name);
});

ipcMain.handle('export-locators', async (event, format) => {
  return await locatorManager.exportLocators(format);
});