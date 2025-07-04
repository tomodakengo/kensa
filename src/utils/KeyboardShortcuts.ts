export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  defaultShortcut: string;
  currentShortcut: string;
  category: 'test' | 'recording' | 'navigation' | 'general';
  handler: () => void | Promise<void>;
}

export interface ShortcutConfig {
  [actionId: string]: string;
}

export class KeyboardShortcuts {
  private shortcuts: Map<string, ShortcutAction> = new Map();
  private keyMap: Map<string, string> = new Map();
  private isEnabled = true;
  private config: ShortcutConfig = {};
  
  constructor() {
    this.initializeDefaultShortcuts();
    this.loadConfiguration();
    this.bindGlobalKeyListener();
  }

  /**
   * デフォルトショートカットを初期化
   */
  private initializeDefaultShortcuts(): void {
    const defaultShortcuts: Omit<ShortcutAction, 'handler'>[] = [
      // テスト管理
      {
        id: 'new-test',
        name: '新規テスト',
        description: '新しいテストケースを作成',
        defaultShortcut: 'Ctrl+N',
        currentShortcut: 'Ctrl+N',
        category: 'test'
      },
      {
        id: 'open-test',
        name: 'テストを開く',
        description: '既存のテストケースを開く',
        defaultShortcut: 'Ctrl+O',
        currentShortcut: 'Ctrl+O',
        category: 'test'
      },
      {
        id: 'save-test',
        name: 'テストを保存',
        description: '現在のテストケースを保存',
        defaultShortcut: 'Ctrl+S',
        currentShortcut: 'Ctrl+S',
        category: 'test'
      },
      {
        id: 'save-test-as',
        name: 'テストに名前を付けて保存',
        description: '現在のテストケースに名前を付けて保存',
        defaultShortcut: 'Ctrl+Shift+S',
        currentShortcut: 'Ctrl+Shift+S',
        category: 'test'
      },
      
      // 記録・実行
      {
        id: 'start-recording',
        name: '記録開始',
        description: 'テストの記録を開始',
        defaultShortcut: 'F5',
        currentShortcut: 'F5',
        category: 'recording'
      },
      {
        id: 'stop-recording',
        name: '記録停止',
        description: 'テストの記録を停止',
        defaultShortcut: 'F6',
        currentShortcut: 'F6',
        category: 'recording'
      },
      {
        id: 'run-test',
        name: 'テスト実行',
        description: '現在のテストを実行',
        defaultShortcut: 'F9',
        currentShortcut: 'F9',
        category: 'recording'
      },
      {
        id: 'pause-test',
        name: 'テスト一時停止',
        description: 'テスト実行を一時停止',
        defaultShortcut: 'F10',
        currentShortcut: 'F10',
        category: 'recording'
      },
      {
        id: 'step-over',
        name: 'ステップオーバー',
        description: '次のステップに進む',
        defaultShortcut: 'F11',
        currentShortcut: 'F11',
        category: 'recording'
      },
      
      // ナビゲーション
      {
        id: 'switch-to-editor',
        name: 'エディターに切り替え',
        description: 'テストエディターに切り替え',
        defaultShortcut: 'Ctrl+1',
        currentShortcut: 'Ctrl+1',
        category: 'navigation'
      },
      {
        id: 'switch-to-locators',
        name: 'ロケーターに切り替え',
        description: 'ロケーター管理に切り替え',
        defaultShortcut: 'Ctrl+2',
        currentShortcut: 'Ctrl+2',
        category: 'navigation'
      },
      {
        id: 'switch-to-assertions',
        name: 'アサーションに切り替え',
        description: 'アサーション管理に切り替え',
        defaultShortcut: 'Ctrl+3',
        currentShortcut: 'Ctrl+3',
        category: 'navigation'
      },
      {
        id: 'switch-to-reports',
        name: 'レポートに切り替え',
        description: 'レポート画面に切り替え',
        defaultShortcut: 'Ctrl+4',
        currentShortcut: 'Ctrl+4',
        category: 'navigation'
      },
      
      // 一般操作
      {
        id: 'add-step',
        name: 'ステップ追加',
        description: '新しいテストステップを追加',
        defaultShortcut: 'Ctrl+Plus',
        currentShortcut: 'Ctrl+Plus',
        category: 'general'
      },
      {
        id: 'delete-step',
        name: 'ステップ削除',
        description: '選択したステップを削除',
        defaultShortcut: 'Delete',
        currentShortcut: 'Delete',
        category: 'general'
      },
      {
        id: 'duplicate-step',
        name: 'ステップ複製',
        description: '選択したステップを複製',
        defaultShortcut: 'Ctrl+D',
        currentShortcut: 'Ctrl+D',
        category: 'general'
      },
      {
        id: 'find',
        name: '検索',
        description: 'テキスト検索を開く',
        defaultShortcut: 'Ctrl+F',
        currentShortcut: 'Ctrl+F',
        category: 'general'
      },
      {
        id: 'settings',
        name: '設定',
        description: '設定画面を開く',
        defaultShortcut: 'Ctrl+Comma',
        currentShortcut: 'Ctrl+Comma',
        category: 'general'
      },
      {
        id: 'help',
        name: 'ヘルプ',
        description: 'ヘルプ画面を開く',
        defaultShortcut: 'F1',
        currentShortcut: 'F1',
        category: 'general'
      },
      {
        id: 'take-snapshot',
        name: 'スナップショット撮影',
        description: '現在の画面のスナップショットを撮影',
        defaultShortcut: 'Ctrl+Shift+X',
        currentShortcut: 'Ctrl+Shift+X',
        category: 'general'
      },
      {
        id: 'toggle-theme',
        name: 'テーマ切り替え',
        description: 'ライト/ダークテーマを切り替え',
        defaultShortcut: 'Ctrl+Shift+T',
        currentShortcut: 'Ctrl+Shift+T',
        category: 'general'
      }
    ];

    // ハンドラーを追加してショートカットを登録
    defaultShortcuts.forEach(shortcut => {
      this.registerShortcut({
        ...shortcut,
        handler: this.createHandler(shortcut.id)
      });
    });
  }

