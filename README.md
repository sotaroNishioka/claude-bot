# Claude Bot 🤖

TypeScript implementation of Claude Code mention detection and automation system for GitHub repositories, designed to run on Raspberry Pi and execute Claude Code CLI on local projects.

## 🎯 Purpose

Claude Bot monitors GitHub repositories for `@claude` or `@claude-code` mentions and automatically executes Claude Code CLI commands on your local project directory. Perfect for:

- **Raspberry Pi automation**: Always-on monitoring with minimal resource usage
- **Local development**: Claude Code works directly on your local project files
- **GitHub integration**: Seamless integration with GitHub Issues and Pull Requests
- **Token optimization**: Smart change detection to minimize Claude API usage

## 🗂️ Project Structure

```
/home/pi/Develop/
├── claude-bot/            # This repository - Claude Bot system
│   ├── src/
│   ├── package.json
│   ├── .env               # Configuration
│   ├── mention_tracker.db # SQLite database
│   ├── prompts/           # Custom prompt templates
│   └── logs/              # Application logs
└── target-project/        # Your project - Claude Code execution target
    ├── src/
    ├── README.md
    ├── package.json
    └── .git/              # Connected to GitHub
```

## ✨ Features

### Core Features
- **Smart Mention Detection**: Automatically detects configurable mention patterns in GitHub Issues and PRs
- **Local Project Execution**: Claude Code CLI runs in your specified target project directory
- **Configurable CLI Path**: Support for Nodenv, NVM, and custom Claude CLI installations
- **Token Optimization**: Efficient change detection using SHA256 hashing to minimize Claude Code API usage
- **SQLite Database**: Reliable tracking of processed content and mention history with automatic backups

### Monitoring & Logging
- **Comprehensive Logging**: Detailed logging with Winston for monitoring and debugging
- **Multiple Log Levels**: Configurable logging (debug, info, warn, error) with file rotation
- **Statistics Tracking**: Daily stats for checks, mentions, API calls, and token usage
- **Database Backups**: Automated daily backups with 7-day retention policy

### Scheduling & Automation
- **Cron Scheduling**: Configurable intervals for detection and backup operations
- **Graceful Error Handling**: Robust error handling and recovery mechanisms
- **Auto-response Control**: Optional automatic responses to mentions
- **Process Management**: Graceful shutdown handling and daemon mode support

### Development Features
- **Type Safety**: Full TypeScript implementation with strict typing
- **Multiple Commands**: Various Claude Code commands (start, run-once, status, setup, test-config)
- **Environment Detection**: Separate behavior for development and production modes
- **Custom Prompts**: Template-based prompt system for different mention types

## 🚀 Quick Start

### 1. Installation

```bash
# Create development directory
mkdir -p /home/pi/Develop
cd /home/pi/Develop

# Clone Claude Bot
git clone https://github.com/sotaroNishioka/claude-bot.git
cd claude-bot
npm install

# Create your target project (or clone existing)
cd ../
mkdir target-project  # or: git clone your-project.git target-project
cd target-project
git init  # if new project
```

### 2. Configuration

```bash
cd /home/pi/Develop/claude-bot
cp .env.example .env
```

Edit `.env` with your settings:

```env
# GitHub Configuration (Required)
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=your_username  
GITHUB_REPO=your_repository_name

# Claude Code Configuration (Required)
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_CLI_PATH=/usr/local/bin/claude  # or custom path
DAILY_TOKEN_LIMIT=45000

# Project Paths
TARGET_PROJECT_PATH=../target-project
CLAUDE_BOT_PATH=/home/pi/Develop/claude-bot

# Mention Detection Settings
MENTION_PATTERNS=@claude,@claude-code  # Comma-separated patterns
ENABLE_AUTO_RESPONSE=true

# Scheduling (Cron expressions)
DETECTION_INTERVAL="*/5 * * * *"  # Every 5 minutes
BACKUP_INTERVAL="0 2 * * *"       # Daily at 2 AM

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/claude-bot.log

# Database
DATABASE_PATH=./mention_tracker.db

# Environment
ENVIRONMENT=production  # or development
DEBUG=false
```

### 3. Claude CLI Path Configuration

Depending on your Node.js installation:

```bash
# Standard installation
CLAUDE_CLI_PATH=/usr/local/bin/claude

# Nodenv
CLAUDE_CLI_PATH=/home/pi/.nodenv/shims/claude

# NVM
CLAUDE_CLI_PATH=/home/pi/.nvm/versions/node/v18.19.0/bin/claude

# Custom installation
CLAUDE_CLI_PATH=/home/pi/.local/bin/claude
```

### 4. Setup and Test

```bash
npm run build
npm run setup
npm run dev -- test-config
```

### 5. Run

```bash
# Development mode
npm run dev -- start

# Production mode  
npm run build && npm start

# Single detection cycle (testing)
npm run dev -- run-once

# Daemon mode
npm run daemon
```

## 📖 Usage

