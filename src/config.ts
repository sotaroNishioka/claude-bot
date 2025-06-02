import dotenv from 'dotenv';
import { Config } from './types';
import { resolve } from 'path';
import { existsSync } from 'fs';

dotenv.config();

export const config: Config = {
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    cliPath: process.env.CLAUDE_CLI_PATH || 'claude',
    dailyTokenLimit: parseInt(process.env.DAILY_TOKEN_LIMIT || '45000'),
  },
  project: {
    targetPath: process.env.TARGET_PROJECT_PATH || '../target-project',
    claudeBotPath: process.env.CLAUDE_BOT_PATH || process.cwd(),
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

// Path validation
const resolvedTargetPath = resolve(config.project.targetPath);
if (!existsSync(resolvedTargetPath)) {
  console.warn(`Target project path does not exist: ${resolvedTargetPath}`);
  console.warn('Please ensure TARGET_PROJECT_PATH points to a valid directory');
}

// Claude CLI validation
if (config.claude.cliPath !== 'claude') {
  if (!existsSync(config.claude.cliPath)) {
    console.warn(`Claude CLI path does not exist: ${config.claude.cliPath}`);
    console.warn('Please verify CLAUDE_CLI_PATH points to a valid Claude CLI executable');
  }
}

// Export resolved paths for use in other modules
export const resolvedPaths = {
  targetProject: resolve(config.project.targetPath),
  claudeBot: resolve(config.project.claudeBotPath),
};

console.log('Configuration loaded:', {
  github: `${config.github.owner}/${config.github.repo}`,
  targetProject: resolvedPaths.targetProject,
  claudeCli: config.claude.cliPath,
  environment: config.system.environment,
});