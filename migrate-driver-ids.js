// Migration script to update existing drivers to use sequential driver IDs
// Run this script to update your existing driver account

const migrateDriverIds = async () => {
  console.log('Starting driver ID migration...\n');

  try {
    // Step 1: Get your existing driver account
    const response = await fetch('/api/operator/drivers?operatorCode=OP001');
    const data = await response.json();
    
    if (!data.drivers || data.drivers.length === 0) {
      console.log('No drivers found for OP001');
      return;
    }

    console.log(`Found ${data.drivers.length} drivers for OP001:`);
    
    for (const driver of data.drivers) {
      console.log(`- ${driver.name} (${driver.email}): ${driver.customId || driver.driverIdentifier || 'No ID'}`);
      
      // Check if driver needs migration
      if (!driver.customId || driver.customId.startsWith('DR-mock-') || !driver.customId.includes('/DR')) {
        console.log(`  ⚠️  Needs migration: ${driver.customId || 'No ID'}`);
        
        // Generate new sequential driver ID
        const newDriverId = await generateSequentialDriverId(driver.operatorCode || 'OP001');
        console.log(`  ✅ New ID: ${newDriverId}`);
        
        // Update the driver
        const updateResponse = await fetch(`/api/operator/drivers/${driver.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customId: newDriverId,
            driverIdentifier: newDriverId
          })
        });
        
        if (updateResponse.ok) {
          console.log(`  ✅ Updated successfully`);
        } else {
          console.log(`  ❌ Update failed: ${await updateResponse.text()}`);
        }
      } else {
        console.log(`  ✅ Already has proper ID: ${driver.customId}`);
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// Function to generate sequential driver ID (same as in the API)
const generateSequentialDriverId = async (operatorCode) => {
  try {
    const response = await fetch('/api/operator/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'temp',
        email: 'temp@temp.com',
        operatorCode: operatorCode
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.driver.customId;
    } else {
      throw new Error('Failed to generate driver ID');
    }
  } catch (error) {
    console.error('Error generating driver ID:', error);
    // Fallback: generate a mock ID
    return `${operatorCode}/DR${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;
  }
};

// Run migration if in browser environment
if (typeof window !== 'undefined') {
  console.log('Driver ID Migration Tool');
  console.log('=======================');
  console.log('This script will update existing drivers to use sequential driver IDs.');
  console.log('Make sure you are logged in as an operator before running this.\n');
  
  // Add a button to run the migration
  const button = document.createElement('button');
  button.textContent = 'Run Driver ID Migration';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
  `;
  button.onclick = migrateDriverIds;
  document.body.appendChild(button);
  
  console.log('Migration button added to the top-right corner of the page.');
  console.log('Click it to run the migration after logging in as an operator.');
} else {
  console.log('This script should be run in a browser environment with the app running.');
} 