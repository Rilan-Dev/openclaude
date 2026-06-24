/**
 * Returns a memoized factory function that constructs the value on first call.
 * Used to defer Zod schema construction from module init time to first access.
 */
export function lazySchema<T>(factory: () => T): () => T {
  let schema: T | undefined

  return () => {
    schema ??= factory()
    return schema
  }
}
