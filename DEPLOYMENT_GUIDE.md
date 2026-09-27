# Aura Vault - Deployment Guide

## Prerequisites

- Rust toolchain with Soroban target
- Stellar CLI installed: `stellar contract` commands available
- Testnet XLM and token funds for testing
- SEP-41 token contract deployed (or known token ID)
- Admin keypair with funding
- Deployment documentation access

## Build for Deployment

### 1. Verify Tests Pass

```bash
cd aura-vault
cargo test
```

Expected: All 22 tests pass with no warnings.

### 2. Build Release WASM

```bash
cargo build --target wasm32-unknown-unknown --release
```

Output: `target/wasm32-unknown-unknown/release/aura_vault.wasm`

### 3. Verify Binary Size

```bash
ls -lh target/wasm32-unknown-unknown/release/aura_vault.wasm
```

Expected: Under 1 MB. If larger, investigate for bloat.

---

## Testnet Deployment

### Step 1: Upload WASM

```bash
# Set variables
WASM_PATH="./target/wasm32-unknown-unknown/release/aura_vault.wasm"
ADMIN_KEY="S..."  # Your admin keypair
NETWORK="testnet"

# Upload
WASM_HASH=$(stellar contract upload \
  --wasm "$WASM_PATH" \
  --source "$ADMIN_KEY" \
  --network "$NETWORK" \
  --output json | jq -r '.wasm_id')

echo "WASM Hash: $WASM_HASH"
```

**Verification**:
- [ ] Command succeeds
- [ ] WASM hash returned (32 bytes hex)
- [ ] Hash recorded in deployment notes

### Step 2: Deploy Contract Instance

```bash
# Deploy with the WASM hash
CONTRACT_ID=$(stellar contract deploy \
  --wasm-hash "$WASM_HASH" \
  --source "$ADMIN_KEY" \
  --network "$NETWORK" \
  --output json | jq -r '.contract_id')

echo "Contract ID: $CONTRACT_ID"
```

**Verification**:
- [ ] Command succeeds
- [ ] Contract ID returned (starts with 'C')
- [ ] Contract ID recorded

### Step 3: Initialize Vault

Prepare initialization parameters:

```bash
ADMIN_ADDRESS="G..."         # Admin public key
TOKEN_CONTRACT_ID="C..."     # SEP-41 token contract

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ADMIN_KEY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$ADMIN_ADDRESS" \
  --underlying_token "$TOKEN_CONTRACT_ID"
```

**Verification**:
- [ ] TX succeeds (no error code)
- [ ] TX hash recorded
- [ ] Can call `total_assets()` with result 0

### Step 4: Verify Vault State

```bash
# Check total assets (should be 0)
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network "$NETWORK" \
  -- total_assets

# Check admin
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network "$NETWORK" \
  -- balance_of \
  --address "$ADMIN_ADDRESS"
```

**Verification**:
- [ ] `total_assets()` returns 0
- [ ] Contract responds to queries
- [ ] No permission errors

### Step 5: Test Deposit

```bash
TEST_USER="G..."  # Test user public key
TEST_AMOUNT=1000000

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$TEST_USER" \
  --network "$NETWORK" \
  -- deposit \
  --caller "$TEST_USER" \
  --amount "$TEST_AMOUNT"
```

**Verification**:
- [ ] TX succeeds
- [ ] `balance_of(TEST_USER)` returns expected shares
- [ ] `total_assets()` returns TEST_AMOUNT

---

## Mainnet Deployment

### Preparation Phase (Week Before)

1. **Code Review**
   - [ ] Contract code reviewed by 2+ developers
   - [ ] All edge cases documented
   - [ ] No `unwrap()` or `expect()` in production code

2. **Security Audit**
   - [ ] Internal audit completed
   - [ ] External audit considered (for high-value vaults)
   - [ ] All findings resolved

3. **Testnet Soak Period**
   - [ ] Run on testnet for minimum 7 days
   - [ ] Monitor for state corruption
   - [ ] Verify harvest automation works
   - [ ] Test withdrawal under load

4. **Documentation**
   - [ ] API docs finalized
   - [ ] Integration guide completed
   - [ ] Deployment procedures documented
   - [ ] Runbook created

5. **Team Preparation**
   - [ ] Support team trained
   - [ ] Incident response plan documented
   - [ ] On-call schedule established
   - [ ] Monitoring alerts configured

### Deployment Phase

#### Step 1: Build & Sign Artifacts

