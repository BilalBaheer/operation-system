# Deploying the OMS inspection module to Azure

Target: **Azure Container Apps** (one app per service) + **Azure Database for PostgreSQL Flexible Server**
+ **Azure Container Registry (ACR)** + **Azure Key Vault** for secrets.

## 1. One-time infrastructure

```bash
RG=rg-oms-inspection-prod
LOC=westus2
ACR=omsinspectionacr
ENV=oms-inspection-env

az group create -n $RG -l $LOC
az acr create -g $RG -n $ACR --sku Basic
az containerapp env create -g $RG -n $ENV -l $LOC
az postgres flexible-server create -g $RG -n oms-inspection-pg --tier Burstable --sku-name Standard_B1ms \
  --version 16 --public-access None            # private networking only
az keyvault create -g $RG -n kv-oms-inspection
az keyvault secret set --vault-name kv-oms-inspection -n jwt-secret --value "<long random value>"
```

## 2. Build and push images (done by the CI/CD pipeline on every tagged release)

```bash
TAG=v1.1.0
for svc in auth-service inspection-service web; do
  az acr build -r $ACR -t oms/$svc:$TAG ./$svc
done
```

## 3. Deploy / update each container app

```bash
az containerapp create -g $RG -n inspection-service --environment $ENV \
  --image $ACR.azurecr.io/oms/inspection-service:$TAG --registry-server $ACR.azurecr.io \
  --ingress internal --target-port 4002 --min-replicas 1 --max-replicas 5 \
  --secrets jwt-secret=keyvaultref:https://kv-oms-inspection.vault.azure.net/secrets/jwt-secret,identityref:system \
            db-url=keyvaultref:https://kv-oms-inspection.vault.azure.net/secrets/project-db-url,identityref:system \
  --env-vars JWT_SECRET=secretref:jwt-secret DATABASE_URL=secretref:db-url DB_SSL=true REPO_DRIVER=postgres
# auth-service: same pattern on port 4001 (internal ingress)
# web: --ingress external --target-port 3000, with AUTH_SERVICE_URL and INSPECTION_SERVICE_URL set to the internal app URLs
```

## 4. Database migrations

Run once per release, before traffic moves to the new revision:

```bash
az containerapp job start -g $RG -n inspection-migrate   # runs: node scripts/migrate.js
```

## 5. Safe rollout and rollback

Container Apps keeps each deployment as a **revision**. New revisions get a small share of traffic first (canary):

```bash
az containerapp ingress traffic set -g $RG -n inspection-service --revision-weight latest=10 <previous-revision>=90
# if health checks and error rates look good:
az containerapp ingress traffic set -g $RG -n inspection-service --revision-weight latest=100
# rollback: send 100% back to the previous revision
```
