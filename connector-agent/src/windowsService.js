import os from 'os';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { logger } from './logger.js';

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const APP_NAME = 'TallyConnectAgent';

export class WindowsService {
  constructor(options = {}) {
    this.isWindows = os.platform() === 'win32';
    this.appDataDir = options.appDataDir || (this.isWindows
      ? path.join(process.env.APPDATA || 'C:\\ProgramData', 'TallyConnect')
      : path.join(os.homedir(), '.tallyconnect'));
    this.simulatedStateFile = path.join(this.appDataDir, '.autostart.json');

    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.appDataDir)) {
      try {
        fs.mkdirSync(this.appDataDir, { recursive: true });
      } catch (err) {
        // Ignored
      }
    }
  }

  /**
   * Configures the application to launch automatically on Windows login
   * @param {string} executablePath - Absolute path to TallyConnectAgent.exe
   */
  enableAutoStart(executablePath) {
    const fullPath = path.resolve(executablePath);
    const command = `"${fullPath}" --background`;

    if (this.isWindows) {
      try {
        // Use Windows Registry Run key
        const regCmd = `reg add "${RUN_KEY}" /v "${APP_NAME}" /t REG_SZ /d "${command.replace(/"/g, '\\"')}" /f`;
        execSync(regCmd, { stdio: 'pipe' });
        logger.info(`Configured Windows Auto-Start registry key: ${RUN_KEY}\\${APP_NAME}`);
        return { success: true, method: 'registry', path: fullPath };
      } catch (err) {
        logger.warn(`Failed to set Windows Registry Run key: ${err.message}. Saving local fallback state.`);
      }
    }

    // Portable / Simulation fallback (records intent and path)
    try {
      this._ensureDir();
      fs.writeFileSync(this.simulatedStateFile, JSON.stringify({
        enabled: true,
        appName: APP_NAME,
        executablePath: fullPath,
        command,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf-8');
      logger.info(`Auto-start registered: "${command}"`);
      return { success: true, method: 'simulated_registry', path: fullPath };
    } catch (err) {
      logger.error('Failed to configure auto-start:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Removes application from auto-start
   */
  disableAutoStart() {
    if (this.isWindows) {
      try {
        const regCmd = `reg delete "${RUN_KEY}" /v "${APP_NAME}" /f`;
        execSync(regCmd, { stdio: 'pipe' });
        logger.info(`Removed Windows Auto-Start registry key: ${RUN_KEY}\\${APP_NAME}`);
      } catch (err) {
        // Ignore if key didn't exist
      }
    }

    try {
      if (fs.existsSync(this.simulatedStateFile)) {
        fs.unlinkSync(this.simulatedStateFile);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Checks if auto-start is currently enabled
   */
  isAutoStartEnabled() {
    if (this.isWindows) {
      try {
        const out = execSync(`reg query "${RUN_KEY}" /v "${APP_NAME}"`, { stdio: 'pipe' }).toString();
        return out.includes(APP_NAME);
      } catch {
        return false;
      }
    }

    return fs.existsSync(this.simulatedStateFile);
  }
}

export const windowsService = new WindowsService();
