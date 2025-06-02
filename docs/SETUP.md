# Claude Bot 詳細セットアップガイド 🚀

Claude Bot は GitHub リポジトリの Claude メンション監視と Claude Code CLI 自動実行システムです。この詳細ガイドでは、初回セットアップから本番運用まで段階的に説明します。

## 📋 目次

1. [前提条件と準備](#前提条件と準備)
2. [基本インストール](#基本インストール)
3. [高度な設定](#高度な設定)
4. [本番デプロイ](#本番デプロイ)
5. [監視とメンテナンス](#監視とメンテナンス)
6. [パフォーマンス最適化](#パフォーマンス最適化)

## 🔧 前提条件と準備

### システム要件

| 項目 | 最小要件 | 推奨 |
|------|---------|------|
| **OS** | Linux、macOS、Windows | Ubuntu 20.04+ / Raspberry Pi OS |
| **Node.js** | 18.0+ | 20.11+ (LTS) |
| **メモリ** | 512MB | 1GB+ |
| **ストレージ** | 100MB | 1GB+ |
| **ネットワーク** | インターネット接続 | 常時接続（固定IP推奨） |

### 必要なアカウントとツール

1. **GitHub アカウント**
   - 監視対象リポジトリへのアクセス権
   - Personal Access Token の作成権限

2. **Claude MAX サブスクリプション**
   - Claude Code CLI へのアクセス
   - 月額20ドルのサブスクリプション

3. **開発環境**
   - Git クライアント
   - テキストエディタ（VS Code推奨）
   - ターミナル/コマンドプロンプト

## 📦 基本インストール

### Step 1: 開発環境のセットアップ

#### Raspberry Pi での環境構築

```bash
# システムアップデート
sudo apt update && sudo apt upgrade -y

# 必要なパッケージをインストール
sudo apt install -y git curl build-essential sqlite3

# Node.js LTS をインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# インストール確認
node --version  # v20.11.0 以上
npm --version   # 10.2.0 以上
```

#### macOS での環境構築

```bash
# Homebrew がインストールされていない場合
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js をインストール
brew install node@20
brew install sqlite

# パスを追加（.zshrc または .bash_profile に）
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Ubuntu/Debian での環境構築

```bash
# Node.js リポジトリを追加
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# パッケージをインストール
sudo apt-get install -y nodejs git sqlite3 build-essential

# npm をグローバルアップデート
sudo npm install -g npm@latest
```

### Step 2: Claude Code CLI のインストールと認証

```bash
# Claude Code CLI をインストール
curl -fsSL https://claude.ai/cli/install.sh | sh

# インストールパスを確認
which claude  # 通常: /usr/local/bin/claude

# Claude MAX でログイン
claude auth login
# ブラウザが開くので、Claude MAX アカウントでログイン

# 認証状態を確認
claude auth status
# ✅ Authenticated as: your-email@example.com
# Plan: Claude MAX
```

#### 各環境での Claude CLI パス設定

```bash
# 標準インストール（Linux/macOS）
CLAUDE_CLI_PATH=/usr/local/bin/claude

# Nodenv 環境
CLAUDE_CLI_PATH=/home/pi/.nodenv/shims/claude

# NVM 環境
CLAUDE_CLI_PATH=/home/pi/.nvm/versions/node/v20.11.0/bin/claude

# Homebrew 環境（macOS）
CLAUDE_CLI_PATH=/opt/homebrew/bin/claude

# 手動インストール
CLAUDE_CLI_PATH=/home/pi/.local/bin/claude
```

### Step 3: GitHub Personal Access Token の作成

1. **GitHub にログイン** → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate new token (classic)** をクリック

3. **Token 設定**:
   ```
   Note: Claude Bot - [プロジェクト名]
   Expiration: Custom (1年推奨)
   
   Select scopes:
   ✅ repo (Full control of private repositories)
     ✅ repo:status
     ✅ repo_deployment
     ✅ public_repo
     ✅ repo:invite
     ✅ security_events
   ✅ read:org (Read org and team membership)
   ✅ read:user (Read user profile data)
   ```

4. **Generate token** → トークンをコピー（一度しか表示されません）

### Step 4: プロジェクトのクローンと基本設定

```bash
# 開発ディレクトリを作成
mkdir -p /home/pi/Develop  # または ~/Develop
cd /home/pi/Develop

# Claude Bot をクローン
git clone https://github.com/sotaroNishioka/claude-bot.git
cd claude-bot

# 依存関係をインストール
npm install

# TypeScript をビルド
npm run build
```

### Step 5: 環境設定ファイルの作成

```bash
# .env ファイルを作成
cp .env.example .env

# エディタで .env を編集
nano .env  # または code .env
```

#### 基本的な .env 設定

```env
# ===========================================
# GitHub 設定（必須）
# ===========================================
GITHUB_TOKEN=ghp_your_personal_access_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repository_name

# ===========================================
# Claude Code 設定（必須）
# ===========================================
CLAUDE_CLI_PATH=/usr/local/bin/claude
DAILY_TOKEN_LIMIT=45000

# ===========================================
# プロジェクトパス設定
# ===========================================
TARGET_PROJECT_PATH=../target-project
CLAUDE_BOT_PATH=/home/pi/Develop/claude-bot

# ===========================================
# メンション検出設定
# ===========================================
MENTION_PATTERNS=@claude,@claude-code
ENABLE_AUTO_RESPONSE=true

# ===========================================
# 処理設定
# ===========================================
MAX_CONCURRENT_EXECUTIONS=1

# ===========================================
# スケジューリング設定
# ===========================================
DETECTION_INTERVAL="*/5 * * * *"
BACKUP_INTERVAL="0 2 * * *"

# ===========================================
# ログ設定
# ===========================================
LOG_LEVEL=info
LOG_FILE=./logs/claude-bot.log

# ===========================================
# データベース設定
# ===========================================
DATABASE_PATH=./mention_tracker.db

# ===========================================
# 環境設定
# ===========================================
ENVIRONMENT=production
DEBUG=false
```

### Step 6: ターゲットプロジェクトの準備

```bash
# 親ディレクトリに移動
cd ../

# 新しいプロジェクトを作成する場合
mkdir target-project
cd target-project
git init
echo "# Target Project" > README.md
git add .
git commit -m "Initial commit"

# 既存のプロジェクトをクローンする場合
git clone https://github.com/your-username/your-project.git target-project
cd target-project

# Claude Bot ディレクトリに戻る
cd ../claude-bot
```

### Step 7: 初期セットアップとテスト

```bash
# データベースをセットアップ
npm run setup

# 設定をテスト
npm run dev -- test-config
```

**期待される出力例:**
```
✅ GitHub API 接続テスト成功
✅ Claude CLI パステスト成功
✅ ターゲットプロジェクトアクセステスト成功
✅ データベース接続テスト成功
✅ 設定検証完了

📊 設定サマリー:
- Repository: your-username/your-project
- Claude CLI: /usr/local/bin/claude
- Target Project: ../target-project
- Detection Interval: */5 * * * *
```

## ⚙️ 高度な設定

### カスタムメンションパターン

```env
# 基本パターン
MENTION_PATTERNS=@claude,@claude-code

# チーム固有パターン
MENTION_PATTERNS=@ai-assistant,@code-reviewer,@auto-implementer

# プロジェクト固有パターン
MENTION_PATTERNS=@claude-urgent,@claude-feature,@claude-bugfix

# 単一パターン（シンプル）
MENTION_PATTERNS=@claude
```

### スケジューリングのカスタマイズ

```env
# 開発環境（頻繁にチェック）
DETECTION_INTERVAL="*/2 * * * *"  # 2分毎

# 本番環境（標準）
DETECTION_INTERVAL="*/5 * * * *"  # 5分毎

# 省電力モード（Raspberry Pi）
DETECTION_INTERVAL="*/15 * * * *"  # 15分毎

# 営業時間のみ（月-金 9-17時）
DETECTION_INTERVAL="*/5 9-17 * * 1-5"

# 深夜バッチ処理
DETECTION_INTERVAL="0 1-5 * * *"  # 午前1-5時に1回ずつ
```

### 同時実行制御の調整

```env
# 個人利用（安全性重視）
MAX_CONCURRENT_EXECUTIONS=1

# 小チーム（2-5人）
MAX_CONCURRENT_EXECUTIONS=2

# 中チーム（5-15人）
MAX_CONCURRENT_EXECUTIONS=3

# 大チーム（15人以上、強力なサーバー）
MAX_CONCURRENT_EXECUTIONS=5
```

### ログレベルとデバッグ設定

```env
# 本番環境
LOG_LEVEL=info
DEBUG=false

# 開発環境
LOG_LEVEL=debug
DEBUG=true

# トラブルシューティング
LOG_LEVEL=silly
DEBUG=true
```

## 🌟 本番デプロイ

### Option 1: systemd サービス（推奨）

#### サービスファイルの設定

```bash
# サービスファイルをコピー
sudo cp deployment/claude-bot.service /etc/systemd/system/

# サービスファイルを編集（必要に応じて）
sudo nano /etc/systemd/system/claude-bot.service
```

#### サービスファイルの内容例

```ini
[Unit]
Description=Claude Bot - GitHub Mention Detection and Claude Code Automation
Documentation=https://github.com/sotaroNishioka/claude-bot
After=network.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/Develop/claude-bot
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/main.js start
ExecReload=/bin/kill -HUP $MAINPID
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=5
PrivateTmp=true
RestartSec=10
Restart=always

# セキュリティ設定
NoNewPrivileges=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/pi/Develop/claude-bot/logs /home/pi/Develop/claude-bot/backups

# リソース制限
MemoryLimit=1G
TasksMax=50

# ログ設定
StandardOutput=journal
StandardError=journal
SyslogIdentifier=claude-bot

[Install]
WantedBy=multi-user.target
```

#### サービスの有効化と開始

```bash
# systemd 設定を再読み込み
sudo systemctl daemon-reload

# サービスを有効化（自動起動）
sudo systemctl enable claude-bot

# サービスを開始
sudo systemctl start claude-bot

# ステータス確認
sudo systemctl status claude-bot

# ログ確認
sudo journalctl -u claude-bot -f
```

### Option 2: PM2 プロセスマネージャー

#### PM2 のインストールと設定

```bash
# PM2 をグローバルインストール
sudo npm install -g pm2

# PM2 設定ファイルを確認
cat ecosystem.config.js
```

#### PM2 設定ファイルの詳細

```javascript
module.exports = {
  apps: [{
    name: 'claude-bot',
    script: 'dist/main.js',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
```

#### PM2 の運用

```bash
# アプリケーションを開始
pm2 start ecosystem.config.js

# ステータス確認
pm2 status

# ログ確認
pm2 logs claude-bot

# リアルタイム監視
pm2 monit

# 自動起動設定
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi
pm2 save

# アプリケーション停止/再起動
pm2 stop claude-bot
pm2 restart claude-bot
pm2 reload claude-bot  # ゼロダウンタイム再起動
```

### Option 3: Docker コンテナ

#### Dockerfile の作成

```dockerfile
# Dockerfile
FROM node:20-alpine

# 作業ディレクトリを設定
WORKDIR /app

# Claude CLI をインストール
RUN apk add --no-cache curl bash \
    && curl -fsSL https://claude.ai/cli/install.sh | sh

# package.json をコピーして依存関係をインストール
COPY package*.json ./
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# TypeScript をビルド
RUN npm run build

# 非 root ユーザーを作成
RUN addgroup -g 1001 -S nodejs \
    && adduser -S claude-bot -u 1001

# ログとデータベースディレクトリを作成
RUN mkdir -p /app/logs /app/backups \
    && chown -R claude-bot:nodejs /app

# ユーザーを切り替え
USER claude-bot

# ポートを公開（ヘルスチェック用）
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check')" || exit 1

# アプリケーションを起動
CMD ["node", "dist/main.js", "start"]
```

#### Docker Compose の設定

```yaml
# docker-compose.yml
version: '3.8'

services:
  claude-bot:
    build: .
    container_name: claude-bot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./backups:/app/backups
      - ./mention_tracker.db:/app/mention_tracker.db
      - ../target-project:/app/target-project:rw
    networks:
      - claude-bot-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

networks:
  claude-bot-network:
    driver: bridge
```

#### Docker での運用

```bash
# イメージをビルド
docker-compose build

# サービスを開始
docker-compose up -d

# ログ確認
docker-compose logs -f claude-bot

# コンテナ内でコマンド実行
docker-compose exec claude-bot npm run dev -- status

# サービス停止
docker-compose down

# データを保持して再起動
docker-compose restart claude-bot
```

## 📊 監視とメンテナンス

### システム監視

#### 基本的なヘルスチェック

```bash
# サービス状態確認
sudo systemctl status claude-bot

# プロセス確認
ps aux | grep claude-bot

# ポート使用確認
netstat -tlnp | grep node

# リソース使用量確認
top -p $(pgrep -f claude-bot)

# ディスク使用量確認
du -sh /home/pi/Develop/claude-bot
df -h
```

#### Claude Bot 固有の監視

```bash
# Bot のステータス確認
cd /home/pi/Develop/claude-bot
npm run dev -- status

# 今日の統計確認
sqlite3 mention_tracker.db "SELECT * FROM processing_stats WHERE date = date('now');"

# 最近のメンション履歴
sqlite3 mention_tracker.db "SELECT * FROM mention_history ORDER BY detected_at DESC LIMIT 10;"
```

### ログ管理

#### ログファイルの種類

```bash
# アプリケーションログ
tail -f ./logs/claude-bot.log           # 全般ログ
tail -f ./logs/claude-bot-error.log     # エラーログ
tail -f ./logs/claude-bot-exceptions.log # 例外ログ

# システムログ（systemd 使用時）
sudo journalctl -u claude-bot -f        # リアルタイム
sudo journalctl -u claude-bot --since today  # 今日のログ

# PM2 ログ（PM2 使用時）
tail -f ./logs/pm2-combined.log         # 統合ログ
tail -f ./logs/pm2-error.log           # エラーログ
```

#### ログ分析コマンド

```bash
# エラーパターンの確認
grep -E "(ERROR|WARN)" ./logs/claude-bot.log | tail -20

# メンション検出の確認
grep "mention detected" ./logs/claude-bot.log | grep $(date +%Y-%m-%d)

# Claude Code 実行の確認
grep "Claude Code実行" ./logs/claude-bot.log | tail -10

# トークン使用量の確認
grep "Token used" ./logs/claude-bot.log | tail -10

# API レート制限の確認
grep "rate limit" ./logs/claude-bot.log

# 日別エラー統計
grep ERROR ./logs/claude-bot.log | cut -d' ' -f1 | sort | uniq -c
```

### データベースメンテナンス

#### 定期的な最適化

```bash
# データベース接続
sqlite3 mention_tracker.db

# データベース統計
.tables
.schema

# 古いデータのクリーンアップ（90日以上前）
DELETE FROM mention_history 
WHERE processed = 1 AND detected_at < datetime('now', '-90 days');

# データベース最適化
VACUUM;

# インデックス再構築
REINDEX;

# データベース整合性チェック
PRAGMA integrity_check;

# ファイルサイズ確認
.quit
ls -lh mention_tracker.db
```

#### バックアップ管理

```bash
# 手動バックアップ
cp mention_tracker.db ./backups/manual-$(date +%Y%m%d-%H%M%S).db

# バックアップファイルの確認
ls -la ./backups/

# 古いバックアップの削除（30日以上前）
find ./backups -name "*.db" -mtime +30 -delete

# バックアップからの復元
cp ./backups/mention_tracker_20240315.db mention_tracker.db
```

### 定期メンテナンススクリプト

#### 毎日のメンテナンス

```bash
#!/bin/bash
# daily-maintenance.sh

echo "=== Claude Bot 日次メンテナンス $(date) ==="

# ログローテーション確認
echo "ログファイルサイズ確認..."
du -sh ./logs/*

# データベースサイズ確認
echo "データベースサイズ確認..."
du -sh mention_tracker.db

# 古いログの削除（30日以上前）
echo "古いログファイルを削除中..."
find ./logs -name "*.log.*" -mtime +30 -delete

# Bot のステータス確認
echo "Bot ステータス確認..."
npm run dev -- status | head -20

# システムリソース確認
echo "システムリソース確認..."
free -h
df -h | grep -E "(/$|/home)"

echo "=== メンテナンス完了 ==="
```

#### 週次のメンテナンス

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "=== Claude Bot 週次メンテナンス $(date) ==="

# データベース最適化
echo "データベース最適化中..."
sqlite3 mention_tracker.db "VACUUM; REINDEX;"

# 古い処理済みメンションの削除
echo "古いメンション履歴を削除中..."
sqlite3 mention_tracker.db "DELETE FROM mention_history WHERE processed = 1 AND detected_at < datetime('now', '-60 days');"

# 統計レポート生成
echo "週次統計レポート生成中..."
sqlite3 mention_tracker.db "
SELECT 
  date,
  total_checks,
  new_mentions,
  processed_mentions,
  tokens_used
FROM processing_stats 
WHERE date >= date('now', '-7 days')
ORDER BY date DESC;
" > ./logs/weekly-stats-$(date +%Y%m%d).txt

# サービス再起動（オプション）
if [ "$1" = "--restart" ]; then
  echo "サービスを再起動中..."
  sudo systemctl restart claude-bot
fi

echo "=== 週次メンテナンス完了 ==="
```

## ⚡ パフォーマンス最適化

### リソース使用量の最適化

#### メモリ使用量の最適化

```env
# NODE_OPTIONS でメモリ制限を設定
NODE_OPTIONS="--max-old-space-size=512"  # 512MB制限

# ガベージコレクション最適化
NODE_OPTIONS="--max-old-space-size=512 --gc-interval=100"
```

#### CPU 使用量の最適化

```env
# 検出間隔を調整（CPU負荷軽減）
DETECTION_INTERVAL="*/10 * * * *"  # 10分間隔

# 同時実行数を制限
MAX_CONCURRENT_EXECUTIONS=1

# ログレベルを上げる（I/O削減）
LOG_LEVEL=warn
```

### ネットワーク最適化

#### GitHub API の効率的な使用

```env
# 必要最小限のデータ取得
GITHUB_API_TIMEOUT=10000

# レート制限対策
GITHUB_API_RETRY_DELAY=5000
```

#### Claude Code の最適化

```env
# トークン制限の調整
DAILY_TOKEN_LIMIT=30000  # 保守的な設定

# タイムアウト設定
CLAUDE_CODE_TIMEOUT=300000  # 5分
```

### データベース最適化

#### インデックスの最適化

```sql
-- パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_mention_history_detected_at 
ON mention_history(detected_at);

CREATE INDEX IF NOT EXISTS idx_mention_history_processed 
ON mention_history(processed);

CREATE INDEX IF NOT EXISTS idx_tracked_items_last_checked 
ON tracked_items(last_checked);

CREATE INDEX IF NOT EXISTS idx_processing_stats_date 
ON processing_stats(date);
```

#### データベース設定の最適化

```bash
# データベース接続時の最適化設定
sqlite3 mention_tracker.db "
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=10000;
PRAGMA temp_store=memory;
"
```

### 監視アラートの設定

#### システムアラート

```bash
#!/bin/bash
# alert-check.sh

# メモリ使用量チェック（80%以上で警告）
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEM_USAGE -gt 80 ]; then
  echo "⚠️  高メモリ使用量: ${MEM_USAGE}%"
fi

# ディスク使用量チェック（90%以上で警告）
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
  echo "⚠️  高ディスク使用量: ${DISK_USAGE}%"
fi

# Bot プロセスチェック
if ! pgrep -f claude-bot > /dev/null; then
  echo "❌ Claude Bot プロセスが見つかりません"
fi

# データベースサイズチェック（100MB以上で警告）
DB_SIZE=$(stat -c%s mention_tracker.db)
if [ $DB_SIZE -gt 104857600 ]; then
  echo "⚠️  大きなデータベースファイル: $(numfmt --to=iec $DB_SIZE)"
fi
```

この詳細なセットアップガイドにより、Claude Bot を確実に本番環境で運用できます。次のステップとして、トラブルシューティングガイドも同様に詳細化しましょうか？