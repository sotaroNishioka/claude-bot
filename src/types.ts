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
  parentId?: number; // コメント用のIssue/PR番号
  content: string;
  user: string;
  detectedAt: Date;
  processed: boolean;
  url?: string; // GitHub URL for context
  title?: string; // Issue/PR title for context
  mentionHistoryId?: number; // 処理済みマーク用のメンション履歴ID
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
  itemTitle?: string;
  itemUrl?: string;
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
    cliPath: string;
  };
  project: {
    targetPath: string;
    claudeBotPath: string;
  };
  prompts: {
    dir: string;
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
    onlyOpenIssues: boolean; // openなIssues/PRのみを対象にするか
  };
  processing: {
    maxConcurrentExecutions: number;
  };
  system: {
    environment: 'development' | 'production';
    debug: boolean;
  };
}
