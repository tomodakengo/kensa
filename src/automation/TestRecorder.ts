import { UIAutomationClient } from './UIAutomationClient';
import type { UIAutomationElement, RecordingEvent, MousePosition, RecordedAction } from '../types';

interface ElementSelector {
  type: 'id' | 'name' | 'className' | 'xpath';
  value: string;
  priority: number;
}

export class TestRecorder {
  private automationClient: UIAutomationClient;
  private isRecording: boolean = false;
  private recordedActions: RecordedAction[] = [];
  private recordedEvents: RecordingEvent[] = [];
  private recordingStartTime: number = 0;

  constructor(automationClient: UIAutomationClient) {
    this.automationClient = automationClient;
  }

  /**
   * 録画を開始する
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    this.isRecording = true;
    this.recordedActions = [];
    this.recordedEvents = [];
    this.recordingStartTime = Date.now();
    
    console.log('Test recording started');
  }

  /**
   * 録画を停止する
   */
  async stopRecording(): Promise<RecordingEvent[]> {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    this.isRecording = false;
    const actions = [...this.recordedActions];
    this.recordedActions = [];
    
    console.log(`Test recording stopped. Recorded ${actions.length} actions`);
    return [...this.recordedEvents];
  }

  /**
   * 録画状態を取得する
   */
  isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * クリック操作を記録する
   */
  async recordClick(element: any, coordinates?: MousePosition): Promise<void> {
    if (!this.isRecording) return;

    const action: RecordedAction = {
      type: 'click',
      timestamp: Date.now() - this.recordingStartTime,
      element,
      coordinates
    };

    this.recordedActions.push(action);
    this.recordEvent({
      type: 'click',
      timestamp: Date.now(),
      element: element,
      coordinates
    });
  }

  /**
   * テキスト入力操作を記録する
   */
  async recordType(element: any, text: string): Promise<void> {
    if (!this.isRecording) return;

    const action: RecordedAction = {
      type: 'type',
      timestamp: Date.now() - this.recordingStartTime,
      element,
      value: text
    };

    this.recordedActions.push(action);
    this.recordEvent({
      type: 'type',
      timestamp: Date.now(),
      element: element,
      value: text
    });
  }

  /**
   * ホバー操作を記録する
   */
  async recordHover(element: any, coordinates?: MousePosition): Promise<void> {
    if (!this.isRecording) return;

    const action: RecordedAction = {
      type: 'hover',
      timestamp: Date.now() - this.recordingStartTime,
      element,
      coordinates
    };

    this.recordedActions.push(action);
    this.recordEvent({
      type: 'hover',
      timestamp: Date.now(),
      element: element,
      coordinates
    });
  }

  /**
   * キープレス操作を記録する
   */
  async recordKeyPress(key: string): Promise<void> {
    if (!this.isRecording) return;

    const action: RecordedAction = {
      type: 'keypress',
      timestamp: Date.now() - this.recordingStartTime,
      key
    };

    this.recordedActions.push(action);
    this.recordEvent({
      type: 'keypress',
      timestamp: Date.now(),
      key
    });
  }

  /**
   * ドラッグ操作を記録する
   */
  async recordDrag(from: MousePosition, to: MousePosition): Promise<void> {
    if (!this.isRecording) return;

    const action: RecordedAction = {
      type: 'drag',
      timestamp: Date.now() - this.recordingStartTime,
      from,
      to
    };

    this.recordedActions.push(action);
  }

  /**
   * スクロール操作を記録する
   */
  async recordScroll(direction: 'up' | 'down' | 'left' | 'right', amount: number): Promise<void> {
    if (!this.isRecording) return;

    const action: RecordedAction = {
      type: 'scroll',
      timestamp: Date.now() - this.recordingStartTime,
      value: `${direction}:${amount}`
    };

    this.recordedActions.push(action);
    this.recordEvent({
      type: 'scroll',
      timestamp: Date.now(),
      value: `${direction}:${amount}`
    });
  }

  /**
   * 要素をUIAutomationElementに変換する
   */
  private convertToUIAutomationElement(element: any): UIAutomationElement {
    if (!element) {
      return {
        id: '',
        name: '',
        className: '',
        controlType: '',
        isEnabled: false,
        isVisible: false,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        properties: {}
      };
    }

    return {
      id: element.automationId || '',
      name: element.name || '',
      className: element.className || '',
      controlType: element.controlType || '',
      isEnabled: element.isEnabled || false,
      isVisible: element.isVisible || false,
      bounds: element.bounds || { x: 0, y: 0, width: 0, height: 0 },
      properties: element.properties || {}
    };
  }

  /**
   * 要素のセレクターを生成する
   */
  private generateSelector(element: any): string {
    if (!element) return '';

    const selectors: ElementSelector[] = [];

    // AutomationIdが最優先
    if (element.automationId) {
      selectors.push({
        type: 'id',
        value: element.automationId,
        priority: 1
      });
    }

    // Name属性
    if (element.name) {
      selectors.push({
        type: 'name',
        value: element.name,
        priority: 2
      });
    }

    // ClassName
    if (element.className) {
      selectors.push({
        type: 'className',
        value: element.className,
        priority: 3
      });
    }

    // 優先度順にソート
    selectors.sort((a, b) => a.priority - b.priority);

    // 最適なセレクターを選択
    const bestSelector = selectors[0];
    if (!bestSelector) {
      return '';
    }

    return `${bestSelector.type}="${bestSelector.value}"`;
  }

  /**
   * 記録されたアクションを取得する
   */
  getRecordedActions(): RecordedAction[] {
    return [...this.recordedActions];
  }

  /**
   * 記録されたアクションをクリアする
   */
  clearRecordedActions(): void {
    this.recordedActions = [];
  }

  /**
   * 録画時間を取得する
   */
  getRecordingDuration(): number {
    if (!this.recordingStartTime) return 0;
    return Date.now() - this.recordingStartTime;
  }

  /**
   * 録画イベントを生成する
   */
  generateRecordingEvents(): RecordingEvent[] {
    return this.recordedActions.map(action => {
      const event: RecordingEvent = {
        type: action.type as 'click' | 'type' | 'hover' | 'keypress' | 'scroll',
        timestamp: action.timestamp,
        element: action.element,
        value: action.value,
        coordinates: action.coordinates,
        key: action.key
      };
      return event;
    });
  }

  /**
   * 録画データをエクスポートする
   */
  exportRecording(format: 'json' | 'yaml' | 'xml' = 'json'): string {
    const data = {
      metadata: {
        recordedAt: new Date().toISOString(),
        duration: this.getRecordingDuration(),
        actionCount: this.recordedActions.length
      },
      actions: this.recordedActions
    };

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'yaml':
        // YAML形式でのエクスポート（js-yamlが必要）
        return JSON.stringify(data, null, 2); // 簡易版
      case 'xml':
        // XML形式でのエクスポート（xml2jsが必要）
        return JSON.stringify(data, null, 2); // 簡易版
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private recordEvent(event: RecordingEvent): void {
    if (this.isRecording) {
      // Ensure element is properly set or undefined
      const validatedEvent: RecordingEvent = {
        type: event.type,
        timestamp: event.timestamp,
        element: event.element || undefined,
        value: event.value,
        coordinates: event.coordinates,
        key: event.key
      };

      this.recordedEvents.push(validatedEvent);
    }
  }
} 