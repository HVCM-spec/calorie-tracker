import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDauqrYiMJAJDaOlJqPUOhZ8DRD9dOTpS0",
  authDomain: "calorie-tracker-e21eb.firebaseapp.com",
  projectId: "calorie-tracker-e21eb",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
