import assert from 'node:assert/strict'
import AdmZip from 'adm-zip'
import packageJson from '../package.json' with { type: 'json' }

const path = process.argv[2]
assert.ok(path, 'Pass the signed Firefox XPI path')
const archive = new AdmZip(path)

// Mozilla signs the download; Firefox verifies its cryptographic signature on installation.
for (const name of ['META-INF/manifest.mf', 'META-INF/mozilla.sf', 'META-INF/mozilla.rsa']) {
  const entry = archive.getEntry(name)
  assert.ok(entry && entry.getData().length > 0, `Missing Mozilla signature file: ${name}`)
}

const manifestEntry = archive.getEntry('manifest.json')
assert.ok(manifestEntry, 'Signed XPI needs manifest.json at its root')
let manifest
try {
  manifest = JSON.parse(manifestEntry.getData().toString())
} catch (error) {
  throw new Error('Invalid manifest.json in signed XPI', { cause: error })
}
assert.equal(manifest.version, packageJson.version, 'Signed XPI version differs from package.json')
assert.equal(
  manifest.browser_specific_settings?.gecko?.id,
  'github-account-switcher@a4180p.github.io',
  'Signed XPI belongs to a different add-on',
)
console.log('Firefox XPI version, add-on ID, and signature files match')
