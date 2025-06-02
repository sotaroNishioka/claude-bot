# Troubleshooting Guide

## Common Issues

### 1. GitHub Token Issues

#### Symptoms
- `401 Unauthorized` errors in logs
- `Bad credentials` error messages
- No mentions detected despite existing mentions

#### Solutions
1. **Check token validity:**
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
   ```

2. **Verify token permissions:**
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Ensure `repo` and `read:org` scopes are enabled
   - For private repositories, ensure token has access

3. **Update token in environment:**
   ```bash
   # In .env file
   GITHUB_TOKEN=ghp_your_new_token_here
   ```

### 2. Database Issues

#### Symptoms
- `SQLITE_BUSY` or `database is locked` errors
- Database file corruption
- Permission denied errors

#### Solutions
1. **Database locked:**
   ```bash
   # Stop all instances
   pkill -f claude-bot
   
   # Check for remaining processes
   ps aux | grep claude-bot
   
   # Restart single instance
   npm run dev -- start
   ```

2. **File permissions:**
   ```bash
   # Fix database permissions
   chmod 644 mention_tracker.db
   chown $USER:$USER mention_tracker.db
   
   # Fix directory permissions
   chmod 755 .
   ```

3. **Database corruption:**
   ```bash
   # Backup current database
   cp mention_tracker.db mention_tracker.db.backup
   
   # Check integrity
   sqlite3 mention_tracker.db "PRAGMA integrity_check;"
   
   # If corrupted, restore from backup
   cp ./backups/mention_tracker_LATEST.db mention_tracker.db
   ```

### 3. Claude Code Issues

#### Symptoms
- `Claude Code is currently unavailable` messages
- Command timeouts
- `claude: command not found` errors

#### Solutions
1. **Install Claude Code CLI:**
   ```bash
   # Follow official installation guide
   curl -fsSL https://claude.ai/cli/install.sh | sh
   
   # Verify installation
   claude --version
   ```

2. **Authenticate Claude Code:**
   ```bash
   claude auth login
   # Follow browser authentication flow
   ```

3. **Check API key:**
   ```bash
   # In .env file
   CLAUDE_API_KEY=your_actual_api_key
   
   # Test configuration
   npm run dev -- test-config
   ```

### 4. Token Limit Issues

#### Symptoms
- `Daily token limit reached` messages
- No Claude Code execution despite mentions
- High token usage warnings

#### Solutions
1. **Increase daily limit:**
   ```bash
   # In .env file
   DAILY_TOKEN_LIMIT=60000  # Increase if you have higher plan
   ```

2. **Check current usage:**
   ```bash
   npm run dev -- status
   # Look at tokensUsed in output
   ```

3. **Optimize token usage:**
   - Increase detection interval to reduce API calls
   - Use more specific mention patterns
   - Schedule heavy operations during low-usage hours

### 5. Network and Connectivity

#### Symptoms
- `ENOTFOUND` or `ECONNREFUSED` errors
- Timeout errors
- Intermittent failures

#### Solutions
1. **Check internet connectivity:**
   ```bash
   ping github.com
   curl -I https://api.github.com
   ```

2. **Configure proxy if needed:**
   ```bash
   # In .env file
   HTTP_PROXY=http://proxy.company.com:8080
   HTTPS_PROXY=http://proxy.company.com:8080
   ```

3. **Verify firewall settings:**
   - Ensure outbound HTTPS (443) is allowed
   - Check if your network blocks GitHub API

### 6. Memory and Performance Issues

#### Symptoms
- High memory usage
- Slow processing
- Process crashes

#### Solutions
1. **Monitor resource usage:**
   ```bash
   # Check memory usage
   ps aux | grep claude-bot
   
   # Monitor in real-time
   top -p $(pgrep -f claude-bot)
   ```

2. **Optimize settings:**
   ```bash
   # Increase detection interval
   DETECTION_INTERVAL="*/15 * * * *"  # Every 15 minutes
   
   # Reduce backup frequency
   BACKUP_INTERVAL="0 3 * * 1"  # Weekly instead of daily
   ```

3. **Restart service:**
   ```bash
   # For systemd
   sudo systemctl restart claude-bot
   
   # For PM2
   pm2 restart claude-bot
   ```

## Diagnostic Commands

### System Status
```bash
# Check if service is running
sudo systemctl status claude-bot

