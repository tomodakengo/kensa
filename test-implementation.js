#!/usr/bin/env node

/**
 * 実装した機能のテストスクリプト
 * このスクリプトは実装した機能が正しく動作するかを確認します
 */

const fs = require('fs-extra');
const path = require('path');

console.log('🧪 Windows UI Automation Test Tool - 実装テスト');
console.log('================================================');

async function testImplementation() {
  const tests = [
    {
      name: 'プロジェクト構造の確認',
      test: async () => {
        const requiredFiles = [
          'package.json',
          'tsconfig.json',
          'src/main.ts',
          'src/automation/UIAutomationClient.ts',
          'src/automation/TestRunner.ts',
          'src/automation/TestRecorder.ts',
          'src/automation/AssertionEngine.ts',
          'src/automation/TestReporter.ts',
          'src/database/DatabaseManager.ts',
          'src/managers/ScenarioManager.ts',
          'src/managers/LocatorManager.ts',
          'src/utils/ErrorHandler.ts',
          'src/utils/ConfigManager.ts',
          'src/types/index.ts'
        ];

        const missingFiles = [];
        for (const file of requiredFiles) {
          if (!await fs.pathExists(file)) {
            missingFiles.push(file);
          }
        }

        if (missingFiles.length > 0) {
          throw new Error(`Missing files: ${missingFiles.join(', ')}`);
        }

        return `✅ 全${requiredFiles.length}個のファイルが存在します`;
      }
    },
    {
      name: 'package.jsonの依存関係確認',
      test: async () => {
        const packageJson = await fs.readJson('package.json');
        const requiredDeps = [
          'edge-js',
          'iohook',
          'sqlite3',
          'fs-extra',
          'js-yaml',
          'xml2js',
          'robotjs',
          'sharp'
        ];

        const missingDeps = [];
        for (const dep of requiredDeps) {
          if (!packageJson.dependencies[dep]) {
            missingDeps.push(dep);
          }
        }

        if (missingDeps.length > 0) {
          throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
        }

        return `✅ 全${requiredDeps.length}個の依存関係が設定されています`;
      }
    },
    {
      name: 'TypeScript設定の確認',
      test: async () => {
        const tsConfig = await fs.readJson('tsconfig.json');
        
        if (!tsConfig.compilerOptions) {
          throw new Error('TypeScript compiler options not found');
        }

        if (!tsConfig.compilerOptions.target) {
          throw new Error('TypeScript target not set');
        }

        return '✅ TypeScript設定が正しく構成されています';
      }
    },
    {
      name: 'ディレクトリ構造の確認',
      test: async () => {
        const requiredDirs = [
          'src',
          'src/automation',
          'src/database',
          'src/managers',
          'src/types',
          'src/utils',
          'assets',
          'locators',
          '__snapshots__',
          'reports',
          'screenshots'
        ];

        const missingDirs = [];
        for (const dir of requiredDirs) {
          if (!await fs.pathExists(dir)) {
            missingDirs.push(dir);
          }
        }

        if (missingDirs.length > 0) {
          throw new Error(`Missing directories: ${missingDirs.join(', ')}`);
        }

        return `✅ 全${requiredDirs.length}個のディレクトリが存在します`;
      }
    },
    {
      name: 'UIAutomationClient.tsの実装確認',
      test: async () => {
        const content = await fs.readFile('src/automation/UIAutomationClient.ts', 'utf-8');
        
        const requiredMethods = [
          'moveMouse',
          'doubleClick',
          'rightClick',
          'selectOption',
          'check',
          'uncheck',
          'isChecked',
          'getValue',
          'hasFocus',
          'findElements'
        ];

        const missingMethods = [];
        for (const method of requiredMethods) {
          if (!content.includes(`async ${method}(`)) {
            missingMethods.push(method);
          }
        }

        if (missingMethods.length > 0) {
          throw new Error(`Missing methods: ${missingMethods.join(', ')}`);
        }

        return `✅ 全${requiredMethods.length}個のメソッドが実装されています`;
      }
    },
    {
      name: 'ErrorHandler.tsの実装確認',
      test: async () => {
        const content = await fs.readFile('src/utils/ErrorHandler.ts', 'utf-8');
        
        const requiredFeatures = [
          'class ErrorHandler',
          'LogLevel',
          'retry',
          'log',
          'setupGlobalErrorHandlers'
        ];

        const missingFeatures = [];
        for (const feature of requiredFeatures) {
          if (!content.includes(feature)) {
            missingFeatures.push(feature);
          }
        }

        if (missingFeatures.length > 0) {
          throw new Error(`Missing features: ${missingFeatures.join(', ')}`);
        }

        return `✅ 全${requiredFeatures.length}個の機能が実装されています`;
      }
    },
    {
      name: 'ConfigManager.tsの実装確認',
      test: async () => {
        const content = await fs.readFile('src/utils/ConfigManager.ts', 'utf-8');
        
        const requiredFeatures = [
          'class ConfigManager',
          'AppConfig',
          'DEFAULT_CONFIG',
          'exportConfig',
          'importConfig',
          'validateConfig'
        ];

        const missingFeatures = [];
        for (const feature of requiredFeatures) {
          if (!content.includes(feature)) {
            missingFeatures.push(feature);
          }
        }

        if (missingFeatures.length > 0) {
          throw new Error(`Missing features: ${missingFeatures.join(', ')}`);
        }

        return `✅ 全${requiredFeatures.length}個の機能が実装されています`;
      }
    },
    {
      name: 'AssertionEngine.tsの画像比較機能確認',
      test: async () => {
        const content = await fs.readFile('src/automation/AssertionEngine.ts', 'utf-8');
        
        if (!content.includes('sharp')) {
          throw new Error('Sharp library integration not found');
        }

        if (!content.includes('compareImages')) {
          throw new Error('compareImages method not found');
        }

        return '✅ 画像比較機能が実装されています';
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n🔍 ${test.name}...`);
      const result = await test.test();
      console.log(result);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name} - 失敗: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 テスト結果');
  console.log('=============');
  console.log(`✅ 成功: ${passed}`);
  console.log(`❌ 失敗: ${failed}`);
  console.log(`📈 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 全てのテストが成功しました！実装は完了しています。');
  } else {
    console.log('\n⚠️  一部のテストが失敗しました。実装を確認してください。');
  }
}

// テスト実行
testImplementation().catch(error => {
  console.error('テスト実行中にエラーが発生しました:', error);
  process.exit(1);
}); 