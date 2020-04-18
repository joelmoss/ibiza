import { compact } from 'lodash'

export const TARGET = Symbol('target')
const PROXY_TARGET = Symbol('ProxyTarget')

export const subscribers = new Set()
export const pathCache = new WeakMap()
const intProxyCache = new WeakMap()
const propCache = new WeakMap()

const observable = (obj = {}, path, proxyCache, callbacks = {}) => {
  if (proxyCache === null) {
    proxyCache = intProxyCache
  }

  // Of obj is already a proxy, return it.
  if (obj === null || obj.isProxy) return obj

  // If obj is already cached as a proxy, return it.
  if (proxyCache && proxyCache.has(obj)) return proxyCache.get(obj)

  // ...otherwise create a new proxy.
  const proxy = new Proxy(obj, createHandler(proxyCache, callbacks))

  // Build the path
  pathCache.set(obj, path)

  // Cache the proxy
  proxyCache && proxyCache.set(obj, proxy)

  return proxy
}

const createHandler = (proxyCache, { onGet, onSet, onApply }) => {
  return {
    get: (target, key, receiver) => {
      if (key === TARGET) return target
      if (key === 'isProxy') return true

      const result = Reflect.get(target, key, receiver)

      // console.log(key, key in target, typeof result)

      // Ignore well known symbols. These symbols are frequently retrieved in low level
      // JavaScript under the hood. Also, ignore any non-own properties.
      if (
        (key in target && !target.hasOwnProperty(key)) ||
        (typeof key === 'symbol' && wellKnownSymbols.has(key))
      ) {
        return result
      }

      const path = compact([pathCache.get(target), key]).join('.')

      // console.log('pre:onGet', { key, target, path })

      // Preserve invariants
      const descriptor = getOwnPropertyDescriptor(target, key)
      if (descriptor && !descriptor.configurable) {
        if (descriptor.set && !descriptor.get) return undefined
        if (descriptor.writable === false) return result
      }

      // Functions should be observable so we can allow them to change state.
      if (typeof result === 'function') return observable(result, path, proxyCache, { onApply })

      onGet && onGet({ target, key, path, receiver })

      // If result is an object, then it's nested and needs to be proxied - Proxy ignores nested
      // properties.
      if (typeof result === 'object') {
        return observable(result, path, proxyCache, {
          onGet,
          onSet,
          onApply
        })
      }

      return result
    },

    defineProperty: (target, key, descriptor) => {
      let result = true
      // console.log('onDefineProperty', { key, target, descriptor })

      if (!isSameDescriptor(descriptor, getOwnPropertyDescriptor(target, key))) {
        result = Reflect.defineProperty(target, key, descriptor)

        if (result && !isSameDescriptor()) {
          invalidateCachedDescriptor(target, key)

          const path = compact([pathCache.get(target), key]).join('.')

          onSet({ target, key, value: descriptor.value, path })
        }
      }

      return result
    },

    // ownKeys: target => {
    //   console.log('ownKeys', { target })
    //   return Reflect.ownKeys(target)
    // },

    // has: (target, key) => {
    //   console.log('has', { target, key })
    //   return Reflect.has(target, key)
    // },

    set: (target, key, value, receiver) => {
      const previous = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value)

      // Ignore the 'length' prop.
      if (key === 'length') return result

      const isChanged = !(key in target) || !Object.is(previous, value)
      const path = compact([pathCache.get(target), key]).join('.')

      // console.log('pre:onSet', { key, target, previous, value, receiver, path, isChanged })

      isChanged &&
        result &&
        subscribers.forEach(subscriber => subscriber({ target, key, previous, value, path }))

      return result
    },

    apply: onApply
      ? (target, thisArg, argumentsList) => {
          // console.log('pre:onApply', { target })

          return onApply({
            target,
            argumentsList,
            path: compact([pathCache.get(target)]).join('.')
          })
        }
      : undefined
  }
}

const getOwnPropertyDescriptor = (target, property) => {
  let props = propCache !== null && propCache.get(target)

  if (props) {
    props = props.get(property)
  }

  if (props) {
    return props
  }

  props = new Map()
  propCache.set(target, props)

  let prop = props.get(property)

  if (!prop) {
    prop = Reflect.getOwnPropertyDescriptor(target, property)
    props.set(property, prop)
  }

  return prop
}

const invalidateCachedDescriptor = (target, property) => {
  const props = propCache ? propCache.get(target) : undefined

  if (props) {
    props.delete(property)
  }
}

const isSameDescriptor = (a, b) => {
  return (
    a !== undefined &&
    b !== undefined &&
    Object.is(a.value, b.value) &&
    (a.writable || false) === (b.writable || false) &&
    (a.enumerable || false) === (b.enumerable || false) &&
    (a.configurable || false) === (b.configurable || false)
  )
}

const wellKnownSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(value => typeof value === 'symbol')
)

export default observable
