class AssertionEngine {
  constructor(automationClient) {
    this.automationClient = automationClient;
    this.assertions = new Map();
    this.registerBuiltInAssertions();
  }

  registerBuiltInAssertions() {
    // Visibility assertions
    this.register('visible', async (element, expected = true) => {
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
    this.register('text', async (element, expected) => {
      const actual = await this.automationClient.getText(element);
      const passed = actual === expected;
      
      return {
        passed,
        actual,
        expected,
        message: `Expected text to be "${expected}", but got "${actual}"`
      };
    });

    this.register('contains-text', async (element, expected) => {
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
    this.register('enabled', async (element, expected = true) => {
      const props = await this.automationClient.getElementProperties(element);
      const isEnabled = props && props.isEnabled;
      
      return {
        passed: isEnabled === expected,
        actual: isEnabled,
        expected,
        message: `Element ${expected ? 'should be' : 'should not be'} enabled`
      };
    });

    this.register('checked', async (element, expected = true) => {
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
    this.register('value', async (element, expected) => {
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
    this.register('attribute', async (element, { name, value }) => {
      const props = await this.automationClient.getElementProperties(element);
      const actual = props[name];
      const passed = actual === value;
      
      return {
        passed,
        actual,
        expected: value,
        message: `Expected ${name} to be "${value}", but got "${actual}"`
      };
    });

    // Count assertions
    this.register('count', async (selector, expected) => {
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
    this.register('focused', async (element, expected = true) => {
      const hasFocus = await this.automationClient.hasFocus(element);
      
      return {
        passed: hasFocus === expected,
        actual: hasFocus,
        expected,
        message: `Element ${expected ? 'should have' : 'should not have'} focus`
      };
    });

    // Custom assertions
    this.register('matches-snapshot', async (element, snapshotName) => {
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

  register(name, handler) {
    this.assertions.set(name, handler);
  }

  async runAssertion(assertion, element) {
    const { type, ...params } = assertion;
    
    if (!this.assertions.has(type)) {
      return {
        passed: false,
        message: `Unknown assertion type: ${type}`
      };
    }
    
    try {
      const handler = this.assertions.get(type);
      const result = await handler(element, params.expected || params);
      
      return {
        type,
        ...result,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        passed: false,
        type,
        error: error.message,
        stack: error.stack,
        timestamp: Date.now()
      };
    }
  }

  async runMultipleAssertions(assertions, element) {
    const results = [];
    
    for (const assertion of assertions) {
      const result = await this.runAssertion(assertion, element);
      results.push(result);
      
      if (!result.passed && assertion.stopOnFailure) {
        break;
      }
    }
    
    return {
      passed: results.every(r => r.passed),
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length
      }
    };
  }

  // Snapshot management
  async loadSnapshot(name) {
    const fs = require('fs').promises;
    const path = require('path');
    const snapshotPath = path.join('__snapshots__', `${name}.png`);
    
    try {
      const data = await fs.readFile(snapshotPath);
      return data.toString('base64');
    } catch (error) {
      return null;
    }
  }

  async saveSnapshot(name, data) {
    const fs = require('fs').promises;
    const path = require('path');
    const snapshotDir = '__snapshots__';
    const snapshotPath = path.join(snapshotDir, `${name}.png`);
    
    await fs.mkdir(snapshotDir, { recursive: true });
    await fs.writeFile(snapshotPath, Buffer.from(data, 'base64'));
  }

  async compareImages(image1, image2) {
    // Simple comparison - in production, use proper image comparison library
    return image1 === image2;
  }

  // Expectation builder for fluent API
  expect(element) {
    const self = this;
    
    return {
      async toBeVisible() {
        return await self.runAssertion({ type: 'visible', expected: true }, element);
      },
      
      async toBeHidden() {
        return await self.runAssertion({ type: 'visible', expected: false }, element);
      },
      
      async toHaveText(text) {
        return await self.runAssertion({ type: 'text', expected: text }, element);
      },
      
      async toContainText(text) {
        return await self.runAssertion({ type: 'contains-text', expected: text }, element);
      },
      
      async toBeEnabled() {
        return await self.runAssertion({ type: 'enabled', expected: true }, element);
      },
      
      async toBeDisabled() {
        return await self.runAssertion({ type: 'enabled', expected: false }, element);
      },
      
      async toBeChecked() {
        return await self.runAssertion({ type: 'checked', expected: true }, element);
      },
      
      async toHaveValue(value) {
        return await self.runAssertion({ type: 'value', expected: value }, element);
      },
      
      async toHaveAttribute(name, value) {
        return await self.runAssertion({ type: 'attribute', name, value }, element);
      },
      
      async toBeFocused() {
        return await self.runAssertion({ type: 'focused', expected: true }, element);
      },
      
      async toMatchSnapshot(name) {
        return await self.runAssertion({ type: 'matches-snapshot', snapshotName: name }, element);
      }
    };
  }
}

module.exports = { AssertionEngine };