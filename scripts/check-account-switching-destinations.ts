import assert from 'node:assert/strict'
import {
  getAddAccountLoginDestination,
  getAddAccountLoginPath,
  getManualSwitchDestination,
  getManualSwitchPath,
} from '../src/services/accountSwitchingSemantics'
import { IGNORE_ACCOUNT, Rule } from '../src/services/ruleSemantics'

const workRule: Rule = {
  id: 1,
  urlPattern: '^https://github\\.com/work/.+',
  account: 'work_account',
}

const ignoreRule: Rule = {
  id: 2,
  urlPattern: '^https://github\\.com/docs/.+',
  account: IGNORE_ACCOUNT,
}

assert.equal(
  getAddAccountLoginPath('https://github.com/personal/project', [workRule]),
  '/login?return_to=https%3A%2F%2Fgithub.com%2Fpersonal%2Fproject',
)
assert.equal(getAddAccountLoginPath('https://github.com/work/project', [workRule]), '/login')
assert.equal(
  getAddAccountLoginDestination('https://github.com/personal/project', [workRule]),
  'https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fpersonal%2Fproject',
)
assert.deepEqual(getManualSwitchDestination('https://github.com/personal/project', [workRule]), {
  kind: 'reload',
})
assert.deepEqual(getManualSwitchDestination('https://github.com/work/project', [workRule]), {
  kind: 'navigate',
  url: 'https://github.com',
})
assert.equal(getManualSwitchPath('https://github.com/personal/project', [workRule]), undefined)
assert.equal(getManualSwitchPath('https://github.com/work/project', [workRule]), '/')
assert.equal(getManualSwitchPath('https://github.com/docs/page', [ignoreRule]), undefined)

console.log('account switching destination semantics OK')
