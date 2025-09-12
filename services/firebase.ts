// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD3Law9VPbWdlIuZ_o1T-iPjverkEi0p04",
  authDomain: "bg-remover-4f270.firebaseapp.com",
  projectId: "bg-remover-4f270",
  storageBucket: "bg-remover-4f270.firebasestorage.app",
  messagingSenderId: "226256910751",
  appId: "1:226256910751:web:abac66b6b97251dd9ce5aa",
  measurementId: "G-Y83G2KZ6FW"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
