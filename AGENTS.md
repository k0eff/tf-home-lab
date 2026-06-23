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
