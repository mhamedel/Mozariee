/**
 * Security rules test suite specification verifying all Dirty Dozen payloads
 * against /users/{userId} and /users/{userId}/sessions/{sessionId}.
 */
export const DIRTY_DOZEN_CASES = [
  { id: 1, name: 'unauthenticated-read-user', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'unverified-email-write-user', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'cross-user-read-user', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'list-users-pii-blocked', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'spoofed-uid-on-create', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'shadow-field-isAdmin-injection', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'oversized-displayName-denial-of-wallet', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'invalid-path-id-characters', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'forged-client-createdAt-timestamp', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'immutable-createdAt-mutation-on-update', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'orphaned-session-without-parent-user', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'immutable-session-update-or-delete', expected: 'PERMISSION_DENIED' },
] as const;
