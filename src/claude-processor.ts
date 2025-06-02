import { spawn } from 'child_process';
import { MentionEvent, ClaudeCommand } from './types';
import { GitHubClient } from './github-client';
import { MentionTracker } from './database';
import { logger } from './logger';
import { config } from './config';

export class ClaudeProcessor {
  private githubClient: GitHubClient;
  private tracker: MentionTracker;
  private dailyTokenUsage: number = 0;

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

      // Parse the command from mention content
      const command = this.parseCommand(mention);
      
      // Check token budget
      const estimatedTokens = this.estimateTokenUsage(command.action);
      if (!(await this.canUseTokens(estimatedTokens))) {
        await this.respondWithTokenLimitMessage(mention);
        return;
      }

      // Execute the appropriate Claude Code command
      await this.executeClaude(mention, command);
      
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

  private async executeClaude(mention: MentionEvent, command: ClaudeCommand): Promise<void> {
    const isClaudeAvailable = !!config.claude.apiKey;
    
    if (!isClaudeAvailable) {
      await this.respondWithClaudeUnavailableMessage(mention);
      return;
    }

    try {
      switch (command.action) {
        case 'implement':
          await this.executeImplementation(command);
          break;
        case 'review':
          await this.executeReview(command);
          break;
        case 'analyze':
          await this.executeAnalysis(command);
          break;
        case 'improve':
          await this.executeImprovement(command);
          break;
        case 'test':
          await this.executeTestGeneration(command);
          break;
        case 'help':
        default:
          await this.showHelp(mention);
          break;
      }
    } catch (error) {
      logger.error('Claude execution failed', { error, command });
      throw error;
    }
  }

  private async executeImplementation(command: ClaudeCommand): Promise<void> {
    logger.info('Executing Claude Code implementation', {
      target: command.target,
      targetNumber: command.targetNumber,
      parameters: command.parameters,
    });

    const claudeCommand = [
      'claude',
      'code',
      'implement',
      `--${command.target}`,
      command.targetNumber.toString(),
    ];

    if (command.parameters) {
      claudeCommand.push('--description', command.parameters);
    }

    claudeCommand.push('--auto-pr');

    const result = await this.runCommand(claudeCommand);
    
    if (result.success) {
      const responseMessage = `✅ @${command.user} Implementation completed by Claude Code. Please check the created PR.`;
      await this.respondToMention(command, responseMessage);
    } else {
      throw new Error(`Implementation failed: ${result.error}`);
    }
  }

  private async executeReview(command: ClaudeCommand): Promise<void> {
    logger.info('Executing Claude Code review', {
      target: command.target,
      targetNumber: command.targetNumber,
      parameters: command.parameters,
    });

    const claudeCommand = [
      'claude',
      'code',
      'review',
      `--${command.target}`,
      command.targetNumber.toString(),
    ];

    if (command.parameters) {
      claudeCommand.push('--focus', command.parameters);
    }

    claudeCommand.push('--detailed', '--security-check', '--performance-check');

    const result = await this.runCommand(claudeCommand);
    
    if (result.success) {
      const responseMessage = `✅ @${command.user} Code review completed by Claude Code. Check the comments for detailed feedback.`;
      await this.respondToMention(command, responseMessage);
    } else {
      throw new Error(`Review failed: ${result.error}`);
    }
  }

  private async executeAnalysis(command: ClaudeCommand): Promise<void> {
    logger.info('Executing Claude Code analysis', {
      target: command.target,
      targetNumber: command.targetNumber,
      parameters: command.parameters,
    });

    const claudeCommand = [
      'claude',
      'code',
      'analyze',
      `--${command.target}`,
      command.targetNumber.toString(),
    ];

    if (command.parameters) {
      claudeCommand.push('--focus', command.parameters);
    }

    const result = await this.runCommand(claudeCommand);
    
    if (result.success) {
      const responseMessage = `✅ @${command.user} Analysis completed by Claude Code. Detailed insights have been generated.`;
      await this.respondToMention(command, responseMessage);
    } else {
      throw new Error(`Analysis failed: ${result.error}`);
    }
  }

