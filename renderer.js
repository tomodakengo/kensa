// フロントエンドJavaScript
class UIApplication {
  constructor() {
    this.currentTest = null;
    this.isRecording = false;
    this.isRunning = false;
    this.testSteps = [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.updateStatus('準備完了');
    this.updateConnectionStatus('未接続');
    this.updateTestCount(0);
  }

  bindEvents() {
    // タブナビゲーション
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // テスト管理ボタン
    document.getElementById('new-test-btn').addEventListener('click', () => {
      this.createNewTest();
    });

    document.getElementById('open-test-btn').addEventListener('click', () => {
      this.openTest();
    });

    document.getElementById('save-test-btn').addEventListener('click', () => {
      this.saveTest();
    });

    // 記録・実行ボタン
    document.getElementById('start-recording-btn').addEventListener('click', () => {
      this.startRecording();
    });

    document.getElementById('stop-recording-btn').addEventListener('click', () => {
      this.stopRecording();
    });

    document.getElementById('run-test-btn').addEventListener('click', () => {
      this.runTest();
    });

    document.getElementById('pause-test-btn').addEventListener('click', () => {
      this.pauseTest();
    });

    // ロケーター関連
    document.getElementById('add-locator-btn').addEventListener('click', () => {
      this.showAddLocatorModal();
    });

    document.getElementById('manage-locators-btn').addEventListener('click', () => {
      this.showLocatorManager();
    });

    // アサーション関連
    document.getElementById('add-assertion-btn').addEventListener('click', () => {
      this.showAddAssertionModal();
    });

    document.getElementById('take-snapshot-btn').addEventListener('click', () => {
      this.takeSnapshot();
    });

    // テストステップ関連
    document.getElementById('add-step-btn').addEventListener('click', () => {
      this.addTestStep();
    });

    // レポート関連
    document.getElementById('generate-report-btn').addEventListener('click', () => {
      this.generateReport();
    });

    document.getElementById('export-report-btn').addEventListener('click', () => {
      this.exportReport();
    });

    // 結果クリア
    document.getElementById('clear-results-btn').addEventListener('click', () => {
      this.clearResults();
    });

    // 設定・ヘルプ
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.showSettings();
    });

    document.getElementById('help-btn').addEventListener('click', () => {
      this.showHelp();
    });

