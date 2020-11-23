import { isPlainObject } from 'lodash'
import { proxyMerge } from './proxy'

class IbizaStore {
  constructor() {
    this.state = {}
    this.setListeners = new Set()
    this.fetches = new Map()
    this.mergedObjects = new WeakMap()
  }

  // Recursively merge the given `obj` into the store, ensuring that each level of the object is
  // proxified.
  merge(obj) {
    if (!isPlainObject(obj)) {
      throw new TypeError('IbizaStore#merge expects a plain object to merge')
    }

    // Don't merge if `obj` has already been merged.
    if (!this.mergedObjects.has(obj)) {
      this.mergedObjects.set(obj, true)
      this.state = proxyMerge(this.state, obj)
    }
  }

  listenOnSet(setFn) {
    this.setListeners.add(setFn)
  }

  publishSet(args) {
    for (let listener of this.setListeners) {
      listener(args)
    }
  }

  reset() {
    this.state = {}
    this.setListeners = new Set()
  }

  get fetchFn() {
    return this.customFetchFn || defaultFetchFn
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

// Initialize the store as a Proxy.
export default new IbizaStore()