  /**
   * ショートカットハンドラーを作成
   */
  private createHandler(actionId: string): () => void {
    return () => {
      // ウィンドウオブジェクトにアクションディスパッチャーがある場合
      if (typeof window !== 'undefined' && (window as any).app) {
        const app = (window as any).app;
        
        switch (actionId) {
          case 'new-test':
            app.createNewTest?.();
            break;
          case 'open-test':
            app.openTest?.();
            break;
          case 'save-test':
            app.saveTest?.();
            break;
          case 'start-recording':
            app.startRecording?.();
            break;
          case 'stop-recording':
            app.stopRecording?.();
            break;
          case 'run-test':
            app.runTest?.();
            break;
          case 'pause-test':
            app.pauseTest?.();
            break;
          case 'switch-to-editor':
            app.switchTab?.('editor');
            break;
          case 'switch-to-locators':
            app.switchTab?.('locators');
            break;
          case 'switch-to-assertions':
            app.switchTab?.('assertions');
            break;
          case 'switch-to-reports':
            app.switchTab?.('reports');
            break;
          case 'add-step':
            app.addTestStep?.();
            break;
          case 'delete-step':
            app.deleteSelectedStep?.();
            break;
          case 'duplicate-step':
            app.duplicateSelectedStep?.();
            break;
          case 'find':
            app.showFindDialog?.();
            break;
          case 'settings':
            app.showSettings?.();
            break;
          case 'help':
            app.showHelp?.();
            break;
          case 'take-snapshot':
            app.takeSnapshot?.();
            break;
          case 'toggle-theme':
            app.toggleTheme?.();
            break;
          default:
            console.log(`Unknown action: ${actionId}`);
        }
      }
    };
  }

  /**
   * ショートカットを登録
   */
  registerShortcut(action: ShortcutAction): void {
    this.shortcuts.set(action.id, action);
    this.updateKeyMap(action.id, action.currentShortcut);
  }

  /**
   * ショートカットを削除
   */
  unregisterShortcut(actionId: string): void {
    const action = this.shortcuts.get(actionId);
    if (action) {
      this.keyMap.delete(action.currentShortcut);
      this.shortcuts.delete(actionId);
    }
  }

  /**
   * ショートカットを更新
   */
  updateShortcut(actionId: string, newShortcut: string): boolean {
    const action = this.shortcuts.get(actionId);
    if (!action) return false;

    // 既存のマッピングを削除
    this.keyMap.delete(action.currentShortcut);

    // 新しいショートカットが他で使用されていないかチェック
    if (this.keyMap.has(newShortcut)) {
      return false; // 既に使用されている
    }

    // 新しいショートカットを設定
    action.currentShortcut = newShortcut;
    this.updateKeyMap(actionId, newShortcut);
    this.saveConfiguration();
    
    return true;
  }

  /**
   * キーマップを更新
   */
  private updateKeyMap(actionId: string, shortcut: string): void {
    this.keyMap.set(shortcut, actionId);
  }

