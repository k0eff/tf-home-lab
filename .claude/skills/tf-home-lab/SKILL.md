---
name: tf-home-lab
description: Use when changing or inspecting VMs, Proxmox/vSphere infrastructure or the Terraform-managed Home Assistant automations in tf-home-lab — before any terraspace plan/up, before touching protected/ state, and whenever someone is tempted to change a VM by hand in the Proxmox UI.
---

# tf-home-lab

Terraspace (Terraform) repo. **Owns the VM / Proxmox / infrastructure layer** of the home lab
(root `AGENTS.md`, "One tool per layer"). Host and Docker state inside the VMs belong to
`ansible-home-lab`; cluster state to `helmfile-home-lab`. The Proxmox UI and SSH are for reading.
A hand change made in an emergency is written back here in the same session.

## Layout

- `app/stacks/` — `proxmox-vm` (vm700 lives here), `vmware-vm`, `vmware-vmManual`, `home-assistant`
- `app/modules/` — `proxmox`, `vmware`
- `config/terraform/` — providers (vsphere, Telmate/proxmox, homeassistant) and the **local** backend:
  state is `protected/state/<stack>/<env>/terraform.tfstate`
- `protected/` — private submodule: `main.sh`, `envs/<env>/vars.sh` (credentials), state. Never
  print or commit anything from it.
- `tools/home-assistant-live/` — node scripts for live HA work; see `protected/HASSIO_LIVE_APPLY.md`

## Day-to-day commands (from `Makefile` / `protected/main.sh`)

```bash
source protected/main.sh prod proxmox-vm   # sets TS_ENV, TS_STACK and credentials
make plan                                  # terraspace plan ${TS_STACK}
make apply                                 # terraspace up -y ${TS_STACK}  — owner-approved only
```

## Guarded plan — run this first

```bash
scripts/tf-plan-guard.sh                    # plan proxmox-vm/prod, never applies
scripts/tf-plan-guard.sh home-assistant prod
scripts/tf-plan-guard.sh --plan-json scripts/fixtures/plan-with-delete.json   # self-test, exits 2
TF_HOME_LAB_ROOT=<checkout with protected/> scripts/tf-plan-guard.sh   # from a worktree
```

Exit 0 = no delete/replace; **2 = plan destroys or force-replaces something: stop, do not apply**;
1 = could not tell (fails closed). The script has no apply path at all.

## Rules

- `apply`/`up` against prod is irreversible live work: owner approval, recorded per root AGENTS.md.
- A plan that replaces `proxmox_vm_qemu` recreates the VM disk — always exit 2 here, always stop.
- Evals in `evals/` (`NNN-<branch-slug>-<category>--<desc>.json`), Conventional Commits.
- Worktrees have no `protected/` checkout; point `TF_HOME_LAB_ROOT` at the main checkout for plans.
