/* global process */

import { get, isPlainObject, isDate } from './utils.js'

export const isProxy = Symbol('ibizaIsProxy')
export const isStoreProxy = Symbol('ibizaIsStoreProxy')
export const isHookProxy = Symbol('ibizaIsHookProxy')
export const propertyPath = Symbol('ibizaPropertyPath')
export const accessorDef = Symbol('ibizaAccessorDefinition')
export const isQuery = Symbol('ibizaIsQuery')
export const isTrackedFn = Symbol('ibizaIsTrackedFn')
export const queryFn = Symbol('ibizaQueryFunction')

const protectedProps = ['$root', '$model']

class IbizaStore {
  debug = process.env.NODE_ENV === 'development'

  fetches = {}
  promises = {}
  modelInitializers = {}
  modelOptions = {}

  #setListeners = new Set()
  #accessors = new Map()
  #state = {}
  #proxyCache = new WeakMap()
  #mergedObjects = new WeakMap()
  #customFetchFn

  constructor() {
    this.reset()
  }

  // CAUTION! Will wipe out the complete store state. Primarily used for testing.
  set state(value) {
    this.#proxyCache = new WeakMap()
    this.#state = value
  }

  get state() {
    return this.#proxyOf(this.#state)
  }

  // Returns the unproxied state.
  get unproxiedState() {
    return this.#state
  }

  // Recursively merge the given `obj` into the store, ensuring that each level of the object is
  // proxified.
  merge(obj) {
    if (!isPlainObject(obj)) {
      throw new TypeError('IbizaStore#merge expects a plain object to merge')
    }

    // Don't merge if `obj` has already been merged.
    if (!this.#mergedObjects.has(obj)) {
      this.#mergedObjects.set(obj, true)
      merge(this.state, obj)
    }
  }

  listenForChanges(setFn) {
    this.#setListeners.add(setFn)
    return () => this.unlistenForChanges(setFn)
  }

  unlistenForChanges(setFn) {
    this.#setListeners.delete(setFn)
  }

  publishChange() {
    for (let listener of this.#setListeners) listener(...arguments)
  }

  reset() {
    this.#state = {}
    this.#mergedObjects = new WeakMap()
    this.#proxyCache = new WeakMap()
    this.#customFetchFn = undefined
    this.#setListeners = new Set()
    this.#accessors = new Map()
    this.fetches = {}
    this.promises = {}
    this.modelInitializers = {}
    this.modelOptions = {}
    this.debug = process.env.NODE_ENV === 'development'
  }

  get fetchFn() {
    return this.#customFetchFn || this.#defaultFetchFn
  }

  set fetchFn(fn) {
    this.#customFetchFn = fn
  }

  #defaultFetchFn = (resource, opts) => {
    class HTTPError extends Error {}
    const url = new URL(resource, location.origin)

    return fetch(new Request(url), opts).then(response => {
      if (!response.ok) {
        throw new HTTPError(response.statusText)
      }

      return response.status === 204 ? null : response.json()
    })
  }

  fetch(resource, opts = {}) {
    const { suspense, ...options } = opts

    const thenCallback = response => {
      this.debug && console.debug('[Ibiza] Fetched %o', resource)

      this.fetches[resource].status = 'success'

      if (response === null) return response

      return (this.fetches[resource].response =
        resource in this.modelInitializers ? this.modelInitializers[resource](response) : response)
    }

    const fetchFn = (this.modelOptions[resource]?.fetcher || this.fetchFn).bind(this.state)

    // Regular fetch.
    if (!suspense) {
      this.debug && console.debug('[Ibiza] Fetching %o...', resource)

      return fetchFn(resource, options).then(thenCallback)
    }

    // Suspenseful fetch.
    if (!this.fetches[resource]) {
      this.debug && console.debug('[Ibiza] Fetching %o (suspense)...', resource)

      this.fetches[resource] = {
        status: 'start',
        fetch: fetchFn(resource, options)
          .then(thenCallback)
          .catch(error => {
            this.fetches[resource].status = 'error'
            this.fetches[resource].error = error
          })
      }
    } else {
      if (this.fetches[resource].error) {
        delete this.fetches[resource].fetch
        throw this.fetches[resource].error
      } else if (this.fetches[resource].response) {
        delete this.fetches[resource].fetch
        return this.fetches[resource].response
      }
    }

    throw this.fetches[resource].fetch
  }

