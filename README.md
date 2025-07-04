# Windows UI Automation Test Tool "Kensa"

A no-code test automation tool for Windows desktop applications, inspired by Playwright's API design. This tool provides recording, playback, and assertion capabilities for Windows applications using UI Automation API.

## Features

- 🎯 **No-code test recording** - Record user interactions without writing code
- 🔄 **Playwright-like API** - Familiar methods like click, fill, hover, etc.
- 📁 **Test scenario management** - Organize tests with folders, tags, and search
- 🔍 **Shared locator store** - Manage UI element locators in XML format
- 📊 **Test reporting** - Detailed test execution reports with screenshots
- ✅ **Assertions** - Built-in assertion engine for test validation
- 🚀 **CI/CD ready** - GitHub Actions workflow included

## Prerequisites

- Windows 10/11
- Node.js 18 or higher
- .NET Framework 4.7.2 or higher (for UI Automation)
- Visual Studio Build Tools (for native dependencies)

## Installation

### From Release

1. Download the latest installer from [Releases](https://github.com/your-repo/releases)
2. Run `win-ui-automation-setup.exe`
3. Follow the installation wizard

### From Source

```bash
# Clone the repository
git clone https://github.com/your-repo/win-ui-automation-tool.git
cd win-ui-automation-tool

# Install dependencies
npm install

# Build native modules
npm run rebuild

# Start the application
npm start
```

## Development Setup

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install development dependencies
npm install --save-dev electron electron-builder

# Install Windows-specific dependencies
npm install edge-js robotjs iohook

# Install utility libraries
npm install js-yaml xml2js sqlite3 lodash
```

### 2. Project Structure

```
win-ui-automation-tool/
├── main.js                 # Electron main process
├── index.html             # Main UI
├── preload.js            # Preload script
├── automation/           # Core automation modules
│   ├── UIAutomationClient.js
│   ├── TestRecorder.js
│   ├── TestRunner.js
│   └── AssertionEngine.js
├── managers/             # Feature managers
│   ├── ScenarioManager.js
│   └── LocatorManager.js
├── database/             # Database module
│   └── DatabaseManager.js
├── locators/            # XML locator files
├── test-data.db         # SQLite database
└── package.json
```

### 3. Create Supporting Files

Create `package.json`:
```json
{
  "name": "win-ui-automation-tool",
  "version": "1.0.0",
  "description": "Windows UI Automation Test Tool",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --dev",
    "build": "electron-builder build",
    "dist": "electron-builder",
    "rebuild": "electron-rebuild",
    "test": "jest",
    "lint": "eslint . --ext .js,.jsx"
  },
  "build": {
    "appId": "com.yourcompany.winuiautomation",
    "productName": "Windows UI Automation Tool",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": ["nsis", "msi"],
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  },
  "keywords": ["automation", "testing", "windows", "ui-automation"],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "electron-rebuild": "^3.2.9",
    "eslint": "^8.54.0",
    "jest": "^29.7.0"
  },
  "dependencies": {
    "edge-js": "^19.3.0",
    "robotjs": "^0.6.0",
    "iohook": "^0.9.3",
    "js-yaml": "^4.1.0",
    "xml2js": "^0.6.2",
    "sqlite3": "^5.1.6",
    "lodash": "^4.17.21"
  }
}