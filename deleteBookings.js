   const { initializeApp, applicationDefault } = require('firebase-admin/app');
   const { getFirestore } = require('firebase-admin/firestore');

   initializeApp({ credential: applicationDefault() });
   const db = getFirestore();

   async function deleteAllBookings() {
     const snapshot = await db.collection('bookings').get();
     const batch = db.batch();
     snapshot.forEach(doc => {
       batch.delete(doc.ref);
     });
     await batch.commit();
     console.log('All bookings deleted!');
   }

   deleteAllBookings();