  // Returns true if a fetch with the given key does not exist, or if the fetch exists at the given
  // key.
  #shouldFetch(key) {
    return !Object.prototype.hasOwnProperty.call(this.fetches, key) || this.fetches[key].fetch
  }

  #throwOnFetchError(key) {
    if (Object.prototype.hasOwnProperty.call(this.fetches, key) && this.fetches[key].error) {
      throw this.fetches[key].error
    }
  }

  #proxyOf(target, parentPath = null) {
    if (target[isHookProxy]) return target
    if (this.#proxyCache.has(target)) return this.#proxyCache.get(target)

    function buildPath(prop) {
      if (!prop) return parentPath
      if (prop.indexOf('/') === 0) return prop

      return parentPath ? [parentPath, prop].join('.') : prop
    }

    const $this = this

    const proxy = new Proxy(target, {
      get(target, prop, receiver) {
        let path

        // Private
        if (prop === isProxy || prop === isStoreProxy) return true
        if (prop === isHookProxy) return false
        if (prop === propertyPath) return parentPath

        // Public
        if (prop === '$unproxiedState') {
          return parentPath ? get($this.unproxiedState, parentPath) : $this.unproxiedState
        }

        // If prop === '$root', return entire store state. If parentPath is null, return undefined.
        if (prop === '$root') return parentPath === null ? undefined : $this.state

        // If prop === '$model', return the current model (top level ancestor).
        // Return the current model (top level ancestor).
        if (prop === '$model') return get(store.state, parentPath?.split('.')[0])

        // Return $save function if we are in a URL model.
        if (prop === '$save') {
          path = buildPath(prop)

          if (path.indexOf('/') === 0) {
            return async (url = {}, options = {}) => {
              if (typeof url !== 'string') {
                options = url
                ;[url] = path.split('.')
              }
              const response = await $this.fetch(url, { method: 'patch', ...options })
              if (response !== null) {
                $this.state[url] = response
              }

              return response
            }
          }
        }

        if (prop === '$refetch') {
          const path = buildPath(prop)

          if (path.indexOf('/') === 0) {
            return async () => {
              const [url] = path.split('.')
              const response = await $this.fetch(url)

              if (response !== null) {
                $this.state[url] = response
              }

              return response
            }
          }
        }

        let result = Reflect.get(target, prop, receiver)

        // Forward any functions and non-own properties while allowing undefined properties, except
        // the `length` prop which needs to be tracked so we can respond to array changes.
        if (
          prop !== 'length' &&
          !Object.prototype.hasOwnProperty.call(target, prop) &&
          (Object.getPrototypeOf(target)[prop] || typeof prop === 'symbol')
        ) {
          return result
        }

        if (
          Object.isFrozen(target) ||
          (result !== null && typeof result === 'object' && Object.isFrozen(result))
        ) {
          return result
        }

        if (typeof path === 'undefined') {
          path = buildPath(prop)
        }

        // Result is an accessor, so make sure its definition is cached in #accessors.
        if (result?.[accessorDef] && !$this.#accessors.has(path)) {
          $this.#accessors.set(path, result[accessorDef])
        }

        // Prop is an accessor, so call the accessor's onGet callback - if defined.
        if ($this.#accessors.has(path)) {
          const def = $this.#accessors.get(path)
          return def.onGet ? def.onGet.call(receiver, def.value) : def.value
        }

        if (result?.[isQuery]) {
          const qfn = result[queryFn]
          const url = qfn.call(receiver)

          if (url) {
            $this.#throwOnFetchError(url)

            if ($this.#shouldFetch(url)) {
              const fetchResult = $this.fetch(url, { suspense: true })

              Object.defineProperty(fetchResult, isQuery, { value: true })
              Object.defineProperty(fetchResult, queryFn, { value: qfn })

              // $this.state[prop] = fetchResult
              // this.set(target, prop, fetchResult, receiver)
              result = fetchResult
            } else if (Object.prototype.hasOwnProperty.call($this.fetches, url)) {
              result = $this.fetches[url].response
            }
          }
        } else if (prop.indexOf('/') === 0) {
          $this.#throwOnFetchError(prop)

          if ($this.#shouldFetch(prop)) {
            result = $this.fetch(prop, { suspense: true })

            // TODO: This fails if we don't set it, but the condition above and below do not require
            // the set, and simply return the fetch result. Why?
            this.set(target, prop, result, receiver)
          }
        } else if (path.indexOf('/') === 0) {
          const [url, ...rest] = path.split('.')
          const urlPath = rest.join('.')

          $this.#throwOnFetchError(url)

          if ($this.#shouldFetch(url)) {
            const urlResult = $this.fetch(url, { suspense: true })
            // $this.state[url] = urlResult
            result = get(urlResult, urlPath)
          }
        }

        if (result?.then !== undefined) {
          if (!(path in $this.promises)) {
            $this.debug && console.debug('[Ibiza] Promise %o', result)

            $this.promises[path] = result
              .then(response => {
                $this.promises[path].response = response
              })
              .catch(error => {
                $this.promises[path].error = error
              })
          }

          const promise = $this.promises[path]

          if (Object.prototype.hasOwnProperty.call(promise, 'error')) {
            throw promise.error
          }

          if (Object.prototype.hasOwnProperty.call(promise, 'response')) {
            return promise.response
          }

          throw promise
        }

        // If result is an Object, not null and not a Date, it must be a nested object, so proxify
        // and return.
        if (result !== null && typeof result === 'object' && !isDate(result)) {
          return $this.#proxyOf(result, path)
        }

        return result
      },

      set(target, prop, value, receiver) {
        if (target[isProxy]) {
          console.warn('[ibiza] Attempting to set a property (%s) on proxied object', prop, target)
        }

        if (Object.isFrozen(target)) {
          throw new TypeError(`Cannot mutate '${prop}'. Object is frozen!`)
        }

        if (protectedProps.includes(prop)) {
          throw new Error(`Cannot assign to ${prop}`)
        }

        const path = buildPath(prop)
        let hasAccessor = $this.#accessors.has(path)
        let previousValue
        let def

        if (!hasAccessor) {
          previousValue = Reflect.get(target, prop, receiver)

          // The prop could still be an accessor if it has not yet been "get". So make sure it is
          // defined here.
          if (previousValue?.[accessorDef]) {
            $this.#accessors.set(path, previousValue[accessorDef])
            hasAccessor = true
          } else {
            Reflect.set(target, prop, value, receiver)
          }
        }

        // Handles any accessor.onSet callback.
        if (hasAccessor) {
          def = $this.#accessors.get(path)

          previousValue = def.value
          let manuallySet = false

          if (def.onSet) {
            def.onSet.call(receiver, def.value, value, v => {
              def.value = v
              manuallySet = true
            })
          }

          if (manuallySet) {
            manuallySet = false
          } else {
            def.value = value
          }

          value = def.value
        }

        previousValue = unproxiedStateOf(previousValue)
        if (prop === 'length' || !Object.is(previousValue, value)) {
          if (store.debug) {
            console.groupCollapsed('[ibiza] Mutated %o', path)
            console.info({ previousValue, value })
            console.groupEnd()
          }

          $this.publishChange({ target, prop, path, previousValue, value })
        }

        hasAccessor && def.afterSet && def.afterSet.call(receiver, previousValue, value)

        return true
      },

      deleteProperty(target, prop) {
        const previousValue = Reflect.get(target, prop)
        const result = Reflect.deleteProperty(target, prop)

        if (result) {
          $this.publishChange({
            target,
            prop,
            path: buildPath(prop),
            previousValue: unproxiedStateOf(previousValue)
          })
        }

        return result
      }
    })

    // Add the proxy to the cache.
    this.#proxyCache.set(target, proxy)

    return proxy
  }
}

