// Rewatchr has its own Firebase project (rewatchr-85473) — unlike the newer
// hub apps it predates the account hitting its GCP project quota, so nothing
// here shares thunderstoner. Google sign-in gates the app: the whole point is
// a personal list of shows that follows you between phone and desk.

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
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

const toUser = (raw) =>
  raw ? { uid: raw.uid, email: raw.email, name: raw.displayName, photo: raw.photoURL } : null

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
