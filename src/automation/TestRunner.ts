import * as yaml from 'js-yaml';
import { UIAutomationClient } from './UIAutomationClient';
import { AssertionEngine } from './AssertionEngine';
import { TestReporter } from './TestReporter';
import type { TestScenario, TestResult, TestStep, Assertion } from '../types';

interface StepResult {
  step: number;
  action: string;
  status: 'running' | 'passed' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  description?: string;
  error?: string;
  stack?: string;
  screenshot?: string;
  failureScreenshot?: string;
}

interface TestExecutionResult {
  testName: string;
  status: 'running' | 'passed' | 'failed' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
  steps: StepResult[];
  error?: string;
  stack?: string;
}

interface ElementSelector {
  type: 'automationId' | 'name' | 'className' | 'controlType' | 'xpath';
  value: string;
  priority: number;
}

interface SelectorCriteria {
  selectors: ElementSelector[];
}

export class TestRunner {
  private automationClient: UIAutomationClient;
  private assertionEngine: AssertionEngine;
  private reporter: TestReporter;
  private currentTest: TestScenario | null = null;
  private executionLog: StepResult[] = [];
  private isRunning: boolean = false;

  constructor(automationClient: UIAutomationClient, assertionEngine: AssertionEngine) {
    this.automationClient = automationClient;
    this.assertionEngine = assertionEngine;
    this.reporter = new TestReporter();
  }

