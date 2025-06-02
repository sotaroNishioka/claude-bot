# Claude Bot 🤖

GitHub リポジトリの Claude Code メンション検出と自動化システムの TypeScript 実装版。Raspberry Pi での動作と、ローカルプロジェクトでの Claude Code CLI 実行に最適化されています。

## 🎯 目的

Claude Bot は GitHub リポジトリの `@claude` または `@claude-code` メンションを監視し、ローカルプロジェクトディレクトリで Claude Code CLI コマンドを自動実行します。以下の用途に最適：

- **Raspberry Pi での自動化**: 最小限のリソースで常時監視
- **ローカル開発**: Claude Code がローカルプロジェクトファイルを直接操作
- **GitHub 連携**: GitHub Issues と Pull Requests とのシームレスな統合
- **トークン最適化**: スマートな変更検出で Claude API 使用量を最小化

## 🗂️ プロジェクト構造

```
/home/pi/Develop/
├── claude-bot/            # このリポジトリ - Claude Bot システム
│   ├── src/
│   ├── package.json
│   ├── .env               # 設定ファイル
│   ├── mention_tracker.db # SQLite データベース
│   ├── prompts/           # カスタムプロンプトテンプレート
│   └── logs/              # アプリケーションログ
└── target-project/        # 対象プロジェクト - Claude Code 実行ターゲット
    ├── src/
    ├── README.md
    ├── package.json
    └── .git/              # GitHub に接続
```

## ✨ 機能

### 基本機能
- **スマートメンション検出**: GitHub Issues と PR で設定可能なメンションパターンを自動検出
- **ローカルプロジェクト実行**: 指定したターゲットプロジェクトディレクトリで Claude Code CLI を実行
- **設定可能な CLI パス**: Nodenv、NVM、カスタム Claude CLI インストールをサポート
- **トークン最適化**: SHA256 ハッシュによる効率的な変更検出で Claude Code API 使用量を最小化
- **SQLite データベース**: 処理済みコンテンツとメンション履歴の信頼性の高い追跡、自動バックアップ付き

### 監視・ログ機能
- **包括的ログ機能**: Winston による詳細なログ記録で監視とデバッグをサポート
- **複数ログレベル**: 設定可能なログ機能（debug、info、warn、error）とファイルローテーション
- **統計情報追跡**: チェック、メンション、API 呼び出し、トークン使用量の日次統計
- **データベースバックアップ**: 7日間保持の自動日次バックアップ

### スケジューリング・自動化
- **Cron スケジューリング**: 検出とバックアップ操作の設定可能な間隔
- **優雅なエラー処理**: 堅牢なエラー処理と復旧メカニズム
- **自動応答制御**: メンションへの自動応答のオプション制御
- **プロセス管理**: 優雅なシャットダウン処理とデーモンモードサポート
- **同時実行制御**: Claude Code の同時実行数を制限してリソースを保護

### 開発機能
- **型安全性**: 厳密な型付けによる完全な TypeScript 実装
- **複数コマンド**: 様々な Claude Code コマンド（start、run-once、status、setup、test-config）
- **環境検出**: 開発環境と本番環境での個別動作
- **カスタムプロンプト**: 異なるメンションタイプ用のテンプレートベースプロンプトシステム

## 🚀 クイックスタート

### 1. インストール

```bash
# 開発ディレクトリを作成
mkdir -p /home/pi/Develop
cd /home/pi/Develop

# Claude Bot をクローン
git clone https://github.com/sotaroNishioka/claude-bot.git
cd claude-bot
npm install

# ターゲットプロジェクトを作成（または既存をクローン）
cd ../
mkdir target-project  # または: git clone your-project.git target-project
cd target-project
git init  # 新規プロジェクトの場合
```

### 2. 設定

```bash
cd /home/pi/Develop/claude-bot
cp .env.example .env
```

`.env` ファイルを設定で編集:

