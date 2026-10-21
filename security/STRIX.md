# Strix Security Scan

Strix is an optional development-time AI penetration testing/security review tool. It is not one of AegisShield's five logical product agents and must not be called by the production API.

## Local source scan

Prerequisites: Docker Desktop and a configured LLM provider. The model provider is a separate service and can cost money, so use a provider/key with a budget limit. Install from the official Strix instructions and run only on this repository:

```powershell
# Follow the official installer documentation: https://docs.strix.ai/quickstart
strix -n --target . --scan-mode quick
```

Strix writes findings under `strix_runs/`; the directory is ignored by Git. Review each issue manually, reproduce safely, and create a normal code change with a regression test. Do not accept automated fixes without review.

## Optional GitHub Actions

`.github/workflows/strix.yml` is manual (`workflow_dispatch`) so security scans do not unexpectedly consume model quota on every push. Configure `STRIX_LLM` and `LLM_API_KEY` as repository secrets if using the local open-source scanner. The optional URL input must be a staging URL that the team owns and controls. Do not submit a third-party system or the hackathon event site as a target.

The repository identifies Strix as an open-source penetration-testing tool; its official quickstart requires Docker and an LLM provider key. Read [Strix quickstart](https://docs.strix.ai/quickstart) and [Strix source/usage terms](https://github.com/usestrix/strix) before scanning. The scan can create real HTTP traffic and exploit attempts against a live target.
