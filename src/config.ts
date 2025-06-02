import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export const config: Config = {
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    dailyTokenLimit: parseInt(process.env.DAILY_TOKEN_LIMIT || '45000'),
  },
  database: {
    path: process.env.DATABASE_PATH || './mention_tracker.db',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/claude-bot.log',
  },
  cron: {
    detectionInterval: process.env.DETECTION_INTERVAL || '*/5 * * * *',
    backupInterval: process.env.BACKUP_INTERVAL || '0 2 * * *',
  },
  mention: {
    patterns: (process.env.MENTION_PATTERNS || '@claude,@claude-code').split(','),
    enableAutoResponse: process.env.ENABLE_AUTO_RESPONSE === 'true',
  },
  system: {
    environment: (process.env.ENVIRONMENT as 'development' | 'production') || 'production',
    debug: process.env.DEBUG === 'true',
  },
};

// Validation
if (!config.github.token) {
  throw new Error('GITHUB_TOKEN is required');
}

if (!config.github.owner || !config.github.repo) {
  throw new Error('GITHUB_OWNER and GITHUB_REPO are required');
}

if (!config.claude.apiKey) {
  console.warn('CLAUDE_API_KEY is not set. Claude Code features will be disabled.');
}