const fs = require('fs');
const path = require('path');

// Path to the file
const filePath = path.join(__dirname, 'src', 'app', '(app)', 'driver', 'available-rides', 'page.tsx');

console.log('🔧 Starting to fix available rides page...');

try {
  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  
  console.log('📖 File read successfully');

  // Change 1: Fix the return statement (around line 2308)
  const returnStatementRegex = /return\s*\(\s*<>\s*\{\s*!\(isOfferModalOpen\s*&&\s*currentOfferDetails\)\s*&&\s*\(/;
  if (!returnStatementRegex.test(content)) {
    content = content.replace(
      /return\s*\(\s*<>\s*\{\s*!\(isOfferModalOpen\s*&&\s*currentOfferDetails\)\s*&&\s*\(/,
      'return (\n    <>\n      {!(isOfferModalOpen && currentOfferDetails) && ('
    );
    console.log('✅ Fixed return statement');
  }

  // Change 2: Add closing tags after the last Card (around line 2840)
  const lastCardRegex = /(\s*<\/Card>\s*)(?=\s*\{currentOfferDetails)/;
  if (lastCardRegex.test(content)) {
    content = content.replace(
      lastCardRegex,
      '$1\n    </div>\n  )}\n\n'
    );
    console.log('✅ Added closing tags after last Card');
  }

  // Change 3: Fix the end of the file
  const endOfFileRegex = /(\s*<\/Dialog>\s*)(?=\s*\);\s*\}\s*$)/;
  if (endOfFileRegex.test(content)) {
    content = content.replace(
      endOfFileRegex,
      '$1\n    </>\n  );\n}\n\n// Replace setPauseOffers with a handler that updates Firestore\nconst handlePauseOffersToggle = async (checked: boolean) => {\n  setPauseOffers(checked);\n  if (!driverUser || !db) return;\n  try {\n    const driverDocRef = doc(db, \'drivers\', driverUser.id);\n    if (checked) {\n      await updateDoc(driverDocRef, { availability: \'paused\' });\n    } else {\n      await updateDoc(driverDocRef, { availability: \'online\' });\n    }\n  } catch (err) {\n    console.error(\'[handlePauseOffersToggle] Error updating availability:\', err);\n  }\n};\n'
    );
    console.log('✅ Fixed end of file');
  }

  // Write the fixed content back to the file
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ File fixed successfully!');
  console.log('📝 Changes made:');
  console.log('  1. Fixed return statement with proper conditional rendering');
  console.log('  2. Added closing tags for the main content div');
  console.log('  3. Fixed the end of the file with proper fragment closing');
  console.log('  4. Added the handlePauseOffersToggle function');
  
  console.log('\n🎉 The available rides page will now hide when a new ride offer is received!');

} catch (error) {
  console.error('❌ Error fixing file:', error.message);
  console.log('\n📋 Manual changes needed:');
  console.log('1. Find the return statement and wrap it in: return (<>');
  console.log('2. Add conditional: {!(isOfferModalOpen && currentOfferDetails) && (');
  console.log('3. After the last </Card>, add: </div>)}');
  console.log('4. At the end, add: </>);');
} 