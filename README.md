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

## 🚀 Future Roadmap

### 🔌 Plugin System (Phase 4: Q1 2025)
- **Custom Assertions** - Create your own assertion libraries
- **External Tool Integration** - Jira, Slack, Excel export plugins
- **Custom Report Formats** - Extensible reporting system
- **Plugin Store** - Community-driven plugin marketplace

### 🤖 AI & Machine Learning (Phase 5: Q2 2025)
- **AI Element Detection** - TensorFlow.js-based intelligent UI element recognition
- **Test Case Generation** - AI-powered test case creation
- **Anomaly Detection** - Predictive failure analysis
- **Smart Optimization** - Automated test optimization
- **Natural Language Search** - Find elements using natural language

### 🔄 Real-time Collaboration (Phase 6: Q3 2025)
- **WebSocket Communication** - Real-time multi-user collaboration
- **File Locking System** - Prevent conflicts during simultaneous editing
- **Version Control Integration** - Git integration for test scenario management
- **Conflict Resolution** - Automatic conflict detection and resolution
- **Team Coordination** - User management and permission control

### 📱 Cross-Platform Support (Phase 7: Q4 2025)
- **Mobile App Testing** - Android and iOS application support
- **Web Application Testing** - Browser automation integration
- **Cross-Platform API** - Unified API across platforms
- **Multi-Environment Testing** - Desktop, mobile, and web

### 📊 Advanced Analytics (Phase 8: Q1 2026)
- **Test Execution Analytics** - Performance and success rate analysis
- **Predictive Testing** - Failure prediction and prevention
- **Regression Analysis** - Automated regression test detection
- **Performance Monitoring** - Real-time performance tracking

### 🔄 Enterprise Features (Phase 9: Q2 2026)
- **Large-scale Test Management** - Enterprise-grade test orchestration
- **Advanced Security** - Enterprise security and compliance
- **IDE Integration** - VS Code, IntelliJ, Eclipse plugins
- **Enterprise Support** - Professional support and training

## 🏢 On-Premises Architecture

### 🤖 AI Technology Stack (High Learning Capacity)
- **TensorFlow.js** - Browser-based machine learning for element recognition
- **ONNX.js** - High-speed inference with pre-trained models
- **OpenCV.js** - Image processing and element detection
- **Tesseract.js** - OCR functionality for text recognition
- **Natural Language Processing** - Natural language element search

### 🔄 Real-time Collaboration Features
- **WebSocket** - Real-time communication between users
- **SQLite + WAL** - Concurrent access support
- **File Locking Mechanism** - Conflict prevention
- **Version Control** - Git integration for scenario management

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
```

## Usage

### Basic Test Recording

1. **Start Recording**: Click the "Start Recording" button
2. **Perform Actions**: Interact with your Windows application
3. **Stop Recording**: Click "Stop Recording" to finish
4. **Review & Edit**: Modify recorded actions as needed
5. **Run Test**: Execute the test to verify functionality

### Advanced Features

#### Custom Assertions
```typescript
// Create custom assertions
await page.assert.custom('elementExists', { selector: '#my-element' });
await page.assert.custom('valueEquals', { selector: '#input', expected: 'test' });
```

#### Test Scenarios
```typescript
// Organize tests into scenarios
const scenario = {
  name: 'Login Flow',
  description: 'Test user login functionality',
  tags: ['login', 'authentication'],
  steps: [
    { action: 'click', selector: '#login-btn' },
    { action: 'fill', selector: '#username', value: 'testuser' },
    { action: 'fill', selector: '#password', value: 'password' },
    { action: 'click', selector: '#submit' }
  ]
};
```

#### Shared Locators
```xml
<!-- locators/login.xml -->
<locators>
  <locator name="loginButton" selector="#login-btn" />
  <locator name="usernameField" selector="#username" />
  <locator name="passwordField" selector="#password" />
</locators>
```

## API Reference

### Core Methods

#### Navigation
- `page.goto(url)` - Navigate to URL
- `page.waitForLoadState()` - Wait for page load
- `page.reload()` - Reload current page

#### Actions
- `page.click(selector)` - Click element
- `page.fill(selector, value)` - Fill input field
- `page.hover(selector)` - Hover over element
- `page.selectOption(selector, value)` - Select option
- `page.check(selector)` - Check checkbox
- `page.uncheck(selector)` - Uncheck checkbox

#### Assertions
- `page.assert.visible(selector)` - Assert element is visible
- `page.assert.text(selector, expected)` - Assert text content
- `page.assert.value(selector, expected)` - Assert input value
- `page.assert.screenshot()` - Compare with baseline screenshot

#### Utilities
- `page.waitForSelector(selector)` - Wait for element
- `page.takeScreenshot()` - Capture screenshot
- `page.evaluate(fn)` - Execute JavaScript

## Configuration

### Application Settings
```json
{
  "ui": {
    "theme": "auto",
    "language": "en",
    "fontSize": 14
  },
  "test": {
    "defaultTimeout": 30000,
    "retryAttempts": 3,
    "screenshotOnFailure": true
  },
  "automation": {
    "defaultWaitTimeout": 5000,
    "elementTimeout": 10000
  }
}
```

## Contributing

### Development Guidelines

1. **TypeScript**: All new code must be written in TypeScript
2. **Testing**: Include unit tests for new features
3. **Documentation**: Update documentation for API changes
4. **Code Style**: Follow ESLint configuration

### Plugin Development

```typescript
// Example plugin structure
export interface Plugin {
  name: string;
  version: string;
  description: string;
  init(): Promise<void>;
  execute(params: any): Promise<any>;
}

// Custom assertion plugin
export class CustomAssertionPlugin implements Plugin {
  name = 'custom-assertions';
  version = '1.0.0';
  description = 'Custom assertion library';

  async init(): Promise<void> {
    // Initialize plugin
  }

  async execute(params: any): Promise<any> {
    // Execute custom assertion
  }
}
```

## Troubleshooting

### Common Issues

1. **UI Automation API Errors**
   - Ensure target application is accessible
   - Check Windows permissions
   - Verify .NET Framework installation

2. **Recording Issues**
   - Disable antivirus real-time scanning
   - Run as administrator if needed
   - Check iohook compatibility

3. **Build Errors**
   - Install Visual Studio Build Tools
   - Run `npm run rebuild`
   - Check Node.js version compatibility

### Debug Mode

Enable debug logging:
```bash
npm start -- --debug
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [Wiki](https://github.com/your-repo/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@yourcompany.com

## Roadmap Updates

Stay updated with our development progress:
- **GitHub Projects**: [Project Board](https://github.com/your-repo/projects)
- **Release Notes**: [Releases](https://github.com/your-repo/releases)
- **Blog**: [Development Blog](https://yourcompany.com/blog)

---

**Windows UI Automation Test Tool** - Making Windows application testing simple and efficient.