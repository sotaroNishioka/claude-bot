import { MentionTracker } from './database';
import { GitHubClient } from './github-client';
import { logger } from './logger';
import { config } from './config';

async function setup() {
  try {
    console.log('🚀 Setting up Claude Bot...');
    
    // Initialize database
    console.log('📊 Initializing database...');
    const tracker = new MentionTracker();
    await tracker.init();
    console.log('✅ Database initialized');
    
    // Test GitHub connection
    console.log('🐙 Testing GitHub connection...');
    const github = new GitHubClient();
    const repoInfo = await github.getRepositoryInfo();
    console.log(`✅ Connected to ${repoInfo.fullName}`);
    
    // Create necessary directories
    console.log('📁 Creating directories...');
    const { mkdir } = await import('fs/promises');
    await mkdir('./logs', { recursive: true });
    await mkdir('./backups', { recursive: true });
    console.log('✅ Directories created');
    
    // Close connections
    await tracker.close();
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('\nConfiguration summary:');
    console.log(`- Repository: ${config.github.owner}/${config.github.repo}`);
    console.log(`- Detection interval: ${config.cron.detectionInterval}`);
    console.log(`- Daily token limit: ${config.claude.dailyTokenLimit}`);
    console.log(`- Mention patterns: ${config.mention.patterns.join(', ')}`);
    
    console.log('\nNext steps:');
    console.log('1. npm run start     # Start as daemon');
    console.log('2. npm run dev       # Development mode');
    console.log('3. npm run dev -- run-once  # Single run');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setup();
}

export { setup };