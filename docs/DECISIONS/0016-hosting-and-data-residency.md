# 0016 — Managed containers + managed Postgres/Redis/S3, region near Israel

- **Status:** **Proposed** — owner decision D-8
- **Date:** 2026-10-29

## Context
No Kubernetes in the MVP. We need low latency to Israel, private object storage, PITR backups, simple deploys and compliance with Israeli privacy rules (and GDPR readiness).

## Options
1. AWS in `il-central-1` (Tel Aviv): ECS Fargate for web/worker/geometry, RDS PostgreSQL, ElastiCache Redis, S3, CloudFront. Local residency, broad services; more setup.
2. An EU region of a major cloud: lower cost or more services, with acceptable latency, and GDPR-aligned.
3. A PaaS (container platform + managed DB): the fastest to start, with less control over network isolation for the geometry sandbox.

## Decision (proposed)
Option 1, or 2 for staging if cost matters early. Terraform for IaC. Final choice before staging is needed (end of M0R).

## Consequences
DEPLOYMENT.md is written in M5. Provider-neutral building blocks (Postgres, Redis, S3 API, OCI containers) keep migration possible.
