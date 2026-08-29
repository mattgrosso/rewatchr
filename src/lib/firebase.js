// Rewatchr has its own Firebase project (rewatchr-85473) — unlike the newer
// hub apps it predates the account hitting its GCP project quota, so nothing
// here shares thunderstoner. Google sign-in gates the app: the whole point is
// a personal list of shows that follows you between phone and desk.

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { getDatabase, get, ref, set } from 'firebase/database'

const CONFIG = {
  apiKey: 'AIzaSyBOoP2gxy-NVGWjBsA-_66iNFnyOGn4JNw',
  authDomain: 'rewatchr-85473.firebaseapp.com',
  projectId: 'rewatchr-85473',
  appId: '1:631739268356:web:011effd7e2eac0726f6451',
  databaseURL: 'https://rewatchr-85473-default-rtdb.firebaseio.com',
}

const app = initializeApp(CONFIG)
const auth = getAuth(app)
const db = getDatabase(app)

// An anonymous session is NOT a Rewatchr user - it exists only so a
// signed-out bug report can carry an auth token (see lib/bugreport.js and
// database.rules.json). Without this filter, filing a bug from the splash
// would sail past the sign-in screen into an empty signed-in-looking app.
const toUser = (raw) =>
  raw && !raw.isAnonymous
    ? { uid: raw.uid, email: raw.email, name: raw.displayName, photo: raw.photoURL }
    : null

export const watchAuth = (onUser) => {
  onAuthStateChanged(auth, (raw) => onUser(toUser(raw)))
}

export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, new GoogleAuthProvider())
  return toUser(result.user)
}

export const signOutUser = () => signOut(auth)

export const fetchUserData = async (uid) => {
  const snapshot = await get(ref(db, `users/${uid}`))
  return snapshot.exists() ? snapshot.val() : null
}

export const writeUserData = (uid, data) => set(ref(db, `users/${uid}`), data)

/**
 * A fresh ID token for the bug-report POST - the current user's if someone
 * is signed in, an anonymous session's otherwise. Anonymous auth was enabled
 * on this project 2026-08-29 precisely so the bug inbox could require
 * `auth != null` (Firebase's scanner emailed daily about the authless
 * create) without losing reports from the sign-in screen.
 */
export const bugReportToken = async () => {
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user
  return user.getIdToken()
}
