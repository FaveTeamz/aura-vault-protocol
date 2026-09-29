# Aura Vault — PostgreSQL Data Dictionary

This document describes every table, column, index, constraint, trigger, and function in the Aura Vault PostgreSQL schema. It is generated from `backend/migrations/` and maintained alongside the migration files.

---

## Schema Overview

```
aura_vault (database)
└── public (schema)
    ├── vault_positions              — current and historical user vault positions
    └── vault_position_audit_log     — immutable append-only audit trail for vault_positions
```

**Migration files:**

| File | Description |
|------|-------------|
| `001_create_vault_positions.sql` | Creates `vault_positions`, `vault_position_audit_log`, indexes, triggers, and audit functions |

---

## Table: `vault_positions`

Stores one row per active or deactivated user position in a vault. A "position" represents a user's aggregate holding in a specific vault at a given point in time — it is not a ledger of individual transactions. Soft deletion via `deleted_at` preserves historical data for auditing and analytics.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `BIGSERIAL` | NOT NULL | auto-increment | Synthetic primary key. Stable surrogate used for joins and audit log references. Never reused or recycled even after soft-delete. |
| `user_id` | `UUID` | NOT NULL | — | Identifies the vault participant. Maps to an application-layer user record (wallet address or auth identity). UUID chosen to avoid sequential ID enumeration in API responses. |
| `vault_id` | `UUID` | NOT NULL | — | Identifies the vault contract instance. Allows the schema to support multiple vault deployments (mainnet, testnet, strategy variants) in a single database. |
| `amount` | `NUMERIC(38, 18)` | NOT NULL | — | The user's current underlying token holdings in this vault, stored with 18-decimal precision to match SEP-41/ERC-20 token semantics. Always ≥ 0 (enforced by `CHECK`). |
| `entry_date` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Timestamp when the user first entered this vault position. Used as the start date for yield calculations. Stored with timezone to avoid DST ambiguity. |
| `entry_price` | `NUMERIC(38, 18)` | NOT NULL | — | The vault share-to-underlying exchange rate at the time of the initial deposit. Used for cost-basis and PnL reporting. Always ≥ 0 (enforced by `CHECK`). |
| `yield_earned` | `NUMERIC(38, 18)` | NOT NULL | `0` | Cumulative yield earned by this position since `entry_date`, updated by the yield calculation service. Does not include unrealised exchange-rate appreciation. Always ≥ 0. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Row insertion timestamp. Set once and never changed; used for data lineage and event replay ordering. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Timestamp of the most recent UPDATE. Automatically maintained by the `trg_vault_positions_updated_at` trigger — **do not set this column manually** in application code. |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | Soft-delete timestamp. `NULL` = active position. Set to `NOW()` on logical deletion (e.g., full withdrawal). Rows are never physically deleted; this preserves the audit trail and enables recovery. |

### Constraints

| Name | Type | Expression | Rationale |
|------|------|-----------|-----------|
| `vault_positions_pkey` | PRIMARY KEY | `id` | Unique row identifier |
| _(inline)_ | CHECK | `amount >= 0` | A negative holding is economically impossible; reject at the DB layer to prevent data corruption from application bugs |
| _(inline)_ | CHECK | `entry_price >= 0` | Entry price is always non-negative |
| _(inline)_ | CHECK | `yield_earned >= 0` | Yield cannot be negative; losses are expressed via reduced `amount` not negative yield |

### Relationship Diagram

```
vault_positions
  └── vault_position_audit_log
        FK: audit_log.position_id → vault_positions.id
        (NOT enforced as a foreign key constraint to allow audit records to
         survive even if vault_positions rows were ever hard-deleted)
```

---

## Table: `vault_position_audit_log`

