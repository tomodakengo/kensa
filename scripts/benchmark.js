const { performance } = require('perf_hooks');
const fs = require('fs-extra');
const path = require('path');

/**
 * シンプルなパフォーマンスベンチマーク
 */
class PerformanceBenchmark {
  constructor() {
    this.results = [];
    this.outputDir = path.join(__dirname, '..', 'performance');
  }

  /**
   * ベンチマークを実行
   */
  async run() {
    console.log('🚀 Starting performance benchmarks...');
    
    // 出力ディレクトリを作成
    await fs.ensureDir(this.outputDir);

    // 各種ベンチマークを実行
    await this.benchmarkStartupTime();
    await this.benchmarkMemoryUsage();
    await this.benchmarkFileOperations();
    await this.benchmarkDatabaseOperations();

    // 結果を出力
    await this.generateReport();

    console.log('✅ Performance benchmarks completed');
  }

  /**
   * アプリケーション起動時間のベンチマーク
   */
  async benchmarkStartupTime() {
    console.log('📊 Benchmarking startup time...');
    
    const iterations = 5;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // モジュール読み込みをシミュレート
      await this.simulateModuleLoading();
      
      const end = performance.now();
      times.push(end - start);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    this.results.push({
      name: 'Startup Time',
      average: `${averageTime.toFixed(2)}ms`,
      min: `${minTime.toFixed(2)}ms`,
      max: `${maxTime.toFixed(2)}ms`,
      iterations,
      status: averageTime < 1000 ? 'PASS' : 'WARN'
    });
  }