// Initialize the store and export as default and on `window`.
const store = new IbizaStore()
export default store

if (process.env.NODE_ENV !== 'production') {
  window.ibizaStore = store
}

// Accepts a state Proxy and returns the raw un-proxied state.
export function unproxiedStateOf(state) {
  if (!state || !state[isProxy]) return state

  return state[propertyPath] ? get(store.unproxiedState, state[propertyPath]) : store.unproxiedState
}

// Recursively merge `src` into `target`. Arrays are replaced, and getters/setters copied without
// being called.
function merge(target, src) {
  const props = Object.keys(src)

  for (const prop of props) {
    const desc = Object.getOwnPropertyDescriptor(src, prop)
    const isDataDesc = Object.prototype.hasOwnProperty.call(desc, 'value')

    // If the prop doesn't exist on the target, define it.
    if (!Object.prototype.hasOwnProperty.call(target, prop)) {
      Object.defineProperty(target, prop, desc)

      // If have prop, but type is not object => Overwrite by redefining property
    } else if (isDataDesc && typeof desc.value !== 'object') {
      Object.defineProperty(target, prop, desc)

      // If prop is Array => Replace.
    } else if (Array.isArray(desc.value)) {
      Object.defineProperty(target, prop, desc)
    }

    // prop is a data descriptor
    if (isDataDesc) {
      const value = target[prop]

      if (isPlainObject(desc.value)) {
        target[prop] = merge(value, desc.value)
      } else if (Array.isArray(desc.value)) {
        target[prop] = desc.value.map((x, i, array) => {
          return isPlainObject(x) ? merge(array[i], x) : x
        })
      }
    }
  }

  return target
}
