import * as edge from 'edge-js';
import type { UIAutomationElement } from '../types';

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

export class UIAutomationClient {
  private automationCore: any;

  constructor() {
    // C# UI Automation code embedded
    this.automationCore = edge.func({
      source: `
        using System;
        using System.Threading.Tasks;
        using System.Windows.Automation;
        using System.Collections.Generic;
        using System.Runtime.InteropServices;
        using System.Drawing;
        using System.Linq;

        public class Startup {
          public async Task<object> Invoke(dynamic input) {
            string method = (string)input.method;
            
            switch(method) {
              case "getWindowList":
                return GetWindowList();
              case "findElement":
                return FindElement(input.criteria);
              case "click":
                return ClickElement(input.element);
              case "setText":
                return SetText(input.element, input.text);
              case "getText":
                return GetText(input.element);
              case "getElementAtPoint":
                return GetElementAtPoint(input.x, input.y);
              case "getElementProperties":
                return GetElementProperties(input.element);
              case "screenshot":
                return TakeScreenshot(input.element);
              case "waitForElement":
                return WaitForElement(input.criteria, input.timeout);
              default:
                throw new Exception($"Unknown method: {method}");
            }
          }

          private object GetWindowList() {
            var windows = new List<object>();
            var desktop = AutomationElement.RootElement;
            var condition = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Window);
            var topWindows = desktop.FindAll(TreeScope.Children, condition);
            
            foreach(AutomationElement window in topWindows) {
              var processId = window.Current.ProcessId;
              var title = window.Current.Name;
              var className = window.Current.ClassName;
              
              windows.Add(new {
                processId = processId,
                title = title,
                className = className,
                handle = window.Current.NativeWindowHandle
              });
            }
            
            return windows;
          }

          private object FindElement(dynamic criteria) {
            var conditions = new List<Condition>();
            
            if(criteria.automationId != null)
              conditions.Add(new PropertyCondition(AutomationElement.AutomationIdProperty, (string)criteria.automationId));
            if(criteria.name != null)
              conditions.Add(new PropertyCondition(AutomationElement.NameProperty, (string)criteria.name));
            if(criteria.className != null)
              conditions.Add(new PropertyCondition(AutomationElement.ClassNameProperty, (string)criteria.className));
            if(criteria.controlType != null)
              conditions.Add(new PropertyCondition(AutomationElement.ControlTypeProperty, GetControlType((string)criteria.controlType)));
            
            Condition finalCondition = conditions.Count == 1 ? conditions[0] : new AndCondition(conditions.ToArray());
            
            AutomationElement root = criteria.parentHandle != null ? 
              AutomationElement.FromHandle(new IntPtr((long)criteria.parentHandle)) : 
              AutomationElement.RootElement;
              
            var element = root.FindFirst(TreeScope.Descendants, finalCondition);
            
            if(element == null) return null;
            
            return new {
              handle = element.Current.NativeWindowHandle,
              automationId = element.Current.AutomationId,
              name = element.Current.Name,
              className = element.Current.ClassName,
              bounds = new {
                x = element.Current.BoundingRectangle.X,
                y = element.Current.BoundingRectangle.Y,
                width = element.Current.BoundingRectangle.Width,
                height = element.Current.BoundingRectangle.Height
              }
            };
          }

          private bool ClickElement(dynamic element) {
            var ae = AutomationElement.FromHandle(new IntPtr((long)element.handle));
            
            object pattern;
            if(ae.TryGetCurrentPattern(InvokePattern.Pattern, out pattern)) {
              ((InvokePattern)pattern).Invoke();
              return true;
            }
            else {
              var bounds = ae.Current.BoundingRectangle;
              var centerX = bounds.X + bounds.Width / 2;
              var centerY = bounds.Y + bounds.Height / 2;
              
              SetCursorPos((int)centerX, (int)centerY);
              mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
              return true;
            }
          }

          private bool SetText(dynamic element, string text) {
            var ae = AutomationElement.FromHandle(new IntPtr((long)element.handle));
            
            object pattern;
            if(ae.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) {
              ((ValuePattern)pattern).SetValue(text);
              return true;
            }
            return false;
          }

          private string GetText(dynamic element) {
            var ae = AutomationElement.FromHandle(new IntPtr((long)element.handle));
            
            object pattern;
            if(ae.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) {
              return ((ValuePattern)pattern).Current.Value;
            }
            else if(ae.TryGetCurrentPattern(TextPattern.Pattern, out pattern)) {
              return ((TextPattern)pattern).DocumentRange.GetText(-1);
            }
            
            return ae.Current.Name;
          }

          private object GetElementAtPoint(int x, int y) {
            var point = new System.Windows.Point(x, y);
            var element = AutomationElement.FromPoint(point);
            
            if(element == null) return null;
            
            return new {
              handle = element.Current.NativeWindowHandle,
              automationId = element.Current.AutomationId,
              name = element.Current.Name,
              className = element.Current.ClassName,
              controlType = element.Current.ControlType.ProgrammaticName,
              bounds = new {
                x = element.Current.BoundingRectangle.X,
                y = element.Current.BoundingRectangle.Y,
                width = element.Current.BoundingRectangle.Width,
                height = element.Current.BoundingRectangle.Height
              }
            };
          }

          private object GetElementProperties(dynamic element) {
            var ae = AutomationElement.FromHandle(new IntPtr((long)element.handle));
            
            var patterns = new List<string>();
            foreach(AutomationPattern pattern in ae.GetSupportedPatterns()) {
              patterns.Add(pattern.ProgrammaticName);
            }
            
            return new {
              automationId = ae.Current.AutomationId,
              name = ae.Current.Name,
              className = ae.Current.ClassName,
              controlType = ae.Current.ControlType.ProgrammaticName,
              isEnabled = ae.Current.IsEnabled,
              isOffscreen = ae.Current.IsOffscreen,
              supportedPatterns = patterns,
              bounds = new {
                x = ae.Current.BoundingRectangle.X,
                y = ae.Current.BoundingRectangle.Y,
                width = ae.Current.BoundingRectangle.Width,
                height = ae.Current.BoundingRectangle.Height
              }
            };
          }

          private string TakeScreenshot(dynamic element) {
            var ae = AutomationElement.FromHandle(new IntPtr((long)element.handle));
            var bounds = ae.Current.BoundingRectangle;
            
            using(var bmp = new Bitmap((int)bounds.Width, (int)bounds.Height)) {
              using(var g = Graphics.FromImage(bmp)) {
                g.CopyFromScreen((int)bounds.X, (int)bounds.Y, 0, 0, bmp.Size);
              }
              
              var filename = $"screenshot_{DateTime.Now:yyyyMMdd_HHmmss}.png";
              bmp.Save(filename);
              return filename;
            }
          }

          private object WaitForElement(dynamic criteria, int timeout) {
            var startTime = DateTime.Now;
            var timeoutSpan = TimeSpan.FromMilliseconds(timeout);
            
            while(DateTime.Now - startTime < timeoutSpan) {
              var element = FindElement(criteria);
              if(element != null) return element;
              System.Threading.Thread.Sleep(100);
            }
            
            return null;
          }

          private ControlType GetControlType(string typeName) {
            switch(typeName.ToLower()) {
              case "button": return ControlType.Button;
              case "edit": return ControlType.Edit;
              case "text": return ControlType.Text;
              case "window": return ControlType.Window;
              case "pane": return ControlType.Pane;
              case "document": return ControlType.Document;
              case "list": return ControlType.List;
              case "listitem": return ControlType.ListItem;
              case "tree": return ControlType.Tree;
              case "treeitem": return ControlType.TreeItem;
              case "menu": return ControlType.Menu;
              case "menuitem": return ControlType.MenuItem;
              case "combobox": return ControlType.ComboBox;
              case "checkbox": return ControlType.CheckBox;
              case "radiobutton": return ControlType.RadioButton;
              case "tab": return ControlType.Tab;
              case "tabitem": return ControlType.TabItem;
              case "toolbar": return ControlType.ToolBar;
              case "tooltip": return ControlType.ToolTip;
              default: return ControlType.Custom;
            }
          }

          [DllImport("user32.dll")]
          static extern bool SetCursorPos(int x, int y);

          [DllImport("user32.dll")]
          static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo);

          const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
          const uint MOUSEEVENTF_LEFTUP = 0x0004;
        }
      `
    });
  }

