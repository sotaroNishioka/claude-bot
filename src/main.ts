#!/usr/bin/env node

import { Command } from 'commander';
import { ClaudeBotApp } from './app';
import { logger } from './logger';
import { config } from './config';

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
    const app = new ClaudeBotApp();
    
    if (options.daemon) {
      logger.info('Starting Claude Bot as daemon...');
    }
    
    try {
      await app.start();
      
      // Keep the process running
      process.stdin.resume();
      
    } catch (error) {
      logger.error('Failed to start Claude Bot', { error });
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
      
      // Test GitHub connection
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
  .command('test-config')
  .description('Test configuration and connections')
  .action(async () => {
    try {
      logger.info('Testing configuration...');
      
      // Test config loading
      console.log('Configuration loaded:');
      console.log(`- GitHub: ${config.github.owner}/${config.github.repo}`);
      console.log(`- Database: ${config.database.path}`);
      console.log(`- Token limit: ${config.claude.dailyTokenLimit}`);
      console.log(`- Mention patterns: ${config.mention.patterns.join(', ')}`);
      
      // Test GitHub connection
      const { GitHubClient } = await import('./github-client');
      const github = new GitHubClient();
      const repoInfo = await github.getRepositoryInfo();
      
      console.log('\n✅ GitHub connection successful:');
      console.log(`- Repository: ${repoInfo.fullName}`);
      console.log(`- Language: ${repoInfo.language}`);
      console.log(`- Stars: ${repoInfo.stars}`);
      
      // Test database connection
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