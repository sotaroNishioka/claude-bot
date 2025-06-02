import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config, resolvedPaths } from './config';
import type { MentionTracker } from './database';
import type { GitHubClient } from './github-client';
import { logger } from './logger';
import type { MentionEvent } from './types';

export class ClaudeProcessor {
  private githubClient: GitHubClient;
  private tracker: MentionTracker;
  private static runningExecutions = 0; // 現在実行中のClaude Code数

  constructor(githubClient: GitHubClient, tracker: MentionTracker) {
    this.githubClient = githubClient;
    this.tracker = tracker;
  }

  static getRunningExecutions(): number {
    return ClaudeProcessor.runningExecutions;
  }

  async processMention(mention: MentionEvent): Promise<void> {
    // 同時実行数が上限に達している場合はスキップ
    if (ClaudeProcessor.runningExecutions >= config.processing.maxConcurrentExecutions) {
      logger.warn(
        `Claude Codeの同時実行数が上限(${config.processing.maxConcurrentExecutions})に達しているためメンションをスキップします`,
        {
          type: mention.type,
          id: mention.id,
          user: mention.user,
          currentRunning: ClaudeProcessor.runningExecutions,
          maxAllowed: config.processing.maxConcurrentExecutions,
        }
      );
      return;
    }

    try {
      logger.info('メンションを処理中', {
        type: mention.type,
        id: mention.id,
        user: mention.user,
      });

      // ターゲットプロジェクトの存在を検証
      if (!this.validateTargetProject()) {
        await this.respondWithError(mention, 'Target project directory not found');
        return;
      }

      // Claude Code実行数をインクリメント
      ClaudeProcessor.runningExecutions++;
      logger.debug(
        `Claude Code実行開始 (${ClaudeProcessor.runningExecutions}/${config.processing.maxConcurrentExecutions})`
      );

      try {
        // プロンプトを読み込み、Claudeを実行
        const prompt = this.loadPrompt(mention);
        const result = await this.executeClaudeCommand(prompt);

        if (result.success) {
          await this.respondWithSuccess(mention);
        } else {
          await this.respondWithError(mention, result.error || 'Claude Code実行に失敗しました');
        }
      } finally {
        // 実行完了後は必ずカウンタをデクリメント
        ClaudeProcessor.runningExecutions--;
        logger.debug(
          `Claude Code実行終了 (${ClaudeProcessor.runningExecutions}/${config.processing.maxConcurrentExecutions})`
        );
      }

      logger.info('メンションの処理が成功しました', {
        type: mention.type,
        id: mention.id,
      });
    } catch (error) {
      logger.error('メンションの処理エラー', { error, mention });
      await this.respondWithError(mention, `処理に失敗しました: ${error}`);
      // エラーが発生した場合もカウンタをデクリメント
      ClaudeProcessor.runningExecutions--;
    }
  }

  private validateTargetProject(): boolean {
    return existsSync(resolvedPaths.targetProject);
  }

  private loadPrompt(mention: MentionEvent): string {
    const { PromptManager } = require('./prompt-manager');
    const promptManager = new PromptManager();
    const promptFile = promptManager.getPromptFileForMentionType(mention.type);
    
    return promptManager.loadAndProcessPrompt(
      promptFile,
      mention.content,
      mention.url,
      mention.title,
      mention.user
    );
  }

  private async executeClaudeCommand(
    prompt: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      logger.debug('Claude CLIを実行中', {
        cwd: resolvedPaths.targetProject,
        claudeCliPath: config.claude.cliPath,
      });

      const claudeArgs = [
        '--output-format',
        'stream-json',
        '--print',
        '--dangerously-skip-permissions',
        '--verbose',
      ];

      const childProcess = spawn(config.claude.cliPath, claudeArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: resolvedPaths.targetProject,
        env: {
          ...process.env,
        },
      });

      let stderr = '';

      // プロンプトをstdinに送信
      childProcess.stdin.write(prompt);
      childProcess.stdin.end();

      childProcess.stdout.on('data', (_data) => {
        // 現在の実装では出力をキャプチャするが使用していない
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          logger.debug('Claude CLIが成功しました');
          resolve({ success: true });
        } else {
          logger.error('Claude CLIが失敗しました', { code, stderr });

          // 権限エラーを処理
          if (stderr.includes('permission')) {
            resolve({
              success: false,
              error: 'Permission error. Please run: claude --dangerously-skip-permissions',
            });
          } else {
            resolve({ success: false, error: stderr || `Exit code: ${code}` });
          }
        }
      });

      childProcess.on('error', (error) => {
        logger.error('Claude CLIの起動に失敗しました', { error });

        if (error.message.includes('ENOENT')) {
          resolve({
            success: false,
            error: `Claude CLI not found at: ${config.claude.cliPath}`,
          });
        } else {
          resolve({ success: false, error: error.message });
        }
      });

      // 5分タイムアウト
      setTimeout(() => {
        childProcess.kill('SIGTERM');
        resolve({ success: false, error: 'Command timeout (5 minutes)' });
      }, 300000);
    });
  }

  private async respondWithSuccess(mention: MentionEvent): Promise<void> {
    const message = `✅ @${mention.user} Claude Code execution completed.

**Target Project:** \`${resolvedPaths.targetProject}\``;
    await this.addComment(mention, message);
  }

  private async respondWithError(mention: MentionEvent, error: string): Promise<void> {
    const message = `❌ @${mention.user} ${error}

**Debug Info:**
- Target Project: \`${resolvedPaths.targetProject}\`
- Claude CLI: \`${config.claude.cliPath}\``;
    await this.addComment(mention, message);
  }

  private async addComment(mention: MentionEvent, message: string): Promise<void> {
    const targetNumber = mention.parentId || mention.id;

    try {
      if (mention.type.includes('pr')) {
        await this.githubClient.addPullRequestComment(targetNumber, message);
      } else {
        await this.githubClient.addIssueComment(targetNumber, message);
      }
    } catch (error) {
      logger.error('コメントの追加に失敗しました', { error, targetNumber });
    }
  }
}
