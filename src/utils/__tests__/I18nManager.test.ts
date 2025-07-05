import { I18nManager, SupportedLanguage } from '../I18nManager';

// localStorageをモック
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// navigatorをモック
const navigatorMock = {
  language: 'ja-JP',
  languages: ['ja-JP', 'ja', 'en-US', 'en']
};
Object.defineProperty(global, 'navigator', {
  value: navigatorMock,
  writable: true
});

describe('I18nManager', () => {
  let i18n: I18nManager;

  beforeEach(() => {
    // シングルトンをリセット
    (I18nManager as any).instance = null;
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    
    i18n = I18nManager.getInstance();
  });

  describe('シングルトンパターン', () => {
    test('getInstance()で同じインスタンスが返される', () => {
      const instance1 = I18nManager.getInstance();
      const instance2 = I18nManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('言語設定', () => {
    test('デフォルト言語が日本語に設定される', () => {
      expect(i18n.getCurrentLanguage()).toBe('ja');
    });

    test('有効な言語に変更できる', () => {
      i18n.setLanguage('en');
      expect(i18n.getCurrentLanguage()).toBe('en');
    });

    test('無効な言語は設定されない', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const currentLang = i18n.getCurrentLanguage();
      
      i18n.setLanguage('invalid' as SupportedLanguage);
      
      expect(i18n.getCurrentLanguage()).toBe(currentLang);
      expect(consoleSpy).toHaveBeenCalledWith('Unsupported language: invalid');
      
      consoleSpy.mockRestore();
    });
  });

  describe('翻訳機能', () => {
    test('日本語の翻訳が取得できる', () => {
      i18n.setLanguage('ja');
      const translated = i18n.t('app.title');
      expect(translated).toBe('Windows UI Automation Test Tool');
    });

    test('英語の翻訳が取得できる', () => {
      i18n.setLanguage('en');
      const translated = i18n.t('app.title');
      expect(translated).toBe('Windows UI Automation Test Tool');
    });

    test('存在しないキーの場合キー自体が返される', () => {
      const translated = i18n.t('nonexistent.key');
      expect(translated).toBe('nonexistent.key');
    });

    test('パラメータ補間が正常に動作する', () => {
      // メッセージにパラメータ補間用のテンプレートを追加
      i18n.addTranslations('ja', {
        test: {
          greeting: 'こんにちは、{{name}}さん'
        }
      });

      const translated = i18n.t('test.greeting', { name: '太郎' });
      expect(translated).toBe('こんにちは、太郎さん');
    });
  });

  describe('サポート言語', () => {
    test('サポート言語一覧が取得できる', () => {
      const languages = i18n.getSupportedLanguages();
      
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBe(4);
      expect(languages.find(lang => lang.code === 'ja')).toBeDefined();
      expect(languages.find(lang => lang.code === 'en')).toBeDefined();
      expect(languages.find(lang => lang.code === 'zh')).toBeDefined();
      expect(languages.find(lang => lang.code === 'ko')).toBeDefined();
    });

    test('言語がサポートされているかチェックできる', () => {
      expect(i18n.isLanguageSupported('ja')).toBe(true);
      expect(i18n.isLanguageSupported('en')).toBe(true);
      expect(i18n.isLanguageSupported('invalid')).toBe(false);
    });

    test('言語定義が取得できる', () => {
      const jaDefinition = i18n.getLanguageDefinition('ja');
      
      expect(jaDefinition).toBeDefined();
      expect(jaDefinition?.code).toBe('ja');
      expect(jaDefinition?.name).toBe('Japanese');
      expect(jaDefinition?.nativeName).toBe('日本語');
      expect(jaDefinition?.flag).toBe('🇯🇵');
    });
  });

  describe('翻訳の存在確認', () => {
    test('存在する翻訳キーが正しく判定される', () => {
      expect(i18n.hasTranslation('app.title')).toBe(true);
      expect(i18n.hasTranslation('nonexistent.key')).toBe(false);
    });

    test('特定言語での翻訳存在確認ができる', () => {
      expect(i18n.hasTranslation('app.title', 'ja')).toBe(true);
      expect(i18n.hasTranslation('app.title', 'en')).toBe(true);
    });
  });

  describe('複数形対応', () => {
    test('tn()メソッドで複数形が処理される', () => {
      // テスト用の複数形翻訳を追加
      i18n.addTranslations('en', {
        items: {
          one: '1 item',
          other: '{{count}} items'
        }
      });

      i18n.setLanguage('en');
      
      expect(i18n.tn('items', 1)).toBe('1 item');
      expect(i18n.tn('items', 5)).toBe('5 items');
    });
  });

  describe('地域化フォーマット', () => {
    test('日付のフォーマットができる', () => {
      const date = new Date('2024-01-01');
      
      i18n.setLanguage('ja');
      const jaFormatted = i18n.formatDate(date);
      expect(typeof jaFormatted).toBe('string');
      
      i18n.setLanguage('en');
      const enFormatted = i18n.formatDate(date);
      expect(typeof enFormatted).toBe('string');
    });

    test('数値のフォーマットができる', () => {
      const number = 12345.67;
      
      i18n.setLanguage('ja');
      const jaFormatted = i18n.formatNumber(number);
      expect(typeof jaFormatted).toBe('string');
      
      i18n.setLanguage('en');
      const enFormatted = i18n.formatNumber(number);
      expect(typeof enFormatted).toBe('string');
    });
  });

  describe('永続化', () => {
    test('言語設定が永続化される', () => {
      i18n.setLanguage('en');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('app-language', 'en');
    });
  });

  describe('言語変更リスナー', () => {
    test('言語変更リスナーが正常に動作する', () => {
      const listener = jest.fn();
      
      i18n.addLanguageChangeListener(listener);
      i18n.setLanguage('en');
      
      expect(listener).toHaveBeenCalledWith('en');
      
      i18n.removeLanguageChangeListener(listener);
      i18n.setLanguage('zh');
      
      expect(listener).toHaveBeenCalledTimes(1); // 削除後は呼ばれない
    });
  });

  describe('翻訳データの追加', () => {
    test('新しい翻訳データを追加できる', () => {
      const newTranslations = {
        custom: {
          message: 'カスタムメッセージ'
        }
      };

      i18n.addTranslations('ja', newTranslations);
      
      expect(i18n.t('custom.message')).toBe('カスタムメッセージ');
    });
  });

  describe('リセット機能', () => {
    test('設定をリセットできる', () => {
      i18n.setLanguage('en');
      i18n.reset();
      
      expect(i18n.getCurrentLanguage()).toBe('ja'); // デフォルトに戻る
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('app-language');
    });
  });
});