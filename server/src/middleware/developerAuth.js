import crypto from 'crypto';
import { pool } from '../db/mysql.js';
import { config } from '../config.js';
import { SaasRepository } from '../db/saasRepository.js';

/**
 * Issues a cryptographically signed developer token
 */
export function generateDeveloperToken(developer) {
  const payload = {
    developerId: developer.id,
    email: developer.email,
    name: developer.name,
    iat: Date.now(),
    exp: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  };
  const secret = config.secrets?.jwtSecret || 'tc_jwt_secret_dev_key';
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('hex');
  return `dev_tok_${encodedPayload}.${signature}`;
}

/**
 * Verifies developer token and retrieves developer profile from MySQL
 */
export async function verifyDeveloperToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  
  let raw = tokenStr.trim();
  if (raw.startsWith('Bearer ')) {
    raw = raw.slice(7).trim();
  }
  if (!raw.startsWith('dev_tok_')) return null;

  const tokenBody = raw.slice('dev_tok_'.length);
  const parts = tokenBody.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const secret = config.secrets?.jwtSecret || 'tc_jwt_secret_dev_key';
  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('hex');

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return null;
  const sigMatch = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!sigMatch) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload.developerId || !payload.exp || Date.now() > payload.exp) return null;

    const [rows] = await pool.query(
      'SELECT id, name, email, created_at FROM developers WHERE id = ? LIMIT 1',
      [payload.developerId]
    );
    if (rows.length === 0) return null;
    return rows[0];
  } catch {
    return null;
  }
}

/**
 * Middleware: Strictly requires authenticated developer token
 */
export async function authenticateDeveloper(req, res, next) {
  const authHeader = req.headers['authorization'];
  const devTokenHeader = req.headers['x-developer-token'];

  const token = devTokenHeader || authHeader;
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a developer token via Authorization header.'
      }
    });
  }

  const developer = await verifyDeveloperToken(token);
  if (!developer) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired developer authentication token.'
      }
    });
  }

  req.developer = developer;
  next();
}

/**
 * Middleware: Optional developer auth (attaches req.developer if token present)
 */
export async function optionalDeveloperAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const devTokenHeader = req.headers['x-developer-token'];
  const token = devTokenHeader || authHeader;

  if (token) {
    const developer = await verifyDeveloperToken(token);
    if (!developer && (authHeader?.startsWith('Bearer dev_tok_') || devTokenHeader)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired developer authentication token.'
        }
      });
    }
    if (developer) {
      req.developer = developer;
    }
  }

  next();
}

/**
 * Middleware: Verifies authenticated developer owns the specified app ID (:id)
 */
export async function verifyAppOwnership(req, res, next) {
  const appId = req.params.id;
  if (!appId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing application ID parameter'
      }
    });
  }

  try {
    const app = await SaasRepository.getAppById(appId);
    if (!app) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APP_NOT_FOUND',
          message: 'Application not found'
        }
      });
    }

    if (!req.developer) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Developer authentication required'
        }
      });
    }

    if (app.developer_id && app.developer_id !== req.developer.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'APP_ACCESS_DENIED',
          message: 'Access denied: You do not own this application'
        }
      });
    }

    req.targetApp = app;
    next();
  } catch (err) {
    console.error('[App Ownership Verification Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal authorization error' });
  }
}
