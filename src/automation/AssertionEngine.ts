import * as fs from 'fs-extra';
import * as path from 'path';
import { UIAutomationClient } from './UIAutomationClient';
import type { Assertion, Snapshot, AssertionResult, AssertionHandler } from '../types';

interface AttributeAssertion {
  name: string;
  value: string;
}

export class AssertionEngine {
  private automationClient: UIAutomationClient;
  private assertions: Map<string, AssertionHandler> = new Map();
  private snapshotsDir: string;

  constructor(automationClient: UIAutomationClient) {
    this.automationClient = automationClient;
    this.snapshotsDir = path.join(__dirname, '../../__snapshots__');
    this.registerBuiltInAssertions();
  }

  private registerBuiltInAssertions(): void {
    // Visibility assertions
    this.register('visible', async (element: any, expected: boolean = true) => {
      const props = await this.automationClient.getElementProperties(element);
      const isVisible = props && !props.isOffscreen && props.bounds.width > 0 && props.bounds.height > 0;

      return {
        type: 'visible',
        passed: isVisible === expected,
        actual: isVisible,
        expected: expected,
        message: `Element ${expected ? 'should be' : 'should not be'} visible`,
        timestamp: Date.now()
      };
    });

    // Text content assertions
    this.register('text', async (element: any, expected: string) => {
      const actual = await this.automationClient.getText(element);
      const passed = actual === expected;

      return {
        type: 'text',
        passed,
        actual,
        expected,
        message: `Expected text to be "${expected}", but got "${actual}"`,
        timestamp: Date.now()
      };
    });

    this.register('contains-text', async (element: any, expected: string) => {
      const actual = await this.automationClient.getText(element);
      const passed = actual ? actual.includes(expected) : false;

      return {
        type: 'contains-text',
        passed,
        actual,
        expected,
        message: `Expected text to contain "${expected}", but got "${actual}"`,
        timestamp: Date.now()
      };
    });

    // State assertions
    this.register('enabled', async (element: any, expected: boolean = true) => {
      const props = await this.automationClient.getElementProperties(element);
      const isEnabled = props && props.isEnabled;

      return {
        type: 'enabled',
        passed: isEnabled === expected,
        actual: isEnabled,
        expected,
        message: `Element ${expected ? 'should be' : 'should not be'} enabled`,
        timestamp: Date.now()
      };
    });

    this.register('checked', async (element: any, expected: boolean = true) => {
      const props = await this.automationClient.getElementProperties(element);
      if (!props.controlType.includes('CheckBox') && !props.controlType.includes('RadioButton')) {
        return {
          type: 'checked',
          passed: false,
          message: 'Element is not a checkbox or radio button',
          timestamp: Date.now()
        };
      }

      const isChecked = await this.automationClient.isChecked(element);

      return {
        type: 'checked',
        passed: isChecked === expected,
        actual: isChecked,
        expected,
        message: `Element ${expected ? 'should be' : 'should not be'} checked`,
        timestamp: Date.now()
      };
    });

    // Value assertions
    this.register('value', async (element: any, expected: string) => {
      const actual = await this.automationClient.getValue(element);
      const passed = actual === expected;

      return {
        type: 'value',
        passed,
        actual,
        expected,
        message: `Expected value to be "${expected}", but got "${actual}"`,
        timestamp: Date.now()
      };
    });

    // Attribute assertions
    this.register('attribute', async (element: any, params: AttributeAssertion) => {
      const props = await this.automationClient.getElementProperties(element);
      const actual = props[params.name];
      const passed = actual === params.value;

      return {
        type: 'attribute',
        passed,
        actual,
        expected: params.value,
        message: `Expected ${params.name} to be "${params.value}", but got "${actual}"`,
        timestamp: Date.now()
      };
    });

    // Count assertions
    this.register('count', async (selector: any, expected: number) => {
      const elements = await this.automationClient.findElements(selector);
      const actual = elements.length;
      const passed = actual === expected;

      return {
        type: 'count',
        passed,
        actual,
        expected,
        message: `Expected ${expected} elements, but found ${actual}`,
        timestamp: Date.now()
      };
    });

    // Focus assertions
    this.register('focused', async (element: any, expected: boolean = true) => {
      const hasFocus = await this.automationClient.hasFocus(element);

      return {
        type: 'focused',
        passed: hasFocus === expected,
        actual: hasFocus,
        expected,
        message: `Element ${expected ? 'should have' : 'should not have'} focus`,
        timestamp: Date.now()
      };
    });

    // Custom assertions
    this.register('matches-snapshot', async (element: any, snapshotName: string) => {
      const screenshot = await this.automationClient.screenshot(element);
      const snapshot = await this.loadSnapshot(snapshotName);

      if (!snapshot) {
        await this.saveSnapshot(snapshotName, screenshot);
        return {
          type: 'matches-snapshot',
          passed: true,
          message: 'Snapshot created',
          timestamp: Date.now()
        };
      }

      const passed = await this.compareImages(screenshot, snapshot);

      return {
        type: 'matches-snapshot',
        passed,
        actual: screenshot,
        expected: snapshot,
        message: passed ? 'Screenshot matches snapshot' : 'Screenshot does not match snapshot',
        timestamp: Date.now()
      };
    });
  }

