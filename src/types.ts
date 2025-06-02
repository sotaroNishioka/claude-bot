export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  user: {
    login: string;
  };
  updated_at: string;
  created_at: string;
  state: 'open' | 'closed';
  labels: Array<{
    name: string;
  }>;
  assignees: Array<{
    login: string;
  }>;
}

export interface GitHubComment {
  id: number;
  issue_url: string;
  body: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  user: {
    login: string;
  };
  updated_at: string;
  created_at: string;
  state: 'open' | 'closed';
  draft: boolean;
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
}

export interface MentionEvent {
  type: 'issue' | 'issue_comment' | 'pr' | 'pr_comment';
  id: number;
  parentId?: number; // Issue/PR number for comments
  content: string;
  user: string;
  detectedAt: Date;
  processed: boolean;
}

export interface TrackedItem {
  id?: number;
  itemType: 'issue' | 'pr' | 'issue_comment' | 'pr_comment';
  itemId: number;
  parentId?: number;
  contentHash: string;
  hasMention: boolean;
  lastChecked: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MentionHistory {
  id?: number;
  itemType: 'issue' | 'pr' | 'issue_comment' | 'pr_comment';
  itemId: number;
  parentId?: number;
  userLogin: string;
  mentionContent: string;
  detectedAt: Date;
  processed: boolean;
  processedAt?: Date;
}

export interface ProcessingStats {
  date: string;
  totalChecks: number;
  newMentions: number;
  processedMentions: number;
  apiCalls: number;
  tokensUsed: number;
}

export interface Config {
  github: {
    token: string;
    owner: string;
    repo: string;
  };
  claude: {
    apiKey: string;
    cliPath: string;
    dailyTokenLimit: number;
  };
  project: {
    targetPath: string;
    claudeBotPath: string;
  };
  database: {
    path: string;
  };
  logging: {
    level: string;
    file: string;
  };
  cron: {
    detectionInterval: string;
    backupInterval: string;
  };
  mention: {
    patterns: string[];
    enableAutoResponse: boolean;
  };
  system: {
    environment: 'development' | 'production';
    debug: boolean;
  };
}

export interface ClaudeCommand {
  action: 'implement' | 'review' | 'analyze' | 'improve' | 'test' | 'help';
  target: 'issue' | 'pr';
  targetNumber: number;
  parameters: string;
  user: string;
}