import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export interface UserAccountRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  providerId: string;
  emailVerified: boolean;
  organization: string;
  createdAt?: Timestamp | null;
  lastLoginAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface LoginSessionRecord {
  id: string;
  uid: string;
  email: string;
  providerId: string;
  deviceSummary: string;
  signedInAt?: Timestamp | null;
}

function summarizeBrowserDevice(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent || '';
  let browser = 'متصفح ويب';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  let os = 'Desktop';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} · ${os}`.slice(0, 180);
}

export async function signInWithGooglePopup(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const trimmedName = displayName?.trim();
  if (trimmedName) {
    await updateProfile(credential.user, { displayName: trimmedName.slice(0, 120) });
  }
  try {
    await sendEmailVerification(credential.user);
  } catch {
    // Non-blocking: verification email can be re-sent from Account Info
  }
  return credential.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function sendVerificationEmailToUser(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export async function syncAuthenticatedUserAccount(user: User): Promise<void> {
  if (!user.uid || !user.emailVerified) return;

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const safeEmail = (user.email ?? '').slice(0, 254);
  const safeName = (user.displayName ?? user.email ?? 'مستخدم غرس').slice(0, 120);
  const safePhoto = (user.photoURL ?? '').slice(0, 512);
  const safeProvider = (user.providerData[0]?.providerId ?? 'google.com').slice(0, 64);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: safeEmail,
        displayName: safeName,
        photoURL: safePhoto,
        providerId: safeProvider,
        emailVerified: Boolean(user.emailVerified),
        organization: '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        email: safeEmail,
        displayName: safeName,
        photoURL: safePhoto,
        providerId: safeProvider,
        emailVerified: Boolean(user.emailVerified),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  const sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const sessionPath = `users/${user.uid}/sessions/${sessionId}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'sessions', sessionId), {
      uid: user.uid,
      email: safeEmail,
      providerId: safeProvider,
      deviceSummary: summarizeBrowserDevice(),
      signedInAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, sessionPath);
  }
}

export async function updateAccountProfileInfo(
  user: User,
  payload: { displayName: string; organization: string }
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    await updateDoc(userRef, {
      displayName: payload.displayName.trim().slice(0, 120) || (user.email ?? 'مستخدم غرس').slice(0, 120),
      organization: payload.organization.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export function subscribeUserAccount(
  uid: string,
  onData: (account: UserAccountRecord | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserAccountRecord) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeLoginSessions(
  uid: string,
  onData: (sessions: LoginSessionRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = `users/${uid}/sessions`;
  const q = query(
    collection(db, 'users', uid, 'sessions'),
    orderBy('signedInAt', 'desc'),
    limit(10)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: LoginSessionRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LoginSessionRecord, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}
