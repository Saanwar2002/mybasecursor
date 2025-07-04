/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Firebase Functions v2 modular API for 2nd Gen deployment
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp, collection, query, where, getDocs, updateDoc, GeoPoint } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');

// Initialize Firebase Admin (only once)
initializeApp();
const db = getFirestore();

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Helper: Haversine distance in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (x) => x * Math.PI / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

exports.autoAssignOnBookingCreate = onDocumentCreated({
  document: 'bookings/{bookingId}',
  region: 'europe-west2',
  memory: '256MiB',
  cpu: 1,
  timeoutSeconds: 60,
}, async (event) => {
  const snap = event.data;
  if (!snap) {
    logger.info('No snapshot data.');
    return;
  }
  const booking = snap.data();
  logger.info('Booking created:', booking);

  if (!booking || booking.status !== 'pending_assignment') {
    logger.info('Booking missing or not pending_assignment:', booking);
    return;
  }

  const operatorId = booking.originatingOperatorId || booking.preferredOperatorId;
  logger.info('Operator ID:', operatorId);
  if (!operatorId) {
    logger.info('No operatorId found.');
    return;
  }

  const operatorSettingsSnap = await db.collection('operatorSettings').doc(operatorId).get();
  const operatorSettings = operatorSettingsSnap.data();
  logger.info('Operator settings:', operatorSettings);
  if (!operatorSettings || !operatorSettings.autoDispatchEnabled) {
    logger.info('Auto dispatch not enabled or missing operator settings.');
    return;
  }
  if (operatorSettings.dispatchMode && operatorSettings.dispatchMode !== 'auto') {
    logger.info(`Operator dispatchMode is '${operatorSettings.dispatchMode}', not 'auto'. Skipping auto-assignment.`);
    return;
  }

  const pickup = booking.pickupLocation;
  logger.info('Pickup location:', pickup);
  if (!pickup || typeof pickup.latitude !== 'number' || typeof pickup.longitude !== 'number') {
    logger.info('Invalid pickup location.');
    return;
  }

  const driversSnap = await db.collection('drivers')
    .where('status', '==', 'Active')
    .where('operatorCode', '==', operatorId)
    .get();

  logger.info('Drivers found:', driversSnap.size);

  let nearestDriver = null;
  let minDistance = Infinity;
  driversSnap.forEach((doc) => {
    const driver = doc.data();
    logger.info('Checking driver:', driver);
    let lat, lng;
    if (Array.isArray(driver.location) && driver.location.length === 2) {
      lat = driver.location[0];
      lng = driver.location[1];
    } else if (driver.location && typeof driver.location.lat === 'number' && typeof driver.location.lng === 'number') {
      lat = driver.location.lat;
      lng = driver.location.lng;
    }
    if (typeof lat === 'number' && typeof lng === 'number') {
      const dist = haversineDistance(pickup.latitude, pickup.longitude, lat, lng);
      logger.info(`Driver ${doc.id} distance: ${dist}`);
      if (dist < minDistance) {
        minDistance = dist;
        nearestDriver = { id: doc.id, ...driver };
      }
    }
  });

  if (!nearestDriver) {
    logger.info('No suitable driver found.');
    return;
  }

  logger.info('Assigning driver:', nearestDriver);

  // Update booking with assigned driver
  await db.collection('bookings').doc(event.params.bookingId).update({
    driverId: nearestDriver.id,
    driverName: nearestDriver.name,
    driverVehicleDetails: nearestDriver.vehicleCategory || '',
    status: 'driver_assigned',
    dispatchMethod: 'auto_system',
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Optionally, create a ride offer document
  await db.collection('rideOffers').add({
    bookingId: event.params.bookingId,
    driverId: nearestDriver.id,
    offerDetails: {
      pickupLocation: pickup.address,
      pickupCoords: { lat: pickup.latitude, lng: pickup.longitude },
      dropoffLocation: booking.dropoffLocation ? booking.dropoffLocation.address : null,
      dropoffCoords: booking.dropoffLocation ? { lat: booking.dropoffLocation.latitude, lng: booking.dropoffLocation.longitude } : null,
      stops: booking.stops || [],
      fareEstimate: booking.fareEstimate,
      passengerCount: booking.passengers,
      passengerId: booking.passengerId,
      passengerName: booking.passengerName,
      passengerPhone: booking.passengerPhone || booking.customerPhoneNumber,
      notes: booking.driverNotes,
      paymentMethod: booking.paymentMethod,
      isPriorityPickup: booking.isPriorityPickup,
      priorityFeeAmount: booking.priorityFeeAmount,
      distanceMiles: booking.distanceMiles,
      requiredOperatorId: booking.originatingOperatorId,
      accountJobPin: booking.accountJobPin,
    },
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 30000)), // 30s expiry
  });
});

