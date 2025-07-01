const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function deleteAnonymousUsers() {
  let nextPageToken;
  do {
    const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
    const anonymousUsers = listUsersResult.users.filter(user => user.providerData.length === 0);

    for (const user of anonymousUsers) {
      await admin.auth().deleteUser(user.uid);
      console.log(`Deleted anonymous user: ${user.uid}`);
    }

    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);
}

deleteAnonymousUsers()
  .then(() => {
    console.log('Finished deleting all anonymous users.');
    process.exit();
  })
  .catch(error => {
    console.error('Error deleting users:', error);
    process.exit(1);
  }); 