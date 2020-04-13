import { compact } from 'lodash'

export const pathCache = new WeakMap()
const intProxyCache = new WeakMap()

const observable = (obj = {}, path, proxyCache, callbacks = {}) => {
  if (!proxyCache) {
    proxyCache = intProxyCache
  }

  // Of obj is already a proxy, return it.
  if (obj.isProxy) return obj

  // If obj is already cached as a proxy, return it.
  if (proxyCache.has(obj)) return proxyCache.get(obj)

  // ...otherwise create a new proxy.
  const proxy = new Proxy(obj, createHandler(proxyCache, callbacks))

  // Build the path
  pathCache.set(obj, path)

  // Cache the proxy
  proxyCache.set(obj, proxy)

  return proxy
}

const createHandler = (proxyCache, { onGet, onSet }) => {
  return {
    get(target, key, receiver) {
      if (key === 'isProxy') return true

      const result = Reflect.get(target, key, receiver)

      // Ignore well known symbols. These symbols are frequently retrieved in low level JavaScript
      // under the hood.
      // console.log(wellKnownSymbols)
      if (!target.hasOwnProperty(key) || (typeof key === 'symbol' && wellKnownSymbols.has(key))) {
        return result
      }

      // Build the path to the key.
      const path = compact([pathCache.get(target), key]).join('.')

      onGet && onGet({ target, key, path, receiver })

      // If result is an object, then it's nested and needs to be proxied - Proxy ignores nested
      // properties.
      if (typeof result === 'object') return observable(result, path, proxyCache)

      return result
    },

    set(target, key, value, receiver) {
      // Build the path to the key.
      const path = compact([pathCache.get(target), key]).join('.')

      onSet && onSet({ target, key, value, path, receiver })

      return Reflect.set(target, key, value, receiver)
    }
  }
}

const wellKnownSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(value => typeof value === 'symbol')
)

export default observable
