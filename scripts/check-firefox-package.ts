import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

const root = new URL('../', import.meta.url)
const archive = new AdmZip(fileURLToPath(new URL('release/firefox-unsigned.xpi', root)))
const manifestEntry = archive.getEntry('manifest.json')
assert.ok(manifestEntry, 'manifest.json must be at the XPI root')
let manifest
try {
  manifest = JSON.parse(manifestEntry.getData().toString())
} catch (error) {
  throw new Error('Invalid manifest.json in Firefox XPI', { cause: error })
}
assert.equal(manifest.manifest_version, 2)
assert.equal(
  manifest.browser_specific_settings.gecko.id,
  'github-account-switcher@a4180p.github.io',
)
assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '140.0')
assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, [
  'authenticationInfo',
  'websiteContent',
])
assert.ok(manifest.permissions.includes('webRequestBlocking'))
assert.ok(!manifest.permissions.includes('declarativeNetRequest'))
assert.ok(!archive.getEntry('dist_firefox/manifest.json'))
assert.ok(
  archive.getEntry('assets/src-content-index.ts.js'),
  'Content script needs a reproducible filename',
)
assert.ok(!archive.getEntry('META-INF/manifest.mf'), 'The local XPI must remain unsigned')

for (const path of [
  manifest.background.page,
  manifest.browser_action.default_popup,
  ...manifest.content_scripts.flatMap((script: { js: string[] }) => script.js),
]) {
  assert.ok(archive.getEntry(path), `Missing extension entry: ${path}`)
}
for (const html of [manifest.background.page, manifest.browser_action.default_popup]) {
  const content = archive.readAsText(html)
  for (const match of content.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    assert.ok(archive.getEntry(match[1].replace(/^\//, '')), `Missing script: ${match[1]}`)
  }
}
for (const entry of archive.getEntries()) {
  if (!entry.isDirectory) {
    const built = await fs.readFile(new URL(`dist_firefox/${entry.entryName}`, root))
    assert.ok(entry.getData().equals(built), `XPI differs from the build: ${entry.entryName}`)
  }
}
assert.ok(
  (await fs.readFile(new URL('release/firefox.zip', root))).equals(
    await fs.readFile(new URL('release/firefox-unsigned.xpi', root)),
  ),
)

const source = new AdmZip(fileURLToPath(new URL('release/firefox-source.zip', root)))
for (const path of [
  'package.json',
  'pnpm-lock.yaml',
  'manifest.ts',
  'vite.config.ts',
  'tsconfig.json',
  'popup.html',
  'README.md',
  'LICENSE',
  'docs/firefox-release.md',
  'scripts/build.ts',
  'scripts/check-firefox-package.ts',
  'src/background/index.ts',
  'public/img/logo-48.png',
]) {
  assert.ok(source.getEntry(path), `Missing reviewer source: ${path}`)
}
for (const entry of source.getEntries()) {
  assert.ok(
    /^(?:src\/|public\/|scripts\/|docs\/firefox-release\.md$|package\.json$|pnpm-lock\.yaml$|tsconfig\.json$|vite\.config\.ts$|manifest\.ts$|popup\.html$|LICENSE$|README\.md$)/.test(
      entry.entryName,
    ),
    `Unexpected source archive path: ${entry.entryName}`,
  )
  if (!entry.isDirectory) {
    assert.ok(
      entry.getData().equals(await fs.readFile(new URL(entry.entryName, root))),
      `Reviewer source differs from the working tree: ${entry.entryName}`,
    )
  }
}

console.log('Firefox unsigned XPI and reviewer source archive OK')
