export type ThemeMode = 'light' | 'dark' | 'auto' | 'high-contrast';

export interface ThemeConfig {
  mode: ThemeMode;
  customProperties?: Record<string, string>;
  animations?: boolean;
  fontSize?: 'small' | 'normal' | 'large';
  reducedMotion?: boolean;
}

export interface ThemeDefinition {
  name: string;
  displayName: string;
  mode: ThemeMode;
  colors: {
    // Primary colors
    primary: string;
    primaryHover: string;
    primaryActive: string;
    
    // Secondary colors
    secondary: string;
    secondaryHover: string;
    secondaryActive: string;
    
    // Background colors
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    
    // Text colors
    text: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    
    // Border colors
    border: string;
    borderLight: string;
    borderHover: string;
    
    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;
    
    // UI element colors
    sidebar: string;
    header: string;
    modal: string;
    tooltip: string;
    
    // Interactive elements
    buttonPrimary: string;
    buttonSecondary: string;
    buttonDanger: string;
    buttonSuccess: string;
    
    // Form elements
    input: string;
    inputBorder: string;
    inputFocus: string;
    
    // Syntax highlighting (for code editor)
    codeBackground: string;
    codeText: string;
    codeKeyword: string;
    codeString: string;
    codeComment: string;
    codeNumber: string;
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
    modal: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    small: string;
    medium: string;
    large: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
}

export class ThemeManager {
  private currentTheme: ThemeMode = 'auto';
  private config: ThemeConfig = {
    mode: 'auto',
    animations: true,
    fontSize: 'normal',
    reducedMotion: false
  };
  private themes: Map<string, ThemeDefinition> = new Map();
  private listeners: Set<(theme: ThemeMode, config: ThemeConfig) => void> = new Set();
  private mediaQuery: MediaQueryList | null = null;

  constructor() {
    this.initializeThemes();
    this.loadConfiguration();
    this.setupMediaQueryListener();
    this.applyTheme();
  }

