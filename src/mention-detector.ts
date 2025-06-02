import { config } from './config';
import type { MentionTracker } from './database';
import type { GitHubClient } from './github-client';
import { logger } from './logger';
import type { MentionEvent } from './types';

export class MentionDetector {
  private githubClient: GitHubClient;
  private tracker: MentionTracker;
  private lastCheckTime: Date | null = null;

  constructor(githubClient: GitHubClient, tracker: MentionTracker) {
    this.githubClient = githubClient;
    this.tracker = tracker;
  }

  async getLastCheckTime(): Promise<string> {
    if (this.lastCheckTime) {
      return this.lastCheckTime.toISOString();
    }

    // 前回チェックがない場合は1時間前をデフォルトに
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    return oneHourAgo.toISOString();
  }

  async updateLastCheckTime(): Promise<void> {
    this.lastCheckTime = new Date();
    logger.debug('Updated last check time', {
      time: this.lastCheckTime.toISOString(),
    });
  }

  async detectNewMentions(since?: string): Promise<MentionEvent[]> {
    const sinceTime = since || (await this.getLastCheckTime());
    const mentions: MentionEvent[] = [];

    try {
      logger.debug('Starting mention detection', { since: sinceTime });

      // Issueをチェック
      const issues = await this.githubClient.getIssuesSince(sinceTime);
      for (const issue of issues) {
        const hasChanged = await this.tracker.isContentChanged(
          'issue',
          issue.number,
          issue.body || ''
        );
        if (hasChanged && this.containsMention(issue.body || '')) {
          const issueUrl = `https://github.com/${config.github.owner}/${config.github.repo}/issues/${issue.number}`;
          mentions.push({
            type: 'issue',
            id: issue.number,
            content: issue.body || '',
            user: issue.user.login,
            detectedAt: new Date(),
            processed: false,
            url: issueUrl,
            title: issue.title,
          });

          await this.tracker.recordMention(
            'issue',
            issue.number,
            issue.user.login,
            issue.body || ''
          );
        }
      }

      // Issueコメントをチェック
      const issueComments = await this.githubClient.getIssueCommentsSince(sinceTime);
      for (const comment of issueComments) {
        const issueNumber = this.githubClient.extractIssueNumber(comment.issue_url);
        const hasChanged = await this.tracker.isContentChanged(
          'issue_comment',
          comment.id,
          comment.body,
          issueNumber
        );
        if (hasChanged && this.containsMention(comment.body)) {
          const issueUrl = `https://github.com/${config.github.owner}/${config.github.repo}/issues/${issueNumber}`;
          const commentUrl = `${issueUrl}#issuecomment-${comment.id}`;
          mentions.push({
            type: 'issue_comment',
            id: comment.id,
            parentId: issueNumber,
            content: comment.body,
            user: comment.user.login,
            detectedAt: new Date(),
            processed: false,
            url: commentUrl,
            title: `Issue #${issueNumber} Comment`,
          });

          await this.tracker.recordMention(
            'issue_comment',
            comment.id,
            comment.user.login,
            comment.body,
            issueNumber
          );
        }
      }

      // Pull Requestをチェック
      const prs = await this.githubClient.getPullRequestsSince(sinceTime);
      for (const pr of prs) {
        const hasChanged = await this.tracker.isContentChanged('pr', pr.number, pr.body || '');
        if (hasChanged && this.containsMention(pr.body || '')) {
          const prUrl = `https://github.com/${config.github.owner}/${config.github.repo}/pull/${pr.number}`;
          mentions.push({
            type: 'pr',
            id: pr.number,
            content: pr.body || '',
            user: pr.user.login,
            detectedAt: new Date(),
            processed: false,
            url: prUrl,
            title: pr.title,
          });

          await this.tracker.recordMention('pr', pr.number, pr.user.login, pr.body || '');
        }
      }

      // PRコメントをチェック
      const prComments = await this.githubClient.getPullRequestCommentsSince(sinceTime);
      for (const comment of prComments) {
        // PRコメントの場合、issue_urlは既に正しいリソースを指している
        const prNumber = this.githubClient.extractIssueNumber(comment.issue_url);
        const hasChanged = await this.tracker.isContentChanged(
          'pr_comment',
          comment.id,
          comment.body,
          prNumber
        );
        if (hasChanged && this.containsMention(comment.body)) {
          const prUrl = `https://github.com/${config.github.owner}/${config.github.repo}/pull/${prNumber}`;
          const commentUrl = `${prUrl}#issuecomment-${comment.id}`;
          mentions.push({
            type: 'pr_comment',
            id: comment.id,
            parentId: prNumber,
            content: comment.body,
            user: comment.user.login,
            detectedAt: new Date(),
            processed: false,
            url: commentUrl,
            title: `Pull Request #${prNumber} Comment`,
          });

          await this.tracker.recordMention(
            'pr_comment',
            comment.id,
            comment.user.login,
            comment.body,
            prNumber
          );
        }
      }

      // 統計情報を更新
      await this.tracker.updateDailyStats(mentions.length, 1);

      logger.info('Mention detection completed', {
        since: sinceTime,
        totalMentions: mentions.length,
        issuesMentions: mentions.filter((m) => m.type === 'issue').length,
        prMentions: mentions.filter((m) => m.type === 'pr').length,
        commentMentions: mentions.filter((m) => m.type.includes('comment')).length,
      });

      return mentions;
    } catch (error) {
      logger.error('Error during mention detection', {
        error,
        since: sinceTime,
      });
      throw error;
    }
  }

  private containsMention(content: string): boolean {
    if (!content) return false;

    return config.mention.patterns.some((pattern) =>
      content.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}
