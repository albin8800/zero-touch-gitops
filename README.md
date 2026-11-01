# Zero-Touch GitOps Pipeline

> An automated, enterprise-grade GitOps assembly line. A single Git commit is verified locally, containerized in the cloud, published to a secure registry, and deployed with zero downtime to Kubernetes via ArgoCD, with real-time observability provided by Prometheus and Grafana.

---

## Architecture Overview

```text
┌─────────────────────────────────┐
│  1. LOCAL WORKSTATION           │
│                                 │
│  ┌───────────────────────────┐  │
│  │     Developer Laptop      │  │
│  └─────────────┬─────────────┘  │
│                │ git commit     │
│                ▼                │
│  ┌───────────────────────────┐  │
│  │   Husky Pre-commit Hook   │  │
│  │   (Prettier Validation)   │  │
│  └─────────────┬─────────────┘  │
└────────────────┼────────────────┘
                 │ git push origin main
                 ▼
┌─────────────────────────────────┐      ┌────────────────────────────────────────────────────────┐
│  2. CI FACTORY (GitHub Actions) │      │  3. GITOPS ENGINE (Minikube & ArgoCD)                  │
│                                 │      │                                                        │
│  ┌───────────────────────────┐  │      │  ┌───────────────────────────┐                         │
│  │   GitHub Actions Runner   │  │      │  │ ArgoCD GitOps Controller  │◄──(Watches GitHub Repo)─┘
│  └─────────────┬─────────────┘  │      │  └─────────────┬─────────────┘
│                │ 1. Validate    │      │                │ Automated Sync & Self-Heal
│                ▼                │      │                ▼
│  ┌───────────────────────────┐  │      │  ┌──────────────────────────────────────────────────┐
│  │    Code Quality Gate      │  │      │  │ Namespace: zero-touch-gitops                     │
│  └─────────────┬─────────────┘  │      │  │                                                  │
│                │ 2. Build       │      │  │  ┌────────────────────────────────────────────┐  │
│                ▼                │      │  │  │      Service (ClusterIP: Port 80)          │  │
│  ┌───────────────────────────┐  │      │  │  └──────────────────────┬─────────────────────┘  │
│  │   Docker Buildx (Alpine)  │  │      │  │                         │ Load Balances Traffic  │
│  └─────────────┬─────────────┘  │      │  │                         ▼                        │
│                │ 3. Publish     │      │  │  ┌──────────────────┐      ┌──────────────────┐  │
│                ▼                │      │  │  │  API Pod 1 (v2)  │      │  API Pod 2 (v2)  │  │
│  ┌───────────────────────────┐  │      │  │  │ (Non-root, /hlth)│      │ (Non-root, /hlth)│  │
│  │ GitHub Container Registry │──┼──────┼─►│  └────────┬─────────┘      └────────┬─────────┘  │
│  │       (ghcr.io)           │  │ Pull │  └───────────┼─────────────────────────┼────────────┘
│  └───────────────────────────┘  │ Image│              │                         │
└─────────────────────────────────┘      └──────────────┼─────────────────────────┼────────────┘
                                                        │                         │
                                                        │ Scrapes /cadvisor       │
                                                        ▼                         ▼
                                         ┌─────────────────────────────────────────────────────┐
                                         │  4. OBSERVABILITY STACK                             │
                                         │                                                     │
                                         │  ┌──────────────────────┐   ┌────────────────────┐  │
                                         │  │ Prometheus (Scraper) │──►│ Grafana Dashboard  │  │
                                         │  └──────────────────────┘   │  (Live CPU/RAM)    │  │
                                         │                             └────────────────────┘  │
                                         └─────────────────────────────────────────────────────┘
```

---

## Key Platform Engineering Pillars

### 1. Shift-Left Quality Gates (Husky & Prettier)
* **Problem**: Broken syntax or unformatted code hitting remote CI runners wastes billable cloud compute minutes and pollutes Git commit history.
* **Solution**: Local Git hooks intercept commits in `<200ms`, executing automated formatting and lint checks before changes leave the developer's workstation.

### 2. Multi-Stage Hardened Containerization (The Vault)
* **Minimal Base OS**: Built on lightweight `node:24-alpine` to reduce attack surface and CVE surface area.
* **Least-Privilege Security**: Container explicitly runs as an unprivileged user (`USER node`, UID 1000) to prevent container-breakout escalation.
* **Supply-Chain Hardening**: Package installations run with `--omit=dev` and `--ignore-scripts` to neutralize malicious lifecycle scripts during container compilation.

### 3. Declarative Continuous Integration (The Factory)
* Fully automated GitHub Actions workflow triggered on pushes to `main`.
* Builds multi-platform images and tags artifacts with both immutable Git commit SHAs and `latest`.
* Stores immutable images inside **GitHub Container Registry (GHCR)** using ephemeral `GITHUB_TOKEN` credentials.

### 4. Git-Driven Continuous Delivery (ArgoCD Autopilot)
* **Zero Server SSH**: Zero direct `kubectl` commands needed in production.
* **Declarative Applications**: ArgoCD actively polls the Git repository, detecting blueprint drift and automatically reconciling the live cluster state.
* **Self-Healing**: Out-of-band modifications to Kubernetes resources are automatically overridden to match the declared Git state.
* **Zero Downtime**: Rolling update deployment strategy with cloud-native `/healthz` readiness and liveness probes.

### 5. Low-Footprint Observability (Prometheus & Grafana)
* Dedicated `monitoring` namespace hosting Prometheus and Grafana.
* Tuned with strict memory constraints (`<200Mi` limits) designed specifically for local resource efficiency.
* Custom PromQL telemetry tracking real-time container memory consumption:
  ```promql
  container_memory_usage_bytes{namespace="zero-touch-gitops"}
  ```

---

## Repository Structure

```text
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow definition
├── .husky/
│   └── pre-commit              # Git pre-commit hook script
├── k8s/
│   ├── namespace.yaml          # Isolated application namespace
│   ├── deployment.yaml         # App deployment with health probes & resource limits
│   ├── service.yaml            # Internal ClusterIP load balancer
│   └── argocd-application.yaml # ArgoCD declarative Application manifest
├── src/
│   └── server.js               # Zero-dependency Node.js REST API with /healthz
├── Dockerfile                  # Hardened multi-stage Alpine Dockerfile
├── .dockerignore               # Build context exclusions
├── .prettierrc                 # Code formatting standards
├── monitoring-stack.yaml       # Lightweight Prometheus & Grafana stack
└── package.json                # Project dependencies and validation scripts
```

---

## End-to-End Pipeline Verification

When a developer pushes an update, the automated pipeline transitions the microservice seamlessly:

```bash
# Query the live Kubernetes Service
curl http://localhost:8081/
```

**Live Production Response:**
```json
{
  "service": "zero-touch-gitops-api",
  "version": "2.0.0",
  "environment": "production",
  "message": "Zero-Touch GitOps v2.0 is LIVE! Automated deployment successful!"
}
```

---

## Local Reproduction Guide

1. **Clone the repository:**
   ```bash
   git clone https://github.com/albin8800/zero-touch-gitops.git
   cd zero-touch-gitops
   npm install
   ```
2. **Start Local Kubernetes:**
   ```bash
   minikube start --driver=docker --cpus=2 --memory=2800mb
   ```
3. **Install ArgoCD:**
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   kubectl apply -f k8s/argocd-application.yaml
   ```
4. **Deploy Monitoring Stack:**
   ```bash
   kubectl apply -f monitoring-stack.yaml
   ```
