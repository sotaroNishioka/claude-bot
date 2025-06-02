import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import type { Config } from './types';

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
    dailyTokenLimit: Number.parseInt(process.env.DAILY_TOKEN_LIMIT || '45000', 10),
  },
  project: {
    targetPath: process.env.TARGET_PROJECT_PATH || '../target-project',
    claudeBotPath: process.env.CLAUDE_BOT_PATH || process.cwd(),
  },
  prompts: {
    dir: process.env.PROMPTS_DIR || './prompts',
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
  processing: {
    maxConcurrentExecutions: Number.parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '1', 10),
  },
  system: {
    environment: (process.env.ENVIRONMENT as 'development' | 'production') || 'production',
    debug: process.env.DEBUG === 'true',
  },
};

// バリデーション
if (!config.github.token) {
  throw new Error('GITHUB_TOKEN is required');
}

if (!config.github.owner || !config.github.repo) {
  throw new Error('GITHUB_OWNER and GITHUB_REPO are required');
}

if (!config.claude.apiKey) {
  console.warn('CLAUDE_API_KEY is not set. Claude Code features will be disabled.');
}

// パスの検証
const resolvedTargetPath = resolve(config.project.targetPath);
if (!existsSync(resolvedTargetPath)) {
  console.warn(`Target project path does not exist: ${resolvedTargetPath}`);
  console.warn('Please ensure TARGET_PROJECT_PATH points to a valid directory');
}

// プロンプトディレクトリの検証と作成
const resolvedPromptsPath = resolve(config.prompts.dir);
if (!existsSync(resolvedPromptsPath)) {
  console.warn(`Prompts directory does not exist: ${resolvedPromptsPath}`);
  console.warn('Creating prompts directory...');
  try {
    require('node:fs').mkdirSync(resolvedPromptsPath, { recursive: true });
  } catch (error) {
    console.error('Failed to create prompts directory:', error);
  }
}

// Claude CLIの検証
if (config.claude.cliPath !== 'claude') {
  if (!existsSync(config.claude.cliPath)) {
    console.warn(`Claude CLI path does not exist: ${config.claude.cliPath}`);
    console.warn('Please verify CLAUDE_CLI_PATH points to a valid Claude CLI executable');
  }
}

// 日次トークン制限の検証
if (config.claude.dailyTokenLimit <= 0) {
  console.warn('DAILY_TOKEN_LIMIT should be a positive number. Using default: 45000');
  config.claude.dailyTokenLimit = 45000;
}

// 同時実行数の検証
if (
  config.processing.maxConcurrentExecutions <= 0 ||
  config.processing.maxConcurrentExecutions > 10
) {
  console.warn('MAX_CONCURRENT_EXECUTIONS should be between 1 and 10. Using default: 1');
  config.processing.maxConcurrentExecutions = 1;
}

// 他のモジュールで使用するために解決したパスをエクスポート
export const resolvedPaths = {
  targetProject: resolve(config.project.targetPath),
  claudeBot: resolve(config.project.claudeBotPath),
  prompts: resolve(config.prompts.dir),
};

console.log('Configuration loaded:', {
  github: `${config.github.owner}/${config.github.repo}`,
  targetProject: resolvedPaths.targetProject,
  claudeCli: config.claude.cliPath,
  promptsDir: resolvedPaths.prompts,
  environment: config.system.environment,
  dailyTokenLimit: config.claude.dailyTokenLimit,
  maxConcurrentExecutions: config.processing.maxConcurrentExecutions,
});
