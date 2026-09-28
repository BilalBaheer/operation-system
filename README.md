# Operation System 

Cloud-based Operations Management System for  project management.

## inspection-service

A Node.js/Express microservice that validates inspection records, calculates repair priority,
and controls the draft → submitted → approved review workflow.

```bash
cd inspection-service
npm install
npm run demo            # prints the core logic outputs
npm test                # runs the Jest unit tests
npm run test:coverage   # runs tests with a coverage report
```

## Branching model

- `main` – stable, released code only (every release is tagged)
- `develop` – integration branch for finished features
- `feature/*` – one branch per feature, merged into `develop` with a pull request
- `release/*` – final checks before merging into `main`
- `hotfix/*` – urgent fixes branched from `main`