### Available CLI Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `start` | Start the Claude Bot daemon | `npm run dev -- start [--daemon]` |
| `run-once` | Run a single detection cycle | `npm run dev -- run-once` |
| `status` | Show current status and statistics | `npm run dev -- status` |
| `setup` | Setup database and test connections | `npm run setup` |
| `test-config` | Test configuration and connections | `npm run dev -- test-config` |

### Mention Detection

Claude Bot automatically monitors for mentions in:

- ✅ **Issue descriptions** - When issues are created or updated
- ✅ **Issue comments** - All comments on issues
- ✅ **Pull Request descriptions** - When PRs are created or updated
- ✅ **Pull Request comments** - All comments and review comments on PRs

### Mention Patterns

Configure custom mention patterns via `MENTION_PATTERNS`:

```env
# Default patterns
MENTION_PATTERNS=@claude,@claude-code

# Custom patterns
MENTION_PATTERNS=@ai,@assistant,@bot

# Single pattern
MENTION_PATTERNS=@claude
```

### Prompt Templates

Create custom prompt templates in the `prompts/` directory:

- `issue.txt` - Template for issue mentions
- `issue_comment.txt` - Template for issue comment mentions
- `pr.txt` - Template for pull request mentions
- `pr_comment.txt` - Template for PR comment mentions

Template example (`prompts/issue.txt`):
```
You are helping with a GitHub issue. Please analyze and respond to the following request:

{{USER_REQUEST}}

Execute appropriate Claude Code commands to address this issue in the target project.
```

### Example Mentions

```
@claude implement this authentication feature with JWT tokens and proper error handling

@claude-code review this PR, especially looking at memory usage and potential security vulnerabilities

@claude analyze the current database schema and suggest performance improvements
```

**Important**: Claude Code will execute in your `target-project` directory, making actual changes to your local files.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | - | ✅ |
| `GITHUB_OWNER` | Repository owner username | - | ✅ |
| `GITHUB_REPO` | Repository name | - | ✅ |
| `CLAUDE_API_KEY` | Claude API key for Claude Code | - | ✅ |
| `CLAUDE_CLI_PATH` | Path to Claude CLI executable | `claude` | ❌ |
| `TARGET_PROJECT_PATH` | Path to target project directory | `../target-project` | ❌ |
| `CLAUDE_BOT_PATH` | Path to Claude Bot directory | `current directory` | ❌ |
| `DAILY_TOKEN_LIMIT` | Maximum Claude tokens per day | `45000` | ❌ |
| `MENTION_PATTERNS` | Comma-separated mention patterns | `@claude,@claude-code` | ❌ |
| `ENABLE_AUTO_RESPONSE` | Enable automatic responses | `false` | ❌ |
| `DETECTION_INTERVAL` | Cron expression for mention detection | `*/5 * * * *` | ❌ |
| `BACKUP_INTERVAL` | Cron expression for database backup | `0 2 * * *` | ❌ |
| `LOG_LEVEL` | Logging level | `info` | ❌ |
| `LOG_FILE` | Log file path | `./logs/claude-bot.log` | ❌ |
| `DATABASE_PATH` | SQLite database file path | `./mention_tracker.db` | ❌ |
| `ENVIRONMENT` | Environment mode | `production` | ❌ |
| `DEBUG` | Enable debug mode | `false` | ❌ |
| `PROMPTS_DIR` | Custom prompts directory | `./prompts` | ❌ |

### GitHub Token Permissions

Required permissions for GitHub Personal Access Token:
- `repo` (Full repository access) - For reading issues/PRs and posting comments
- `read:org` (Read organization membership) - For organization repositories

### Claude Code CLI Arguments

The bot executes Claude Code with these arguments:
- `--output-format stream-json` - Structured output format
- `--print` - Print output to stdout
- `--dangerously-skip-permissions` - Skip permission prompts
- `--verbose` - Detailed logging

Timeout: 5 minutes per execution

## 📊 Database Schema

### Tables

**tracked_items** - Content change tracking
- `id` (PRIMARY KEY)
- `item_type` (issue, pr, issue_comment, pr_comment)
- `item_id` (GitHub item ID)
- `parent_id` (Issue/PR number for comments)
- `content_hash` (SHA256 of content)
- `has_mention` (Boolean)
- `last_checked`, `created_at`, `updated_at`

**mention_history** - Mention processing log
- `id` (PRIMARY KEY)
- `item_type`, `item_id`, `parent_id`
- `user_login` (GitHub username)
- `mention_content` (Full content with mention)
- `detected_at`, `processed`, `processed_at`

**processing_stats** - Daily statistics
- `date` (PRIMARY KEY)
- `total_checks`, `new_mentions`, `processed_mentions`
- `api_calls`, `tokens_used`

## 📳 Deployment Options

### Raspberry Pi (Recommended)

Perfect for always-on monitoring with minimal resource usage:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Claude CLI
curl -fsSL https://claude.ai/cli/install.sh | sh
claude auth login

