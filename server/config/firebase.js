const admin = require('firebase-admin');

const initFirebase = () => {
  try {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    });
    console.log('Firebase initialized');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    process.exit(1);
  }
};

const verifyToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification error:', error);
    throw error;
  }
};

module.exports = { initFirebase, verifyToken };
