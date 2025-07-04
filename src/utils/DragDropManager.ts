export interface DragData {
  type: string;
  data: any;
  sourceId?: string;
  sourceIndex?: number;
  preview?: string | HTMLElement;
}

export interface DropZone {
  id: string;
  element: HTMLElement;
  acceptedTypes: string[];
  onDrop: (data: DragData, dropZone: DropZone) => void;
  onDragOver?: (data: DragData, dropZone: DropZone) => boolean;
  onDragEnter?: (data: DragData, dropZone: DropZone) => void;
  onDragLeave?: (data: DragData, dropZone: DropZone) => void;
  highlightClass?: string;
  disabled?: boolean;
}

export interface DragSource {
  id: string;
  element: HTMLElement;
  data: DragData;
  onDragStart?: (data: DragData, source: DragSource) => void;
  onDragEnd?: (data: DragData, source: DragSource, success: boolean) => void;
  dragHandle?: HTMLElement;
  disabled?: boolean;
}

export interface DragDropOptions {
  enableFileDrops?: boolean;
  enableTextDrops?: boolean;
  ghostImageScale?: number;
  snapToGrid?: boolean;
  gridSize?: number;
  autoScrollSpeed?: number;
  autoScrollThreshold?: number;
}

export class DragDropManager {
  private dragSources: Map<string, DragSource> = new Map();
  private dropZones: Map<string, DropZone> = new Map();
  private currentDragData: DragData | null = null;
  // private dragStartPos: { x: number; y: number } | null = null;
  private dragGhost: HTMLElement | null = null;
  private activeDropZone: DropZone | null = null;
  private autoScrollTimer: number | null = null;
  private options: DragDropOptions = {
    enableFileDrops: true,
    enableTextDrops: true,
    ghostImageScale: 0.8,
    snapToGrid: false,
    gridSize: 10,
    autoScrollSpeed: 5,
    autoScrollThreshold: 50
  };

  constructor(options: Partial<DragDropOptions> = {}) {
    this.options = { ...this.options, ...options };
    this.initializeGlobalListeners();
  }