# Setup as systemd service
sudo cp deployment/claude-bot.service /etc/systemd/system/
sudo systemctl enable claude-bot
sudo systemctl start claude-bot
```

### PM2 (Process Manager)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

The PM2 configuration includes:
- Memory limit: 1GB with auto-restart
- Log files: `./logs/pm2-*.log`
- Production environment variables

### Manual Daemon Mode

```bash
npm run build
nohup npm start > /dev/null 2>&1 &
```

## 📊 Monitoring

### Status Check

```bash
npm run dev -- status
```

Output example:
```json
{
  "isRunning": true,
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
    "mentionPatterns": ["@claude", "@claude-code"]
  }
}
```

### Logs

```bash
# View real-time logs
tail -f ./logs/claude-bot.log

# View error logs only
tail -f ./logs/claude-bot-error.log

# View exception logs
tail -f ./logs/claude-bot-exceptions.log

# View PM2 logs (if using PM2)
tail -f ./logs/pm2-combined.log

# View today's mention activity
grep "mention detected" ./logs/claude-bot.log | grep $(date +%Y-%m-%d)
```

### Log Rotation

Automatic log rotation is configured:
- Main log: 10MB max, 5 files retained
- Error log: 10MB max, 3 files retained
- Exception log: Unlimited size

## 🎯 Token Optimization

Claude Bot is designed for efficient token usage:

### Smart Processing
- **Change Detection**: Only processes content that has actually changed (SHA256 comparison)
- **Content Hashing**: Prevents duplicate processing of same content
- **Daily Limits**: Configurable token budgets with automatic enforcement
- **Sequential Processing**: 2-second delays between mentions to respect rate limits

### Database Efficiency
- **Incremental Checks**: Only fetches GitHub data since last check time
- **Mention Tracking**: Tracks processing status to avoid duplicate work
- **Backup Management**: Automated daily backups with 7-day cleanup

### Token Usage Estimates

| Action Type | Estimated Tokens | Notes |
|-------------|------------------|-------|
| Simple mention | 1000-3000 | Basic requests and responses |
| Code implementation | 3000-8000 | Code generation and file modifications |
| Code review | 1500-3000 | Analysis and feedback |
| Architecture analysis | 2000-4000 | Complex reasoning tasks |

## 🔍 Troubleshooting

### Common Issues

1. **Claude CLI not found**:
   ```bash
   # Test Claude CLI path
   npm run dev -- test-config
   
   # Check if Claude CLI is installed
   which claude
   
   # Update CLAUDE_CLI_PATH in .env
   CLAUDE_CLI_PATH=/full/path/to/claude
   ```

2. **Target project not found**:
   ```bash
   # Verify target project exists
   ls -la $TARGET_PROJECT_PATH
   
   # Check configuration
   npm run dev -- test-config
   ```

3. **Permission issues**:
   ```bash
   # Ensure write permissions to target project
   chmod 755 ../target-project
   
   # Check if target project is a git repository
   cd ../target-project && git status
   ```

4. **Database issues**:
   ```bash
   # Reset database
   rm mention_tracker.db
   npm run setup
   ```

5. **GitHub API rate limiting**:
   - Default: 5000 requests/hour for authenticated requests
   - The bot uses 1 API call per detection cycle
   - With 5-minute intervals: 12 calls/hour (well within limits)

### Debug Mode

```bash
# Enable debug logging
DEBUG=true LOG_LEVEL=debug npm run dev -- start

# Test single cycle with debug
DEBUG=true LOG_LEVEL=debug npm run dev -- run-once
```

### Error Responses

The bot provides detailed error messages in GitHub comments:

```
❌ @username Error message here

**Debug Info:**
- Target Project: `/path/to/target-project`
- Claude CLI: `/path/to/claude`
```

Success responses:

```
✅ @username Claude Code execution completed.

**Target Project:** `/path/to/target-project`
```

## 🔒 Security Considerations

- **API Keys**: Store in `.env` file, never commit to git
- **File System**: Claude Code has full access to target project directory
- **GitHub Permissions**: Bot can read all repository content and post comments
- **Process Isolation**: Claude CLI runs in target project directory with inherited environment

## 📚 Documentation

- [Setup Guide](./docs/SETUP.md) - Detailed installation and configuration
- [API Reference](./docs/API.md) - Complete API documentation
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and solutions

## 🤝 Support

- 📖 Check the [documentation](./docs/)
- 🐛 Report issues on [GitHub Issues](https://github.com/sotaroNishioka/claude-bot/issues)
- 💬 Ask questions in [GitHub Discussions](https://github.com/sotaroNishioka/claude-bot/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Claude Code](https://claude.ai/code) - AI-powered development automation
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
- [Winston](https://github.com/winstonjs/winston) - Logging library
- [node-cron](https://github.com/node-cron/node-cron) - Task scheduling
- [SQLite](https://www.sqlite.org/) - Embedded database

---

**Made with ❤️ for efficient Claude Code automation on Raspberry Pi**