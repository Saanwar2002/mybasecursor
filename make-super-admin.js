// Script to make user qWDHrEVDBfWu3A2F5qY6N9tGgnI3 a super admin
// Run this in the browser console while logged in as an admin

const makeSuperAdmin = async () => {
  console.log('Making user qWDHrEVDBfWu3A2F5qY6N9tGgnI3 a super admin...\n');

  const SUPER_ADMIN_UID = "qWDHrEVDBfWu3A2F5qY6N9tGgnI3";

  try {
    // Step 1: Generate a sequential admin ID for the super admin
    console.log('Step 1: Generating sequential admin ID...');
    const adminIdResponse = await fetch('/api/users/generate-admin-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!adminIdResponse.ok) {
      throw new Error(`Failed to generate admin ID: ${adminIdResponse.status}`);
    }

    const adminIdData = await adminIdResponse.json();
    const adminId = adminIdData.adminId;
    console.log(`Generated Admin ID: ${adminId}`);

    // Step 2: Update the user to be a super admin
    console.log('\nStep 2: Updating user to super admin...');
    const updateResponse = await fetch(`/api/operator/drivers/${SUPER_ADMIN_UID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'admin',
        status: 'Active',
        customId: adminId,
        isSuperAdmin: true,
        approvedAt: new Date().toISOString(),
        approvedBy: 'system'
      })
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`Failed to update user: ${errorData.message || updateResponse.status}`);
    }

    const updateData = await updateResponse.json();
    console.log('User updated successfully!');
    console.log('Updated user data:', updateData);

    // Step 3: Verify the update
    console.log('\nStep 3: Verifying the update...');
    const verifyResponse = await fetch(`/api/operator/drivers/${SUPER_ADMIN_UID}`);
    
    if (!verifyResponse.ok) {
      throw new Error(`Failed to verify user: ${verifyResponse.status}`);
    }

    const userData = await verifyResponse.json();
    console.log('Verification successful!');
    console.log('Current user data:', userData);

    console.log('\n✅ Super Admin Setup Complete!');
    console.log(`User ${SUPER_ADMIN_UID} is now a super admin with ID: ${adminId}`);
    console.log('You can now log in with this account and have full super admin privileges.');

  } catch (error) {
    console.error('❌ Error making super admin:', error);
    console.error('Error details:', error.message);
  }
};

// Add a button to the page for easy execution
const addSuperAdminButton = () => {
  const button = document.createElement('button');
  button.textContent = 'Make Super Admin';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    background: #dc2626;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
  `;
  button.onclick = makeSuperAdmin;
  document.body.appendChild(button);
  console.log('Super Admin button added to page. Click it to make the user a super admin.');
};

// Auto-add the button when script runs
addSuperAdminButton();

// Also expose the function globally
window.makeSuperAdmin = makeSuperAdmin;
console.log('Super Admin script loaded. You can also call makeSuperAdmin() directly.'); 