# aramb SDK samples

Sample apps built only on the public aramb Node SDK, [`@aramb-ai/sdk`](https://www.npmjs.com/package/@aramb-ai/sdk).
Each sample is a self-contained folder with its own `package.json`, lockfile and README: clone the repo, `cd` into a
sample and follow its README.

| Sample | What it shows |
|---|---|
| [`support-desk/`](support-desk/) | A small support desk for companies: people sign in with the app's own login, chat with a Support and a Billing agent with streamed replies, and a company admin sees usage per person and per company per month, sees each person's conversations and can remove a person. |

## Rules of this repository

This repository is public. Every pull request must pass two checks:

- **`hygiene`**: no secrets in the full history (gitleaks with `.gitleaks.toml`), only allow-listed files
  (`.github/allowed-paths` and each sample's `.allowed-paths`), no internal references, workflows on GitHub-hosted
  runners with read-only permissions and SHA-pinned actions, `.env.example` files with placeholders only, and
  lockfiles that resolve from the public npm registry.
- **`build`**: for every sample, `npm ci`, lint, typecheck, tests, `next build`, and a scan of the client bundle for
  API keys.

The internal-references check reads the repository secret `INTERNAL_DENYLIST` and fails closed without it. Pull
requests opened by Dependabot only see **Dependabot secrets**, so the repository owner adds the same value under
Settings → Secrets and variables → Dependabot as well; otherwise Dependabot's pull requests fail `hygiene`.

To run the secret scan before each commit, install [pre-commit](https://pre-commit.com) and run `pre-commit install`
(it uses `.pre-commit-config.yaml`).

Samples depend on released SDK versions from npm only. Outside contributions are not accepted at the moment; bug
reports are welcome as issues.

## License

MIT, see [LICENSE](LICENSE).