// Function to generate sequential operator ID
async function generateOperatorId() {
  const counterRef = db.collection('counters').doc('operatorId');
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // Initialize counter if it doesn't exist
        transaction.set(counterRef, { currentId: 1 });
        return 1;
      }
      
      const currentId = counterDoc.data().currentId;
      transaction.update(counterRef, { currentId: currentId + 1 });
      return currentId + 1;
    });
    
    return `OP${result.toString().padStart(3, '0')}`;
  } catch (error) {
    logger.error('Error generating operator ID:', error);
    throw error;
  }
}

// Function to generate sequential driver ID for an operator
async function generateDriverId(operatorCode) {
  const counterRef = db.collection('counters').doc(`driverId_${operatorCode}`);
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // Initialize counter if it doesn't exist
        transaction.set(counterRef, { currentId: 1 });
        return 1;
      }
      
      const currentId = counterDoc.data().currentId;
      transaction.update(counterRef, { currentId: currentId + 1 });
      return currentId + 1;
    });
    
    return `${operatorCode}/DR${result.toString().padStart(3, '0')}`;
  } catch (error) {
    logger.error('Error generating driver ID:', error);
    throw error;
  }
}

// Function to generate sequential passenger ID
async function generatePassengerId() {
  const counterRef = db.collection('counters').doc('passengerId');
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // Initialize counter if it doesn't exist
        transaction.set(counterRef, { currentId: 1 });
        return 1;
      }
      
      const currentId = counterDoc.data().currentId;
      transaction.update(counterRef, { currentId: currentId + 1 });
      return currentId + 1;
    });
    
    return `CU${result.toString().padStart(3, '0')}`;
  } catch (error) {
    logger.error('Error generating passenger ID:', error);
    throw error;
  }
}

// Function to generate sequential admin ID
async function generateAdminId() {
  const counterRef = db.collection('counters').doc('adminId');
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // Initialize counter if it doesn't exist
        transaction.set(counterRef, { currentId: 1 });
        return 1;
      }
      
      const currentId = counterDoc.data().currentId;
      transaction.update(counterRef, { currentId: currentId + 1 });
      return currentId + 1;
    });
    
    return `AD${result.toString().padStart(3, '0')}`;
  } catch (error) {
    logger.error('Error generating admin ID:', error);
    throw error;
  }
}

// Function to generate sequential booking ID for an operator
async function generateBookingId(operatorCode) {
  const counterRef = db.collection('counters').doc(`bookingId_${operatorCode}`);
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // Initialize counter if it doesn't exist
        transaction.set(counterRef, { currentId: 1 });
        return 1;
      }
      
      const currentId = counterDoc.data().currentId;
      transaction.update(counterRef, { currentId: currentId + 1 });
      return currentId + 1;
    });
    
    return `${operatorCode}/${result.toString().padStart(8, '0')}`;
  } catch (error) {
    logger.error('Error generating booking ID:', error);
    throw error;
  }
}

