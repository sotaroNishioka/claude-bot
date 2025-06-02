import { Octokit } from '@octokit/rest';
import { config } from './config';
import { logger } from './logger';
import type { GitHubComment, GitHubIssue, GitHubPullRequest } from './types';

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
    });
    this.owner = config.github.owner;
    this.repo = config.github.repo;
  }

  async getIssuesSince(since: string): Promise<GitHubIssue[]> {
    try {
      const { data } = await this.octokit.rest.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        since,
        state: 'all',
        per_page: 100,
      });

      // Pull Requestをフィルタリング（GitHub APIはissuesにPRも含む）
      const issues = data.filter((issue) => !issue.pull_request) as GitHubIssue[];

      logger.debug('Fetched issues since', { since, count: issues.length });
      return issues;
    } catch (error) {
      logger.error('Error fetching issues', { error, since });
      throw error;
    }
  }

  async getPullRequestsSince(since: string): Promise<GitHubPullRequest[]> {
    try {
      const { data } = await this.octokit.rest.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state: 'all',
        per_page: 100,
      });

      // GitHub APIはPRに'since'をサポートしないため更新時刻でフィルタリング
      const pullRequests = data.filter((pr) => pr.updated_at > since) as GitHubPullRequest[];

      logger.debug('Fetched pull requests since', {
        since,
        count: pullRequests.length,
      });
      return pullRequests;
    } catch (error) {
      logger.error('Error fetching pull requests', { error, since });
      throw error;
    }
  }

  async getIssueCommentsSince(since: string): Promise<GitHubComment[]> {
    try {
      const { data } = await this.octokit.rest.issues.listCommentsForRepo({
        owner: this.owner,
        repo: this.repo,
        since,
        per_page: 100,
      });

      logger.debug('Fetched issue comments since', {
        since,
        count: data.length,
      });
      return data as GitHubComment[];
    } catch (error) {
      logger.error('Error fetching issue comments', { error, since });
      throw error;
    }
  }

  async getPullRequestCommentsSince(since: string): Promise<GitHubComment[]> {
    try {
      // レビューコメントを取得
      const { data: reviewComments } = await this.octokit.rest.pulls.listReviewCommentsForRepo({
        owner: this.owner,
        repo: this.repo,
        since,
        per_page: 100,
      });

      // 共通フォーマットに変換
      const comments: GitHubComment[] = reviewComments.map((comment) => ({
        id: comment.id,
        issue_url: comment.pull_request_url.replace('/pulls/', '/issues/'),
        body: comment.body,
        user: comment.user,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
      }));

      logger.debug('Fetched PR comments since', {
        since,
        count: comments.length,
      });
      return comments;
    } catch (error) {
      logger.error('Error fetching PR comments', { error, since });
      throw error;
    }
  }

  async addIssueComment(issueNumber: number, body: string): Promise<void> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body,
      });

      logger.info('Issue comment added', {
        issueNumber,
        bodyLength: body.length,
      });
    } catch (error) {
      logger.error('Error adding issue comment', { error, issueNumber });
      throw error;
    }
  }

  async addPullRequestComment(pullNumber: number, body: string): Promise<void> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: pullNumber,
        body,
      });

      logger.info('PR comment added', { pullNumber, bodyLength: body.length });
    } catch (error) {
      logger.error('Error adding PR comment', { error, pullNumber });
      throw error;
    }
  }

  extractIssueNumber(issueUrl: string): number {
    const match = issueUrl.match(/\/issues\/(\d+)$/);
    if (!match) {
      throw new Error(`Invalid issue URL: ${issueUrl}`);
    }
    return Number.parseInt(match[1], 10);
  }

  extractPullRequestNumber(prUrl: string): number {
    const match = prUrl.match(/\/pulls\/(\d+)$/);
    if (!match) {
      throw new Error(`Invalid PR URL: ${prUrl}`);
    }
    return Number.parseInt(match[1], 10);
  }

  async getRepositoryInfo() {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      return {
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        language: data.language,
        stars: data.stargazers_count,
        forks: data.forks_count,
      };
    } catch (error) {
      logger.error('Error fetching repository info', { error });
      throw error;
    }
  }
}
