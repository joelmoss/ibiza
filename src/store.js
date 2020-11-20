import { isPlainObject } from 'lodash'
import { proxyMerge } from './proxy'

class IbizaStore {
  constructor() {
    this.state = {}
    this.setListeners = new Set()
  }

  // Recursively merge the given `obj` into the store, ensuring that each level of the object is
  // proxified.
  merge(obj) {
    if (!isPlainObject(obj)) {
      throw new TypeError('IbizaStore#merge expects a plain object to merge')
    }

    this.state = proxyMerge(this.state, obj)
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
}

// Initialize the store as a Proxy.
export default new IbizaStore()
