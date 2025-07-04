import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ElementCriteria {
  automationId?: string;
  name?: string;
  className?: string;
  controlType?: string;
  parentHandle?: number;
}

interface ElementHandle {
  handle: number;
  automationId?: string;
  name?: string;
  className?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface WindowInfo {
  processId: number;
  title: string;
  className: string;
  handle: number;
}

interface WaitOptions {
  timeout?: number;
  visible?: boolean;
}

export interface UIElement {
  id: string;
  name: string;
  className: string;
  automationId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isEnabled: boolean;
  isVisible: boolean;
}

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
  delay?: number;
}

export interface TypeOptions {
  delay?: number;
  clearFirst?: boolean;
}

export class UIAutomationClient {
  private isRecording = false;
  private recordedActions: any[] = [];

  constructor() {
    // PowerShellベースのUI Automationクライアント
  }

  /**
   * ウィンドウリストを取得する
   */
  async getWindowList(): Promise<WindowInfo[]> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $desktop = [System.Windows.Automation.AutomationElement]::RootElement
        $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)
        $topWindows = $desktop.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
        
        $windows = @()
        foreach($window in $topWindows) {
          $windows += @{
            processId = $window.Current.ProcessId
            title = $window.Current.Name
            className = $window.Current.ClassName
            handle = $window.Current.NativeWindowHandle
          }
        }
        
        $windows | ConvertTo-Json
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Get window list failed:', error);
      return [];
    }
  }

  /**
   * 要素を検索する
   */
  async findElement(criteria: ElementCriteria): Promise<ElementHandle | null> {
    try {
      const conditions = [];
      if (criteria.automationId) conditions.push(`[System.Windows.Automation.AutomationElement]::AutomationIdProperty, "${criteria.automationId}"`);
      if (criteria.name) conditions.push(`[System.Windows.Automation.AutomationElement]::NameProperty, "${criteria.name}"`);
      if (criteria.className) conditions.push(`[System.Windows.Automation.AutomationElement]::ClassNameProperty, "${criteria.className}"`);

      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $desktop = [System.Windows.Automation.AutomationElement]::RootElement
        $conditions = @(${conditions.map(c => `New-Object System.Windows.Automation.PropertyCondition(${c})`).join(', ')})
        
        if ($conditions.Count -eq 1) {
          $finalCondition = $conditions[0]
        } else {
          $finalCondition = New-Object System.Windows.Automation.AndCondition($conditions)
        }
        
        $element = $desktop.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $finalCondition)
        
        if ($element -ne $null) {
          $result = @{
            handle = $element.Current.NativeWindowHandle
            automationId = $element.Current.AutomationId
            name = $element.Current.Name
            className = $element.Current.ClassName
            bounds = @{
              x = $element.Current.BoundingRectangle.X
              y = $element.Current.BoundingRectangle.Y
              width = $element.Current.BoundingRectangle.Width
              height = $element.Current.BoundingRectangle.Height
            }
          }
          $result | ConvertTo-Json
        }
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);

      if (stdout.trim()) {
        return JSON.parse(stdout);
      }

      return null;
    } catch (error) {
      console.error('Find element failed:', error);
      return null;
    }
  }

  /**
   * 要素をクリックする
   */
  async click(_element: ElementHandle, options: ClickOptions = {}): Promise<boolean> {
    const { button = 'left' } = options;

    try {
      // Implementation would go here
      console.log(`Clicking element with button: ${button}`);
      return true;
    } catch (error) {
      console.error('Click failed:', error);
      return false;
    }
  }

  /**
   * 要素にテキストを入力する
   */
  async type(_element: ElementHandle, text: string, options: TypeOptions = {}): Promise<boolean> {
    const { clearFirst = true } = options;

    try {
      // Implementation would go here
      console.log(`Typing "${text}" into element, clearFirst: ${clearFirst}`);
      return true;
    } catch (error) {
      console.error('Type failed:', error);
      return false;
    }
  }

  /**
   * 要素のテキストを取得する
   */
  async getText(element: ElementHandle): Promise<string> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        $element.Current.Name
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      return stdout.trim();
    } catch (error) {
      console.error('Get text failed:', error);
      return '';
    }
  }

  /**
   * 指定した座標の要素を検査する
   */
  async inspectElement(point: { x: number; y: number }): Promise<ElementHandle | null> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $point = [System.Windows.Point]::new(${point.x}, ${point.y})
        $element = [System.Windows.Automation.AutomationElement]::FromPoint($point)
        
        if ($element -ne $null) {
          $result = @{
            handle = $element.Current.NativeWindowHandle
            automationId = $element.Current.AutomationId
            name = $element.Current.Name
            className = $element.Current.ClassName
            bounds = @{
              x = $element.Current.BoundingRectangle.X
              y = $element.Current.BoundingRectangle.Y
              width = $element.Current.BoundingRectangle.Width
              height = $element.Current.BoundingRectangle.Height
            }
          }
          $result | ConvertTo-Json
        }
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);

      if (stdout.trim()) {
        return JSON.parse(stdout);
      }

      return null;
    } catch (error) {
      console.error('Inspect element failed:', error);
      return null;
    }
  }

  /**
   * 要素のプロパティを取得する
   */
  async getElementProperties(element: ElementHandle): Promise<any> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        
        $properties = @{
          automationId = $element.Current.AutomationId
          name = $element.Current.Name
          className = $element.Current.ClassName
          controlType = $element.Current.ControlType.ProgrammaticName
          isEnabled = $element.Current.IsEnabled
          isVisible = -not $element.Current.IsOffscreen
          bounds = @{
            x = $element.Current.BoundingRectangle.X
            y = $element.Current.BoundingRectangle.Y
            width = $element.Current.BoundingRectangle.Width
            height = $element.Current.BoundingRectangle.Height
          }
        }
        
        $properties | ConvertTo-Json
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Get element properties failed:', error);
      return {};
    }
  }

  /**
   * スクリーンショットを撮影する
   */
  async screenshot(element: ElementHandle): Promise<string> {
    try {
      const script = `
        Add-Type -AssemblyName System.Drawing
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        $bounds = $element.Current.BoundingRectangle
        
        $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
        
        $tempPath = [System.IO.Path]::GetTempFileName() + ".png"
        $bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()
        
        $tempPath
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      return stdout.trim();
    } catch (error) {
      console.error('Screenshot failed:', error);
      return '';
    }
  }

  /**
   * 要素を待機する
   */
  async waitForSelector(criteria: ElementCriteria, options: WaitOptions = {}): Promise<ElementHandle | null> {
    const { timeout = 5000, visible = true } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = await this.findElement(criteria);
      if (element) {
        if (!visible) return element;

        const properties = await this.getElementProperties(element);
        if (properties.isVisible) return element;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }

  /**
   * 要素にテキストを入力する（fillの別名）
   */
  async fill(element: ElementHandle, text: string): Promise<boolean> {
    return this.type(element, text);
  }

  /**
   * 要素をクリアする
   */
  async clear(element: ElementHandle): Promise<boolean> {
    return this.type(element, '');
  }

  /**
   * 要素をホバーする
   */
  async hover(element: ElementHandle): Promise<boolean> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        Add-Type -AssemblyName System.Windows.Forms
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        $clickablePoint = $element.GetClickablePoint()
        [System.Windows.Forms.Cursor]::Position = $clickablePoint
      `;

      await execAsync(`powershell -Command "${script}"`);

      if (this.isRecording) {
        this.recordedActions.push({
          type: 'hover',
          element,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      console.error('Hover failed:', error);
      return false;
    }
  }

  /**
   * マウスを移動する
   */
  async moveMouse(x: number, y: number): Promise<boolean> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x}, ${y})
      `;

      await execAsync(`powershell -Command "${script}"`);
      return true;
    } catch (error) {
      console.error('Move mouse failed:', error);
      return false;
    }
  }

  /**
   * ダブルクリックする
   */
  async doubleClick(element: ElementHandle | { x: number; y: number }): Promise<boolean> {
    try {
      if ('x' in element && 'y' in element) {
        // Click at coordinates
        await this.doubleClickAt(element.x, element.y);
      } else {
        // Click on element
        await this.doubleClickElement(element);
      }
      return true;
    } catch (error) {
      console.error('Double click failed:', error);
      return false;
    }
  }

  /**
   * 右クリックする
   */
  async rightClick(element: ElementHandle): Promise<boolean> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        Add-Type -AssemblyName System.Windows.Forms
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        $clickablePoint = $element.GetClickablePoint()
        [System.Windows.Forms.Cursor]::Position = $clickablePoint
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.SendKeys]::SendWait("{RIGHT}")
      `;

      await execAsync(`powershell -Command "${script}"`);
      return true;
    } catch (error) {
      console.error('Right click failed:', error);
      return false;
    }
  }

  /**
   * オプションを選択する
   */
  async selectOption(element: ElementHandle, value: string): Promise<boolean> {
    try {
      // Implementation depends on element type
      // For ComboBox or List controls
      await this.click(element);

      // Wait for dropdown to open
      await this.sleep(200);

      // Find option by value or text
      // This is a simplified implementation
      console.log(`Selecting option: ${value}`);
      return true;
    } catch (error) {
      console.error('Error selecting option:', error);
      return false;
    }
  }

  /**
   * チェックボックスをチェックする
   */
  async check(element: ElementHandle): Promise<boolean> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        
        $pattern = $null
        if ($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$pattern)) {
          $pattern.Toggle()
          return $true
        } else {
          return $false
        }
      `;

      await execAsync(`powershell -Command "${script}"`);
      return true;
    } catch (error) {
      console.error('Check failed:', error);
      return false;
    }
  }

  /**
   * チェックボックスのチェックを外す
   */
  async uncheck(element: ElementHandle): Promise<boolean> {
    return this.check(element); // TogglePatternは同じメソッドを使用
  }

  /**
   * チェックボックスがチェックされているか確認する
   */
  async isChecked(element: ElementHandle): Promise<boolean> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        
        $pattern = $null
        if ($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$pattern)) {
          $pattern.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On
        } else {
          $false
        }
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      return stdout.trim().toLowerCase() === 'true';
    } catch (error) {
      console.error('Is checked failed:', error);
      return false;
    }
  }

  /**
   * 要素の値を取得する
   */
  async getValue(element: ElementHandle): Promise<string> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        
        $pattern = $null
        if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
          $pattern.Current.Value
        } else {
          $element.Current.Name
        }
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      return stdout.trim();
    } catch (error) {
      console.error('Get value failed:', error);
      return '';
    }
  }

  /**
   * 要素にフォーカスがあるか確認する
   */
  async hasFocus(element: ElementHandle): Promise<boolean> {
    try {
      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $element = [System.Windows.Automation.AutomationElement]::FromHandle([System.IntPtr]::new(${element.handle}))
        $focusedElement = [System.Windows.Automation.AutomationElement]::FocusedElement
        
        $element.Current.AutomationId -eq $focusedElement.Current.AutomationId
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      return stdout.trim().toLowerCase() === 'true';
    } catch (error) {
      console.error('Has focus failed:', error);
      return false;
    }
  }

  /**
   * 複数の要素を検索する
   */
  async findElements(criteria: ElementCriteria): Promise<ElementHandle[]> {
    try {
      const conditions = [];
      if (criteria.automationId) conditions.push(`[System.Windows.Automation.AutomationElement]::AutomationIdProperty, "${criteria.automationId}"`);
      if (criteria.name) conditions.push(`[System.Windows.Automation.AutomationElement]::NameProperty, "${criteria.name}"`);
      if (criteria.className) conditions.push(`[System.Windows.Automation.AutomationElement]::ClassNameProperty, "${criteria.className}"`);

      const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $desktop = [System.Windows.Automation.AutomationElement]::RootElement
        $conditions = @(${conditions.map(c => `New-Object System.Windows.Automation.PropertyCondition(${c})`).join(', ')})
        
        if ($conditions.Count -eq 1) {
          $finalCondition = $conditions[0]
        } else {
          $finalCondition = New-Object System.Windows.Automation.AndCondition($conditions)
        }
        
        $elements = $desktop.FindAll([System.Windows.Automation.TreeScope]::Descendants, $finalCondition)
        
        $results = @()
        foreach($element in $elements) {
          $results += @{
            handle = $element.Current.NativeWindowHandle
            automationId = $element.Current.AutomationId
            name = $element.Current.Name
            className = $element.Current.ClassName
            bounds = @{
              x = $element.Current.BoundingRectangle.X
              y = $element.Current.BoundingRectangle.Y
              width = $element.Current.BoundingRectangle.Width
              height = $element.Current.BoundingRectangle.Height
            }
          }
        }
        
        $results | ConvertTo-Json
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);

      if (stdout.trim()) {
        return JSON.parse(stdout);
      }

      return [];
    } catch (error) {
      console.error('Find elements failed:', error);
      return [];
    }
  }

  /**
   * セレクターを使用して要素をクリックする
   */
  async clickBySelector(selector: string, options: ClickOptions = {}): Promise<void> {
    const { doubleClick = false } = options;

    try {
      const element = await this.findElement({ name: selector });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      if (doubleClick) {
        await this.doubleClick(element);
      } else {
        await this.click(element);
      }

      if (this.isRecording) {
        this.recordedActions.push({
          type: 'click',
          selector,
          options,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Click failed:', error);
      throw new Error(`Failed to click element: ${selector}`);
    }
  }

  /**
   * セレクターを使用して要素にテキストを入力する
   */
  async fillBySelector(selector: string, text: string, options: TypeOptions = {}): Promise<void> {
    const { clearFirst = true } = options;

    try {
      const element = await this.findElement({ name: selector });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      if (clearFirst) {
        await this.clear(element);
      }

      await this.type(element, text);

      if (this.isRecording) {
        this.recordedActions.push({
          type: 'fill',
          selector,
          text,
          options,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Fill failed:', error);
      throw new Error(`Failed to fill element: ${selector}`);
    }
  }

  /**
   * セレクターを使用して要素をホバーする
   */
  async hoverBySelector(selector: string): Promise<void> {
    try {
      const element = await this.findElement({ name: selector });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      await this.hover(element);

      if (this.isRecording) {
        this.recordedActions.push({
          type: 'hover',
          selector,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Hover failed:', error);
      throw new Error(`Failed to hover element: ${selector}`);
    }
  }

  /**
   * セレクターを使用して要素を取得する
   */
  async getElementBySelector(selector: string): Promise<UIElement | null> {
    try {
      const element = await this.findElement({ name: selector });
      if (!element) return null;

      const properties = await this.getElementProperties(element);

      return {
        id: properties.automationId || '',
        name: properties.name || '',
        className: properties.className || '',
        automationId: properties.automationId || '',
        x: properties.bounds.x,
        y: properties.bounds.y,
        width: properties.bounds.width,
        height: properties.bounds.height,
        isEnabled: properties.isEnabled,
        isVisible: properties.isVisible
      };
    } catch (error) {
      console.error('Get element failed:', error);
      return null;
    }
  }

  /**
   * セレクターを使用して要素が表示されているかチェックする
   */
  async isVisibleBySelector(selector: string): Promise<boolean> {
    const element = await this.getElementBySelector(selector);
    return element !== null && element.isVisible;
  }

  /**
   * 録画を開始する
   */
  startRecording(): void {
    this.isRecording = true;
    this.recordedActions = [];
  }

  /**
   * 録画を停止する
   */
  stopRecording(): any[] {
    this.isRecording = false;
    return this.recordedActions;
  }

  /**
   * 録画されたアクションを取得する
   */
  getRecordedActions(): any[] {
    return this.recordedActions;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async sendKeys(keys: string): Promise<void> {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("${keys}")
    `;

    try {
      await execAsync(`powershell -Command "${script}"`);
    } catch (error) {
      console.error('Send keys failed:', error);
      throw error;
    }
  }

  async scroll(amount: number): Promise<boolean> {
    try {
      // Implementation would go here
      console.log(`Scrolling by ${amount} pixels`);
      return true;
    } catch (error) {
      console.error('Scroll failed:', error);
      return false;
    }
  }

  async mouse(options: ClickOptions = {}): Promise<boolean> {
    try {
      const { doubleClick = false } = options;

      if (doubleClick) {
        await this.doubleClick({ x: 0, y: 0 });
      }

      return true;
    } catch (error) {
      console.error('Mouse operation failed:', error);
      return false;
    }
  }

  async keyboard(options: TypeOptions = {}): Promise<boolean> {
    try {
      const { clearFirst = true } = options;

      if (clearFirst) {
        await this.sendKeys('^a');
      }

      return true;
    } catch (error) {
      console.error('Keyboard operation failed:', error);
      return false;
    }
  }

  async doubleClickAt(x: number, y: number): Promise<boolean> {
    try {
      // Implementation would go here
      console.log(`Double clicking at coordinates (${x}, ${y})`);
      return true;
    } catch (error) {
      console.error('Double click at coordinates failed:', error);
      return false;
    }
  }

  async doubleClickElement(_element: ElementHandle): Promise<boolean> {
    try {
      // Implementation would go here
      console.log(`Double clicking element`);
      return true;
    } catch (error) {
      console.error('Double click element failed:', error);
      return false;
    }
  }

  async clickAt(position: { x: number; y: number }, options: ClickOptions = {}): Promise<boolean> {
    const { button = 'left' } = options;

    try {
      // Implementation would go here
      console.log(`Clicking at (${position.x}, ${position.y}) with button: ${button}`);
      return true;
    } catch (error) {
      console.error('Click at position failed:', error);
      return false;
    }
  }

  async typeAt(position: { x: number; y: number }, text: string, options: TypeOptions = {}): Promise<boolean> {
    const { clearFirst = true } = options;

    try {
      // Implementation would go here
      console.log(`Typing "${text}" at (${position.x}, ${position.y}), clearFirst: ${clearFirst}`);
      return true;
    } catch (error) {
      console.error('Type at position failed:', error);
      return false;
    }
  }
} 