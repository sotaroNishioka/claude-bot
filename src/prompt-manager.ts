import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { resolvedPaths } from './config';
import { logger } from './logger';

export class PromptManager {
  /**
   * メンションタイプに応じたプロンプトファイル名を取得
   */
  getPromptFileForMentionType(mentionType: 'issue' | 'issue_comment' | 'pr' | 'pr_comment'): string {
    return `${mentionType}.txt`;
  }

  /**
   * プロンプトファイルを読み込み、変数を置換
   */
  loadAndProcessPrompt(promptFile: string, userRequest: string): string {
    const promptPath = resolve(resolvedPaths.prompts, promptFile);
    
    if (!existsSync(promptPath)) {
      logger.warn(`Prompt file not found: ${promptFile}, using direct content`);
      return userRequest;
    }

    try {
      const template = readFileSync(promptPath, 'utf-8');
      return template.replace(/{{USER_REQUEST}}/g, userRequest);
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