# Claude Bot トラブルシューティングガイド 🔧

Claude Bot の運用中に発生する可能性のある問題の包括的な解決ガイドです。症状別に問題を特定し、段階的な解決方法を提供します。

## 📋 目次

1. [基本的なトラブルシューティング](#基本的なトラブルシューティング)
2. [GitHub 関連の問題](#github-関連の問題)
3. [Claude Code 関連の問題](#claude-code-関連の問題)
4. [データベース関連の問題](#データベース関連の問題)
5. [ネットワーク関連の問題](#ネットワーク関連の問題)
6. [パフォーマンス関連の問題](#パフォーマンス関連の問題)
7. [デプロイ関連の問題](#デプロイ関連の問題)
8. [診断ツールとコマンド](#診断ツールとコマンド)

## 🔍 基本的なトラブルシューティング

### 問題発生時の初期対応フロー

```bash
# 1. サービス状態の確認
sudo systemctl status claude-bot  # systemd使用時
pm2 status                        # PM2使用時

# 2. プロセス確認
ps aux | grep claude-bot

# 3. 最新ログの確認
tail -50 ./logs/claude-bot.log

# 4. エラーログの確認
tail -20 ./logs/claude-bot-error.log

# 5. Bot ステータス確認
npm run dev -- status
```

### 一般的な症状と原因の特定

| 症状 | 考えられる原因 | 確認コマンド |
|------|----------------|--------------|
| **Bot が応答しない** | プロセス停止、設定エラー | `ps aux \| grep claude-bot` |
| **メンションが検出されない** | GitHub API問題、トークン期限切れ | `npm run dev -- test-config` |
| **Claude Code が実行されない** | CLI認証問題、パス設定エラー | `claude auth status` |
| **高メモリ使用量** | メモリリーク、データベース肥大化 | `top -p $(pgrep -f claude-bot)` |
| **ログにエラー** | 設定問題、ネットワーク問題 | `grep ERROR ./logs/claude-bot.log` |

## 🐙 GitHub 関連の問題

### 1. GitHub API 認証エラー

#### 症状
```
❌ GitHub API接続エラー: 401 Unauthorized
❌ Bad credentials エラー
❌ API rate limit exceeded
```

#### 原因と解決方法

**1.1 トークンの有効性確認**
```bash
# トークンをテスト
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# 成功例:
{
  "login": "your-username",
  "id": 12345,
  ...
}

# 失敗例:
{
  "message": "Bad credentials",
  "documentation_url": "https://docs.github.com/rest"
}
```

**1.2 トークン権限の確認**
```bash
# トークンの権限を確認
curl -H "Authorization: token YOUR_TOKEN" -I https://api.github.com/user

# X-OAuth-Scopes ヘッダーで現在の権限を確認
# 必要権限: repo, read:org, read:user
```

**1.3 新しいトークンの作成**
1. GitHub → Settings → Developer settings → Personal access tokens
2. **Generate new token (classic)**
3. 必要な権限を設定:
   ```
   ✅ repo (Full control of private repositories)
   ✅ read:org (Read org and team membership)  
   ✅ read:user (Read user profile data)
   ```
4. `.env` ファイルを更新:
   ```env
   GITHUB_TOKEN=ghp_your_new_token_here
   ```

**1.4 組織のリポジトリアクセス**
```bash
# 組織のリポジトリの場合、SSO認証が必要な場合があります
# GitHub で該当トークンに SSO を有効化
```

### 2. GitHub API レート制限

#### 症状
```
⚠️ GitHub API rate limit exceeded. Reset in 3600 seconds
❌ API rate limit: 5000 requests per hour exceeded
```

#### 解決方法

**2.1 現在のレート制限状況確認**
```bash
# レート制限状況をチェック
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit

# 出力例:
{
  "rate": {
    "limit": 5000,
    "remaining": 0,
    "reset": 1640995200,
    "used": 5000
  }
}
```

**2.2 検出間隔の調整**
```env
# .env で間隔を増やす
DETECTION_INTERVAL="*/15 * * * *"  # 15分間隔に変更

# または営業時間のみに制限
DETECTION_INTERVAL="*/5 9-17 * * 1-5"  # 平日9-17時のみ
```

**2.3 レート制限回避の最適化**
```bash
# リポジトリの更新頻度が低い場合
DETECTION_INTERVAL="*/30 * * * *"  # 30分間隔

# 夜間のみ実行
DETECTION_INTERVAL="0 1-5 * * *"  # 午前1-5時のみ
```

### 3. リポジトリアクセス問題

#### 症状
```
❌ Repository not found or access denied
❌ 404 Not Found: https://api.github.com/repos/owner/repo
```

#### 解決方法

**3.1 リポジトリ名と所有者の確認**
```bash
# .env 設定を確認
grep -E "GITHUB_OWNER|GITHUB_REPO" .env

# 正しい形式:
GITHUB_OWNER=your-username        # ユーザー名または組織名
GITHUB_REPO=your-repository-name  # リポジトリ名のみ（URLではない）
```

**3.2 プライベートリポジトリのアクセス権確認**
```bash
# リポジトリへのアクセステスト
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/OWNER/REPO

# 403 Forbidden の場合はアクセス権がない
# 404 Not Found の場合はリポジトリが存在しないか、トークンが無効
```

## 🤖 Claude Code 関連の問題

### 1. Claude CLI 認証エラー

#### 症状
```
❌ Claude CLI認証エラー: Not authenticated
❌ claude: command not found
❌ Claude Code is currently unavailable
```

#### 解決方法

**1.1 Claude CLI のインストール確認**
```bash
# Claude CLI の存在確認
which claude
claude --version

# インストールされていない場合
curl -fsSL https://claude.ai/cli/install.sh | sh

# パスの追加（必要に応じて）
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**1.2 認証状態の確認**
```bash
# 認証状態をチェック
claude auth status

# 成功例:
✅ Authenticated as: your-email@example.com
Plan: Claude MAX

# 失敗例:
❌ Not authenticated
```

**1.3 再認証の実行**
```bash
# 既存の認証をクリア
claude auth logout

# 新規認証
claude auth login
# ブラウザが開くので Claude MAX アカウントでログイン

# 認証確認
claude auth status
```

**1.4 Claude MAX サブスクリプション確認**
```bash
# Claude Code は Claude MAX サブスクリプションが必要
# ブラウザで claude.ai にアクセスして確認

# サブスクリプション状態確認
claude auth status | grep "Plan:"
```

### 2. Claude CLI パス問題

#### 症状
```
❌ Claude CLI path not found: /usr/local/bin/claude
❌ Permission denied: /path/to/claude
❌ spawn ENOENT
```

#### 解決方法

**2.1 Claude CLI パスの確認**
```bash
# Claude CLI の実際のパスを特定
which claude
whereis claude
find /usr -name "claude" 2>/dev/null
find /home -name "claude" 2>/dev/null

# よくあるパス:
/usr/local/bin/claude              # 標準インストール
/home/pi/.nodenv/shims/claude      # Nodenv
/home/pi/.nvm/versions/node/v20.11.0/bin/claude  # NVM
/opt/homebrew/bin/claude           # Homebrew (macOS)
```

**2.2 .env ファイルでパスを更新**
```env
# 正しいパスに更新
CLAUDE_CLI_PATH=/actual/path/to/claude
```

**2.3 権限問題の解決**
```bash
# 実行権限を確認
ls -la $(which claude)

# 権限を付与（必要な場合）
chmod +x $(which claude)

# 所有者を確認
ls -la $(which claude)
```

### 3. Claude Code 実行タイムアウト

#### 症状
```
⚠️ Claude Code execution timeout after 300000ms
❌ Process killed due to timeout
```

#### 解決方法

**3.1 タイムアウト設定の調整**
```env
# .env でタイムアウトを延長
CLAUDE_CODE_TIMEOUT=600000  # 10分に延長
```

**3.2 大きなファイルやプロジェクトの最適化**
```bash
# ターゲットプロジェクトのサイズ確認
du -sh ../target-project

# 不要ファイルの除外（.gitignore に追加）
echo "node_modules/" >> ../target-project/.gitignore
echo "dist/" >> ../target-project/.gitignore
echo "*.log" >> ../target-project/.gitignore
```

**3.3 同時実行数の調整**
```env
# より少ない同時実行数に設定
MAX_CONCURRENT_EXECUTIONS=1
```

### 4. トークン制限エラー

#### 症状
```
⚠️ Daily token limit reached: 45000
❌ Token usage exceeded daily limit
```

#### 解決方法

**4.1 トークン使用量の確認**
```bash
# 今日のトークン使用量確認
npm run dev -- status | grep "tokensUsed"

# データベースで詳細確認
sqlite3 mention_tracker.db "
SELECT date, tokens_used, api_calls 
FROM processing_stats 
WHERE date >= date('now', '-7 days')
ORDER BY date DESC;
"
```

**4.2 制限値の調整**
```env
# Claude MAX の実際の制限に応じて調整
DAILY_TOKEN_LIMIT=60000  # より高い値に設定

# 保守的な設定
DAILY_TOKEN_LIMIT=30000  # より低い値に設定
```

**4.3 効率的なプロンプト設計**
```bash
# prompts/ ディレクトリのプロンプトを最適化
# より具体的で簡潔なプロンプトに変更
```

## 🗄️ データベース関連の問題

### 1. データベースロックエラー

#### 症状
```
❌ SQLITE_BUSY: database is locked
❌ Database is locked by another process
❌ Error: SQLITE_LOCKED: database table is locked
```

#### 解決方法

**1.1 競合プロセスの確認**
```bash
# Claude Bot プロセスを確認
ps aux | grep claude-bot

# 複数のプロセスが実行されている場合、停止
pkill -f claude-bot

# データベースを使用しているプロセス確認
lsof mention_tracker.db
```

**1.2 データベースロックの解除**
```bash
# データベース接続確認
sqlite3 mention_tracker.db ".tables"

# ロック状態の確認
sqlite3 mention_tracker.db "PRAGMA locking_mode;"

# WAL モードの確認
sqlite3 mention_tracker.db "PRAGMA journal_mode;"
```

**1.3 データベース最適化**
```bash
# データベースをバックアップ
cp mention_tracker.db mention_tracker.db.backup

# WAL ファイルのクリーンアップ
sqlite3 mention_tracker.db "PRAGMA wal_checkpoint(FULL);"

# データベース整合性チェック
sqlite3 mention_tracker.db "PRAGMA integrity_check;"
```

### 2. データベース破損

#### 症状
```
❌ SQLite error: database disk image is malformed
❌ Database corruption detected
❌ PRAGMA integrity_check failed
```

#### 解決方法

**2.1 整合性チェック**
```bash
# 破損レベルの確認
sqlite3 mention_tracker.db "PRAGMA integrity_check;"

# クイックチェック
sqlite3 mention_tracker.db "PRAGMA quick_check;"
```

**2.2 バックアップからの復元**
```bash
# 利用可能なバックアップを確認
ls -la ./backups/

# 最新のバックアップから復元
cp ./backups/mention_tracker_$(date +%Y%m%d).db mention_tracker.db

# 手動バックアップから復元
cp ./backups/manual-20240315-120000.db mention_tracker.db
```

**2.3 データベースの再構築**
```bash
# 既存データベースを退避
mv mention_tracker.db mention_tracker.db.corrupt

# 新しいデータベースを作成
npm run setup

# 可能であれば部分的にデータを復旧
sqlite3 mention_tracker.db.corrupt ".dump" | grep -v "ROLLBACK" | sqlite3 mention_tracker.db
```

### 3. データベースサイズの肥大化

#### 症状
```
⚠️ Database size: 150MB (警告レベル)
💾 Large database file detected
```

#### 解決方法

**3.1 データベースサイズの確認**
```bash
# ファイルサイズ確認
du -sh mention_tracker.db

# テーブル別レコード数確認
sqlite3 mention_tracker.db "
SELECT 'tracked_items' as table_name, COUNT(*) as records FROM tracked_items
UNION ALL
SELECT 'mention_history', COUNT(*) FROM mention_history  
UNION ALL
SELECT 'processing_stats', COUNT(*) FROM processing_stats;
"
```

**3.2 古いデータのクリーンアップ**
```bash
# データベースに接続
sqlite3 mention_tracker.db

-- 90日以上前の処理済みメンションを削除
DELETE FROM mention_history 
WHERE processed = 1 AND detected_at < datetime('now', '-90 days');

-- 180日以上前の統計データを削除
DELETE FROM processing_stats 
WHERE date < date('now', '-180 days');

-- 未使用の tracked_items を削除
DELETE FROM tracked_items 
WHERE last_checked < datetime('now', '-30 days') 
AND has_mention = 0;

-- データベース最適化
VACUUM;

-- 接続終了
.quit
```

**3.3 定期的なメンテナンス設定**
```bash
# 週次クリーンアップスクリプト作成
cat > weekly-cleanup.sh << 'EOF'
#!/bin/bash
echo "週次データベースクリーンアップ開始: $(date)"

sqlite3 mention_tracker.db "
DELETE FROM mention_history 
WHERE processed = 1 AND detected_at < datetime('now', '-60 days');

DELETE FROM processing_stats 
WHERE date < date('now', '-90 days');

VACUUM;
REINDEX;
"

echo "クリーンアップ完了: $(date)"
EOF

chmod +x weekly-cleanup.sh

# cron で定期実行
echo "0 2 * * 0 /path/to/weekly-cleanup.sh" | crontab -
```

## 🌐 ネットワーク関連の問題

### 1. 接続タイムアウトエラー

#### 症状
```
❌ ENOTFOUND api.github.com
❌ ECONNREFUSED 443 api.github.com
❌ Request timeout after 10000ms
```

#### 解決方法

**1.1 基本的な接続確認**
```bash
# インターネット接続確認
ping -c 4 8.8.8.8

# GitHub API への接続確認
curl -I https://api.github.com

# DNS 解決確認
nslookup api.github.com
```

**1.2 プロキシ設定**
```bash
# 企業ネットワークでプロキシが必要な場合
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# .env ファイルに追加
echo "HTTP_PROXY=http://proxy.company.com:8080" >> .env
echo "HTTPS_PROXY=http://proxy.company.com:8080" >> .env
```

**1.3 ファイアウォール設定**
```bash
# 必要なポートが開いているか確認
sudo netstat -tlnp | grep :443

# Ubuntu/Debian でファイアウォール確認
sudo ufw status

# 必要に応じて HTTPS アウトバウンドを許可
sudo ufw allow out 443
```

### 2. SSL/TLS 証明書エラー

#### 症状
```
❌ CERT_UNTRUSTED: certificate not trusted
❌ SSL handshake failed
❌ unable to verify the first certificate
```

#### 解決方法

**2.1 証明書ストアの更新**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ca-certificates

# CentOS/RHEL
sudo yum update ca-certificates

# macOS
brew install ca-certificates
```

**2.2 Node.js の証明書設定**
```env
# .env に追加（最後の手段）
NODE_TLS_REJECT_UNAUTHORIZED=0  # セキュリティリスクがあるため非推奨
```

**2.3 時刻同期の確認**
```bash
# システム時刻確認
date

# NTP 同期確認
sudo systemctl status ntp     # Ubuntu/Debian
sudo systemctl status chronyd # CentOS/RHEL

# 手動時刻合わせ
sudo ntpdate -s time.nist.gov
```

## ⚡ パフォーマンス関連の問題

### 1. 高メモリ使用量

#### 症状
```
⚠️ Memory usage: 85% (警告レベル)
💾 Process memory limit reached
❌ Out of memory error
```

#### 解決方法

**1.1 メモリ使用量の監視**
```bash
# プロセスメモリ確認
ps aux | grep claude-bot

# リアルタイム監視
top -p $(pgrep -f claude-bot)

# メモリ使用詳細
cat /proc/$(pgrep -f claude-bot)/status | grep -E "VmSize|VmRSS"
```

**1.2 Node.js メモリ制限設定**
```env
# .env に追加
NODE_OPTIONS="--max-old-space-size=512"  # 512MB制限

# ガベージコレクション最適化
NODE_OPTIONS="--max-old-space-size=512 --gc-interval=100"
```

**1.3 アプリケーション最適化**
```env
# 検出間隔を増やしてメモリ圧迫を軽減
DETECTION_INTERVAL="*/15 * * * *"

# ログレベルを上げて I/O 削減
LOG_LEVEL=warn

# 同時実行数を制限
MAX_CONCURRENT_EXECUTIONS=1
```

### 2. CPU 使用率が高い

#### 症状
```
⚠️ High CPU usage: 90%+
🔥 CPU temperature warning
```

#### 解決方法

**2.1 CPU 使用量の確認**
```bash
# CPU 使用率確認
top -p $(pgrep -f claude-bot)

# CPU 詳細分析
perf top -p $(pgrep -f claude-bot)  # 高度な分析
```

**2.2 処理間隔の調整**
```env
# 検出間隔を大幅に増やす
DETECTION_INTERVAL="*/30 * * * *"  # 30分間隔

# 営業時間のみ実行
DETECTION_INTERVAL="*/5 9-17 * * 1-5"  # 平日日中のみ
```

**2.3 Raspberry Pi での最適化**
```bash
# CPU 周波数制限（発熱対策）
echo "arm_freq=1000" | sudo tee -a /boot/config.txt

# GPU メモリ削減
echo "gpu_mem=16" | sudo tee -a /boot/config.txt

# 再起動して設定適用
sudo reboot
```

### 3. ディスク I/O 問題

#### 症状
```
⚠️ High disk I/O activity
💾 Disk space running low
📝 Log files growing rapidly
```

#### 解決方法

**3.1 ディスク使用量確認**
```bash
# ディスク使用量
df -h

# ディレクトリ別使用量
du -sh /home/pi/Develop/claude-bot/*

# I/O 統計
iostat -x 1 5
```

**3.2 ログファイル管理**
```bash
# ログファイルサイズ確認
ls -lah ./logs/

# 古いログファイル削除
find ./logs -name "*.log.*" -mtime +7 -delete

# ログローテーション設定確認
grep -A 10 "rotating" src/logger.ts
```

**3.3 データベース最適化**
```bash
# データベースをメモリテンポラリストアに変更
sqlite3 mention_tracker.db "PRAGMA temp_store=memory;"

# WAL モードでI/O最適化
sqlite3 mention_tracker.db "PRAGMA journal_mode=WAL;"
```

## 🚀 デプロイ関連の問題

### 1. systemd サービス問題

#### 症状
```
❌ Failed to start claude-bot.service
❌ Service entered failed state
❌ Unit not found
```

#### 解決方法

**1.1 サービス状態確認**
```bash
# サービス詳細状態
sudo systemctl status claude-bot -l

# サービスログ確認
sudo journalctl -u claude-bot -f

# サービス設定確認
sudo systemctl cat claude-bot
```

**1.2 サービスファイル修正**
```bash
# サービスファイル編集
sudo nano /etc/systemd/system/claude-bot.service

# 設定例確認:
[Unit]
Description=Claude Bot
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Develop/claude-bot
ExecStart=/usr/bin/node dist/main.js start
Restart=always

[Install]
WantedBy=multi-user.target
```

**1.3 権限とパス確認**
```bash
# 実行ファイル確認
ls -la /home/pi/Develop/claude-bot/dist/main.js

# ユーザー権限確認
sudo -u pi node /home/pi/Develop/claude-bot/dist/main.js --version

# 設定再読み込み
sudo systemctl daemon-reload
sudo systemctl enable claude-bot
sudo systemctl start claude-bot
```

### 2. PM2 デプロイ問題

#### 症状
```
❌ PM2 process not found
❌ App not found in PM2 list
❌ Restart limit reached
```

#### 解決方法

**2.1 PM2 状態確認**
```bash
# PM2 プロセス一覧
pm2 list

# 詳細ステータス
pm2 show claude-bot

# PM2 ログ
pm2 logs claude-bot
```

**2.2 PM2 設定修正**
```bash
# ecosystem.config.js 確認
cat ecosystem.config.js

# PM2 プロセス削除と再作成
pm2 delete claude-bot
pm2 start ecosystem.config.js

# PM2 保存
pm2 save
```

**2.3 PM2 自動起動設定**
```bash
# 自動起動設定
pm2 startup

# 表示されたコマンドを実行（例）
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi

# 現在の状態を保存
pm2 save
```

### 3. Docker デプロイ問題

#### 症状
```
❌ Container exits immediately
❌ Health check failing
❌ Volume mount errors
```

#### 解決方法

**3.1 コンテナログ確認**
```bash
# コンテナログ確認
docker logs claude-bot

# リアルタイムログ
docker logs -f claude-bot

# コンテナ内部確認
docker exec -it claude-bot /bin/sh
```

**3.2 ボリュームマウント確認**
```bash
# マウント状況確認
docker inspect claude-bot | grep -A 10 "Mounts"

# ホスト側権限確認
ls -la ../target-project
ls -la ./logs ./backups
```

**3.3 環境変数確認**
```bash
# コンテナ内環境変数
docker exec claude-bot env | grep -E "GITHUB|CLAUDE"

# .env ファイル確認
cat .env
```

## 🔧 診断ツールとコマンド

### システム診断スクリプト

```bash
#!/bin/bash
# claude-bot-diagnostics.sh

echo "=== Claude Bot 診断スクリプト ==="
echo "実行時刻: $(date)"
echo ""

# 1. システム情報
echo "--- システム情報 ---"
uname -a
cat /etc/os-release | head -3
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo ""

# 2. Claude Bot プロセス
echo "--- プロセス状態 ---"
if pgrep -f claude-bot > /dev/null; then
    echo "✅ Claude Bot プロセス実行中"
    ps aux | grep claude-bot | head -1
else
    echo "❌ Claude Bot プロセスが見つかりません"
fi
echo ""

# 3. サービス状態
echo "--- サービス状態 ---"
if systemctl is-active --quiet claude-bot; then
    echo "✅ systemd サービス実行中"
    sudo systemctl status claude-bot --no-pager -l
else
    echo "❓ systemd サービス無効または停止中"
fi
echo ""

# 4. ファイル確認
echo "--- ファイル確認 ---"
if [ -f "mention_tracker.db" ]; then
    echo "✅ データベースファイル存在: $(du -sh mention_tracker.db)"
else
    echo "❌ データベースファイルなし"
fi

if [ -f ".env" ]; then
    echo "✅ 環境設定ファイル存在"
else
    echo "❌ .env ファイルなし"
fi

if [ -d "logs" ]; then
    echo "✅ ログディレクトリ存在: $(du -sh logs)"
else
    echo "❌ logs ディレクトリなし"
fi
echo ""

# 5. ネットワーク確認
echo "--- ネットワーク確認 ---"
if curl -s -I https://api.github.com | head -1 | grep -q "200"; then
    echo "✅ GitHub API 接続成功"
else
    echo "❌ GitHub API 接続失敗"
fi

if curl -s -I https://claude.ai | head -1 | grep -q "200"; then
    echo "✅ Claude.ai 接続成功"
else
    echo "❌ Claude.ai 接続失敗"
fi
echo ""

# 6. Claude CLI 確認
echo "--- Claude CLI 確認 ---"
if command -v claude &> /dev/null; then
    echo "✅ Claude CLI インストール済み: $(which claude)"
    if claude auth status &> /dev/null; then
        echo "✅ Claude CLI 認証済み"
    else
        echo "❌ Claude CLI 認証なし"
    fi
else
    echo "❌ Claude CLI インストールなし"
fi
echo ""

# 7. リソース使用量
echo "--- リソース使用量 ---"
echo "メモリ使用量:"
free -h
echo "ディスク使用量:"
df -h | grep -E "(/$|/home)"
echo ""

# 8. 最新エラーログ
echo "--- 最新エラーログ（直近10件） ---"
if [ -f "logs/claude-bot-error.log" ]; then
    tail -10 logs/claude-bot-error.log
else
    echo "エラーログファイルなし"
fi

echo ""
echo "=== 診断完了 ==="
```

### 設定検証スクリプト

```bash
#!/bin/bash
# validate-config.sh

echo "=== 設定検証スクリプト ==="

# .env ファイル読み込み
if [ -f ".env" ]; then
    source .env
    echo "✅ .env ファイル読み込み成功"
else
    echo "❌ .env ファイルが見つかりません"
    exit 1
fi

# 必須変数チェック
echo ""
echo "--- 必須環境変数チェック ---"
required_vars=("GITHUB_TOKEN" "GITHUB_OWNER" "GITHUB_REPO" "CLAUDE_CLI_PATH")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ $var が設定されていません"
    else
        echo "✅ $var 設定済み"
    fi
done

# GitHub API テスト
echo ""
echo "--- GitHub API テスト ---"
response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user)
if [ "$response" = "200" ]; then
    echo "✅ GitHub トークン有効"
else
    echo "❌ GitHub トークン無効 (HTTP $response)"
fi

# リポジトリアクセステスト
response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO")
if [ "$response" = "200" ]; then
    echo "✅ リポジトリアクセス成功"
else
    echo "❌ リポジトリアクセス失敗 (HTTP $response)"
fi

# Claude CLI テスト
echo ""
echo "--- Claude CLI テスト ---"
if [ -x "$CLAUDE_CLI_PATH" ]; then
    echo "✅ Claude CLI 実行可能: $CLAUDE_CLI_PATH"
    if $CLAUDE_CLI_PATH auth status &> /dev/null; then
        echo "✅ Claude CLI 認証済み"
    else
        echo "❌ Claude CLI 認証なし"
    fi
else
    echo "❌ Claude CLI が見つからないか実行不可: $CLAUDE_CLI_PATH"
fi

# ターゲットプロジェクト確認
echo ""
echo "--- ターゲットプロジェクト確認 ---"
if [ -d "$TARGET_PROJECT_PATH" ]; then
    echo "✅ ターゲットプロジェクトディレクトリ存在: $TARGET_PROJECT_PATH"
    if [ -d "$TARGET_PROJECT_PATH/.git" ]; then
        echo "✅ Git リポジトリ確認"
    else
        echo "⚠️ Git リポジトリではありません"
    fi
else
    echo "❌ ターゲットプロジェクトディレクトリなし: $TARGET_PROJECT_PATH"
fi

echo ""
echo "=== 検証完了 ==="
```

### パフォーマンス監視スクリプト

```bash
#!/bin/bash
# performance-monitor.sh

echo "=== Claude Bot パフォーマンス監視 ==="

# プロセス ID 取得
PID=$(pgrep -f claude-bot)
if [ -z "$PID" ]; then
    echo "❌ Claude Bot プロセスが見つかりません"
    exit 1
fi

echo "プロセス ID: $PID"
echo "監視開始時刻: $(date)"
echo ""

# リソース使用量をログファイルに記録
LOG_FILE="./logs/performance-$(date +%Y%m%d).log"

while true; do
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    
    # メモリ使用量（KB）
    MEM_KB=$(ps -o rss= -p $PID 2>/dev/null)
    MEM_MB=$((MEM_KB / 1024))
    
    # CPU 使用率
    CPU_PERCENT=$(ps -o %cpu= -p $PID 2>/dev/null | tr -d ' ')
    
    # ディスク使用量
    DB_SIZE=$(du -k mention_tracker.db 2>/dev/null | cut -f1)
    LOG_SIZE=$(du -k logs/ 2>/dev/null | cut -f1)
    
    # ログに記録
    echo "$TIMESTAMP,Memory:${MEM_MB}MB,CPU:${CPU_PERCENT}%,DB:${DB_SIZE}KB,Logs:${LOG_SIZE}KB" >> $LOG_FILE
    
    # 閾値チェック
    if [ "$MEM_MB" -gt 500 ]; then
        echo "⚠️ 高メモリ使用量: ${MEM_MB}MB"
    fi
    
    if [ "$(echo "$CPU_PERCENT > 50" | bc -l 2>/dev/null)" = "1" ]; then
        echo "⚠️ 高CPU使用率: ${CPU_PERCENT}%"
    fi
    
    sleep 60  # 1分間隔
done
```

## 📞 サポートとエスカレーション

### 問題解決できない場合

1. **診断情報の収集**
   ```bash
   # 診断スクリプト実行
   ./claude-bot-diagnostics.sh > diagnostics-$(date +%Y%m%d).txt
   
   # 設定検証実行
   ./validate-config.sh > validation-$(date +%Y%m%d).txt
   
   # 最新ログ収集
   tail -100 ./logs/claude-bot.log > recent-logs-$(date +%Y%m%d).txt
   ```

2. **GitHub Issues での報告**
   - [GitHub Issues](https://github.com/sotaroNishioka/claude-bot/issues)
   - 診断結果とログを添付
   - 環境情報を明記（OS、Node.js版、Claude Bot版）

3. **緊急時の一時的回避**
   ```bash
   # サービス停止
   sudo systemctl stop claude-bot
   
   # 手動実行でテスト
   npm run dev -- run-once
   
   # 問題解決後にサービス再開
   sudo systemctl start claude-bot
   ```

このトラブルシューティングガイドにより、Claude Bot の運用中に発生する様々な問題に対応できます。