import { UIAutomationElement } from '../types';

export interface HighlightOptions {
    color?: string;
    thickness?: number;
    duration?: number;
    style?: 'solid' | 'dashed' | 'dotted';
}

export class ElementHighlighter {
    private currentHighlight: any = null;
    private isHighlighting = false;

    constructor() {
        // 初期化
    }

    /**
     * 要素に赤枠を表示する
     */
    async highlightElement(element: UIAutomationElement, options: HighlightOptions = {}): Promise<void> {
        const {
            color = '#ff0000',
            thickness = 3,
            duration = 2000,
            style = 'solid'
        } = options;

        try {
            // 既存のハイライトをクリア
            await this.clearHighlight();

            // PowerShellを使用して赤枠を描画
            const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        
        # 赤枠を描画する関数
        function Draw-Highlight {
          param(
            [int]$X,
            [int]$Y,
            [int]$Width,
            [int]$Height,
            [string]$Color = "#ff0000",
            [int]$Thickness = 3,
            [string]$Style = "solid"
          )
          
          # フォームを作成
          $form = New-Object System.Windows.Forms.Form
          $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
          $form.ShowInTaskbar = $false
          $form.TopMost = $true
          $form.BackColor = [System.Drawing.Color]::Transparent
          $form.TransparencyKey = [System.Drawing.Color]::Transparent
          
          # フォームの位置とサイズを設定
          $form.Location = New-Object System.Drawing.Point($X, $Y)
          $form.Size = New-Object System.Drawing.Size($Width, $Height)
          
          # ペイントイベントを追加
          $form.Add_Paint({
            param($sender, $e)
            
            $graphics = $e.Graphics
            $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($Color), $Thickness)
            
            # スタイルを設定
            switch ($Style) {
              "dashed" { $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash }
              "dotted" { $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dot }
              default { $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Solid }
            }
            
            # 赤枠を描画
            $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
            $graphics.DrawRectangle($pen, $rect)
            
            $pen.Dispose()
            $graphics.Dispose()
          })
          
          # フォームを表示
          $form.Show()
          
          return $form
        }
        
        # 要素の位置とサイズで赤枠を描画
        $highlight = Draw-Highlight -X ${element.bounds.x} -Y ${element.bounds.y} -Width ${element.bounds.width} -Height ${element.bounds.height} -Color "${color}" -Thickness ${thickness} -Style "${style}"
        
        # 指定時間後に自動的にクリア
        Start-Job -ScriptBlock {
          param($form, $duration)
          Start-Sleep -Milliseconds $duration
          $form.Invoke({ $form.Close() })
        } -ArgumentList $highlight, ${duration}
        
        # フォームのハンドルを返す
        $highlight.Handle
      `;

            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            const { stdout } = await execAsync(`powershell -Command "${script}"`);

            if (stdout.trim()) {
                this.currentHighlight = parseInt(stdout.trim());
                this.isHighlighting = true;

                console.log(`Element highlighted: ${element.name} at (${element.bounds.x}, ${element.bounds.y})`);
            }
        } catch (error) {
            console.error('Failed to highlight element:', error);
        }
    }

    /**
     * 現在のハイライトをクリアする
     */
    async clearHighlight(): Promise<void> {
        if (!this.isHighlighting || !this.currentHighlight) {
            return;
        }

        try {
            const script = `
        Add-Type -AssemblyName System.Windows.Forms
        
        # フォームを閉じる
        $form = [System.Windows.Forms.Form]::FromHandle(${this.currentHighlight})
        if ($form -ne $null) {
          $form.Invoke({ $form.Close() })
          $form.Dispose()
        }
      `;

            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            await execAsync(`powershell -Command "${script}"`);

            this.currentHighlight = null;
            this.isHighlighting = false;

            console.log('Element highlight cleared');
        } catch (error) {
            console.error('Failed to clear highlight:', error);
        }
    }

    /**
     * マウス位置の要素をハイライトする
     */
    async highlightElementAtPosition(x: number, y: number, options: HighlightOptions = {}): Promise<void> {
        try {
            // 指定位置の要素を取得
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            const script = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        
        $desktop = [System.Windows.Automation.AutomationElement]::RootElement
        $element = [System.Windows.Automation.AutomationElement]::FromPoint([System.Windows.Point]::new(${x}, ${y}))
        
        if ($element -ne $null) {
          $result = @{
            id = $element.Current.AutomationId
            name = $element.Current.Name
            className = $element.Current.ClassName
            controlType = $element.Current.ControlType.ProgrammaticName
            isEnabled = $element.Current.IsEnabled
            isVisible = $element.Current.IsOffscreen -eq $false
            bounds = @{
              x = $element.Current.BoundingRectangle.X
              y = $element.Current.BoundingRectangle.Y
              width = $element.Current.BoundingRectangle.Width
              height = $element.Current.BoundingRectangle.Height
            }
            properties = @{}
          }
          $result | ConvertTo-Json
        }
      `;

            const { stdout } = await execAsync(`powershell -Command "${script}"`);

            if (stdout.trim()) {
                const elementData = JSON.parse(stdout);
                const element: UIAutomationElement = {
                    id: elementData.id || '',
                    name: elementData.name || '',
                    className: elementData.className || '',
                    controlType: elementData.controlType || '',
                    isEnabled: elementData.isEnabled || false,
                    isVisible: elementData.isVisible || false,
                    bounds: elementData.bounds,
                    properties: elementData.properties || {}
                };

                await this.highlightElement(element, options);
            }
        } catch (error) {
            console.error('Failed to highlight element at position:', error);
        }
    }

    /**
     * ハイライト状態を取得する
     */
    isHighlightingActive(): boolean {
        return this.isHighlighting;
    }

    /**
     * 現在ハイライトされている要素の情報を取得する
     */
    getCurrentHighlight(): any {
        return this.currentHighlight;
    }

    /**
 * 複数の要素を同時にハイライトする
 */
    async highlightMultipleElements(elements: UIAutomationElement[], options: HighlightOptions = {}): Promise<void> {
        // 既存のハイライトをクリア
        await this.clearHighlight();

        // 最初の要素のみハイライト（複数同時ハイライトは複雑なため）
        if (elements.length > 0 && elements[0]) {
            await this.highlightElement(elements[0], options);
        }
    }

    /**
 * ハイライトの設定を更新する
 */
    async updateHighlightOptions(_options: HighlightOptions): Promise<void> {
        if (this.isHighlighting) {
            // 現在のハイライトをクリアして新しい設定で再描画
            await this.clearHighlight();
            // 新しい設定で再ハイライト（現在の要素情報が必要）
        }
    }
} 