// Public Firebase web config. The apiKey here is a PUBLIC client identifier that
// Firebase requires in browser code — it is NOT a Gemini API key and grants no
// model access on its own. Gemini is brokered by Firebase AI Logic; no model key
// ever reaches the client. See https://firebase.google.com/docs/projects/api-keys
export const firebaseConfig = {
  apiKey: "AIzaSyC4SXkmsOiY0h3WzlYB3Xaza26-VrL0M28",
  authDomain: "followthrough-56f12.firebaseapp.com",
  projectId: "followthrough-56f12",
  storageBucket: "followthrough-56f12.firebasestorage.app",
  messagingSenderId: "170944591672",
  appId: "1:170944591672:web:411eb2c61e01220b0273cd"
};
export const MODEL = "gemini-3.8-flash";
