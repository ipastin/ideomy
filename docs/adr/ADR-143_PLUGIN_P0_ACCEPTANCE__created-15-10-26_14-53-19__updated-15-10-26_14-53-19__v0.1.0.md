---
title: "ADR-143 — Separate Plugin P0 and Bootstrap Foundation acceptance"
created: "15-10-26 14-53-19"
updated: "15-10-26 14-53-19"
version: "0.1.0"
status: "accepted"
commit: "docs(bootstrap): separate Plugin P0 acceptance"
---

# ADR-143 — Separate Plugin P0 and Bootstrap Foundation acceptance

Created: 15-10-26 14-53-19  
Updated: 15-10-26 14-53-19  
Version: 0.1.0  
Change: `docs(bootstrap): separate Plugin P0 acceptance`

## Context

`11_IMPLEMENTATION` previously required `doctor Healthy` at M0.4 Plugin P0 acceptance. `16_BOOTSTRAP` requires a current initial deterministic index for that state, while the implementation order places index work after Plugin P0. ADR-074 calls the complete Bootstrap Foundation the first installable vertical slice. These statements leave no truthful independent exit for Plugin P0.

## Decision accepted for M0

- M0.4 accepts the installed Bootstrap Plugin P0 integration as a separate engineering milestone. A supported Alpha/development installation and real macOS Obsidian/Core smoke test on a synthetic Vault must prove Plugin enablement, authenticated pairing and compatible handshake/status, active Vault identity, lifecycle cleanup and the missing/stopped/incompatible Core states in `19_OBSIDIAN_PLUGIN` §52.
- M0.4 may report missing schema/index capability as degraded or unavailable. It must not emit or imply overall Bootstrap Foundation `doctor Healthy` without the full Foundation checks. No new health state or protocol envelope is introduced.
- M0.5 completes Bootstrap Foundation, including the minimal deterministic parse/schema/index and health checks already required by `16_BOOTSTRAP`, idempotent/resumable setup and its remaining Definition of Done. M0 is complete only after clean-machine and interrupted-install acceptance tests pass and `doctor Healthy` is backed by a current initial index.
- M1 expands the minimal Bootstrap index into the structured index/FTS implementation required by `11_IMPLEMENTATION` and `22_ENGINEERING_FOUNDATION`.

This supersedes only ADR-074's attribution of the first installable integration milestone. ADR-074's complete Bootstrap Foundation contract, including the index and `Healthy` requirements, remains accepted. Package topology, Core protocol/authentication, privacy and hard evaluation thresholds remain unchanged.

## Alternatives considered

1. Keep `doctor Healthy` at M0.4 and implement the initial index before Plugin P0 acceptance. This increases M0.4 scope and obscures the canonical Plugin-before-index build order.
2. Treat a healthy Core handshake as overall `doctor Healthy` while index is absent. This contradicts `16_BOOTSTRAP` and would misreport system state.

## Consequences

The M0.4 PR can be reviewed and accepted on a real Plugin/Core integration without claiming full one-command Bootstrap completion. M0.5 retains responsibility for full setup, deterministic index, recovery and Foundation acceptance. Public Community Plugin distribution is still governed by `15_DELIVERY` and `19_OBSIDIAN_PLUGIN`; local development installation does not claim public availability.
