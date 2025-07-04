import * as fs from 'fs-extra';
import * as path from 'path';
import type { TestReport, TestResult } from '../types';

interface ReporterOptions {
  outputDir?: string;
  formats?: string[];
  includeScreenshots?: boolean;
}

interface StepResult {
  step: number;
  action: string;
  status: 'running' | 'passed' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  description?: string;
  error?: string;
  stack?: string;
  screenshot?: string;
  failureScreenshot?: string;
}

interface TestExecutionResult {
  testName: string;
  status: 'running' | 'passed' | 'failed' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
  steps: StepResult[];
  error?: string;
  stack?: string;
}

export class TestReporter {
  private outputDir: string;
  private formats: string[];
  private includeScreenshots: boolean;

  constructor(options: ReporterOptions = {}) {
    this.outputDir = options.outputDir || 'test-reports';
    this.formats = options.formats || ['html', 'json'];
    this.includeScreenshots = options.includeScreenshots !== false;
  }

  async generateReport(testResults: TestExecutionResult): Promise<TestReport> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportName = `test-report-${timestamp}`;
    
    await fs.ensureDir(this.outputDir);
    
    const reports: Record<string, string> = {};
    
    if (this.formats.includes('html')) {
      reports.html = await this.generateHTMLReport(testResults, reportName);
    }
    
    if (this.formats.includes('json')) {
      reports.json = await this.generateJSONReport(testResults, reportName);
    }
    
    if (this.formats.includes('junit')) {
      reports.junit = await this.generateJUnitReport(testResults, reportName);
    }
    
    if (this.formats.includes('markdown')) {
      reports.markdown = await this.generateMarkdownReport(testResults, reportName);
    }
    
    const report: TestReport = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      totalTests: 1,
      passed: testResults.status === 'passed' ? 1 : 0,
      failed: testResults.status === 'failed' ? 1 : 0,
      skipped: 0,
      duration: testResults.duration || 0,
      details: testResults.steps.map(step => ({
        id: step.step,
        scenarioId: 1,
        status: step.status,
        message: step.description || step.error || '',
        timestamp: new Date(step.startTime).toISOString(),
        duration: step.duration || 0,
        screenshot: step.screenshot || step.failureScreenshot,
        error: step.error
      }))
    };
    
    return report;
  }

  private async generateHTMLReport(testResults: TestExecutionResult, reportName: string): Promise<string> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${testResults.testName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .status-passed {
            color: #22c55e;
            font-weight: bold;
        }
        .status-failed {
            color: #ef4444;
            font-weight: bold;
        }
        .status-running {
            color: #3b82f6;
            font-weight: bold;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            margin: 0;
        }
        .steps {
            margin-top: 30px;
        }
        .step {
            background: #f8f9fa;
            margin-bottom: 15px;
            border-radius: 6px;
            overflow: hidden;
        }
        .step-header {
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
        }
        .step-header:hover {
            background: #e9ecef;
        }
        .step.failed .step-header {
            background: #fee;
        }
        .step.passed .step-header {
            background: #f0fdf4;
        }
        .step-details {
            padding: 20px;
            background: white;
            border-top: 1px solid #e0e0e0;
            display: none;
        }
        .step.expanded .step-details {
            display: block;
        }
        .error-message {
            background: #fee;
            padding: 15px;
            border-radius: 4px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 13px;
        }
        .screenshot {
            margin-top: 15px;
            max-width: 100%;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
        }
        .duration {
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${testResults.testName}</h1>
            <p>Status: <span class="status-${testResults.status}">${testResults.status.toUpperCase()}</span></p>
            <p>Duration: ${this.formatDuration(testResults.duration || 0)}</p>
            <p>Executed: ${new Date(testResults.startTime).toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Steps</h3>
                <p class="value">${testResults.steps.length}</p>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <p class="value" style="color: #22c55e">${testResults.steps.filter(s => s.status === 'passed').length}</p>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <p class="value" style="color: #ef4444">${testResults.steps.filter(s => s.status === 'failed').length}</p>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <p class="value">${Math.round((testResults.steps.filter(s => s.status === 'passed').length / testResults.steps.length) * 100)}%</p>
            </div>
        </div>
        
        <div class="steps">
            <h2>Test Steps</h2>
            ${testResults.steps.map(step => this.generateStepHTML(step)).join('')}
        </div>
    </div>
    
    <script>
        document.querySelectorAll('.step-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('expanded');
            });
        });
    </script>