```env
# GitHub 設定（必須）
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=your_username  
GITHUB_REPO=your_repository_name

# Claude Code 設定（必須）
CLAUDE_CLI_PATH=/usr/local/bin/claude  # またはカスタムパス
DAILY_TOKEN_LIMIT=45000

# プロジェクトパス
TARGET_PROJECT_PATH=../target-project
CLAUDE_BOT_PATH=/home/pi/Develop/claude-bot

# メンション検出設定
MENTION_PATTERNS=@claude,@claude-code  # カンマ区切りパターン
ENABLE_AUTO_RESPONSE=true

# 処理設定
MAX_CONCURRENT_EXECUTIONS=1  # Claude Code同時実行数

# スケジューリング（Cron 式）
DETECTION_INTERVAL="*/5 * * * *"  # 5分毎
BACKUP_INTERVAL="0 2 * * *"       # 毎日午前2時

# ログ設定
LOG_LEVEL=info
LOG_FILE=./logs/claude-bot.log

# データベース
DATABASE_PATH=./mention_tracker.db

# 環境
ENVIRONMENT=production  # または development
DEBUG=false
```

### 3. Claude CLI パス設定

Node.js インストール方法に応じて:

```bash
# 標準インストール
CLAUDE_CLI_PATH=/usr/local/bin/claude

# Nodenv
CLAUDE_CLI_PATH=/home/pi/.nodenv/shims/claude

# NVM
CLAUDE_CLI_PATH=/home/pi/.nvm/versions/node/v18.19.0/bin/claude

# カスタムインストール
CLAUDE_CLI_PATH=/home/pi/.local/bin/claude
```

### 4. セットアップとテスト

```bash
npm run build
npm run setup
npm run dev -- test-config
```

### 5. 実行

```bash
# 開発モード
npm run dev -- start

# 本番モード  
npm run build && npm start

# 単発検出サイクル（テスト用）
npm run dev -- run-once

# デーモンモード
npm run daemon
```

## 📖 使用方法

### 利用可能な CLI コマンド

| コマンド | 説明 | 使用方法 |
|---------|-------------|-------|
| `start` | Claude Bot デーモンを開始 | `npm run dev -- start [--daemon]` |
| `run-once` | 単発検出サイクルを実行 | `npm run dev -- run-once` |
| `status` | 現在のステータスと統計情報を表示 | `npm run dev -- status` |
| `setup` | データベースをセットアップし接続をテスト | `npm run setup` |
| `test-config` | 設定と接続をテスト | `npm run dev -- test-config` |

### メンション検出

Claude Bot は以下でメンションを自動監視します:

- ✅ **Issue の説明** - Issue が作成または更新された時
- ✅ **Issue のコメント** - Issue のすべてのコメント
- ✅ **Pull Request の説明** - PR が作成または更新された時
- ✅ **Pull Request のコメント** - PR のすべてのコメントとレビューコメント

### メンションパターン

`MENTION_PATTERNS` でカスタムメンションパターンを設定:

```env
# デフォルトパターン
MENTION_PATTERNS=@claude,@claude-code

# カスタムパターン
MENTION_PATTERNS=@ai,@assistant,@bot

# 単一パターン
MENTION_PATTERNS=@claude
```

### プロンプトテンプレート

`prompts/` ディレクトリにカスタムプロンプトテンプレートを作成:

- `issue.txt` - Issue メンション用テンプレート
- `issue_comment.txt` - Issue コメントメンション用テンプレート
- `pr.txt` - Pull Request メンション用テンプレート
- `pr_comment.txt` - PR コメントメンション用テンプレート

テンプレート例（`prompts/issue.txt`）:
```
GitHub Issue に関してサポートします。以下のリクエストを分析して対応してください：

{{USER_REQUEST}}

ターゲットプロジェクトでこの Issue に対処するため適切な Claude Code コマンドを実行してください。
```

### メンション例

```
@claude JWT トークンと適切なエラーハンドリングでこの認証機能を実装してください

@claude-code この PR をレビューしてください、特にメモリ使用量と潜在的なセキュリティ脆弱性に注目して

@claude 現在のデータベーススキーマを分析してパフォーマンス改善を提案してください
```