  private async executeImprovement(command: ClaudeCommand): Promise<void> {
    logger.info('Executing Claude Code improvement', {
      target: command.target,
      targetNumber: command.targetNumber,
      parameters: command.parameters,
    });

    const claudeCommand = [
      'claude',
      'code',
      'improve',
      `--${command.target}`,
      command.targetNumber.toString(),
    ];

    if (command.parameters) {
      claudeCommand.push('--focus', command.parameters);
    }

    const result = await this.runCommand(claudeCommand);
    
    if (result.success) {
      const responseMessage = `✅ @${command.user} Code improvement suggestions generated by Claude Code.`;
      await this.respondToMention(command, responseMessage);
    } else {
      throw new Error(`Improvement failed: ${result.error}`);
    }
  }

  private async executeTestGeneration(command: ClaudeCommand): Promise<void> {
    logger.info('Executing Claude Code test generation', {
      target: command.target,
      targetNumber: command.targetNumber,
      parameters: command.parameters,
    });

    const claudeCommand = [
      'claude',
      'code',
      'test',
      `--${command.target}`,
      command.targetNumber.toString(),
    ];

    if (command.parameters) {
      claudeCommand.push('--focus', command.parameters);
    }

    claudeCommand.push('--coverage', '--unit-tests');

    const result = await this.runCommand(claudeCommand);
    
    if (result.success) {
      const responseMessage = `✅ @${command.user} Test generation completed by Claude Code.`;
      await this.respondToMention(command, responseMessage);
    } else {
      throw new Error(`Test generation failed: ${result.error}`);
    }
  }

  private async showHelp(mention: MentionEvent): Promise<void> {
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

---
*Powered by Claude Code - AI-driven development automation*`;

    const targetNumber = mention.parentId || mention.id;
    if (mention.type.includes('pr')) {
      await this.githubClient.addPullRequestComment(targetNumber, helpMessage);
    } else {
      await this.githubClient.addIssueComment(targetNumber, helpMessage);
    }
  }

  private async runCommand(command: string[]): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      logger.debug('Running Claude Code command', { command });
      
      const process = spawn(command[0], command.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          logger.debug('Claude Code command succeeded', { stdout });
          resolve({ success: true });
        } else {
          logger.error('Claude Code command failed', { code, stderr, stdout });
          resolve({ success: false, error: stderr || `Exit code: ${code}` });
        }
      });

      process.on('error', (error) => {
        logger.error('Failed to spawn Claude Code process', { error });
        resolve({ success: false, error: error.message });
      });

      // Set timeout for long-running commands
      setTimeout(() => {
        process.kill('SIGTERM');
        resolve({ success: false, error: 'Command timeout' });
      }, 300000); // 5 minutes timeout
    });
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
    const message = `❌ @${mention.user} An error occurred while processing your request:\n\n\`\`\`\n${error.message || error}\n\`\`\`\n\nPlease try again or contact support if the problem persists.`;
    
    const targetNumber = mention.parentId || mention.id;
    if (mention.type.includes('pr')) {
      await this.githubClient.addPullRequestComment(targetNumber, message);
    } else {
      await this.githubClient.addIssueComment(targetNumber, message);
    }
  }

  private async respondWithClaudeUnavailableMessage(mention: MentionEvent): Promise<void> {
    const message = `⚠️ @${mention.user} Claude Code is currently unavailable. Please ensure CLAUDE_API_KEY is configured properly.`;
    
    const targetNumber = mention.parentId || mention.id;
    if (mention.type.includes('pr')) {
      await this.githubClient.addPullRequestComment(targetNumber, message);
    } else {
      await this.githubClient.addIssueComment(targetNumber, message);
    }
  }
}