An immutable, append-only audit trail that records every INSERT, UPDATE, and DELETE applied to `vault_positions`. Rows in this table are written by the `trg_vault_positions_audit` trigger and must never be modified or deleted by application code.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `BIGSERIAL` | NOT NULL | auto-increment | Audit log entry primary key. Monotonically increasing; safe to use as an ordering cursor for event replay. |
| `position_id` | `BIGINT` | NOT NULL | — | References `vault_positions.id`. Not a foreign key constraint (intentional — see Rationale below) so audit records survive even if source rows are purged. |
| `operation` | `TEXT` | NOT NULL | — | The DML operation that triggered this record: one of `'INSERT'`, `'UPDATE'`, `'DELETE'`. Validated by a `CHECK` constraint. |
| `changed_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Wall-clock timestamp when the triggering DML ran. Separate from `vault_positions.updated_at` to capture the exact audit moment. |
| `changed_by` | `UUID` | NULL | `NULL` | Application-level identity of the actor that caused the change (e.g., API user ID). `NULL` when the change originates from a background job or migration with no user context. |
| `before_state` | `JSONB` | NULL | `NULL` | Full row snapshot before the change, serialised as JSONB by `to_jsonb(OLD)`. `NULL` for INSERT operations (no prior state exists). |
| `after_state` | `JSONB` | NULL | `NULL` | Full row snapshot after the change, serialised as JSONB by `to_jsonb(NEW)`. `NULL` for DELETE operations (no resulting state). |

### Constraints

| Name | Type | Expression |
|------|------|-----------|
| `vault_position_audit_log_pkey` | PRIMARY KEY | `id` |
| _(inline)_ | CHECK | `operation IN ('INSERT', 'UPDATE', 'DELETE')` |

**Why no foreign key on `position_id`?** Foreign key enforcement would prevent audit records from surviving a hard-delete of the source row. Even though the application uses soft-delete, the audit log is designed to be independently durable. If regulatory requirements ever require hard deletion (e.g., GDPR erasure), the audit record is retained as evidence of what was deleted.

---

## Indexes

### On `vault_positions`

| Index Name | Columns | Partial? | Purpose |
|------------|---------|----------|---------|
| `vault_positions_pkey` | `id` | No | Primary key lookup |
| `idx_vault_positions_user_id` | `user_id` | No | Fetch all positions for a single user. Used by portfolio API (`GET /api/v1/user/portfolio`). Without this index the query would scan the entire table. |
| `idx_vault_positions_vault_id` | `vault_id` | No | Fetch all positions in a specific vault. Used by admin dashboards and analytics queries aggregating vault-level stats. |
| `idx_vault_positions_created_at` | `created_at DESC` | No | Time-ordered scans for data backfills, audit queries, and batch yield calculation jobs that process records in insertion order. |
| `idx_vault_positions_user_id_created_at` | `(user_id, created_at DESC)` | Yes — `WHERE deleted_at IS NULL` | Composite covering index for the most common application query: "give me this user's active positions, newest first." The partial filter eliminates soft-deleted rows, keeping the index small. Used by `GET /api/v1/user/portfolio`. |
| `idx_vault_positions_vault_id_created_at` | `(vault_id, created_at DESC)` | Yes — `WHERE deleted_at IS NULL` | Composite index for vault-level queries on active positions. Used by harvest/yield processing that scans all live positions in a vault. |

### On `vault_position_audit_log`

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `vault_position_audit_log_pkey` | `id` | Primary key |
| `idx_vault_position_audit_log_position_id` | `(position_id, changed_at DESC)` | Retrieve the full audit history for a single position ordered by most-recent-first. Used by compliance and support tooling. |

---

## Triggers

### `trg_vault_positions_updated_at`

| Attribute | Value |
|-----------|-------|
| Table | `vault_positions` |
| Timing | `BEFORE UPDATE` |
| Granularity | `FOR EACH ROW` |
| Function | `touch_vault_positions_updated_at()` |

Sets `NEW.updated_at = NOW()` on every UPDATE, ensuring the column always reflects the true last-modification time regardless of what the application code passes. Application code must not include `updated_at` in its UPDATE statement.

### `trg_vault_positions_audit`

| Attribute | Value |
|-----------|-------|
| Table | `vault_positions` |
| Timing | `AFTER INSERT OR UPDATE OR DELETE` |
| Granularity | `FOR EACH ROW` |
| Function | `audit_vault_positions()` |

Records a row in `vault_position_audit_log` for every mutation:

- **INSERT** → `before_state = NULL`, `after_state = to_jsonb(NEW)`
- **UPDATE** → `before_state = to_jsonb(OLD)`, `after_state = to_jsonb(NEW)`
- **DELETE** → `before_state = to_jsonb(OLD)`, `after_state = NULL`

The `changed_by` column is always `NULL` in the current implementation (the trigger does not have access to the application-layer user identity). To populate it, the application layer should `SET LOCAL app.current_user_id = '<uuid>'` inside a transaction before performing the DML, and the trigger function updated to read `current_setting('app.current_user_id', true)`.

---

## Functions

### `touch_vault_positions_updated_at()`

```sql
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Called by `trg_vault_positions_updated_at`. Returns the modified row with `updated_at` set to the current transaction time.

### `audit_vault_positions()`

```sql
RETURNS TRIGGER AS $$
BEGIN
  -- Inserts one row into vault_position_audit_log per DML event
  -- Handles INSERT, UPDATE, DELETE via TG_OP branching
END;
$$ LANGUAGE plpgsql;
```

