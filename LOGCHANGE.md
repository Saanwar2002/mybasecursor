# Project Changelog (LOGCHANGE.md)

This file is used to record any changes made to the codebase. Please document all significant changes, bug fixes, and feature additions here.

---

## [YYYY-MM-DD] Title or Short Description
- Description of the change, file(s) affected, and any relevant notes.

---

## Example

### [2024-06-27] Initial Changelog Created
- Added LOGCHANGE.md to track code changes. 

## 2024-07-13

### Fixed: Firestore Permission Error for Driver Locations on Passenger Dashboard
- **Issue:** Passengers and booking flows were failing with Firestore client SDK assertion errors due to insufficient permissions when fetching driver locations (for ride assignment and map display).
- **Root Cause:** Firestore rules for the `drivers` collection did not allow authenticated users to read driver documents, causing the client SDK to throw errors when listening for active drivers.
- **Solution:** Updated Firestore rules to allow all authenticated users to read all fields for drivers with `status == 'Active'`. This enables the app to fetch driver locations and assign ride offers as needed.
- **Rule Change:**
  ```firestore
  match /drivers/{driverId} {
    allow read: if isAuthenticated() && resource.data.status == 'Active';
    allow create: if isAuthenticated() && isOwner(driverId);
    allow update, delete: if isAuthenticated() && (isOwner(driverId) || isOperator() || isAdmin());
  }
  ```
- **Result:** Passenger dashboard and booking pages now load driver locations without errors. All other permissions remain secure. 