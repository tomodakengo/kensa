import { UIAutomationClient } from './UIAutomationClient';
import { I18nManager } from '../utils/I18nManager';

export interface SimplePageOptions {
  timeout?: number;
  debug?: boolean;
}

export interface SimpleScreenshotOptions {
  path?: string;
  fullPage?: boolean;
}

export interface SimpleWaitOptions {
  timeout?: number;
  visible?: boolean;
}

/**
 * Playwright-like API を提供するシンプルなラッパークラス
 */
export class SimplePlaywrightAPI {
  private client: UIAutomationClient;
  private i18n: I18nManager;
  private options: Required<SimplePageOptions>;

  constructor(options: SimplePageOptions = {}) {
    this.client = new UIAutomationClient();
    this.i18n = I18nManager.getInstance();
    this.options = {
      timeout: options.timeout || 30000,
      debug: options.debug || false
    };
  }

  /**
   * アプリケーションの起動または URL の移動
   */
  async goto(url: string): Promise<void> {
    try {
      if (url.endsWith('.exe') || url.includes('\\')) {
        // Windows アプリケーションの起動
        await this.startApplication(url);
      } else {
        // URL をブラウザで開く
        await this.openUrl(url);
      }
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Navigated to: ${url}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: ${error}`);
    }
  }

  /**
   * ページの再読み込み
   */
  async reload(): Promise<void> {
    try {
      await this.sendKeys('F5');
      await this.waitForTimeout(2000);
      
      if (this.options.debug) {
        console.log('[SimplePlaywright] Page reloaded');
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: ${error}`);
    }
  }

  /**
   * 要素のクリック
   */
  async click(selector: string): Promise<void> {
    try {
      await this.client.clickBySelector(selector);
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Clicked: ${selector}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Failed to click ${selector}: ${error}`);
    }
  }

  /**
   * 要素への入力
   */
  async fill(selector: string, value: string): Promise<void> {
    try {
      await this.client.fillBySelector(selector, value);
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Filled ${selector} with: ${value}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Failed to fill ${selector}: ${error}`);
    }
  }

  /**
   * 要素のタイプ
   */
  async type(selector: string, text: string): Promise<void> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const element = await this.client.findElement(criteria);
      
      if (element) {
        await this.client.type(element, text);
        
        if (this.options.debug) {
          console.log(`[SimplePlaywright] Typed into ${selector}: ${text}`);
        }
      } else {
        throw new Error(`Element not found: ${selector}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Failed to type into ${selector}: ${error}`);
    }
  }

  /**
   * 要素のホバー
   */
  async hover(selector: string): Promise<void> {
    try {
      await this.client.hoverBySelector(selector);
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Hovered: ${selector}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Failed to hover ${selector}: ${error}`);
    }
  }

  /**
   * 要素の存在確認
   */
  async isVisible(selector: string): Promise<boolean> {
    try {
      return await this.client.isVisibleBySelector(selector);
    } catch (error) {
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Visibility check failed for ${selector}: ${error}`);
      }
      return false;
    }
  }

  /**
   * 要素のテキスト取得
   */
  async textContent(selector: string): Promise<string> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const element = await this.client.findElement(criteria);
      
      if (element) {
        return await this.client.getText(element);
      }
      
      return '';
    } catch (error) {
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Text content failed for ${selector}: ${error}`);
      }
      return '';
    }
  }

  /**
   * 要素の値取得
   */
  async inputValue(selector: string): Promise<string> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const element = await this.client.findElement(criteria);
      
      if (element) {
        return await this.client.getValue(element);
      }
      
      return '';
    } catch (error) {
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Input value failed for ${selector}: ${error}`);
      }
      return '';
    }
  }

  /**
   * 要素の待機
   */
  async waitForSelector(selector: string, options: SimpleWaitOptions = {}): Promise<void> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const waitOptions = {
        timeout: options.timeout || this.options.timeout,
        visible: options.visible ?? true
      };
      
      const element = await this.client.waitForSelector(criteria, waitOptions);
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Waited for: ${selector}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Failed to wait for ${selector}: ${error}`);
    }
  }

  /**
   * スクリーンショット撮影
   */
  async screenshot(options: SimpleScreenshotOptions = {}): Promise<Buffer> {
    try {
      const tempPath = await this.takeFullScreenshot();
      const fs = await import('fs-extra');
      const data = await fs.readFile(tempPath);
      
      if (options.path) {
        await fs.copyFile(tempPath, options.path);
      }
      
      // 一時ファイルを削除
      await fs.unlink(tempPath);
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Screenshot taken${options.path ? ` and saved to: ${options.path}` : ''}`);
      }
      
      return data;
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Screenshot failed: ${error}`);
    }
  }

  /**
   * 指定時間待機
   */
  async waitForTimeout(timeout: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, timeout));
    
    if (this.options.debug) {
      console.log(`[SimplePlaywright] Waited for ${timeout}ms`);
    }
  }

  /**
   * キーボード入力
   */
  async keyboard(key: string): Promise<void> {
    try {
      await this.sendKeys(key);
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Keyboard input: ${key}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Keyboard input failed: ${error}`);
    }
  }

  /**
   * マウスクリック（座標指定）
   */
  async clickAt(x: number, y: number): Promise<void> {
    try {
      await this.client.clickAt({ x, y });
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Clicked at: (${x}, ${y})`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Click at coordinates failed: ${error}`);
    }
  }

  /**
   * マウス移動
   */
  async moveMouse(x: number, y: number): Promise<void> {
    try {
      await this.client.moveMouse(x, y);
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Mouse moved to: (${x}, ${y})`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Mouse move failed: ${error}`);
    }
  }

  /**
   * ダブルクリック
   */
  async doubleClick(selector: string): Promise<void> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const element = await this.client.findElement(criteria);
      
      if (element) {
        await this.client.doubleClick(element);
        
        if (this.options.debug) {
          console.log(`[SimplePlaywright] Double-clicked: ${selector}`);
        }
      } else {
        throw new Error(`Element not found: ${selector}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Double-click failed: ${error}`);
    }
  }

  /**
   * チェックボックスのチェック
   */
  async check(selector: string): Promise<void> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const element = await this.client.findElement(criteria);
      
      if (element) {
        await this.client.check(element);
        
        if (this.options.debug) {
          console.log(`[SimplePlaywright] Checked: ${selector}`);
        }
      } else {
        throw new Error(`Element not found: ${selector}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Check failed: ${error}`);
    }
  }

  /**
   * チェックボックスのチェック解除
   */
  async uncheck(selector: string): Promise<void> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const element = await this.client.findElement(criteria);
      
      if (element) {
        await this.client.uncheck(element);
        
        if (this.options.debug) {
          console.log(`[SimplePlaywright] Unchecked: ${selector}`);
        }
      } else {
        throw new Error(`Element not found: ${selector}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Uncheck failed: ${error}`);
    }
  }

  /**
   * チェック状態の確認
   */
  async isChecked(selector: string): Promise<boolean> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const element = await this.client.findElement(criteria);
      
      if (element) {
        return await this.client.isChecked(element);
      }
      
      return false;
    } catch (error) {
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Check state failed for ${selector}: ${error}`);
      }
      return false;
    }
  }

  /**
   * オプション選択
   */
  async selectOption(selector: string, value: string): Promise<void> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const element = await this.client.findElement(criteria);
      
      if (element) {
        await this.client.selectOption(element, value);
        
        if (this.options.debug) {
          console.log(`[SimplePlaywright] Selected option ${value} in: ${selector}`);
        }
      } else {
        throw new Error(`Element not found: ${selector}`);
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Select option failed: ${error}`);
    }
  }

  /**
   * 要素の数を取得
   */
  async count(selector: string): Promise<number> {
    try {
      const criteria = this.selectorToCriteria(selector);
      const elements = await this.client.findElements(criteria);
      
      return elements.length;
    } catch (error) {
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Count failed for ${selector}: ${error}`);
      }
      return 0;
    }
  }

  /**
   * 要素の検査（座標指定）
   */
  async inspectElementAt(x: number, y: number): Promise<any> {
    try {
      const element = await this.client.inspectElement({ x, y });
      
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Inspected element at: (${x}, ${y})`);
      }
      
      return element;
    } catch (error) {
      if (this.options.debug) {
        console.log(`[SimplePlaywright] Inspect failed at (${x}, ${y}): ${error}`);
      }
      return null;
    }
  }

  /**
   * アプリケーションを閉じる
   */
  async close(): Promise<void> {
    try {
      await this.sendKeys('Alt+F4');
      
      if (this.options.debug) {
        console.log('[SimplePlaywright] Application closed');
      }
    } catch (error) {
      throw new Error(this.i18n.t('messages.error') + `: Close failed: ${error}`);
    }
  }

  /**
   * デバッグモードの設定
   */
  setDebugMode(enabled: boolean): void {
    this.options.debug = enabled;
  }

  /**
   * タイムアウトの設定
   */
  setDefaultTimeout(timeout: number): void {
    this.options.timeout = timeout;
  }

  // プライベートメソッド

  private selectorToCriteria(selector: string): any {
    if (selector.startsWith('#')) {
      return { automationId: selector.substring(1) };
    } else if (selector.startsWith('.')) {
      return { className: selector.substring(1) };
    } else if (selector.includes('[') && selector.includes(']')) {
      const match = selector.match(/\[(\w+)=?"?([^"]*)"?\]/);
      if (match && match[1] && match[2] !== undefined) {
        const key = match[1] as string;
        const value = match[2] as string;
        return { [key]: value };
      }
    }
    return { name: selector };
  }

  private async startApplication(path: string): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    await execAsync(`start "" "${path}"`);
    await this.waitForTimeout(2000);
  }

  private async openUrl(url: string): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    await execAsync(`start "" "${url}"`);
    await this.waitForTimeout(2000);
  }

  private async sendKeys(keys: string): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("${keys}")
    `;
    
    await execAsync(`powershell -Command "${script}"`);
  }

  private async takeFullScreenshot(): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { join } = await import('path');
    const { tmpdir } = await import('os');
    const execAsync = promisify(exec);
    
    const tempPath = join(tmpdir(), `screenshot-${Date.now()}.png`);
    
    const script = `
      Add-Type -AssemblyName System.Drawing
      Add-Type -AssemblyName System.Windows.Forms
      
      $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
      
      $bitmap.Save("${tempPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bitmap.Dispose()
    `;
    
    await execAsync(`powershell -Command "${script}"`);
    return tempPath;
  }
}

/**
 * 使いやすいファクトリー関数
 */
export function createPlaywrightPage(options: SimplePageOptions = {}): SimplePlaywrightAPI {
  return new SimplePlaywrightAPI(options);
}