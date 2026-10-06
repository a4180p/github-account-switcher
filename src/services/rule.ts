import storage from './storage'

export {
  ACCOUNT_PARAM,
  IGNORE_ACCOUNT,
  assertValidRule,
  findMatchingRule,
  findRuleForRequest,
  getRequestRulePattern,
  getRuleAction,
  isGitHubUrl,
  isIgnoreRule,
  isNormalGitHubUrl,
  type Rule,
  validateAccount,
  validateRule,
  validateUrlPattern,
} from './ruleSemantics'

import { assertValidRule, type Rule } from './ruleSemantics'

async function getAll(): Promise<Rule[]> {
  const rules = await storage.get<Rule[]>('rules')
  return rules || []
}

async function add(rule: Rule) {
  assertValidRule(rule)
  await storage.update<Rule[]>('rules', (rules = []) => {
    return [...rules, rule]
  })
}

async function update(rule: Rule) {
  assertValidRule(rule)
  await storage.update<Rule[]>('rules', (rules = []) => {
    return rules.map((r) => (r.id === rule.id ? rule : r))
  })
}

async function remove(id: number) {
  await storage.update<Rule[]>('rules', (rules = []) => {
    return rules.filter((rule) => rule.id !== id)
  })
}

export default {
  getAll,
  add,
  update,
  remove,
}
