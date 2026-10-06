import assert from 'node:assert/strict'
import { reorderRules } from '../src/services/ruleOrder'
import type { Rule } from '../src/services/ruleSemantics'

const rules: Rule[] = [
  { id: 1, urlPattern: '/one', account: 'a' },
  { id: 2, urlPattern: '/two', account: 'b' },
  { id: 3, urlPattern: '/three', account: 'c' },
]

assert.deepEqual(
  reorderRules(rules, 3, 1).map((rule) => rule.id),
  [3, 1, 2],
)
assert.deepEqual(
  reorderRules(rules, 1, 1).map((rule) => rule.id),
  [1, 2, 3],
)
assert.deepEqual(
  reorderRules(rules, 9, 1).map((rule) => rule.id),
  [1, 2, 3],
)

console.log('rule order OK')