**重要**: Claude Code は `target-project` ディレクトリで実行され、ローカルファイルに実際の変更を加えます。Claude CLI は事前に `claude auth login` で認証済みである必要があります。

## 🔧 設定

### 環境変数

| 変数 | 説明 | デフォルト | 必須 |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub パーソナルアクセストークン | - | ✅ |
| `GITHUB_OWNER` | リポジトリオーナーのユーザー名 | - | ✅ |
| `GITHUB_REPO` | リポジトリ名 | - | ✅ |
| `CLAUDE_CLI_PATH` | Claude CLI 実行ファイルのパス | `claude` | ❌ |
| `TARGET_PROJECT_PATH` | ターゲットプロジェクトディレクトリのパス | `../target-project` | ❌ |
| `CLAUDE_BOT_PATH` | Claude Bot ディレクトリのパス | `現在のディレクトリ` | ❌ |
| `DAILY_TOKEN_LIMIT` | 1日の最大 Claude トークン数 | `45000` | ❌ |
| `MENTION_PATTERNS` | カンマ区切りメンションパターン | `@claude,@claude-code` | ❌ |
| `ENABLE_AUTO_RESPONSE` | 自動応答を有効化 | `false` | ❌ |
| `MAX_CONCURRENT_EXECUTIONS` | Claude Code同時実行数（1-10） | `1` | ❌ |
| `DETECTION_INTERVAL` | メンション検出の Cron 式 | `*/5 * * * *` | ❌ |
| `BACKUP_INTERVAL` | データベースバックアップの Cron 式 | `0 2 * * *` | ❌ |
| `LOG_LEVEL` | ログレベル | `info` | ❌ |
| `LOG_FILE` | ログファイルパス | `./logs/claude-bot.log` | ❌ |
| `DATABASE_PATH` | SQLite データベースファイルパス | `./mention_tracker.db` | ❌ |
| `ENVIRONMENT` | 環境モード | `production` | ❌ |
| `DEBUG` | デバッグモードを有効化 | `false` | ❌ |
| `PROMPTS_DIR` | カスタムプロンプトディレクトリ | `./prompts` | ❌ |

### GitHub トークンの権限

GitHub パーソナルアクセストークンに必要な権限:
- `repo`（フルリポジトリアクセス） - Issues/PR の読み取りとコメント投稿用
- `read:org`（組織メンバーシップ読み取り） - 組織リポジトリ用

### Claude CLI 認証

Claude Code CLI は事前認証が必要です:

```bash
# Claude CLI のインストール
curl -fsSL https://claude.ai/cli/install.sh | sh

# Claude MAX サブスクリプションで認証
claude auth login

# 認証状態を確認
claude auth status
```

### Claude Code CLI 引数

Bot は以下の引数で Claude Code を実行:
- `--output-format stream-json` - 構造化出力フォーマット
- `--print` - stdout に出力
- `--dangerously-skip-permissions` - 権限プロンプトをスキップ
- `--verbose` - 詳細ログ

タイムアウト: 実行毎に5分

### 同時実行制御

Bot は Claude Code の同時実行数を制限してリソースを保護します：

- **設定**: `MAX_CONCURRENT_EXECUTIONS` 環境変数で制御（1-10の範囲）
- **デフォルト**: 1（安全な設定）
- **動作**: 上限に達した場合、新しいメンションはスキップされログに記録
- **監視**: ステータス確認で現在の実行数を表示

```env
# 同時実行例
MAX_CONCURRENT_EXECUTIONS=3  # 最大3つのClaude Codeを同時実行
```

**推奨設定:**
- **個人利用**: 1-2（安定性重視）
- **チーム利用**: 2-3（効率とリソースのバランス）
- **高負荷環境**: 3-5（十分なリソースがある場合）

## 📊 データベーススキーマ

### テーブル

