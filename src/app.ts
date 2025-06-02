import cron from 'node-cron';
import { ClaudeProcessor } from './claude-processor';
import { config } from './config';
import { MentionTracker } from './database';
import { GitHubClient } from './github-client';
import { logger } from './logger';
import { MentionDetector } from './mention-detector';
import { PidManager } from './pid-manager';

export class ClaudeBotApp {
  private githubClient: GitHubClient;
  private tracker: MentionTracker;
  private detector: MentionDetector;
  private processor: ClaudeProcessor;
  private isRunning = false;
  private detectionJob: cron.ScheduledTask | null = null;
  private backupJob: cron.ScheduledTask | null = null;
  private isProcessingMentions = false; // Claude処理の同時実行を防ぐフラグ

  constructor() {
    this.githubClient = new GitHubClient();
    this.tracker = new MentionTracker();
    this.detector = new MentionDetector(this.githubClient, this.tracker);
    this.processor = new ClaudeProcessor(this.githubClient, this.tracker);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Claude Botを初期化中...');

      // データベースを初期化
      await this.tracker.init();

      // GitHub接続を確認
      const repoInfo = await this.githubClient.getRepositoryInfo();
      logger.info('GitHubリポジトリに接続しました', repoInfo);

      // 優雅なシャットダウンをセットアップ
      this.setupGracefulShutdown();

      logger.info('Claude Botの初期化が完了しました');
    } catch (error) {
      logger.error('Claude Botの初期化に失敗しました', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Claude Botは既に実行中です');
      return;
    }

    try {
      await this.initialize();

      this.isRunning = true;

      // cronジョブをセットアップ
      this.setupDetectionJob();
      this.setupBackupJob();

      logger.info('Claude Botの開始が成功しました', {
        detectionInterval: config.cron.detectionInterval,
        backupInterval: config.cron.backupInterval,
      });

      // 初回検出を実行
      await this.runDetectionCycle();
    } catch (error) {
      logger.error('Claude Botの開始に失敗しました', { error });
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Claude Botは実行されていません');
      return;
    }

    logger.info('Claude Botを停止中...');

    this.isRunning = false;

    // cronジョブを停止
    if (this.detectionJob) {
      this.detectionJob.stop();
      this.detectionJob = null;
    }

    if (this.backupJob) {
      this.backupJob.stop();
      this.backupJob = null;
    }

    // データベース接続を閉じる
    await this.tracker.close();

    logger.info('Claude Botの停止が完了しました');
  }

  private setupDetectionJob(): void {
    this.detectionJob = cron.schedule(
      config.cron.detectionInterval,
      async () => {
        if (this.isRunning) {
          await this.runDetectionCycle();
        }
      },
      {
        scheduled: false,
        timezone: 'UTC',
      }
    );

    this.detectionJob.start();
    logger.info('検出Cronジョブをスケジュールしました', {
      interval: config.cron.detectionInterval,
    });
  }

  private setupBackupJob(): void {
    this.backupJob = cron.schedule(
      config.cron.backupInterval,
      async () => {
        if (this.isRunning) {
          await this.runBackup();
        }
      },
      {
        scheduled: false,
        timezone: 'UTC',
      }
    );

    this.backupJob.start();
    logger.info('バックアップCronジョブをスケジュールしました', {
      interval: config.cron.backupInterval,
    });
  }

