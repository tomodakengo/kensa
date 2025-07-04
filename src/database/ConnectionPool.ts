import * as sqlite3 from 'sqlite3';
import { DatabaseError } from '../types';

interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
}

interface Connection {
  id: string;
  db: sqlite3.Database;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

export class ConnectionPool {
  private dbPath: string;
  private config: PoolConfig;
  private connections: Map<string, Connection> = new Map();
  private waitingQueue: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  constructor(dbPath: string, config: Partial<PoolConfig> = {}) {
    this.dbPath = dbPath;
    this.config = {
      maxConnections: config.maxConnections || 10,
      minConnections: config.minConnections || 2,
      acquireTimeout: config.acquireTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000 // 5分
    };
  }

  async initialize(): Promise<void> {
    // 最小接続数の接続を作成
    for (let i = 0; i < this.config.minConnections; i++) {
      await this.createConnection();
    }

    // アイドル接続のクリーンアップタイマーを開始
    this.startIdleCleanup();
  }

  private async createConnection(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new DatabaseError('Failed to create connection', 'CONNECTION_POOL_ERROR', err));
          return;
        }

        const connection: Connection = {
          id,
          db,
          inUse: false,
          createdAt: new Date(),
          lastUsedAt: new Date()
        };

        this.connections.set(id, connection);
        resolve(connection);
      });
    });
  }

  async acquire(): Promise<Connection> {
    // 利用可能な接続を探す
    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        connection.inUse = true;
        connection.lastUsedAt = new Date();
        return connection;
      }
    }

    // 新しい接続を作成できる場合
    if (this.connections.size < this.config.maxConnections) {
      const connection = await this.createConnection();
      connection.inUse = true;
      connection.lastUsedAt = new Date();
      return connection;
    }

    // 待機キューに追加
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new DatabaseError('Connection acquire timeout', 'CONNECTION_ACQUIRE_TIMEOUT'));
      }, this.config.acquireTimeout);

      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  async release(connection: Connection): Promise<void> {
    const existingConnection = this.connections.get(connection.id);
    if (!existingConnection) {
      throw new DatabaseError('Connection not found in pool', 'CONNECTION_NOT_FOUND');
    }

    existingConnection.inUse = false;
    existingConnection.lastUsedAt = new Date();

    // 待機中のリクエストがあれば処理
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      if (waiting) {
        clearTimeout(waiting.timeout);
        existingConnection.inUse = true;
        existingConnection.lastUsedAt = new Date();
        waiting.resolve(existingConnection);
      }
    }
  }

  async execute<T>(callback: (db: sqlite3.Database) => Promise<T>): Promise<T> {
    const connection = await this.acquire();
    try {
      return await callback(connection.db);
    } finally {
      await this.release(connection);
    }
  }

  private startIdleCleanup(): void {
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // 1分間隔でクリーンアップ
  }

  private cleanupIdleConnections(): void {
    const now = new Date();
    const connectionsToClose: string[] = [];

    for (const [id, connection] of this.connections) {
      if (!connection.inUse && 
          this.connections.size > this.config.minConnections &&
          now.getTime() - connection.lastUsedAt.getTime() > this.config.idleTimeout) {
        connectionsToClose.push(id);
      }
    }

    for (const id of connectionsToClose) {
      const connection = this.connections.get(id);
      if (connection) {
        connection.db.close((err) => {
          if (err) {
            console.error(`Error closing idle connection ${id}:`, err);
          }
        });
        this.connections.delete(id);
      }
    }
  }

  async close(): Promise<void> {
    // 待機中のリクエストを全て拒否
    for (const waiting of this.waitingQueue) {
      clearTimeout(waiting.timeout);
      waiting.reject(new DatabaseError('Connection pool is closing', 'CONNECTION_POOL_CLOSING'));
    }
    this.waitingQueue = [];

    // 全ての接続を閉じる
    const closePromises = Array.from(this.connections.values()).map(connection => {
      return new Promise<void>((resolve, reject) => {
        connection.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });

    await Promise.all(closePromises);
    this.connections.clear();
  }

  getStats(): {
    totalConnections: number;
    inUseConnections: number;
    idleConnections: number;
    waitingRequests: number;
  } {
    const inUseConnections = Array.from(this.connections.values()).filter(c => c.inUse).length;
    const totalConnections = this.connections.size;
    const idleConnections = totalConnections - inUseConnections;
    const waitingRequests = this.waitingQueue.length;

    return {
      totalConnections,
      inUseConnections,
      idleConnections,
      waitingRequests
    };
  }
}