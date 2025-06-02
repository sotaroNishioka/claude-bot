import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { config, resolvedPaths } from './config';
import { MentionTracker } from './database';
import { GitHubClient } from './github-client';
import { logger } from './logger';

async function checkClaudeCLI(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(config.claude.cliPath, ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    process.on('close', (code) => {
      resolve(code === 0);
    });

    process.on('error', () => {
      resolve(false);
    });

    // 5秒後にタイムアウト
    setTimeout(() => {
      process.kill('SIGTERM');
      resolve(false);
    }, 5000);
  });
}

function createDefaultPrompts(): void {
  const defaultPrompts = {
    'issue.txt': '{{USER_REQUEST}}',
    'issue_comment.txt': '{{USER_REQUEST}}',
    'pr.txt': '{{USER_REQUEST}}',
    'pr_comment.txt': '{{USER_REQUEST}}',
  };

  for (const [filename, content] of Object.entries(defaultPrompts)) {
    const promptPath = `${resolvedPaths.prompts}/${filename}`;
    if (!existsSync(promptPath)) {
      try {
        writeFileSync(promptPath, content);
        console.log(`✅ Created prompt file: ${filename}`);
      } catch (_error) {
        console.log(`⚠️  Failed to create prompt file: ${filename}`);
      }
    } else {
      console.log(`✓ Prompt file exists: ${filename}`);
    }
  }
}

async function setup() {
  try {
    console.log('🚀 Setting up Claude Bot...');

    // ターゲットプロジェクトディレクトリをチェック
    console.log('📁 Checking target project directory...');
    if (existsSync(resolvedPaths.targetProject)) {
      console.log(`✅ Target project found: ${resolvedPaths.targetProject}`);

      // gitリポジトリかどうかをチェック
      const gitPath = `${resolvedPaths.targetProject}/.git`;
      if (existsSync(gitPath)) {
        console.log('✅ Git repository detected');
      } else {
        console.log('⚠️  Warning: Target project is not a git repository');
      }
    } else {
      console.log(`❌ Target project not found: ${resolvedPaths.targetProject}`);
      console.log('Please create the target project directory or update TARGET_PROJECT_PATH');
    }

    // Claude CLIをチェック
    console.log('🤖 Checking Claude CLI...');
    const claudeAvailable = await checkClaudeCLI();
    if (claudeAvailable) {
      console.log(`✅ Claude CLI found: ${config.claude.cliPath}`);
    } else {
      console.log(`❌ Claude CLI not found: ${config.claude.cliPath}`);
      console.log('Please install Claude CLI or update CLAUDE_CLI_PATH');
      console.log('Installation guide: https://docs.anthropic.com/claude-code/setup');
    }

    // デフォルトプロンプトファイルを作成
    console.log('📝 Creating default prompt files...');
    createDefaultPrompts();

    // データベースを初期化
    console.log('📊 Initializing database...');
    const tracker = new MentionTracker();
    await tracker.init();
    console.log('✅ Database initialized');

    // GitHub接続をテスト
    console.log('🐙 Testing GitHub connection...');
    const github = new GitHubClient();
    const repoInfo = await github.getRepositoryInfo();
    console.log(`✅ Connected to ${repoInfo.fullName}`);

    // 必要なディレクトリを作成
    console.log('📁 Creating directories...');
    const { mkdir } = await import('node:fs/promises');
    await mkdir('./logs', { recursive: true });
    await mkdir('./backups', { recursive: true });
    console.log('✅ Directories created');

    // 接続を閉じる
    await tracker.close();

    console.log('\n🎉 Setup completed!');
    console.log('\n🛠️  Configuration summary:');
    console.log(`- Repository: ${config.github.owner}/${config.github.repo}`);
    console.log(`- Target Project: ${resolvedPaths.targetProject}`);
    console.log(`- Claude CLI: ${config.claude.cliPath}`);
    console.log(`- Prompts Dir: ${resolvedPaths.prompts}`);
    console.log(`- Detection interval: ${config.cron.detectionInterval}`);
    console.log(`- Mention patterns: ${config.mention.patterns.join(', ')}`);

    console.log('\n🚀 Next steps:');
    if (!existsSync(resolvedPaths.targetProject)) {
      console.log('1. Create target project directory:');
      console.log(`   mkdir -p ${resolvedPaths.targetProject}`);
      console.log(`   cd ${resolvedPaths.targetProject}`);
      console.log('   git init  # 新しいプロジェクトを開始する場合');
    }

    if (!claudeAvailable) {
      console.log('2. Install and setup Claude CLI:');
      console.log('   curl -fsSL https://claude.ai/cli/install.sh | sh');
      console.log('   claude auth login');
    }

    console.log('3. Run Claude Bot:');
    console.log('   npm run start     # Start as daemon');
    console.log('   npm run dev       # Development mode');
    console.log('   npm run dev -- run-once  # Single run test');

    console.log('\n📖 Example usage:');
    console.log('In your GitHub issues/PRs, use:');
    console.log('- @claude implement this feature with error handling');
    console.log('- @claude review this code for security issues');
    console.log('- @claude help');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setup();
}

export { setup };
