# Claude Bot 🤖

TypeScript implementation of Claude Code mention detection and automation system for GitHub repositories.

## ✨ Features

- **Smart Mention Detection**: Automatically detects `@claude` mentions in GitHub Issues and PRs
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
git clone https://github.com/sotaroNishioka/claude-bot.git
cd claude-bot
npm install
```

### 2. Configuration

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=your_username  
GITHUB_REPO=your_repository_name
CLAUDE_API_KEY=your_claude_api_key  # Optional but recommended
DAILY_TOKEN_LIMIT=45000
DETECTION_INTERVAL="*/5 * * * *"  # Every 5 minutes
```

### 3. Setup and Test

```bash
npm run build
npm run setup
npm run dev -- test-config
```

### 4. Run

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
| `@claude implement [details]` | Implement the issue/PR | `@claude implement with error handling` |
| `@claude review [focus]` | Code review with specific focus | `@claude review security and performance` |
| `@claude analyze [aspect]` | Analyze code or requirements | `@claude analyze architecture patterns` |
| `@claude improve [area]` | Suggest improvements | `@claude improve error handling` |
| `@claude test [type]` | Generate tests | `@claude test unit tests for edge cases` |
| `@claude help` | Show help message | `@claude help` |

### Example Mentions

```
@claude implement this feature with a focus on security and performance optimization

@claude review this PR, especially looking at memory usage and potential race conditions

@claude analyze the current architecture and suggest improvements for scalability
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub API    │───▶│ Mention Detector │───▶│ Claude Processor│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ SQLite Database │    │   Claude Code   │
                       │  (Change Track) │    │      CLI        │
                       └─────────────────┘    └─────────────────┘
```

### Key Components

- **MentionDetector**: Efficiently detects changes and mentions using content hashing
- **ClaudeProcessor**: Executes Claude Code commands with token budget management
- **MentionTracker**: SQLite database for tracking content changes and mention history
- **GitHubClient**: Type-safe GitHub API wrapper with rate limiting

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | **Required** |
| `GITHUB_OWNER` | Repository owner username | **Required** |
| `GITHUB_REPO` | Repository name | **Required** |
| `CLAUDE_API_KEY` | Claude API key for Claude Code | Optional |
| `DAILY_TOKEN_LIMIT` | Maximum Claude tokens per day | `45000` |
| `DETECTION_INTERVAL` | Cron expression for mention detection | `*/5 * * * *` |
| `BACKUP_INTERVAL` | Cron expression for database backup | `0 2 * * *` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |
| `DATABASE_PATH` | SQLite database file path | `./mention_tracker.db` |

### GitHub Token Permissions

Required permissions for GitHub Personal Access Token:
- `repo` (Full repository access)
- `read:org` (Read organization membership)

## 🐳 Deployment Options

### Raspberry Pi (Recommended)

Perfect for always-on monitoring with minimal resource usage:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Setup as systemd service
sudo cp deployment/claude-bot.service /etc/systemd/system/
sudo systemctl enable claude-bot
sudo systemctl start claude-bot
```

### Docker

```bash
docker build -t claude-bot .
docker run -d --name claude-bot --env-file .env claude-bot
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
    "name": "claude-bot",
    "language": "TypeScript",
    "stars": 42
  },
  "todayStats": {
    "totalChecks": 288,
    "newMentions": 5,
    "processedMentions": 5,
    "tokensUsed": 12500
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

## 🔍 Development

### Project Structure

```
claude-bot/
├── src/
│   ├── types.ts           # TypeScript interfaces
│   ├── config.ts          # Configuration management
│   ├── logger.ts          # Winston logging setup
│   ├── database.ts        # SQLite operations
│   ├── github-client.ts   # GitHub API wrapper
│   ├── mention-detector.ts # Mention detection logic
│   ├── claude-processor.ts # Claude Code execution
│   ├── app.ts             # Main application
│   ├── main.ts            # CLI interface
│   └── setup.ts           # Setup utilities
├── docs/                  # Documentation
├── deployment/            # Deployment configs
└── logs/                  # Application logs
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Running Tests

```bash
npm test
```

### Debugging

```bash
# Enable debug logging
DEBUG=true npm run dev -- start

# Run with verbose logging
LOG_LEVEL=debug npm run dev -- start
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

**Made with ❤️ for efficient Claude Code automation**