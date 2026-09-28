# Changelog

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
