import { UIAutomationClient } from './UIAutomationClient';
import type { RecordingEvent, RecordedAction, UIAutomationElement, MousePosition } from '../types';

export class TestRecorder {
  private isRecordingFlag = false;
  private recordedEvents: RecordingEvent[] = [];

  constructor(_automationClient: UIAutomationClient) {
    // Store reference for future use
  }

  /**
   * 録画を開始する
   */
  async startRecording(): Promise<void> {
    if (this.isRecordingFlag) {
      throw new Error('Recording is already in progress');
    }

    this.isRecordingFlag = true;
    this.recordedEvents = [];
    
    console.log('Test recording started');
  }

  /**
   * 録画を停止する
   */
  async stopRecording(): Promise<RecordingEvent[]> {
    if (!this.isRecordingFlag) {
      throw new Error('No recording in progress');
    }

    this.isRecordingFlag = false;
    
    console.log(`Test recording stopped. Recorded ${this.recordedEvents.length} events`);
    return [...this.recordedEvents];
  }

  /**
   * 録画状態を取得する
   */
  isRecordingActive(): boolean {
    return this.isRecordingFlag;
  }

  /**
   * クリック操作を記録する
   */
  async recordClick(element: any, coordinates?: MousePosition): Promise<void> {
    const action: RecordedAction = {
      type: 'click',
      timestamp: Date.now(),
      element,
      coordinates: coordinates ? { x: coordinates.x, y: coordinates.y } : undefined
    };

    this.recordEvent({
      type: 'click',
      timestamp: action.timestamp,
      element: this.convertToUIAutomationElement(element),
      coordinates: coordinates ? { x: coordinates.x, y: coordinates.y } : undefined
    });
  }

  /**
   * テキスト入力操作を記録する
   */
  async recordType(element: any, text: string): Promise<void> {
    if (!this.isRecordingFlag) return;

    const action: RecordedAction = {
      type: 'type',
      timestamp: Date.now(),
      element,
      value: text
    };

    this.recordEvent({
      type: 'type',
      timestamp: action.timestamp,
      element: this.convertToUIAutomationElement(element),
      value: text
    });
  }

  /**
   * ホバー操作を記録する
   */
  async recordHover(element: any, coordinates?: MousePosition): Promise<void> {
    const action: RecordedAction = {
      type: 'hover',
      timestamp: Date.now(),
      element,
      coordinates: coordinates ? { x: coordinates.x, y: coordinates.y } : undefined
    };

    this.recordEvent({
      type: 'hover',
      timestamp: action.timestamp,
      element: this.convertToUIAutomationElement(element),
      coordinates: coordinates ? { x: coordinates.x, y: coordinates.y } : undefined
    });
  }

  /**
   * キープレス操作を記録する
   */
  async recordKeyPress(key: string): Promise<void> {
    if (!this.isRecordingFlag) return;

    const action: RecordedAction = {
      type: 'keypress',
      timestamp: Date.now(),
      element: null,
      key
    };

    this.recordEvent({
      type: 'keypress',
      timestamp: action.timestamp,
      element: undefined,
      value: key
    });
  }

  /**
   * ドラッグ操作を記録する
   */
  async recordDrag(from: MousePosition, _to: MousePosition): Promise<void> {
    if (!this.isRecordingFlag) return;

    const action: RecordedAction = {
      type: 'drag',
      timestamp: Date.now(),
      element: null,
      coordinates: { x: from.x, y: from.y }
    };

    this.recordEvent({
      type: 'scroll',
      timestamp: action.timestamp,
      element: undefined,
      value: undefined,
      coordinates: { x: from.x, y: from.y },
      key: undefined
    });
  }

  /**
   * スクロール操作を記録する
   */
  async recordScroll(direction: 'up' | 'down' | 'left' | 'right', amount: number): Promise<void> {
    if (!this.isRecordingFlag) return;

    const action: RecordedAction = {
      type: 'scroll',
      timestamp: Date.now(),
      element: null,
      value: `${direction}:${amount}`
    };

    this.recordEvent({
      type: 'scroll',
      timestamp: action.timestamp,
      element: undefined,
      value: `${direction}:${amount}`,
      coordinates: undefined,
      key: undefined
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
   * 記録されたアクションを取得する
   */
  getRecordedActions(): RecordedAction[] {
    return this.recordedEvents.map(event => ({
      type: event.type,
      timestamp: event.timestamp,
      element: event.element || undefined,
      coordinates: event.coordinates || undefined,
      value: event.value || undefined,
      key: event.key || undefined
    }));
  }

  /**
   * 記録されたアクションをクリアする
   */
  clearRecordedActions(): void {
    this.recordedEvents = [];
  }

  /**
   * 録画時間を取得する
   */
  getRecordingDuration(): number {
    if (this.recordedEvents.length === 0) return 0;
    const lastEvent = this.recordedEvents[this.recordedEvents.length - 1];
    const firstEvent = this.recordedEvents[0];
    if (!lastEvent || !firstEvent) return 0;
    return lastEvent.timestamp - firstEvent.timestamp;
  }

  /**
   * 録画イベントを生成する
   */
  generateRecordingEvents(): RecordingEvent[] {
    return [...this.recordedEvents];
  }

  /**
   * 録画データをエクスポートする
   */
  exportRecording(format: 'json' | 'yaml' | 'xml' = 'json'): string {
    const data = {
      metadata: {
        recordedAt: new Date().toISOString(),
        duration: this.getRecordingDuration(),
        actionCount: this.recordedEvents.length
      },
      actions: this.getRecordedActions()
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
    if (!this.isRecordingFlag) return;

    // Ensure all optional properties are properly handled
    const eventToRecord: RecordingEvent = {
      type: event.type,
      timestamp: event.timestamp,
      element: event.element || undefined,
      value: event.value || undefined,
      coordinates: event.coordinates || undefined,
      key: event.key || undefined
    };

    this.recordedEvents.push(eventToRecord);
  }
} 