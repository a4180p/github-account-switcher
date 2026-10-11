import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const folder = await fs.mkdtemp(join(tmpdir(), 'release-patch-check-'))
const repo = join(folder, 'repo')
const remote = join(folder, 'origin.git')
const script = join(repo, 'scripts/release-patch.mjs')
function git(args: string[], cwd = repo) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}
function release() {
  return spawnSync(process.execPath, [script], { cwd: join(repo, 'scripts'), encoding: 'utf8' })
}

try {
  await fs.mkdir(join(repo, 'scripts'), { recursive: true })
  await fs.copyFile(fileURLToPath(new URL('./release-patch.mjs', import.meta.url)), script)
  await fs.writeFile(
    join(repo, 'package.json'),
    JSON.stringify({ name: 'sample-extension', version: '0.1.0' }),
  )
  await fs.writeFile(join(repo, '.npmrc'), 'sign-git-tag=false\n')
  git(['init', '--initial-branch=main'])
  git(['config', 'user.name', 'Sample Developer'])
  git(['config', 'user.email', 'sample@example.org'])
  git(['config', 'commit.gpgSign', 'false'])
  git(['config', 'tag.gpgSign', 'false'])
  git(['add', '.'])
  git(['commit', '-m', 'Initial test version'])
  git(['init', '--bare', '--initial-branch=main', remote], folder)
  git(['remote', 'add', 'origin', remote])

  const initialHead = git(['rev-parse', 'HEAD'])
  git(['switch', '-c', 'test-branch'])
  const wrongBranch = release()
  assert.notEqual(wrongBranch.status, 0)
  assert.match(wrongBranch.stderr, /Switch to main/)
  assert.equal(git(['rev-parse', 'HEAD']), initialHead)
  assert.equal(git(['tag', '--list']), '')

  git(['switch', 'main'])
  await fs.writeFile(join(repo, 'uncommitted.txt'), 'Uncommitted test file')
  const dirty = release()
  assert.notEqual(dirty.status, 0)
  assert.match(dirty.stderr, /Commit or stash local changes/)
  assert.equal(git(['rev-parse', 'HEAD']), initialHead)
  assert.equal(git(['tag', '--list']), '')
  await fs.rm(join(repo, 'uncommitted.txt'))

  const success = release()
  assert.equal(success.status, 0, success.stderr)
  assert.match(git(['show', 'HEAD:package.json']), /"version"\s*:\s*"0\.1\.1"/)
  assert.equal(git(['cat-file', '-t', 'v0.1.1']), 'tag')
  assert.equal(git(['--git-dir', remote, 'rev-parse', 'main']), git(['rev-parse', 'HEAD']))
  assert.equal(git(['--git-dir', remote, 'rev-parse', 'v0.1.1^{}']), git(['rev-parse', 'HEAD']))

  const publishedHead = git(['rev-parse', 'HEAD'])
  git(['remote', 'set-url', 'origin', join(folder, 'missing.git')])
  const failedPush = release()
  assert.notEqual(failedPush.status, 0)
  assert.match(git(['show', 'HEAD:package.json']), /"version"\s*:\s*"0\.1\.2"/)
  assert.equal(git(['cat-file', '-t', 'v0.1.2']), 'tag')
  assert.equal(git(['--git-dir', remote, 'rev-parse', 'main']), publishedHead)
} finally {
  await fs.rm(folder, { recursive: true, force: true })
}

console.log('Patch-release branch/clean-tree guards, local tags, and push behavior OK')
