import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import * as path from 'path';
import { UIAutomationClient } from './UIAutomationClient';
import { AssertionEngine } from './AssertionEngine';
import { TestReporter } from './TestReporter';
import type { TestScenario, TestResult, TestStep, Assertion, TestExecutionResult, StepResult, ElementCriteria } from '../types';

interface LocatorCriteria {
  strategy: 'id' | 'name' | 'className' | 'xpath';
  value: string;
}

interface TestConfig {
  defaultTimeout: number;
  retryAttempts: number;
  screenshotOnFailure: boolean;
  videoRecording: boolean;
  maxParallelTests: number;
  headless: boolean;
}

export class TestRunner {
  private automationClient: UIAutomationClient;
  private assertionEngine: AssertionEngine;
  private reporter: TestReporter;
  private currentTest: TestScenario | null = null;
  private executionLog: StepResult[] = [];
  private isRunningState: boolean = false;
  private config: TestConfig;

  constructor(automationClient: UIAutomationClient, config: Partial<TestConfig> = {}) {
    this.automationClient = automationClient;
    this.assertionEngine = new AssertionEngine(automationClient);
    this.reporter = new TestReporter();
    this.config = {
      defaultTimeout: 30000,
      retryAttempts: 3,
      screenshotOnFailure: true,
      videoRecording: false,
      maxParallelTests: 1,
      headless: false,
      ...config
    };
  }

  async runTest(testData: TestScenario | string): Promise<{ results: TestExecutionResult; report?: any }> {
    const startTime = Date.now();
    this.isRunningState = true;

    try {
      let scenario: TestScenario;

      if (typeof testData === 'string') {
        // ファイルパスからテストシナリオを読み込み
        scenario = await this.loadTestScenario(testData);
      } else {
        scenario = testData;
      }

      const results: TestExecutionResult = {
        testName: scenario.name,
        status: 'passed',
        startTime,
        endTime: 0,
        duration: 0,
        steps: []
      };

      try {
        await this.executeScenario(scenario, results);
        results.status = 'passed';
      } catch (error) {
        results.status = 'failed';
        results.error = error instanceof Error ? error.message : 'Unknown error';
        results.stack = error instanceof Error ? (error.stack || 'No stack trace available') : 'No stack trace available';
      }

      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;

      // Generate report - Convert TestExecutionResult to TestResult[]
      const screenshot = await this.takeScreenshot();
      const testResults: TestResult[] = [{
        id: Date.now(),
        scenarioId: scenario.id || 0,
        status: results.status === 'passed' ? 'passed' : 'failed',
        message: results.status === 'passed' ? 'Test passed successfully' : results.error || 'Test failed',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        screenshot: screenshot || '',
        error: results.error || undefined,
        stack: results.stack || undefined
      }];

      const report = await this.reporter.generateReport(testResults);

      this.isRunningState = false;
      return { results, report };
    } catch (error) {
      this.isRunningState = false;
      const results: TestExecutionResult = {
        testName: typeof testData === 'string' ? testData : testData.name,
        status: 'error',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        steps: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? (error.stack || 'No stack trace available') : 'No stack trace available'
      };

      return { results };
    }
  }

  private async executeScenario(scenario: TestScenario, results: TestExecutionResult): Promise<void> {
    for (const step of scenario.steps) {
      const stepResult = await this.executeStep(step);
      results.steps.push(stepResult);

      if (stepResult.status === 'failed') {
        throw new Error(`Step ${step.id} failed: ${stepResult.error}`);
      }
    }
  }

  private async executeStep(step: TestStep): Promise<StepResult> {
    const stepStartTime = Date.now();
    let stepResult: StepResult = {
      step: step.id,
      action: step.action,
      status: 'running',
      startTime: stepStartTime,
      description: step.description || ''
    };

    try {
      let element: any = null;

      // Locate element if locator is provided
      if (step.locator) {
        element = await this.locateElement(step.locator);
        if (!element) {
          throw new Error(`Element not found: ${step.locator}`);
        }
      }

      // Execute action based on type
      switch (step.action) {
        case 'click':
          if (!element) throw new Error('Click action requires an element');
          await this.automationClient.click(element);
          break;

        case 'type':
        case 'fill':
          if (!element) throw new Error('Type action requires an element');
          if (!step.value) throw new Error('Type action requires a value');
          await this.automationClient.type(element, step.value);
          break;

        case 'hover':
          if (!element) throw new Error('Hover action requires an element');
          await this.automationClient.hover(element);
          break;

        case 'scroll':
          await this.automationClient.scroll(step.value ? parseInt(step.value) : 100);
          break;

        case 'wait':
          const timeout = step.value ? parseInt(step.value) : this.config.defaultTimeout;
          await this.sleep(timeout);
          break;

        case 'assert':
          if (!element) throw new Error('Assert action requires an element');
          await this.executeAssertion(step, element);
          break;

        case 'screenshot':
          await this.executeScreenshot(step);
          break;

        default:
          throw new Error(`Unknown action: ${step.action}`);
      }

      stepResult.status = 'passed';
      stepResult.endTime = Date.now();
      stepResult.duration = stepResult.endTime - stepResult.startTime;

    } catch (error) {
      stepResult.status = 'failed';
      stepResult.endTime = Date.now();
      stepResult.duration = (stepResult.endTime || stepResult.startTime) - stepResult.startTime;
      stepResult.error = error instanceof Error ? error.message : 'Unknown error';
      stepResult.stack = error instanceof Error ? (error.stack || 'No stack trace available') : 'No stack trace available';

      // 失敗時にスクリーンショットを撮影
      if (this.config.screenshotOnFailure) {
        try {
          stepResult.screenshot = await this.takeScreenshot();
        } catch (screenshotError) {
          console.error('Failed to take screenshot:', screenshotError);
        }
      }
    }

    this.executionLog.push(stepResult);
    return stepResult;
  }