  register(name: string, handler: AssertionHandler): void {
    this.assertions.set(name, handler);
  }

  async runAssertion(assertion: Assertion, element: any): Promise<AssertionResult> {
    const { type, expected } = assertion;

    if (!this.assertions.has(type)) {
      return {
        type,
        passed: false,
        message: `Unknown assertion type: ${type}`,
        timestamp: Date.now()
      };
    }

    try {
      const handler = this.assertions.get(type)!;
      const result = await handler(element, expected);
      
      return {
        ...result,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        type,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? (error.stack || 'No stack trace available') : 'No stack trace available',
        message: `Assertion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  async runMultipleAssertions(assertions: Assertion[], element: any): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];
    
    for (const assertion of assertions) {
      const result = await this.runAssertion(assertion, element);
      results.push(result);
      
      if (!result.passed) {
        break; // Stop on first failure
      }
    }
    
    return results;
  }

  async takeSnapshot(element?: any): Promise<Snapshot> {
    const timestamp = new Date().toISOString();
    const name = `snapshot_${Date.now()}`;
    const filename = `${name}.png`;
    const filepath = path.join(this.snapshotsDir, filename);

    await fs.ensureDir(this.snapshotsDir);

    let screenshotPath = '';
    if (element) {
      screenshotPath = await this.automationClient.screenshot(element);
    } else {
      // Take full screen screenshot
      screenshotPath = await this.automationClient.screenshot({ handle: 0 });
    }

    if (screenshotPath && screenshotPath !== filepath) {
      await fs.copy(screenshotPath, filepath);
    }

    return {
      id: Date.now(),
      name,
      path: filepath,
      timestamp,
      description: `Snapshot taken at ${timestamp}`
    };
  }

  async loadSnapshot(name: string): Promise<string | null> {
    const filepath = path.join(this.snapshotsDir, `${name}.png`);
    
    try {
      const exists = await fs.pathExists(filepath);
      return exists ? filepath : null;
    } catch (error) {
      console.error('Error loading snapshot:', error);
      return null;
    }
  }

  async saveSnapshot(name: string, data: string): Promise<void> {
    const filepath = path.join(this.snapshotsDir, `${name}.png`);
    await fs.ensureDir(this.snapshotsDir);
    await fs.copy(data, filepath);
  }

  async compareImages(image1: string, image2: string): Promise<boolean> {
    try {
      const buffer1 = await fs.readFile(image1);
      const buffer2 = await fs.readFile(image2);

      if (buffer1.length !== buffer2.length) {
        return false;
      }

      // Simple byte-by-byte comparison
      const diff = buffer1.compare(buffer2);
      let diffPixels = 0;
      if (typeof diff === 'number') {
        diffPixels = diff === 0 ? 0 : 1;
      }
      
      // Allow for small differences (less than 1% of total pixels)
      const tolerance = buffer1.length * 0.01;
      return diffPixels <= tolerance;
    } catch (error) {
      console.error('Error comparing images:', error);
      return false;
    }
  }

  // Fluent API for assertions
  expect(element: any) {
    return {
      toBeVisible: async (): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'visible', expected: true, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toBeHidden: async (): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'visible', expected: false, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toHaveText: async (text: string): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'text', expected: text, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toContainText: async (text: string): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'contains-text', expected: text, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toBeEnabled: async (): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'enabled', expected: true, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toBeDisabled: async (): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'enabled', expected: false, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toBeChecked: async (): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'checked', expected: true, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toHaveValue: async (value: string): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'value', expected: value, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toHaveAttribute: async (name: string, value: string): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'attribute', expected: { name, value }, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toBeFocused: async (): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'focused', expected: true, locator: '', timestamp: new Date().toISOString() }, element);
      },

      toMatchSnapshot: async (name: string): Promise<AssertionResult> => {
        return await this.runAssertion({ id: 0, type: 'matches-snapshot', expected: name, locator: '', timestamp: new Date().toISOString() }, element);
      }
    };
  }

  getRegisteredAssertions(): string[] {
    return Array.from(this.assertions.keys());
  }

  clearAssertions(): void {
    this.assertions.clear();
  }
} 