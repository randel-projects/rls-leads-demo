// Node 20 compatibility shim, loaded by BOTH vitest config files so it runs
// in the main (reporter) process. Vitest 5.1's error formatter uses
// Map.groupBy, which needs Node 21+ — without this, a FAILING test crashes
// the reporter instead of printing why. No-op on Node >= 21 / CI Node 22.
if (typeof (Map as unknown as Record<string, unknown>).groupBy !== 'function') {
  ;(Map as unknown as Record<symbol | string, unknown>).groupBy = function (
    this: MapConstructor,
    items: Iterable<unknown>,
    key: (item: unknown, index: number) => unknown
  ) {
    const out = new Map()
    let i = 0
    for (const item of items) {
      const k = key(item, i++)
      const bucket = (out.get(k) as unknown[] | undefined) ?? []
      bucket.push(item)
      out.set(k, bucket)
    }
    return out
  }
}