  /**
   * グローバルキーリスナーをバインド
   */
  private bindGlobalKeyListener(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (event) => {
        if (!this.isEnabled) return;

        const shortcut = this.eventToShortcut(event);
        const actionId = this.keyMap.get(shortcut);
        
        if (actionId) {
          const action = this.shortcuts.get(actionId);
          if (action) {
            event.preventDefault();
            event.stopPropagation();
            
            try {
              action.handler();
              console.log(`Executed shortcut: ${shortcut} -> ${action.name}`);
            } catch (error) {
              console.error(`Error executing shortcut ${shortcut}:`, error);
            }
          }
        }
      });
    }
  }

  /**
   * キーボードイベントをショートカット文字列に変換
   */
  private eventToShortcut(event: KeyboardEvent): string {
    const parts: string[] = [];
    
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    
    // 特殊キーの処理
    let key = event.key;
    if (key === ' ') key = 'Space';
    else if (key === '+') key = 'Plus';
    else if (key === ',') key = 'Comma';
    else if (key.length === 1) key = key.toUpperCase();
    
    parts.push(key);
    
    return parts.join('+');
  }

  /**
   * すべてのショートカットを取得
   */
  getAllShortcuts(): ShortcutAction[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * カテゴリ別にショートカットを取得
   */
  getShortcutsByCategory(category: ShortcutAction['category']): ShortcutAction[] {
    return Array.from(this.shortcuts.values())
      .filter(action => action.category === category);
  }

  /**
   * ショートカットを有効/無効にする
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * ショートカットが有効かどうか
   */
  isShortcutEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * 設定をロード
   */
  private loadConfiguration(): void {
    try {
      const stored = localStorage.getItem('keyboard-shortcuts-config');
      if (stored) {
        this.config = JSON.parse(stored);
        
        // 保存された設定を適用
        for (const [actionId, shortcut] of Object.entries(this.config)) {
          const action = this.shortcuts.get(actionId);
          if (action) {
            this.keyMap.delete(action.currentShortcut);
            action.currentShortcut = shortcut;
            this.updateKeyMap(actionId, shortcut);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load keyboard shortcuts configuration:', error);
    }
  }

  /**
   * 設定を保存
   */
  private saveConfiguration(): void {
    try {
      this.config = {};
      for (const [actionId, action] of this.shortcuts) {
        this.config[actionId] = action.currentShortcut;
      }
      
      localStorage.setItem('keyboard-shortcuts-config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save keyboard shortcuts configuration:', error);
    }
  }

  /**
   * 設定をリセット（デフォルトに戻す）
   */
  resetToDefaults(): void {
    this.keyMap.clear();
    
    for (const action of this.shortcuts.values()) {
      action.currentShortcut = action.defaultShortcut;
      this.updateKeyMap(action.id, action.currentShortcut);
    }
    
    this.saveConfiguration();
  }

  /**
   * 設定をエクスポート
   */
  exportConfiguration(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 設定をインポート
   */
  importConfiguration(configJson: string): boolean {
    try {
      const importedConfig = JSON.parse(configJson);
      
      // バリデーション
      for (const [actionId, shortcut] of Object.entries(importedConfig)) {
        if (typeof actionId !== 'string' || typeof shortcut !== 'string') {
          throw new Error('Invalid configuration format');
        }
        
        if (!this.shortcuts.has(actionId)) {
          console.warn(`Unknown action ID: ${actionId}`);
          continue;
        }
      }
      
      // 設定を適用
      this.config = importedConfig;
      this.keyMap.clear();
      
      for (const [actionId, shortcut] of Object.entries(this.config)) {
        const action = this.shortcuts.get(actionId);
        if (action) {
          action.currentShortcut = shortcut as string;
          this.updateKeyMap(actionId, shortcut as string);
        }
      }
      
      this.saveConfiguration();
      return true;
    } catch (error) {
      console.error('Failed to import keyboard shortcuts configuration:', error);
      return false;
    }
  }

  /**
   * ショートカットのヘルプテキストを生成
   */
  generateHelpText(): string {
    const categories = ['test', 'recording', 'navigation', 'general'] as const;
    const categoryNames = {
      test: 'テスト管理',
      recording: '記録・実行',
      navigation: 'ナビゲーション',
      general: '一般操作'
    };
    
    let helpText = '# キーボードショートカット\n\n';
    
    for (const category of categories) {
      const shortcuts = this.getShortcutsByCategory(category);
      if (shortcuts.length === 0) continue;
      
      helpText += `## ${categoryNames[category]}\n\n`;
      
      for (const shortcut of shortcuts) {
        helpText += `- **${shortcut.currentShortcut}**: ${shortcut.name} - ${shortcut.description}\n`;
      }
      
      helpText += '\n';
    }
    
    return helpText;
  }
}