**tracked_items** - コンテンツ変更追跡
- `id`（PRIMARY KEY）
- `item_type`（issue、pr、issue_comment、pr_comment）
- `item_id`（GitHub アイテム ID）
- `parent_id`（コメント用の Issue/PR 番号）
- `content_hash`（コンテンツの SHA256）
- `has_mention`（Boolean）
- `last_checked`、`created_at`、`updated_at`

**mention_history** - メンション処理ログ
- `id`（PRIMARY KEY）
- `item_type`、`item_id`、`parent_id`
- `user_login`（GitHub ユーザー名）
- `mention_content`（メンション付きの完全なコンテンツ）
- `detected_at`、`processed`、`processed_at`

**processing_stats** - 日次統計
- `date`（PRIMARY KEY）
- `total_checks`、`new_mentions`、`processed_mentions`
- `api_calls`、`tokens_used`

## 📳 デプロイオプション

### Raspberry Pi（推奨）

最小限のリソース使用量で常時監視に最適:

```bash
# Node.js をインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Claude CLI をインストール
curl -fsSL https://claude.ai/cli/install.sh | sh
claude auth login

# systemd サービスとしてセットアップ
sudo cp deployment/claude-bot.service /etc/systemd/system/
sudo systemctl enable claude-bot
sudo systemctl start claude-bot
```

### PM2（プロセスマネージャー）

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

PM2 設定には以下が含まれます:
- メモリ制限: 1GB で自動再起動
- ログファイル: `./logs/pm2-*.log`
- 本番環境変数

### 手動デーモンモード

```bash
npm run build
nohup npm start > /dev/null 2>&1 &
```

## 📊 監視

### ステータス確認

```bash
npm run dev -- status
```

出力例:
```json
{
  "isRunning": true,
  "isProcessingMentions": false,
  "runningExecutions": 2,
  "repository": {
    "name": "my-project",
    "fullName": "user/my-project",
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
  },
  "configuration": {
    "detectionInterval": "*/5 * * * *",
    "backupInterval": "0 2 * * *",
    "dailyTokenLimit": 45000,
    "mentionPatterns": ["@claude", "@claude-code"],
    "maxConcurrentExecutions": 3
  }
}
```

### ログ

```bash
# リアルタイムログを表示
tail -f ./logs/claude-bot.log

# エラーログのみを表示
tail -f ./logs/claude-bot-error.log

# 例外ログを表示
tail -f ./logs/claude-bot-exceptions.log

# PM2 ログを表示（PM2 使用時）
tail -f ./logs/pm2-combined.log

# 今日のメンション活動を表示
grep "mention detected" ./logs/claude-bot.log | grep $(date +%Y-%m-%d)
```

### ログローテーション

自動ログローテーションが設定済み:
- メインログ: 最大10MB、5ファイル保持
- エラーログ: 最大10MB、3ファイル保持
- 例外ログ: サイズ制限なし

## 🎯 トークン最適化

Claude Bot は効率的なトークン使用を設計:

### スマート処理
- **変更検出**: 実際に変更されたコンテンツのみを処理（SHA256 比較）
- **コンテンツハッシュ**: 同じコンテンツの重複処理を防止
- **同時実行制御**: 設定可能な同時実行数でリソース使用量を制限
- **順次処理**: レート制限を尊重するメンション間の2秒遅延
- **スキップロジック**: 実行中の処理が上限に達した場合、新しいメンションを安全にスキップ

### データベース効率性
- **差分チェック**: 最後のチェック時刻以降の GitHub データのみを取得
- **メンション追跡**: 処理ステータスを追跡して重複作業を回避
- **バックアップ管理**: 7日間クリーンアップ付きの自動日次バックアップ

### トークン使用量見積もり

| アクションタイプ | 推定トークン数 | 備考 |
|-------------|------------------|-------|
| 簡単なメンション | 1000-3000 | 基本的なリクエストと応答 |
| コード実装 | 3000-8000 | コード生成とファイル変更 |
| コードレビュー | 1500-3000 | 分析とフィードバック |
| アーキテクチャ分析 | 2000-4000 | 複雑な推論タスク |