  async getWindowList(): Promise<WindowInfo[]> {
    return await this.automationCore({ method: 'getWindowList' });
  }

  async findElement(criteria: ElementCriteria): Promise<ElementHandle | null> {
    return await this.automationCore({ method: 'findElement', criteria });
  }

  async click(element: ElementHandle): Promise<boolean> {
    return await this.automationCore({ method: 'click', element });
  }

  async type(element: ElementHandle, text: string): Promise<boolean> {
    return await this.automationCore({ method: 'setText', element, text });
  }

  async getText(element: ElementHandle): Promise<string> {
    return await this.automationCore({ method: 'getText', element });
  }

  async inspectElement(point: { x: number; y: number }): Promise<ElementHandle | null> {
    return await this.automationCore({ method: 'getElementAtPoint', x: point.x, y: point.y });
  }

  async getElementProperties(element: ElementHandle): Promise<UIAutomationElement> {
    return await this.automationCore({ method: 'getElementProperties', element });
  }

  async screenshot(element: ElementHandle): Promise<string> {
    return await this.automationCore({ method: 'screenshot', element });
  }

  async waitForSelector(criteria: ElementCriteria, options: WaitOptions = {}): Promise<ElementHandle | null> {
    const timeout = options.timeout || 5000;
    return await this.automationCore({ method: 'waitForElement', criteria, timeout });
  }

