import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { MentionEvent } from './types';
import { GitHubClient } from './github-client';
import { MentionTracker } from './database';
import { logger } from './logger';
import { config, resolvedPaths } from './config';

export class ClaudeProcessor {
  private githubClient: GitHubClient;
  private tracker: MentionTracker;

  constructor(githubClient: GitHubClient, tracker: MentionTracker) {
    this.githubClient = githubClient;
    this.tracker = tracker;
  }

  async processMention(mention: MentionEvent): Promise<void> {
    try {
      logger.info('Processing mention', {
        type: mention.type,
        id: mention.id,
        user: mention.user,
      });

      // Validate target project exists
      if (!this.validateTargetProject()) {
        await this.respondWithError(mention, 'Target project directory not found');
        return;
      }

      // Check Claude API availability
      if (!config.claude.apiKey) {
        await this.respondWithError(mention, 'Claude API key not configured');
        return;
      }

      // Load prompt and execute Claude
      const prompt = this.loadPrompt(mention);
      const result = await this.executeClaudeCommand(prompt);
      
      if (result.success) {
        await this.respondWithSuccess(mention);
      } else {
        await this.respondWithError(mention, result.error || 'Claude execution failed');
      }
      
      logger.info('Mention processed successfully', {
        type: mention.type,
        id: mention.id,
      });
    } catch (error) {
      logger.error('Error processing mention', { error, mention });
      await this.respondWithError(mention, `Processing failed: ${error}`);
    }
  }

  private validateTargetProject(): boolean {
    return existsSync(resolvedPaths.targetProject);
  }

  private loadPrompt(mention: MentionEvent): string {
    const promptFile = `${mention.type}.txt`;
    const promptPath = resolve(resolvedPaths.prompts, promptFile);
    
    try {
      const template = readFileSync(promptPath, 'utf-8');
      return template.replace('{{USER_REQUEST}}', mention.content);
    } catch (error) {
      logger.warn(`Prompt file not found: ${promptFile}, using direct content`);
      return mention.content;
    }
  }

  private async executeClaudeCommand(prompt: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      logger.debug('Executing Claude CLI', { 
        cwd: resolvedPaths.targetProject,
        claudeCliPath: config.claude.cliPath
      });
      
      const claudeArgs = [
        '--output-format', 'stream-json',
        '--print',
        '--dangerously-skip-permissions',
        '--verbose'
      ];
      
      const process = spawn(config.claude.cliPath, claudeArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: resolvedPaths.targetProject,
        env: {
          ...process.env,
          CLAUDE_API_KEY: config.claude.apiKey,
        },
      });

      let stdout = '';
      let stderr = '';

      // Send prompt to stdin
      process.stdin.write(prompt);
      process.stdin.end();

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          logger.debug('Claude CLI succeeded');
          resolve({ success: true });
        } else {
          logger.error('Claude CLI failed', { code, stderr });
          
          // Handle permission errors
          if (stderr.includes('permission')) {
            resolve({ 
              success: false, 
              error: 'Permission error. Please run: claude --dangerously-skip-permissions' 
            });
          } else {
            resolve({ success: false, error: stderr || `Exit code: ${code}` });
          }
        }
      });

      process.on('error', (error) => {
        logger.error('Failed to spawn Claude CLI', { error });
        
        if (error.message.includes('ENOENT')) {
          resolve({ 
            success: false, 
            error: `Claude CLI not found at: ${config.claude.cliPath}` 
          });
        } else {
          resolve({ success: false, error: error.message });
        }
      });

      // 5 minute timeout
      setTimeout(() => {
        process.kill('SIGTERM');
        resolve({ success: false, error: 'Command timeout (5 minutes)' });
      }, 300000);
    });
  }

  private async respondWithSuccess(mention: MentionEvent): Promise<void> {
    const message = `✅ @${mention.user} Claude Code execution completed.\n\n**Target Project:** \`${resolvedPaths.targetProject}\``;
    await this.addComment(mention, message);
  }

  private async respondWithError(mention: MentionEvent, error: string): Promise<void> {
    const message = `❌ @${mention.user} ${error}\n\n**Debug Info:**\n- Target Project: \`${resolvedPaths.targetProject}\`\n- Claude CLI: \`${config.claude.cliPath}\``;
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
      logger.error('Failed to add comment', { error, targetNumber });
    }
  }
}