```bash
# Build release binary
cargo build --target wasm32-unknown-unknown --release

# Hash for verification
WASM_HASH=$(sha256sum target/wasm32-unknown-unknown/release/aura_vault.wasm | cut -d' ' -f1)
echo "SHA256: $WASM_HASH"

# Sign for auditing
gpg --sign --detach-sign target/wasm32-unknown-unknown/release/aura_vault.wasm
```

**Verification**:
- [ ] WASM binary matches testnet version
- [ ] Hash documented
- [ ] Signatures created

#### Step 2: Upload WASM to Mainnet

```bash
ADMIN_KEY="S..."      # Mainnet admin keypair
WASM_PATH="./target/wasm32-unknown-unknown/release/aura_vault.wasm"

WASM_ID=$(stellar contract upload \
  --wasm "$WASM_PATH" \
  --source "$ADMIN_KEY" \
  --network mainnet \
  --output json | jq -r '.wasm_id')

echo "Mainnet WASM ID: $WASM_ID"
```

**Wait**: Confirm upload on testnet before proceeding.

```bash
# Verify WASM exists
stellar contract info \
  --wasm-hash "$WASM_ID" \
  --network mainnet
```

#### Step 3: Deploy Instance

```bash
CONTRACT_ID=$(stellar contract deploy \
  --wasm-hash "$WASM_ID" \
  --source "$ADMIN_KEY" \
  --network mainnet \
  --output json | jq -r '.contract_id')

echo "Mainnet Contract: $CONTRACT_ID"
```

**Verification**:
- [ ] Contract ID recorded
- [ ] TX hash recorded
- [ ] Updated in configuration

#### Step 4: Initialize on Mainnet

```bash
ADMIN_ADDRESS="G..."              # Mainnet admin
PRODUCTION_TOKEN="C..."           # Production token contract

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ADMIN_KEY" \
  --network mainnet \
  -- initialize \
  --admin "$ADMIN_ADDRESS" \
  --underlying_token "$PRODUCTION_TOKEN"
```

**Verification**:
- [ ] TX succeeds
- [ ] No errors in result

#### Step 5: Verify Mainnet Deployment

```bash
# Verify contract responds
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network mainnet \
  -- total_assets

# Check version
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network mainnet \
  -- version
```

**Verification**:
- [ ] `total_assets()` returns 0
- [ ] `version()` returns 1
- [ ] No permission errors

#### Step 6: Enable Deposits

Once verified, announce to users:

```bash
# Create announcement
cat > DEPLOYMENT_ANNOUNCEMENT.md << EOF
# Aura Vault Live on Mainnet

Contract: $CONTRACT_ID
Network: Mainnet
Token: $PRODUCTION_TOKEN
Deployed: $(date)

## Integration

See INTEGRATION_GUIDE.md for API details.

## First Depositors

The first 1M tokens will receive 1:1 share ratio.

## Support

Contact: support@aura-vault.dev
EOF
```

---

## Post-Deployment

### Monitoring Setup

1. **Block Explorer**
   - [ ] Contract pinned in favorites
   - [ ] TX history accessible

2. **Webhook Monitoring**
   - [ ] Event indexer running
   - [ ] Webhooks being received
   - [ ] Alerts configured

3. **Metrics**
   - [ ] Total assets tracked
   - [ ] Total shares tracked
   - [ ] Exchange rate calculated
   - [ ] Deposit/withdraw volume tracked

4. **Alerts**
   - [ ] Large deposits (> threshold)
   - [ ] Unusual patterns detected
   - [ ] Failed TXs logged
   - [ ] Error rate monitoring

### Operational Procedures

#### Daily Checklist

```bash
#!/bin/bash

CONTRACT_ID="C..."
NETWORK="mainnet"

echo "=== Daily Vault Health Check ==="
echo "Time: $(date)"

# Check total assets
TOTAL=$(stellar contract invoke --id "$CONTRACT_ID" --network "$NETWORK" -- total_assets)
echo "Total Assets: $TOTAL"

# Check contract is responsive
if [ -z "$TOTAL" ]; then
  echo "ERROR: Contract not responding"
  exit 1
fi

# Check recent transactions (via block explorer API)
echo "Recent TXs: $(curl -s https://horizon-mainnet.stellar.org/accounts/$CONTRACT_ID/transactions | jq '.records | length')"

echo "Status: OK"
```

#### Weekly Review

- [ ] Review total assets growth
- [ ] Check for failed transactions
- [ ] Review harvest logs
- [ ] Monitor gas costs
- [ ] Verify admin controls working