  async fill(element: ElementHandle, text: string): Promise<boolean> {
    await this.clear(element);
    return await this.type(element, text);
  }

  async clear(element: ElementHandle): Promise<boolean> {
    return await this.type(element, '');
  }

  async hover(element: ElementHandle): Promise<boolean> {
    // マウスホバーの実装（簡易版）
    const properties = await this.getElementProperties(element);
    if (properties.bounds) {
      const centerX = properties.bounds.x + properties.bounds.width / 2;
      const centerY = properties.bounds.y + properties.bounds.height / 2;
      
      // マウス移動の実装が必要
      return true;
    }
    return false;
  }

  async doubleClick(element: ElementHandle): Promise<boolean> {
    // ダブルクリックの実装（簡易版）
    await this.click(element);
    await new Promise(resolve => setTimeout(resolve, 50));
    return await this.click(element);
  }

  async rightClick(element: ElementHandle): Promise<boolean> {
    // 右クリックの実装（簡易版）
    const properties = await this.getElementProperties(element);
    if (properties.bounds) {
      const centerX = properties.bounds.x + properties.bounds.width / 2;
      const centerY = properties.bounds.y + properties.bounds.height / 2;
      
      // 右クリックの実装が必要
      return true;
    }
    return false;
  }

  async selectOption(element: ElementHandle, value: string): Promise<boolean> {
    // オプション選択の実装（簡易版）
    const properties = await this.getElementProperties(element);
    if (properties.controlType === 'ComboBox') {
      // コンボボックスの選択実装が必要
      return true;
    }
    return false;
  }

  async check(element: ElementHandle): Promise<boolean> {
    // チェックボックス選択の実装（簡易版）
    const properties = await this.getElementProperties(element);
    if (properties.controlType === 'CheckBox') {
      // チェックボックスの選択実装が必要
      return true;
    }
    return false;
  }

  async uncheck(element: ElementHandle): Promise<boolean> {
    // チェックボックス解除の実装（簡易版）
    const properties = await this.getElementProperties(element);
    if (properties.controlType === 'CheckBox') {
      // チェックボックスの解除実装が必要
      return true;
    }
    return false;
  }

  async isChecked(element: ElementHandle): Promise<boolean> {
    // チェック状態確認の実装（簡易版）
    const properties = await this.getElementProperties(element);
    if (properties.controlType === 'CheckBox') {
      // チェック状態の確認実装が必要
      return false;
    }
    return false;
  }

  async getValue(element: ElementHandle): Promise<string> {
    return await this.getText(element);
  }

  async hasFocus(element: ElementHandle): Promise<boolean> {
    // フォーカス確認の実装（簡易版）
    const properties = await this.getElementProperties(element);
    // フォーカス状態の確認実装が必要
    return false;
  }

  async findElements(criteria: ElementCriteria): Promise<ElementHandle[]> {
    // 複数要素検索の実装（簡易版）
    const element = await this.findElement(criteria);
    return element ? [element] : [];
  }
} 