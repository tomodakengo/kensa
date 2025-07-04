import * as os from 'os';

export interface MemoryInfo {
  used: number;
  total: number;
  free: number;
  percentage: number;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: MemoryInfo;
  cpuUsage: number;
  timestamp: number;
}

export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  onEvict?: (key: string, value: any) => void;
}

class CacheEntry<T> {
  constructor(
    public value: T,
    public createdAt: number,
    public accessedAt: number,
    public ttl?: number
  ) {}

  isExpired(): boolean {
    if (!this.ttl) return false;
    return Date.now() - this.createdAt > this.ttl;
  }

  isStale(maxAge: number): boolean {
    return Date.now() - this.accessedAt > maxAge;
  }
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      ttl: options.ttl || 60000, // 1分
      onEvict: options.onEvict || (() => {})
    };

    // 定期的にクリーンアップを実行
    this.startCleanupInterval();
  }

  set(key: string, value: T, ttl?: number): void {
    const entry = new CacheEntry(value, Date.now(), Date.now(), ttl || this.options.ttl);
    
    // サイズ制限チェック
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // 期限切れチェック
    if (entry.isExpired()) {
      this.delete(key);
      return undefined;
    }

    // アクセス時間を更新
    entry.accessedAt = Date.now();
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.isExpired()) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.options.onEvict(key, entry.value);
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    for (const [key, entry] of this.cache) {
      this.options.onEvict(key, entry.value);
    }
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, 30000); // 30秒間隔でクリーンアップ
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.isExpired() || entry.isStale(this.options.ttl * 2)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }
}

export class PerformanceUtils {
  private static memoryCache = new Map<string, MemoryCache<any>>();
  private static performanceMetrics: PerformanceMetrics[] = [];
  private static maxMetricsHistory = 1000;

  /**
   * メモリ使用量の取得
   */
  static getMemoryInfo(): MemoryInfo {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const percentage = Math.round((usedMemory / totalMemory) * 100);

    return {
      used: usedMemory,
      total: totalMemory,
      free: freeMemory,
      percentage
    };
  }

  /**
   * 実行時間の測定
   */
  static async measureExecutionTime<T>(
    operation: () => Promise<T> | T,
    operationName?: string
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    const startMemory = this.getMemoryInfo();
    
    try {
      const result = await operation();
      const endTime = performance.now();
      const endMemory = this.getMemoryInfo();
      
      const metrics: PerformanceMetrics = {
        executionTime: endTime - startTime,
        memoryUsage: endMemory,
        cpuUsage: this.getCPUUsage(),
        timestamp: Date.now()
      };

      // メトリクスを履歴に追加
      this.addMetrics(metrics);

      if (operationName) {
        console.log(`[Performance] ${operationName}: ${metrics.executionTime.toFixed(2)}ms`);
      }

      return { result, metrics };
    } catch (error) {
      const endTime = performance.now();
      console.error(`[Performance] Operation failed after ${(endTime - startTime).toFixed(2)}ms`);
      throw error;
    }
  }

