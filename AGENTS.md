# Agent Instructions

## Security — No Secrets in This Repository

This is a **public repository**. Never store secrets, credentials, or sensitive values here.

Secrets and sensitive configuration belong exclusively in the protected repository:
**[k0eff/tf-home-lab-protected](https://github.com/k0eff/tf-home-lab-protected)**
which is checked out locally at `./protected/`.

### What must NOT be committed here

- Passwords, API keys, tokens, bearer credentials
- Terraform state files (`*.tfstate`, `*.tfstate.backup`)
- Terraform variable files with real values (`*.tfvars` containing secrets)
- Cloud provider credentials or access keys
- SSH private keys or passphrases
- Any value from `protected/envs/`

### Where secrets go instead

All sensitive values are stored under `protected/envs/` in the private repo above.
Terraform modules may accept variables for secrets, but the variable values
themselves must never appear in this repo.

### If you are unsure

When in doubt, put the value in the `protected/` repo and reference it as a variable.

## Evaluation System

Every implementation task requires an eval JSON in `evals/`.

**Format:** `NNN-{branch-slug}-{category}--{description}.json`
- `branch-slug`: `git branch --show-current | sed 's|/|-|g'`
- `NNN`: sequential per branch — find highest matching in `evals/`, increment by 1
- **Create with `status: "pending"` BEFORE coding. Set `status: "pass"` after validation.**
- Include "eval" or eval filename in commit message.
- Update existing eval if same file already covered. Supersede: set old `status: "disabled"`.

Full documentation: [koeff-gitroot-main/EVALS.md](https://github.com/k0eff/koeff-gitroot-main/blob/main/EVALS.md)
