import * as fs from 'fs-extra';
import * as path from 'path';
import type { TestResult, TestReport } from '../types';

interface ReportOptions {
  format?: 'html' | 'json' | 'xml';
  includeScreenshots?: boolean;
  includeDetails?: boolean;
  outputPath?: string;
}

export class TestReporter {
  private reportsPath: string;

  constructor(reportsPath?: string) {
    this.reportsPath = reportsPath || path.join(process.cwd(), 'reports');
    this.ensureReportsDirectory();
  }

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.ensureDir(this.reportsPath);
    } catch (error) {
      console.error('Error creating reports directory:', error);
    }
  }

  async generateReport(testResults: TestResult[]): Promise<TestReport> {
    const total = testResults.length;
    const passed = testResults.filter(r => r.status === 'passed').length;
    const failed = testResults.filter(r => r.status === 'failed').length;
    const skipped = testResults.filter(r => r.status === 'skipped').length;

    const report: TestReport = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed,
        skipped,
        duration: testResults.reduce((sum, r) => sum + r.duration, 0)
      },
      details: testResults.map(step => ({
        id: step.id,
        scenarioId: step.scenarioId,
        status: step.status,
        message: step.message,
        timestamp: step.timestamp,
        duration: step.duration,
        screenshot: step.screenshot,
        error: step.error || undefined
      }))
    };

    return report;
  }

  async saveReport(report: TestReport, options: ReportOptions = {}): Promise<string> {
    const { format = 'html', outputPath } = options;
    const fileName = `test-report-${Date.now()}.${format}`;
    const filePath = outputPath || path.join(this.reportsPath, fileName);

    try {
      let content: string;

      switch (format) {
        case 'json':
          content = JSON.stringify(report, null, 2);
          break;
        case 'xml':
          content = this.generateXMLReport(report);
          break;
        case 'html':
        default:
          content = this.generateHTMLContent(report);
          break;
      }

      await fs.writeFile(filePath, content, 'utf-8');
      return filePath;
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  }

  private generateHTMLContent(report: TestReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .passed { color: green; }
        .failed { color: red; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Test Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Generated: ${report.timestamp}</p>
        <p>Total Tests: ${report.summary.total}</p>
        <p class="passed">Passed: ${report.summary.passed}</p>
        <p class="failed">Failed: ${report.summary.failed}</p>
        <p>Duration: ${report.summary.duration}ms</p>
    </div>
    <h2>Test Results</h2>
    <table>
        <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Message</th>
            <th>Duration</th>
            <th>Timestamp</th>
        </tr>
        ${report.details.map(result => `
            <tr>
                <td>${result.id}</td>
                <td class="${result.status}">${result.status}</td>
                <td>${result.message}</td>
                <td>${result.duration}ms</td>
                <td>${result.timestamp}</td>
            </tr>
        `).join('')}
    </table>
</body>
</html>`;
  }

  private generateXMLReport(report: TestReport): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<testReport>
    <summary>
        <timestamp>${report.timestamp}</timestamp>
        <totalTests>${report.summary.total}</totalTests>
        <passed>${report.summary.passed}</passed>
        <failed>${report.summary.failed}</failed>
        <duration>${report.summary.duration}</duration>
    </summary>
    <results>
        ${report.details.map(result => `
            <result>
                <id>${result.id}</id>
                <status>${result.status}</status>
                <message><![CDATA[${result.message}]]></message>
                <duration>${result.duration}</duration>
                <timestamp>${result.timestamp}</timestamp>
            </result>
        `).join('')}
    </results>
</testReport>`;
  }

  // Legacy methods for backward compatibility
  async generateHTMLReport(testResults: TestResult[], reportName?: string): Promise<string> {
    const report = await this.generateReport(testResults);
    const fileName = reportName || `test-report-${Date.now()}.html`;
    const filePath = path.join(this.reportsPath, fileName);

    await fs.ensureDir(this.reportsPath);
    await fs.writeFile(filePath, this.generateHTMLContent(report));

    return filePath;
  }

  async generateJSONReport(testResults: TestResult[], reportName?: string): Promise<string> {
    const report = await this.generateReport(testResults);
    const fileName = reportName || `test-report-${Date.now()}.json`;
    const filePath = path.join(this.reportsPath, fileName);

    await fs.ensureDir(this.reportsPath);
    await fs.writeJson(filePath, report, { spaces: 2 });

    return filePath;
  }

  async generateJUnitReport(testResults: TestResult[], reportName?: string): Promise<string> {
    const fileName = reportName || `test-report-${Date.now()}.xml`;
    const filePath = path.join(this.reportsPath, fileName);

    await fs.ensureDir(this.reportsPath);

    const totalTests = testResults.length;
    const failed = testResults.filter(r => r.status === 'failed').length;
    const totalTime = testResults.reduce((sum, r) => sum + r.duration, 0) / 1000;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="UI Automation Tests" tests="${totalTests}" failures="${failed}" time="${totalTime}">
${testResults.map(result => `
  <testcase classname="TestSuite" name="Test ${result.id}" time="${result.duration / 1000}">
    ${result.status === 'failed' ? `<failure message="${result.error || 'Test failed'}">${result.message}</failure>` : ''}
  </testcase>
`).join('')}
</testsuite>`;

    await fs.writeFile(filePath, xml);
    return filePath;
  }

  async generateMarkdownReport(testResults: TestResult[], reportName?: string): Promise<string> {
    const report = await this.generateReport(testResults);
    const fileName = reportName || `test-report-${Date.now()}.md`;
    const filePath = path.join(this.reportsPath, fileName);

    await fs.ensureDir(this.reportsPath);

    const markdown = `# Test Report

## Summary

- **Generated:** ${report.timestamp}
- **Total Tests:** ${report.summary.total}
- **Passed:** ${report.summary.passed}
- **Failed:** ${report.summary.failed}
- **Duration:** ${report.summary.duration}ms

## Test Results

| ID | Status | Message | Duration | Timestamp |
|----|--------|---------|----------|-----------|
${report.details.map(result => 
  `| ${result.id} | ${result.status} | ${result.message} | ${result.duration}ms | ${result.timestamp} |`
).join('\n')}
`;

    await fs.writeFile(filePath, markdown);
    return filePath;
  }

  async clearReports(): Promise<void> {
    try {
      await fs.remove(this.reportsPath);
      await fs.ensureDir(this.reportsPath);
    } catch (error) {
      console.error('Error clearing reports directory:', error);
    }
  }

  async getReportFiles(): Promise<string[]> {
    try {
      await fs.ensureDir(this.reportsPath);
      const files = await fs.readdir(this.reportsPath);
      return files.filter(file => file.endsWith('.html') || file.endsWith('.json') || file.endsWith('.xml') || file.endsWith('.md'));
    } catch (error) {
      console.error('Error reading reports directory:', error);
      return [];
    }
  }
} 