  /**
   * メモリ使用量のベンチマーク
   */
  async benchmarkMemoryUsage() {
    console.log('💾 Benchmarking memory usage...');
    
    const initialMemory = process.memoryUsage();
    
    // メモリ集約的な操作をシミュレート
    const largeArray = new Array(100000).fill(0).map(() => ({
      id: Math.random(),
      data: 'test data'.repeat(100)
    }));

    const afterMemory = process.memoryUsage();
    
    // クリーンアップ
    largeArray.length = 0;
    
    if (global.gc) {
      global.gc();
    }

    const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseMB = (memoryIncrease / 1024 / 1024).toFixed(2);

    this.results.push({
      name: 'Memory Usage',
      initial: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      peak: `${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      increase: `${memoryIncreaseMB}MB`,
      status: memoryIncrease < 50 * 1024 * 1024 ? 'PASS' : 'WARN' // 50MB threshold
    });
  }

  /**
   * ファイル操作のベンチマーク
   */
  async benchmarkFileOperations() {
    console.log('📁 Benchmarking file operations...');
    
    const testDir = path.join(this.outputDir, 'test-files');
    await fs.ensureDir(testDir);

    const iterations = 100;
    const fileSize = 1024; // 1KB files

    // ファイル書き込み
    const writeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const filePath = path.join(testDir, `test-${i}.txt`);
      await fs.writeFile(filePath, 'x'.repeat(fileSize));
    }
    const writeEnd = performance.now();

    // ファイル読み込み
    const readStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const filePath = path.join(testDir, `test-${i}.txt`);
      await fs.readFile(filePath);
    }
    const readEnd = performance.now();

    // クリーンアップ
    await fs.remove(testDir);

    const writeTime = writeEnd - writeStart;
    const readTime = readEnd - readStart;

    this.results.push({
      name: 'File Operations',
      writeTime: `${writeTime.toFixed(2)}ms`,
      readTime: `${readTime.toFixed(2)}ms`,
      writeSpeed: `${(iterations / writeTime * 1000).toFixed(0)} files/sec`,
      readSpeed: `${(iterations / readTime * 1000).toFixed(0)} files/sec`,
      status: (writeTime < 1000 && readTime < 500) ? 'PASS' : 'WARN'
    });
  }

  /**
   * データベース操作のベンチマーク（SQLiteシミュレート）
   */
  async benchmarkDatabaseOperations() {
    console.log('🗄️ Benchmarking database operations...');
    
    // 簡単なメモリ内データベースをシミュレート
    const mockDatabase = [];
    const iterations = 1000;

    // INSERT操作
    const insertStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      mockDatabase.push({
        id: i,
        name: `test-${i}`,
        data: `data-${i}`,
        timestamp: Date.now()
      });
    }
    const insertEnd = performance.now();

    // SELECT操作
    const selectStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = mockDatabase.find(item => item.id === i);
    }
    const selectEnd = performance.now();

    // UPDATE操作
    const updateStart = performance.now();
    for (let i = 0; i < iterations / 2; i++) {
      const item = mockDatabase.find(item => item.id === i);
      if (item) {
        item.data = `updated-${i}`;
      }
    }
    const updateEnd = performance.now();

    const insertTime = insertEnd - insertStart;
    const selectTime = selectEnd - selectStart;
    const updateTime = updateEnd - updateStart;

    this.results.push({
      name: 'Database Operations',
      insertTime: `${insertTime.toFixed(2)}ms`,
      selectTime: `${selectTime.toFixed(2)}ms`,
      updateTime: `${updateTime.toFixed(2)}ms`,
      insertSpeed: `${(iterations / insertTime * 1000).toFixed(0)} ops/sec`,
      selectSpeed: `${(iterations / selectTime * 1000).toFixed(0)} ops/sec`,
      updateSpeed: `${(iterations / 2 / updateTime * 1000).toFixed(0)} ops/sec`,
      status: (insertTime < 100 && selectTime < 50 && updateTime < 50) ? 'PASS' : 'WARN'
    });
  }

  /**
   * モジュール読み込みをシミュレート
   */
  async simulateModuleLoading() {
    // 複数のrequireをシミュレート
    const modules = [
      'path',
      'fs',
      'os',
      'crypto',
      'util'
    ];

    for (const moduleName of modules) {
      require(moduleName);
    }

    // 非同期処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * レポートを生成
   */
  async generateReport() {
    console.log('📋 Generating performance report...');

    const report = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      totalMemory: `${(require('os').totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
      freeMemory: `${(require('os').freemem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
      cpuModel: require('os').cpus()[0].model,
      cpuCores: require('os').cpus().length,
      results: this.results
    };

    // JSON形式で保存
    const jsonPath = path.join(this.outputDir, 'benchmark-results.json');
    await fs.writeJSON(jsonPath, report, { spaces: 2 });

    // 人間が読みやすい形式で保存
    const readablePath = path.join(this.outputDir, 'benchmark-report.txt');
    const readableReport = this.generateReadableReport(report);
    await fs.writeFile(readablePath, readableReport);

    console.log(`📄 Report saved to: ${jsonPath}`);
    console.log(`📄 Readable report saved to: ${readablePath}`);

    // 結果をコンソールに表示
    console.log('\n' + readableReport);
  }

  /**
   * 人間が読みやすいレポートを生成
   */
  generateReadableReport(report) {
    let output = '';
    output += '='.repeat(60) + '\n';
    output += '         PERFORMANCE BENCHMARK REPORT\n';
    output += '='.repeat(60) + '\n';
    output += `Timestamp: ${report.timestamp}\n`;
    output += `Node.js: ${report.nodeVersion}\n`;
    output += `Platform: ${report.platform} (${report.arch})\n`;
    output += `CPU: ${report.cpuModel} (${report.cpuCores} cores)\n`;
    output += `Memory: ${report.freeMemory}/${report.totalMemory} free\n`;
    output += '\n';

    report.results.forEach((result, index) => {
      output += `-`.repeat(40) + '\n';
      output += `${index + 1}. ${result.name} [${result.status}]\n`;
      output += `-`.repeat(40) + '\n';
      
      Object.entries(result).forEach(([key, value]) => {
        if (key !== 'name' && key !== 'status') {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
          output += `${formattedKey.padEnd(15)}: ${value}\n`;
        }
      });
      output += '\n';
    });

    const passCount = report.results.filter(r => r.status === 'PASS').length;
    const warnCount = report.results.filter(r => r.status === 'WARN').length;

    output += '='.repeat(60) + '\n';
    output += `SUMMARY: ${passCount} PASS, ${warnCount} WARN\n`;
    output += '='.repeat(60) + '\n';

    return output;
  }
}

// スクリプトとして実行された場合
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run().catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceBenchmark;