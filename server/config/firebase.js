const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const initFirebase = () => {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // A real credential is required for FCM (messaging); fall back to the plain options otherwise
    initializeApp(
      projectId && privateKey && clientEmail
        ? { credential: cert({ projectId, privateKey, clientEmail }), projectId }
        : { projectId }
    );
    console.log('Firebase initialized');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    process.exit(1);
  }
};

const verifyToken = async (token) => {
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification error:', error);
    throw error;
  }
};

module.exports = { initFirebase, verifyToken };
