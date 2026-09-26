# Backend API Reference

This document covers every REST endpoint exposed by the Aura Vault backend service (API v1). It includes the full OpenAPI 3.1 specification, per-endpoint documentation with request/response schemas, authentication requirements, rate limits, error codes, and code examples in JavaScript, Python, and cURL.

---

## Table of Contents

1. [Base URL and Versioning](#1-base-url-and-versioning)
2. [Authentication](#2-authentication)
3. [Rate Limits](#3-rate-limits)
4. [Common Response Schemas](#4-common-response-schemas)
5. [Error Codes](#5-error-codes)
6. [Endpoints](#6-endpoints)
   - [GET /v1/vault/info](#get-v1vaultinfo)
   - [GET /v1/vault/stats](#get-v1vaultstats)
   - [GET /v1/vault/apy](#get-v1vaultapy)
   - [GET /v1/accounts/{address}](#get-v1accountsaddress)
   - [POST /v1/deposit/prepare](#post-v1depositprepare)
   - [POST /v1/withdraw/prepare](#post-v1withdrawprepare)
   - [POST /v1/harvest/prepare](#post-v1harvestprepare)
   - [GET /v1/transactions/{hash}](#get-v1transactionshash)
   - [GET /v1/events](#get-v1events)
   - [GET /v1/governance/proposals](#get-v1governanceproposals)
   - [GET /v1/governance/proposals/{id}](#get-v1governanceproposalsid)
   - [GET /v1/health](#get-v1health)
7. [OpenAPI 3.1 Specification](#7-openapi-31-specification)
8. [Interactive Swagger UI](#8-interactive-swagger-ui)

---

## 1. Base URL and Versioning

| Environment | Base URL |
|---|---|
| Mainnet | `https://api.auravault.finance` |
| Testnet | `https://api-testnet.auravault.finance` |
| Local dev | `http://localhost:3000` |

All endpoints are versioned under `/v1/`. Breaking changes will introduce a new version prefix (`/v2/`, etc.) while keeping `/v1/` available for a deprecation window.

---

## 2. Authentication

### Public endpoints (no auth required)

The following endpoints are publicly accessible without any token:

- `GET /v1/vault/info`
- `GET /v1/vault/stats`
- `GET /v1/vault/apy`
- `GET /v1/accounts/{address}`
- `GET /v1/transactions/{hash}`
- `GET /v1/events`
- `GET /v1/governance/proposals`
- `GET /v1/governance/proposals/{id}`
- `GET /v1/health`

### Authenticated endpoints

The transaction preparation endpoints (`POST /v1/deposit/prepare`, `POST /v1/withdraw/prepare`, `POST /v1/harvest/prepare`) require a **Bearer token** in the `Authorization` header.

```
Authorization: Bearer <your-api-token>
```

Tokens are issued through the Aura dashboard or by contacting the team for API access. Tokens are scoped per environment (testnet tokens do not work on mainnet).

**Note:** These endpoints build unsigned XDR transaction envelopes. They do not send tokens or interact with the blockchain directly — the client must sign and submit the returned XDR.

---

## 3. Rate Limits

| Endpoint category | Limit | Window | Header on response |
|---|---|---|---|
| All read endpoints (`GET`) | 120 requests | 1 minute | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Transaction prep endpoints (`POST`) | 30 requests | 1 minute | Same headers |
| Burst allowance | 20 additional requests | 10 seconds | `X-RateLimit-Burst-Remaining` |

When a rate limit is exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header indicating the number of seconds until the limit resets.

---

## 4. Common Response Schemas

### Success envelope

All successful responses are wrapped in a standard envelope:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

### Paginated response

Endpoints returning lists support pagination:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 157,
    "hasNext": true
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

### Error envelope

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_SHARES",
    "message": "Caller share balance (100) is less than requested withdrawal amount (500)",
    "details": {}
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

---

## 5. Error Codes

| HTTP status | Error code | Description |
|---|---|---|
| 400 | `INVALID_REQUEST` | Missing or malformed request parameters |
| 400 | `INVALID_ADDRESS` | Stellar address is not a valid G-address |
| 400 | `ZERO_AMOUNT` | Amount must be greater than zero |
| 400 | `AMOUNT_TOO_SMALL` | Deposit would mint 0 shares at current exchange rate |
| 401 | `UNAUTHORIZED` | Missing or invalid Bearer token |
| 403 | `FORBIDDEN` | Token valid but lacks required scope |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `VAULT_PAUSED` | Vault is currently paused; operations blocked |
| 409 | `BALANCE_MISMATCH` | Flash loan guard would trigger on-chain |
| 409 | `INSUFFICIENT_SHARES` | Share balance too low for withdrawal |
| 422 | `SIMULATION_FAILED` | XDR simulation failed; see `details` for reason |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `HORIZON_UNAVAILABLE` | Stellar Horizon node is not reachable |

---

## 6. Endpoints

---

### GET /v1/vault/info

Returns static vault configuration: contract address, underlying token, admin, and current parameters.

**Authentication:** None required  
**Rate limit:** Standard read (120/min)

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "contractId": "CAAECFZQNM6XQTBL4NUBETQOAM2NBPOZXJM5OQJQBQN3DV6E3XSOMWB",
    "network": "testnet",
    "underlyingToken": {
      "contractId": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      "symbol": "USDC",
      "decimals": 7
    },
    "admin": "GADMIN7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7BBBB",
    "treasury": "GTREASURY4XKPQRTN7YXBPQGBYBWFRVSQZDYBFNXNJLFXBEXN7BBBB",
    "perfFeeBps": 1000,
    "mgmtFeeBps": 0,
    "isPaused": false,
    "version": 1,
    "layoutVersion": 1
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
curl https://api-testnet.auravault.finance/v1/vault/info
```

#### JavaScript

```js
const response = await fetch('https://api-testnet.auravault.finance/v1/vault/info');
const { data } = await response.json();
console.log('Contract:', data.contractId);
console.log('Paused:', data.isPaused);
```

#### Python

```python
import requests

resp = requests.get('https://api-testnet.auravault.finance/v1/vault/info')
resp.raise_for_status()
data = resp.json()['data']
print(f"Contract: {data['contractId']}")
print(f"Paused: {data['isPaused']}")
```

---

### GET /v1/vault/stats

Returns live vault state: total assets, total shares, current exchange rate, and accumulated fees.

**Authentication:** None required  
**Rate limit:** Standard read (120/min)

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "totalAssets": "10000000000",
    "totalShares": "9500000000",
    "exchangeRate": "1.052631578",
    "totalFeesCollected": "50000000",
    "sharePriceUsd": "1.052631578",
    "lastUpdatedLedger": 52318400,
    "lastUpdatedAt": "2026-08-27T11:47:01Z"
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

> `totalAssets` and `totalShares` are returned as strings to preserve precision for large i128 values. `exchangeRate` is `totalAssets / totalShares` as a decimal string.

#### cURL

```bash
curl https://api-testnet.auravault.finance/v1/vault/stats
```

#### JavaScript

```js
const response = await fetch('https://api-testnet.auravault.finance/v1/vault/stats');
const { data } = await response.json();
console.log('Exchange rate:', data.exchangeRate);
console.log('Total assets (stroops):', data.totalAssets);
```

#### Python

```python
import requests
from decimal import Decimal

resp = requests.get('https://api-testnet.auravault.finance/v1/vault/stats')
data = resp.json()['data']
rate = Decimal(data['exchangeRate'])
print(f"Exchange rate: {rate:.7f} token/share")
```

---

### GET /v1/vault/apy

Returns the vault's historical and projected APY, calculated from on-chain harvest events.

**Authentication:** None required  
**Rate limit:** Standard read (120/min)

#### Query parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `period` | `string` | No | Lookback window: `7d`, `30d`, `90d`, `all`. Default: `30d` |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "period": "30d",
    "apy": "0.1234",
    "apyPercent": "12.34",
    "harvestCount": 45,
    "totalYieldHarvested": "1234000000",
    "projectedAnnualYield": "15123456789"
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
curl "https://api-testnet.auravault.finance/v1/vault/apy?period=30d"
```

#### JavaScript

```js
const response = await fetch('https://api-testnet.auravault.finance/v1/vault/apy?period=30d');
const { data } = await response.json();
console.log(`30-day APY: ${data.apyPercent}%`);
```

#### Python

```python
import requests

resp = requests.get(
    'https://api-testnet.auravault.finance/v1/vault/apy',
    params={'period': '30d'}
)
data = resp.json()['data']
print(f"30-day APY: {data['apyPercent']}%")
```

---

### GET /v1/accounts/{address}

Returns a depositor's vault share balance, estimated token value, and deposit history.

**Authentication:** None required  
**Rate limit:** Standard read (120/min)

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `address` | `string` | A valid Stellar G-address |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "address": "GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7",
    "shares": "500000000",
    "estimatedTokenValue": "526315789",
    "estimatedUsdValue": "52.63",
    "depositCount": 3,
    "lastActivityAt": "2026-08-20T09:15:00Z"
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### Response `404 Not Found`

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No vault activity found for address GXXX..."
  }
}
```

#### cURL

```bash
curl "https://api-testnet.auravault.finance/v1/accounts/GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7"
```

#### JavaScript

```js
const address = 'GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7';
const response = await fetch(`https://api-testnet.auravault.finance/v1/accounts/${address}`);
const { data } = await response.json();
console.log(`Shares: ${data.shares}`);
console.log(`Estimated value: $${data.estimatedUsdValue}`);
```

#### Python

```python
import requests

address = 'GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7'
resp = requests.get(f'https://api-testnet.auravault.finance/v1/accounts/{address}')
data = resp.json()['data']
print(f"Shares: {data['shares']}")
print(f"Estimated value: ${data['estimatedUsdValue']}")
```

---

### POST /v1/deposit/prepare

Build an unsigned XDR transaction envelope for a vault deposit. The client must sign the returned XDR with Freighter (or any Stellar signer) and submit it to Horizon.

**Authentication:** Bearer token required  
**Rate limit:** 30/min

#### Request body

```json
{
  "caller": "GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7",
  "amount": "1000000000"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `caller` | `string` | Yes | Stellar address of the depositor |
| `amount` | `string` | Yes | Token stroops to deposit (must be positive integer string) |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "xdr": "AAAAAgAAAABkrz5tg9...truncated...AAAAA==",
    "simulatedShares": "943396226",
    "simulatedExchangeRate": "1.060000000",
    "fee": "100",
    "validUntilLedger": 52319000,
    "network": "testnet"
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

| Field | Description |
|---|---|
| `xdr` | Base64-encoded unsigned transaction envelope |
| `simulatedShares` | Shares that would be minted (from simulation) |
| `simulatedExchangeRate` | Current exchange rate used in simulation |
| `fee` | Estimated Stellar network fee in stroops |
| `validUntilLedger` | XDR expires at this ledger number (~5 minutes from build time) |

#### cURL

```bash
curl -X POST https://api-testnet.auravault.finance/v1/deposit/prepare \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caller": "GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7",
    "amount": "1000000000"
  }'
```

#### JavaScript

```js
async function prepareDeposit(callerAddress, amountStroops, apiToken) {
  const response = await fetch(
    'https://api-testnet.auravault.finance/v1/deposit/prepare',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caller: callerAddress,
        amount: String(amountStroops),
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Deposit prep failed: ${err.error.code} — ${err.error.message}`);
  }

  const { data } = await response.json();
  console.log(`Will mint ~${data.simulatedShares} shares`);
  return data.xdr; // sign this with Freighter, then submit to Horizon
}
```

#### Python

```python
import requests

def prepare_deposit(caller: str, amount_stroops: int, api_token: str) -> dict:
    resp = requests.post(
        'https://api-testnet.auravault.finance/v1/deposit/prepare',
        headers={
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json',
        },
        json={
            'caller': caller,
            'amount': str(amount_stroops),
        },
    )
    resp.raise_for_status()
    data = resp.json()['data']
    print(f"Will mint ~{data['simulatedShares']} shares")
    return data  # data['xdr'] is the unsigned transaction envelope
```

---

### POST /v1/withdraw/prepare

Build an unsigned XDR transaction envelope for a vault withdrawal.

**Authentication:** Bearer token required  
**Rate limit:** 30/min

#### Request body

```json
{
  "caller": "GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7",
  "shares": "500000000"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `caller` | `string` | Yes | Stellar address of the withdrawer |
| `shares` | `string` | Yes | Number of vault shares to burn (must be positive integer string) |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "xdr": "AAAAAgAAAABkrz5tg9...truncated...AAAAA==",
    "simulatedTokenAmount": "530000000",
    "simulatedExchangeRate": "1.060000000",
    "fee": "100",
    "validUntilLedger": 52319000,
    "network": "testnet"
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
curl -X POST https://api-testnet.auravault.finance/v1/withdraw/prepare \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caller": "GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7",
    "shares": "500000000"
  }'
```

#### JavaScript

```js
async function prepareWithdraw(callerAddress, sharesAmount, apiToken) {
  const response = await fetch(
    'https://api-testnet.auravault.finance/v1/withdraw/prepare',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caller: callerAddress,
        shares: String(sharesAmount),
      }),
    }
  );

  const { data } = await response.json();
  console.log(`Will redeem ~${data.simulatedTokenAmount} stroops`);
  return data.xdr;
}
```

#### Python

```python
def prepare_withdraw(caller: str, shares: int, api_token: str) -> dict:
    resp = requests.post(
        'https://api-testnet.auravault.finance/v1/withdraw/prepare',
        headers={
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json',
        },
        json={'caller': caller, 'shares': str(shares)},
    )
    resp.raise_for_status()
    return resp.json()['data']
```

---

### POST /v1/harvest/prepare

Build an unsigned XDR transaction envelope for a keeper harvest. The caller must hold sufficient underlying tokens and authorize the transaction.

**Authentication:** Bearer token required  
**Rate limit:** 30/min

#### Request body

```json
{
  "caller": "GKEEPER7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7BBBB",
  "yieldAmount": "10000000"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `caller` | `string` | Yes | Keeper's Stellar address |
| `yieldAmount` | `string` | Yes | Yield amount in underlying token stroops |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "xdr": "AAAAAgAAAABkrz5tg9...truncated...AAAAA==",
    "simulatedFeeAmount": "1000000",
    "simulatedNetYield": "9000000",
    "fee": "100",
    "validUntilLedger": 52319000,
    "network": "testnet"
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
curl -X POST https://api-testnet.auravault.finance/v1/harvest/prepare \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caller": "GKEEPER7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7BBBB",
    "yieldAmount": "10000000"
  }'
```

#### JavaScript

```js
async function prepareHarvest(keeperAddress, yieldAmountStroops, apiToken) {
  const response = await fetch(
    'https://api-testnet.auravault.finance/v1/harvest/prepare',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caller: keeperAddress,
        yieldAmount: String(yieldAmountStroops),
      }),
    }
  );

  const { data } = await response.json();
  console.log(`Net yield after fee: ${data.simulatedNetYield} stroops`);
  return data.xdr;
}
```

#### Python

```python
def prepare_harvest(caller: str, yield_amount: int, api_token: str) -> dict:
    resp = requests.post(
        'https://api-testnet.auravault.finance/v1/harvest/prepare',
        headers={
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json',
        },
        json={'caller': caller, 'yieldAmount': str(yield_amount)},
    )
    resp.raise_for_status()
    return resp.json()['data']
```

---

### GET /v1/transactions/{hash}

Look up a previously submitted transaction by its Stellar transaction hash.

**Authentication:** None required  
**Rate limit:** Standard read (120/min)

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `hash` | `string` | 64-character hex Stellar transaction hash |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "hash": "a1b2c3d4e5f6...64chars",
    "status": "success",
    "type": "deposit",
    "caller": "GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7",
    "amount": "1000000000",
    "sharesIssued": "943396226",
    "ledger": 52318400,
    "timestamp": "2026-08-27T11:45:00Z",
    "fee": "100"
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
TX_HASH="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
curl "https://api-testnet.auravault.finance/v1/transactions/${TX_HASH}"
```

#### JavaScript

```js
const txHash = 'a1b2c3d4e5f6...';
const response = await fetch(`https://api-testnet.auravault.finance/v1/transactions/${txHash}`);
const { data } = await response.json();
console.log(`Status: ${data.status}, shares issued: ${data.sharesIssued}`);
```

#### Python

```python
tx_hash = 'a1b2c3d4e5f6...'
resp = requests.get(f'https://api-testnet.auravault.finance/v1/transactions/{tx_hash}')
data = resp.json()['data']
print(f"Status: {data['status']}, shares: {data.get('sharesIssued', 'N/A')}")
```

---

### GET /v1/events

Stream or paginate recent on-chain vault events (deposits, withdrawals, harvests, pauses, upgrades).

**Authentication:** None required  
**Rate limit:** Standard read (120/min)

#### Query parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `string` | No | all | Filter by event type: `deposit`, `withdraw`, `harvest`, `harvest_token`, `pause`, `unpause`, `upgrade`, `suspicious` |
| `address` | `string` | No | — | Filter events where this address is the caller |
| `fromLedger` | `integer` | No | latest-100 | Start ledger for the event window |
| `toLedger` | `integer` | No | latest | End ledger for the event window |
| `page` | `integer` | No | 1 | Page number |
| `pageSize` | `integer` | No | 20 | Results per page (max 100) |

#### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "52318400-0",
      "type": "deposit",
      "ledger": 52318400,
      "timestamp": "2026-08-27T11:45:00Z",
      "txHash": "a1b2c3d4e5f6...64chars",
      "caller": "GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7",
      "amount": "1000000000",
      "sharesIssued": "943396226",
      "newTotalShares": "9500000000",
      "newTotalAssets": "10000000000"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1456,
    "hasNext": true
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
# All deposit events for a specific address
curl "https://api-testnet.auravault.finance/v1/events?type=deposit&address=GDEPOSITOR7LXQJUV7YXKPYQ3NQPQGBYBWFRVSQZDYBFNXNJLFXBEXN7"
```

#### JavaScript

```js
async function getDepositEvents(address) {
  const params = new URLSearchParams({ type: 'deposit', address, pageSize: '50' });
  const response = await fetch(
    `https://api-testnet.auravault.finance/v1/events?${params}`
  );
  const { data, pagination } = await response.json();
  console.log(`Found ${pagination.total} deposit events`);
  return data;
}
```

#### Python

```python
def get_events(event_type: str = 'deposit', address: str = None) -> list:
    params = {'type': event_type, 'pageSize': 50}
    if address:
        params['address'] = address
    resp = requests.get(
        'https://api-testnet.auravault.finance/v1/events',
        params=params,
    )
    resp.raise_for_status()
    return resp.json()['data']
```

---

### GET /v1/governance/proposals

List all governance proposals.

**Authentication:** None required  
**Rate limit:** Standard read (120/min)

#### Query parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `status` | `string` | No | all | Filter: `Pending`, `Approved`, `Executed`, `Rejected` |
| `page` | `integer` | No | 1 | Page number |
| `pageSize` | `integer` | No | 20 | Results per page |

#### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "UpdateParameter",
      "status": "Approved",
      "proposer": "GSIGNER1_ADDRESS",
      "votesFor": 3,
      "votesAgainst": 0,
      "requiredSignatures": 3,
      "createdAt": "2026-08-26T10:00:00Z",
      "executionEligibleAt": "2026-08-27T10:00:00Z",
      "executedAt": null,
      "parameter": {
        "name": "perf_fee_bps",
        "value": "500"
      }
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 5, "hasNext": false },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
curl "https://api-testnet.auravault.finance/v1/governance/proposals?status=Pending"
```

---

### GET /v1/governance/proposals/{id}

Fetch a single governance proposal by ID.

**Authentication:** None required  
**Rate limit:** Standard read (120/min)

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | `integer` | Proposal ID (returned from `propose_*` contract calls) |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "UpdateParameter",
    "status": "Approved",
    "proposer": "GSIGNER1_ADDRESS",
    "signers": ["GSIGNER1_ADDRESS", "GSIGNER2_ADDRESS", "GSIGNER3_ADDRESS"],
    "votesFor": 3,
    "votesAgainst": 0,
    "requiredSignatures": 3,
    "createdAt": "2026-08-26T10:00:00Z",
    "executionEligibleAt": "2026-08-27T10:00:00Z",
    "executedAt": null,
    "parameter": {
      "name": "perf_fee_bps",
      "value": "500"
    }
  },
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
curl "https://api-testnet.auravault.finance/v1/governance/proposals/1"
```

---

### GET /v1/health

Liveness/readiness check for monitoring and load balancers.

**Authentication:** None required  
**Rate limit:** Not rate-limited

#### Response `200 OK` (healthy)

```json
{
  "status": "ok",
  "version": "1.4.2",
  "uptime": 86400,
  "horizon": "connected",
  "rpcNode": "connected",
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### Response `503 Service Unavailable` (degraded)

```json
{
  "status": "degraded",
  "version": "1.4.2",
  "uptime": 86400,
  "horizon": "disconnected",
  "rpcNode": "connected",
  "timestamp": "2026-08-27T11:48:39Z"
}
```

#### cURL

```bash
curl https://api-testnet.auravault.finance/v1/health
```

---

## 7. OpenAPI 3.1 Specification

```yaml
openapi: 3.1.0
info:
  title: Aura Vault API
  version: 1.0.0
  description: >
    REST API for the Aura Vault Protocol — a share-based yield vault on Soroban/Stellar.
    Read endpoints are public. Transaction preparation endpoints require Bearer authentication.
  contact:
    name: Aura Vault Team
    url: https://auravault.finance
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.auravault.finance
    description: Mainnet
  - url: https://api-testnet.auravault.finance
    description: Testnet

security: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    SuccessEnvelope:
      type: object
      required: [success, data, timestamp]
      properties:
        success:
          type: boolean
          example: true
        data:
          type: object
        timestamp:
          type: string
          format: date-time

    ErrorEnvelope:
      type: object
      required: [success, error, timestamp]
      properties:
        success:
          type: boolean
          example: false
        error:
          type: object
          required: [code, message]
          properties:
            code:
              type: string
              example: INSUFFICIENT_SHARES
            message:
              type: string
            details:
              type: object
        timestamp:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        page:
          type: integer
        pageSize:
          type: integer
        total:
          type: integer
        hasNext:
          type: boolean

    VaultInfo:
      type: object
      properties:
        contractId:
          type: string
        network:
          type: string
          enum: [mainnet, testnet]
        underlyingToken:
          type: object
          properties:
            contractId:
              type: string
            symbol:
              type: string
            decimals:
              type: integer
        admin:
          type: string
        treasury:
          type: string
        perfFeeBps:
          type: integer
        mgmtFeeBps:
          type: integer
        isPaused:
          type: boolean
        version:
          type: integer
        layoutVersion:
          type: integer

    VaultStats:
      type: object
      properties:
        totalAssets:
          type: string
          description: i128 value as string (stroops)
        totalShares:
          type: string
          description: i128 value as string
        exchangeRate:
          type: string
          description: Decimal string (totalAssets / totalShares)
        totalFeesCollected:
          type: string
        sharePriceUsd:
          type: string
        lastUpdatedLedger:
          type: integer
        lastUpdatedAt:
          type: string
          format: date-time

    AccountInfo:
      type: object
      properties:
        address:
          type: string
        shares:
          type: string
        estimatedTokenValue:
          type: string
        estimatedUsdValue:
          type: string
        depositCount:
          type: integer
        lastActivityAt:
          type: string
          format: date-time

    PrepareRequest:
      type: object
      required: [caller]
      properties:
        caller:
          type: string
          description: Stellar G-address of the transaction signer

    DepositPrepareRequest:
      allOf:
        - $ref: '#/components/schemas/PrepareRequest'
        - type: object
          required: [amount]
          properties:
            amount:
              type: string
              description: Token stroops (positive integer as string)

    WithdrawPrepareRequest:
      allOf:
        - $ref: '#/components/schemas/PrepareRequest'
        - type: object
          required: [shares]
          properties:
            shares:
              type: string
              description: Vault shares to burn (positive integer as string)

    HarvestPrepareRequest:
      allOf:
        - $ref: '#/components/schemas/PrepareRequest'
        - type: object
          required: [yieldAmount]
          properties:
            yieldAmount:
              type: string
              description: Yield token stroops (positive integer as string)

    PrepareResponse:
      type: object
      properties:
        xdr:
          type: string
          description: Base64-encoded unsigned XDR transaction envelope
        fee:
          type: string
          description: Estimated network fee in stroops
        validUntilLedger:
          type: integer
        network:
          type: string

    VaultEvent:
      type: object
      properties:
        id:
          type: string
        type:
          type: string
          enum: [deposit, withdraw, harvest, harvest_token, pause, unpause, upgrade, suspicious]
        ledger:
          type: integer
        timestamp:
          type: string
          format: date-time
        txHash:
          type: string
        caller:
          type: string

    Proposal:
      type: object
      properties:
        id:
          type: integer
        type:
          type: string
          enum: [UpdateAdmin, UpdateUnderlyingToken, UpdateParameter]
        status:
          type: string
          enum: [Pending, Approved, Executed, Rejected]
        proposer:
          type: string
        votesFor:
          type: integer
        votesAgainst:
          type: integer
        requiredSignatures:
          type: integer
        createdAt:
          type: string
          format: date-time
        executionEligibleAt:
          type: string
          format: date-time
        executedAt:
          type: string
          format: date-time
          nullable: true

  responses:
    Unauthorized:
      description: Missing or invalid Bearer token
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'
    RateLimited:
      description: Too many requests
      headers:
        Retry-After:
          schema:
            type: integer
          description: Seconds until rate limit resets
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'

paths:
  /v1/vault/info:
    get:
      summary: Vault configuration
      description: Returns static vault configuration including contract address, token, admin, and fee settings.
      operationId: getVaultInfo
      tags: [Vault]
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/VaultInfo'
        '429':
          $ref: '#/components/responses/RateLimited'

  /v1/vault/stats:
    get:
      summary: Live vault statistics
      operationId: getVaultStats
      tags: [Vault]
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/VaultStats'

  /v1/vault/apy:
    get:
      summary: Vault APY
      operationId: getVaultApy
      tags: [Vault]
      parameters:
        - name: period
          in: query
          schema:
            type: string
            enum: [7d, 30d, 90d, all]
            default: 30d
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SuccessEnvelope'

  /v1/accounts/{address}:
    get:
      summary: Account vault balance
      operationId: getAccount
      tags: [Accounts]
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/AccountInfo'
        '404':
          $ref: '#/components/responses/NotFound'

  /v1/deposit/prepare:
    post:
      summary: Prepare deposit transaction
      operationId: prepareDeposit
      tags: [Transactions]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DepositPrepareRequest'
      responses:
        '200':
          description: Unsigned XDR ready for signing
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        allOf:
                          - $ref: '#/components/schemas/PrepareResponse'
                          - type: object
                            properties:
                              simulatedShares:
                                type: string
                              simulatedExchangeRate:
                                type: string
        '401':
          $ref: '#/components/responses/Unauthorized'
        '409':
          description: Vault paused or flash loan guard would trigger
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorEnvelope'

  /v1/withdraw/prepare:
    post:
      summary: Prepare withdrawal transaction
      operationId: prepareWithdraw
      tags: [Transactions]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WithdrawPrepareRequest'
      responses:
        '200':
          description: Unsigned XDR ready for signing
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        allOf:
                          - $ref: '#/components/schemas/PrepareResponse'
                          - type: object
                            properties:
                              simulatedTokenAmount:
                                type: string
        '401':
          $ref: '#/components/responses/Unauthorized'
        '409':
          description: Insufficient shares or vault paused
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorEnvelope'

  /v1/harvest/prepare:
    post:
      summary: Prepare harvest transaction
      operationId: prepareHarvest
      tags: [Transactions]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/HarvestPrepareRequest'
      responses:
        '200':
          description: Unsigned XDR ready for signing
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        allOf:
                          - $ref: '#/components/schemas/PrepareResponse'
                          - type: object
                            properties:
                              simulatedFeeAmount:
                                type: string
                              simulatedNetYield:
                                type: string
        '401':
          $ref: '#/components/responses/Unauthorized'

  /v1/transactions/{hash}:
    get:
      summary: Transaction details
      operationId: getTransaction
      tags: [Transactions]
      parameters:
        - name: hash
          in: path
          required: true
          schema:
            type: string
            minLength: 64
            maxLength: 64
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SuccessEnvelope'
        '404':
          $ref: '#/components/responses/NotFound'

  /v1/events:
    get:
      summary: Vault events feed
      operationId: getEvents
      tags: [Events]
      parameters:
        - name: type
          in: query
          schema:
            type: string
            enum: [deposit, withdraw, harvest, harvest_token, pause, unpause, upgrade, suspicious]
        - name: address
          in: query
          schema:
            type: string
        - name: fromLedger
          in: query
          schema:
            type: integer
        - name: toLedger
          in: query
          schema:
            type: integer
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: pageSize
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/VaultEvent'
                      pagination:
                        $ref: '#/components/schemas/Pagination'

  /v1/governance/proposals:
    get:
      summary: List governance proposals
      operationId: listProposals
      tags: [Governance]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [Pending, Approved, Executed, Rejected]
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: pageSize
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/Proposal'
                      pagination:
                        $ref: '#/components/schemas/Pagination'

  /v1/governance/proposals/{id}:
    get:
      summary: Get proposal by ID
      operationId: getProposal
      tags: [Governance]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessEnvelope'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/Proposal'
        '404':
          $ref: '#/components/responses/NotFound'

  /v1/health:
    get:
      summary: Health check
      operationId: healthCheck
      tags: [System]
      responses:
        '200':
          description: Service healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [ok, degraded]
                  version:
                    type: string
                  uptime:
                    type: integer
                  horizon:
                    type: string
                  rpcNode:
                    type: string
                  timestamp:
                    type: string
                    format: date-time
        '503':
          description: Service degraded
```

---

## 8. Interactive Swagger UI

The OpenAPI spec above is served as an interactive Swagger UI at:

| Environment | URL |
|---|---|
| Testnet | `https://api-testnet.auravault.finance/api/docs` |
| Mainnet | `https://api.auravault.finance/api/docs` |

The Swagger UI allows you to:

- Browse all endpoints with live documentation.
- Enter your Bearer token via the **Authorize** button to test authenticated endpoints directly in the browser.
- Inspect request/response schemas and example payloads.
- Execute requests and see real responses.

To use a Bearer token in Swagger UI:

1. Click **Authorize** (lock icon in the top-right).
2. Paste your token in the `BearerAuth` field.
3. Click **Authorize**, then **Close**.
4. Any `POST` request will now include the Authorization header automatically.

---

*Issues: [#387](https://github.com/soterika/aura-vault-protocol/issues/387)*
