import * as fs from 'fs-extra';
import * as path from 'path';
import { UIAutomationClient } from './UIAutomationClient';
import type { Assertion, Snapshot } from '../types';

interface AssertionResult {
  type: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  message: string;
  error?: string;
  stack?: string;
  timestamp: number;
}

interface AssertionHandler {
  (element: any, expected?: any): Promise<AssertionResult>;
}

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
        passed: isVisible === expected,
        actual: isVisible,
        expected: expected,
        message: `Element ${expected ? 'should be' : 'should not be'} visible`
      };
    });

    // Text content assertions
    this.register('text', async (element: any, expected: string) => {
      const actual = await this.automationClient.getText(element);
      const passed = actual === expected;
      
      return {
        passed,
        actual,
        expected,
        message: `Expected text to be "${expected}", but got "${actual}"`
      };
    });

    this.register('contains-text', async (element: any, expected: string) => {
      const actual = await this.automationClient.getText(element);
      const passed = actual && actual.includes(expected);
      
      return {
        passed,
        actual,
        expected,
        message: `Expected text to contain "${expected}", but got "${actual}"`
      };
    });

    // State assertions
    this.register('enabled', async (element: any, expected: boolean = true) => {
      const props = await this.automationClient.getElementProperties(element);
      const isEnabled = props && props.isEnabled;
      
      return {
        passed: isEnabled === expected,
        actual: isEnabled,
        expected,
        message: `Element ${expected ? 'should be' : 'should not be'} enabled`
      };
    });

    this.register('checked', async (element: any, expected: boolean = true) => {
      const props = await this.automationClient.getElementProperties(element);
      if (!props.controlType.includes('CheckBox') && !props.controlType.includes('RadioButton')) {
        return {
          passed: false,
          message: 'Element is not a checkbox or radio button'
        };
      }
      
      const isChecked = await this.automationClient.isChecked(element);
      
      return {
        passed: isChecked === expected,
        actual: isChecked,
        expected,
        message: `Element ${expected ? 'should be' : 'should not be'} checked`
      };
    });

    // Value assertions
    this.register('value', async (element: any, expected: string) => {
      const actual = await this.automationClient.getValue(element);
      const passed = actual === expected;
      
      return {
        passed,
        actual,
        expected,
        message: `Expected value to be "${expected}", but got "${actual}"`
      };
    });

    // Attribute assertions
    this.register('attribute', async (element: any, params: AttributeAssertion) => {
      const props = await this.automationClient.getElementProperties(element);
      const actual = props[params.name];
      const passed = actual === params.value;
      
      return {
        passed,
        actual,
        expected: params.value,
        message: `Expected ${params.name} to be "${params.value}", but got "${actual}"`
      };
    });

    // Count assertions
    this.register('count', async (selector: any, expected: number) => {
      const elements = await this.automationClient.findElements(selector);
      const actual = elements.length;
      const passed = actual === expected;
      
      return {
        passed,
        actual,
        expected,
        message: `Expected ${expected} elements, but found ${actual}`
      };
    });

    // Focus assertions
    this.register('focused', async (element: any, expected: boolean = true) => {
      const hasFocus = await this.automationClient.hasFocus(element);
      
      return {
        passed: hasFocus === expected,
        actual: hasFocus,
        expected,
        message: `Element ${expected ? 'should have' : 'should not have'} focus`
      };
    });

    // Custom assertions
    this.register('matches-snapshot', async (element: any, snapshotName: string) => {
      const screenshot = await this.automationClient.screenshot(element);
      const snapshot = await this.loadSnapshot(snapshotName);
      
      if (!snapshot) {
        await this.saveSnapshot(snapshotName, screenshot);
        return {
          passed: true,
          message: 'Snapshot created'
        };
      }
      
      const passed = await this.compareImages(screenshot, snapshot);
      
      return {
        passed,
        actual: screenshot,
        expected: snapshot,
        message: passed ? 'Screenshot matches snapshot' : 'Screenshot does not match snapshot'
      };
    });
  }

  register(name: string, handler: AssertionHandler): void {
    this.assertions.set(name, handler);
  }

  async runAssertion(assertion: Assertion, element: any): Promise<AssertionResult> {
    const { type, ...params } = assertion;
    
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
      const result = await handler(element, params.expected || params);
      
      return {
        type,
        ...result,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        type,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: Date.now()
      };
    }
  }

  async runMultipleAssertions(assertions: Assertion[], element: any): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];
    
    for (const assertion of assertions) {
      const result = await this.runAssertion(assertion, element);
      results.push(result);
      
      if (!result.passed && (assertion as any).stopOnFailure) {
        break;
      }
    }
    
    return results;
  }

  async takeSnapshot(element?: any): Promise<Snapshot> {
    try {
      await fs.ensureDir(this.snapshotsDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = `snapshot_${timestamp}`;
      const filename = `${name}.png`;
      const filepath = path.join(this.snapshotsDir, filename);
      
      let screenshot: string;
      if (element) {
        screenshot = await this.automationClient.screenshot(element);
      } else {
        // Take full screen screenshot
        screenshot = await this.automationClient.screenshot({ handle: 0 });
      }
      
      // Copy screenshot to snapshots directory
      await fs.copyFile(screenshot, filepath);
      
      const snapshot: Snapshot = {
        id: Date.now(),
        name,
        path: filepath,
        timestamp: new Date().toISOString(),
        description: `Auto-generated snapshot for ${element ? 'element' : 'screen'}`
      };
      
      return snapshot;
    } catch (error) {
      throw new Error(`Failed to take snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadSnapshot(name: string): Promise<string | null> {
    try {
      const filepath = path.join(this.snapshotsDir, `${name}.png`);
      const exists = await fs.pathExists(filepath);
      
      if (exists) {
        return filepath;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading snapshot:', error);
      return null;
    }
  }

  async saveSnapshot(name: string, data: string): Promise<void> {
    try {
      await fs.ensureDir(this.snapshotsDir);
      const filepath = path.join(this.snapshotsDir, `${name}.png`);
      await fs.copyFile(data, filepath);
    } catch (error) {
      throw new Error(`Failed to save snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async compareImages(image1: string, image2: string): Promise<boolean> {
    // Simple file comparison - can be enhanced with image processing
    try {
      const buffer1 = await fs.readFile(image1);
      const buffer2 = await fs.readFile(image2);
      
      return buffer1.equals(buffer2);
    } catch (error) {
      console.error('Error comparing images:', error);
      return false;
    }
  }

  expect(element: any) {
    return {
      async toBeVisible(): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'visible', expected: true }, element);
      },
      
      async toBeHidden(): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'visible', expected: false }, element);
      },
      
      async toHaveText(text: string): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'text', expected: text }, element);
      },
      
      async toContainText(text: string): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'contains-text', expected: text }, element);
      },
      
      async toBeEnabled(): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'enabled', expected: true }, element);
      },
      
      async toBeDisabled(): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'enabled', expected: false }, element);
      },
      
      async toBeChecked(): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'checked', expected: true }, element);
      },
      
      async toHaveValue(value: string): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'value', expected: value }, element);
      },
      
      async toHaveAttribute(name: string, value: string): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'attribute', name, value }, element);
      },
      
      async toBeFocused(): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'focused', expected: true }, element);
      },
      
      async toMatchSnapshot(name: string): Promise<AssertionResult> {
        return await this.runAssertion({ type: 'matches-snapshot', expected: name }, element);
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