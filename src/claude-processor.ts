import { spawn } from 'child_process';
import { MentionEvent, ClaudeCommand } from './types';
import { GitHubClient } from './github-client';
import { MentionTracker } from './database';
import { PromptManager } from './prompt-manager';
import { logger } from './logger';
import { config, resolvedPaths } from './config';
import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export class ClaudeProcessor {
  private githubClient: GitHubClient;
  private tracker: MentionTracker;
  private promptManager: PromptManager;
  private dailyTokenUsage: number = 0;

  constructor(githubClient: GitHubClient, tracker: MentionTracker) {
    this.githubClient = githubClient;
    this.tracker = tracker;
    this.promptManager = new PromptManager();
  }

  async processMention(mention: MentionEvent): Promise<void> {
    try {
      logger.info('Processing mention', {
        type: mention.type,
        id: mention.id,
        user: mention.user,
      });

      // Parse the command from mention content
      const command = this.parseCommand(mention);
      
      // Validate target project exists
      if (!this.validateTargetProject()) {
        await this.respondWithProjectError(mention);
        return;
      }

      // Check token budget
      const estimatedTokens = this.estimateTokenUsage(command.action);
      if (!(await this.canUseTokens(estimatedTokens))) {
        await this.respondWithTokenLimitMessage(mention);
        return;
      }

      // Execute Claude CLI with prompt
      await this.executeClaudeWithPrompt(mention, command);
      
      // Record token usage
      await this.recordTokenUsage(estimatedTokens);
      
      logger.info('Mention processed successfully', {
        type: mention.type,
        id: mention.id,
        action: command.action,
        tokensUsed: estimatedTokens,
      });
    } catch (error) {
      logger.error('Error processing mention', {
        error,
        mention,
      });
      
      await this.respondWithErrorMessage(mention, error);
    }
  }

  private validateTargetProject(): boolean {
    const targetPath = resolvedPaths.targetProject;
    
    if (!existsSync(targetPath)) {
      logger.error('Target project path does not exist', { targetPath });
      return false;
    }

    // Check if it's a git repository
    const gitPath = resolve(targetPath, '.git');
    if (!existsSync(gitPath)) {
      logger.warn('Target project is not a git repository', { targetPath });
      // Continue anyway, Claude Code might still work
    }

    return true;
  }

  private parseCommand(mention: MentionEvent): ClaudeCommand {
    const mentionMatch = mention.content.match(/@claude(?:-code)?\s+(.+)/i);
    if (!mentionMatch) {
      return {
        action: 'help',
        target: mention.type.includes('pr') ? 'pr' : 'issue',
        targetNumber: mention.parentId || mention.id,
        parameters: '',
        user: mention.user,
      };
    }

    const commandText = mentionMatch[1].trim();
    
    // Parse action
    const actionMatch = commandText.match(/^(implement|review|analyze|improve|test|help|fix|create|build)\b/i);
    const action = actionMatch ? actionMatch[1].toLowerCase() as ClaudeCommand['action'] : 'help';
    
    // Extract parameters
    const parameters = actionMatch 
      ? commandText.substring(actionMatch[0].length).trim()
      : commandText;

    return {
      action,
      target: mention.type.includes('pr') ? 'pr' : 'issue',
      targetNumber: mention.parentId || mention.id,
      parameters,
      user: mention.user,
    };
  }

  private async executeClaudeWithPrompt(mention: MentionEvent, command: ClaudeCommand): Promise<void> {
    const isClaudeAvailable = !!config.claude.apiKey;
    
    if (!isClaudeAvailable) {
      await this.respondWithClaudeUnavailableMessage(mention);
      return;
    }

    try {
      // Get appropriate prompt file for mention type
      const promptFile = this.promptManager.getPromptFileForMentionType(mention.type);
      
      // Check if prompt exists
      if (!this.promptManager.promptExists(promptFile)) {
        logger.warn(`Prompt file not found: ${promptFile}, using default`);
        await this.showHelp(mention);
        return;
      }

      // Load and process prompt
      const template = this.promptManager.loadPrompt(promptFile);
      const promptVariables = await this.buildPromptVariables(mention, command);
      const processedPrompt = this.promptManager.processPrompt(template, promptVariables);

      // Execute Claude CLI with processed prompt
      const result = await this.runClaudeCommand(processedPrompt);
      
      if (result.success) {
        const responseMessage = `✅ @${command.user} Claude Code execution completed.\n\n**Working Directory:** \`${resolvedPaths.targetProject}\`\n**Prompt File:** \`${promptFile}\``;
        await this.respondToMention(command, responseMessage);
      } else {
        throw new Error(`Claude execution failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('Claude execution failed', { error, command });
      throw error;
    }
  }

  private async buildPromptVariables(mention: MentionEvent, command: ClaudeCommand): Promise<Record<string, string>> {
    const variables: Record<string, string> = {
      USER_REQUEST: command.parameters || mention.content,
      USER: command.user,
      REPO_NAME: `${config.github.owner}/${config.github.repo}`,
      PROJECT_PATH: resolvedPaths.targetProject,
      MENTION_TYPE: mention.type,
    };

    // Add issue/PR specific variables
    if (mention.type.includes('issue')) {
      try {
        const issue = await this.githubClient.getIssueDetails(command.targetNumber);
        variables.ISSUE_NUMBER = command.targetNumber.toString();
        variables.ISSUE_TITLE = issue.title;
        variables.ISSUE_BODY = issue.body || '';
        variables.ISSUE_LABELS = issue.labels.map(l => l.name).join(', ');
        variables.ISSUE_STATE = issue.state;
      } catch (error) {
        logger.warn('Failed to fetch issue details', { error, issueNumber: command.targetNumber });
      }
    } else if (mention.type.includes('pr')) {
      try {
        const pr = await this.githubClient.getPullRequestDetails(command.targetNumber);
        variables.PR_NUMBER = command.targetNumber.toString();
        variables.PR_TITLE = pr.title;
        variables.PR_BODY = pr.body || '';
        variables.PR_STATE = pr.state;
        variables.PR_BASE_BRANCH = pr.base.ref;
        variables.PR_HEAD_BRANCH = pr.head.ref;
      } catch (error) {
        logger.warn('Failed to fetch PR details', { error, prNumber: command.targetNumber });
      }
    }

    return variables;
  }

  private async runClaudeCommand(prompt: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = resolve(resolvedPaths.claudeBot, 'logs', `claude_execution_${timestamp}.log`);
      
      logger.debug('Running Claude CLI command', { 
        cwd: resolvedPaths.targetProject,
        claudeCliPath: config.claude.cliPath,
        logFile
      });
      
      // Claude CLI コマンド（automation.sh の方式を参考）
      const claudeArgs = [
        '--output-format', 'stream-json',
        '--print',
        '--dangerously-skip-permissions',
        '--verbose'
      ];
      
      const process = spawn(config.claude.cliPath, claudeArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: resolvedPaths.targetProject, // 重要: target-project で実行
        env: {
          ...process.env,
          // Claude API key を環境変数として渡す
          CLAUDE_API_KEY: config.claude.apiKey,
        },
      });

      let stdout = '';
      let stderr = '';

      // プロンプトを stdin に送信
      process.stdin.write(prompt);
      process.stdin.end();

      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        // ログファイルにも出力（automation.sh の tee と同様）
        try {
          require('fs').appendFileSync(logFile, chunk);
        } catch (error) {
          logger.warn('Failed to write to log file', { error, logFile });
        }
      });

      process.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        try {
          require('fs').appendFileSync(logFile, `STDERR: ${chunk}`);
        } catch (error) {
          logger.warn('Failed to write stderr to log file', { error, logFile });
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          logger.debug('Claude CLI command succeeded', { stdout: stdout.slice(0, 500) });
          resolve({ success: true });
        } else {
          logger.error('Claude CLI command failed', { code, stderr, stdout: stdout.slice(0, 500) });
          
          // 権限エラーの特別処理（automation.sh を参考）
          if (stderr.includes('permission') || stderr.includes('権限')) {
            const permissionError = 'Permission error detected. Please run manually: claude --dangerously-skip-permissions';
            resolve({ success: false, error: permissionError });
          } else {
            resolve({ success: false, error: stderr || `Exit code: ${code}` });
          }
        }
      });

      process.on('error', (error) => {
        logger.error('Failed to spawn Claude CLI process', { 
          error, 
          command: config.claude.cliPath,
          cwd: resolvedPaths.targetProject 
        });
        
        // More specific error messages
        if (error.message.includes('ENOENT')) {
          const errorMsg = `Claude CLI not found at: ${config.claude.cliPath}. Please check CLAUDE_CLI_PATH setting.`;
          resolve({ success: false, error: errorMsg });
        } else {
          resolve({ success: false, error: error.message });
        }
      });

      // Set timeout for long-running commands (5 minutes)
      setTimeout(() => {
        process.kill('SIGTERM');
        resolve({ success: false, error: 'Command timeout (5 minutes)' });
      }, 300000);
    });
  }

  private async showHelp(mention: MentionEvent): Promise<void> {
    const availablePrompts = this.promptManager.getAvailablePrompts();
    
    const helpMessage = `📖 **Claude Code Usage**

**Available Commands:**
- \`@claude implement [details]\` - Implement the ${mention.type.includes('pr') ? 'PR' : 'issue'}
- \`@claude review [focus]\` - Review code with specific focus
- \`@claude analyze [aspect]\` - Analyze code or requirements
- \`@claude improve [area]\` - Suggest improvements
- \`@claude test [type]\` - Generate tests

**Examples:**
- \`@claude implement with security focus\`
- \`@claude review performance and memory usage\`
- \`@claude test unit tests for edge cases\`

**Project Information:**
- **Target Project:** \`${resolvedPaths.targetProject}\`
- **Claude CLI:** \`${config.claude.cliPath}\`
- **Prompt File:** \`${this.promptManager.getPromptFileForMentionType(mention.type)}\`
- **Available Prompts:** ${availablePrompts.join(', ')}

---
*Powered by Claude Code - AI-driven development automation*`;

    const targetNumber = mention.parentId || mention.id;
    if (mention.type.includes('pr')) {
      await this.githubClient.addPullRequestComment(targetNumber, helpMessage);
    } else {
      await this.githubClient.addIssueComment(targetNumber, helpMessage);
    }
  }

  private estimateTokenUsage(action: string): number {
    const tokenEstimates: Record<string, number> = {
      implement: 5000,
      review: 3000,
      analyze: 2000,
      improve: 2500,
      test: 2000,
      help: 0,
    };

    return tokenEstimates[action] || 1000;
  }

  private async canUseTokens(estimatedTokens: number): Promise<boolean> {
    const stats = await this.tracker.getTodayStats();
    const currentUsage = stats?.tokensUsed || 0;
    
    return (currentUsage + estimatedTokens) <= config.claude.dailyTokenLimit;
  }

  private async recordTokenUsage(tokensUsed: number): Promise<void> {
    await this.tracker.updateDailyStats(0, 0, tokensUsed);
    this.dailyTokenUsage += tokensUsed;
  }

  private async respondToMention(command: ClaudeCommand, message: string): Promise<void> {
    if (command.target === 'pr') {
      await this.githubClient.addPullRequestComment(command.targetNumber, message);
    } else {
      await this.githubClient.addIssueComment(command.targetNumber, message);
    }
  }

  private async respondWithTokenLimitMessage(mention: MentionEvent): Promise<void> {
    const message = `⚠️ @${mention.user} Daily token limit reached. Your request will be processed tomorrow or during low-usage hours.`;
    
    const targetNumber = mention.parentId || mention.id;
    if (mention.type.includes('pr')) {
      await this.githubClient.addPullRequestComment(targetNumber, message);
    } else {
      await this.githubClient.addIssueComment(targetNumber, message);
    }
  }

  private async respondWithErrorMessage(mention: MentionEvent, error: any): Promise<void> {
    const message = `❌ @${mention.user} An error occurred while processing your request:\n\n\`\`\`\n${error.message || error}\n\`\`\`\n\nPlease try again or contact support if the problem persists.\n\n**Debug Info:**\n- Target Project: \`${resolvedPaths.targetProject}\`\n- Claude CLI: \`${config.claude.cliPath}\``;
    
    const targetNumber = mention.parentId || mention.id;
    if (mention.type.includes('pr')) {
      await this.githubClient.addPullRequestComment(targetNumber, message);
    } else {
      await this.githubClient.addIssueComment(targetNumber, message);
    }
  }

  private async respondWithClaudeUnavailableMessage(mention: MentionEvent): Promise<void> {
    const message = `⚠️ @${mention.user} Claude Code is currently unavailable. Please ensure CLAUDE_API_KEY is configured properly.\n\n**Configuration:**\n- Claude CLI: \`${config.claude.cliPath}\`\n- Target Project: \`${resolvedPaths.targetProject}\``;
    
    const targetNumber = mention.parentId || mention.id;
    if (mention.type.includes('pr')) {
      await this.githubClient.addPullRequestComment(targetNumber, message);
    } else {
      await this.githubClient.addIssueComment(targetNumber, message);
    }
  }

  private async respondWithProjectError(mention: MentionEvent): Promise<void> {
    const message = `❌ @${mention.user} Target project directory not found: \`${resolvedPaths.targetProject}\`\n\nPlease check your TARGET_PROJECT_PATH configuration.`;
    
    const targetNumber = mention.parentId || mention.id;
    if (mention.type.includes('pr')) {
      await this.githubClient.addPullRequestComment(targetNumber, message);
    } else {
      await this.githubClient.addIssueComment(targetNumber, message);
    }
  }
}