  async runTest(testData: TestScenario | string): Promise<{ results: TestExecutionResult; report?: any }> {
    try {
      this.isRunning = true;
      
      // Parse test data if it's YAML string
      const test = typeof testData === 'string' ? yaml.load(testData) as TestScenario : testData;
      
      this.currentTest = test;
      this.executionLog = [];
      
      const startTime = Date.now();
      const results: TestExecutionResult = {
        testName: test.name,
        status: 'running',
        startTime: startTime,
        steps: []
      };
      
      // Execute each step
      for (const step of test.steps) {
        const stepResult = await this.executeStep(step);
        results.steps.push(stepResult);
        
        if (stepResult.status === 'failed') {
          results.status = 'failed';
          break;
        }
      }
      
      if (results.status === 'running') {
        results.status = 'passed';
      }
      
      results.endTime = Date.now();
      results.duration = results.endTime - startTime;
      
      // Generate report
      const report = await this.reporter.generateReport(results);
      
      return {
        results,
        report
      };
    } catch (error) {
      return {
        results: {
          testName: typeof testData === 'string' ? 'Unknown' : testData.name,
          status: 'error',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          steps: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      };
    } finally {
      this.isRunning = false;
    }
  }

  async executeStep(step: TestStep): Promise<StepResult> {
    const stepResult: StepResult = {
      step: step.id,
      action: step.action,
      status: 'running',
      startTime: Date.now()
    };
    
    try {
      // Find element if needed
      let element: any = null;
      if (step.locator) {
        element = await this.findElementBySelector(step.locator);
        if (!element) {
          throw new Error(`Element not found: ${step.locator}`);
        }
      }
      
      // Execute action
      switch (step.action) {
        case 'click':
          await this.automationClient.click(element);
          stepResult.description = `Clicked on element`;
          break;
          
        case 'type':
        case 'fill':
          if (step.value) {
            await this.automationClient.fill(element, step.value);
            stepResult.description = `Typed "${step.value}" into element`;
          }
          break;
          
        case 'clear':
          await this.automationClient.clear(element);
          stepResult.description = `Cleared element`;
          break;
          
        case 'hover':
          await this.automationClient.hover(element);
          stepResult.description = `Hovered over element`;
          break;
          
        case 'doubleClick':
          await this.automationClient.doubleClick(element);
          stepResult.description = `Double-clicked element`;
          break;
          
        case 'rightClick':
          await this.automationClient.rightClick(element);
          stepResult.description = `Right-clicked element`;
          break;
          
        case 'selectOption':
          if (step.value) {
            await this.automationClient.selectOption(element, step.value);
            stepResult.description = `Selected option "${step.value}"`;
          }
          break;
          
        case 'check':
          await this.automationClient.check(element);
          stepResult.description = `Checked checkbox`;
          break;
          
        case 'uncheck':
          await this.automationClient.uncheck(element);
          stepResult.description = `Unchecked checkbox`;
          break;
          
        case 'keypress':
          if (step.value) {
            await this.simulateKeyPress(step.value);
            stepResult.description = `Pressed key "${step.value}"`;
          }
          break;
          
        case 'wait':
          const duration = step.value ? parseInt(step.value) : 1000;
          await this.wait(duration);
          stepResult.description = `Waited ${duration}ms`;
          break;
          
        case 'waitForSelector':
          const timeout = step.value ? parseInt(step.value) : 30000;
          element = await this.automationClient.waitForSelector(
            step.locator || '', 
            { timeout }
          );
          stepResult.description = `Waited for element to appear`;
          break;
          
        case 'screenshot':
          const screenshot = await this.automationClient.screenshot(element || { handle: 0 });
          stepResult.screenshot = screenshot;
          stepResult.description = `Took screenshot`;
          break;
          
        case 'assert':
          if (step.value) {
            const assertion: Assertion = JSON.parse(step.value);
            const assertionResult = await this.assertionEngine.runAssertion(assertion, element);
            if (!assertionResult.passed) {
              throw new Error(`Assertion failed: ${assertionResult.message}`);
            }
            stepResult.description = `Assertion passed: ${assertion.type}`;
          }
          break;
          
        default:
          throw new Error(`Unknown action: ${step.action}`);
      }
      
      stepResult.status = 'passed';
      
    } catch (error) {
      stepResult.status = 'failed';
      stepResult.error = error instanceof Error ? error.message : 'Unknown error';
      stepResult.stack = error instanceof Error ? error.stack : undefined;
      
      // Take screenshot on failure
      try {
        const screenshot = await this.automationClient.screenshot({ handle: 0 });
        stepResult.failureScreenshot = screenshot;
      } catch (e) {
        // Ignore screenshot errors
      }
    }
    
    stepResult.endTime = Date.now();
    stepResult.duration = stepResult.endTime - stepResult.startTime;
    
    this.executionLog.push(stepResult);
    return stepResult;
  }

  async findElementBySelector(selector: string): Promise<any> {
    // Parse selector string
    const selectors = this.parseSelector(selector);
    
    // Try selectors in priority order
    for (const sel of selectors) {
      const criteria: any = {};
      
      switch (sel.type) {
        case 'automationId':
          criteria.automationId = sel.value;
          break;
        case 'name':
          criteria.name = sel.value;
          break;
        case 'className':
          criteria.className = sel.value;
          break;
        case 'controlType':
          criteria.controlType = sel.value;
          break;
        case 'xpath':
          // XPath handling would need special implementation
          continue;
      }
      
      const element = await this.automationClient.findElement(criteria);
      if (element) {
        return element;
      }
    }
    
    return null;
  }

  private parseSelector(selector: string): ElementSelector[] {
    const selectors: ElementSelector[] = [];
    
    // Simple selector parsing - can be enhanced
    if (selector.includes('automationId=')) {
      const match = selector.match(/automationId="([^"]+)"/);
      if (match) {
        selectors.push({
          type: 'automationId',
          value: match[1],
          priority: 1
        });
      }
    }
    
    if (selector.includes('name=')) {
      const match = selector.match(/name="([^"]+)"/);
      if (match) {
        selectors.push({
          type: 'name',
          value: match[1],
          priority: 2
        });
      }
    }
    
    if (selector.includes('className=')) {
      const match = selector.match(/className="([^"]+)"/);
      if (match) {
        selectors.push({
          type: 'className',
          value: match[1],
          priority: 3
        });
      }
    }
    
    if (selector.includes('controlType=')) {
      const match = selector.match(/controlType="([^"]+)"/);
      if (match) {
        selectors.push({
          type: 'controlType',
          value: match[1],
          priority: 4
        });
      }
    }
    
    return selectors.sort((a, b) => a.priority - b.priority);
  }

  async simulateKeyPress(key: string): Promise<void> {
    // Implement key simulation using robotjs or similar
    // This is a placeholder implementation
    console.log(`Simulating key press: ${key}`);
    
    // Example implementation with robotjs
    // const robot = require('robotjs');
    // robot.keyTap(key.toLowerCase());
  }

  async wait(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  pauseTest(): void {
    this.isRunning = false;
  }

  isRunning(): boolean {
    return this.isRunning;
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
} 