  /**
   * グローバルイベントリスナーを初期化
   */
  private initializeGlobalListeners(): void {
    // ページ全体でのファイルドロップを防ぐ
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      
      // ファイルドロップの処理
      if (this.options.enableFileDrops && e.dataTransfer?.files?.length) {
        this.handleFileDrop(e);
      }
    });

    // ドラッグ操作全般の処理
    document.addEventListener('dragstart', (e) => {
      this.handleDragStart(e);
    });

    document.addEventListener('dragend', (e) => {
      this.handleDragEnd(e);
    });

    document.addEventListener('dragover', (e) => {
      this.handleDragOver(e);
    });

    document.addEventListener('dragenter', (e) => {
      this.handleDragEnter(e);
    });

    document.addEventListener('dragleave', (e) => {
      this.handleDragLeave(e);
    });

    document.addEventListener('drop', (e) => {
      this.handleDrop(e);
    });

    // マウス移動でのオートスクロール
    document.addEventListener('dragover', (e) => {
      this.handleAutoScroll(e);
    });
  }

  /**
   * ドラッグソースを登録
   */
  registerDragSource(source: DragSource): void {
    this.dragSources.set(source.id, source);
    
    const element = source.dragHandle || source.element;
    element.draggable = true;
    element.dataset['dragSourceId'] = source.id;
    
    // ドラッグ開始のビジュアルフィードバック
    element.addEventListener('mousedown', () => {
      if (!source.disabled) {
        element.classList.add('drag-ready');
      }
    });

    element.addEventListener('mouseup', () => {
      element.classList.remove('drag-ready');
    });

    element.addEventListener('mouseleave', () => {
      element.classList.remove('drag-ready');
    });
  }

  /**
   * ドラッグソースを削除
   */
  unregisterDragSource(sourceId: string): void {
    const source = this.dragSources.get(sourceId);
    if (source) {
      const element = source.dragHandle || source.element;
      element.draggable = false;
      delete element.dataset['dragSourceId'];
      element.classList.remove('drag-ready', 'dragging');
      
      this.dragSources.delete(sourceId);
    }
  }

  /**
   * ドロップゾーンを登録
   */
  registerDropZone(zone: DropZone): void {
    this.dropZones.set(zone.id, zone);
    zone.element.dataset['dropZoneId'] = zone.id;
    
    // ドロップゾーンのビジュアル準備
    if (!zone.disabled) {
      zone.element.classList.add('drop-zone');
    }
  }

  /**
   * ドロップゾーンを削除
   */
  unregisterDropZone(zoneId: string): void {
    const zone = this.dropZones.get(zoneId);
    if (zone) {
      delete zone.element.dataset['dropZoneId'];
      zone.element.classList.remove('drop-zone', 'drag-over', 'drag-active');
      
      this.dropZones.delete(zoneId);
    }
  }

  /**
   * ドラッグ開始処理
   */
  private handleDragStart(event: DragEvent): void {
    const element = event.target as HTMLElement;
    const sourceId = element.dataset['dragSourceId'];
    
    if (!sourceId) return;
    
    const source = this.dragSources.get(sourceId);
    if (!source || source.disabled) {
      event.preventDefault();
      return;
    }

    this.currentDragData = source.data;
    // this.dragStartPos = { x: event.clientX, y: event.clientY };
    
    // ドラッグゴーストを設定
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'all';
      event.dataTransfer.setData('text/plain', JSON.stringify(source.data));
      
      // カスタムドラッグイメージ
      if (source.data.preview) {
        this.createDragGhost(source.data.preview, event.clientX, event.clientY);
      }
    }

    // ビジュアルフィードバック
    element.classList.add('dragging');
    document.body.classList.add('dragging-active');
    
    // すべてのドロップゾーンをアクティブにする
    this.activateCompatibleDropZones(source.data);
    
    // コールバック実行
    source.onDragStart?.(source.data, source);
  }

  /**
   * ドラッグ終了処理
   */
  private handleDragEnd(event: DragEvent): void {
    const element = event.target as HTMLElement;
    const sourceId = element.dataset['dragSourceId'];
    
    if (sourceId) {
      const source = this.dragSources.get(sourceId);
      
      // ビジュアルフィードバックをクリア
      element.classList.remove('dragging', 'drag-ready');
      document.body.classList.remove('dragging-active');
      
      // ドロップゾーンを非アクティブにする
      this.deactivateAllDropZones();
      
      // ドラッグゴーストを削除
      this.removeDragGhost();
      
      // オートスクロールを停止
      this.stopAutoScroll();
      
      // コールバック実行
      const success = this.activeDropZone !== null;
      source?.onDragEnd?.(this.currentDragData!, source, success);
    }

    this.currentDragData = null;
    // this.dragStartPos = null;
    this.activeDropZone = null;
  }

  /**
   * ドラッグオーバー処理
   */
  private handleDragOver(event: DragEvent): void {
    if (!this.currentDragData) return;
    
    const element = event.target as HTMLElement;
    const dropZone = this.findDropZone(element);
    
    if (dropZone && this.isCompatible(this.currentDragData, dropZone)) {
      event.preventDefault();
      
      const canDrop = dropZone.onDragOver?.(this.currentDragData, dropZone) ?? true;
      if (canDrop) {
        event.dataTransfer!.dropEffect = 'move';
      } else {
        event.dataTransfer!.dropEffect = 'none';
      }
    }
  }

  /**
   * ドラッグエンター処理
   */
  private handleDragEnter(event: DragEvent): void {
    if (!this.currentDragData) return;
    
    const element = event.target as HTMLElement;
    const dropZone = this.findDropZone(element);
    
    if (dropZone && this.isCompatible(this.currentDragData, dropZone)) {
      // 前のドロップゾーンからの離脱
      if (this.activeDropZone && this.activeDropZone !== dropZone) {
        this.activeDropZone.element.classList.remove('drag-over');
        this.activeDropZone.onDragLeave?.(this.currentDragData, this.activeDropZone);
      }
      
      this.activeDropZone = dropZone;
      dropZone.element.classList.add('drag-over');
      dropZone.onDragEnter?.(this.currentDragData, dropZone);
    }
  }

  /**
   * ドラッグリーブ処理
   */
  private handleDragLeave(event: DragEvent): void {
    if (!this.currentDragData || !this.activeDropZone) return;
    
    const element = event.target as HTMLElement;
    const dropZone = this.findDropZone(element);
    
    // ドロップゾーンから本当に離れたかチェック
    if (dropZone === this.activeDropZone && !this.isChildOfDropZone(event.relatedTarget as HTMLElement, dropZone)) {
      dropZone.element.classList.remove('drag-over');
      dropZone.onDragLeave?.(this.currentDragData, dropZone);
      this.activeDropZone = null;
    }
  }

  /**
   * ドロップ処理
   */
  private handleDrop(event: DragEvent): void {
    event.preventDefault();
    
    if (!this.currentDragData) return;
    
    const element = event.target as HTMLElement;
    const dropZone = this.findDropZone(element);
    
    if (dropZone && this.isCompatible(this.currentDragData, dropZone)) {
      // ドロップ実行
      dropZone.onDrop(this.currentDragData, dropZone);
      
      // ビジュアルフィードバック
      dropZone.element.classList.remove('drag-over');
      dropZone.element.classList.add('drop-success');
      
      setTimeout(() => {
        dropZone.element.classList.remove('drop-success');
      }, 500);
    }
  }

  /**
   * ファイルドロップ処理
   */
  private handleFileDrop(event: DragEvent): void {
    if (!this.options.enableFileDrops) return;
    
    const files = Array.from(event.dataTransfer?.files || []);
    const element = event.target as HTMLElement;
    const dropZone = this.findDropZone(element);
    
    if (dropZone && dropZone.acceptedTypes.includes('file')) {
      const fileData: DragData = {
        type: 'file',
        data: files
      };
      
      dropZone.onDrop(fileData, dropZone);
    }
  }

  /**
   * ドラッグゴーストを作成
   */
  private createDragGhost(preview: string | HTMLElement, x: number, y: number): void {
    this.dragGhost = document.createElement('div');
    this.dragGhost.className = 'drag-ghost';
    
    if (typeof preview === 'string') {
      this.dragGhost.innerHTML = preview;
    } else {
      this.dragGhost.appendChild(preview.cloneNode(true) as HTMLElement);
    }
    
    // スタイリング
    Object.assign(this.dragGhost.style, {
      position: 'fixed',
      top: `${y}px`,
      left: `${x}px`,
      pointerEvents: 'none',
      zIndex: '10000',
      transform: `scale(${this.options.ghostImageScale})`,
      opacity: '0.8',
      padding: '8px',
      backgroundColor: 'var(--color-background)',
      border: '2px solid var(--color-primary)',
      borderRadius: 'var(--border-radius-medium)',
      boxShadow: 'var(--shadow-large)'
    });
    
    document.body.appendChild(this.dragGhost);
  }

  /**
   * ドラッグゴーストを削除
   */
  private removeDragGhost(): void {
    if (this.dragGhost) {
      document.body.removeChild(this.dragGhost);
      this.dragGhost = null;
    }
  }

  /**
   * 互換性のあるドロップゾーンをアクティブにする
   */
  private activateCompatibleDropZones(dragData: DragData): void {
    for (const dropZone of this.dropZones.values()) {
      if (this.isCompatible(dragData, dropZone)) {
        dropZone.element.classList.add('drag-active');
      }
    }
  }

  /**
   * すべてのドロップゾーンを非アクティブにする
   */
  private deactivateAllDropZones(): void {
    for (const dropZone of this.dropZones.values()) {
      dropZone.element.classList.remove('drag-active', 'drag-over');
    }
  }

  /**
   * ドラッグデータとドロップゾーンの互換性をチェック
   */
  private isCompatible(dragData: DragData, dropZone: DropZone): boolean {
    if (dropZone.disabled) return false;
    
    return dropZone.acceptedTypes.includes(dragData.type) || 
           dropZone.acceptedTypes.includes('*');
  }

  /**
   * 要素に対応するドロップゾーンを見つける
   */
  private findDropZone(element: HTMLElement): DropZone | null {
    let current = element;
    
    while (current && current !== document.body) {
      const zoneId = current.dataset['dropZoneId'];
      if (zoneId) {
        return this.dropZones.get(zoneId) || null;
      }
      current = current.parentElement!;
    }
    
    return null;
  }

  /**
   * 要素がドロップゾーンの子要素かチェック
   */
  private isChildOfDropZone(element: HTMLElement, dropZone: DropZone): boolean {
    if (!element) return false;
    
    let current = element;
    while (current && current !== document.body) {
      if (current === dropZone.element) {
        return true;
      }
      current = current.parentElement!;
    }
    
    return false;
  }

  /**
   * オートスクロール処理
   */
  private handleAutoScroll(event: DragEvent): void {
    if (!this.options.autoScrollSpeed || !this.options.autoScrollThreshold) return;
    
    const { clientY } = event;
    const { innerHeight } = window;
    const threshold = this.options.autoScrollThreshold;
    
    if (clientY < threshold) {
      // 上方向スクロール
      this.startAutoScroll(-this.options.autoScrollSpeed);
    } else if (clientY > innerHeight - threshold) {
      // 下方向スクロール
      this.startAutoScroll(this.options.autoScrollSpeed);
    } else {
      this.stopAutoScroll();
    }
  }

  /**
   * オートスクロール開始
   */
  private startAutoScroll(speed: number): void {
    if (this.autoScrollTimer) return;
    
    this.autoScrollTimer = window.setInterval(() => {
      window.scrollBy(0, speed);
    }, 16); // ~60fps
  }

  /**
   * オートスクロール停止
   */
  private stopAutoScroll(): void {
    if (this.autoScrollTimer) {
      clearInterval(this.autoScrollTimer);
      this.autoScrollTimer = null;
    }
  }

  /**
   * テストステップの並び替えヘルパー
   */
  createTestStepSortable(container: HTMLElement, onReorder: (oldIndex: number, newIndex: number) => void): void {
    const steps = container.querySelectorAll('.test-step');
    
    steps.forEach((step, index) => {
      const stepElement = step as HTMLElement;
      
      // ドラッグソースとして登録
      this.registerDragSource({
        id: `test-step-${index}`,
        element: stepElement,
        data: {
          type: 'test-step',
          data: { index },
          sourceIndex: index,
          preview: stepElement.cloneNode(true) as HTMLElement
        },
        onDragStart: () => {
          stepElement.style.opacity = '0.5';
        },
        onDragEnd: (_, __, success) => {
          stepElement.style.opacity = '1';
          if (!success) {
            // ドラッグキャンセル時のアニメーション
            stepElement.classList.add('drag-cancel');
            setTimeout(() => stepElement.classList.remove('drag-cancel'), 300);
          }
        }
      });
    });

    // コンテナをドロップゾーンとして登録
    this.registerDropZone({
      id: 'test-steps-container',
      element: container,
      acceptedTypes: ['test-step'],
      onDrop: (data, zone) => {
        const sourceIndex = data.sourceIndex!;
        const targetIndex = this.calculateDropIndex(zone.element, event as any);
        
        if (sourceIndex !== targetIndex) {
          onReorder(sourceIndex, targetIndex);
        }
      },
             onDragOver: (_data, zone) => {
         // ドロップ位置のビジュアルフィードバック
         this.showDropIndicator(zone.element, event as any);
         return true;
       },
      onDragLeave: () => {
        this.hideDropIndicator();
      }
    });
  }

  /**
   * ドロップインデックスを計算
   */
  private calculateDropIndex(container: HTMLElement, event: MouseEvent): number {
    const steps = Array.from(container.querySelectorAll('.test-step'));
    const { clientY } = event;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] as HTMLElement;
      const rect = step.getBoundingClientRect();
      
      if (clientY < rect.top + rect.height / 2) {
        return i;
      }
    }
    
    return steps.length;
  }

  /**
   * ドロップインジケーターを表示
   */
  private showDropIndicator(container: HTMLElement, event: MouseEvent): void {
    this.hideDropIndicator();
    
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.style.cssText = `
      position: absolute;
      height: 2px;
      background-color: var(--color-primary);
      border-radius: 1px;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 0 4px var(--color-primary);
    `;
    
    const dropIndex = this.calculateDropIndex(container, event);
    const steps = container.querySelectorAll('.test-step');
    
    if (dropIndex < steps.length) {
      const step = steps[dropIndex] as HTMLElement;
      const rect = step.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      indicator.style.top = `${rect.top - containerRect.top - 1}px`;
      indicator.style.left = '0';
      indicator.style.right = '0';
    } else if (steps.length > 0) {
      const lastStep = steps[steps.length - 1] as HTMLElement;
      const rect = lastStep.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      indicator.style.top = `${rect.bottom - containerRect.top + 1}px`;
      indicator.style.left = '0';
      indicator.style.right = '0';
    }
    
    container.appendChild(indicator);
  }

  /**
   * ドロップインジケーターを非表示
   */
  private hideDropIndicator(): void {
    const indicators = document.querySelectorAll('.drop-indicator');
    indicators.forEach(indicator => indicator.remove());
  }

  /**
   * ファイルドロップエリアを作成
   */
  createFileDropArea(element: HTMLElement, onFilesDrop: (files: File[]) => void): void {
    this.registerDropZone({
      id: `file-drop-${Date.now()}`,
      element,
      acceptedTypes: ['file'],
      onDrop: (data) => {
        onFilesDrop(data.data as File[]);
      },
      onDragEnter: () => {
        element.classList.add('file-drag-over');
      },
      onDragLeave: () => {
        element.classList.remove('file-drag-over');
      },
      highlightClass: 'file-drop-highlight'
    });
  }

  /**
   * すべての登録を解除
   */
  cleanup(): void {
    // すべてのドラッグソースを解除
    for (const sourceId of this.dragSources.keys()) {
      this.unregisterDragSource(sourceId);
    }
    
    // すべてのドロップゾーンを解除
    for (const zoneId of this.dropZones.keys()) {
      this.unregisterDropZone(zoneId);
    }
    
    // ゴーストとタイマーをクリア
    this.removeDragGhost();
    this.stopAutoScroll();
  }
}