  /**
   * デフォルトテーマを初期化
   */
  private initializeThemes(): void {
    // ライトテーマ
    this.registerTheme({
      name: 'light',
      displayName: 'ライト',
      mode: 'light',
      colors: {
        primary: '#007bff',
        primaryHover: '#0056b3',
        primaryActive: '#004085',
        
        secondary: '#6c757d',
        secondaryHover: '#545b62',
        secondaryActive: '#404448',
        
        background: '#ffffff',
        backgroundSecondary: '#f8f9fa',
        backgroundTertiary: '#e9ecef',
        
        text: '#212529',
        textSecondary: '#495057',
        textMuted: '#6c757d',
        textInverse: '#ffffff',
        
        border: '#e9ecef',
        borderLight: '#f1f3f4',
        borderHover: '#adb5bd',
        
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#17a2b8',
        
        sidebar: '#f8f9fa',
        header: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        modal: '#ffffff',
        tooltip: '#333333',
        
        buttonPrimary: '#007bff',
        buttonSecondary: '#6c757d',
        buttonDanger: '#dc3545',
        buttonSuccess: '#28a745',
        
        input: '#ffffff',
        inputBorder: '#ced4da',
        inputFocus: '#007bff',
        
        codeBackground: '#f8f9fa',
        codeText: '#212529',
        codeKeyword: '#d73a49',
        codeString: '#032f62',
        codeComment: '#6a737d',
        codeNumber: '#005cc5'
      },
      shadows: {
        small: '0 1px 3px rgba(0, 0, 0, 0.1)',
        medium: '0 4px 8px rgba(0, 0, 0, 0.15)',
        large: '0 8px 32px rgba(0, 0, 0, 0.2)',
        modal: '0 10px 30px rgba(0, 0, 0, 0.3)'
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px'
      },
      borderRadius: {
        small: '4px',
        medium: '8px',
        large: '12px'
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px'
      }
    });

    // ダークテーマ
    this.registerTheme({
      name: 'dark',
      displayName: 'ダーク',
      mode: 'dark',
      colors: {
        primary: '#0d6efd',
        primaryHover: '#0b5ed7',
        primaryActive: '#0a58ca',
        
        secondary: '#6c757d',
        secondaryHover: '#5c636a',
        secondaryActive: '#4d5154',
        
        background: '#1a1a1a',
        backgroundSecondary: '#2d2d2d',
        backgroundTertiary: '#404040',
        
        text: '#ffffff',
        textSecondary: '#e0e0e0',
        textMuted: '#a0a0a0',
        textInverse: '#000000',
        
        border: '#404040',
        borderLight: '#4f4f4f',
        borderHover: '#666666',
        
        success: '#198754',
        warning: '#fd7e14',
        error: '#dc3545',
        info: '#0dcaf0',
        
        sidebar: '#2d2d2d',
        header: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
        modal: '#2d2d2d',
        tooltip: '#f8f9fa',
        
        buttonPrimary: '#0d6efd',
        buttonSecondary: '#6c757d',
        buttonDanger: '#dc3545',
        buttonSuccess: '#198754',
        
        input: '#2d2d2d',
        inputBorder: '#495057',
        inputFocus: '#0d6efd',
        
        codeBackground: '#2d2d2d',
        codeText: '#f8f9fa',
        codeKeyword: '#ff79c6',
        codeString: '#f1fa8c',
        codeComment: '#6272a4',
        codeNumber: '#bd93f9'
      },
      shadows: {
        small: '0 1px 3px rgba(0, 0, 0, 0.3)',
        medium: '0 4px 8px rgba(0, 0, 0, 0.4)',
        large: '0 8px 32px rgba(0, 0, 0, 0.5)',
        modal: '0 10px 30px rgba(0, 0, 0, 0.6)'
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px'
      },
      borderRadius: {
        small: '4px',
        medium: '8px',
        large: '12px'
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px'
      }
    });

    // ハイコントラストテーマ
    this.registerTheme({
      name: 'high-contrast',
      displayName: 'ハイコントラスト',
      mode: 'high-contrast',
      colors: {
        primary: '#ffffff',
        primaryHover: '#f0f0f0',
        primaryActive: '#e0e0e0',
        
        secondary: '#c0c0c0',
        secondaryHover: '#b0b0b0',
        secondaryActive: '#a0a0a0',
        
        background: '#000000',
        backgroundSecondary: '#1a1a1a',
        backgroundTertiary: '#333333',
        
        text: '#ffffff',
        textSecondary: '#ffffff',
        textMuted: '#c0c0c0',
        textInverse: '#000000',
        
        border: '#ffffff',
        borderLight: '#c0c0c0',
        borderHover: '#ffffff',
        
        success: '#00ff00',
        warning: '#ffff00',
        error: '#ff0000',
        info: '#00ffff',
        
        sidebar: '#000000',
        header: '#000000',
        modal: '#000000',
        tooltip: '#ffffff',
        
        buttonPrimary: '#ffffff',
        buttonSecondary: '#c0c0c0',
        buttonDanger: '#ff0000',
        buttonSuccess: '#00ff00',
        
        input: '#000000',
        inputBorder: '#ffffff',
        inputFocus: '#ffff00',
        
        codeBackground: '#000000',
        codeText: '#ffffff',
        codeKeyword: '#ffff00',
        codeString: '#00ff00',
        codeComment: '#c0c0c0',
        codeNumber: '#00ffff'
      },
      shadows: {
        small: '0 1px 3px #ffffff',
        medium: '0 4px 8px #ffffff',
        large: '0 8px 32px #ffffff',
        modal: '0 10px 30px #ffffff'
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px'
      },
      borderRadius: {
        small: '2px',
        medium: '4px',
        large: '6px'
      },
      fontSize: {
        xs: '14px',
        sm: '16px',
        base: '18px',
        lg: '20px',
        xl: '22px',
        '2xl': '26px',
        '3xl': '32px'
      }
    });
  }

  /**
   * テーマを登録
   */
  registerTheme(theme: ThemeDefinition): void {
    this.themes.set(theme.name, theme);
  }

  /**
   * 利用可能なテーマを取得
   */
  getAvailableThemes(): ThemeDefinition[] {
    return Array.from(this.themes.values());
  }

  /**
   * 現在のテーマを取得
   */
  getCurrentTheme(): ThemeMode {
    return this.currentTheme;
  }

  /**
   * テーマを設定
   */
  setTheme(mode: ThemeMode): void {
    this.currentTheme = mode;
    this.config.mode = mode;
    this.applyTheme();
    this.saveConfiguration();
    this.notifyListeners();
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<ThemeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyTheme();
    this.saveConfiguration();
    this.notifyListeners();
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): ThemeConfig {
    return { ...this.config };
  }

  /**
   * テーマ変更リスナーを追加
   */
  addListener(listener: (theme: ThemeMode, config: ThemeConfig) => void): void {
    this.listeners.add(listener);
  }

