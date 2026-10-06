import type { Rule } from './ruleSemantics'

export function reorderRules(rules: Rule[], sourceId: number, targetId: number) {
  if (sourceId === targetId) {
    return rules
  }

  const sourceIndex = rules.findIndex((rule) => rule.id === sourceId)
  const targetIndex = rules.findIndex((rule) => rule.id === targetId)
  if (sourceIndex === -1 || targetIndex === -1) {
    return rules
  }

  const nextRules = [...rules]
  const [sourceRule] = nextRules.splice(sourceIndex, 1)
  nextRules.splice(targetIndex, 0, sourceRule)
  return nextRules
}
