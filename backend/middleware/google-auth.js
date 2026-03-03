import { OAuth2Client } from 'google-auth-library';

/**
 * Creates middleware that verifies Google ID tokens.
 * Only the owner (matched by email) gets write access.
 */
export function createGoogleAuth({ googleClientId, ownerEmail }) {
  const client = new OAuth2Client(googleClientId);

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    try {
      const ticket = await client.verifyIdToken({
        idToken: authHeader.slice(7),
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      req.user = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        isOwner: payload.email === ownerEmail,
      };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid Google ID token' });
    }
  };
}

/**
 * Middleware that requires the authenticated user to be the owner.
 */
export function requireOwner(req, res, next) {
  if (!req.user?.isOwner) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}
