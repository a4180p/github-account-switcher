export function resolveUpdate<T>(value: T | undefined, updater: (value?: T) => T | undefined) {
  const nextValue = updater(value)
  if (typeof nextValue === 'undefined') {
    return { type: 'remove' as const }
  }

  return {
    type: 'set' as const,
    value: nextValue,
  }
}
