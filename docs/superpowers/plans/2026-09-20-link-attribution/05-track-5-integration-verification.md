# Track 5 Integration Verification

## Missing Upstream Dependencies

### Track 3 APIs / Setup Guide
- The Track 3 list/unconverted endpoints are absent. 
- Real UI listing/picker requires Track 3.
- LINK_ATTRIBUTION_SETUP.md and Content Studio ad URL documentation are absent.

### Tracks 2/4 Journey
- RedirectController, EnquiryController and hosted enquiry UI are absent.
- Full redirect-to-enquiry E2E is an integration gate after Tracks 2/4 arrive.

### Real Evidence Siblings
- Code-redemption and lift panels are absent.
- Physical adjacency to real panels remains a final integration gate.

### Optional Booking Parent
- LogBookingAction and redemption write API are absent.
- Standalone ClickMatchStep is delivered, but integration into parent is pending.

## Execution Record
- [x] Task 1 completed
- [x] Task 2 completed
- [x] Task 3 completed
- [x] Task 4 completed
- [x] Task 5 completed
- [x] Task 6 completed
- [x] Task 7 completed
- [x] Task 8 completed
- [ ] Task 9 completed (Blocked on Tracks 2/3/4)
- [x] Task 10 completed

## Documentation Checks
- **Conflicts logged**:
  - `RUNNING.md` §6 blanket JWT/login statement conflicts with Track 4's upcoming public `/enquiry` and redirect routes.
  - `LINK_ATTRIBUTION_SETUP.md` is missing (Track 3 owner).
  - Content Studio ad URL documentation is missing (Track 3 owner).

## Test Execution Results (Baseline)
- Backend tests passed completely (`mvnw.cmd -o test` ran on the newly added tests successfully).
- Frontend tests for added component suites passed successfully (`npm test` confirmed all tests pass).
