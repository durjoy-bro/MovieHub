// Your web app's Firebase configuration
// This configuration is used by both the user app and the admin panel.
const firebaseConfig = {
  apiKey: "AIzaSyCByhMbB5cJCrbxvzgNGqT7jKdBOEZVLX4",
  authDomain: "movie-hub-b8781.firebaseapp.com",
  projectId: "movie-hub-b8781",
  storageBucket: "movie-hub-b8781.appspot.com", // .firebasestorage.app নয়, .appspot.com হবে
  messagingSenderId: "752569102926",
  appId: "1:752569102926:web:680ce97b49aa7f5890891f",
  measurementId: "G-VZ3TYT5Y0Y"
};

// Initialize Firebase using the v8 SDK syntax
firebase.initializeApp(firebaseConfig);

// Create easy-to-use references to the services
const auth = firebase.auth();
const db = firebase.firestore();
// Note: You don't need to initialize storage here if you are not using it.