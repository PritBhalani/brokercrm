/**
 * JWT signing/verification secret. Set JWT_SECRET in production (e.g. Render).
 * Dev fallback matches previous behavior so existing local tokens keep working.
 */
export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    return 'secret';
  }
  return s;
}
