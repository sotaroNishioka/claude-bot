# Claude Bot API Reference

## Core Classes

### ClaudeBotApp

Main application class that orchestrates all components.

```typescript
class ClaudeBotApp {
  async start(): Promise<void>
  async stop(): Promise<void>
  async runOnce(): Promise<void>
  async getStatus(): Promise<Status>
}
```

#### Methods

- `start()` - Start the bot as a daemon with cron jobs
- `stop()` - Gracefully stop the bot
- `runOnce()` - Run a single detection cycle
- `getStatus()` - Get current status and statistics

### MentionTracker

SQLite database operations for tracking mentions and changes.

```typescript
class MentionTracker {
  async init(): Promise<void>
  async isContentChanged(itemType: string, itemId: number, content: string): Promise<boolean>
  async recordMention(itemType: string, itemId: number, userLogin: string, content: string): Promise<void>
  async getTodayStats(): Promise<ProcessingStats | null>
}
```

#### Key Methods

- `isContentChanged()` - Check if content has changed using SHA256 hash
- `recordMention()` - Store new mention in database
- `getTodayStats()` - Get today's processing statistics
- `backup()` - Create database backup

### GitHubClient

GitHub API wrapper for fetching issues, PRs, and comments.

```typescript
class GitHubClient {
  async getIssuesSince(since: string): Promise<GitHubIssue[]>
  async getIssueCommentsSince(since: string): Promise<GitHubComment[]>
  async getPullRequestsSince(since: string): Promise<GitHubPullRequest[]>
  async addIssueComment(issueNumber: number, body: string): Promise<void>
}
```

### MentionDetector

Detects `@claude` mentions in GitHub content.

```typescript
class MentionDetector {
  async detectNewMentions(since: string): Promise<MentionEvent[]>
  parseCommand(mentionContent: string): { action: string; parameters: string }
}
```

### ClaudeProcessor

Executes Claude Code commands based on mentions.

```typescript
class ClaudeProcessor {
  async processMention(mention: MentionEvent): Promise<void>
  private async executeClaude(mention: MentionEvent, command: ClaudeCommand): Promise<void>
}
```

## Data Types

### MentionEvent

```typescript
interface MentionEvent {
  type: 'issue' | 'issue_comment' | 'pr' | 'pr_comment';
  id: number;
  parentId?: number; // Issue/PR number for comments
  content: string;
  user: string;
  detectedAt: Date;
  processed: boolean;
}
```

### ClaudeCommand

```typescript
interface ClaudeCommand {
  action: 'implement' | 'review' | 'analyze' | 'improve' | 'test' | 'help';
  target: 'issue' | 'pr';
  targetNumber: number;
  parameters: string;
  user: string;
}
```

### TrackedItem

```typescript
interface TrackedItem {
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
```

### ProcessingStats

```typescript
interface ProcessingStats {
  date: string;
  totalChecks: number;
  newMentions: number;
  processedMentions: number;
  apiCalls: number;
  tokensUsed: number;
}
```

## Database Schema

### tracked_items

```sql
CREATE TABLE tracked_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  parent_id INTEGER,
  content_hash TEXT NOT NULL,
  has_mention BOOLEAN NOT NULL,
  last_checked DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE(item_type, item_id)
);
```

### mention_history

```sql
CREATE TABLE mention_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  parent_id INTEGER,
  user_login TEXT NOT NULL,
  mention_content TEXT NOT NULL,
  detected_at DATETIME NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at DATETIME
);
```

### processing_stats

```sql
CREATE TABLE processing_stats (
  date TEXT PRIMARY KEY,
  total_checks INTEGER DEFAULT 0,
  new_mentions INTEGER DEFAULT 0,
  processed_mentions INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0
);
```

## Command Line Interface

### Commands

```bash
# Start daemon
npm run dev -- start [--daemon]

# Single run
npm run dev -- run-once

# Show status
npm run dev -- status

# Setup database
npm run dev -- setup

# Test configuration
npm run dev -- test-config
```

### Configuration

Environment variables are loaded from `.env` file:

```typescript
interface Config {
  github: {
    token: string;
    owner: string;
    repo: string;
  };
  claude: {
    apiKey: string;
    dailyTokenLimit: number;
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
}
```

## Error Handling

### Error Types

- **GitHub API Errors**: Rate limiting, authentication
- **Database Errors**: Connection, SQL errors
- **Claude Code Errors**: Execution failures, timeouts
- **Configuration Errors**: Missing required settings

### Graceful Degradation

- If Claude Code is unavailable, mentions are still tracked
- Individual mention processing failures don't stop the service
- Database connection issues are logged and retried
- GitHub API rate limits are respected with backoff

## Performance Considerations

### Token Optimization

- Content hash comparison prevents unnecessary Claude Code calls
- Daily token limit enforcement
- Sequential processing to avoid rate limits

### Database Optimization

- Indexes on frequently queried columns
- Automatic cleanup of old data
- Regular backup rotation

### Memory Management

- Streaming for large API responses
- Connection pooling for database
- Graceful shutdown procedures
