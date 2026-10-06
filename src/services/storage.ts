import browser from 'webextension-polyfill'

export { resolveUpdate } from './storageSemantics'

import { resolveUpdate } from './storageSemantics'

async function set<T>(key: string, value: T) {
  await browser.storage.local.set({ [key]: value })
}

async function remove(key: string) {
  await browser.storage.local.remove(key)
}

async function get<T>(key: string): Promise<T | undefined> {
  const { [key]: value } = await browser.storage.local.get(key)
  return value as T
}

async function update<T>(key: string, updater: (value?: T) => T | undefined) {
  const value = await get<T>(key)
  const nextValue = resolveUpdate(value, updater)

  if (nextValue.type === 'remove') {
    await remove(key)
    return
  }

  await set(key, nextValue.value)
}

async function clear() {
  await browser.storage.local.clear()
}

export default {
  get,
  set,
  update,
  clear,
}
