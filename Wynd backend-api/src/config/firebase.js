const admin = require("firebase-admin");

function readServiceAccount() {
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!encoded) {
        const error = new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set.");
        error.code = "notifications/firebase-not-configured";
        throw error;
    }

    let serviceAccount;
    try {
        const decoded = Buffer.from(encoded.trim(), "base64").toString("utf8");
        serviceAccount = JSON.parse(decoded);
    } catch (_) {
        const error = new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid Base64-encoded service-account JSON.");
        error.code = "notifications/firebase-invalid-credentials";
        throw error;
    }

    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
        const error = new Error("The Firebase service account is missing project_id, client_email or private_key.");
        error.code = "notifications/firebase-invalid-credentials";
        throw error;
    }

    return serviceAccount;
}

function getMessaging() {
    if (!admin.apps.length) {
        const serviceAccount = readServiceAccount();
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });
        console.log(`Firebase Admin initialized for project ${serviceAccount.project_id}.`);
    }
    return admin.messaging();
}

module.exports = { getMessaging };