  private async executeAssertion(step: TestStep, element: any): Promise<void> {
    // Parse assertion from step description or value
    // This is a simplified implementation
    const assertion: Assertion = {
      id: Date.now(),
      type: 'visible',
      locator: step.locator || '',
      expected: step.value || true,
      timestamp: new Date().toISOString()
    };

    const result = await this.assertionEngine.runAssertion(assertion, element);
    
    if (!result.passed) {
      throw new Error(result.message);
    }
  }

  private async executeScreenshot(step: TestStep): Promise<void> {
    const element = step.locator ? await this.locateElement(step.locator) : null;
    await this.takeScreenshot(element);
  }

  private async locateElement(locator: string): Promise<any> {
    const criteria = this.parseLocator(locator);
    
    // Create ElementCriteria with valid properties only
    const elementCriteria: Partial<ElementCriteria> = {};
    
    if (criteria.strategy === 'id') {
      elementCriteria.automationId = criteria.value;
    } else if (criteria.strategy === 'name') {
      elementCriteria.name = criteria.value;
    } else if (criteria.strategy === 'className') {
      elementCriteria.className = criteria.value;
    } else {
      throw new Error(`Unsupported locator strategy: ${criteria.strategy}`);
    }

    // Ensure at least one property is set before casting
    if (!elementCriteria.automationId && !elementCriteria.name && !elementCriteria.className) {
      throw new Error(`No valid criteria found for locator: ${locator}`);
    }

    return await this.automationClient.findElement(elementCriteria as ElementCriteria);
  }

  private parseLocator(locator: string): LocatorCriteria {
    // Parse different locator formats
    // id=value, name=value, className=value, xpath=value
    
    const idMatch = locator.match(/^id=(.+)$/);
    if (idMatch && idMatch[1]) {
      return {
        strategy: 'id',
        value: idMatch[1]
      };
    }

    const nameMatch = locator.match(/^name=(.+)$/);
    if (nameMatch && nameMatch[1]) {
      return {
        strategy: 'name',
        value: nameMatch[1]
      };
    }

    const classNameMatch = locator.match(/^className=(.+)$/);
    if (classNameMatch && classNameMatch[1]) {
      return {
        strategy: 'className',
        value: classNameMatch[1]
      };
    }

    const xpathMatch = locator.match(/^xpath=(.+)$/);
    if (xpathMatch && xpathMatch[1]) {
      return {
        strategy: 'xpath',
        value: xpathMatch[1]
      };
    }

    // Default to name if no prefix is found
    return {
      strategy: 'name',
      value: locator
    };
  }

  private async takeScreenshot(element?: any): Promise<string> {
    if (element) {
      return await this.automationClient.screenshot(element);
    } else {
      // 全画面スクリーンショット
      return await this.automationClient.screenshot({ handle: 0 });
    }
  }

  private async loadTestScenario(filePath: string): Promise<TestScenario> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const extension = path.extname(filePath).toLowerCase();

      if (extension === '.json') {
        return JSON.parse(content);
      } else if (extension === '.yaml' || extension === '.yml') {
        return yaml.load(content) as TestScenario;
      } else {
        throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      throw new Error(`Failed to load test scenario: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async runTestsInParallel(scenarios: TestScenario[]): Promise<TestExecutionResult[]> {
    const results: TestExecutionResult[] = [];
    const chunks = this.chunkArray(scenarios, this.config.maxParallelTests);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(scenario => this.runTest(scenario));
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults.map(r => r.results));
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  isRunning(): boolean {
    return this.isRunningState;
  }

  stop(): void {
    this.isRunningState = false;
  }

  updateConfig(config: Partial<TestConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TestConfig {
    return { ...this.config };
  }

  getCurrentTest(): TestScenario | null {
    return this.currentTest;
  }

  getExecutionLog(): StepResult[] {
    return [...this.executionLog];
  }

  clearExecutionLog(): void {
    this.executionLog = [];
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 