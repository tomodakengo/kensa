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
├── src/                  # TypeScript source files
│   ├── main.ts          # Electron main process
│   ├── preload.ts       # Preload script
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts
│   ├── automation/      # Core automation modules
│   │   ├── UIAutomationClient.ts
│   │   ├── TestRecorder.ts
│   │   ├── TestRunner.ts
│   │   └── AssertionEngine.ts
│   ├── managers/        # Feature managers
│   │   ├── ScenarioManager.ts
│   │   └── LocatorManager.ts
│   ├── database/        # Database module
│   │   └── DatabaseManager.ts
│   └── utils/           # Utility functions
├── dist/                # Compiled JavaScript files
├── index.html           # Main UI
├── styles.css           # UI styles
├── renderer.js          # Frontend JavaScript
├── locators/            # XML locator files
├── assets/              # Application assets
├── test-data.db         # SQLite database
├── tsconfig.json        # TypeScript configuration
└── package.json
```

### 3. Create Supporting Files

Create `package.json`:
```json
{
  "name": "win-ui-automation-tool",
  "version": "1.0.0",
  "description": "Windows UI Automation Test Tool",
  "main": "dist/main.js",
  "scripts": {
    "start": "electron .",
    "dev": "npm run build && electron . --dev",
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dist": "npm run build && electron-builder",
    "rebuild": "electron-rebuild",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit"
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
  "keywords": ["automation", "testing", "windows", "ui-automation", "typescript"],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/jest": "^29.5.8",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "electron-rebuild": "^3.2.9",
    "eslint": "^8.54.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "typescript": "^5.3.0"
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