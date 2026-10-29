# 0012 — Platform as merchant of record; supplier payouts via invoices

- **Status:** **Proposed** — requires legal/tax review before M3 (D-7)
- **Date:** 2026-10-29
- **Related:** PRODUCT §4, RISK R-010

## Context
The customer pays the Platform and the supplier receives a predefined payout. Holding funds on behalf of third parties, or splitting payments, can trigger payment-services regulation and complicates VAT.

## Options considered
1. **Merchant of record:** the Platform sells the finished part (issues the tax invoice to the customer); suppliers sell manufacturing services to the Platform (they invoice the Platform); periodic payouts by bank transfer.
2. Marketplace split payments through a PSP marketplace product: automatic splits, but more regulatory/KYC complexity, and supplier visibility to customers.

## Decision (proposed)
Option 1 for the MVP.

## Consequences
The Platform carries product responsibility toward the customer (→ QC is first-class, plus insurance). A payout ledger and monthly statements are needed (M5). It may need to be revisited at scale or for international suppliers.
