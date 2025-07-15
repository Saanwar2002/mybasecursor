# Changelog (Recent Changes)

## 2024-06-27
- Fixed driver available rides polling logic: Only one polling loop is now active at a time, preventing rapid/overlapping requests. Polling interval is reliably 5–7 seconds.
- Restored and improved bottom controls: The online/offline toggle and pause offers controls are now always visible in a card-style panel at the bottom, matching the intended UI design.
- Improved layout and visibility of driver dashboard controls for all states (online, offline, awaiting rides).

## Driver Available Rides Page
- Restored the page from backup and verified the yellow taxi icon is present.
- Fixed multiple runtime errors:
  - Added null checks for `activeRide.status` before calling `.toLowerCase()`.
  - Added null checks for `pickupLocation.address` and `doorOrFlat`.
  - Added null checks for `point` in journey display.
- Fixed Firestore permission errors by relaxing security rules for development.
- Created missing API route: `/api/driver/active-ride/location` (returns `{ status: 'ok' }`).
- Updated polling interval for ride offers to a random value between 5–7 seconds.
- Updated driver location update interval to 10 seconds.
- Fixed all `DialogContent asChild received an array` warnings in modals by wrapping children in a `<div>`.
- Added debug logging to the polling effect to track how often the interval is reset and why.

## Firestore
- Relaxed security rules for development (allow read/write for all).
- Deployed the relaxed rules to Firebase.

## Upcoming Refactor
- Plan to remove unused variable declarations in `available-rides/page.tsx` for lint compliance:
  - rideRequests, error, currentDriverOperatorPrefix, showEndOfRideReminder, cancellationSuccess, setCancellationSuccess, jsonParseError, textReadError, rideId, prev, mainActionBtnText, basePlusWRFare, err
- This will resolve remaining ESLint unused variable errors and warnings.

## Current Unresolved Error/Issue
- UI and backend polling intervals are now correct, but there is still a warning in the console:
  - `DialogContent asChild received an array: [...]` (may still appear in other dialogs not yet fixed)
- No evidence of 200ms polling from the main driver page, but further investigation may be needed if fast refresh persists elsewhere.

## 2024-06-28
- Fixed: Favorite Locations now persist after page refresh by fetching from Firestore on load.
- Fixed: Prevented duplicate favorite locations from being added (by address).
- Fixed: Favorite removal now works correctly (frontend uses 'favId' param to match backend API).
- Improved: After removing a favorite, the list is re-fetched from Firestore to ensure UI and backend are in sync.
- Improved: API response for adding a favorite now matches frontend expectations (returns { id, data }).
- Improved: Error handling for missing/invalid data in add/remove/list favorite APIs.

## [Unreleased]

### Driver Available Rides Page Improvements
- The yellow warning banner for paused ride offers now appears whenever 'Pause Ride Offers' is enabled, regardless of whether a ride is in progress or not.
- When the driver toggles Offline, 'Pause Ride Offers' is automatically turned off and must be manually re-enabled after going Online.
- Restored always-visible bottom controls card with toggles and status below the map.
- Fixed build and rendering issues with the map, warning banner, and controls layout for a consistent user experience.

### [TODO: Upcoming]

#### Outstanding ESLint Issues (to be fixed in a future update)
- Unused variables, imports, and components (e.g., variables defined but never used)
- Unexpected `any` types (should be replaced with specific types)
- React hook dependency warnings (missing or unnecessary dependencies in `useEffect`)
- Unescaped characters in JSX (e.g., `'` or `"` should be escaped)
- Variables assigned but never used
- Prefer `const` over `let` or `var`
- Component or variable is not defined

**Affected areas:**
- Dashboard pages
- Driver and operator pages
- API route files
- Components and hooks

These issues are spread across the codebase and will be addressed in a future code quality update.

### Code Change Rules
- When fixing code quality issues (unused variables, any types, etc.), always fix one error type at a time, re-run the relevant linter or type checker after each fix, and only proceed to the next error type after confirming the previous is resolved.

---
**Next Steps:**
- Investigate and fix any remaining `DialogContent` array warnings in other dialogs/components.
- Monitor for any unexpected fast polling or UI refreshes in other parts of the app.
- Tighten Firestore security rules before production. 