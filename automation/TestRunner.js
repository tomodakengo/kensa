const yaml = require('js-yaml');
const { AssertionEngine } = require('./AssertionEngine');
const { TestReporter } = require('./TestReporter');

class TestRunner {
  constructor(automationClient) {
    this.automationClient = automationClient;
    this.assertionEngine = new AssertionEngine(automationClient);
    this.reporter = new TestReporter();
    this.currentTest = null;
    this.executionLog = [];
  }

  async runTest(testData) {
    try {
      // Parse test data if it's YAML string
      const test = typeof testData === 'string' ? yaml.load(testData) : testData;
      
      this.currentTest = test;
      this.executionLog = [];
      
      const startTime = Date.now();
      const results = {
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
        status: 'error',
        error: error.message,
        stack: error.stack
      };
    }
  }

  async executeStep(step) {
    const stepResult = {
      step: step.step,
      action: step.action,
      status: 'running',
      startTime: Date.now()
    };
    
    try {
      // Find element if needed
      let element = null;
      if (step.selector) {
        element = await this.findElementBySelector(step.selector);
        if (!element) {
          throw new Error(`Element not found: ${JSON.stringify(step.selector)}`);
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
          await this.automationClient.fill(element, step.text);
          stepResult.description = `Typed "${step.text}" into element`;
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
          await this.automationClient.selectOption(element, step.value);
          stepResult.description = `Selected option "${step.value}"`;
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
          await this.simulateKeyPress(step.key);
          stepResult.description = `Pressed key "${step.key}"`;
          break;
          
        case 'wait':
          await this.wait(step.duration || 1000);
          stepResult.description = `Waited ${step.duration || 1000}ms`;
          break;
          
        case 'waitForSelector':
          element = await this.automationClient.waitForSelector(
            step.selector, 
            { timeout: step.timeout || 30000 }
          );
          stepResult.description = `Waited for element to appear`;
          break;
          
        case 'screenshot':
          const screenshot = await this.automationClient.screenshot(element || { handle: 0 });
          stepResult.screenshot = screenshot;
          stepResult.description = `Took screenshot`;
          break;
          
        case 'assert':
          const assertionResult = await this.assertionEngine.runAssertion(step.assertion, element);
          if (!assertionResult.passed) {
            throw new Error(`Assertion failed: ${assertionResult.message}`);
          }
          stepResult.description = `Assertion passed: ${step.assertion.type}`;
          break;
          
        default:
          throw new Error(`Unknown action: ${step.action}`);
      }
      
      stepResult.status = 'passed';
      
    } catch (error) {
      stepResult.status = 'failed';
      stepResult.error = error.message;
      stepResult.stack = error.stack;
      
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

  async findElementBySelector(selector) {
    // Try selectors in priority order
    for (const sel of selector.selectors) {
      const criteria = {};
      
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
      }
      
      const element = await this.automationClient.findElement(criteria);
      if (element) {
        return element;
      }
    }
    
    return null;
  }

  async simulateKeyPress(key) {
    const robot = require('robotjs');
    
    // Map common key names to robotjs key codes
      const keyMap = {
          'enter': 'enter',
          'tab': 'tab',
          'esc': 'escape',
          'backspace': 'backspace',
          'delete': 'delete',
          'pageup': 'pageup',
          'pagedown': 'pagedown',
          'home': 'home',
          'end': 'end',
          'up': 'up',
          'down': 'down',
          'left': 'left',
          'right': 'right',
          'f1': 'f1',
          'f2': 'f2',
          'f3': 'f3',
          'f4': 'f4',
          'f5': 'f5',
          'f6': 'f6',
          'f7': 'f7',
          'f8': 'f8',
          'f9': 'f9',
          'f10': 'f10',
          'f11': 'f11',
          'f12': 'f12',
      };
      
      if (keyMap[key]) {
        robot.keyTap(keyMap[key]);
      } else {
        robot.keyTap(key);
      }
    }
  }
}