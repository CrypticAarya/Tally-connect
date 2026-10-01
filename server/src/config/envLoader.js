import fs from 'fs';
import path from 'path';

/**
 * Loads .env file into process.env without requiring external dependencies
 */
export function loadEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const possiblePaths = [
    ...(isProd ? [
      path.resolve(process.cwd(), '.env.production'),
      path.resolve(process.cwd(), 'server', '.env.production')
    ] : []),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
    path.resolve(new URL('.', import.meta.url).pathname, '../../.env')
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      if (typeof process.loadEnvFile === 'function') {
        try {
          process.loadEnvFile(envPath);
          return envPath;
        } catch {}
      }

      try {
        const raw = fs.readFileSync(envPath, 'utf8');
        const lines = raw.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
        return envPath;
      } catch (err) {
        console.warn(`[EnvLoader] Notice reading ${envPath}:`, err.message);
      }
    }
  }

  return null;
}

// Auto-run on module load
loadEnv();
