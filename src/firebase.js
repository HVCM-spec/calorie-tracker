import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDauqrYiMJAJDaOlJqPUOhZ8DRD9dOTpS0",
  authDomain: "calorie-tracker-e21eb.firebaseapp.com",
  projectId: "calorie-tracker-e21eb",
};

const app = initializeApp(firebaseConfig);

// ✅ THIS LINE IS CRITICAL
export const db = getFirestore(app);