import { isPlainObject } from 'lodash'
import { proxyMerge, proxify, unwrap } from './proxy'

class IbizaStore {
  constructor() {
    this.state = proxify({})
    this.setListeners = new Set()
    this.fetches = new Map()
    this.mergedObjects = new WeakMap()
    this.debug = false
  }

  // Recursively merge the given `obj` into the store, ensuring that each level of the object is
  // proxified.
  merge(obj, debugName = '') {
    if (!isPlainObject(obj)) {
      throw new TypeError('IbizaStore#merge expects a plain object to merge')
    }

    // Don't merge if `obj` has already been merged.
    if (!this.mergedObjects.has(obj)) {
      this.mergedObjects.set(obj, true)
      this.state = proxyMerge(this.state, obj, null, debugName)
    }
  }

  listenOnSet(setFn) {
    this.setListeners.add(setFn)

    return () => {
      this.setListeners.delete(setFn)
    }
  }

  publishSet(args) {
    for (let listener of this.setListeners) {
      listener(args)
    }
  }

  reset() {
    this.state = proxify({})
    this.setListeners = new Set()
    this.fetches = new Map()
    this.mergedObjects = new WeakMap()
    this.debug = false
    delete this.customFetchFn
  }

  get unwrappedState() {
    return unwrap(this.state)
  }

  get fetchFn() {
    return (this.customFetchFn || defaultFetchFn).bind(this.state)
  }

  set fetchFn(fn) {
    this.customFetchFn = fn
  }
}

const defaultFetchFn = path => {
  const url = new URL(path, location.origin)
  const resource = new Request(url)

  return fetch(resource).then(response => {
    if (!response.ok) {
      throw new Error(`Error (${response.status})`)
    }

    return response.json()
  })
}

// Initialize the store and export as default and on `window`.
const store = new IbizaStore()
window.ibizaStore = store
export default store
