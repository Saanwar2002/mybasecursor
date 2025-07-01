const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function sendReminders() {
  const now = Date.now();
  const emergencyThreshold = now - 5 * 60 * 1000; // 5 minutes
  const otherThreshold = now - 24 * 60 * 60 * 1000; // 24 hours

  const snapshot = await db.collection('notifications').where('read', '==', false).get();
  for (const doc of snapshot.docs) {
    const notif = doc.data();
    const notifTime = notif.createdAt && notif.createdAt.toMillis ? notif.createdAt.toMillis() : 0;
    const lastReminded = notif.lastRemindedAt && notif.lastRemindedAt.toMillis ? notif.lastRemindedAt.toMillis() : 0;
    let shouldRemind = false;
    let reminderTitle = '';
    let reminderBody = '';
    let reminderType = notif.type;
    if (notif.type === 'emergency') {
      if (notifTime < emergencyThreshold && (!lastReminded || lastReminded < emergencyThreshold)) {
        shouldRemind = true;
        reminderTitle = 'REMINDER: ' + notif.title;
        reminderBody = notif.body + ' (Unacknowledged for over 5 minutes)';
      }
    } else {
      if (notifTime < otherThreshold && (!lastReminded || lastReminded < otherThreshold)) {
        shouldRemind = true;
        reminderTitle = 'REMINDER: ' + notif.title;
        reminderBody = notif.body + ' (Unacknowledged for over 24 hours)';
      }
    }
    if (shouldRemind) {
      // Create a new reminder notification
      await db.collection('notifications').add({
        ...notif,
        title: reminderTitle,
        body: reminderBody,
        createdAt: Timestamp.now(),
        reminder: true,
        read: false,
        lastRemindedAt: Timestamp.now(),
        originalNotificationId: doc.id,
      });
      // Update the original notification
      await doc.ref.update({
        lastRemindedAt: Timestamp.now(),
        reminderCount: (notif.reminderCount || 0) + 1,
      });
      console.log(`Sent reminder for notification ${doc.id} (${notif.type})`);
    }
  }
  console.log('Reminder check complete.');
}

sendReminders().catch(err => {
  console.error('Error sending reminders:', err);
  process.exit(1);
}); 