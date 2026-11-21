# Security Specification — Ghars Account & Login Info

## 1. Data Invariants
1. A `UserAccount` document at `/users/{userId}` can only be read or written by the authenticated, email-verified user whose `request.auth.uid == userId`.
2. `uid` inside `/users/{userId}` and `/users/{userId}/sessions/{sessionId}` must strictly match `request.auth.uid` and the `{userId}` path segment.
3. `createdAt`, `lastLoginAt`, `updatedAt`, and `signedInAt` must match `request.time` (server timestamp) on write and `createdAt` is immutable after creation.
4. No user can list `/users` (PII protection) or read/write another user's account or login sessions.
5. `LoginSession` documents under `/users/{userId}/sessions/{sessionId}` require the parent `/users/{userId}` document to exist (Master Gate) and are immutable once created (`update` and `delete` denied).

## 2. Dirty Dozen Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. Unauthenticated read of `/users/userA`.
2. Unverified email user (`email_verified: false`) attempting create/read on `/users/userA`.
3. Cross-user read of `/users/userB` by `userA`.
4. Cross-user `list` query on `/users` collection.
5. `userA` attempting to create `/users/userA` with spoofed `uid: "userB"`.
6. `userA` attempting a shadow-field write with extra key `{ isAdmin: true }`.
7. `userA` attempting to inject oversized string (`displayName.length > 120` or `userId.length > 128`).
8. `userA` attempting invalid path ID characters (`/users/user$bad`).
9. `userA` attempting client-forged timestamp (`createdAt: new Date("2020-01-01")`).
10. `userA` attempting to mutate `createdAt` or `uid` during an update on `/users/userA`.
11. `userA` attempting to create `/users/userA/sessions/s1` when parent `/users/userA` does not exist.
12. `userA` attempting to update or delete an immutable session `/users/userA/sessions/s1`.
