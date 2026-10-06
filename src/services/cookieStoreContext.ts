export type CookieStoreContext = {
  storeId?: string
}

export function withStoreId<T extends object>(details: T, storeId?: string) {
  if (!storeId) {
    return details
  }

  return {
    ...details,
    storeId,
  }
}

export function resolveStoreId(explicitStoreId?: string, senderStoreId?: string) {
  return explicitStoreId ?? senderStoreId
}
