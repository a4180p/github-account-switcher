import assert from 'node:assert/strict'
import type { Rule } from '../src/services/ruleSemantics'

const first: Rule = { id: 0, urlPattern: '/sample/.+', account: 'sample_account' }
const second: Rule = { id: 1, urlPattern: '/docs/.+', account: 'ignore' }
const data: Record<string, unknown> = {
  rules: [first, second],
  accounts: { sample_account: [] },
}
let rejectWrites = false
const browserMock = {
  runtime: { id: 'rule-editor-check' },
  storage: {
    local: {
      get: async (key: string) => structuredClone({ [key]: data[key] }),
      set: async (values: Record<string, unknown>) => {
        if (rejectWrites) throw new Error('Storage write failed')
        Object.assign(data, structuredClone(values))
      },
    },
  },
}
Object.assign(globalThis, { chrome: browserMock, browser: browserMock })
const { default: editor } = await import('../src/popup/ruleEditor')

let notifications = 0
const unsubscribe = editor.subscribe(() => {
  notifications += 1
})
assert.equal(await editor.load(), true)
assert.deepEqual(editor.getSnapshot().rules, [first, second])
assert.deepEqual(editor.getSnapshot().accounts, ['sample_account'])
assert.equal(editor.getSnapshot().isPending, false)
assert.strictEqual(editor.getSnapshot(), editor.getSnapshot())
assert.ok(notifications > 0)

editor.startAdding()
assert.equal(editor.getSnapshot().isAdding, true)
const added: Rule = { id: 2, urlPattern: '/new/.+', account: 'sample_account' }
assert.equal(await editor.addRule(added), true)
assert.equal(editor.getSnapshot().isAdding, false)
assert.deepEqual(data.rules, [first, second, added])

const changed = { ...added, urlPattern: '/changed/.+' }
const saving = editor.updateRule(changed)
assert.equal(editor.getSnapshot().isPending, true)
assert.equal(await editor.addRule({ ...added, id: 3 }), false)
assert.equal(await saving, true)
assert.deepEqual(data.rules, [first, second, changed])

editor.startDrag(first.id)
assert.equal(editor.getSnapshot().draggedRuleId, first.id)
assert.equal(await editor.moveRule(changed.id), true)
assert.deepEqual(editor.getSnapshot().rules, [second, changed, first])
assert.deepEqual(data.rules, [second, changed, first])
assert.equal(editor.getSnapshot().draggedRuleId, undefined)
assert.equal(await editor.load(), true)
assert.deepEqual(editor.getSnapshot().rules, [second, changed, first])

editor.startDrag(first.id)
editor.endDrag()
assert.equal(await editor.moveRule(second.id), false)
assert.deepEqual(data.rules, [second, changed, first])

rejectWrites = true
editor.startDrag(first.id)
assert.equal(await editor.moveRule(second.id), false)
assert.equal(editor.getSnapshot().error, 'Storage write failed')
assert.deepEqual(editor.getSnapshot().rules, [second, changed, first])
assert.deepEqual(data.rules, [second, changed, first])
editor.startAdding()
assert.equal(await editor.addRule({ ...added, id: 3 }), false)
assert.equal(editor.getSnapshot().isAdding, true)
assert.equal(editor.getSnapshot().isPending, false)
editor.stopAdding()

rejectWrites = false
assert.equal(await editor.updateRule({ ...first, urlPattern: '[' }), false)
assert.equal(editor.getSnapshot().error, 'Invalid regular expression')
assert.deepEqual(data.rules, [second, changed, first])
assert.equal(await editor.removeRule(changed), true)
assert.equal(editor.getSnapshot().error, undefined)
assert.deepEqual(editor.getSnapshot().rules, [second, first])
assert.deepEqual(data.rules, [second, first])

unsubscribe()
const previousNotifications = notifications
editor.startAdding()
assert.equal(notifications, previousNotifications)
editor.stopAdding()

console.log('Rule editor loading, editing, ordering, and failed saves OK')
