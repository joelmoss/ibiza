const OWN_KEYS_SYMBOL = Symbol('OWN_KEYS')
const TRACK_MEMO_SYMBOL = Symbol('TRACK_MEMO')
const GET_ORIGINAL_SYMBOL = Symbol('GET_ORIGINAL')

// check if obj is a plain object or an array
const isPlainObject = obj => {
  try {
    const proto = Object.getPrototypeOf(obj)
    return proto === Object.prototype || proto === Array.prototype
  } catch (e) {
    return false
  }
}

// copy obj if frozen
const unfreeze = obj => {
  if (!Object.isFrozen(obj)) return obj
  if (Array.isArray(obj)) return Array.from(obj)

  return Object.assign({}, obj)
}

const createProxyHandler = () => ({
  recordUsage(key) {
    if (this.trackObj) return

    let used = this.accessed.get(this.originalObj)
    if (!used) {
      used = new Set()
      this.accessed.set(this.originalObj, used)
    }

    used.add(key)
  },

  recordObjectAsUsed() {
    this.trackObj = true
    this.accessed.delete(this.originalObj)
  },

  get(target, key) {
    if (key === GET_ORIGINAL_SYMBOL) return this.originalObj

    this.recordUsage(key)

    return createProxy(target[key], this.accessed, this.proxyCache)
  },

  has(target, key) {
    if (key === TRACK_MEMO_SYMBOL) {
      this.recordObjectAsUsed()
      return true
    }

    // LIMITATION:
    // We simply record the same as get. This means { a: {} } and { a: {} } is detected as changed,
    // if 'a' in obj is handled.
    this.recordUsage(key)

    return key in target
  },

  ownKeys(target) {
    this.recordUsage(OWN_KEYS_SYMBOL)

    return Reflect.ownKeys(target)
  }
})

export const createProxy = (obj, accessed, proxyCache) => {
  if (!isPlainObject(obj)) return obj

  const origObj = obj[GET_ORIGINAL_SYMBOL] // unwrap proxy
  if (origObj) obj = origObj

  let proxyHandler = proxyCache && proxyCache.get(obj)
  if (!proxyHandler) {
    proxyHandler = createProxyHandler()
    proxyHandler.proxy = new Proxy(unfreeze(obj), proxyHandler)
    proxyHandler.originalObj = obj
    proxyHandler.trackObj = false // for trackMemo

    proxyCache && proxyCache.set(obj, proxyHandler)
  }

  proxyHandler.accessed = accessed
  proxyHandler.proxyCache = proxyCache

  return proxyHandler.proxy
}

const isOwnKeysChanged = (origObj, nextObj) => {
  const origKeys = Reflect.ownKeys(origObj)
  const nextKeys = Reflect.ownKeys(nextObj)

  return origKeys.length !== nextKeys.length || origKeys.some((k, i) => k !== nextKeys[i])
}

export const hasStateChanged = (origObj, nextObj, accessed, cache, assumeChangedIfNotAccessed) => {
  if (origObj === nextObj) return false
  if (typeof origObj !== 'object' || origObj === null) return true
  if (typeof nextObj !== 'object' || nextObj === null) return true

  const used = accessed.get(origObj)

  if (!used) return !!assumeChangedIfNotAccessed

  if (cache) {
    const hit = cache.get(origObj)
    if (hit && hit.nextObj === nextObj) return hit.changed

    // for object with cycles (changed is `undefined`)
    cache.set(origObj, { nextObj })
  }

  let changed = null
  for (const key of used) {
    const c =
      key === OWN_KEYS_SYMBOL
        ? isOwnKeysChanged(origObj, nextObj)
        : hasStateChanged(
            origObj[key],
            nextObj[key],
            accessed,
            cache,
            assumeChangedIfNotAccessed !== false
          )

    if (typeof c === 'boolean') changed = c
    if (changed) break
  }

  if (changed === null) changed = !!assumeChangedIfNotAccessed
  cache && cache.set(origObj, { nextObj, changed })

  return changed
}

// explicitly track object with memo
export const trackMemo = obj => (isPlainObject(obj) ? TRACK_MEMO_SYMBOL in obj : false)

// get original object from proxy
export const getUntrackedObject = obj => {
  return isPlainObject(obj) ? obj[GET_ORIGINAL_SYMBOL] || null : null
}
