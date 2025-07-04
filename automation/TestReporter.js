const fs = require('fs').promises;
const path = require('path');

class TestReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'test-reports';
    this.formats = options.formats || ['html', 'json'];
    this.includeScreenshots = options.includeScreenshots !== false;
  }

  async generateReport(testResults) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportName = `test-report-${timestamp}`;
    
    await fs.mkdir(this.outputDir, { recursive: true });
    
    const reports = {};
    
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
    
    return reports;
  }

  async generateHTMLReport(testResults, reportName) {
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
            <p>Duration: ${this.formatDuration(testResults.duration)}</p>
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

  generateStepHTML(step) {
    return `
        <div class="step ${step.status}">
            <div class="step-header">
                <div>
                    <strong>Step ${step.step}: ${step.action}</strong>
                    ${step.description ? `<br><small>${step.description}</small>` : ''}
                </div>
                <div>
                    <span class="status-${step.status}">${step.status.toUpperCase()}</span>
                    <span class="duration">${this.formatDuration(step.duration)}</span>
                </div>
            </div>
            <div class="step-details">
                ${step.error ? `
                    <div class="error-message">
                        <strong>Error:</strong> ${step.error}
                        ${step.stack ? `<pre>${step.stack}</pre>` : ''}
                    </div>
                ` : ''}
                ${step.screenshot && this.includeScreenshots ? `
                    <img src="data:image/png;base64,${step.screenshot}" class="screenshot" alt="Screenshot">
                ` : ''}
                ${step.failureScreenshot && this.includeScreenshots ? `
                    <div>
                        <strong>Failure Screenshot:</strong>
                        <img src="data:image/png;base64,${step.failureScreenshot}" class="screenshot" alt="Failure Screenshot">
                    </div>
                ` : ''}
            </div>
        </div>
    `;
  }

  async generateJSONReport(testResults, reportName) {
    const filePath = path.join(this.outputDir, `${reportName}.json`);
    await fs.writeFile(filePath, JSON.stringify(testResults, null, 2));
    return filePath;
  }

  async generateJUnitReport(testResults, reportName) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${testResults.testName}" 
             tests="${testResults.steps.length}" 
             failures="${testResults.steps.filter(s => s.status === 'failed').length}"
             time="${testResults.duration / 1000}">
    ${testResults.steps.map(step => `
    <testcase name="${step.action} - ${step.description || ''}" 
              classname="${testResults.testName}" 
              time="${step.duration / 1000}">
      ${step.status === 'failed' ? `
      <failure message="${this.escapeXML(step.error || 'Test failed')}">
        ${this.escapeXML(step.stack || '')}
      </failure>
      ` : ''}
    </testcase>
    `).join('')}
  </testsuite>
</testsuites>`;
    
    const filePath = path.join(this.outputDir, `${reportName}.xml`);
    await fs.writeFile(filePath, xml);
    return filePath;
  }

  async generateMarkdownReport(testResults, reportName) {
    const md = `# Test Report: ${testResults.testName}

## Summary
- **Status**: ${testResults.status.toUpperCase()}
- **Duration**: ${this.formatDuration(testResults.duration)}
- **Executed**: ${new Date(testResults.startTime).toLocaleString()}
- **Total Steps**: ${testResults.steps.length}
- **Passed**: ${testResults.steps.filter(s => s.status === 'passed').length}
- **Failed**: ${testResults.steps.filter(s => s.status === 'failed').length}

## Test Steps

${testResults.steps.map(step => `
### Step ${step.step}: ${step.action}
- **Status**: ${step.status.toUpperCase()}
- **Duration**: ${this.formatDuration(step.duration)}
${step.description ? `- **Description**: ${step.description}` : ''}
${step.error ? `
- **Error**: ${step.error}
\`\`\`
${step.stack || ''}
\`\`\`
` : ''}
`).join('\n')}
`;
    
    const filePath = path.join(this.outputDir, `${reportName}.md`);
    await fs.writeFile(filePath, md);
    return filePath;
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }

  escapeXML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async generateSummaryReport(allResults) {
    const summary = {
      totalTests: allResults.length,
      passed: allResults.filter(r => r.status === 'passed').length,
      failed: allResults.filter(r => r.status === 'failed').length,
      totalDuration: allResults.reduce((sum, r) => sum + r.duration, 0),
      executionDate: new Date().toISOString(),
      results: allResults
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.outputDir, `summary-${timestamp}.json`);
    await fs.writeFile(filePath, JSON.stringify(summary, null, 2));
    
    return summary;
  }
}

module.exports = { TestReporter };