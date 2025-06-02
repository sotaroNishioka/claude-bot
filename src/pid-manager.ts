import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { logger } from './logger';

export class PidManager {
  private static readonly PID_FILE = join(process.cwd(), 'claude-bot.pid');

  /**
   * PIDファイルを作成し、現在のプロセスIDを保存
   */
  static async writePidFile(): Promise<void> {
    try {
      const pid = process.pid.toString();
      await fs.writeFile(this.PID_FILE, pid, 'utf8');
      logger.info('PIDファイルを作成しました', { pid, file: this.PID_FILE });
    } catch (error) {
      logger.error('PIDファイルの作成に失敗しました', { error });
      throw error;
    }
  }

  /**
   * PIDファイルからプロセスIDを読み取り
   */
  static async readPidFile(): Promise<number | null> {
    try {
      const pidString = await fs.readFile(this.PID_FILE, 'utf8');
      const pid = parseInt(pidString.trim(), 10);
      
      if (isNaN(pid)) {
        logger.warn('PIDファイルに無効なPIDが含まれています', { content: pidString });
        return null;
      }
      
      return pid;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // PIDファイルが存在しない（正常な状態）
        return null;
      }
      logger.error('PIDファイルの読み取りに失敗しました', { error });
      throw error;
    }
  }

  /**
   * PIDファイルを削除
   */
  static async removePidFile(): Promise<void> {
    try {
      await fs.unlink(this.PID_FILE);
      logger.info('PIDファイルを削除しました', { file: this.PID_FILE });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('PIDファイルの削除に失敗しました', { error });
      }
    }
  }

  /**
   * 指定されたPIDのプロセスが実行中かチェック
   */
  static isProcessRunning(pid: number): boolean {
    try {
      // signal 0は実際にシグナルを送信せず、プロセスの存在チェックのみ
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * デーモンプロセスの状態を取得
   */
  static async getDaemonStatus(): Promise<{
    isRunning: boolean;
    pid: number | null;
    pidFile: string;
    processExists: boolean;
  }> {
    const pid = await this.readPidFile();
    const processExists = pid ? this.isProcessRunning(pid) : false;
    
    return {
      isRunning: processExists,
      pid,
      pidFile: this.PID_FILE,
      processExists
    };
  }

  /**
   * デーモンプロセスに停止シグナルを送信
   */
  static async stopDaemon(): Promise<boolean> {
    const pid = await this.readPidFile();
    
    if (!pid) {
      logger.info('PIDファイルが見つかりません。デーモンは実行されていません。');
      return false;
    }

    if (!this.isProcessRunning(pid)) {
      logger.warn('PIDファイルは存在しますが、プロセスが見つかりません', { pid });
      // 古いPIDファイルを削除
      await this.removePidFile();
      return false;
    }

    try {
      logger.info('デーモンプロセスに停止シグナルを送信中...', { pid });
      
      // SIGTERM シグナルを送信（優雅な停止）
      process.kill(pid, 'SIGTERM');
      
      // プロセスが停止するまで最大10秒待機
      const maxWaitTime = 10000;
      const checkInterval = 500;
      let elapsed = 0;
      
      while (elapsed < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
        
        if (!this.isProcessRunning(pid)) {
          logger.info('デーモンプロセスが正常に停止しました', { pid });
          await this.removePidFile();
          return true;
        }
      }
      
      // 優雅な停止に失敗した場合、強制終了
      logger.warn('優雅な停止に失敗しました。強制終了を試行します...', { pid });
      process.kill(pid, 'SIGKILL');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.isProcessRunning(pid)) {
        logger.info('デーモンプロセスが強制終了されました', { pid });
        await this.removePidFile();
        return true;
      } else {
        logger.error('デーモンプロセスの停止に失敗しました', { pid });
        return false;
      }
      
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
        logger.info('プロセスは既に終了しています', { pid });
        await this.removePidFile();
        return true;
      } else if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        logger.error('プロセスを停止する権限がありません', { pid });
        return false;
      } else {
        logger.error('プロセス停止中にエラーが発生しました', { error, pid });
        return false;
      }
    }
  }
}