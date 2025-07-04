import { globalShortcut } from 'electron';
import * as robot from 'robotjs';
import * as ioHook from 'iohook';
import { UIAutomationClient } from './UIAutomationClient';
import type { RecordingEvent, UIAutomationElement } from '../types';

interface RecordedAction {
  type: 'click' | 'drag' | 'scroll' | 'type' | 'keypress';
  selector?: string;
  element?: UIAutomationElement;
  timestamp: number;
  position?: { x: number; y: number };
  text?: string;
  key?: string;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  direction?: number;
  amount?: number;
}

interface ElementSelector {
  type: 'automationId' | 'name' | 'className' | 'controlType' | 'xpath';
  value: string;
  priority: number;
}

interface MouseEvent {
  x: number;
  y: number;
  button?: number;
  clicks?: number;
}

interface KeyboardEvent {
  keycode: number;
  keychar?: number;
  type: 'keydown' | 'keyup';
}

interface MouseWheelEvent {
  x: number;
  y: number;
  direction: number;
  rotation: number;
}

export class TestRecorder {
  private automationClient: UIAutomationClient;
  private isRecording: boolean = false;
  private recordedActions: RecordedAction[] = [];
  private lastElement: UIAutomationElement | null = null;
  private mouseHook: any = null;
  private keyboardHook: any = null;
  private currentText: string = '';
  private typingElement: UIAutomationElement | null = null;

  constructor(automationClient: UIAutomationClient) {
    this.automationClient = automationClient;
  }

  async startRecording(): Promise<{ status: string }> {
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

  async stopRecording(): Promise<RecordingEvent[]> {
    this.isRecording = false;
    
    // Unregister shortcuts
    globalShortcut.unregisterAll();
    
    // Stop hooks
    this.stopMouseHook();
    this.stopKeyboardHook();
    
    // Convert recorded actions to RecordingEvent format
    return this.convertToRecordingEvents();
  }

  isRecording(): boolean {
    return this.isRecording;
  }

  private startMouseHook(): void {
    ioHook.on('mouseclick', async (event: MouseEvent) => {
      if (!this.isRecording) return;
      
      try {
        const element = await this.automationClient.inspectElement({
          x: event.x,
          y: event.y
        });
        
        if (element) {
          const action: RecordedAction = {
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
    
    ioHook.on('mousedrag', async (event: MouseEvent) => {
      if (!this.isRecording) return;
      
      const action: RecordedAction = {
        type: 'drag',
        from: { x: event.x, y: event.y },
        to: undefined, // Will be set on drag end
        timestamp: Date.now()
      };
      
      this.recordedActions.push(action);
    });
    
    ioHook.on('mousewheel', async (event: MouseWheelEvent) => {
      if (!this.isRecording) return;
      
      const action: RecordedAction = {
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

  private stopMouseHook(): void {
    if (this.mouseHook) {
      this.mouseHook.stop();
      this.mouseHook = null;
    }
  }

  private startKeyboardHook(): void {
    ioHook.on('keydown', async (event: KeyboardEvent) => {
      if (!this.isRecording) return;
      
      // Check if it's a printable character
      if (event.keychar && event.keychar > 31) {
        if (!this.typingElement || this.typingElement !== this.lastElement) {
          // Start new typing action
          if (this.currentText && this.typingElement) {
            // Save previous typing action
            this.recordedActions.push({
              type: 'type',
              selector: this.generateSelector(this.typingElement),
              text: this.currentText,
              element: this.typingElement,
              timestamp: Date.now()
            });
          }
          
          this.typingElement = this.lastElement;
          this.currentText = String.fromCharCode(event.keychar);
        } else {
          this.currentText += String.fromCharCode(event.keychar);
        }
      } else if (event.keycode === 28) { // Enter key
        if (this.currentText && this.typingElement) {
          this.recordedActions.push({
            type: 'type',
            selector: this.generateSelector(this.typingElement),
            text: this.currentText,
            element: this.typingElement,
            timestamp: Date.now()
          });
          
          this.currentText = '';
          this.typingElement = null;
        }
        
        this.recordedActions.push({
          type: 'keypress',
          key: 'Enter',
          timestamp: Date.now()
        });
      } else if (event.keycode === 14) { // Backspace
        if (this.currentText.length > 0) {
          this.currentText = this.currentText.slice(0, -1);
        }
      }
    });
    
    this.keyboardHook = ioHook;
  }

  private stopKeyboardHook(): void {
    if (this.keyboardHook) {
      this.keyboardHook.stop();
      this.keyboardHook = null;
    }
  }

  private generateSelector(element: UIAutomationElement): string {
    // Generate a robust selector for the element
    const selectors: ElementSelector[] = [];
    
    if (element.id) {
      selectors.push({
        type: 'automationId',
        value: element.id,
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
    
    if (element.controlType) {
      selectors.push({
        type: 'controlType',
        value: element.controlType,
        priority: 4
      });
    }
    
    // Sort by priority and return the best selector
    selectors.sort((a, b) => a.priority - b.priority);
    
    if (selectors.length > 0) {
      const bestSelector = selectors[0];
      return `${bestSelector.type}="${bestSelector.value}"`;
    }
    
    // Fallback to XPath if no good selector found
    return this.generateXPath(element);
  }

  private generateXPath(element: UIAutomationElement): string {
    // Generate XPath selector as fallback
    if (element.name) {
      return `//*[@Name="${element.name}"]`;
    }
    
    if (element.className) {
      return `//*[@ClassName="${element.className}"]`;
    }
    
    return '//*'; // Generic fallback
  }

  private convertToRecordingEvents(): RecordingEvent[] {
    return this.recordedActions.map(action => {
      const event: RecordingEvent = {
        type: action.type as 'click' | 'type' | 'hover' | 'keypress' | 'scroll',
        timestamp: action.timestamp,
        element: action.element || undefined,
        value: action.text || undefined,
        coordinates: action.position || undefined,
        key: action.key || undefined
      };
      
      return event;
    });
  }

  async generateTestScript(actions: RecordedAction[]): Promise<string> {
    let script = '// Generated test script\n\n';
    script += 'const { test, expect } = require("@playwright/test");\n\n';
    script += 'test("Recorded test", async ({ page }) => {\n';
    
    for (const action of actions) {
      switch (action.type) {
        case 'click':
          if (action.selector) {
            script += `  await page.click('${action.selector}');\n`;
          }
          break;
        case 'type':
          if (action.selector && action.text) {
            script += `  await page.fill('${action.selector}', '${action.text}');\n`;
          }
          break;
        case 'keypress':
          if (action.key) {
            script += `  await page.keyboard.press('${action.key}');\n`;
          }
          break;
        case 'scroll':
          script += `  await page.mouse.wheel(0, ${action.amount || 100});\n`;
          break;
      }
    }
    
    script += '});\n';
    return script;
  }

  getRecordedActions(): RecordedAction[] {
    return [...this.recordedActions];
  }

  clearRecordedActions(): void {
    this.recordedActions = [];
  }

  addManualAction(action: RecordedAction): void {
    this.recordedActions.push(action);
  }
} 