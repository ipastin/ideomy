---
title: "ADR-142 — M0.3 Core authentication endpoint completion"
created: "15-10-26 13-36-16"
updated: "15-10-26 13-54-37"
version: "0.1.1"
status: "proposed"
commit: "feat(contracts): define M0.3 Core auth exchange"
---

# ADR-142 — M0.3 Core authentication endpoint completion

Created: 15-10-26 13-36-16
Updated: 15-10-26 13-54-37
Version: 0.1.1
Change: `feat(contracts): define M0.3 Core auth exchange`

## Context

Accepted ADR-129–131 and `21_CORE_PROTOCOL` require loopback HTTP, versioned machine contracts, setup-authorized Plugin pairing, nonce signatures, short-lived sessions, and machine-local CLI administration. `21_CORE_PROTOCOL` names `/v1/pair/request` but does not name the challenge, session, or setup pairing-window routes or their request/response schemas. Implementing M0.3 without recording these public semantics would make Plugin and CLI depend on undocumented endpoints.

## Decision proposed for V1

- `GET /v1/health` remains minimal and unauthenticated. `core-discovery.json` is private-permission machine-local metadata with instance ID, protocol, dynamic port, PID, start time, and Vault ID; it contains no bearer secret.
- `POST /v1/pair/window` requires an authenticated CLI session and `Idempotency-Key`. It opens a two-minute pairing window and returns a one-time bootstrap proof. A replay of the same key returns the original result.
- `POST /v1/pair/request` accepts Plugin client ID, Vault ID/fingerprint, one-time proof, and a WebCrypto P-256 public JWK. Successful pairing consumes the proof. Core persists only the public key and Vault binding in private machine-local state.
- `POST /v1/auth/challenge` issues a one-minute nonce for a paired Plugin client. `POST /v1/auth/session` verifies a single-use P-256 signature over that nonce, or verifies CLI admin material from a private machine-local state file. Both issue a memory-only fifteen-minute bearer scoped to client type and Vault identity. Sessions are lost on Core restart and may be revoked independently.
- `POST /v1/handshake` and `GET /v1/system-health` require the bearer plus the V1 protocol and client headers. Vault mismatch fails explicitly. Unknown endpoints do not expose data.
- These new request/response shapes and discovery/health shapes are normative under `contracts/protocol/v1/` and shared through `@ideomy/contracts`. CoreClient consumes the contracts; UI code does not assemble raw requests.

## Alternatives considered

1. Put challenge and session exchange into unauthenticated `/v1/handshake`. This reduces routes but conflicts with the accepted authenticated-handshake class and complicates the trust boundary.
2. Use a permanent Plugin bearer in synchronized settings. This reduces the pairing flow but violates ADR-130 and the Plugin secret-storage invariant.
3. Defer exact auth routes to M0.4. This keeps M0.3 smaller but cannot satisfy the M0.3 exit criterion that CLI and mock Plugin authenticate to Core.

## Consequences and review boundary

M0.3 adds no note-serving or mutation endpoint. The CLI admin secret and paired public keys stay outside the Vault; session tokens stay in memory. Bootstrap later supplies the Plugin-local non-extractable key storage and one-time proof transfer. This ADR remains proposed until the M0.3 PR is reviewed and accepted together with its schemas and tests.