  /**
   * CPU使用率の取得（簡易版）
   */
  static getCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    return Math.round(100 - (totalIdle / totalTick) * 100);
  }

  /**
   * キャッシュの作成
   */
  static createCache<T>(name: string, options?: CacheOptions): MemoryCache<T> {
    const cache = new MemoryCache<T>(options);
    this.memoryCache.set(name, cache);
    return cache;
  }

  /**
   * キャッシュの取得
   */
  static getCache<T>(name: string): MemoryCache<T> | undefined {
    return this.memoryCache.get(name) as MemoryCache<T>;
  }

  /**
   * 並列実行のヘルパー
   */
  static async executeInParallel<T>(
    operations: Array<() => Promise<T>>,
    concurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const batches: Array<Array<() => Promise<T>>> = [];

    // バッチに分割
    for (let i = 0; i < operations.length; i += concurrency) {
      batches.push(operations.slice(i, i + concurrency));
    }

    // バッチごとに並列実行
    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * デバウンス関数
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * スロットル関数
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  }

  /**
   * メモリ使用量の監視
   */
  static startMemoryMonitoring(interval: number = 5000): NodeJS.Timeout {
    return setInterval(() => {
      const memoryInfo = this.getMemoryInfo();
      
      if (memoryInfo.percentage > 90) {
        console.warn(`[Performance] High memory usage: ${memoryInfo.percentage}%`);
        this.forceGarbageCollection();
      }
      
      if (memoryInfo.percentage > 95) {
        console.error(`[Performance] Critical memory usage: ${memoryInfo.percentage}%`);
        this.clearAllCaches();
      }
    }, interval);
  }

  /**
   * ガベージコレクションの強制実行
   */
  static forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      console.log('[Performance] Garbage collection executed');
    } else {
      console.warn('[Performance] Garbage collection not available (run with --expose-gc)');
    }
  }

  /**
   * 全キャッシュのクリア
   */
  static clearAllCaches(): void {
    for (const [name, cache] of this.memoryCache) {
      cache.clear();
      console.log(`[Performance] Cache cleared: ${name}`);
    }
  }

  /**
   * オブジェクトの深いクローン（最適化版）
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  }

  /**
   * 配列の最適化されたソート
   */
  static optimizedSort<T>(
    array: T[],
    compareFn?: (a: T, b: T) => number,
    chunkSize: number = 1000
  ): T[] {
    if (array.length <= chunkSize) {
      return array.sort(compareFn);
    }

    // チャンクに分割してソート
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize).sort(compareFn));
    }

    // マージソート
    while (chunks.length > 1) {
      const mergedChunks: T[][] = [];
      for (let i = 0; i < chunks.length; i += 2) {
        if (i + 1 < chunks.length) {
          mergedChunks.push(this.mergeArrays(chunks[i], chunks[i + 1], compareFn));
        } else {
          mergedChunks.push(chunks[i]);
        }
      }
      chunks.splice(0, chunks.length, ...mergedChunks);
    }

    return chunks[0] || [];
  }

  private static mergeArrays<T>(
    arr1: T[],
    arr2: T[],
    compareFn?: (a: T, b: T) => number
  ): T[] {
    const result: T[] = [];
    let i = 0, j = 0;

          while (i < arr1.length && j < arr2.length) {
        const item1 = arr1[i];
        const item2 = arr2[j];
        
        if (item1 === undefined || item2 === undefined || item1 === null || item2 === null) {
          break;
        }
        
        const comparison = compareFn ? compareFn(item1, item2) : 
                          (item1 < item2 ? -1 : item1 > item2 ? 1 : 0);
        
        if (comparison <= 0) {
          result.push(item1);
          i++;
        } else {
          result.push(item2);
          j++;
        }
      }

    return [...result, ...arr1.slice(i), ...arr2.slice(j)];
  }

  /**
   * パフォーマンスメトリクスの追加
   */
  private static addMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics.push(metrics);
    
    // 履歴のサイズ制限
    if (this.performanceMetrics.length > this.maxMetricsHistory) {
      this.performanceMetrics.shift();
    }
  }

  /**
   * パフォーマンス統計の取得
   */
  static getPerformanceStats(): {
    averageExecutionTime: number;
    averageMemoryUsage: number;
    averageCpuUsage: number;
    totalOperations: number;
  } {
    if (this.performanceMetrics.length === 0) {
      return {
        averageExecutionTime: 0,
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        totalOperations: 0
      };
    }

    const total = this.performanceMetrics.reduce(
      (acc, metric) => ({
        executionTime: acc.executionTime + metric.executionTime,
        memoryUsage: acc.memoryUsage + metric.memoryUsage.percentage,
        cpuUsage: acc.cpuUsage + metric.cpuUsage
      }),
      { executionTime: 0, memoryUsage: 0, cpuUsage: 0 }
    );

    const count = this.performanceMetrics.length;

    return {
      averageExecutionTime: total.executionTime / count,
      averageMemoryUsage: total.memoryUsage / count,
      averageCpuUsage: total.cpuUsage / count,
      totalOperations: count
    };
  }

  /**
   * メモリリークの検出
   */
  static detectMemoryLeaks(): {
    isLeaking: boolean;
    growthRate: number;
    recommendation: string;
  } {
    if (this.performanceMetrics.length < 10) {
      return {
        isLeaking: false,
        growthRate: 0,
        recommendation: 'データ不足：メモリリーク検出のためのデータが不足しています'
      };
    }

    const recent = this.performanceMetrics.slice(-10);
    const older = this.performanceMetrics.slice(-20, -10);

    const recentAvg = recent.reduce((sum, m) => sum + m.memoryUsage.percentage, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.memoryUsage.percentage, 0) / older.length;

    const growthRate = recentAvg - olderAvg;
    const isLeaking = growthRate > 5; // 5%以上の増加でリーク疑い

    let recommendation = '';
    if (isLeaking) {
      recommendation = 'メモリリークの可能性があります。キャッシュのクリアまたはガベージコレクションを実行してください。';
    } else if (growthRate > 2) {
      recommendation = 'メモリ使用量が増加傾向にあります。監視を継続してください。';
    } else {
      recommendation = 'メモリ使用量は正常です。';
    }

    return { isLeaking, growthRate, recommendation };
  }
}