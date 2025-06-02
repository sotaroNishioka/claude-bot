# Claude Bot Setup Guide

## Prerequisites

- Node.js 18+ 
- npm or yarn
- GitHub repository with issues/PRs
- GitHub Personal Access Token
- Claude API key (optional, for Claude Code integration)

## Installation

1. **Clone and install:**
   ```bash
   git clone https://github.com/sotaroNishioka/claude-bot.git
   cd claude-bot
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your settings:
   ```env
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_OWNER=your_username
   GITHUB_REPO=your_repository
   CLAUDE_API_KEY=your_claude_key  # Optional
   ```

3. **Setup database and test connection:**
   ```bash
   npm run build
   npm run setup
   ```

4. **Test configuration:**
   ```bash
   npm run dev -- test-config
   ```

## GitHub Token Setup

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token with these permissions:
   - `repo` (Full repository access)
   - `read:org` (Read organization membership)

## Running the Bot

### Development Mode
```bash
npm run dev -- start
```

### Production Mode
```bash
npm run build
npm start
```

### Single Run (Testing)
```bash
npm run dev -- run-once
```

## Usage

Once running, the bot will detect `@claude` mentions in:
- Issue descriptions
- Issue comments
- PR descriptions  
- PR comments

### Available Commands

- `@claude implement [details]` - Implement the issue/PR
- `@claude review [focus]` - Code review with specific focus
- `@claude analyze [aspect]` - Analyze code or requirements
- `@claude improve [area]` - Suggest improvements
- `@claude test [type]` - Generate tests
- `@claude help` - Show help message

### Examples

```
@claude implement with security focus and error handling
@claude review performance and memory usage
@claude test unit tests for edge cases
@claude analyze the architecture and suggest improvements
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Required |
| `GITHUB_OWNER` | Repository owner | Required |
| `GITHUB_REPO` | Repository name | Required |
| `CLAUDE_API_KEY` | Claude API key | Optional |
| `DAILY_TOKEN_LIMIT` | Max tokens per day | 45000 |
| `DETECTION_INTERVAL` | Cron expression for checks | `*/5 * * * *` |
| `BACKUP_INTERVAL` | Cron expression for backups | `0 2 * * *` |
| `LOG_LEVEL` | Logging level | `info` |
| `DATABASE_PATH` | SQLite database path | `./mention_tracker.db` |

### Cron Intervals

- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes
- `0 */2 * * *` - Every 2 hours
- `0 9-17 * * 1-5` - Business hours, weekdays

## Troubleshooting

### Common Issues

1. **GitHub API rate limit:**
   - Increase detection interval
   - Check token permissions

2. **Database locked:**
   - Ensure only one instance is running
   - Check file permissions

3. **Claude Code not working:**
   - Verify `CLAUDE_API_KEY` is set
   - Check Claude Code CLI installation

### Logs

Logs are stored in `./logs/claude-bot.log`:

```bash
# View recent logs
tail -f ./logs/claude-bot.log

# View errors only
grep ERROR ./logs/claude-bot.log
```

### Status Check

```bash
npm run dev -- status
```

## Deployment

### Raspberry Pi (Recommended)

1. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone and setup:**
   ```bash
   git clone https://github.com/sotaroNishioka/claude-bot.git
   cd claude-bot
   npm install --production
   npm run build
   ```

3. **Configure as service:**
   ```bash
   sudo cp deployment/claude-bot.service /etc/systemd/system/
   sudo systemctl enable claude-bot
   sudo systemctl start claude-bot
   ```

### Using PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### Docker

```bash
docker build -t claude-bot .
docker run -d --name claude-bot --env-file .env claude-bot
```

## Monitoring

### Health Check

```bash
# Check if running
ps aux | grep claude-bot

# Check logs
tail -f ./logs/claude-bot.log

# Check database stats
npm run dev -- status
```

### Backup

Daily backups are automatic. Manual backup:

```bash
cp ./mention_tracker.db ./backups/manual-backup-$(date +%Y%m%d).db
```

## Support

For issues and questions:
- Check the [troubleshooting guide](./TROUBLESHOOTING.md)
- Review logs in `./logs/`
- Open an issue on GitHub
