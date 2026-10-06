import assert from 'node:assert/strict'
import {
  ACCOUNT_PARAM,
  IGNORE_ACCOUNT,
  Rule,
  assertValidRule,
  findRuleForRequest,
  getRuleAction,
  validateAccount,
  validateRule,
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

const complexRule: Rule = {
  id: 4,
  urlPattern: '(a+)+$',
  account: 'work_account',
}

const negativeLookaheadRule: Rule = {
  id: 5,
  urlPattern:
    '^https://github\\.com/(?!company-(?:archive|build|billing|docs|internal|ops|platform|security)(?:/|$)).*',
  account: 'work_account',
}

assert.equal(validateUrlPattern('[').valid, false)
assert.equal(validateAccount(IGNORE_ACCOUNT).valid, true)
assert.equal(validateRule(switchRule).valid, true)
assert.equal(validateRule(invalidRule).urlPatternMessage, 'Invalid regular expression')
assert.equal(validateRule(complexRule).urlPatternMessage, 'Regular expression is too complex')
assert.equal(
  validateRule(negativeLookaheadRule).urlPatternMessage,
  'Lookarounds are not supported in Auto Switching Rules',
)
assert.throws(() => assertValidRule(invalidRule), /Invalid regular expression/)
assert.throws(() => assertValidRule(complexRule), /Regular expression is too complex/)
assert.throws(
  () => assertValidRule(negativeLookaheadRule),
  /Lookarounds are not supported in Auto Switching Rules/,
)
assert.equal(
  getRuleAction('https://github.com/corp-team/project', [invalidRule, switchRule]),
  'switch',
)
assert.equal(getRuleAction('https://github.com/docs/readme', [ignoreRule]), 'ignore')
assert.equal(getRuleAction('https://github.com/home', [invalidRule]), 'none')
assert.equal(
  findRuleForRequest(`https://github.com/home?${ACCOUNT_PARAM}=work_account`, [switchRule])
    ?.account,
  'work_account',
)
assert.equal(getRuleAction('https://github.com/open-source/project', [negativeLookaheadRule]), 'none')
assert.equal(getRuleAction('https://github.com/company-billing', [negativeLookaheadRule]), 'none')

console.log('auto-switch rule semantics OK')
