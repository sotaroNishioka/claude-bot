import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolvedPaths } from './config';
import { logger } from './logger';

export class PromptManager {
  /**
   * メンションタイプに応じたプロンプトファイル名を取得
   */
  getPromptFileForMentionType(
    mentionType: 'issue' | 'issue_comment' | 'pr' | 'pr_comment'
  ): string {
    return `${mentionType}.txt`;
  }

  /**
   * プロンプトファイルを読み込み、変数を置換
   */
  loadAndProcessPrompt(
    promptFile: string, 
    userRequest: string, 
    contextUrl?: string, 
    contextTitle?: string,
    userName?: string
  ): string {
    const promptPath = resolve(resolvedPaths.prompts, promptFile);

    if (!existsSync(promptPath)) {
      logger.warn(`Prompt file not found: ${promptFile}, using direct content`);
      return userRequest;
    }

    try {
      const template = readFileSync(promptPath, 'utf-8');
      
      // 全ての変数を置換
      let processedPrompt = template
        .replace(/{{USER_REQUEST}}/g, userRequest)
        .replace(/{{CONTEXT_URL}}/g, contextUrl || '')
        .replace(/{{CONTEXT_TITLE}}/g, contextTitle || '')
        .replace(/{{USER_NAME}}/g, userName || '')
        .replace(/{{REPOSITORY}}/g, `${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}` || '');
      
      return processedPrompt;
    } catch (error) {
      logger.error('Failed to load prompt', { promptFile, error });
      return userRequest;
    }
  }

  /**
   * プロンプトファイルが存在するかチェック
   */
  promptExists(promptFile: string): boolean {
    const promptPath = resolve(resolvedPaths.prompts, promptFile);
    return existsSync(promptPath);
  }
}
