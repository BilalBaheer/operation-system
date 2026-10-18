# Changelog

## v1.1.1 – System testing fixes (Unit 7)
- Fixed: an inspector trying to approve a submitted inspection got 409 Conflict instead of 403 Forbidden (found by acceptance test AT-07). Added `PermissionError` mapped to 403.
- Added API regression test for the 403 case (36 unit/API tests total)
- Added `perf/acceptance.js` (12 Given/When/Then acceptance tests through the gateway)
- Added `perf/soak-test.js` (60 s mixed-traffic stability test with memory sampling; works on Linux and Windows)
- Added `perf/volume-check.js` (checks the list endpoint after the soak test)
- Restored `CHANGELOG.md`, which had been renamed to an empty `CHANGE2.md` on main
- Known limitation, planned for v1.2.0: drafts cannot be edited yet (acceptance test AT-12)
- Known limitation, planned for v1.2.0: `GET /api/inspections` is capped at 100 records and ignores paging parameters (volume check)

## v1.1.0 – Full system integration
- New `auth-service`: bcrypt login and JWT issuing (issuer `oms-auth-service`)
- New `web` gateway and inspection UI (login, create, list, filter, submit/approve)
- `inspection-service` now persists to PostgreSQL with findings in one transaction
- Outbox table records `InspectionCreated` / `InspectionStatusChanged` events for Service Bus
- New endpoints: `GET /api/inspections` (filters, priority order) and `GET /api/inspections/:id`
- Fixed: non-UUID ids caused a 500 error instead of 404 (found by integration tests)
- Fixed: validation messages rewritten in plain language after usability review
- Added Dockerfiles, docker-compose, `.env.example`, Azure deployment guide
- Added autocannon load test (latency, throughput, memory)

## v1.0.0 – Final release
- Inspection module ready for the OMS production environment
- Version bumped to 1.0.0

## v0.2.0 – Testing complete
- 32 Jest unit tests (white-box, service-layer with mocks, black-box API)
- Fixed: condition rating 5 was wrongly rejected (off-by-one)
- Fixed: inspection dates in the future were accepted
- Fixed: unknown workflow status crashed `canTransition`
- Added GitHub Actions workflow that runs the tests automatically

## v0.1.0 – Initial development
- Inspection validation, repair priority calculation, and status workflow
- Express routes protected by JWT role checks
- In-memory repository and event publisher for local runs
