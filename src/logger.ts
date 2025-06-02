import winston from 'winston';
import { config } from './config';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

// ログディレクトリを作成
const logDir = dirname(config.logging.file);
mkdir(logDir, { recursive: true }).catch(console.error);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'claude-bot' },
  transports: [
    // ファイル出力
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // エラーレベルは別ファイル
    new winston.transports.File({
      filename: config.logging.file.replace('.log', '-error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 3,
    }),
  ],
});

// 開発環境またはデバッグモードではコンソール出力も追加
if (config.system.environment === 'development' || config.system.debug) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      ),
    })
  );
}

// ハンドルされていない例外をキャッチ
logger.exceptions.handle(
  new winston.transports.File({
    filename: config.logging.file.replace('.log', '-exceptions.log'),
  })
);

// プロセス終了時の処理
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

export default logger;