// Function to handle booking timeouts
exports.processBookingTimeouts = onSchedule(
  { schedule: 'every 5 minutes' },
  async (event) => {
    const now = Timestamp.now();
    const timeoutThreshold = new Date(now.toDate().getTime() - (30 * 60 * 1000)); // 30 minutes ago
    try {
      // Find bookings that have been pending for more than 30 minutes
      const timeoutBookings = await db.collection('bookings')
        .where('status', '==', 'pending_assignment')
        .where('timeoutAt', '<', now)
        .get();
      console.log(`Found ${timeoutBookings.size} bookings that have timed out`);
      const batch = db.batch();
      const notifications = [];
      timeoutBookings.forEach((doc) => {
        const booking = doc.data();
        // Update booking status to cancelled
        batch.update(doc.ref, {
          status: 'cancelled_no_driver',
          cancelledAt: now,
          cancellationReason: 'timeout_no_driver_available'
        });
        // Create notification for passenger
        if (booking.passengerId) {
          const notificationRef = db.collection('notifications').doc();
          batch.set(notificationRef, {
            userId: booking.passengerId,
            type: 'booking_timeout',
            title: 'Booking Cancelled - No Driver Available',
            message: `Your booking ${booking.displayBookingId || booking.id} has been cancelled as no driver was available within 30 minutes. Please try booking again.`,
            bookingId: doc.id,
            createdAt: now,
            read: false
          });
          notifications.push(notificationRef.id);
        }
      });
      await batch.commit();
      console.log(`Processed ${timeoutBookings.size} timed out bookings and created ${notifications.length} notifications`);
      return { success: true, processed: timeoutBookings.size, notifications: notifications.length };
    } catch (error) {
      console.error('Error processing booking timeouts:', error);
      throw error;
    }
  }
);

// Cloud Function to update driver location in active booking documents for passenger tracking
exports.updateDriverLocationInBookings = onDocumentUpdated({
  document: 'drivers/{driverId}',
  region: 'europe-west2',
  memory: '256MiB',
  cpu: 1,
  timeoutSeconds: 30,
}, async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  
  // Only proceed if location actually changed
  if (!beforeData || !afterData || !afterData.location) {
    return;
  }
  
  const beforeLocation = beforeData.location;
  const afterLocation = afterData.location;
  
  // Check if location actually changed (avoid unnecessary updates)
  if (beforeLocation && 
      beforeLocation.lat === afterLocation.lat && 
      beforeLocation.lng === afterLocation.lng) {
    return;
  }
  
  const driverId = event.params.driverId;
  logger.info(`Driver ${driverId} location updated:`, afterLocation);
  
  try {
    // Find all active bookings for this driver
    const activeBookingsQuery = query(
      collection(db, 'bookings'),
      where('driverId', '==', driverId),
      where('status', 'in', [
        'driver_assigned',
        'arrived_at_pickup', 
        'in_progress',
        'in_progress_wait_and_return'
      ])
    );
    
    const activeBookingsSnap = await getDocs(activeBookingsQuery);
    
    if (activeBookingsSnap.empty) {
      logger.info(`No active bookings found for driver ${driverId}`);
      return;
    }
    
    // Update all active bookings with the new driver location and ETA
    const updatePromises = activeBookingsSnap.docs.map(async (bookingDoc) => {
      try {
        const bookingData = bookingDoc.data();
        const updateData = {
          driverCurrentLocation: new GeoPoint(afterLocation.lat, afterLocation.lng),
          updatedAt: FieldValue.serverTimestamp()
        };
        
        // Calculate ETA for driver_assigned status (en route to pickup)
        if (bookingData.status === 'driver_assigned' && bookingData.pickupLocation) {
          const distance = haversineDistance(
            afterLocation.lat, afterLocation.lng,
            bookingData.pickupLocation.latitude, bookingData.pickupLocation.longitude
          );
          // Assume average speed of 30 km/h in urban areas
          const estimatedMinutes = Math.max(1, Math.round(distance / 1000 / 30 * 60));
          updateData.driverEtaMinutes = estimatedMinutes;
          logger.info(`Calculated ETA for booking ${bookingDoc.id}: ${estimatedMinutes} minutes`);
        }
        
        await updateDoc(bookingDoc.ref, updateData);
        logger.info(`Updated booking ${bookingDoc.id} with driver location and ETA for passenger tracking`);
      } catch (updateErr) {
        logger.error(`Failed to update booking ${bookingDoc.id}:`, updateErr);
      }
    });
    
    await Promise.all(updatePromises);
    logger.info(`Successfully updated ${activeBookingsSnap.size} active bookings with driver location and ETA`);
    
  } catch (error) {
    logger.error('Error updating driver location in bookings:', error);
  }
});
