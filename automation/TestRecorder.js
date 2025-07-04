const { globalShortcut } = require('electron');
const robot = require('robotjs');

class TestRecorder {
  constructor(automationClient) {
    this.automationClient = automationClient;
    this.isRecording = false;
    this.recordedActions = [];
    this.lastElement = null;
    this.mouseHook = null;
    this.keyboardHook = null;
  }

  async startRecording() {
    this.isRecording = true;
    this.recordedActions = [];
    
    // Start mouse and keyboard hooks
    this.startMouseHook();
    this.startKeyboardHook();
    
    // Register global shortcut for stopping
    globalShortcut.register('CommandOrControl+Shift+R', () => {
      this.stopRecording();
    });
    
    return { status: 'recording' };
  }

  async stopRecording() {
    this.isRecording = false;
    
    // Unregister shortcuts
    globalShortcut.unregisterAll();
    
    // Stop hooks
    this.stopMouseHook();
    this.stopKeyboardHook();
    
    return this.recordedActions;
  }

  startMouseHook() {
    // Using iohook or similar library for global mouse events
    const ioHook = require('iohook');
    
    ioHook.on('mouseclick', async (event) => {
      if (!this.isRecording) return;
      
      try {
        const element = await this.automationClient.inspectElement({
          x: event.x,
          y: event.y
        });
        
        if (element) {
          const action = {
            type: 'click',
            selector: this.generateSelector(element),
            element: element,
            timestamp: Date.now(),
            position: { x: event.x, y: event.y }
          };
          
          this.recordedActions.push(action);
          this.lastElement = element;
        }
      } catch (error) {
        console.error('Error recording click:', error);
      }
    });
    
    ioHook.on('mousedrag', async (event) => {
      if (!this.isRecording) return;
      
      const action = {
        type: 'drag',
        from: { x: event.x, y: event.y },
        to: null, // Will be set on drag end
        timestamp: Date.now()
      };
      
      this.recordedActions.push(action);
    });
    
    ioHook.on('mousewheel', async (event) => {
      if (!this.isRecording) return;
      
      const action = {
        type: 'scroll',
        direction: event.direction,
        amount: event.rotation,
        position: { x: event.x, y: event.y },
        timestamp: Date.now()
      };
      
      this.recordedActions.push(action);
    });
    
    ioHook.start();
    this.mouseHook = ioHook;
  }

  stopMouseHook() {
    if (this.mouseHook) {
      this.mouseHook.stop();
      this.mouseHook = null;
    }
  }

  startKeyboardHook() {
    const ioHook = require('iohook');
    
    let currentText = '';
    let typingElement = null;
    
    ioHook.on('keydown', async (event) => {
      if (!this.isRecording) return;
      
      // Check if it's a printable character
      if (event.keychar && event.keychar > 31) {
        if (!typingElement || typingElement !== this.lastElement) {
          // Start new typing action
          if (currentText && typingElement) {
            // Save previous typing action
            this.recordedActions.push({
              type: 'type',
              selector: this.generateSelector(typingElement),
              text: currentText,
              element: typingElement,
              timestamp: Date.now()
            });
          }
          
          typingElement = this.lastElement;
          currentText = String.fromCharCode(event.keychar);
        } else {
          currentText += String.fromCharCode(event.keychar);
        }
      } else if (event.keycode === 28) { // Enter key
        if (currentText && typingElement) {
          this.recordedActions.push({
            type: 'type',
            selector: this.generateSelector(typingElement),
            text: currentText,
            element: typingElement,
            timestamp: Date.now()
          });
          
          currentText = '';
          typingElement = null;
        }
        
        this.recordedActions.push({
          type: 'keypress',
          key: 'Enter',
          timestamp: Date.now()
        });
      } else if (event.keycode === 14) { // Backspace
        if (currentText.length > 0) {
          currentText = currentText.slice(0, -1);
        }
      }
    });
    
    this.keyboardHook = ioHook;
  }

  stopKeyboardHook() {
    if (this.keyboardHook) {
      this.keyboardHook.stop();
      this.keyboardHook = null;
    }
  }

  generateSelector(element) {
    // Generate a robust selector for the element
    const selectors = [];
    
    if (element.automationId) {
      selectors.push({
        type: 'automationId',
        value: element.automationId,
        priority: 1
      });
    }
    
    if (element.name) {
      selectors.push({
        type: 'name',
        value: element.name,
        priority: 2
      });
    }
    
    if (element.className) {
      selectors.push({
        type: 'className',
        value: element.className,
        priority: 3
      });
    }
    
    // Add xpath-like selector based on control type and index
    if (element.controlType) {
      selectors.push({
        type: 'controlType',
        value: element.controlType,
        priority: 4
      });
    }
    
    return {
      selectors: selectors.sort((a, b) => a.priority - b.priority),
      bounds: element.bounds
    };
  }

  async generateTestScript(actions) {
    const yaml = require('js-yaml');
    
    const testSteps = actions.map((action, index) => {
      const step = {
        step: index + 1,
        action: action.type,
        timestamp: action.timestamp
      };
      
      switch (action.type) {
        case 'click':
          step.selector = action.selector;
          step.position = action.position;
          break;
        case 'type':
          step.selector = action.selector;
          step.text = action.text;
          break;
        case 'keypress':
          step.key = action.key;
          break;
        case 'scroll':
          step.direction = action.direction;
          step.amount = action.amount;
          step.position = action.position;
          break;
        case 'drag':
          step.from = action.from;
          step.to = action.to;
          break;
      }
      
      return step;
    });
    
    const testData = {
      name: 'Recorded Test',
      description: 'Automatically recorded test',
      createdAt: new Date().toISOString(),
      steps: testSteps
    };
    
    return yaml.dump(testData);
  }
}

module.exports = { TestRecorder };