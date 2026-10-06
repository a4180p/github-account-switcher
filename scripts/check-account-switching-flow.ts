import assert from 'node:assert/strict'
import { completeManualSwitch, startAddAccountLogin } from '../src/services/accountSwitching'
import type { Rule } from '../src/services/ruleSemantics'

const workRule: Rule = {
  id: 1,
  urlPattern: '^https://github\\.com/work/.+',
  account: 'work_account',
}

const personalRuleSet = [workRule]
const workRuleSet = [workRule]

const calls: string[] = []

await startAddAccountLogin({
  currentUrl: 'https://github.com/personal/project',
  loadRules: async () => {
    calls.push('load-login-rules')
    return personalRuleSet
  },
  clearCookies: async () => {
    calls.push('clear-cookies')
  },
  navigate: async (url) => {
    calls.push(`login:${url}`)
  },
})

await completeManualSwitch({
  accountName: 'work_account',
  currentUrl: 'https://github.com/work/project',
  loadRules: async () => {
    calls.push('load-switch-rules')
    return workRuleSet
  },
  switchAccount: async (accountName) => {
    calls.push(`switch:${accountName}`)
  },
  reload: async () => {
    calls.push('reload')
  },
  navigate: async (url) => {
    calls.push(`switch-navigate:${url}`)
  },
})

assert.deepEqual(calls, [
  'clear-cookies',
  'load-login-rules',
  'login:https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fpersonal%2Fproject',
  'switch:work_account',
  'load-switch-rules',
  'switch-navigate:https://github.com',
])

console.log('account switching flow OK')
