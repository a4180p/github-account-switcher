import { listAccountNames } from '../services/githubSession'
import ruleService, { type Rule } from '../services/rule'
import { reorderRules } from '../services/ruleOrder'

type EditorState = {
  rules: Rule[]
  accounts: string[]
  isAdding: boolean
  isPending: boolean
  draggedRuleId?: number
  error?: string
}

let state: EditorState = { rules: [], accounts: [], isAdding: false, isPending: false }
const listeners = new Set<() => void>()

function setState(change: Partial<EditorState>) {
  state = { ...state, ...change }
  listeners.forEach((listener) => listener())
}

async function run(operation: () => Promise<Partial<EditorState>>) {
  if (state.isPending) {
    return false
  }

  setState({ isPending: true, error: undefined })
  try {
    setState(await operation())
    return true
  } catch (error) {
    setState({ error: error instanceof Error ? error.message : String(error) })
    return false
  } finally {
    setState({ isPending: false })
  }
}

function load() {
  return run(async () => {
    const [rules, accounts] = await Promise.all([ruleService.getAll(), listAccountNames()])
    return { rules, accounts, isAdding: false, draggedRuleId: undefined }
  })
}

function addRule(rule: Rule) {
  return run(async () => {
    await ruleService.add(rule)
    return { rules: await ruleService.getAll(), isAdding: false }
  })
}

function updateRule(rule: Rule) {
  return run(async () => {
    await ruleService.update(rule)
    return { rules: await ruleService.getAll() }
  })
}

function removeRule(rule: Rule) {
  return run(async () => {
    await ruleService.remove(rule.id)
    return { rules: await ruleService.getAll() }
  })
}

function moveRule(targetId: number) {
  const sourceId = state.draggedRuleId
  setState({ draggedRuleId: undefined })
  if (sourceId === undefined) {
    return Promise.resolve(false)
  }

  return run(async () => {
    const rules = reorderRules(state.rules, sourceId, targetId)
    if (rules !== state.rules) {
      await ruleService.replaceAll(rules)
    }
    return { rules }
  })
}

export default {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  load,
  addRule,
  updateRule,
  removeRule,
  moveRule,
  startAdding() {
    if (!state.isPending) setState({ isAdding: true })
  },
  stopAdding() {
    setState({ isAdding: false })
  },
  startDrag(id: number) {
    if (!state.isPending && !state.isAdding) setState({ draggedRuleId: id })
  },
  endDrag() {
    setState({ draggedRuleId: undefined })
  },
}
