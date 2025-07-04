import * as path from 'path';
import * as fs from 'fs';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationOptions {
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  required?: boolean;
  allowEmpty?: boolean;
  sanitize?: boolean;
}

export class ValidationUtils {

  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /['"]/g,                        // Quotes
    /--/g,                          // SQL comments
    /\/\*/g,                        // Block comments
    /\*\//g,                        // Block comments end
    /;/g,                           // Statement separator
    /\||&/g,                        // Logical operators
    /\bOR\b|\bAND\b/gi             // SQL operators
  ];

  private static readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /data:image\/svg\+xml/gi
  ];

  /**
   * 文字列の基本検証
   */
  static validateString(value: string, options: ValidationOptions = {}): ValidationResult {
    const errors: string[] = [];
    const {
      maxLength = 1000,
      minLength = 0,
      pattern,
      required = false,
      allowEmpty = true,
      sanitize = false
    } = options;

    // 必須チェック
    if (required && (!value || value.trim() === '')) {
      errors.push('値が必須です');
      return { isValid: false, errors };
    }

    // 空文字チェック
    if (!allowEmpty && value === '') {
      errors.push('空の値は許可されていません');
    }

    // 長さチェック
    if (value.length > maxLength) {
      errors.push(`文字数は${maxLength}文字以内で入力してください`);
    }

    if (value.length < minLength) {
      errors.push(`文字数は${minLength}文字以上で入力してください`);
    }

    // パターンチェック
    if (pattern && !pattern.test(value)) {
      errors.push('入力形式が正しくありません');
    }

    // サニタイズ
    if (sanitize) {
      const sanitized = this.sanitizeString(value);
      if (sanitized !== value) {
        errors.push('危険な文字が含まれています');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * ファイルパスの検証
   */
  static validateFilePath(filePath: string, options: {
    mustExist?: boolean;
    allowedExtensions?: string[];
    baseDirectory?: string;
    maxDepth?: number;
  } = {}): ValidationResult {
    const errors: string[] = [];
    const {
      mustExist = false,
      allowedExtensions = [],
      baseDirectory,
      maxDepth = 10
    } = options;

    // パス トラバーサル攻撃の検出
    if (filePath.includes('..')) {
      errors.push('パストラバーサル攻撃が検出されました');
    }

    // 絶対パスの検証
    if (path.isAbsolute(filePath) && baseDirectory) {
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(baseDirectory);
      
      if (!resolvedPath.startsWith(resolvedBase)) {
        errors.push('許可されたディレクトリ外のパスです');
      }
    }

    // 拡張子の検証
    if (allowedExtensions.length > 0) {
      const ext = path.extname(filePath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        errors.push(`許可されていない拡張子です: ${ext}`);
      }
    }

    // ディレクトリの深さチェック
    const depth = filePath.split(path.sep).length;
    if (depth > maxDepth) {
      errors.push(`ディレクトリの深さが制限を超えています: ${depth}`);
    }

    // ファイルの存在チェック
    if (mustExist) {
      try {
        if (!fs.existsSync(filePath)) {
          errors.push('ファイルが存在しません');
        }
      } catch (error) {
        errors.push('ファイルアクセスエラーが発生しました');
      }
    }

    // 危険な文字の検出
    const dangerousChars = /[<>:"|?*\x00-\x1F]/;
    if (dangerousChars.test(filePath)) {
      errors.push('ファイルパスに危険な文字が含まれています');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * SQLインジェクション攻撃の検出
   */
  static validateSQLInput(input: string): ValidationResult {
    const errors: string[] = [];

    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        errors.push('SQLインジェクション攻撃が検出されました');
        break;
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * XSS攻撃の検出
   */
  static validateXSSInput(input: string): ValidationResult {
    const errors: string[] = [];

    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        errors.push('XSS攻撃が検出されました');
        break;
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 文字列のサニタイズ
   */
  static sanitizeString(input: string): string {
    let sanitized = input;
    
    // HTMLエスケープ
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // 制御文字の除去
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * SQLクエリのサニタイズ
   */
  static sanitizeSQLInput(input: string): string {
    return input
      .replace(/'/g, "''")  // シングルクォートのエスケープ
      .replace(/\\/g, '\\\\')  // バックスラッシュのエスケープ
      .replace(/\x00/g, '\\0')  // NULL文字のエスケープ
      .replace(/\n/g, '\\n')  // 改行のエスケープ
      .replace(/\r/g, '\\r')  // 復帰のエスケープ
      .replace(/\x1a/g, '\\Z'); // Ctrl+Zのエスケープ
  }

  /**
   * JSONの検証
   */
  static validateJSON(jsonString: string): ValidationResult {
    const errors: string[] = [];

    try {
      JSON.parse(jsonString);
    } catch (error) {
      errors.push('無効なJSON形式です');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * メールアドレスの検証
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      errors.push('無効なメールアドレス形式です');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * URLの検証
   */
  static validateURL(url: string): ValidationResult {
    const errors: string[] = [];

    try {
      new URL(url);
    } catch {
      errors.push('無効なURL形式です');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 数値の検証
   */
  static validateNumber(value: string, options: {
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}): ValidationResult {
    const errors: string[] = [];
    const { min, max, integer = false } = options;

    const num = Number(value);

    if (isNaN(num)) {
      errors.push('数値ではありません');
      return { isValid: false, errors };
    }

    if (integer && !Number.isInteger(num)) {
      errors.push('整数である必要があります');
    }

    if (min !== undefined && num < min) {
      errors.push(`値は${min}以上である必要があります`);
    }

    if (max !== undefined && num > max) {
      errors.push(`値は${max}以下である必要があります`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 複数の検証を実行
   */
  static validateMultiple(validations: ValidationResult[]): ValidationResult {
    const allErrors: string[] = [];
    let isValid = true;

    for (const validation of validations) {
      if (!validation.isValid) {
        isValid = false;
        allErrors.push(...validation.errors);
      }
    }

    return { isValid, errors: allErrors };
  }

  /**
   * 文字列の配列の検証
   */
  static validateStringArray(values: string[], options: ValidationOptions = {}): ValidationResult {
    const errors: string[] = [];

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (value !== undefined) {
        const result = this.validateString(value, options);
        if (!result.isValid) {
          errors.push(`インデックス${i}: ${result.errors.join(', ')}`);
        }
      } else {
        errors.push(`インデックス${i}: 値がundefinedです`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}