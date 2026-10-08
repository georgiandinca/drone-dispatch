# Story 3 — Cloud Migration & Managed Infrastructure

> **As a** Cloud Platform & Solutions Architect
> **I want** a declarative Terraform blueprint to migrate the drone dispatch service from localhost/on-prem to Google Cloud Platform (GCP)
> **So that** our delivery operations run on resilient, scalable, managed cloud infrastructure with an evaluated persistence and database strategy.

---

## Background

The initial lab implementation runs entirely on `localhost`: an Express.js process hosting an in-memory simulation loop (`setInterval`) and static JSON files (`drones.json`, `parcels.json`, `zones.json`). 

While optimal for fast local prototyping, this architecture cannot scale, loses all telemetry and assignments on process restart, and runs on unmanaged single-host compute. Moving to Google Cloud requires balancing **delivery velocity** (demonstrating immediate cloud value) with **enterprise readiness** (stateless services, resilient databases, decoupled event triggers, and declarative IaC).

This story establishes the migration blueprint via Terraform, detailing both immediate and target migration strategies alongside an architectural decision matrix for enterprise-grade persistence.

---

## Architectural Decisions

### Decision 1: Compute & Runtime Migration Strategy

The team must choose between two deployment models:

| Dimension | Option A: Rapid Serverless Container (Lift & Prototype) | Option B: Cloud-Native Decoupled Architecture (Production Target) |
|---|---|---|
| **Concept** | Dockerize current service as-is and run on Cloud Run with always-allocated CPU and in-memory state. | Stateless Cloud Run services + external database persistence + decoupled simulation worker. |
| **Compute** | Cloud Run v2 (`cpu_idle = false`, `min_instances = 1`). | Cloud Run v2 (autoscaled 0..N, stateless). |
| **State Handling** | In-memory within container instance. | External managed database (see Decision 2). |
| **Simulation Loop** | In-process `setInterval(tick, 3000)` running inside container. | External triggers via Cloud Scheduler / Cloud Tasks calling `/api/tick`. |
| **Implementation Effort** | **Low (~30–45 min):** Dockerfile + core Terraform module. | **Medium (~2.5–3.5 hrs):** Dockerfile, Terraform, DB schema, code adapter. |
| **Pros** | Zero code changes to business logic; instant demo in GCP; low complexity. | Resilient across restarts; horizontal scaling; real historical reporting. |
| **Cons** | Anti-pattern for serverless; state lost on redeploy/restart; single instance bound. | Requires asynchronous database adapters across services. |
| **Recommended Context** | Presales workshop live demo / Proof of Concept. | Production deployment / Enterprise pilot. |

---

### Decision 2: Enterprise Database Decision Matrix

When pursuing Option B (or upgrading Option A), state must move from ephemeral JSON files to a managed database. Evaluate the following enterprise options:

| Database Option | Best Suited For | Key Advantages | Trade-offs & Operational Considerations |
|---|---|---|---|
| **Cloud Firestore** *(Native Mode)* | Rapid prototyping, document model, real-time dashboard subscriptions. | - Serverless, zero maintenance.<br>- Native real-time listeners for frontend tracking.<br>- Flexible document schema (nested zones, parcels). | - Pricing per document read/write (high-frequency telemetry can increase cost).<br>- Complex analytical queries require BigQuery export. |
| **Cloud SQL for PostgreSQL** *(Enterprise Edition)* | Enterprise transactional standard, relational consistency, spatial queries. | - Industry-standard relational ACID model.<br>- **PostGIS extension** enables real geodetic distance and no-fly polygon calculations instead of static JSON lookup.<br>- Native enterprise tooling and ecosystem support. | - Provisioned instance pricing (always running).<br>- Requires Serverless VPC Access connector or Cloud SQL Auth Proxy for Cloud Run. |
| **AlloyDB for PostgreSQL** | Mission-critical, high-throughput fleet logistics, hybrid transactional & analytical workloads. | - 4x faster transactional throughput than standard PostgreSQL.<br>- Integrated columnar engine for real-time fleet analytics.<br>- 99.99% availability SLA including maintenance. | - Higher baseline cost than Cloud SQL.<br>- Overkill for simple pilot/demo fleet (<100 drones). |
| **Cloud Spanner** | Global or multi-region scale, cross-region replication, continuous 99.999% SLA. | - Virtually limitless horizontal scaling.<br>- Strong consistency across regions without replication lag.<br>- Zero planned downtime. | - High cost floor.<br>- Specialized schema design requirements; unnecessary for single-country/regional logistics. |
| **Cloud Memorystore (Redis)** *(Hybrid Layer)* | High-frequency telemetry cache alongside durable DB. | - Sub-millisecond latency for live drone coordinates, speed, and battery drain.<br>- Pub/Sub channels for live location streaming. | - In-memory cache only; requires companion durable store (PostgreSQL/Firestore) for transaction records. |