## 🔍 トラブルシューティング

### 一般的な問題

1. **Claude CLI が見つからない**:
   ```bash
   # Claude CLI パスをテスト
   npm run dev -- test-config
   
   # Claude CLI がインストールされているか確認
   which claude
   
   # .env で CLAUDE_CLI_PATH を更新
   CLAUDE_CLI_PATH=/full/path/to/claude
   ```

2. **ターゲットプロジェクトが見つからない**:
   ```bash
   # ターゲットプロジェクトが存在することを確認
   ls -la $TARGET_PROJECT_PATH
   
   # 設定を確認
   npm run dev -- test-config
   ```

3. **権限の問題**:
   ```bash
   # ターゲットプロジェクトへの書き込み権限を確保
   chmod 755 ../target-project
   
   # ターゲットプロジェクトが git リポジトリかどうか確認
   cd ../target-project && git status
   ```

4. **データベースの問題**:
   ```bash
   # データベースをリセット
   rm mention_tracker.db
   npm run setup
   ```

5. **GitHub API レート制限**:
   - デフォルト: 認証済みリクエストで5000リクエスト/時
   - Bot は検出サイクル毎に1回の API 呼び出しを使用
   - 5分間隔では: 12回/時（制限内に十分収まる）

6. **Claude Code 同時実行の問題**:
   ```bash
   # 同時実行数を確認
   npm run dev -- status
   
   # 同時実行数を調整（.env で設定）
   MAX_CONCURRENT_EXECUTIONS=2
   
   # ログで実行状況を確認
   grep "Claude Code実行" ./logs/claude-bot.log
   ```

### デバッグモード

```bash
# デバッグログを有効化
DEBUG=true LOG_LEVEL=debug npm run dev -- start

# デバッグで単発サイクルをテスト
DEBUG=true LOG_LEVEL=debug npm run dev -- run-once
```

### エラー応答

Bot は GitHub コメントで詳細なエラーメッセージを提供:

```
❌ @username エラーメッセージがここに表示されます

**デバッグ情報:**
- ターゲットプロジェクト: `/path/to/target-project`
- Claude CLI: `/path/to/claude`
```

成功応答:

```
✅ @username Claude Code の実行が完了しました。

**ターゲットプロジェクト:** `/path/to/target-project`
```

## 🔒 セキュリティ考慮事項

- **API キー**: `.env` ファイルに保存し、git にコミットしない
- **ファイルシステム**: Claude Code はターゲットプロジェクトディレクトリへのフルアクセス権を持つ
- **GitHub 権限**: Bot はすべてのリポジトリコンテンツを読み取り、コメントを投稿可能
- **プロセス分離**: Claude CLI は継承された環境でターゲットプロジェクトディレクトリで実行

## 📚 ドキュメント

- [セットアップガイド](./docs/SETUP.md) - 詳細なインストールと設定
- [API リファレンス](./docs/API.md) - 完全な API ドキュメント
- [トラブルシューティング](./docs/TROUBLESHOOTING.md) - 一般的な問題と解決策

## 🤝 サポート

- 📖 [ドキュメント](./docs/)を確認
- 🐛 [GitHub Issues](https://github.com/sotaroNishioka/claude-bot/issues)で問題を報告
- 💬 [GitHub Discussions](https://github.com/sotaroNishioka/claude-bot/discussions)で質問

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下でライセンスされています - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🙏 謝辞

- [Claude Code](https://claude.ai/code) - AI 駆動の開発自動化
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API クライアント
- [Winston](https://github.com/winstonjs/winston) - ログライブラリ
- [node-cron](https://github.com/node-cron/node-cron) - タスクスケジューリング
- [SQLite](https://www.sqlite.org/) - 組み込みデータベース

---

**Raspberry Pi での効率的な Claude Code 自動化のために ❤️ で作成**