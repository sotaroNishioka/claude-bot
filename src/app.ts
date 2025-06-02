import cron from 'node-cron';
import { GitHubClient } from './github-client';
import { MentionTracker } from './database';
import { MentionDetector } from './mention-detector';
import { ClaudeProcessor } from './claude-processor';
import { logger } from './logger';
import { config } from './config';

export class ClaudeBotApp {
  private githubClient: GitHubClient;
  private tracker: MentionTracker;
  private detector: MentionDetector;
  private processor: ClaudeProcessor;
  private isRunning = false;
  private detectionJob: cron.ScheduledTask | null = null;
  private backupJob: cron.ScheduledTask | null = null;

  constructor() {
    this.githubClient = new GitHubClient();
    this.tracker = new MentionTracker();
    this.detector = new MentionDetector(this.githubClient, this.tracker);
    this.processor = new ClaudeProcessor(this.githubClient, this.tracker);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Claude Bot...');
      
      // Initialize database
      await this.tracker.init();
      
      // Verify GitHub connection
      const repoInfo = await this.githubClient.getRepositoryInfo();
      logger.info('Connected to GitHub repository', repoInfo);
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      logger.info('Claude Bot initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Claude Bot', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Claude Bot is already running');
      return;
    }

    try {
      await this.initialize();
      
      this.isRunning = true;
      
      // Setup cron jobs
      this.setupDetectionJob();
      this.setupBackupJob();
      
      logger.info('Claude Bot started successfully', {
        detectionInterval: config.cron.detectionInterval,
        backupInterval: config.cron.backupInterval,
      });
      
      // Run initial detection
      await this.runDetectionCycle();
      
    } catch (error) {
      logger.error('Failed to start Claude Bot', { error });
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Claude Bot is not running');
      return;
    }

    logger.info('Stopping Claude Bot...');
    
    this.isRunning = false;
    
    // Stop cron jobs
    if (this.detectionJob) {
      this.detectionJob.stop();
      this.detectionJob = null;
    }
    
    if (this.backupJob) {
      this.backupJob.stop();
      this.backupJob = null;
    }
    
    // Close database connection
    await this.tracker.close();
    
    logger.info('Claude Bot stopped successfully');
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
    logger.info('Detection cron job scheduled', { interval: config.cron.detectionInterval });
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
    logger.info('Backup cron job scheduled', { interval: config.cron.backupInterval });
  }

  private async runDetectionCycle(): Promise<void> {
    try {
      logger.info('Starting detection cycle...');
      
      const since = await this.detector.getLastCheckTime();
      const mentions = await this.detector.detectNewMentions(since);
      
      if (mentions.length === 0) {
        logger.debug('No new mentions found');
        return;
      }
      
      logger.info(`Found ${mentions.length} new mentions, processing...`);
      
      // Process mentions sequentially to avoid rate limits
      for (const mention of mentions) {
        try {
          await this.processor.processMention(mention);
          
          // Small delay between processing to be respectful to APIs
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error('Error processing individual mention', {
            error,
            mention: {
              type: mention.type,
              id: mention.id,
              user: mention.user,
            },
          });
          // Continue processing other mentions even if one fails
        }
      }
      
      await this.detector.updateLastCheckTime();
      
      logger.info('Detection cycle completed', {
        totalMentions: mentions.length,
        since,
      });
      
    } catch (error) {
      logger.error('Detection cycle failed', { error });
      // Don't throw to prevent stopping the entire service
    }
  }

  private async runBackup(): Promise<void> {
    try {
      logger.info('Starting database backup...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `./backups/mention_tracker_${timestamp}.db`;
      
      // Ensure backup directory exists
      const { mkdir } = await import('node:fs/promises');
      await mkdir('./backups', { recursive: true });
      
      await this.tracker.backup(backupPath);
      
      logger.info('Database backup completed', { backupPath });
      
      // Cleanup old backups (keep last 7 days)
      await this.cleanupOldBackups();
      
    } catch (error) {
      logger.error('Backup failed', { error });
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const { readdir, stat, unlink } = await import('node:fs/promises');
      const { join } = await import('node:path');
      
      const backupDir = './backups';
      const files = await readdir(backupDir);
      
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      for (const file of files) {
        if (file.startsWith('mention_tracker_') && file.endsWith('.db')) {
          const filePath = join(backupDir, file);
          const stats = await stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await unlink(filePath);
            logger.debug('Deleted old backup', { file });
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup old backups', { error });
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  async runOnce(): Promise<void> {
    try {
      await this.initialize();
      
      logger.info('Running single detection cycle...');
      
      await this.runDetectionCycle();
      
      logger.info('Single detection cycle completed');
      
    } finally {
      await this.tracker.close();
    }
  }

  async getStatus() {
    const stats = await this.tracker.getTodayStats();
    const repoInfo = await this.githubClient.getRepositoryInfo();
    
    return {
      isRunning: this.isRunning,
      repository: repoInfo,
      todayStats: stats,
      configuration: {
        detectionInterval: config.cron.detectionInterval,
        backupInterval: config.cron.backupInterval,
        dailyTokenLimit: config.claude.dailyTokenLimit,
        mentionPatterns: config.mention.patterns,
      },
    };
  }
}