    // モーダル関連
    document.getElementById('modal-close').addEventListener('click', () => {
      this.hideModal();
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') {
        this.hideModal();
      }
    });

    // プロパティ変更イベント
    document.getElementById('test-name').addEventListener('input', (e) => {
      this.updateTestProperty('name', e.target.value);
    });

    document.getElementById('test-description').addEventListener('input', (e) => {
      this.updateTestProperty('description', e.target.value);
    });

    document.getElementById('test-tags').addEventListener('input', (e) => {
      this.updateTestProperty('tags', e.target.value);
    });
  }

  // タブ切り替え
  switchTab(tabName) {
    // タブボタンのアクティブ状態を更新
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // タブパネルの表示を更新
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
  }

  // テスト管理
  createNewTest() {
    this.currentTest = {
      id: Date.now(),
      name: '新規テスト',
      description: '',
      tags: '',
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.testSteps = [];
    this.updateTestProperties();
    this.updateTestStepsList();
    this.updateStatus('新規テストを作成しました');
  }

  openTest() {
    // ファイル選択ダイアログを表示
    this.showModal('テストを開く', `
      <div class="file-selector">
        <p>テストファイルを選択してください:</p>
        <input type="file" id="test-file-input" accept=".json,.js">
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.loadTestFile()">開く</button>
          <button class="btn btn-secondary" onclick="app.hideModal()">キャンセル</button>
        </div>
      </div>
    `);
  }

  loadTestFile() {
    const fileInput = document.getElementById('test-file-input');
    const file = fileInput.files[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const testData = JSON.parse(e.target.result);
          this.currentTest = testData;
          this.testSteps = testData.steps || [];
          this.updateTestProperties();
          this.updateTestStepsList();
          this.updateStatus(`テスト "${testData.name}" を読み込みました`);
          this.hideModal();
        } catch (error) {
          this.showError('ファイルの読み込みに失敗しました: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  }

  saveTest() {
    if (!this.currentTest) {
      this.showError('保存するテストがありません');
      return;
    }

    this.currentTest.steps = this.testSteps;
    this.currentTest.updatedAt = new Date().toISOString();

    const dataStr = JSON.stringify(this.currentTest, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${this.currentTest.name}.json`;
    link.click();

    this.updateStatus(`テスト "${this.currentTest.name}" を保存しました`);
  }

  // 記録・実行
  async startRecording() {
    try {
      this.isRecording = true;
      this.updateRecordingButtons();
      this.updateStatus('記録を開始しました');
      
      // メインプロセスに記録開始を通知
      if (window.electronAPI) {
        await window.electronAPI.startRecording();
      }
    } catch (error) {
      this.showError('記録の開始に失敗しました: ' + error.message);
      this.isRecording = false;
      this.updateRecordingButtons();
    }
  }

  async stopRecording() {
    try {
      this.isRecording = false;
      this.updateRecordingButtons();
      this.updateStatus('記録を停止しました');
      
      // メインプロセスに記録停止を通知
      if (window.electronAPI) {
        const recordedSteps = await window.electronAPI.stopRecording();
        this.addRecordedSteps(recordedSteps);
      }
    } catch (error) {
      this.showError('記録の停止に失敗しました: ' + error.message);
    }
  }

  async runTest() {
    if (!this.currentTest || this.testSteps.length === 0) {
      this.showError('実行するテストがありません');
      return;
    }

    try {
      this.isRunning = true;
      this.updateRunningButtons();
      this.updateStatus('テストを実行中...');
      
      // メインプロセスにテスト実行を通知
      if (window.electronAPI) {
        const results = await window.electronAPI.runTest(this.currentTest);
        this.displayTestResults(results);
      }
    } catch (error) {
      this.showError('テストの実行に失敗しました: ' + error.message);
    } finally {
      this.isRunning = false;
      this.updateRunningButtons();
      this.updateStatus('テスト実行完了');
    }
  }

  pauseTest() {
    this.isRunning = false;
    this.updateRunningButtons();
    this.updateStatus('テストを一時停止しました');
    
    if (window.electronAPI) {
      window.electronAPI.pauseTest();
    }
  }

  // ボタン状態更新
  updateRecordingButtons() {
    const startBtn = document.getElementById('start-recording-btn');
    const stopBtn = document.getElementById('stop-recording-btn');
    
    startBtn.disabled = this.isRecording;
    stopBtn.disabled = !this.isRecording;
  }

  updateRunningButtons() {
    const runBtn = document.getElementById('run-test-btn');
    const pauseBtn = document.getElementById('pause-test-btn');
    
    runBtn.disabled = this.isRunning;
    pauseBtn.disabled = !this.isRunning;
  }

  // テストステップ管理
  addTestStep() {
    this.showModal('ステップ追加', `
      <div class="step-form">
        <div class="form-group">
          <label>アクション:</label>
          <select id="step-action">
            <option value="click">クリック</option>
            <option value="type">タイプ</option>
            <option value="hover">ホバー</option>
            <option value="wait">待機</option>
            <option value="assert">アサーション</option>
          </select>
        </div>
        <div class="form-group">
          <label>ロケーター:</label>
          <input type="text" id="step-locator" placeholder="要素のロケーター">
        </div>
        <div class="form-group">
          <label>値:</label>
          <input type="text" id="step-value" placeholder="入力値または期待値">
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.saveTestStep()">追加</button>
          <button class="btn btn-secondary" onclick="app.hideModal()">キャンセル</button>
        </div>
      </div>
    `);
  }

  saveTestStep() {
    const action = document.getElementById('step-action').value;
    const locator = document.getElementById('step-locator').value;
    const value = document.getElementById('step-value').value;

    const step = {
      id: Date.now(),
      action: action,
      locator: locator,
      value: value,
      timestamp: new Date().toISOString()
    };

    this.testSteps.push(step);
    this.updateTestStepsList();
    this.hideModal();
    this.updateStatus('ステップを追加しました');
  }

  addRecordedSteps(steps) {
    if (steps && steps.length > 0) {
      this.testSteps.push(...steps);
      this.updateTestStepsList();
      this.updateStatus(`${steps.length}個のステップを記録しました`);
    }
  }

  updateTestStepsList() {
    const container = document.getElementById('test-steps-list');
    container.innerHTML = '';

    this.testSteps.forEach((step, index) => {
      const stepElement = document.createElement('div');
      stepElement.className = 'test-step';
      stepElement.innerHTML = `
        <div class="step-header">
          <span class="step-number">${index + 1}</span>
          <span class="step-action">${step.action}</span>
          <button class="btn btn-sm btn-danger" onclick="app.removeTestStep(${index})">削除</button>
        </div>
        <div class="step-details">
          <div><strong>ロケーター:</strong> ${step.locator || 'なし'}</div>
          <div><strong>値:</strong> ${step.value || 'なし'}</div>
        </div>
      `;
      container.appendChild(stepElement);
    });
  }

  removeTestStep(index) {
    this.testSteps.splice(index, 1);
    this.updateTestStepsList();
    this.updateStatus('ステップを削除しました');
  }

  // プロパティ管理
  updateTestProperties() {
    if (this.currentTest) {
      document.getElementById('test-name').value = this.currentTest.name || '';
      document.getElementById('test-description').value = this.currentTest.description || '';
      document.getElementById('test-tags').value = this.currentTest.tags || '';
    }
  }

  updateTestProperty(property, value) {
    if (this.currentTest) {
      this.currentTest[property] = value;
    }
  }

  // モーダル管理
  showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  // 結果表示
  displayTestResults(results) {
    const container = document.getElementById('results-list');
    container.innerHTML = '';

    if (results && results.length > 0) {
      results.forEach(result => {
        const resultElement = document.createElement('div');
        resultElement.className = `result-item ${result.status}`;
        resultElement.innerHTML = `
          <div class="result-header">
            <span class="result-status">${result.status}</span>
            <span class="result-time">${result.timestamp}</span>
          </div>
          <div class="result-message">${result.message}</div>
        `;
        container.appendChild(resultElement);
      });
    } else {
      container.innerHTML = '<p>テスト結果がありません</p>';
    }
  }

  clearResults() {
    document.getElementById('results-list').innerHTML = '';
    this.updateStatus('結果をクリアしました');
  }

  // ロケーター管理
  showAddLocatorModal() {
    this.showModal('ロケーター追加', `
      <div class="locator-form">
        <div class="form-group">
          <label>名前:</label>
          <input type="text" id="locator-name" placeholder="ロケーター名">
        </div>
        <div class="form-group">
          <label>セレクター:</label>
          <input type="text" id="locator-selector" placeholder="CSSセレクターまたはXPath">
        </div>
        <div class="form-group">
          <label>説明:</label>
          <textarea id="locator-description" placeholder="ロケーターの説明"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.saveLocator()">保存</button>
          <button class="btn btn-secondary" onclick="app.hideModal()">キャンセル</button>
        </div>
      </div>
    `);
  }

  saveLocator() {
    const name = document.getElementById('locator-name').value;
    const selector = document.getElementById('locator-selector').value;
    const description = document.getElementById('locator-description').value;

    if (!name || !selector) {
      this.showError('名前とセレクターは必須です');
      return;
    }

    const locator = {
      id: Date.now(),
      name: name,
      selector: selector,
      description: description,
      createdAt: new Date().toISOString()
    };

    // ロケーターを保存
    if (window.electronAPI) {
      window.electronAPI.saveLocator(locator);
    }

    this.hideModal();
    this.updateStatus(`ロケーター "${name}" を保存しました`);
  }

  showLocatorManager() {
    // ロケーター管理画面を表示
    this.switchTab('reports');
    this.showModal('ロケーター管理', `
      <div class="locator-manager">
        <p>ロケーター管理機能は開発中です。</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="app.hideModal()">閉じる</button>
        </div>
      </div>
    `);
  }

  // アサーション管理
  showAddAssertionModal() {
    this.showModal('アサーション追加', `
      <div class="assertion-form">
        <div class="form-group">
          <label>タイプ:</label>
          <select id="assertion-type">
            <option value="visible">要素が表示される</option>
            <option value="text">テキストが一致する</option>
            <option value="value">値が一致する</option>
            <option value="enabled">要素が有効</option>
            <option value="checked">チェックされている</option>
          </select>
        </div>
        <div class="form-group">
          <label>ロケーター:</label>
          <input type="text" id="assertion-locator" placeholder="要素のロケーター">
        </div>
        <div class="form-group">
          <label>期待値:</label>
          <input type="text" id="assertion-expected" placeholder="期待する値">
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.saveAssertion()">追加</button>
          <button class="btn btn-secondary" onclick="app.hideModal()">キャンセル</button>
        </div>
      </div>
    `);
  }

  saveAssertion() {
    const type = document.getElementById('assertion-type').value;
    const locator = document.getElementById('assertion-locator').value;
    const expected = document.getElementById('assertion-expected').value;

    if (!locator) {
      this.showError('ロケーターは必須です');
      return;
    }

    const assertion = {
      id: Date.now(),
      type: type,
      locator: locator,
      expected: expected,
      timestamp: new Date().toISOString()
    };

    // アサーションをステップとして追加
    const step = {
      id: Date.now(),
      action: 'assert',
      locator: locator,
      value: JSON.stringify(assertion),
      timestamp: new Date().toISOString()
    };

    this.testSteps.push(step);
    this.updateTestStepsList();
    this.hideModal();
    this.updateStatus('アサーションを追加しました');
  }

  async takeSnapshot() {
    try {
      this.updateStatus('スナップショットを撮影中...');
      
      if (window.electronAPI) {
        const snapshot = await window.electronAPI.takeSnapshot();
        this.updateStatus('スナップショットを撮影しました');
      }
    } catch (error) {
      this.showError('スナップショットの撮影に失敗しました: ' + error.message);
    }
  }

  // レポート管理
  async generateReport() {
    try {
      this.updateStatus('レポートを生成中...');
      
      if (window.electronAPI) {
        const report = await window.electronAPI.generateReport();
        this.displayReport(report);
      }
    } catch (error) {
      this.showError('レポートの生成に失敗しました: ' + error.message);
    }
  }

  displayReport(report) {
    const container = document.getElementById('reports-content');
    container.innerHTML = `
      <div class="report-summary">
        <h4>テスト実行サマリー</h4>
        <p>実行日時: ${report.timestamp}</p>
        <p>総テスト数: ${report.totalTests}</p>
        <p>成功: ${report.passed}</p>
        <p>失敗: ${report.failed}</p>
        <p>実行時間: ${report.duration}ms</p>
      </div>
      <div class="report-details">
        <h4>詳細結果</h4>
        <pre>${JSON.stringify(report.details, null, 2)}</pre>
      </div>
    `;
    
    this.updateStatus('レポートを生成しました');
  }

  exportReport() {
    this.updateStatus('レポートのエクスポート機能は開発中です');
  }

  // 設定・ヘルプ
  showSettings() {
    this.showModal('設定', `
      <div class="settings-form">
        <div class="form-group">
          <label>デフォルト待機時間 (ms):</label>
          <input type="number" id="default-wait-time" value="1000">
        </div>
        <div class="form-group">
          <label>スクリーンショット保存先:</label>
          <input type="text" id="screenshot-path" value="./screenshots">
        </div>
        <div class="form-group">
          <label>レポート保存先:</label>
          <input type="text" id="report-path" value="./reports">
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.saveSettings()">保存</button>
          <button class="btn btn-secondary" onclick="app.hideModal()">キャンセル</button>
        </div>
      </div>
    `);
  }

  saveSettings() {
    const settings = {
      defaultWaitTime: document.getElementById('default-wait-time').value,
      screenshotPath: document.getElementById('screenshot-path').value,
      reportPath: document.getElementById('report-path').value
    };

    if (window.electronAPI) {
      window.electronAPI.saveSettings(settings);
    }

    this.hideModal();
    this.updateStatus('設定を保存しました');
  }

  showHelp() {
    this.showModal('ヘルプ', `
      <div class="help-content">
        <h4>Windows UI Automation Test Tool</h4>
        <p>このツールはWindowsデスクトップアプリケーションのテスト自動化を支援します。</p>
        
        <h5>基本的な使い方:</h5>
        <ol>
          <li>「新規テスト」ボタンでテストを作成</li>
          <li>「記録開始」ボタンで操作を記録</li>
          <li>「記録停止」ボタンで記録を終了</li>
          <li>「テスト実行」ボタンでテストを実行</li>
        </ol>
        
        <h5>サポートされているアクション:</h5>
        <ul>
          <li>クリック</li>
          <li>タイプ（文字入力）</li>
          <li>ホバー</li>
          <li>待機</li>
          <li>アサーション</li>
        </ul>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="app.hideModal()">閉じる</button>
        </div>
      </div>
    `);
  }

  // ステータス更新
  updateStatus(message) {
    document.getElementById('status-text').textContent = message;
  }

  updateConnectionStatus(status) {
    document.getElementById('connection-status').textContent = `接続状態: ${status}`;
  }

  updateTestCount(count) {
    document.getElementById('test-count').textContent = `テスト数: ${count}`;
  }

  // エラー表示
  showError(message) {
    this.updateStatus(`エラー: ${message}`);
    console.error(message);
  }
}

// アプリケーション初期化
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new UIApplication();
});

// グローバルアクセス用
window.app = app; 