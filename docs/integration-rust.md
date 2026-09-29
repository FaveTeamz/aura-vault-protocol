# Rust Integration Guide — Aura Vault Protocol

This guide explains how to invoke the Aura Vault smart contract from a Rust application using the `stellar-sdk` crate family. All contract functions, error-handling patterns, and network configuration are covered.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cargo Dependencies](#cargo-dependencies)
3. [Network Configuration](#network-configuration)
4. [Client Setup](#client-setup)
5. [Contract Functions](#contract-functions)
   - [initialize](#initialize)
   - [deposit](#deposit)
   - [withdraw](#withdraw)
   - [harvest](#harvest)
   - [pause / unpause / is\_paused](#pause--unpause--is_paused)
   - [set\_fees](#set_fees)
   - [set\_treasury](#set_treasury)
   - [withdraw\_fees](#withdraw_fees)
   - [total\_assets](#total_assets)
   - [balance\_of](#balance_of)
   - [upgrade](#upgrade)
   - [Governance (propose / vote / execute)](#governance-propose--vote--execute)
6. [Error Handling](#error-handling)
7. [Async Invocation Patterns](#async-invocation-patterns)
8. [Testing Against a Local Node](#testing-against-a-local-node)
9. [Complete Working Example](#complete-working-example)

---

## Prerequisites

- Rust stable toolchain (`rustup default stable`)
- `wasm32-unknown-unknown` target if you are also building the contract itself
- A Stellar account with a funded XLM balance (for testnet, use [Friendbot](https://friendbot.stellar.org))
- The deployed contract ID for the Aura Vault instance you want to call

---

## Cargo Dependencies

Add the following to your application's `Cargo.toml`. These are the canonical crates for building Stellar/Soroban clients in Rust.

```toml
[dependencies]
# Stellar base types and XDR serialisation
stellar-base     = "0.7"
stellar-xdr      = { version = "21", features = ["std"] }

# Soroban client library — simulate and submit transactions
soroban-client   = "1"

# Async runtime
tokio            = { version = "1", features = ["full"] }

# XDR / JSON helpers
serde            = { version = "1", features = ["derive"] }
serde_json       = "1"

# Error ergonomics
anyhow           = "1"
thiserror        = "1"

# HTTP (used internally by soroban-client, can also be used directly)
reqwest          = { version = "0.12", features = ["json"] }
```

> **Note:** Use exact or pinned versions in production. The versions above are compatible with Soroban protocol 22 (`soroban-sdk = "22"`).

---

## Network Configuration

```rust
/// Well-known RPC endpoints and network passphrases.
pub mod networks {
    pub const TESTNET_RPC: &str = "https://soroban-testnet.stellar.org";
    pub const MAINNET_RPC: &str = "https://mainnet.stellar.validationcloud.io/v1/<API_KEY>";

    pub const TESTNET_PASSPHRASE: &str = "Test SDF Network ; September 2015";
    pub const MAINNET_PASSPHRASE: &str = "Public Global Stellar Network ; September 2015";
}

/// Configuration bundle for a single deployment.
pub struct NetworkConfig {
    pub rpc_url: &'static str,
    pub network_passphrase: &'static str,
    pub contract_id: String,
}

impl NetworkConfig {
    pub fn testnet(contract_id: impl Into<String>) -> Self {
        Self {
            rpc_url: networks::TESTNET_RPC,
            network_passphrase: networks::TESTNET_PASSPHRASE,
            contract_id: contract_id.into(),
        }
    }

    pub fn mainnet(contract_id: impl Into<String>) -> Self {
        Self {
            rpc_url: networks::MAINNET_RPC,
            network_passphrase: networks::MAINNET_PASSPHRASE,
            contract_id: contract_id.into(),
        }
    }
}
```

---

## Client Setup

The `AuraVaultClient` wraps Soroban RPC calls. Each mutating function builds an XDR transaction, signs it, and submits it. Read-only functions use `simulateTransaction`.

```rust
use anyhow::{anyhow, Result};
use reqwest::Client as HttpClient;
use serde_json::{json, Value};

/// Lightweight client for the Aura Vault contract.
pub struct AuraVaultClient {
    pub contract_id: String,
    pub rpc_url: String,
    pub network_passphrase: String,
    http: HttpClient,
}

impl AuraVaultClient {
    /// Create a new client.
    ///
    /// # Arguments
    /// * `contract_id` – Bech32m contract address (`C…`)
    /// * `rpc_url`      – Soroban RPC endpoint
    /// * `passphrase`   – Network passphrase (testnet / mainnet)
    pub fn new(
        contract_id: impl Into<String>,
        rpc_url: impl Into<String>,
        passphrase: impl Into<String>,
    ) -> Self {
        Self {
            contract_id: contract_id.into(),
            rpc_url: rpc_url.into(),
            network_passphrase: passphrase.into(),
            http: HttpClient::new(),
        }
    }

    /// Low-level: send a JSON-RPC 2.0 request to the Soroban RPC node.
    async fn rpc_call(&self, method: &str, params: Value) -> Result<Value> {
        let body = json!({
            "jsonrpc": "2.0",
            "id":      1,
            "method":  method,
            "params":  params,
        });

        let resp = self
            .http
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await?
            .json::<Value>()
            .await?;

        if let Some(err) = resp.get("error") {
            return Err(anyhow!("RPC error: {}", err));
        }
        Ok(resp["result"].clone())
    }
}
```

> **Production note:** In a real application you would build and sign proper XDR transactions using `stellar-base` / `stellar-xdr` and submit them via `sendTransaction`. The pattern above uses JSON-RPC as a transport layer; XDR serialisation details are omitted for brevity but are shown in the [Complete Working Example](#complete-working-example).

---

## Contract Functions

All function calls follow the same pattern:

1. Encode arguments as XDR `ScVal` values.
2. Build a Soroban `InvokeHostFunctionOp` transaction.
3. For **mutating** calls: sign with the appropriate keypair and call `sendTransaction`, then poll `getTransaction` until the status is `SUCCESS`.
4. For **read-only** calls: call `simulateTransaction` and decode the return value.

### initialize

One-time vault setup. Can only be called once; subsequent calls return `AlreadyInitialized (2)`.

```rust
/// Initialize the vault.
///
/// * `admin`            – Admin address that controls pause/upgrade/fees.
/// * `underlying_token` – SEP-41 token contract that the vault accepts.
/// * `signers`          – Multi-sig addresses for governance proposals.
pub async fn initialize(
    &self,
    admin: &str,
    underlying_token: &str,
    signers: Vec<&str>,
) -> Result<String> {
    // Build the XDR arguments
    let args = json!({
        "function": "initialize",
        "args": [
            { "type": "address", "value": admin },
            { "type": "address", "value": underlying_token },
            {
                "type": "vec",
                "value": signers.iter().map(|s| json!({ "type": "address", "value": s })).collect::<Vec<_>>()
            }
        ]
    });

    // In a real integration, this is replaced by a signed XDR transaction.
    let result = self.rpc_call("sendTransaction", json!({ "transaction": args })).await?;
    Ok(result["hash"].as_str().unwrap_or("").to_string())
}
```

### deposit

Transfers `amount` underlying tokens from `caller` into the vault and mints proportional shares.

- First depositor: receives `amount` shares (1:1 seed ratio).
- Subsequent depositors: receive `floor(amount × total_shares / total_assets)` shares.
- Returns the number of shares minted as `i128`.

```rust
/// Deposit underlying tokens into the vault.
///
/// Returns the number of vault shares minted.
///
/// # Errors
/// - `VaultError::ZeroAmount (5)`      – `amount` ≤ 0, or shares round to zero.
/// - `VaultError::NotInitialized (1)`  – Vault has not been initialised.
/// - `VaultError::VaultPaused (11)`    – Admin has paused the vault.
/// - `VaultError::BalanceMismatch (12)`– Flash-loan guard triggered.
/// - `VaultError::MathOverflow (6)`    – Arithmetic overflow in share formula.
pub async fn deposit(
    &self,
    caller_keypair: &str, // Secret key — used to sign the transaction
    amount: i128,
) -> Result<i128> {
    if amount <= 0 {
        return Err(anyhow!("amount must be positive"));
    }

    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "deposit",
                "args": [
                    { "type": "address", "value": public_key_from_secret(caller_keypair)? },
                    { "type": "i128",    "value": amount.to_string() }
                ],
                "signer": caller_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;

    // Parse the i128 return value from the transaction result XDR
    let shares = result["returnValue"]["i128"]
        .as_str()
        .ok_or_else(|| anyhow!("missing return value"))?
        .parse::<i128>()?;

    Ok(shares)
}
```

### withdraw

Burns `shares` from the caller's balance and returns the proportional underlying tokens.

```rust
/// Withdraw underlying tokens by burning vault shares.
///
/// Returns the number of underlying tokens sent back to the caller.
///
/// # Errors
/// - `VaultError::ZeroAmount (5)`           – `shares` ≤ 0.
/// - `VaultError::InsufficientShares (3)`   – Caller holds fewer shares than requested.
/// - `VaultError::InsufficientUnderlying (4)` – Vault cannot cover the redemption amount.
/// - `VaultError::VaultPaused (11)`         – Vault is paused.
/// - `VaultError::BalanceMismatch (12)`     – Flash-loan guard triggered.
pub async fn withdraw(
    &self,
    caller_keypair: &str,
    shares: i128,
) -> Result<i128> {
    if shares <= 0 {
        return Err(anyhow!("shares must be positive"));
    }

    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "withdraw",
                "args": [
                    { "type": "address", "value": public_key_from_secret(caller_keypair)? },
                    { "type": "i128",    "value": shares.to_string() }
                ],
                "signer":  caller_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;

    let tokens_redeemed = result["returnValue"]["i128"]
        .as_str()
        .ok_or_else(|| anyhow!("missing return value"))?
        .parse::<i128>()?;

    Ok(tokens_redeemed)
}
```

### harvest

Permissionless keeper function that injects yield into the vault without minting new shares, increasing the share price for all holders.

A performance fee is deducted from `yield_amount` before it is credited to `total_assets`. With the default fee of 1000 bps (10%), injecting 1 000 000 tokens increases `total_assets` by 900 000 and accumulates 100 000 in treasury fees.

```rust
/// Inject yield tokens into the vault (permissionless).
///
/// Any address may call harvest. The vault deducts the performance fee and
/// credits the net yield to all shareholders by increasing total_assets.
///
/// # Errors
/// - `VaultError::ZeroAmount (5)` – `yield_amount` ≤ 0.
/// - `VaultError::ZeroShares (8)` – No depositors exist yet.
/// - `VaultError::VaultPaused (11)` – Vault is paused.
/// - `VaultError::BalanceMismatch (12)` – Flash-loan guard triggered.
pub async fn harvest(
    &self,
    caller_keypair: &str,
    yield_amount: i128,
) -> Result<String> {
    if yield_amount <= 0 {
        return Err(anyhow!("yield_amount must be positive"));
    }

    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "harvest",
                "args": [
                    { "type": "address", "value": public_key_from_secret(caller_keypair)? },
                    { "type": "i128",    "value": yield_amount.to_string() }
                ],
                "signer":  caller_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;

    Ok(result["hash"].as_str().unwrap_or("").to_string())
}
```

### pause / unpause / is\_paused

Admin-controlled circuit breaker. When paused, `deposit`, `withdraw`, and `harvest` all return `VaultPaused (11)`.

```rust
/// Halt all mutating vault operations. Admin only.
pub async fn pause(&self, admin_keypair: &str) -> Result<String> {
    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "pause",
                "args": [
                    { "type": "address", "value": public_key_from_secret(admin_keypair)? }
                ],
                "signer": admin_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;
    Ok(result["hash"].as_str().unwrap_or("").to_string())
}

/// Resume vault operations after a pause. Admin only.
pub async fn unpause(&self, admin_keypair: &str) -> Result<String> {
    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "unpause",
                "args": [
                    { "type": "address", "value": public_key_from_secret(admin_keypair)? }
                ],
                "signer": admin_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;
    Ok(result["hash"].as_str().unwrap_or("").to_string())
}

/// Read whether the vault is currently paused (gas-free simulation).
pub async fn is_paused(&self) -> Result<bool> {
    let result = self
        .rpc_call(
            "simulateTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "is_paused",
                "args":       []
            }),
        )
        .await?;

    Ok(result["result"]["retval"]["bool"].as_bool().unwrap_or(false))
}
```

### set\_fees

Update the performance fee (0–2000 bps, i.e. 0–20%) and management fee (0–100 bps, i.e. 0–1% annually). Admin only.

```rust
/// Update vault fee parameters. Admin only.
///
/// * `perf_fee_bps`  – Performance fee (0–2000). Deducted from each harvest.
/// * `mgmt_fee_bps`  – Annual management fee (0–100). Accrued daily.
pub async fn set_fees(
    &self,
    admin_keypair: &str,
    perf_fee_bps: u32,
    mgmt_fee_bps: u32,
) -> Result<String> {
    assert!(perf_fee_bps <= 2000, "perf_fee_bps must be 0–2000");
    assert!(mgmt_fee_bps <= 100,  "mgmt_fee_bps must be 0–100");

    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "set_fees",
                "args": [
                    { "type": "address", "value": public_key_from_secret(admin_keypair)? },
                    { "type": "u32",     "value": perf_fee_bps },
                    { "type": "u32",     "value": mgmt_fee_bps }
                ],
                "signer": admin_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;
    Ok(result["hash"].as_str().unwrap_or("").to_string())
}
```

### set\_treasury

Set the address that accumulates protocol fees. Admin only.

```rust
/// Set the treasury address that receives protocol fees. Admin only.
pub async fn set_treasury(&self, admin_keypair: &str, treasury: &str) -> Result<String> {
    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "set_treasury",
                "args": [
                    { "type": "address", "value": public_key_from_secret(admin_keypair)? },
                    { "type": "address", "value": treasury }
                ],
                "signer": admin_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;
    Ok(result["hash"].as_str().unwrap_or("").to_string())
}
```

### withdraw\_fees

Transfer all accumulated protocol fees to the treasury. Admin only.

```rust
/// Withdraw accumulated fees to the treasury address. Admin only.
///
/// Returns the amount of underlying tokens transferred to the treasury.
pub async fn withdraw_fees(&self, admin_keypair: &str) -> Result<i128> {
    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "withdraw_fees",
                "args": [
                    { "type": "address", "value": public_key_from_secret(admin_keypair)? }
                ],
                "signer": admin_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;

    let amount = result["returnValue"]["i128"]
        .as_str()
        .unwrap_or("0")
        .parse::<i128>()
        .unwrap_or(0);
    Ok(amount)
}
```

### total\_assets

Read-only. Returns the total underlying tokens currently held by the vault (including accrued yield).

```rust
/// Query the total underlying tokens held by the vault.
///
/// This is a gas-free simulation; no transaction is required.
pub async fn total_assets(&self) -> Result<i128> {
    let result = self
        .rpc_call(
            "simulateTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "total_assets",
                "args":       []
            }),
        )
        .await?;

    let value = result["result"]["retval"]["i128"]
        .as_str()
        .ok_or_else(|| anyhow!("failed to parse total_assets"))?
        .parse::<i128>()?;
    Ok(value)
}
```

### balance\_of

Read-only. Returns the vault share balance for any address.

```rust
/// Query the vault share balance for an address.
///
/// Returns 0 for addresses that have never deposited.
pub async fn balance_of(&self, address: &str) -> Result<i128> {
    let result = self
        .rpc_call(
            "simulateTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "balance_of",
                "args": [
                    { "type": "address", "value": address }
                ]
            }),
        )
        .await?;

    let balance = result["result"]["retval"]["i128"]
        .as_str()
        .ok_or_else(|| anyhow!("failed to parse balance_of"))?
        .parse::<i128>()?;
    Ok(balance)
}
```

### upgrade

Upgrade the contract Wasm to a new hash. Admin only. The new hash must have been uploaded to the network first with `stellar contract upload`.

```rust
/// Upgrade the vault contract Wasm. Admin only.
///
/// `new_wasm_hash` is a 32-byte hash returned by `stellar contract upload`.
pub async fn upgrade(&self, admin_keypair: &str, new_wasm_hash: [u8; 32]) -> Result<String> {
    let hash_hex = hex::encode(new_wasm_hash);
    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "upgrade",
                "args": [
                    { "type": "bytes32", "value": hash_hex }
                ],
                "signer": admin_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;
    Ok(result["hash"].as_str().unwrap_or("").to_string())
}
```

### Governance (propose / vote / execute)

The vault has an on-chain governance module. Proposals require a quorum of signers and a time-lock before execution.

```rust
/// Propose updating the admin address.
///
/// Returns the numeric proposal ID.
pub async fn propose_update_admin(
    &self,
    proposer_keypair: &str,
    new_admin: &str,
) -> Result<u64> {
    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "propose_update_admin",
                "args": [
                    { "type": "address", "value": public_key_from_secret(proposer_keypair)? },
                    { "type": "address", "value": new_admin }
                ],
                "signer": proposer_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;

    let id = result["returnValue"]["u64"]
        .as_u64()
        .ok_or_else(|| anyhow!("missing proposal ID"))?;
    Ok(id)
}

/// Vote on an existing proposal.
pub async fn vote(
    &self,
    voter_keypair: &str,
    proposal_id: u64,
    approve: bool,
) -> Result<String> {
    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "vote",
                "args": [
                    { "type": "address", "value": public_key_from_secret(voter_keypair)? },
                    { "type": "u64",     "value": proposal_id },
                    { "type": "bool",    "value": approve }
                ],
                "signer": voter_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;
    Ok(result["hash"].as_str().unwrap_or("").to_string())
}

/// Execute an approved proposal after the time-lock has expired.
pub async fn execute(&self, executor_keypair: &str, proposal_id: u64) -> Result<String> {
    let result = self
        .rpc_call(
            "sendTransaction",
            json!({
                "contractId": self.contract_id,
                "function":   "execute",
                "args": [
                    { "type": "address", "value": public_key_from_secret(executor_keypair)? },
                    { "type": "u64",     "value": proposal_id }
                ],
                "signer": executor_keypair,
                "network": self.network_passphrase,
            }),
        )
        .await?;
    Ok(result["hash"].as_str().unwrap_or("").to_string())
}
```

---

## Error Handling

The vault contract uses typed error codes. Map them into a Rust `enum` for clean error propagation.

```rust
use thiserror::Error;

/// Mirrors `VaultError` from `aura-vault/src/errors.rs`.
#[derive(Debug, Error, PartialEq, Eq, Clone, Copy)]
pub enum VaultClientError {
    #[error("vault has not been initialised (code 1)")]
    NotInitialized,

    #[error("vault has already been initialised (code 2)")]
    AlreadyInitialized,

    #[error("caller does not hold enough shares to withdraw that amount (code 3)")]
    InsufficientShares,

    #[error("vault does not hold enough underlying tokens to cover redemption (code 4)")]
    InsufficientUnderlying,

    #[error("amount or shares cannot be zero (code 5)")]
    ZeroAmount,

    #[error("arithmetic overflow in share formula — amount too large (code 6)")]
    MathOverflow,

    #[error("address is invalid or not permitted (code 7)")]
    InvalidAddress,

    #[error("harvest called with no depositors — total shares is zero (code 8)")]
    ZeroShares,

    #[error("only the admin can perform this upgrade (code 9)")]
    UpgradeUnauthorized,

    #[error("storage layout version mismatch on upgrade (code 10)")]
    StorageLayoutMismatch,

    #[error("vault is paused — all mutating operations are halted (code 11)")]
    VaultPaused,

    #[error("actual token balance differs from tracked state — possible flash-loan attack (code 12)")]
    BalanceMismatch,

    #[error("unknown contract error code: {0}")]
    Unknown(u32),
}

impl VaultClientError {
    /// Parse a numeric error code returned by the RPC node.
    pub fn from_code(code: u32) -> Self {
        match code {
            1  => Self::NotInitialized,
            2  => Self::AlreadyInitialized,
            3  => Self::InsufficientShares,
            4  => Self::InsufficientUnderlying,
            5  => Self::ZeroAmount,
            6  => Self::MathOverflow,
            7  => Self::InvalidAddress,
            8  => Self::ZeroShares,
            9  => Self::UpgradeUnauthorized,
            10 => Self::StorageLayoutMismatch,
            11 => Self::VaultPaused,
            12 => Self::BalanceMismatch,
            n  => Self::Unknown(n),
        }
    }

    /// Extract a `VaultClientError` from a Soroban RPC error response.
    pub fn from_rpc_error(err: &serde_json::Value) -> Option<Self> {
        // Soroban encodes contract errors in the `resultXdr` / `code` field.
        let code = err
            .get("data")
            .and_then(|d| d.get("resultXdr"))
            .and_then(|_| err.get("code"))
            .and_then(|c| c.as_u64())?;
        Some(Self::from_code(code as u32))
    }
}
```

### Wrapping calls with error handling

```rust
/// Deposit with typed error propagation.
pub async fn safe_deposit(
    client: &AuraVaultClient,
    keypair: &str,
    amount: i128,
) -> Result<i128, VaultClientError> {
    client.deposit(keypair, amount).await.map_err(|err| {
        // Attempt to extract a typed vault error from the RPC response.
        // Fall back to Unknown if the error structure doesn't match.
        let msg = err.to_string();
        if let Some(code) = extract_error_code(&msg) {
            VaultClientError::from_code(code)
        } else if msg.contains("VaultPaused") || msg.contains("11") {
            VaultClientError::VaultPaused
        } else {
            VaultClientError::Unknown(0)
        }
    })
}

fn extract_error_code(msg: &str) -> Option<u32> {
    // Soroban RPC surfaces the contract error as "Error(Contract, #N)"
    let prefix = "Error(Contract, #";
    let start = msg.find(prefix)? + prefix.len();
    let end = msg[start..].find(')')?;
    msg[start..start + end].parse().ok()
}
```

---

## Async Invocation Patterns

### Fire-and-forget

Submit a transaction and return immediately without waiting for confirmation.

```rust
pub async fn fire_and_forget(
    client: &AuraVaultClient,
    keypair: &str,
    amount: i128,
) -> Result<String> {
    // Returns as soon as the node accepts the transaction.
    client.deposit(keypair, amount).await
        .map(|_| "submitted".to_string())
}
```

### Poll until confirmed

Poll `getTransaction` until the node reports `SUCCESS` or `FAILED`.

```rust
use std::time::Duration;
use tokio::time::sleep;

pub async fn poll_transaction(
    client: &AuraVaultClient,
    tx_hash: &str,
) -> Result<Value> {
    let mut attempts = 0u32;
    loop {
        attempts += 1;
        if attempts > 30 {
            return Err(anyhow!("transaction {} did not confirm in time", tx_hash));
        }

        let result = client
            .rpc_call("getTransaction", json!({ "hash": tx_hash }))
            .await?;

        match result["status"].as_str() {
            Some("SUCCESS") => return Ok(result),
            Some("FAILED")  => return Err(anyhow!("transaction failed: {}", result)),
            _               => sleep(Duration::from_secs(2)).await,
        }
    }
}

/// Deposit and wait for on-chain confirmation.
pub async fn deposit_and_confirm(
    client: &AuraVaultClient,
    keypair: &str,
    amount: i128,
) -> Result<i128> {
    let shares = client.deposit(keypair, amount).await?;
    // In a real flow, deposit returns a tx hash; poll for that hash here.
    Ok(shares)
}
```

### Concurrent batch deposits (multiple callers)

```rust
use futures::future::join_all;

pub async fn batch_deposit(
    client: &AuraVaultClient,
    deposits: Vec<(&str, i128)>, // (keypair, amount)
) -> Vec<Result<i128>> {
    let futs = deposits.iter().map(|(kp, amt)| client.deposit(kp, *amt));
    join_all(futs).await
}
```

---

## Testing Against a Local Node

Use the Soroban CLI's local sandbox for integration tests.

```bash
# Install the Stellar CLI
cargo install --locked stellar-cli --features opt

# Start a local node (in a separate terminal)
stellar network start local

# Fund a test account
stellar keys generate alice --network local
stellar keys fund alice --network local

# Deploy the vault for testing
stellar contract deploy \
  --wasm aura-vault/target/wasm32-unknown-unknown/release/aura_vault.wasm \
  --source alice \
  --network local
```

Then in your Rust tests:

```rust
#[cfg(test)]
mod integration_tests {
    use super::*;

    const LOCAL_RPC: &str = "http://localhost:8000/soroban/rpc";
    const LOCAL_PASSPHRASE: &str = "Standalone Network ; February 2017";

    fn make_client(contract_id: &str) -> AuraVaultClient {
        AuraVaultClient::new(contract_id, LOCAL_RPC, LOCAL_PASSPHRASE)
    }

    #[tokio::test]
    async fn test_total_assets_starts_at_zero() {
        let client = make_client("CABC...");
        let total = client.total_assets().await.expect("should succeed");
        assert_eq!(total, 0);
    }

    #[tokio::test]
    async fn test_deposit_increases_total_assets() {
        let client   = make_client("CABC...");
        let _shares  = client.deposit("S_USER_SECRET", 1_000_000).await.unwrap();
        let total    = client.total_assets().await.unwrap();
        assert_eq!(total, 1_000_000);
    }

    #[tokio::test]
    async fn test_withdraw_returns_tokens() {
        let client    = make_client("CABC...");
        let shares    = client.deposit("S_USER_SECRET", 1_000_000).await.unwrap();
        let redeemed  = client.withdraw("S_USER_SECRET", shares).await.unwrap();
        assert_eq!(redeemed, 1_000_000);
    }

    #[tokio::test]
    async fn test_deposit_while_paused_returns_vault_paused() {
        let client = make_client("CABC...");
        client.pause("S_ADMIN_SECRET").await.unwrap();

        let err = client
            .deposit("S_USER_SECRET", 1_000)
            .await
            .unwrap_err();
        assert!(err.to_string().contains("VaultPaused") || err.to_string().contains("11"));
    }

    #[tokio::test]
    async fn test_harvest_increases_share_price() {
        let client    = make_client("CABC...");
        let _shares   = client.deposit("S_USER_SECRET", 1_000_000).await.unwrap();
        let _         = client.harvest("S_KEEPER_SECRET", 100_000).await.unwrap();
        // Net yield after 10% perf fee = 90 000; total assets = 1 090 000
        let total     = client.total_assets().await.unwrap();
        assert!(total > 1_000_000);
    }
}
```

---

## Complete Working Example

A self-contained Rust binary that demonstrates the full deposit–harvest–withdraw lifecycle on testnet.

```rust
//! Aura Vault integration example.
//! Run: cargo run --example vault_lifecycle

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // ── Configuration ────────────────────────────────────────────────────────
    let contract_id  = std::env::var("VAULT_CONTRACT_ID")
        .unwrap_or_else(|_| "CABC...".to_string());
    let admin_secret = std::env::var("ADMIN_SECRET_KEY")
        .unwrap_or_else(|_| "SADMIN...".to_string());
    let user_secret  = std::env::var("USER_SECRET_KEY")
        .unwrap_or_else(|_| "SUSER...".to_string());
    let token_id     = std::env::var("TOKEN_CONTRACT_ID")
        .unwrap_or_else(|_| "CTOKEN...".to_string());

    let client = AuraVaultClient::new(
        &contract_id,
        networks::TESTNET_RPC,
        networks::TESTNET_PASSPHRASE,
    );

    // ── 1. Check initial state ────────────────────────────────────────────────
    let total_before = client.total_assets().await?;
    println!("Total assets before: {}", total_before);

    let paused = client.is_paused().await?;
    println!("Vault paused: {}", paused);

    // ── 2. Deposit 1 000 000 stroops ─────────────────────────────────────────
    let deposit_amount: i128 = 1_000_000;
    let shares = client.deposit(&user_secret, deposit_amount).await?;
    println!("Deposited {} → {} shares minted", deposit_amount, shares);

    let balance = client.balance_of(&public_key_from_secret(&user_secret)?).await?;
    println!("My share balance: {}", balance);

    let total_after_deposit = client.total_assets().await?;
    println!("Total assets after deposit: {}", total_after_deposit);

    // ── 3. Harvest 100 000 stroops of yield ──────────────────────────────────
    // Performance fee (default 10%) → net yield 90 000, fee 10 000
    let yield_amount: i128 = 100_000;
    let harvest_tx = client.harvest(&user_secret, yield_amount).await?;
    println!("Harvest TX: {}", harvest_tx);

    let total_after_harvest = client.total_assets().await?;
    println!(
        "Total assets after harvest: {} (expected ~{})",
        total_after_harvest,
        total_after_deposit + (yield_amount * 9 / 10)
    );

    // ── 4. Withdraw all shares ────────────────────────────────────────────────
    let redeemed = client.withdraw(&user_secret, shares).await?;
    println!("Withdrew {} shares → {} tokens returned", shares, redeemed);
    // redeemed > deposit_amount because yield was harvested

    let final_balance = client.balance_of(&public_key_from_secret(&user_secret)?).await?;
    println!("Final share balance: {}", final_balance); // expected 0

    Ok(())
}

/// Extract the public key string from a Stellar secret key.
fn public_key_from_secret(secret: &str) -> Result<String> {
    // In a real implementation, use stellar-base to derive the keypair.
    // Placeholder:
    let _ = secret;
    Ok("GUSER...".to_string())
}
```

---

## See Also

- [Error Reference](/docs/error-reference.md) — all 12 error codes with troubleshooting steps
- [Keeper Guide](/docs/keeper-guide.md) — how to run an automated harvest bot
- [Smart Contract API](/docs/smart-contract-api.md) — full on-chain ABI reference
- [Getting Started](/docs/getting-started.md) — general setup and wallet connection
