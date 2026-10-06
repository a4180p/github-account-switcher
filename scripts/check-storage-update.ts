import assert from 'node:assert/strict'
import { resolveUpdate } from '../src/services/storageSemantics'

assert.deepEqual(
  resolveUpdate<{ name: string } | undefined>(undefined, () => ({ name: 'kept' })),
  { type: 'set', value: { name: 'kept' } },
)

assert.deepEqual(
  resolveUpdate<{ name: string }>({ name: 'kept' }, () => undefined),
  { type: 'remove' },
)

assert.deepEqual(
  resolveUpdate<{ count: number }>({ count: 1 }, (value) => ({ count: (value?.count ?? 0) + 1 })),
  { type: 'set', value: { count: 2 } },
)

console.log('storage update semantics OK')
