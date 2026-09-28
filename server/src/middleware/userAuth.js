import { Repository } from '../db/repository.js';

/**
 * Middleware to authenticate human users via session bearer tokens
 */
export async function authenticateUser(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.query?.sessionToken) {
      token = req.query.sessionToken;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in.'
      });
    }

    const session = await Repository.getSession(token);
    if (!session) {
      return res.status(401).json({
        error: 'Session expired or invalid. Please sign in again.'
      });
    }

    req.user = {
      id: session.userId,
      name: session.userName,
      email: session.userEmail,
      role: session.userRole
    };
    req.tenant = {
      id: session.tenantId,
      companyName: session.companyName
    };
    req.sessionToken = token;

    next();
  } catch (err) {
    console.error('[UserAuth Error]:', err.message);
    return res.status(500).json({ error: 'Internal session authentication error' });
  }
}
