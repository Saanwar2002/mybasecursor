/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Firebase Functions v2 modular API for 2nd Gen deployment
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');

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
  region: 'us-central1',
  memory: '256MiB',
  cpu: 1,
  timeoutSeconds: 60,
}, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const booking = snap.data();
  if (!booking || booking.status !== 'pending_assignment') return;

  // Get operator ID
  const operatorId = booking.originatingOperatorId || booking.preferredOperatorId;
  if (!operatorId) return;

  // Fetch operator settings
  const operatorSettingsSnap = await db.collection('operatorSettings').doc(operatorId).get();
  const operatorSettings = operatorSettingsSnap.data();
  if (!operatorSettings || !operatorSettings.autoDispatchEnabled) return;

  // Get pickup location
  const pickup = booking.pickupLocation;
  if (!pickup || typeof pickup.latitude !== 'number' || typeof pickup.longitude !== 'number') return;

  // Query drivers for this operator, status Active
  const driversSnap = await db.collection('drivers')
    .where('status', '==', 'Active')
    .where('operatorCode', '==', operatorId)
    .get();

  let nearestDriver = null;
  let minDistance = Infinity;
  driversSnap.forEach((doc) => {
    const driver = doc.data();
    let lat, lng;
    // Support both array and object location formats
    if (Array.isArray(driver.location) && driver.location.length === 2) {
      lat = driver.location[0];
      lng = driver.location[1];
    } else if (driver.location && typeof driver.location.lat === 'number' && typeof driver.location.lng === 'number') {
      lat = driver.location.lat;
      lng = driver.location.lng;
    }
    if (typeof lat === 'number' && typeof lng === 'number') {
      const dist = haversineDistance(pickup.latitude, pickup.longitude, lat, lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestDriver = { id: doc.id, ...driver };
      }
    }
  });

  if (!nearestDriver) return;

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
