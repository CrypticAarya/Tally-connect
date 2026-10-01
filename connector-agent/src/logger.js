import fs from 'fs';
import path from 'path';

export class Logger {
  constructor(options = {}) {
    this.logsDir = options.logsDir || path.resolve(process.cwd(), 'logs');
    this.agentLogPath = path.join(this.logsDir, 'agent.log');
    this.errorLogPath = path.join(this.logsDir, 'errors.log');
    this.consoleOutput = options.consoleOutput !== false;

    this._ensureDir();
  }

  setLogsDir(dir) {
    this.logsDir = path.resolve(dir);
    this.agentLogPath = path.join(this.logsDir, 'agent.log');
    this.errorLogPath = path.join(this.logsDir, 'errors.log');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.logsDir)) {
      try {
        fs.mkdirSync(this.logsDir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create logs directory at ${this.logsDir}:`, err.message);
      }
    }
  }

  _format(level, message, meta = null) {
    const timestamp = new Date().toISOString();
    let text = `[${timestamp}] [${level}] ${message}`;
    if (meta) {
      if (meta instanceof Error) {
        text += `\n${meta.stack || meta.message}`;
      } else if (typeof meta === 'object') {
        text += ` ${JSON.stringify(meta)}`;
      } else {
        text += ` ${meta}`;
      }
    }
    return text + '\n';
  }

  _appendFile(filePath, content) {
    try {
      this._ensureDir();
      fs.appendFileSync(filePath, content, 'utf-8');
    } catch (err) {
      // Fallback to console if file write fails
      console.error(`Log write error: ${err.message}`);
    }
  }

  info(message, meta = null) {
    const formatted = this._format('INFO', message, meta);
    this._appendFile(this.agentLogPath, formatted);
    if (this.consoleOutput) {
      console.log(`[INFO] ${message}`);
    }
  }

  warn(message, meta = null) {
    const formatted = this._format('WARN', message, meta);
    this._appendFile(this.agentLogPath, formatted);
    this._appendFile(this.errorLogPath, formatted);
    if (this.consoleOutput) {
      console.warn(`[WARN] ⚠ ${message}`);
    }
  }

  error(message, meta = null) {
    const formatted = this._format('ERROR', message, meta);
    this._appendFile(this.agentLogPath, formatted);
    this._appendFile(this.errorLogPath, formatted);
    if (this.consoleOutput) {
      console.error(`[ERROR] ✖ ${message}`);
      if (meta && meta.stack) {
        console.error(meta.stack);
      }
    }
  }

  job(jobId, message) {
    const formatted = this._format('JOB', `[Job ${jobId}] ${message}`);
    this._appendFile(this.agentLogPath, formatted);
    if (this.consoleOutput) {
      console.log(`[JOB] [${jobId}] ${message}`);
    }
  }
}

export const logger = new Logger();