# Check PM2 status
pm2 status

# Check process
ps aux | grep claude-bot
```

### Log Analysis
```bash
# View recent logs
tail -50 ./logs/claude-bot.log

# Search for errors
grep -i error ./logs/claude-bot.log | tail -10

# Check mentions today
grep "mention detected" ./logs/claude-bot.log | grep $(date +%Y-%m-%d)

# Check token usage
grep "Token used" ./logs/claude-bot.log | tail -10
```

### Configuration Validation
```bash
# Test all configurations
npm run dev -- test-config

# Check environment variables
env | grep -E "GITHUB|CLAUDE|DATABASE"

# Validate cron expressions
node -e "console.log(require('node-cron').validate('*/5 * * * *'))"
```

### Database Queries
```bash
# Connect to database
sqlite3 mention_tracker.db

# Check recent mentions
SELECT * FROM mention_history ORDER BY detected_at DESC LIMIT 10;

# Check daily stats
SELECT * FROM processing_stats ORDER BY date DESC LIMIT 7;

# Check tracked items count
SELECT item_type, COUNT(*) FROM tracked_items GROUP BY item_type;
```

## Performance Optimization

### Reducing API Calls
1. **Increase detection interval:**
   ```bash
   DETECTION_INTERVAL="*/10 * * * *"  # Every 10 minutes
   ```

2. **Use more specific mention patterns:**
   ```bash
   MENTION_PATTERNS="@claude-urgent,@claude-implement"  # More specific
   ```

### Memory Optimization
1. **Limit log file size:**
   ```bash
   # Logs are automatically rotated, but you can clean old ones
   find ./logs -name "*.log" -mtime +30 -delete
   ```

2. **Clean old database records:**
   ```sql
   -- Remove old processed mentions (older than 90 days)
   DELETE FROM mention_history 
   WHERE processed = 1 AND detected_at < datetime('now', '-90 days');
   
   -- Vacuum database
   VACUUM;
   ```

## Getting Help

### Debug Mode
Enable detailed logging for troubleshooting:

```bash
# Enable debug logging
DEBUG=true LOG_LEVEL=debug npm run dev -- start
```

### Collecting Diagnostic Information
When reporting issues, include:

1. **System information:**
   ```bash
   node --version
   npm --version
   cat /etc/os-release  # On Linux
   ```

2. **Configuration (redacted):**
   ```bash
   # Show config without sensitive data
   env | grep -E "GITHUB_OWNER|GITHUB_REPO|DETECTION_INTERVAL" 
   ```

3. **Recent logs:**
   ```bash
   tail -100 ./logs/claude-bot.log
   ```

4. **Error details:**
   - Exact error message
   - Steps to reproduce
   - Expected vs actual behavior

### Support Channels
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/sotaroNishioka/claude-bot/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/sotaroNishioka/claude-bot/discussions)
- 📖 **Documentation**: [Setup Guide](./SETUP.md) and [API Reference](./API.md)

## Prevention Tips

1. **Regular maintenance:**
   - Monitor logs weekly
   - Check token usage regularly
   - Update dependencies monthly

2. **Backup strategy:**
   - Database backups are automatic
   - Test restore procedure occasionally
   - Keep configuration files in version control

3. **Monitoring:**
   - Set up alerts for high error rates
   - Monitor disk space for logs and database
   - Track token usage trends

4. **Security:**
   - Rotate GitHub tokens periodically
   - Keep Claude API key secure
   - Review repository access regularly
