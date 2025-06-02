#!/usr/bin/env node

import { Command } from 'commander';
import { ClaudeBotApp } from './app';
import { config, validateConfig } from './config';
import { logger } from './logger';
import { PidManager } from './pid-manager';

const program = new Command();

program
  .name('claude-bot')
  .description('Claude Code mention detection and automation system')
  .version('1.0.0');

program
  .command('start')
  .description('Start the Claude Bot daemon')
  .option('-d, --daemon', 'Run as daemon')
  .action(async (options) => {
    try {
      // 既に実行中かチェック
      const status = await PidManager.getDaemonStatus();
      if (status.isRunning) {
        console.log(`❌ Claude Bot は既に実行中です (PID: ${status.pid})`);
        process.exit(1);
      }

      // 古いPIDファイルがあれば削除
      if (status.pid && !status.processExists) {
        await PidManager.removePidFile();
      }

      const app = new ClaudeBotApp();

      if (options.daemon) {
        logger.info('Starting Claude Bot as daemon...');
      }

      // PIDファイルを作成
      await PidManager.writePidFile();

      await app.start();

      // プロセスを実行状態に保つ
      process.stdin.resume();
    } catch (error) {
      logger.error('Failed to start Claude Bot', { error });
      await PidManager.removePidFile();
      process.exit(1);
    }
  });

program
  .command('run-once')
  .description('Run a single detection cycle')
  .action(async () => {
    const app = new ClaudeBotApp();

    try {
      await app.runOnce();
      process.exit(0);
    } catch (error) {
      logger.error('Failed to run detection cycle', { error });
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current status')
  .action(async () => {
    const app = new ClaudeBotApp();

    try {
      const status = await app.getStatus();
      console.log(JSON.stringify(status, null, 2));
      process.exit(0);
    } catch (error) {
      logger.error('Failed to get status', { error });
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Setup database and initial configuration')
  .action(async () => {
    const { MentionTracker } = await import('./database');

    try {
      logger.info('Setting up Claude Bot...');

      const tracker = new MentionTracker();
      await tracker.init();

      logger.info('Database initialized successfully');

      // GitHub接続をテスト
      const { GitHubClient } = await import('./github-client');
      const github = new GitHubClient();
      const repoInfo = await github.getRepositoryInfo();

      logger.info('GitHub connection verified', repoInfo);

      await tracker.close();

      logger.info('Setup completed successfully');

      console.log('\n✅ Claude Bot setup completed!');
      console.log('\nNext steps:');
      console.log('1. Configure your .env file based on .env.example');
      console.log('2. Run: npm run start');
      console.log('3. Or run single cycle: npm run dev -- run-once');

      process.exit(0);
    } catch (error) {
      logger.error('Setup failed', { error });
      console.error('\n❌ Setup failed. Please check the logs and your configuration.');
      process.exit(1);
    }
  });

program
  .command('ps')
  .description('Show daemon process status')
  .action(async () => {
    try {
      const status = await PidManager.getDaemonStatus();
      
      console.log('📊 Claude Bot Daemon Status:');
      console.log(`- Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
      console.log(`- PID: ${status.pid || 'N/A'}`);
      console.log(`- PID File: ${status.pidFile}`);
      
      if (status.pid && !status.processExists) {
        console.log('⚠️  Warning: PID file exists but process not found (stale PID file)');
      }
      
      if (status.isRunning) {
        // 追加の情報を取得（GitHub設定が必要）
        try {
          // GitHub設定がある場合のみ詳細ステータスを取得
          if (config.github.token && config.github.owner && config.github.repo) {
            const app = new ClaudeBotApp();
            const appStatus = await app.getStatus();
            
            console.log('\n📈 Application Status:');
            console.log(`- Processing Mentions: ${appStatus.isProcessingMentions ? '🔄 Yes' : '💤 No'}`);
            console.log(`- Running Executions: ${appStatus.runningExecutions}`);
            console.log(`- Repository: ${appStatus.repository.fullName}`);
            
            if (appStatus.todayStats) {
              console.log('\n📊 Today\'s Statistics:');
              console.log(`- Total Checks: ${appStatus.todayStats.totalChecks}`);
              console.log(`- New Mentions: ${appStatus.todayStats.newMentions}`);
              console.log(`- Processed Mentions: ${appStatus.todayStats.processedMentions}`);
              console.log(`- API Calls: ${appStatus.todayStats.apiCalls}`);
              console.log(`- Tokens Used: ${appStatus.todayStats.tokensUsed || 0}`);
            }
          } else {
            console.log('\n📈 Application Status: Limited (GitHub credentials not configured)');
          }
        } catch (error) {
          console.log('\n⚠️  Could not get detailed application status');
        }
      }
      
      process.exit(0);
    } catch (error) {
      logger.error('Failed to get daemon status', { error });
      console.error('❌ Failed to get daemon status:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the Claude Bot daemon')
  .action(async () => {
    try {
      console.log('🛑 Stopping Claude Bot daemon...');
      
      const success = await PidManager.stopDaemon();
      
      if (success) {
        console.log('✅ Claude Bot daemon stopped successfully');
      } else {
        console.log('❌ Failed to stop daemon or daemon was not running');
        process.exit(1);
      }
      
      process.exit(0);
    } catch (error) {
      logger.error('Failed to stop daemon', { error });
      console.error('❌ Failed to stop daemon:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('test-config')
  .description('Test configuration and connections')
  .action(async () => {
    try {
      logger.info('Testing configuration...');

      // 設定をバリデーション
      validateConfig();

      // 設定の読み込みをテスト
      console.log('Configuration loaded:');
      console.log(`- GitHub: ${config.github.owner}/${config.github.repo}`);
      console.log(`- Database: ${config.database.path}`);
      console.log(`- Mention patterns: ${config.mention.patterns.join(', ')}`);

      // GitHub接続をテスト
      const { GitHubClient } = await import('./github-client');
      const github = new GitHubClient();
      const repoInfo = await github.getRepositoryInfo();

      console.log('\n✅ GitHub connection successful:');
      console.log(`- Repository: ${repoInfo.fullName}`);
      console.log(`- Language: ${repoInfo.language}`);
      console.log(`- Stars: ${repoInfo.stars}`);

      // データベース接続をテスト
      const { MentionTracker } = await import('./database');
      const tracker = new MentionTracker();
      await tracker.init();

      const stats = await tracker.getTodayStats();
      console.log('\n✅ Database connection successful');
      console.log(`- Today's stats:`, stats || 'No data yet');

      await tracker.close();

      console.log('\n🎉 All tests passed! Claude Bot is ready to use.');

      process.exit(0);
    } catch (error) {
      logger.error('Configuration test failed', { error });
      console.error('\n❌ Configuration test failed:');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Default action
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
