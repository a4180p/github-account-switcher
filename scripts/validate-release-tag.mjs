import assert from 'node:assert/strict'
import packageJson from '../package.json' with { type: 'json' }

const expectedTag = `v${packageJson.version}`
assert.equal(process.env.GITHUB_REF_NAME, expectedTag, `Release tag must be ${expectedTag}`)
console.log(`Release tag matches package version ${packageJson.version}`)
