/* global process */

import { get, isPlainObject, isDate } from './utils'

class IbizaStore {
  debug = process.env.NODE_ENV === 'development'

  fetches = {}
  modelInitializers = {}
  modelOptions = {}

  #setListeners = new Set()
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
  get rawState() {
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

    this.fetches = {}
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
      this.fetches[resource].status = 'success'

      if (response === null) return response

      return (this.fetches[resource].response =
        resource in this.modelInitializers ? this.modelInitializers[resource](response) : response)
    }

    const fetchFn = (this.modelOptions[resource]?.fetcher || this.fetchFn).bind(this.state)

    // Regular fetch.
    if (!suspense) {
      return fetchFn(resource, options).then(thenCallback)
    }

    // Suspenseful fetch.
    if (!this.fetches[resource]) {
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

  #proxyOf(target, parentPath = null) {
    if (target.isHookProxy) return target
    if (this.#proxyCache.has(target)) return this.#proxyCache.get(target)

    function buildPath(prop) {
      if (!prop) return parentPath
      if (prop.indexOf('/') === 0) return prop

      return parentPath ? [parentPath, prop].join('.') : prop
    }

    // Returns the fetcher (from store.fetches) for the given `prop`.
    const getFetcherByProp = prop => {
      if (prop.indexOf('/') !== 0) {
        const path = buildPath(prop)
        if (path.indexOf('/') === 0) {
          prop = path.split('.')[0]
        }
      }

      if (Object.prototype.hasOwnProperty.call(this.fetches, prop)) {
        return this.fetches[prop]
      }
    }

    // eslint-disable-next-line unicorn/no-this-assignment
    const $this = this

    const proxy = new Proxy(target, {
      get(target, prop, receiver) {
        if (prop === 'isProxy') return true
        if (prop === 'isStoreProxy') return true
        if (prop === 'isHookProxy') return false
        if (prop === '__path') return parentPath
        if (prop === '__fetcher') return getFetcherByProp(parentPath)

        // Return save function if we are in a URL model.
        if (prop === 'save') {
          const path = buildPath(prop)

          if (path.indexOf('/') === 0) {
            return async (url = {}, options = {}) => {
              if (typeof url !== 'string') {
                options = url
                ;[url] = path.split('.')
              }

              const response = await $this.fetch(url, {
                method: 'patch',
                ...options
              })
              if (response !== null) {
                $this.state[url] = response
              }

              return response
            }
          }
        }

        if (prop === 'refetch') {
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

        // Forward any functions and non-own properties while allowing undefined properties, except
        // the `length` prop which needs to be tracked so we can respond to array changes.
        if (
          prop !== 'length' &&
          !Object.prototype.hasOwnProperty.call(target, prop) &&
          (Object.getPrototypeOf(target)[prop] || typeof prop === 'symbol')
        ) {
          return Reflect.get(target, prop, receiver)
        }

        const path = buildPath(prop)
        let result = Reflect.get(target, prop, receiver)

        if (
          Object.isFrozen(target) ||
          (result !== null && typeof result === 'object' && Object.isFrozen(result))
        ) {
          return result
        }

        const shouldFetch = key =>
          !Object.prototype.hasOwnProperty.call($this.fetches, key) || $this.fetches[key].fetch

        const throwOnFetchError = key => {
          if (
            Object.prototype.hasOwnProperty.call($this.fetches, key) &&
            $this.fetches[key].error
          ) {
            throw $this.fetches[prop].error
          }
        }

        // If path is a URL state, then fetch it if it has not already.
        if (prop.indexOf('/') === 0) {
          throwOnFetchError(prop)

          if (shouldFetch(prop)) {
            result = $this.fetch(prop, { suspense: true })
            this.set(target, prop, result, receiver)
          }
        } else if (path.indexOf('/') === 0) {
          const [url, ...rest] = path.split('.')
          const urlPath = rest.join('.')

          throwOnFetchError(url)

          if (shouldFetch(url)) {
            const urlResult = $this.fetch(url, { suspense: true })
            $this.state[url] = urlResult
            result = get(urlResult, urlPath)
          }
        }

        // If result is an object, but not null, it must be a nested object, so proxify and return.
        if (result !== null && typeof result === 'object' && !isDate(result)) {
          return $this.#proxyOf(result, path)
        }

        return result
      },

      set(target, prop, value, receiver) {
        if (target.isProxy) {
          console.warn('[ibiza] Attempting to set a property (%s) on proxied object', prop, target)
        }

        if (Object.isFrozen(target)) {
          throw new TypeError(`Cannot mutate '${prop}'. Object is frozen!`)
        }

        let previousValue = Reflect.get(target, prop, receiver)
        const result = Reflect.set(target, prop, value, receiver)
        if (result) {
          previousValue = rawStateOf(previousValue)

          if (prop === 'length' || !Object.is(previousValue, value)) {
            const path = buildPath(prop)

            if (store.debug) {
              console.groupCollapsed('[ibiza] Mutated %o', path)
              console.info({ previousValue, value })
              console.groupEnd()
            }

            $this.publishChange({ target, prop, path, previousValue, value })
          }
        }

        return result
      },

      deleteProperty(target, prop) {
        const previousValue = Reflect.get(target, prop)
        const result = Reflect.deleteProperty(target, prop)

        if (result) {
          $this.publishChange({
            target,
            prop,
            path: buildPath(prop),
            previousValue: rawStateOf(previousValue)
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
export function rawStateOf(state) {
  if (!state || !state.isProxy) return state

  return state.__path ? get(store.rawState, state.__path) : store.rawState
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
