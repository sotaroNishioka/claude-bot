# Claude Bot API リファレンス 📚

Claude Bot の内部アーキテクチャ、API、クラス構造、設定オプションの完全なリファレンスドキュメントです。

## 📋 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [コアクラス](#コアクラス)
3. [設定とタイプ](#設定とタイプ)
4. [データベーススキーマ](#データベーススキーマ)
5. [CLI コマンド](#cli-コマンド)
6. [環境変数](#環境変数)
7. [ロギングシステム](#ロギングシステム)
8. [プロンプトシステム](#プロンプトシステム)
9. [イベントとフロー](#イベントとフロー)
10. [拡張ガイド](#拡張ガイド)

## 🏗️ アーキテクチャ概要

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Bot システム                      │
├─────────────────────────────────────────────────────────────┤
│  CLI Layer (main.ts)                                       │
│  ├── CommandHandler                                        │
│  └── ArgumentParser                                        │
├─────────────────────────────────────────────────────────────┤
│  Application Layer (app.ts)                                │
│  ├── MentionDetectionCycle                                 │
│  ├── ProcessingStatusManager                               │
│  └── SchedulingManager                                     │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                      │
│  ├── ClaudeProcessor (claude-processor.ts)                 │
│  ├── MentionDetector (mention-detector.ts)                 │
│  └── PromptManager (prompt-manager.ts)                     │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                      │
│  ├── GitHubClient (github-client.ts)                       │
│  ├── Database (database.ts)                                │
│  └── Logger (logger.ts)                                    │
└─────────────────────────────────────────────────────────────┘

外部依存関係:
├── GitHub API (api.github.com)
├── Claude Code CLI (local binary)
├── SQLite Database (mention_tracker.db)
└── Target Project (../target-project)
```

### データフロー

```
1. スケジューラーがメンション検出サイクルを開始
2. GitHub API から Issues/PRs/Comments を取得
3. コンテンツ変更をSHA256ハッシュで検出
4. メンションパターンをチェック
5. 新しいメンションを発見した場合:
   ├── データベースに記録
   ├── プロンプトテンプレートを適用
   ├── Claude Code CLI を実行
   ├── 結果をGitHubにコメント
   └── 統計を更新
```

## 🧩 コアクラス

### App クラス (`src/app.ts`)

メインアプリケーションロジックを管理するクラス。

#### コンストラクタ

```typescript
constructor()
```

設定ファイルを読み込み、データベース接続、GitHub クライアント、各種マネージャーを初期化。

#### 主要メソッド

##### `start(isDaemon: boolean = false): Promise<void>`

アプリケーションを開始。

**パラメータ:**
- `isDaemon`: デーモンモードで実行するかどうか

**動作:**
1. 設定検証
2. データベース接続確認
3. GitHub API 接続テスト
4. Claude CLI 認証確認
5. スケジューラー開始

**例:**
```typescript
const app = new App();
await app.start(true); // デーモンモードで開始
```

##### `runOnce(): Promise<void>`

単一の検出サイクルを実行。

**用途:**
- デバッグ
- 手動テスト
- CI/CD パイプライン

##### `getStatus(): Promise<AppStatus>`

現在のアプリケーション状態を取得。

**戻り値:**
```typescript
interface AppStatus {
  isRunning: boolean;
  isProcessingMentions: boolean;
  runningExecutions: number;
  repository: RepositoryInfo;
  todayStats: ProcessingStats;
  configuration: ConfigurationInfo;
}
```

##### `detectMentions(): Promise<void>`

メンション検出のメインロジック。

**処理フロー:**
1. 同時実行チェック
2. GitHub データ取得
3. コンテンツ変更検出
4. メンション処理
5. 統計更新

### ClaudeProcessor クラス (`src/claude-processor.ts`)

Claude Code CLI の実行とプロンプト処理を管理。

#### 静的プロパティ

```typescript
private static runningExecutions: number = 0;
```

現在実行中の Claude Code プロセス数を追跡。

#### 主要メソッド

##### `processUserRequest(mentionData: MentionData): Promise<void>`

ユーザーのメンション要求を処理。

**パラメータ:**
```typescript
interface MentionData {
  type: 'issue' | 'issue_comment' | 'pr' | 'pr_comment';
  id: number;
  parentId?: number;
  userLogin: string;
  content: string;
  url: string;
}
```

**処理ステップ:**
1. 同時実行数チェック
2. プロンプトテンプレート選択
3. Claude Code CLI 実行
4. 結果処理
5. GitHub コメント投稿

##### `executeClaudeCode(prompt: string): Promise<ClaudeCodeResult>`

Claude Code CLI を実行。

**パラメータ:**
- `prompt`: Claude Code に送信するプロンプト

**戻り値:**
```typescript
interface ClaudeCodeResult {
  success: boolean;
  output?: string;
  error?: string;
  tokensUsed?: number;
  executionTime: number;
}
```

**実行オプション:**
- `--output-format stream-json`: 構造化出力
- `--print`: stdout に出力
- `--dangerously-skip-permissions`: 権限プロンプトスキップ
- `--verbose`: 詳細ログ

### GitHubClient クラス (`src/github-client.ts`)

GitHub API との通信を管理。

#### コンストラクタ

```typescript
constructor(config: GitHubConfig)
```

**パラメータ:**
```typescript
interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}
```

#### 主要メソッド

##### `getIssues(since?: Date): Promise<Issue[]>`

指定日時以降の Issues を取得。

##### `getIssueComments(issueNumber: number, since?: Date): Promise<Comment[]>`

Issue のコメントを取得。

##### `getPullRequests(since?: Date): Promise<PullRequest[]>`

Pull Requests を取得。

##### `getPullRequestComments(prNumber: number, since?: Date): Promise<Comment[]>`

PR のコメントを取得。

##### `createComment(type: string, number: number, body: string): Promise<void>`

GitHub にコメントを投稿。

**パラメータ:**
- `type`: 'issue' または 'pr'
- `number`: Issue/PR 番号
- `body`: コメント本文

##### `getRepositoryInfo(): Promise<RepositoryInfo>`

リポジトリ情報を取得。

**戻り値:**
```typescript
interface RepositoryInfo {
  name: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  createdAt: string;
  updatedAt: string;
}
```

### Database クラス (`src/database.ts`)

SQLite データベースとの通信を管理。

#### 主要メソッド

##### `initialize(): Promise<void>`

データベーステーブルを初期化。

##### `trackItem(item: TrackedItem): Promise<void>`

追跡アイテムを記録。

```typescript
interface TrackedItem {
  itemType: 'issue' | 'pr' | 'issue_comment' | 'pr_comment';
  itemId: number;
  parentId?: number;
  contentHash: string;
  hasMention: boolean;
}
```

##### `recordMention(mention: MentionHistory): Promise<void>`

メンション履歴を記録。

##### `updateProcessingStats(stats: ProcessingStatsUpdate): Promise<void>`

処理統計を更新。

##### `getTodayStats(): Promise<ProcessingStats>`

今日の統計を取得。

##### `getItemContentHash(itemType: string, itemId: number): Promise<string | null>`

アイテムのコンテンツハッシュを取得。

##### `containsMention(content: string): boolean`

コンテンツにメンションが含まれているかチェック。

### MentionDetector クラス (`src/mention-detector.ts`)

メンションパターンの検出を管理。

#### 主要メソッド

##### `detectMentions(content: string): boolean`

コンテンツ内のメンションを検出。

##### `extractMentionContent(content: string): string`

メンション部分のコンテンツを抽出。

##### `getMentionPatterns(): string[]`

設定されたメンションパターンを取得。

### PromptManager クラス (`src/prompt-manager.ts`)

プロンプトテンプレートの管理。

#### 主要メソッド

##### `getPromptTemplate(type: MentionType): Promise<string>`

メンションタイプに応じたプロンプトテンプレートを取得。

**パラメータ:**
```typescript
type MentionType = 'issue' | 'issue_comment' | 'pr' | 'pr_comment';
```

##### `interpolateTemplate(template: string, variables: Record<string, string>): string`

テンプレート変数を置換。

**例:**
```typescript
const template = "GitHub Issue の実装をサポートします。\n\n## 要求内容\n{{USER_REQUEST}}";
const variables = { USER_REQUEST: "@claude JWT認証を実装してください" };
const result = promptManager.interpolateTemplate(template, variables);
```

## ⚙️ 設定とタイプ

### Config インターフェース (`src/types.ts`)

```typescript
interface Config {
  github: {
    token: string;
    owner: string;
    repo: string;
  };
  claude: {
    cliPath: string;
  };
  paths: {
    targetProject: string;
    claudeBot: string;
  };
  detection: {
    mentionPatterns: string[];
    enableAutoResponse: boolean;
  };
  processing: {
    maxConcurrentExecutions: number;
  };
  scheduling: {
    detectionInterval: string;
    backupInterval: string;
  };
  logging: {
    level: string;
    file: string;
  };
  database: {
    path: string;
  };
  environment: {
    mode: 'development' | 'production';
    debug: boolean;
  };
  prompts: {
    directory: string;
  };
}
```

### 設定読み込み (`src/config.ts`)

#### `loadConfig(): Config`

環境変数から設定を読み込み、バリデーションを実行。

**バリデーション項目:**
- 必須環境変数の存在確認
- Cron 式の妥当性
- ファイルパスの存在確認
- 数値範囲の確認

## 🗄️ データベーススキーマ

### テーブル構造

#### tracked_items

追跡対象アイテムの変更履歴。

```sql
CREATE TABLE tracked_items (
    id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    parent_id INTEGER,
    content_hash TEXT NOT NULL,
    has_mention BOOLEAN NOT NULL,
    last_checked DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_tracked_items_type_id ON tracked_items(item_type, item_id);
CREATE INDEX idx_tracked_items_last_checked ON tracked_items(last_checked);
CREATE INDEX idx_tracked_items_has_mention ON tracked_items(has_mention);
```

#### mention_history

メンション処理履歴。

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
    processed_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_mention_history_detected_at ON mention_history(detected_at);
CREATE INDEX idx_mention_history_processed ON mention_history(processed);
CREATE INDEX idx_mention_history_user_login ON mention_history(user_login);
```

#### processing_stats

日次処理統計。

```sql
CREATE TABLE processing_stats (
    date TEXT PRIMARY KEY,
    total_checks INTEGER DEFAULT 0,
    new_mentions INTEGER DEFAULT 0,
    processed_mentions INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_processing_stats_date ON processing_stats(date);
```

### データベース操作例

#### 基本的なクエリ

```sql
-- 今日の統計
SELECT * FROM processing_stats WHERE date = date('now');

-- 最近のメンション（10件）
SELECT * FROM mention_history ORDER BY detected_at DESC LIMIT 10;

-- 未処理のメンション
SELECT * FROM mention_history WHERE processed = FALSE;

-- ユーザー別メンション数
SELECT user_login, COUNT(*) as mention_count 
FROM mention_history 
GROUP BY user_login 
ORDER BY mention_count DESC;
```

#### メンテナンスクエリ

```sql
-- 古いデータのクリーンアップ（90日以上前）
DELETE FROM mention_history 
WHERE processed = TRUE AND detected_at < datetime('now', '-90 days');

-- データベース最適化
VACUUM;
REINDEX;

-- 統計情報
SELECT 
    'tracked_items' as table_name, 
    COUNT(*) as row_count 
FROM tracked_items
UNION ALL
SELECT 'mention_history', COUNT(*) FROM mention_history
UNION ALL
SELECT 'processing_stats', COUNT(*) FROM processing_stats;
```

## 🖥️ CLI コマンド

### コマンド構造

```bash
npm run start -- [command] [options]
```

### 利用可能なコマンド

#### `start [--daemon]`

Claude Bot を開始。

**オプション:**
- `--daemon`: デーモンモードで実行

**例:**
```bash
npm run start -- start
npm run start -- start --daemon
```

#### `run-once`

単発の検出サイクルを実行。

**用途:**
- デバッグ時のテスト
- 手動での確認

**例:**
```bash
npm run start -- run-once
```

#### `status`

現在のステータスと統計情報を表示。

**出力例:**
```json
{
  "isRunning": true,
  "isProcessingMentions": false,
  "runningExecutions": 0,
  "repository": {
    "name": "claude-bot",
    "fullName": "user/claude-bot",
    "language": "TypeScript",
    "stars": 42,
    "forks": 8
  },
  "todayStats": {
    "date": "2024-01-15",
    "totalChecks": 288,
    "newMentions": 5,
    "processedMentions": 5,
    "apiCalls": 12,
    "tokensUsed": 12500
  }
}
```

#### `setup`

データベースを初期化し、接続をテスト。

**処理内容:**
1. SQLite データベースファイル作成
2. テーブル作成
3. インデックス作成
4. 初期データ挿入

#### `test-config`

設定の妥当性をテスト。

**チェック項目:**
- GitHub API 接続
- Claude CLI 認証
- ターゲットプロジェクトアクセス
- データベース接続
- 環境変数設定

## 🔧 環境変数

### 必須環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxx` |
| `GITHUB_OWNER` | リポジトリ所有者 | `username` |
| `GITHUB_REPO` | リポジトリ名 | `my-project` |
| `CLAUDE_CLI_PATH` | Claude CLI パス | `/usr/local/bin/claude` |

### オプション環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|--------------|------|
| `TARGET_PROJECT_PATH` | `../target-project` | ターゲットプロジェクトパス |
| `CLAUDE_BOT_PATH` | `process.cwd()` | Claude Bot ディレクトリ |
| `MENTION_PATTERNS` | `@claude,@claude-code` | メンションパターン |
| `ENABLE_AUTO_RESPONSE` | `false` | 自動応答の有効化 |
| `MAX_CONCURRENT_EXECUTIONS` | `1` | 最大同時実行数 |
| `DETECTION_INTERVAL` | `*/5 * * * *` | 検出間隔（Cron式） |
| `BACKUP_INTERVAL` | `0 2 * * *` | バックアップ間隔 |
| `LOG_LEVEL` | `info` | ログレベル |
| `LOG_FILE` | `./logs/claude-bot.log` | ログファイルパス |
| `DATABASE_PATH` | `./mention_tracker.db` | データベースパス |
| `ENVIRONMENT` | `production` | 実行環境 |
| `DEBUG` | `false` | デバッグモード |
| `PROMPTS_DIR` | `./prompts` | プロンプトディレクトリ |

### 環境変数の検証

```typescript
// src/config.ts で実装される検証ロジック

function validateConfig(config: Config): void {
  // 必須フィールドの確認
  if (!config.github.token) {
    throw new Error('GITHUB_TOKEN is required');
  }
  
  // Cron 式の検証
  if (!cron.validate(config.scheduling.detectionInterval)) {
    throw new Error('Invalid DETECTION_INTERVAL cron expression');
  }
  
  // 数値範囲の確認
  if (config.processing.maxConcurrentExecutions < 1 || 
      config.processing.maxConcurrentExecutions > 10) {
    throw new Error('MAX_CONCURRENT_EXECUTIONS must be between 1 and 10');
  }
  
  // ファイルパスの存在確認
  if (!fs.existsSync(config.claude.cliPath)) {
    throw new Error(`Claude CLI not found at: ${config.claude.cliPath}`);
  }
}
```

## 📝 ロギングシステム

### ログレベル

| レベル | 説明 | 使用例 |
|--------|------|--------|
| `error` | エラーメッセージ | 致命的なエラー、例外 |
| `warn` | 警告メッセージ | 非致命的な問題、制限到達 |
| `info` | 情報メッセージ | 正常な操作、開始/終了 |
| `debug` | デバッグ情報 | 詳細な実行フロー |
| `silly` | 極詳細情報 | 変数値、APIレスポンス |

### ログファイル構成

```
logs/
├── claude-bot.log              # メインログ
├── claude-bot-error.log        # エラーログ
├── claude-bot-exceptions.log   # 例外ログ
└── claude-bot.log.1           # ローテーション済み
```

### ログ設定 (`src/logger.ts`)

```typescript
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
  ),
  transports: [
    // メインログファイル
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // エラーログファイル
    new winston.transports.File({
      filename: config.logging.file.replace('.log', '-error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 3
    }),
    
    // 例外ログファイル
    new winston.transports.File({
      filename: config.logging.file.replace('.log', '-exceptions.log'),
      handleExceptions: true,
      handleRejections: true
    })
  ]
});
```

### ログ使用例

```typescript
import logger from './logger';

// 基本的な使用
logger.info('アプリケーションを開始しました');
logger.warn('トークン制限に近づいています', { tokensUsed: 40000 });
logger.error('GitHub API エラー', { error: error.message });

// 構造化ログ
logger.info('メンション検出', {
  type: 'issue',
  id: 123,
  user: 'username',
  pattern: '@claude'
});

// デバッグログ
logger.debug('Claude Code 実行開始', {
  prompt: prompt.substring(0, 100),
  timeout: 300000
});
```

## 🎯 プロンプトシステム

### プロンプトファイル構造

```
prompts/
├── issue.txt          # Issue本文でのメンション
├── issue_comment.txt  # Issueコメントでのメンション
├── pr.txt            # PR本文でのメンション
└── pr_comment.txt    # PRコメントでのメンション
```

### テンプレート変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `{{USER_REQUEST}}` | ユーザーのメンション内容 | `@claude JWT認証を実装してください` |
| `{{ISSUE_NUMBER}}` | Issue番号（Issue系のみ） | `123` |
| `{{PR_NUMBER}}` | PR番号（PR系のみ） | `456` |
| `{{USER_LOGIN}}` | メンションしたユーザー | `username` |
| `{{REPOSITORY}}` | リポジトリ名 | `user/project` |

### プロンプト例

#### issue.txt

```
GitHub Issue の実装をサポートします。

## 要求内容
{{USER_REQUEST}}

## 実行指針
- プロジェクトのCLAUDE.mdルールを把握
- Issue の詳細を理解し、適切な実装を行ってください
- 新機能の場合は、設計から実装まで包括的に対応
- バグ修正の場合は、根本原因を特定して修正
- テストの追加も検討してください
- 着手時と完了時は Issue にコメントで報告
- GitHub MCPサーバー優先使用

## コメントテンプレート
**着手時**
```
🤖 **ClaudeCode**
**タイムスタンプ**: [YYYY-MM-DD HH:mm:ss UTC]
**作業予定**: 
{ここに作業計画を記述}
```
**完了時**
```
🤖 **ClaudeCode**
**タイムスタンプ**: [YYYY-MM-DD HH:mm:ss UTC]
**作業内容**: 
{ここに作業内容を記述}
```
```

### プロンプト管理API

```typescript
class PromptManager {
  async getPromptTemplate(type: MentionType): Promise<string> {
    const filename = `${type}.txt`;
    const filepath = path.join(config.prompts.directory, filename);
    
    try {
      return await fs.readFile(filepath, 'utf-8');
    } catch (error) {
      logger.warn(`プロンプトファイルが見つかりません: ${filename}`);
      return this.getDefaultPrompt(type);
    }
  }
  
  interpolateTemplate(
    template: string, 
    variables: Record<string, string>
  ): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return result;
  }
  
  private getDefaultPrompt(type: MentionType): string {
    const defaultPrompts = {
      issue: 'GitHub Issue の要求: {{USER_REQUEST}}',
      issue_comment: 'Issue コメントの要求: {{USER_REQUEST}}',
      pr: 'Pull Request の要求: {{USER_REQUEST}}',
      pr_comment: 'PR コメントの要求: {{USER_REQUEST}}'
    };
    
    return defaultPrompts[type];
  }
}
```

## 🔄 イベントとフロー

### メンション検出フロー

```typescript
async function detectMentions(): Promise<void> {
  try {
    // 1. 同時実行チェック
    if (this.isProcessingMentions) {
      logger.info('Claude処理が既に実行中のため、このサイクルをスキップします');
      return;
    }
    
    this.isProcessingMentions = true;
    logger.info('メンション検出サイクルを開始');
    
    // 2. GitHub データ取得
    const [issues, pullRequests] = await Promise.all([
      this.githubClient.getIssues(this.lastCheck),
      this.githubClient.getPullRequests(this.lastCheck)
    ]);
    
    // 3. 各アイテムの処理
    const allItems = [
      ...issues.map(issue => ({ type: 'issue', item: issue })),
      ...pullRequests.map(pr => ({ type: 'pr', item: pr }))
    ];
    
    for (const { type, item } of allItems) {
      await this.processItem(type, item);
      
      // コメントも処理
      const comments = await this.getComments(type, item.number);
      for (const comment of comments) {
        await this.processComment(type, item.number, comment);
      }
    }
    
    // 4. 統計更新
    await this.updateStats();
    
    logger.info('メンション検出サイクル完了');
    
  } catch (error) {
    logger.error('メンション検出エラー', { error: error.message });
  } finally {
    this.isProcessingMentions = false;
    this.lastCheck = new Date();
  }
}
```

### Claude Code 実行フロー

```typescript
async function executeClaudeCode(prompt: string): Promise<ClaudeCodeResult> {
  const startTime = Date.now();
  
  try {
    // 1. 同時実行数チェック
    if (ClaudeProcessor.runningExecutions >= config.processing.maxConcurrentExecutions) {
      throw new Error('Claude Code同時実行数上限に達しています');
    }
    
    ClaudeProcessor.runningExecutions++;
    
    // 2. ワーキングディレクトリ変更
    const originalCwd = process.cwd();
    process.chdir(config.paths.targetProject);
    
    // 3. Claude Code CLI 実行
    const args = [
      '--output-format', 'stream-json',
      '--print',
      '--dangerously-skip-permissions',
      '--verbose',
      prompt
    ];
    
    const result = await this.spawnProcess(config.claude.cliPath, args);
    
    // 4. 結果解析
    const tokensUsed = this.extractTokenUsage(result.output);
    
    return {
      success: true,
      output: result.output,
      tokensUsed,
      executionTime: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    };
  } finally {
    // 5. クリーンアップ
    ClaudeProcessor.runningExecutions--;
    process.chdir(originalCwd);
  }
}
```

### エラーハンドリングフロー

```typescript
class ErrorHandler {
  static async handleError(error: Error, context: string): Promise<void> {
    logger.error(`${context}でエラーが発生`, {
      error: error.message,
      stack: error.stack
    });
    
    // エラーの種類に応じた処理
    if (error.message.includes('rate limit')) {
      await this.handleRateLimit();
    } else if (error.message.includes('authentication')) {
      await this.handleAuthError();
    } else if (error.message.includes('SQLITE')) {
      await this.handleDatabaseError(error);
    }
  }
  
  static async handleRateLimit(): Promise<void> {
    logger.warn('GitHub API レート制限に達しました');
    // 次回チェック時間を遅延
    // 通知送信など
  }
  
  static async handleAuthError(): Promise<void> {
    logger.error('認証エラーが発生しました');
    // Claude CLI 再認証の提案
    // GitHub トークン確認の提案
  }
}
```

## 🛠️ 拡張ガイド

### 新しいメンションタイプの追加

1. **型定義の拡張**

```typescript
// src/types.ts
type MentionType = 'issue' | 'issue_comment' | 'pr' | 'pr_comment' | 'discussion';
```

2. **プロンプトファイルの追加**

```bash
# prompts/discussion.txt を作成
```

3. **処理ロジックの拡張**

```typescript
// src/mention-detector.ts
async function getDiscussions(since?: Date): Promise<Discussion[]> {
  // GitHub Discussions API の実装
}
```

### カスタムプロンプト変数の追加

```typescript
// src/prompt-manager.ts
interpolateTemplate(template: string, mentionData: MentionData): string {
  const variables = {
    USER_REQUEST: mentionData.content,
    USER_LOGIN: mentionData.userLogin,
    REPOSITORY: `${config.github.owner}/${config.github.repo}`,
    TIMESTAMP: new Date().toISOString(),
    // 新しい変数を追加
    ISSUE_TITLE: mentionData.title,
    ISSUE_LABELS: mentionData.labels?.join(', '),
    BRANCH_NAME: mentionData.branchName
  };
  
  return this.interpolateTemplate(template, variables);
}
```

### 新しいCLIコマンドの追加

```typescript
// src/main.ts
async function handleCommand(command: string, options: any): Promise<void> {
  switch (command) {
    case 'start':
      await app.start(options.daemon);
      break;
    case 'status':
      const status = await app.getStatus();
      console.log(JSON.stringify(status, null, 2));
      break;
    // 新しいコマンドを追加
    case 'export-stats':
      await exportStatistics(options.format, options.output);
      break;
    case 'cleanup':
      await cleanupOldData(options.days);
      break;
  }
}
```

### Webhook サポートの追加

```typescript
// src/webhook-server.ts
import express from 'express';
import crypto from 'crypto';

class WebhookServer {
  private app = express();
  
  constructor(private secret: string) {
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    this.app.post('/webhook', async (req, res) => {
      // GitHub Webhook の検証
      const signature = req.headers['x-hub-signature-256'];
      const payload = JSON.stringify(req.body);
      
      if (!this.verifySignature(payload, signature)) {
        return res.status(401).send('Unauthorized');
      }
      
      // イベント処理
      await this.handleWebhookEvent(req.body);
      res.status(200).send('OK');
    });
  }
  
  private async handleWebhookEvent(event: any): Promise<void> {
    const eventType = event.action;
    
    switch (eventType) {
      case 'opened':
      case 'edited':
        await this.processIssueOrPR(event);
        break;
      case 'created':
        await this.processComment(event);
        break;
    }
  }
}
```

### メトリクス収集の拡張

```typescript
// src/metrics.ts
class MetricsCollector {
  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const process = require('process');
    
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      
      // カスタムメトリクス
      activeConnections: this.getActiveConnections(),
      queueLength: this.getQueueLength(),
      cacheHitRate: this.getCacheHitRate()
    };
  }
  
  async exportToPrometheus(): Promise<string> {
    const metrics = await this.collectPerformanceMetrics();
    
    return `
# HELP claude_bot_memory_usage Memory usage in bytes
# TYPE claude_bot_memory_usage gauge
claude_bot_memory_usage{type="rss"} ${metrics.memoryUsage.rss}
claude_bot_memory_usage{type="heapUsed"} ${metrics.memoryUsage.heapUsed}

# HELP claude_bot_active_connections Active connections count
# TYPE claude_bot_active_connections gauge
claude_bot_active_connections ${metrics.activeConnections}
`;
  }
}
```

このAPIリファレンスにより、Claude Bot の内部構造を理解し、カスタマイズや拡張を行うことができます。