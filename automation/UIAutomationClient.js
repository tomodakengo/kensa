const edge = require('edge-js');
const { promisify } = require('util');

class UIAutomationClient {
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
              
              using(var ms = new MemoryStream()) {
                bmp.Save(ms, ImageFormat.Png);
                return Convert.ToBase64String(ms.ToArray());
              }
            }
          }

          private object WaitForElement(dynamic criteria, int timeout) {
            var endTime = DateTime.Now.AddMilliseconds(timeout);
            
            while(DateTime.Now < endTime) {
              var element = FindElement(criteria);
              if(element != null) return element;
              
              System.Threading.Thread.Sleep(100);
            }
            
            return null;
          }

          private ControlType GetControlType(string name) {
            switch(name.ToLower()) {
              case "button": return ControlType.Button;
              case "edit": return ControlType.Edit;
              case "text": return ControlType.Text;
              case "checkbox": return ControlType.CheckBox;
              case "radiobutton": return ControlType.RadioButton;
              case "combobox": return ControlType.ComboBox;
              case "list": return ControlType.List;
              case "listitem": return ControlType.ListItem;
              case "menu": return ControlType.Menu;
              case "menuitem": return ControlType.MenuItem;
              case "window": return ControlType.Window;
              case "pane": return ControlType.Pane;
              default: return ControlType.Custom;
            }
          }

          [DllImport("user32.dll")]
          static extern bool SetCursorPos(int X, int Y);

          [DllImport("user32.dll")]
          static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);

          const int MOUSEEVENTF_LEFTDOWN = 0x02;
          const int MOUSEEVENTF_LEFTUP = 0x04;
        }
      `,
      references: ['System.Windows.Forms.dll', 'System.Drawing.dll', 'UIAutomationClient.dll', 'UIAutomationTypes.dll']
    });
  }

  async getWindowList() {
    return await this.automationCore({ method: 'getWindowList' });
  }

  async findElement(criteria) {
    return await this.automationCore({ method: 'findElement', criteria });
  }

  async click(element) {
    return await this.automationCore({ method: 'click', element });
  }

  async type(element, text) {
    return await this.automationCore({ method: 'setText', element, text });
  }

  async getText(element) {
    return await this.automationCore({ method: 'getText', element });
  }

  async inspectElement(point) {
    return await this.automationCore({ method: 'getElementAtPoint', x: point.x, y: point.y });
  }

  async getElementProperties(element) {
    return await this.automationCore({ method: 'getElementProperties', element });
  }

  async screenshot(element) {
    return await this.automationCore({ method: 'screenshot', element });
  }

  async waitForSelector(criteria, options = {}) {
    const timeout = options.timeout || 30000;
    return await this.automationCore({ method: 'waitForElement', criteria, timeout });
  }

  // Playwright-like API methods
  async fill(element, text) {
    await this.click(element);
    await this.clear(element);
    return await this.type(element, text);
  }

  async clear(element) {
    await this.click(element);
    // Select all and delete
    return await this.automationCore({ 
      method: 'setText', 
      element, 
      text: '' 
    });
  }

  async hover(element) {
    const props = await this.getElementProperties(element);
    const centerX = props.bounds.x + props.bounds.width / 2;
    const centerY = props.bounds.y + props.bounds.height / 2;
    
    // Move mouse to element
    return await this.automationCore({
      method: 'moveMouse',
      x: centerX,
      y: centerY
    });
  }

  async doubleClick(element) {
    return await this.automationCore({ method: 'doubleClick', element });
  }

  async rightClick(element) {
    return await this.automationCore({ method: 'rightClick', element });
  }

  async selectOption(element, value) {
    return await this.automationCore({ 
      method: 'selectOption', 
      element, 
      value 
    });
  }

  async check(element) {
    const props = await this.getElementProperties(element);
    if(props.controlType.includes('CheckBox')) {
      return await this.automationCore({ method: 'check', element });
    }
  }

  async uncheck(element) {
    const props = await this.getElementProperties(element);
    if(props.controlType.includes('CheckBox')) {
      return await this.automationCore({ method: 'uncheck', element });
    }
  }
}

module.exports = { UIAutomationClient };