  /**
   * テーマ変更リスナーを削除
   */
  removeListener(listener: (theme: ThemeMode, config: ThemeConfig) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * 実際のテーマモードを解決（autoの場合はシステム設定を参照）
   */
  private resolveThemeMode(): ThemeMode {
    if (this.currentTheme === 'auto') {
      // システムの設定を確認
      if (this.mediaQuery?.matches) {
        return 'dark';
      } else {
        return 'light';
      }
    }
    return this.currentTheme;
  }

  /**
   * テーマを適用
   */
  private applyTheme(): void {
    const resolvedMode = this.resolveThemeMode();
    const theme = this.themes.get(resolvedMode);
    
    if (!theme) {
      console.warn(`Theme not found: ${resolvedMode}`);
      return;
    }

    const root = document.documentElement;
    
    // CSS変数を設定
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${this.kebabCase(key)}`, value);
    });

    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--border-radius-${key}`, value);
    });

    // フォントサイズの設定
    const fontSizeMultiplier = this.config.fontSize === 'small' ? 0.875 : 
                              this.config.fontSize === 'large' ? 1.125 : 1;
    
    Object.entries(theme.fontSize).forEach(([key, value]) => {
      const numericValue = parseFloat(value);
      const unit = value.replace(numericValue.toString(), '');
      const adjustedValue = `${numericValue * fontSizeMultiplier}${unit}`;
      root.style.setProperty(`--font-size-${key}`, adjustedValue);
    });

    // カスタムプロパティの適用
    if (this.config.customProperties) {
      Object.entries(this.config.customProperties).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }

    // アニメーション設定
    root.style.setProperty('--animation-duration', this.config.animations ? '0.2s' : '0s');
    
    // リデュースドモーション設定
    if (this.config.reducedMotion) {
      root.style.setProperty('--motion-reduce', 'reduce');
    } else {
      root.style.setProperty('--motion-reduce', 'no-preference');
    }

    // データ属性でテーマを識別
    document.body.setAttribute('data-theme', resolvedMode);
    document.body.setAttribute('data-font-size', this.config.fontSize || 'normal');
    document.body.setAttribute('data-animations', this.config.animations ? 'enabled' : 'disabled');
    document.body.setAttribute('data-reduced-motion', this.config.reducedMotion ? 'reduce' : 'no-preference');
  }

  /**
   * メディアクエリリスナーを設定
   */
  private setupMediaQueryListener(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', () => {
        if (this.currentTheme === 'auto') {
          this.applyTheme();
          this.notifyListeners();
        }
      });
    }
  }

  /**
   * 設定をロード
   */
  private loadConfiguration(): void {
    try {
      const stored = localStorage.getItem('theme-config');
      if (stored) {
        const loadedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...loadedConfig };
        this.currentTheme = this.config.mode;
      }
    } catch (error) {
      console.error('Failed to load theme configuration:', error);
    }
  }

  /**
   * 設定を保存
   */
  private saveConfiguration(): void {
    try {
      localStorage.setItem('theme-config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save theme configuration:', error);
    }
  }

  /**
   * リスナーに通知
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentTheme, this.config);
      } catch (error) {
        console.error('Error in theme listener:', error);
      }
    });
  }

  /**
   * camelCaseをkebab-caseに変換
   */
  private kebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * テーマをトグル（light <-> dark）
   */
  toggleTheme(): void {
    const currentResolved = this.resolveThemeMode();
    if (currentResolved === 'light') {
      this.setTheme('dark');
    } else {
      this.setTheme('light');
    }
  }

  /**
   * システムテーマに従う
   */
  setAutoTheme(): void {
    this.setTheme('auto');
  }

  /**
   * 設定をリセット
   */
  resetToDefaults(): void {
    this.config = {
      mode: 'auto',
      animations: true,
      fontSize: 'normal',
      reducedMotion: false
    };
    this.currentTheme = 'auto';
    this.applyTheme();
    this.saveConfiguration();
    this.notifyListeners();
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
      if (typeof importedConfig !== 'object') {
        throw new Error('Invalid configuration format');
      }
      
      this.updateConfig(importedConfig);
      return true;
    } catch (error) {
      console.error('Failed to import theme configuration:', error);
      return false;
    }
  }

  /**
   * 現在のテーマのCSS変数を取得
   */
  getCurrentThemeVariables(): Record<string, string> {
    const resolvedMode = this.resolveThemeMode();
    const theme = this.themes.get(resolvedMode);
    
    if (!theme) return {};

    const variables: Record<string, string> = {};
    
    Object.entries(theme.colors).forEach(([key, value]) => {
      variables[`--color-${this.kebabCase(key)}`] = value;
    });

    Object.entries(theme.shadows).forEach(([key, value]) => {
      variables[`--shadow-${key}`] = value;
    });

    Object.entries(theme.spacing).forEach(([key, value]) => {
      variables[`--spacing-${key}`] = value;
    });

    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      variables[`--border-radius-${key}`] = value;
    });

    Object.entries(theme.fontSize).forEach(([key, value]) => {
      variables[`--font-size-${key}`] = value;
    });

    return variables;
  }
}