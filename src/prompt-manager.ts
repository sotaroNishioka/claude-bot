import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PromptTemplate } from './types';
import { config, resolvedPaths } from './config';
import { logger } from './logger';

export class PromptManager {
  private promptCache: Map<string, PromptTemplate> = new Map();

  /**
   * メンションタイプに応じたプロンプトファイルを取得
   */
  getPromptFileForMentionType(mentionType: 'issue' | 'issue_comment' | 'pr' | 'pr_comment'): string {
    switch (mentionType) {
      case 'issue':
        return config.prompts.issueMention;
      case 'issue_comment':
        return config.prompts.issueComment;
      case 'pr':
        return config.prompts.prMention;
      case 'pr_comment':
        return config.prompts.prComment;
      default:
        return config.prompts.issueMention;
    }
  }

  /**
   * プロンプトファイルを読み込み、テンプレート変数を解析
   */
  loadPrompt(promptFile: string): PromptTemplate {
    // キャッシュチェック
    if (this.promptCache.has(promptFile)) {
      return this.promptCache.get(promptFile)!;
    }

    const promptPath = resolve(resolvedPaths.prompts, promptFile);

    if (!existsSync(promptPath)) {
      throw new Error(`Prompt file not found: ${promptPath}`);
    }

    try {
      const content = readFileSync(promptPath, 'utf-8');
      const variables = this.extractVariables(content);
      
      const template: PromptTemplate = {
        content,
        variables,
      };
      
      // キャッシュに保存
      this.promptCache.set(promptFile, template);
      
      logger.debug('Prompt loaded', { promptFile, promptPath, variables });
      
      return template;
    } catch (error) {
      logger.error('Failed to load prompt', { promptFile, promptPath, error });
      throw error;
    }
  }

  /**
   * プロンプトテンプレートの変数を実際の値で置換
   */
  processPrompt(template: PromptTemplate, variables: Record<string, string>): string {
    let processedContent = template.content;
    
    // {{VARIABLE}} 形式の変数を置換
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(pattern, value);
    }
    
    // 未置換の変数があるかチェック
    const unreplacedVars = processedContent.match(/{{\w+}}/g);
    if (unreplacedVars) {
      logger.warn('Unreplaced variables found in prompt', { unreplacedVars });
    }
    
    return processedContent;
  }

  /**
   * プロンプトテンプレート内の変数を抽出
   */
  private extractVariables(content: string): string[] {
    const matches = content.match(/{{(\w+)}}/g);
    if (!matches) {
      return [];
    }
    
    return Array.from(new Set(matches.map(match => match.replace(/[{}]/g, ''))));
  }

  /**
   * 利用可能なプロンプトファイル一覧を取得
   */
  getAvailablePrompts(): string[] {
    try {
      const fs = require('fs');
      const files = fs.readdirSync(resolvedPaths.prompts);
      return files.filter((file: string) => file.endsWith('.txt'));
    } catch (error) {
      logger.error('Failed to read prompts directory', { error });
      return [];
    }
  }

  /**
   * プロンプトファイルが存在するかチェック
   */
  promptExists(promptFile: string): boolean {
    const promptPath = resolve(resolvedPaths.prompts, promptFile);
    return existsSync(promptPath);
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.promptCache.clear();
    logger.debug('Prompt cache cleared');
  }
}