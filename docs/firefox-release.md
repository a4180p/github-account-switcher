# Firefox release and unlisted signing

## Build the upload artifacts

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm package:firefox
```

Outputs:

- `release/firefox-unsigned.xpi`: extension files, with `manifest.json` at the archive root.
- `release/firefox-source.zip`: matching source, lockfile, build script, and these instructions.
- `release/firefox.zip`: the existing Firefox ZIP output, retained for compatibility.
- `release/chrome.zip`: the existing Chrome ZIP output.

The unsigned XPI is not a permanently installable add-on in normal Firefox. Mozilla must sign it.
This fork uses the ID `github-account-switcher@a4180p.github.io`; do not reuse the upstream
extension's identity. Keep this ID unchanged for later releases. Changing an ID creates a separate
add-on with separate extension storage, so accounts may need to be captured again when moving from
an older temporary install.

The Firefox build requires Firefox 140 or later. Its built-in consent declaration includes
`authenticationInfo` and `websiteContent`: the extension stores account cookies locally and sends
account authentication and cookies to GitHub to implement switching. Avatar requests also go to
GitHub. There is no telemetry or separate collection backend. Review this declaration before
submission if the extension's data handling changes.

## Reviewer build instructions

Local packaging was checked on macOS ARM64 with Node 26.11.0 and pnpm 10.25.0. Automated GitHub
releases use Ubuntu 24.04 x86-64 with the same Node and pnpm versions. Reproduce a GitHub release on
that CI platform. The current toolchain requires Node 20.19.x or Node 22.12.0 or later.

Download Node from [nodejs.org](https://nodejs.org/en/download), then install pnpm:

```bash
npm install --global pnpm@10.25.0
```

Extract `firefox-source.zip` into an empty directory. From that directory, run:

```bash
pnpm install --frozen-lockfile
pnpm package:firefox
```

Compare the generated `dist_firefox/` files with the submitted XPI's files. ZIP timestamps do not
need to match. Internet access is required to install dependencies; building needs no credentials.
The source ZIP deliberately excludes Git history, local agent/GitHub configuration, environment
files, installed dependencies, and generated release artifacts.

## Sign through the AMO Developer Hub

1. Sign in to the [AMO Developer Hub](https://addons.mozilla.org/developers/).
2. Submit a new add-on and choose **On your own** (self-distribution/unlisted), not a public listing.
3. Upload `release/firefox-unsigned.xpi`.
4. Attach `release/firefox-source.zip` when asked for source code. This is required because Vite
   bundles and minifies the extension.
5. Complete Mozilla's validation and any review steps. Download the signed XPI when available.

Unlisted submissions are still subject to Mozilla's policies and may need review. Local packaging
or lint success does not guarantee signing approval. For every later submission, increase
`package.json`'s version, keep the same add-on ID, and rebuild both archives together.

## Automated GitHub Releases

The workflow `.github/workflows/release-firefox.yml` runs when you push a `v*` tag. The tag must
exactly match `v` plus the version in `package.json`; otherwise it stops before signing.

Configure these repository Actions secrets from the Mozilla account that owns this add-on:

- `WEB_EXT_API_KEY`: AMO JWT issuer.
- `WEB_EXT_API_SECRET`: AMO JWT secret.

To release the next patch version from a clean checkout on `main`:

```bash
npm version patch
git push origin main --follow-tags
```

`npm version patch` creates the version commit and annotated version tag. For example, starting
from `1.2.0` produces `v1.2.1`. Do not reuse a version already submitted to AMO.

The workflow checks the version, installs from the lockfile, typechecks, builds both Firefox
archives, runs checks, and runs Mozilla validation. It then requests unlisted signing using secrets
scoped to that step. Only after signing succeeds does it create a GitHub Release with the downloaded
signed XPI and `firefox-source.zip`. It never publishes `firefox-unsigned.xpi` as a release asset.

The publication guard checks the XPI's version, add-on ID, and signature-file presence. Mozilla
performs signing and Firefox verifies the cryptographic signature during installation; the guard
is not a separate cryptographic verifier. Actions are pinned to commit revisions, and automatic
package-manager caching is disabled in the release job. The built-in GitHub token has `contents: write` permission for release creation; no personal GitHub token is
required, and checkout credentials are not left in Git configuration.

Follow progress in [GitHub Actions](https://github.com/a4180p/github-account-switcher/actions).
Download completed signed releases from [GitHub Releases](https://github.com/a4180p/github-account-switcher/releases).

The job has a 30-minute limit. Mozilla review can exceed that time. If signing times out, inspect
the submitted version in AMO before trying again: resubmitting the same version can be rejected.
If Mozilla later signs it, download that signed XPI and use GitHub's **Draft a new release** page to
publish it and the matching source ZIP against the existing tag. GitHub hosting does not enable
automatic Firefox updates by itself.

## Optional command-line signing

Get your JWT issuer and secret from [AMO API credentials](https://addons.mozilla.org/developers/addon/api/key/).
Enter them interactively so the values do not enter shell history:

```bash
printf 'AMO JWT issuer: '
read -r WEB_EXT_API_KEY
printf 'AMO JWT secret: '
read -rs WEB_EXT_API_SECRET
printf '\n'
export WEB_EXT_API_KEY WEB_EXT_API_SECRET

pnpm dlx web-ext@10.7.0 sign \
  --source-dir dist_firefox \
  --channel unlisted \
  --upload-source-code release/firefox-source.zip \
  --artifacts-dir release/signed

unset WEB_EXT_API_KEY WEB_EXT_API_SECRET
```

This command uploads the built extension and its source to Mozilla, and downloads a signed XPI
when signing succeeds. It is not run by `pnpm package:firefox`. Keep credentials out of the repository
and the source archive. The signing tool is used on demand; it is not a project dependency.

Optional local Mozilla validation, without credentials or an upload:

```bash
pnpm dlx web-ext@10.7.0 lint --source-dir dist_firefox
```

The initial local validation reported 0 errors and 3 warnings: one Android consent-version warning
and two `innerHTML` warnings in the bundled popup. This build targets desktop Firefox. Review the
warnings before submission; a successful lint run is not a security audit or signing approval.

## Install permanently

In Firefox, open `about:addons`, click the gear menu, select **Install Add-on From File**, and choose
the **signed** XPI. Accept the permission and data-transmission prompts. The add-on remains installed
after Firefox restarts. Loading through `about:debugging` is still temporary.

For an unlisted add-on without a hosted update manifest, install newer signed XPIs manually through
the same menu. This repository does not host automatic updates.

## Mozilla sources

- [Signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [web-ext command reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Firefox built-in consent for data collection and transmission](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
