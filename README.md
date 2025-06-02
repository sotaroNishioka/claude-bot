# Claude Bot 🤖

TypeScript implementation of Claude Code mention detection and automation system for GitHub repositories, designed to run on Raspberry Pi and execute Claude Code CLI on local projects.

## 🎯 Purpose

Claude Bot monitors GitHub repositories for `@claude` mentions and automatically executes Claude Code CLI commands on your local project directory. Perfect for:

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
│   └── mention_tracker.db
└── target-project/        # Your project - Claude Code execution target
    ├── src/
    ├── README.md
    ├── package.json
    └── .git/              # Connected to GitHub
```

## ✨ Features

- **Smart Mention Detection**: Automatically detects `@claude` mentions in GitHub Issues and PRs
- **Local Project Execution**: Claude Code CLI runs in your specified target project directory
- **Configurable CLI Path**: Support for Nodenv, NVM, and custom Claude CLI installations
- **Token Optimization**: Efficient change detection using SHA256 hashing to minimize Claude Code API usage
- **SQLite Database**: Reliable tracking of processed content and mention history
- **Comprehensive Logging**: Detailed logging with Winston for monitoring and debugging
- **Cron Scheduling**: Configurable intervals for detection and backup operations
- **Type Safety**: Full TypeScript implementation with strict typing

- **Multi-Command Support**: Various Claude Code commands (implement, review, analyze, etc.)
- **Graceful Error Handling**: Robust error handling and recovery mechanisms

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
# GitHub Configuration
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=your_username  
GITHUB_REPO=your_repository_name

# Claude Code Configuration
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_CLI_PATH=/usr/local/bin/claude  # or custom path
DAILY_TOKEN_LIMIT=45000

# Project Paths
TARGET_PROJECT_PATH=../target-project
CLAUDE_BOT_PATH=/home/pi/Develop/claude-bot

# Detection Settings
DETECTION_INTERVAL="*/5 * * * *"  # Every 5 minutes
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
```

## 📖 Usage

Once running, Claude Bot will automatically detect `@claude` mentions in:

- ✅ Issue descriptions
- ✅ Issue comments  
- ✅ Pull Request descriptions
- ✅ Pull Request comments

### Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `@claude implement [details]` | Implement the issue/PR in target project | `@claude implement with error handling` |
| `@claude review [focus]` | Code review with specific focus | `@claude review security and performance` |
| `@claude analyze [aspect]` | Analyze code or requirements | `@claude analyze architecture patterns` |
| `@claude improve [area]` | Suggest improvements | `@claude improve error handling` |
| `@claude test [type]` | Generate tests | `@claude test unit tests for edge cases` |
| `@claude help` | Show help message | `@claude help` |

### Example Mentions

```
@claude implement this authentication feature with JWT tokens and proper error handling

@claude review this PR, especially looking at memory usage and potential security vulnerabilities

@claude analyze the current database schema and suggest performance improvements
```

**Important**: Claude Code will execute in your `target-project` directory, making actual changes to your local files.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | **Required** |
| `GITHUB_OWNER` | Repository owner username | **Required** |
| `GITHUB_REPO` | Repository name | **Required** |
| `CLAUDE_API_KEY` | Claude API key for Claude Code | **Required** |
| `CLAUDE_CLI_PATH` | Path to Claude CLI executable | `claude` |
| `TARGET_PROJECT_PATH` | Path to target project directory | `../target-project` |
| `CLAUDE_BOT_PATH` | Path to Claude Bot directory | `current directory` |
| `DAILY_TOKEN_LIMIT` | Maximum Claude tokens per day | `45000` |
| `DETECTION_INTERVAL` | Cron expression for mention detection | `*/5 * * * *` |
| `BACKUP_INTERVAL` | Cron expression for database backup | `0 2 * * *` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |
| `DATABASE_PATH` | SQLite database file path | `./mention_tracker.db` |

### GitHub Token Permissions

Required permissions for GitHub Personal Access Token:
- `repo` (Full repository access)
- `read:org` (Read organization membership)

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
    "language": "TypeScript",
    "stars": 42
  },
  "todayStats": {
    "totalChecks": 288,
    "newMentions": 5,
    "processedMentions": 5,
    "tokensUsed": 12500
  },
  "configuration": {
    "targetProject": "/home/pi/Develop/target-project",
    "claudeCli": "/home/pi/.nodenv/shims/claude"
  }
}
```

### Logs

```bash
# View real-time logs
tail -f ./logs/claude-bot.log

# View error logs only
grep ERROR ./logs/claude-bot.log

# View today's mention activity
grep "mention detected" ./logs/claude-bot.log | grep $(date +%Y-%m-%d)
```

## 🎯 Token Optimization

Claude Bot is designed for efficient token usage:

- **Change Detection**: Only processes content that has actually changed
- **Content Hashing**: SHA256 comparison prevents duplicate processing  
- **Daily Limits**: Configurable token budgets with automatic enforcement
- **Smart Scheduling**: Non-critical tasks run during low-usage hours

### Token Usage Estimates

| Action | Estimated Tokens | Description |
|--------|------------------|-------------|
| `implement` | 3000-8000 | Code generation and PR creation |
| `review` | 1500-3000 | Code analysis and feedback |
| `analyze` | 1000-2000 | Requirements and architecture analysis |
| `improve` | 2000-2500 | Optimization suggestions |
| `test` | 1500-2000 | Test generation |
| `help` | 0 | Static response |

## 🔍 Troubleshooting

### Common Issues

1. **Claude CLI not found**:
   ```bash
   # Check if Claude CLI is installed
   which claude
   
   # Update CLAUDE_CLI_PATH in .env
   CLAUDE_CLI_PATH=/full/path/to/claude
   ```

2. **Target project not found**:
   ```bash
   # Verify target project exists
   ls -la ../target-project
   
   # Update TARGET_PROJECT_PATH in .env
   TARGET_PROJECT_PATH=/full/path/to/target-project
   ```

3. **Permission issues**:
   ```bash
   # Ensure write permissions to target project
   chmod 755 ../target-project
   
   # Check if target project is a git repository
   cd ../target-project && git status
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=true LOG_LEVEL=debug npm run dev -- start
```

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

---

**Made with ❤️ for efficient Claude Code automation on Raspberry Pi**