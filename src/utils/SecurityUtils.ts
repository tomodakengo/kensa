import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface EncryptionOptions {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
}

export interface PermissionOptions {
  read?: boolean;
  write?: boolean;
  execute?: boolean;
}

export class SecurityUtils {
  private static readonly DEFAULT_KEY_LENGTH = 32;
  private static readonly DEFAULT_IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 16;

  /**
   * データの暗号化
   */
  static encrypt(data: string, password: string, options: EncryptionOptions = {}): string {
    const {
      algorithm = 'aes-256-cbc',
      keyLength = this.DEFAULT_KEY_LENGTH,
      ivLength = this.DEFAULT_IV_LENGTH
    } = options;

    try {
      // ソルトの生成
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      
      // パスワードからキーを導出
      const key = crypto.pbkdf2Sync(password, salt, 100000, keyLength, 'sha256');
      
      // 初期化ベクターの生成
      const iv = crypto.randomBytes(ivLength);
      
      // 暗号化
      const cipher = crypto.createCipher(algorithm, key);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // 結果の結合: salt + iv + encrypted
      const result = Buffer.concat([
        salt,
        iv,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return result.toString('base64');
    } catch (error) {
      throw new Error(`暗号化に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * データの復号化
   */
  static decrypt(encryptedData: string, password: string, options: EncryptionOptions = {}): string {
    const {
      algorithm = 'aes-256-cbc',
      keyLength = this.DEFAULT_KEY_LENGTH,
      ivLength = this.DEFAULT_IV_LENGTH
    } = options;

    try {
      const data = Buffer.from(encryptedData, 'base64');
      
      // データの分割
      const salt = data.subarray(0, this.SALT_LENGTH);
      const encrypted = data.subarray(this.SALT_LENGTH + ivLength);
      
      // パスワードからキーを導出
      const key = crypto.pbkdf2Sync(password, salt, 100000, keyLength, 'sha256');
      
      // 復号化
      const decipher = crypto.createDecipher(algorithm, key);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`復号化に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ハッシュ値の生成
   */
  static generateHash(data: string, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * セキュアなランダム文字列の生成
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * ファイル権限のチェック
   */
  static checkFilePermissions(filePath: string, permissions: PermissionOptions = {}): {
    hasPermission: boolean;
    missingPermissions: string[];
  } {
    const { read = false, write = false, execute = false } = permissions;
    const missingPermissions: string[] = [];

    try {
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        return { hasPermission: false, missingPermissions: ['ファイルが存在しません'] };
      }

      // アクセス権限の確認
      if (read) {
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
        } catch {
          missingPermissions.push('読み取り権限');
        }
      }

      if (write) {
        try {
          fs.accessSync(filePath, fs.constants.W_OK);
        } catch {
          missingPermissions.push('書き込み権限');
        }
      }

      if (execute) {
        try {
          fs.accessSync(filePath, fs.constants.X_OK);
        } catch {
          missingPermissions.push('実行権限');
        }
      }

      return {
        hasPermission: missingPermissions.length === 0,
        missingPermissions
      };
    } catch (error) {
      return { hasPermission: false, missingPermissions: ['権限チェックエラー'] };
    }
  }

  /**
   * ディレクトリ権限のチェック
   */
  static checkDirectoryPermissions(dirPath: string, permissions: PermissionOptions = {}): {
    hasPermission: boolean;
    missingPermissions: string[];
  } {
    const { read = false, write = false } = permissions;
    const missingPermissions: string[] = [];

    try {
      // ディレクトリの存在確認
      if (!fs.existsSync(dirPath)) {
        return { hasPermission: false, missingPermissions: ['ディレクトリが存在しません'] };
      }

      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        return { hasPermission: false, missingPermissions: ['指定されたパスはディレクトリではありません'] };
      }

      // アクセス権限の確認
      if (read) {
        try {
          fs.accessSync(dirPath, fs.constants.R_OK);
        } catch {
          missingPermissions.push('読み取り権限');
        }
      }

      if (write) {
        try {
          fs.accessSync(dirPath, fs.constants.W_OK);
        } catch {
          missingPermissions.push('書き込み権限');
        }
      }

      return {
        hasPermission: missingPermissions.length === 0,
        missingPermissions
      };
    } catch (error) {
      return { hasPermission: false, missingPermissions: ['権限チェックエラー'] };
    }
  }

  /**
   * セキュアな設定ファイルの保存
   */
  static saveSecureConfig(configPath: string, config: any, password?: string): void {
    try {
      const configDir = path.dirname(configPath);
      
      // ディレクトリの作成（権限 700）
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
      }

      const configData = JSON.stringify(config, null, 2);
      
      if (password) {
        // 暗号化して保存
        const encryptedData = this.encrypt(configData, password);
        fs.writeFileSync(configPath, encryptedData, { mode: 0o600 });
      } else {
        // 平文で保存（制限された権限）
        fs.writeFileSync(configPath, configData, { mode: 0o600 });
      }
    } catch (error) {
      throw new Error(`設定ファイルの保存に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * セキュアな設定ファイルの読み込み
   */
  static loadSecureConfig<T>(configPath: string, password?: string): T {
    try {
      if (!fs.existsSync(configPath)) {
        throw new Error('設定ファイルが存在しません');
      }

      // 権限チェック
      const permissionCheck = this.checkFilePermissions(configPath, { read: true });
      if (!permissionCheck.hasPermission) {
        throw new Error(`設定ファイルの読み取り権限がありません: ${permissionCheck.missingPermissions.join(', ')}`);
      }

      const fileData = fs.readFileSync(configPath, 'utf8');
      
      if (password) {
        // 復号化
        const decryptedData = this.decrypt(fileData, password);
        return JSON.parse(decryptedData);
      } else {
        // 平文
        return JSON.parse(fileData);
      }
    } catch (error) {
      throw new Error(`設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 安全な一時ディレクトリの作成
   */
  static createSecureTempDirectory(prefix: string = 'ui-automation-'): string {
    try {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
      
      // 権限を制限（所有者のみアクセス可能）
      fs.chmodSync(tempDir, 0o700);
      
      return tempDir;
    } catch (error) {
      throw new Error(`安全な一時ディレクトリの作成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 一時ディレクトリの安全な削除
   */
  static removeSecureTempDirectory(tempDir: string): void {
    try {
      if (fs.existsSync(tempDir)) {
        // ディレクトリ内のファイルを再帰的に削除
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      throw new Error(`一時ディレクトリの削除に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * セキュアなファイル削除（上書き削除）
   */
  static secureDeleteFile(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        throw new Error('指定されたパスはファイルではありません');
      }

      const fileSize = stats.size;
      
      // ファイルを0で上書き
      const zeros = Buffer.alloc(fileSize, 0);
      fs.writeFileSync(filePath, zeros);
      
      // ファイルをランダムデータで上書き
      const randomData = crypto.randomBytes(fileSize);
      fs.writeFileSync(filePath, randomData);
      
      // 最終的にファイルを削除
      fs.unlinkSync(filePath);
    } catch (error) {
      throw new Error(`セキュアファイル削除に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * プロセス権限のチェック
   */
  static checkProcessPermissions(): {
    isAdmin: boolean;
    currentUser: string;
    platform: string;
  } {
    const platform = os.platform();
    const currentUser = os.userInfo().username;
    let isAdmin = false;

    // Windowsでの管理者権限チェック
    if (platform === 'win32') {
      try {
        // 管理者権限が必要な操作を試行
        fs.accessSync('C:\\Windows\\System32', fs.constants.W_OK);
        isAdmin = true;
      } catch {
        isAdmin = false;
      }
    }

    return {
      isAdmin,
      currentUser,
      platform
    };
  }

  /**
   * 入力データのサニタイゼーション
   */
  static sanitizeInput(input: string, options: {
    removeHTML?: boolean;
    removeSQL?: boolean;
    maxLength?: number;
  } = {}): string {
    const { removeHTML = true, removeSQL = true, maxLength = 1000 } = options;
    let sanitized = input;

    // 長さ制限
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // HTML除去
    if (removeHTML) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // SQL予約語の除去
    if (removeSQL) {
      const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER'];
      for (const keyword of sqlKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        sanitized = sanitized.replace(regex, '');
      }
    }

    // 危険な文字の除去
    sanitized = sanitized.replace(/[<>'"&;]/g, '');

    return sanitized.trim();
  }
}