  private async runDetectionCycle(): Promise<void> {
    try {
      logger.info('検出サイクルを開始します...');

      // Claude処理が既に実行中の場合はスキップ
      if (this.isProcessingMentions) {
        logger.info('Claude処理が既に実行中のため、このサイクルをスキップします');
        return;
      }

      const since = await this.detector.getLastCheckTime();
      const newMentions = await this.detector.detectNewMentions(since);
      
      // 新規検出のメンションに加えて、既存の未処理メンションも取得
      const unprocessedMentions = await this.tracker.getUnprocessedMentions();
      
      // 新規メンションと未処理メンションを結合（重複を除去）
      const allMentions = [...newMentions];
      for (const unprocessed of unprocessedMentions) {
        // 新規メンションと重複していない未処理メンションを追加
        const isDuplicate = newMentions.some(
          m => m.type === unprocessed.itemType && m.id === unprocessed.itemId
        );
        if (!isDuplicate) {
          // 未処理メンションをMentionEvent形式に変換
          const mentionEvent = {
            type: unprocessed.itemType as 'issue' | 'issue_comment' | 'pr' | 'pr_comment',
            id: unprocessed.itemId,
            parentId: unprocessed.parentId,
            content: unprocessed.mentionContent,
            user: unprocessed.userLogin,
            detectedAt: unprocessed.detectedAt,
            processed: false,
            url: this.generateUrl(unprocessed.itemType, unprocessed.itemId, unprocessed.parentId),
            title: `${unprocessed.itemType} #${unprocessed.itemId}`,
            mentionHistoryId: unprocessed.id,
          };
          allMentions.push(mentionEvent);
        }
      }

      if (allMentions.length === 0) {
        logger.debug('処理すべきメンションはありません');
        return;
      }

      logger.info(`${allMentions.length}件のメンションを発見（新規: ${newMentions.length}件、未処理: ${allMentions.length - newMentions.length}件）、順次処理します`);

      // Claude処理フラグをセットして同時実行を防ぐ
      this.isProcessingMentions = true;
      let processedCount = 0;

      try {
        // レート制限を避けるためメンションを順次処理
        for (const mention of allMentions) {
          try {
            await this.processor.processMention(mention);
            processedCount++;

            // API に配慮して処理間に小さな遅延を挿入
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch (error) {
            logger.error('個別メンションの処理エラー', {
              error,
              mention: {
                type: mention.type,
                id: mention.id,
                user: mention.user,
              },
            });
            // 1つが失敗しても他のメンションの処理を続行
          }
        }
      } finally {
        // 処理完了後は必ずフラグをリセット
        this.isProcessingMentions = false;
      }

      logger.info(`メンション処理完了: ${processedCount}/${allMentions.length}件処理しました`, {
        processedCount,
        totalMentions: allMentions.length,
        newMentions: newMentions.length,
        unprocessedMentions: allMentions.length - newMentions.length,
      });

      await this.detector.updateLastCheckTime();

      logger.info('検出サイクルが完了しました', {
        totalMentions: allMentions.length,
        newMentions: newMentions.length,
        since,
      });
    } catch (error) {
      logger.error('検出サイクルが失敗しました', { error });
      // サービス全体の停止を防ぐため例外をスローしない
    }
  }

  private async runBackup(): Promise<void> {
    try {
      logger.info('データベースバックアップを開始します...');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `./backups/mention_tracker_${timestamp}.db`;

      // バックアップディレクトリの存在を確保
      const { mkdir } = await import('node:fs/promises');
      await mkdir('./backups', { recursive: true });

      await this.tracker.backup(backupPath);

      logger.info('データベースバックアップが完了しました', { backupPath });

      // 古いバックアップをクリーンアップ（直近7日間を保持）
      await this.cleanupOldBackups();
    } catch (error) {
      logger.error('バックアップが失敗しました', { error });
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const { readdir, stat, unlink } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const backupDir = './backups';
      const files = await readdir(backupDir);

      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7日前

      for (const file of files) {
        if (file.startsWith('mention_tracker_') && file.endsWith('.db')) {
          const filePath = join(backupDir, file);
          const stats = await stat(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            await unlink(filePath);
            logger.debug('古いバックアップを削除しました', { file });
          }
        }
      }
    } catch (error) {
      logger.warn('古いバックアップのクリーンアップに失敗しました', { error });
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal}を受信、優雅にシャットダウン中...`);

      try {
        await this.stop();
        await PidManager.removePidFile();
        process.exit(0);
      } catch (error) {
        logger.error('シャットダウン中のエラー', { error });
        await PidManager.removePidFile();
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // 未処理例外をハンドル
    process.on('uncaughtException', (error) => {
      logger.error('キャッチされない例外', { error });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('ハンドルされないPromiseの拒否', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  async runOnce(): Promise<void> {
    try {
      await this.initialize();

      logger.info('単発検出サイクルを実行中...');

      await this.runDetectionCycle();

      logger.info('単発検出サイクルが完了しました');
    } finally {
      await this.tracker.close();
    }
  }

  private generateUrl(itemType: string, itemId: number, parentId?: number): string {
    const baseUrl = `https://github.com/${config.github.owner}/${config.github.repo}`;
    
    if (itemType === 'issue') {
      return `${baseUrl}/issues/${itemId}`;
    } else if (itemType === 'pr') {
      return `${baseUrl}/pull/${itemId}`;
    } else if (itemType === 'issue_comment') {
      return `${baseUrl}/issues/${parentId}#issuecomment-${itemId}`;
    } else if (itemType === 'pr_comment') {
      return `${baseUrl}/pull/${parentId}#issuecomment-${itemId}`;
    }
    
    return baseUrl;
  }

  async getStatus() {
    const stats = await this.tracker.getTodayStats();
    const repoInfo = await this.githubClient.getRepositoryInfo();

    return {
      isRunning: this.isRunning,
      isProcessingMentions: this.isProcessingMentions,
      runningExecutions: ClaudeProcessor.getRunningExecutions(),
      repository: repoInfo,
      todayStats: stats,
      configuration: {
        detectionInterval: config.cron.detectionInterval,
        backupInterval: config.cron.backupInterval,
        mentionPatterns: config.mention.patterns,
        maxConcurrentExecutions: config.processing.maxConcurrentExecutions,
      },
    };
  }
}