#### Emergency Response

If issues detected:

```bash
# 1. Verify issue
stellar contract invoke --id "$CONTRACT_ID" --network mainnet -- total_assets

# 2. Check TX history for recent errors
# Use block explorer to review failed TXs

# 3. Post incident report
# Document findings, impact, resolution

# 4. If critical: pause deposits (requires upgrade)
# Deploy upgraded contract with deposits halted

# 5. Communicate with users
# Send notification to support channels
```

---

## Upgrade Procedure (Future)

### When to Upgrade

- [ ] Bug found requiring immediate fix
- [ ] Feature addition requested
- [ ] Performance optimization needed
- [ ] Security patch required

### Upgrade Steps

```bash
# 1. Build new WASM
cargo build --target wasm32-unknown-unknown --release

# 2. Test on testnet upgrade path
stellar contract upload --wasm ... --network testnet
stellar contract invoke --id <testnet-id> --source <admin> -- upgrade \
  --new_wasm_hash <new-hash>

# 3. Verify testnet after upgrade
stellar contract invoke --id <testnet-id> --network testnet -- version

# 4. Deploy to mainnet (only after testnet validation)
stellar contract upload --wasm ... --network mainnet
stellar contract invoke --id <mainnet-id> --source <admin> -- upgrade \
  --new_wasm_hash <new-hash>

# 5. Verify mainnet
stellar contract invoke --id <mainnet-id> --network mainnet -- version
```

---

## Deployment Checklist Summary

**Pre-Deployment**:
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Binary built
- [ ] Documentation ready

**Testnet**:
- [ ] WASM uploaded
- [ ] Contract deployed
- [ ] Initialized successfully
- [ ] Deposits/withdrawals working
- [ ] Errors handled correctly

**Mainnet**:
- [ ] Same WASM/code as testnet
- [ ] WASM uploaded to mainnet
- [ ] Contract deployed
- [ ] Initialized with production token
- [ ] Initial verification passed
- [ ] Monitoring active
- [ ] Support ready

**Post-Launch**:
- [ ] Daily health checks running
- [ ] Alerts configured
- [ ] Incident response plan active
- [ ] Team trained

---

## Support Contacts

**Deployment Issues**: deployment-support@aura-vault.dev
**Emergency**: emergency@aura-vault.dev (24/7)
**General**: support@aura-vault.dev

---

## Database Migration Safety Check (Issue #962)

Every SQL migration file under `backend/migrations/` is automatically linted
for backwards-incompatible changes before the deployment pipeline proceeds.
The check runs as the **first job** in `.github/workflows/deploy.yml`, so a
failing lint result **blocks all downstream jobs** (build, push, deploy).

### What the lint script checks

| Rule | Example | Why it blocks deployment |
|---|---|---|
| `DROP TABLE` | `DROP TABLE vault_positions;` | Destroys data; rollback is impossible |
| `DROP COLUMN` | `ALTER TABLE t DROP COLUMN foo;` | Removes data; breaks code still reading that column |
| `NOT NULL` without DEFAULT | `ALTER TABLE t ADD COLUMN x INT NOT NULL;` | Fails for tables with existing rows |
| `RENAME COLUMN` | `ALTER TABLE t RENAME COLUMN a TO b;` | Breaking change for code still using the old name |

### Running the check locally

```bash
cd backend
npx ts-node scripts/lint-migrations.ts --verbose
```

Exit code `0` = safe to deploy. Exit code `1` = violations found; deployment is blocked.

### Overriding for intentional breaking changes

If a migration is intentionally destructive (e.g., a DROP TABLE that removes a
fully-deprecated table after a safe two-sprint window), add a structured
override comment **at the top of the migration file** with a required
justification:

```sql
-- lint-migrations: allow DROP TABLE  reason: legacy payments table removed after 3-sprint deprecation; data migrated to events table in 018
-- lint-migrations: allow DROP COLUMN reason: column sunset in API v2; all consumers updated per RFC-44

BEGIN;
DROP TABLE legacy_payments;
...
COMMIT;
```

The `reason:` portion is **required**. An override comment without `reason:`
is treated as invalid and the violation is still reported.

> **Important**: An override comment is an audit trail, not a bypass.
> It communicates intent to reviewers and is logged in the CI summary.
> Breaking changes should always be paired with a deploy runbook entry
> describing the coordination steps (dual-read window, backfill scripts, etc.).