#### Architectural Recommendation
- **For immediate Cloud Run prototype:** Proceed with **Option A** (in-memory) to validate cloud deployment.
- **For persistent enterprise tier:** Select **Cloud SQL for PostgreSQL with PostGIS** for accurate spatial routing, or **Cloud Firestore Native** for rapid real-time dashboard listeners.

---

## Acceptance Criteria

1. **Terraform Structure:**
   - Terraform project structured under `terraform/` with standard files: `main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars.example`.
   - Provider pinned to `hashicorp/google` `>= 5.0`.
2. **Containerization:**
   - Production-ready `Dockerfile` (multi-stage or lightweight Node 20 alpine/slim) and `.dockerignore`.
   - Environment-variable configuration for port (`PORT`, default 3000) and log levels.
3. **Artifact Registry Provisioning:**
   - Terraform manages an Artifact Registry Docker repository (e.g. `dedeman-drone-repo`).
4. **Cloud Run Provisioning:**
   - Terraform provisions Cloud Run v2 service with:
     - Configurable CPU and memory allocations (default: 1 vCPU, 512 MiB).
     - Scalability parameters (`min_instances`, `max_instances`).
     - Configuration supporting Option A (`cpu_idle = false`) or Option B stateless posture.
5. **Security & Least Privilege IAM:**
   - Dedicated GCP Service Account created specifically for the Cloud Run workload.
   - Separate, parameterized toggle for public unauthenticated access (`roles/run.invoker`) for demo purposes.
6. **Database Provisioning (Option B Module):**
   - Terraform module or resource block conditionally provisioning the chosen managed database (Firestore Native or Cloud SQL instance).
7. **Reproducibility & Automation:**
   - Clear deployment script or runbook (`deploy.sh` or README section) detailing:
     - `gcloud auth` / ADC setup.
     - Docker build, tag, and push to Artifact Registry.
     - `terraform apply` execution.
8. **Outputs:**
   - Terraform exports the live Cloud Run service URL and Artifact Registry endpoint.

---

## Out of Scope

- Multi-region disaster recovery deployment.
- Production DNS registration and vanity domain certificates.
- Complex Kubernetes / GKE orchestration (Cloud Run is the chosen compute target).

---

## Definition of Done

- Clean Terraform validation (`terraform validate` and `terraform fmt` pass).
- Docker image builds cleanly locally with `docker build`.
- Local simulation behavior (Story 1 smart dispatch and Story 2 dashboard) functions identically when containerized.
- Architectural decision record clearly reflects the selected database and compute options.

---

## Suggested AI Workflow

1. Have the AI generate the `Dockerfile` and `.dockerignore`, then verify local build and test execution.
2. Ask the AI to write the modular Terraform code under `terraform/`, supporting Option A with cleanly commented toggle points for Option B.
3. Review the database decision trade-offs with the team to validate whether the next iteration should adopt Firestore or Cloud SQL (PostGIS).
4. Run `terraform plan` (dry-run) against the target GCP project and confirm least-privilege IAM mappings.
