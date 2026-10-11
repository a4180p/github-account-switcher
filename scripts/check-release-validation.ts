import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import packageJson from '../package.json' with { type: 'json' }

const root = new URL('../', import.meta.url)
const addonId = 'github-account-switcher@a4180p.github.io'
function run(script: string, args: string[] = [], tag = '') {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(new URL(script, root)), ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_REF_NAME: tag },
    },
  )
}

const valid = run('scripts/validate-release-tag.mjs', [], `v${packageJson.version}`)
assert.equal(valid.status, 0, valid.stderr)
for (const tag of ['', 'v0.0.0', 'release-current', `v${packageJson.version};echo unexpected`]) {
  const invalid = run('scripts/validate-release-tag.mjs', [], tag)
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stderr, /Release tag must be/)
}

const folder = await fs.mkdtemp(join(tmpdir(), 'firefox-release-check-'))
const path = join(folder, 'fixture.xpi')
function writePackage(version: string, id: string, signed: boolean) {
  const archive = new AdmZip()
  archive.addFile(
    'manifest.json',
    Buffer.from(
      JSON.stringify({
        version,
        browser_specific_settings: { gecko: { id } },
      }),
    ),
  )
  if (signed) {
    for (const name of ['manifest.mf', 'mozilla.sf', 'mozilla.rsa']) {
      archive.addFile(
        `META-INF/${name}`,
        Buffer.from('Test metadata, not a cryptographic signature'),
      )
    }
  }
  archive.writeZip(path)
}
try {
  writePackage(packageJson.version, addonId, false)
  const unsigned = run('scripts/validate-signed-firefox.ts', [path])
  assert.notEqual(unsigned.status, 0)
  assert.match(unsigned.stderr, /Missing Mozilla signature file/)

  writePackage(packageJson.version, addonId, true)
  const metadata = run('scripts/validate-signed-firefox.ts', [path])
  assert.equal(metadata.status, 0, metadata.stderr)

  writePackage('0.0.0', addonId, true)
  const wrongVersion = run('scripts/validate-signed-firefox.ts', [path])
  assert.notEqual(wrongVersion.status, 0)
  assert.match(wrongVersion.stderr, /version differs/)

  writePackage(packageJson.version, 'other-addon@example.org', true)
  const wrongAddon = run('scripts/validate-signed-firefox.ts', [path])
  assert.notEqual(wrongAddon.status, 0)
  assert.match(wrongAddon.stderr, /different add-on/)
} finally {
  await fs.rm(folder, { recursive: true, force: true })
}

console.log('Release tag and signed-XPI publication guards OK')
