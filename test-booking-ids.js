// Test script to verify sequential booking ID generation
const testBookingIdGeneration = async () => {
  console.log('Testing sequential booking ID generation...\n');

  const testOperatorCodes = ['OP001', 'OP002', 'OP003'];

  for (const operatorCode of testOperatorCodes) {
    console.log(`Testing operator: ${operatorCode}`);
    
    // Generate 3 booking IDs for each operator
    for (let i = 1; i <= 3; i++) {
      try {
        const response = await fetch('/api/bookings/generate-booking-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorCode })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`  Booking ${i}: ${result.bookingId} (Sequence: ${result.sequenceNumber})`);
        } else {
          console.error(`  Error generating booking ID ${i}:`, await response.text());
        }
      } catch (error) {
        console.error(`  Error generating booking ID ${i}:`, error.message);
      }
    }
    console.log('');
  }
};

// Run the test if this script is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  console.log('This test should be run in a browser environment with the app running.');
} else {
  // Browser environment
  testBookingIdGeneration();
} 