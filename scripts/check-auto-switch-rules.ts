import assert from 'node:assert/strict'
import {
  IGNORE_ACCOUNT,
  Rule,
  getRuleAction,
  validateAccount,
  validateUrlPattern,
} from '../src/services/ruleSemantics'

const switchRule: Rule = {
  id: 1,
  urlPattern: '/corp-.+?',
  account: 'work_account',
}

const ignoreRule: Rule = {
  id: 2,
  urlPattern: '/docs/.+',
  account: IGNORE_ACCOUNT,
}

const invalidRule: Rule = {
  id: 3,
  urlPattern: '[',
  account: 'broken',
}

assert.equal(validateUrlPattern('[').valid, false)
assert.equal(validateAccount(IGNORE_ACCOUNT).valid, true)
assert.equal(
  getRuleAction('https://github.com/corp-team/project', [invalidRule, switchRule]),
  'switch',
)
assert.equal(getRuleAction('https://github.com/docs/readme', [ignoreRule]), 'ignore')
assert.equal(getRuleAction('https://github.com/home', [invalidRule]), 'none')

console.log('auto-switch rule semantics OK')