</body>
</html>`;
    
    const filePath = path.join(this.outputDir, `${reportName}.html`);
    await fs.writeFile(filePath, html);
    return filePath;
  }

  private generateStepHTML(step: StepResult): string {
    const statusClass = step.status;
    const statusText = step.status.toUpperCase();
    const duration = this.formatDuration(step.duration || 0);
    
    let details = '';
    if (step.description) {
      details += `<p><strong>Description:</strong> ${step.description}</p>`;
    }
    
    if (step.error) {
      details += `
        <div class="error-message">
          <strong>Error:</strong><br>
          ${step.error}
          ${step.stack ? `<br><br><strong>Stack:</strong><br>${step.stack}` : ''}
        </div>`;
    }
    
    if (step.screenshot && this.includeScreenshots) {
      details += `<img src="${step.screenshot}" alt="Screenshot" class="screenshot">`;
    }
    
    if (step.failureScreenshot && this.includeScreenshots) {
      details += `<img src="${step.failureScreenshot}" alt="Failure Screenshot" class="screenshot">`;
    }
    
    return `
      <div class="step ${statusClass}">
        <div class="step-header">
          <div>
            <strong>Step ${step.step}:</strong> ${step.action}
            <span class="duration">(${duration})</span>
          </div>
          <span class="status-${statusClass}">${statusText}</span>
        </div>
        <div class="step-details">
          ${details}
        </div>
      </div>`;
  }

  private async generateJSONReport(testResults: TestExecutionResult, reportName: string): Promise<string> {
    const filePath = path.join(this.outputDir, `${reportName}.json`);
    await fs.writeJson(filePath, testResults, { spaces: 2 });
    return filePath;
  }

  private async generateJUnitReport(testResults: TestExecutionResult, reportName: string): Promise<string> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="${testResults.testName}" tests="${testResults.steps.length}" failures="${testResults.steps.filter(s => s.status === 'failed').length}" time="${(testResults.duration || 0) / 1000}">
  <testsuite name="${testResults.testName}" tests="${testResults.steps.length}" failures="${testResults.steps.filter(s => s.status === 'failed').length}" time="${(testResults.duration || 0) / 1000}">
    ${testResults.steps.map(step => this.generateJUnitTestCase(step)).join('\n    ')}
  </testsuite>
</testsuites>`;
    
    const filePath = path.join(this.outputDir, `${reportName}.xml`);
    await fs.writeFile(filePath, xml);
    return filePath;
  }

  private generateJUnitTestCase(step: StepResult): string {
    const time = (step.duration || 0) / 1000;
    
    if (step.status === 'failed') {
      return `<testcase name="Step ${step.step}: ${step.action}" time="${time}">
      <failure message="${this.escapeXML(step.error || 'Unknown error')}">${this.escapeXML(step.stack || '')}</failure>
    </testcase>`;
    }
    
    return `<testcase name="Step ${step.step}: ${step.action}" time="${time}" />`;
  }

  private async generateMarkdownReport(testResults: TestExecutionResult, reportName: string): Promise<string> {
    const markdown = `# Test Report: ${testResults.testName}

**Status:** ${testResults.status.toUpperCase()}
**Duration:** ${this.formatDuration(testResults.duration || 0)}
**Executed:** ${new Date(testResults.startTime).toLocaleString()}

## Summary

- **Total Steps:** ${testResults.steps.length}
- **Passed:** ${testResults.steps.filter(s => s.status === 'passed').length}
- **Failed:** ${testResults.steps.filter(s => s.status === 'failed').length}
- **Success Rate:** ${Math.round((testResults.steps.filter(s => s.status === 'passed').length / testResults.steps.length) * 100)}%

## Test Steps

${testResults.steps.map(step => this.generateMarkdownStep(step)).join('\n\n')}
`;
    
    const filePath = path.join(this.outputDir, `${reportName}.md`);
    await fs.writeFile(filePath, markdown);
    return filePath;
  }

  private generateMarkdownStep(step: StepResult): string {
    const status = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
    const duration = this.formatDuration(step.duration || 0);
    
    let details = '';
    if (step.description) {
      details += `\n**Description:** ${step.description}`;
    }
    
    if (step.error) {
      details += `\n**Error:** ${step.error}`;
      if (step.stack) {
        details += `\n**Stack:**\n\`\`\`\n${step.stack}\n\`\`\``;
      }
    }
    
    return `### ${status} Step ${step.step}: ${step.action} (${duration})${details}`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}s ${milliseconds}ms`;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async generateSummaryReport(allResults: TestExecutionResult[]): Promise<string> {
    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.status === 'passed').length;
    const failedTests = allResults.filter(r => r.status === 'failed').length;
    const totalDuration = allResults.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    const summary = {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: Math.round((passedTests / totalTests) * 100),
        totalDuration: this.formatDuration(totalDuration),
        timestamp: new Date().toISOString()
      },
      results: allResults
    };
    
    const filePath = path.join(this.outputDir, 'summary-report.json');
    await fs.writeJson(filePath, summary, { spaces: 2 });
    return filePath;
  }
} 