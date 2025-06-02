import { createHash } from 'node:crypto';
import { type Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { config } from './config';
import { logger } from './logger';
import type { MentionHistory, ProcessingStats, TrackedItem } from './types';

export class MentionTracker {
  private db!: Database<sqlite3.Database, sqlite3.Statement>;

  async init(): Promise<void> {
    try {
      this.db = await open({
        filename: config.database.path,
        driver: sqlite3.Database,
      });

      await this.createTables();
      logger.info('Database initialized successfully', {
        path: config.database.path,
      });
    } catch (error) {
      logger.error('Failed to initialize database', {
        error,
        path: config.database.path,
      });
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    // 追跡アイテムテーブル
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracked_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_type TEXT NOT NULL,
        item_id INTEGER NOT NULL,
        parent_id INTEGER,
        content_hash TEXT NOT NULL,
        has_mention BOOLEAN NOT NULL,
        last_checked DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE(item_type, item_id)
      )
    `);

    // メンション履歴テーブル
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS mention_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_type TEXT NOT NULL,
        item_id INTEGER NOT NULL,
        parent_id INTEGER,
        user_login TEXT NOT NULL,
        mention_content TEXT NOT NULL,
        detected_at DATETIME NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        processed_at DATETIME
      )
    `);

    // 処理統計テーブル
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS processing_stats (
        date TEXT PRIMARY KEY,
        total_checks INTEGER DEFAULT 0,
        new_mentions INTEGER DEFAULT 0,
        processed_mentions INTEGER DEFAULT 0,
        api_calls INTEGER DEFAULT 0,
        tokens_used INTEGER DEFAULT 0
      )
    `);

    // パフォーマンス向上のためのインデックスを作成
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tracked_items_type_id 
      ON tracked_items(item_type, item_id);
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mention_history_detected 
      ON mention_history(detected_at);
    `);
  }

  calculateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  async isContentChanged(
    itemType: string,
    itemId: number,
    content: string,
    parentId?: number
  ): Promise<boolean> {
    const contentHash = this.calculateContentHash(content);
    const now = new Date();

    try {
      const existing = await this.db.get<TrackedItem>(
        'SELECT content_hash FROM tracked_items WHERE item_type = ? AND item_id = ?',
        [itemType, itemId]
      );

      if (!existing) {
        // 新しいアイテム
        await this.recordItem(
          itemType,
          itemId,
          contentHash,
          this.containsMention(content),
          parentId
        );
        return true;
      }

      if (existing.contentHash !== contentHash) {
        // コンテンツが変更された
        await this.updateItem(itemType, itemId, contentHash, this.containsMention(content));
        return true;
      }

      // 変更なし、last_checkedのみ更新
      await this.db.run(
        'UPDATE tracked_items SET last_checked = ? WHERE item_type = ? AND item_id = ?',
        [now.toISOString(), itemType, itemId]
      );

      return false;
    } catch (error) {
      logger.error('Error checking content change', {
        error,
        itemType,
        itemId,
      });
      throw error;
    }
  }

  private async recordItem(
    itemType: string,
    itemId: number,
    contentHash: string,
    hasMention: boolean,
    parentId?: number
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db.run(
      `
      INSERT INTO tracked_items 
      (item_type, item_id, parent_id, content_hash, has_mention, last_checked, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [itemType, itemId, parentId, contentHash, hasMention, now, now, now]
    );
  }

  private async updateItem(
    itemType: string,
    itemId: number,
    contentHash: string,
    hasMention: boolean
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db.run(
      `
      UPDATE tracked_items 
      SET content_hash = ?, has_mention = ?, last_checked = ?, updated_at = ?
      WHERE item_type = ? AND item_id = ?
    `,
      [contentHash, hasMention, now, now, itemType, itemId]
    );
  }

  async recordMention(
    itemType: string,
    itemId: number,
    userLogin: string,
    mentionContent: string,
    parentId?: number
  ): Promise<void> {
    try {
      await this.db.run(
        `
        INSERT INTO mention_history 
        (item_type, item_id, parent_id, user_login, mention_content, detected_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [itemType, itemId, parentId, userLogin, mentionContent, new Date().toISOString()]
      );

      logger.info('Mention recorded', { itemType, itemId, userLogin });
    } catch (error) {
      logger.error('Error recording mention', {
        error,
        itemType,
        itemId,
        userLogin,
      });
      throw error;
    }
  }

  async markMentionProcessed(mentionId: number): Promise<void> {
    await this.db.run(
      'UPDATE mention_history SET processed = TRUE, processed_at = ? WHERE id = ?',
      [new Date().toISOString(), mentionId]
    );
  }

  async getUnprocessedMentions(): Promise<MentionHistory[]> {
    return await this.db.all<MentionHistory[]>(
      'SELECT * FROM mention_history WHERE processed = FALSE ORDER BY detected_at ASC'
    );
  }

  async updateDailyStats(newMentions: number, apiCalls: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await this.db.run(
      `
      INSERT OR REPLACE INTO processing_stats 
      (date, total_checks, new_mentions, processed_mentions, api_calls, tokens_used)
      VALUES (
        ?,
        COALESCE((SELECT total_checks FROM processing_stats WHERE date = ?), 0) + 1,
        COALESCE((SELECT new_mentions FROM processing_stats WHERE date = ?), 0) + ?,
        COALESCE((SELECT processed_mentions FROM processing_stats WHERE date = ?), 0),
        COALESCE((SELECT api_calls FROM processing_stats WHERE date = ?), 0) + ?,
        0
      )
    `,
      [today, today, today, newMentions, today, today, apiCalls]
    );
  }

  async getTodayStats(): Promise<ProcessingStats | null> {
    const today = new Date().toISOString().split('T')[0];
    const result = await this.db.get<ProcessingStats | undefined>(
      'SELECT * FROM processing_stats WHERE date = ?',
      [today]
    );
    return result || null;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      logger.info('Database connection closed');
    }
  }

  private containsMention(content: string): boolean {
    if (!content) return false;
    const { config } = require('./config');
    return config.mention.patterns.some((pattern: string) =>
      content.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  async backup(backupPath: string): Promise<void> {
    try {
      // SQLiteデータベースのバックアップは、ファイルシステムレベルでのコピーで行う
      const fs = await import('node:fs/promises');
      await fs.copyFile(config.database.path, backupPath);
      logger.info('Database backup created', { backupPath });
    } catch (error) {
      logger.error('Database backup failed', { error, backupPath });
      throw error;
    }
  }
}
