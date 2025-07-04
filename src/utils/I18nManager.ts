export type SupportedLanguage = 'ja' | 'en' | 'zh' | 'ko';

export interface LanguageDefinition {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  rtl: boolean;
  flag: string;
}

export interface TranslationData {
  [key: string]: string | TranslationData;
}

export interface I18nOptions {
  defaultLanguage?: SupportedLanguage;
  fallbackLanguage?: SupportedLanguage;
  autoDetect?: boolean;
  persistLanguage?: boolean;
}

export class I18nManager {
  private currentLanguage: SupportedLanguage = 'ja';
  private translations: Map<SupportedLanguage, TranslationData> = new Map();
  private listeners: Set<(language: SupportedLanguage) => void> = new Set();
  private options: Required<I18nOptions>;
  
  private static instance: I18nManager | null = null;

  // サポート言語定義
  private readonly supportedLanguages: LanguageDefinition[] = [
    {
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      rtl: false,
      flag: '🇯🇵'
    },
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      rtl: false,
      flag: '🇺🇸'
    },
    {
      code: 'zh',
      name: 'Chinese',
      nativeName: '中文',
      rtl: false,
      flag: '🇨🇳'
    },
    {
      code: 'ko',
      name: 'Korean',
      nativeName: '한국어',
      rtl: false,
      flag: '🇰🇷'
    }
  ];

  constructor(options: I18nOptions = {}) {
    this.options = {
      defaultLanguage: options.defaultLanguage || 'ja',
      fallbackLanguage: options.fallbackLanguage || 'en',
      autoDetect: options.autoDetect ?? true,
      persistLanguage: options.persistLanguage ?? true
    };

    this.initializeTranslations();
    this.loadPersistedLanguage();
    this.detectSystemLanguage();
  }

  /**
   * シングルトンインスタンスの取得
   */
  static getInstance(options?: I18nOptions): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager(options);
    }
    return I18nManager.instance;
  }

  /**
   * 翻訳データの初期化
   */
  private initializeTranslations(): void {
    // 日本語翻訳
    this.translations.set('ja', {
      app: {
        title: 'Windows UI Automation Test Tool',
        subtitle: 'ノーコードテスト自動化ツール'
      },
      menu: {
        file: 'ファイル',
        edit: '編集',
        view: '表示',
        test: 'テスト',
        tools: 'ツール',
        help: 'ヘルプ'
      },
      buttons: {
        newTest: '新規テスト',
        openTest: 'テストを開く',
        saveTest: 'テストを保存',
        startRecording: '記録開始',
        stopRecording: '記録停止',
        runTest: 'テスト実行',
        pauseTest: '一時停止',
        addStep: 'ステップ追加',
        deleteStep: 'ステップ削除',
        addLocator: 'ロケーター追加',
        manageLocators: 'ロケーター管理',
        addAssertion: 'アサーション追加',
        takeSnapshot: 'スナップショット',
        generateReport: 'レポート生成',
        exportReport: 'レポート出力',
        clearResults: '結果クリア',
        settings: '設定',
        help: 'ヘルプ',
        cancel: 'キャンセル',
        ok: 'OK',
        apply: '適用',
        close: '閉じる',
        save: '保存',
        load: '読み込み',
        reset: 'リセット'
      },
      tabs: {
        editor: 'エディター',
        locators: 'ロケーター',
        assertions: 'アサーション',
        reports: 'レポート'
      },
      fields: {
        testName: 'テスト名',
        description: '説明',
        tags: 'タグ',
        locatorName: 'ロケーター名',
        selector: 'セレクター',
        expectedValue: '期待値',
        actualValue: '実際の値',
        action: 'アクション',
        element: '要素',
        value: '値'
      },
      actions: {
        click: 'クリック',
        doubleClick: 'ダブルクリック',
        rightClick: '右クリック',
        type: 'タイプ',
        clear: 'クリア',
        hover: 'ホバー',
        scroll: 'スクロール',
        wait: '待機',
        assert: 'アサーション'
      },
      messages: {
        recordingStarted: '記録を開始しました',
        recordingStopped: '記録を停止しました',
        testRunning: 'テストを実行中...',
        testCompleted: 'テスト実行完了',
        testFailed: 'テスト実行失敗',
        fileSaved: 'ファイルを保存しました',
        fileLoaded: 'ファイルを読み込みました',
        settingsSaved: '設定を保存しました',
        error: 'エラーが発生しました',
        success: '成功しました',
        warning: '警告',
        info: '情報',
        noTestSteps: '実行するテストステップがありません',
        invalidInput: '入力値が正しくありません'
      },
      settings: {
        general: '一般',
        appearance: '外観',
        language: '言語',
        theme: 'テーマ',
        shortcuts: 'ショートカット',
        advanced: '詳細設定',
        fontSize: 'フォントサイズ',
        animations: 'アニメーション',
        autoSave: '自動保存',
        defaultTimeout: 'デフォルトタイムアウト',
        screenshotPath: 'スクリーンショット保存先',
        reportPath: 'レポート保存先'
      },
      shortcuts: {
        newTest: '新規テスト',
        openTest: 'テストを開く',
        saveTest: 'テストを保存',
        startRecording: '記録開始',
        stopRecording: '記録停止',
        runTest: 'テスト実行',
        pauseTest: 'テスト一時停止',
        stepOver: 'ステップオーバー',
        switchToEditor: 'エディターに切り替え',
        switchToLocators: 'ロケーターに切り替え',
        switchToAssertions: 'アサーションに切り替え',
        switchToReports: 'レポートに切り替え',
        addStep: 'ステップ追加',
        deleteStep: 'ステップ削除',
        duplicateStep: 'ステップ複製',
        find: '検索',
        settings: '設定',
        help: 'ヘルプ',
        takeSnapshot: 'スナップショット撮影',
        toggleTheme: 'テーマ切り替え'
      }
    });

    // 英語翻訳
    this.translations.set('en', {
      app: {
        title: 'Windows UI Automation Test Tool',
        subtitle: 'No-code Test Automation Tool'
      },
      menu: {
        file: 'File',
        edit: 'Edit',
        view: 'View',
        test: 'Test',
        tools: 'Tools',
        help: 'Help'
      },
      buttons: {
        newTest: 'New Test',
        openTest: 'Open Test',
        saveTest: 'Save Test',
        startRecording: 'Start Recording',
        stopRecording: 'Stop Recording',
        runTest: 'Run Test',
        pauseTest: 'Pause Test',
        addStep: 'Add Step',
        deleteStep: 'Delete Step',
        addLocator: 'Add Locator',
        manageLocators: 'Manage Locators',
        addAssertion: 'Add Assertion',
        takeSnapshot: 'Take Snapshot',
        generateReport: 'Generate Report',
        exportReport: 'Export Report',
        clearResults: 'Clear Results',
        settings: 'Settings',
        help: 'Help',
        cancel: 'Cancel',
        ok: 'OK',
        apply: 'Apply',
        close: 'Close',
        save: 'Save',
        load: 'Load',
        reset: 'Reset'
      },
      tabs: {
        editor: 'Editor',
        locators: 'Locators',
        assertions: 'Assertions',
        reports: 'Reports'
      },
      fields: {
        testName: 'Test Name',
        description: 'Description',
        tags: 'Tags',
        locatorName: 'Locator Name',
        selector: 'Selector',
        expectedValue: 'Expected Value',
        actualValue: 'Actual Value',
        action: 'Action',
        element: 'Element',
        value: 'Value'
      },
      actions: {
        click: 'Click',
        doubleClick: 'Double Click',
        rightClick: 'Right Click',
        type: 'Type',
        clear: 'Clear',
        hover: 'Hover',
        scroll: 'Scroll',
        wait: 'Wait',
        assert: 'Assert'
      },
      messages: {
        recordingStarted: 'Recording started',
        recordingStopped: 'Recording stopped',
        testRunning: 'Test running...',
        testCompleted: 'Test completed',
        testFailed: 'Test failed',
        fileSaved: 'File saved',
        fileLoaded: 'File loaded',
        settingsSaved: 'Settings saved',
        error: 'Error occurred',
        success: 'Success',
        warning: 'Warning',
        info: 'Information',
        noTestSteps: 'No test steps to execute',
        invalidInput: 'Invalid input'
      },
      settings: {
        general: 'General',
        appearance: 'Appearance',
        language: 'Language',
        theme: 'Theme',
        shortcuts: 'Shortcuts',
        advanced: 'Advanced',
        fontSize: 'Font Size',
        animations: 'Animations',
        autoSave: 'Auto Save',
        defaultTimeout: 'Default Timeout',
        screenshotPath: 'Screenshot Path',
        reportPath: 'Report Path'
      },
      shortcuts: {
        newTest: 'New Test',
        openTest: 'Open Test',
        saveTest: 'Save Test',
        startRecording: 'Start Recording',
        stopRecording: 'Stop Recording',
        runTest: 'Run Test',
        pauseTest: 'Pause Test',
        stepOver: 'Step Over',
        switchToEditor: 'Switch to Editor',
        switchToLocators: 'Switch to Locators',
        switchToAssertions: 'Switch to Assertions',
        switchToReports: 'Switch to Reports',
        addStep: 'Add Step',
        deleteStep: 'Delete Step',
        duplicateStep: 'Duplicate Step',
        find: 'Find',
        settings: 'Settings',
        help: 'Help',
        takeSnapshot: 'Take Snapshot',
        toggleTheme: 'Toggle Theme'
      }
    });

    // 中国語翻訳
    this.translations.set('zh', {
      app: {
        title: 'Windows UI 自动化测试工具',
        subtitle: '无代码测试自动化工具'
      },
      menu: {
        file: '文件',
        edit: '编辑',
        view: '视图',
        test: '测试',
        tools: '工具',
        help: '帮助'
      },
      buttons: {
        newTest: '新建测试',
        openTest: '打开测试',
        saveTest: '保存测试',
        startRecording: '开始记录',
        stopRecording: '停止记录',
        runTest: '运行测试',
        pauseTest: '暂停测试',
        addStep: '添加步骤',
        deleteStep: '删除步骤',
        addLocator: '添加定位器',
        manageLocators: '管理定位器',
        addAssertion: '添加断言',
        takeSnapshot: '截图',
        generateReport: '生成报告',
        exportReport: '导出报告',
        clearResults: '清除结果',
        settings: '设置',
        help: '帮助',
        cancel: '取消',
        ok: '确定',
        apply: '应用',
        close: '关闭',
        save: '保存',
        load: '加载',
        reset: '重置'
      },
      tabs: {
        editor: '编辑器',
        locators: '定位器',
        assertions: '断言',
        reports: '报告'
      },
      fields: {
        testName: '测试名称',
        description: '描述',
        tags: '标签',
        locatorName: '定位器名称',
        selector: '选择器',
        expectedValue: '期望值',
        actualValue: '实际值',
        action: '操作',
        element: '元素',
        value: '值'
      },
      actions: {
        click: '点击',
        doubleClick: '双击',
        rightClick: '右键点击',
        type: '输入',
        clear: '清除',
        hover: '悬停',
        scroll: '滚动',
        wait: '等待',
        assert: '断言'
      },
      messages: {
        recordingStarted: '开始记录',
        recordingStopped: '停止记录',
        testRunning: '测试运行中...',
        testCompleted: '测试完成',
        testFailed: '测试失败',
        fileSaved: '文件已保存',
        fileLoaded: '文件已加载',
        settingsSaved: '设置已保存',
        error: '发生错误',
        success: '成功',
        warning: '警告',
        info: '信息',
        noTestSteps: '没有可执行的测试步骤',
        invalidInput: '输入无效'
      },
      settings: {
        general: '常规',
        appearance: '外观',
        language: '语言',
        theme: '主题',
        shortcuts: '快捷键',
        advanced: '高级',
        fontSize: '字体大小',
        animations: '动画',
        autoSave: '自动保存',
        defaultTimeout: '默认超时',
        screenshotPath: '截图路径',
        reportPath: '报告路径'
      },
      shortcuts: {
        newTest: '新建测试',
        openTest: '打开测试',
        saveTest: '保存测试',
        startRecording: '开始记录',
        stopRecording: '停止记录',
        runTest: '运行测试',
        pauseTest: '暂停测试',
        stepOver: '单步执行',
        switchToEditor: '切换到编辑器',
        switchToLocators: '切换到定位器',
        switchToAssertions: '切换到断言',
        switchToReports: '切换到报告',
        addStep: '添加步骤',
        deleteStep: '删除步骤',
        duplicateStep: '复制步骤',
        find: '查找',
        settings: '设置',
        help: '帮助',
        takeSnapshot: '截图',
        toggleTheme: '切换主题'
      }
    });

    // 韓国語翻訳
    this.translations.set('ko', {
      app: {
        title: 'Windows UI 자동화 테스트 도구',
        subtitle: '노코드 테스트 자동화 도구'
      },
      menu: {
        file: '파일',
        edit: '편집',
        view: '보기',
        test: '테스트',
        tools: '도구',
        help: '도움말'
      },
      buttons: {
        newTest: '새 테스트',
        openTest: '테스트 열기',
        saveTest: '테스트 저장',
        startRecording: '녹화 시작',
        stopRecording: '녹화 중지',
        runTest: '테스트 실행',
        pauseTest: '테스트 일시정지',
        addStep: '단계 추가',
        deleteStep: '단계 삭제',
        addLocator: '로케이터 추가',
        manageLocators: '로케이터 관리',
        addAssertion: '어서션 추가',
        takeSnapshot: '스냅샷',
        generateReport: '보고서 생성',
        exportReport: '보고서 내보내기',
        clearResults: '결과 지우기',
        settings: '설정',
        help: '도움말',
        cancel: '취소',
        ok: '확인',
        apply: '적용',
        close: '닫기',
        save: '저장',
        load: '불러오기',
        reset: '재설정'
      },
      tabs: {
        editor: '편집기',
        locators: '로케이터',
        assertions: '어서션',
        reports: '보고서'
      },
      fields: {
        testName: '테스트 이름',
        description: '설명',
        tags: '태그',
        locatorName: '로케이터 이름',
        selector: '선택자',
        expectedValue: '예상값',
        actualValue: '실제값',
        action: '액션',
        element: '요소',
        value: '값'
      },
      actions: {
        click: '클릭',
        doubleClick: '더블클릭',
        rightClick: '우클릭',
        type: '입력',
        clear: '지우기',
        hover: '호버',
        scroll: '스크롤',
        wait: '대기',
        assert: '어서션'
      },
      messages: {
        recordingStarted: '녹화를 시작했습니다',
        recordingStopped: '녹화를 중지했습니다',
        testRunning: '테스트 실행 중...',
        testCompleted: '테스트 완료',
        testFailed: '테스트 실패',
        fileSaved: '파일이 저장되었습니다',
        fileLoaded: '파일이 로드되었습니다',
        settingsSaved: '설정이 저장되었습니다',
        error: '오류 발생',
        success: '성공',
        warning: '경고',
        info: '정보',
        noTestSteps: '실행할 테스트 단계가 없습니다',
        invalidInput: '잘못된 입력'
      },
      settings: {
        general: '일반',
        appearance: '외형',
        language: '언어',
        theme: '테마',
        shortcuts: '단축키',
        advanced: '고급',
        fontSize: '글꼴 크기',
        animations: '애니메이션',
        autoSave: '자동 저장',
        defaultTimeout: '기본 타임아웃',
        screenshotPath: '스크린샷 경로',
        reportPath: '보고서 경로'
      },
      shortcuts: {
        newTest: '새 테스트',
        openTest: '테스트 열기',
        saveTest: '테스트 저장',
        startRecording: '녹화 시작',
        stopRecording: '녹화 중지',
        runTest: '테스트 실행',
        pauseTest: '테스트 일시정지',
        stepOver: '단계별 실행',
        switchToEditor: '편집기로 전환',
        switchToLocators: '로케이터로 전환',
        switchToAssertions: '어서션으로 전환',
        switchToReports: '보고서로 전환',
        addStep: '단계 추가',
        deleteStep: '단계 삭제',
        duplicateStep: '단계 복제',
        find: '찾기',
        settings: '설정',
        help: '도움말',
        takeSnapshot: '스냅샷 촬영',
        toggleTheme: '테마 전환'
      }
    });
  }

  /**
   * 翻訳文字列の取得
   */
  t(key: string, params?: Record<string, string>): string {
    const translation = this.getTranslation(key, this.currentLanguage);
    
    if (translation && params) {
      return this.interpolate(translation, params);
    }
    
    return translation || key;
  }

  /**
   * 指定したキーの翻訳を取得
   */
  private getTranslation(key: string, language: SupportedLanguage): string | null {
    const translations = this.translations.get(language);
    if (!translations) {
      // フォールバック言語を試行
      return this.getTranslation(key, this.options.fallbackLanguage);
    }

    const keys = key.split('.');
    let current: any = translations;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // フォールバック言語を試行
        if (language !== this.options.fallbackLanguage) {
          return this.getTranslation(key, this.options.fallbackLanguage);
        }
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * パラメータ補間
   */
  private interpolate(template: string, params: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] || match;
    });
  }

  /**
   * 現在の言語を取得
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * 言語を設定
   */
  setLanguage(language: SupportedLanguage): void {
    if (!this.isLanguageSupported(language)) {
      console.warn(`Unsupported language: ${language}`);
      return;
    }

    const oldLanguage = this.currentLanguage;
    this.currentLanguage = language;

    // HTML属性を更新
    this.updateHtmlAttributes();

    // 設定を永続化
    if (this.options.persistLanguage) {
      this.persistLanguage();
    }

    // リスナーに通知
    this.notifyLanguageChange(language);

    console.log(`Language changed from ${oldLanguage} to ${language}`);
  }

  /**
   * サポート言語かチェック
   */
  isLanguageSupported(language: string): language is SupportedLanguage {
    return this.supportedLanguages.some(lang => lang.code === language);
  }

  /**
   * サポート言語一覧を取得
   */
  getSupportedLanguages(): LanguageDefinition[] {
    return [...this.supportedLanguages];
  }

  /**
   * 言語定義を取得
   */
  getLanguageDefinition(language: SupportedLanguage): LanguageDefinition | undefined {
    return this.supportedLanguages.find(lang => lang.code === language);
  }

  /**
   * 言語変更リスナーを追加
   */
  addLanguageChangeListener(listener: (language: SupportedLanguage) => void): void {
    this.listeners.add(listener);
  }

  /**
   * 言語変更リスナーを削除
   */
  removeLanguageChangeListener(listener: (language: SupportedLanguage) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * システム言語の検出
   */
  private detectSystemLanguage(): void {
    if (!this.options.autoDetect) return;

    let systemLanguage: string = 'en';

    if (typeof navigator !== 'undefined') {
      systemLanguage = navigator.language || navigator.languages?.[0] || 'en';
    } else if (typeof process !== 'undefined') {
      systemLanguage = process.env['LANG'] || process.env['LANGUAGE'] || 'en';
    }

    // 言語コードを抽出（例: ja-JP -> ja）
    const languageCode = systemLanguage.split('-')[0] as SupportedLanguage;

    if (this.isLanguageSupported(languageCode)) {
      this.setLanguage(languageCode);
    }
  }

  /**
   * 永続化された言語設定をロード
   */
  private loadPersistedLanguage(): void {
    if (!this.options.persistLanguage) return;

    try {
      const stored = localStorage.getItem('app-language');
      if (stored && this.isLanguageSupported(stored)) {
        this.currentLanguage = stored as SupportedLanguage;
      }
    } catch (error) {
      console.error('Failed to load persisted language:', error);
    }
  }

  /**
   * 言語設定を永続化
   */
  private persistLanguage(): void {
    try {
      localStorage.setItem('app-language', this.currentLanguage);
    } catch (error) {
      console.error('Failed to persist language:', error);
    }
  }

  /**
   * HTML属性を更新
   */
  private updateHtmlAttributes(): void {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const langDef = this.getLanguageDefinition(this.currentLanguage);

    html.lang = this.currentLanguage;
    html.dir = langDef?.rtl ? 'rtl' : 'ltr';
    html.setAttribute('data-language', this.currentLanguage);
  }

  /**
   * 言語変更をリスナーに通知
   */
  private notifyLanguageChange(language: SupportedLanguage): void {
    this.listeners.forEach(listener => {
      try {
        listener(language);
      } catch (error) {
        console.error('Error in language change listener:', error);
      }
    });
  }

  /**
   * 翻訳データを追加・更新
   */
  addTranslations(language: SupportedLanguage, translations: TranslationData): void {
    const existing = this.translations.get(language) || {};
    this.translations.set(language, this.mergeTranslations(existing, translations));
  }

  /**
   * 翻訳データをマージ
   */
  private mergeTranslations(existing: TranslationData, newData: TranslationData): TranslationData {
    const result = { ...existing };

    for (const [key, value] of Object.entries(newData)) {
      if (typeof value === 'object' && typeof existing[key] === 'object') {
        result[key] = this.mergeTranslations(existing[key] as TranslationData, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 翻訳キーの存在確認
   */
  hasTranslation(key: string, language?: SupportedLanguage): boolean {
    const lang = language || this.currentLanguage;
    return this.getTranslation(key, lang) !== null;
  }

  /**
   * プルーラル（複数形）対応の翻訳
   */
  tn(key: string, count: number, params?: Record<string, string>): string {
    const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
    
    if (this.hasTranslation(pluralKey)) {
      return this.t(pluralKey, { ...params, count: count.toString() });
    }
    
    return this.t(key, { ...params, count: count.toString() });
  }

  /**
   * 日付の地域化フォーマット
   */
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    try {
      return new Intl.DateTimeFormat(this.currentLanguage, options).format(date);
    } catch (error) {
      console.error('Date formatting error:', error);
      return date.toLocaleDateString();
    }
  }

  /**
   * 数値の地域化フォーマット
   */
  formatNumber(number: number, options?: Intl.NumberFormatOptions): string {
    try {
      return new Intl.NumberFormat(this.currentLanguage, options).format(number);
    } catch (error) {
      console.error('Number formatting error:', error);
      return number.toString();
    }
  }

  /**
   * 設定をリセット
   */
  reset(): void {
    this.setLanguage(this.options.defaultLanguage);
    
    if (this.options.persistLanguage) {
      try {
        localStorage.removeItem('app-language');
      } catch (error) {
        console.error('Failed to remove persisted language:', error);
      }
    }
  }
}