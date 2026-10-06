import assert from 'node:assert/strict'
import { resolveStoreId, withStoreId } from '../src/services/cookieStoreContext'

assert.deepEqual(withStoreId({ url: 'https://github.com', name: 'dotcom_user' }), {
  url: 'https://github.com',
  name: 'dotcom_user',
})

assert.deepEqual(
  withStoreId({ url: 'https://github.com', name: 'dotcom_user' }, 'firefox-container-1'),
  {
    url: 'https://github.com',
    name: 'dotcom_user',
    storeId: 'firefox-container-1',
  },
)

assert.equal(resolveStoreId(undefined, 'firefox-container-1'), 'firefox-container-1')
assert.equal(resolveStoreId('firefox-container-2', 'firefox-container-1'), 'firefox-container-2')
assert.equal(resolveStoreId(undefined, undefined), undefined)

console.log('cookie store context OK')
