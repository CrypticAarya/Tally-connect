import crypto from 'crypto';

/**
 * Service managing 6-character activation codes for connecting
 * Windows Desktop Agents to SaaS Customer Connections.
 */
export class ActivationService {
  /**
   * In-memory cache for fast pairing & rate limiting (connectionId -> codeDetails)
   */
  static activeCodes = new Map();

  /**
   * Generates a 6-character human-friendly uppercase alphanumeric activation code (e.g. "TC-7492")
   * @param {Object} options
   * @param {string} options.connectionId - Target customer connection ID
   * @param {string} [options.prefix='TC-'] - Optional prefix
   * @param {number} [options.expiryMinutes=30] - Expiration duration in minutes
   * @returns {{ code: string, expiresAt: Date }}
   */
  static generateActivationCode({ connectionId, prefix = 'TC-', expiryMinutes = 30 }) {
    // Generate 4-digit cryptographically random numeric string
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}${randomDigits}`;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const record = {
      code,
      connectionId,
      expiresAt,
      createdAt: new Date(),
      used: false
    };

    this.activeCodes.set(code, record);
    return { code, expiresAt };
  }

  /**
   * Verifies and pairs an activation code submitted by the desktop agent
   * @param {string} code - The user-entered code
   * @returns {{ valid: boolean, connectionId?: string, error?: string }}
   */
  static verifyAndPair(code) {
    if (!code) {
      return { valid: false, error: 'Activation code is required' };
    }

    const cleanCode = code.trim().toUpperCase();
    const record = this.activeCodes.get(cleanCode);

    if (!record) {
      return { valid: false, error: 'Invalid activation code' };
    }

    if (record.used) {
      return { valid: false, error: 'Activation code has already been used' };
    }

    if (new Date() > record.expiresAt) {
      this.activeCodes.delete(cleanCode);
      return { valid: false, error: 'Activation code has expired' };
    }

    // Mark as used
    record.used = true;
    return {
      valid: true,
      connectionId: record.connectionId
    };
  }

  /**
   * Cleans up expired codes
   */
  static purgeExpired() {
    const now = new Date();
    for (const [code, record] of this.activeCodes.entries()) {
      if (now > record.expiresAt || record.used) {
        this.activeCodes.delete(code);
      }
    }
  }
}
