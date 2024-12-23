import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "rewatchr-85473.firebaseapp.com",
  projectId: "rewatchr-85473",
  storageBucket: "rewatchr-85473.firebasestorage.app",
  messagingSenderId: "631739268356",
  appId: "1:631739268356:web:011effd7e2eac0726f6451",
  measurementId: "G-0B6NTHND8H",
  databaseURL: "https://rewatchr-85473-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { database, auth };