Called by `trg_vault_positions_audit`. Dispatches on `TG_OP` and writes the appropriate before/after JSONB snapshots.

---

## Column Type Rationale

| Type | Used For | Why |
|------|----------|-----|
| `BIGSERIAL` | `id` columns | Auto-incrementing 8-byte integer; supports billions of rows without overflow |
| `UUID` | `user_id`, `vault_id`, `changed_by` | Globally unique, avoids sequential enumeration, compatible with distributed ID generation |
| `NUMERIC(38, 18)` | `amount`, `entry_price`, `yield_earned` | Arbitrary-precision decimal matching 18-decimal token amounts used in Stellar/Soroban contracts. `FLOAT` would introduce rounding errors in financial calculations |
| `TIMESTAMPTZ` | All timestamp columns | Timezone-aware; unambiguous across DST transitions and multi-region deployments |
| `TEXT` | `operation` | Flexible string with `CHECK` constraint; avoids enum type migration friction |
| `JSONB` | `before_state`, `after_state` | Binary JSON with indexing support; preserves full row state for point-in-time recovery and compliance |

---

## Example Queries

### Fetch all active positions for a user

```sql
SELECT id, vault_id, amount, entry_date, entry_price, yield_earned
FROM vault_positions
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

Uses index: `idx_vault_positions_user_id_created_at`

### Fetch audit history for a specific position

```sql
SELECT operation, changed_at, changed_by, before_state, after_state
FROM vault_position_audit_log
WHERE position_id = $1
ORDER BY changed_at DESC;
```

Uses index: `idx_vault_position_audit_log_position_id`

### Soft-delete a position

```sql
UPDATE vault_positions
SET deleted_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL;
```

The `trg_vault_positions_updated_at` trigger automatically sets `updated_at`.
The `trg_vault_positions_audit` trigger records the before/after state.

### Aggregate vault TVL

```sql
SELECT vault_id, SUM(amount) AS total_value_locked
FROM vault_positions
WHERE deleted_at IS NULL
GROUP BY vault_id;
```

Uses index: `idx_vault_positions_vault_id_created_at`

---

## Schema Diagram (ASCII)

```
vault_positions
┌─────────────────────────────────┐
│ id            BIGSERIAL PK      │◄──────────────────────┐
│ user_id       UUID NOT NULL     │                       │
│ vault_id      UUID NOT NULL     │  vault_position_audit_log
│ amount        NUMERIC(38,18)    │  ┌───────────────────────────────┐
│ entry_date    TIMESTAMPTZ       │  │ id           BIGSERIAL PK     │
│ entry_price   NUMERIC(38,18)    │  │ position_id  BIGINT NOT NULL ─┘
│ yield_earned  NUMERIC(38,18)    │  │ operation    TEXT             │
│ created_at    TIMESTAMPTZ       │  │ changed_at   TIMESTAMPTZ      │
│ updated_at    TIMESTAMPTZ       │  │ changed_by   UUID NULL        │
│ deleted_at    TIMESTAMPTZ NULL  │  │ before_state JSONB NULL       │
└─────────────────────────────────┘  │ after_state  JSONB NULL       │
          │                          └───────────────────────────────┘
          │ AFTER INSERT/UPDATE/DELETE
          ▼
  trg_vault_positions_audit
          │
          ▼
  writes to vault_position_audit_log
```

---

## Future Migrations (Planned)

The following columns and tables are anticipated in upcoming migrations based on the application roadmap. This section will be updated when migration files are added.

| Planned Item | Justification |
|---|---|
| `vault_positions.shares` column | Track on-chain share balance separately from token amount for multi-vault support |
| `vault_positions.last_harvest_at` | Support per-position yield accrual calculations |
| `webhooks` table | Persist webhook endpoints currently stored in memory (`backend/src/webhook.ts`) |
| `webhook_deliveries` table | Persist delivery records for retry durability across server restarts |
| `users` table | Formal user record linked to `user_id` UUID for session and auth data |

---

## Maintenance Notes

- **Zero downtime index creation:** Always use `CREATE INDEX CONCURRENTLY` in production migrations to avoid table locks.
- **Backfilling `changed_by`:** To retroactively populate `changed_by` in the audit log, use `SET LOCAL app.current_user_id` in a transaction before DML and update the trigger function to read it via `current_setting('app.current_user_id', true)`.
- **Archival strategy:** Rows in `vault_position_audit_log` accumulate indefinitely. For deployments older than 12 months, consider partitioning `vault_position_audit_log` by `changed_at` year/month and archiving cold partitions to cold storage (e.g., AWS S3 via `pg_partman`).
