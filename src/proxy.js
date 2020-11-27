import { compact, isPlainObject, isDate, clone } from 'lodash'
import store from './store'
import suspendedState from './suspendedState'

export const TARGET = Symbol('target')

export const unwrap = state => {
  // Destructure to ensure a copy.
  const obj = clone(state[TARGET])

  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      if (!isDate(obj[key]) && typeof obj[key] === 'object') {
        obj[key] = unwrap(obj[key])
      }
    })
  }

  return obj
}

// Recursively merge `src` into `target`, while proxifying any objects. Arrays are replaced, and
// getters/setters copied.
export function proxyMerge(target, src, parentPath = null, debugName = '') {
  const props = Object.keys(src)

  // Save the target's path.
  Object.defineProperty(target, '__path', { value: parentPath })

  for (const prop of props) {
    const desc = Object.getOwnPropertyDescriptor(src, prop)
    const isDataDesc = desc.hasOwnProperty('value')
    const path = compact([parentPath, prop]).join('.')

    // If the prop doesn't exist on the target, define it.
    if (!target.hasOwnProperty(prop)) {
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
      // Get the value without triggering the proxy.
      const value = Reflect.get(target, prop, { receiver: store.state, bypassProxy: true })

      if (isPlainObject(desc.value)) {
        target[prop] = proxyMerge(value, desc.value, path, debugName)
      } else if (Array.isArray(desc.value)) {
        const arr = desc.value.map(x => {
          if (isPlainObject(x)) {
            // Save the path.
            Object.defineProperty(x, '__path', { value: path })

            return proxify(x, debugName)
          } else {
            return x
          }
        })

        Object.defineProperty(arr, '__path', { value: path })
        target[prop] = proxify(arr, debugName)
      }
    }
  }

  // Finally - Proxify the object!
  return proxify(target, debugName)
}

const createHandler = (debugName = '') => {
  return {
    get: function (target, prop, receiver) {
      if (prop === 'isProxy') return true
      if (prop === TARGET) return target

      const receiverProps = Object.getOwnPropertyNames(receiver)
      let onGet = undefined
      if (receiverProps.includes('receiver') && receiverProps.includes('onGet')) {
        onGet = receiver.onGet
        receiver = receiver.receiver
      }

      const result = Reflect.get(target, prop, store.state)
      const hasOwnProperty = target.hasOwnProperty(prop)

      if (!hasOwnProperty && typeof prop === 'symbol') return result

      // Ignore if bypassProxy is given in the receiver.
      if (receiver && !receiver.isProxy && receiver.bypassProxy) return result

      // // Ignore any non-own properties while allowing undefined properties.
      if (!hasOwnProperty && Object.getPrototypeOf(target)[prop]) return result

      store.debug &&
        console.debug(
          '[Ibiza] %s proxy:get %o',
          debugName,
          prop,
          // target.__path ? [target.__path, prop].join('.') : prop,
          { onGet, target, receiver, result }
        )

      // Functions should be bound to the global store state - the root. And the same passed as the
      // first argument.
      if (typeof result === 'function' && hasOwnProperty) {
        return result.bind(store.state, store.state)
      }

      // Track this property's usage, but on a per-hook basis.
      onGet && onGet({ target, prop })

      // If prop is a URL, fetch and set it.
      if (!result && typeof prop === 'string' && prop.indexOf('/') === 0) {
        this.set(target, prop, suspendedState(store.fetchFn, prop), receiver)

        return this.get(target, prop, receiver || {})
      }

      return result
    },

    set: function (target, prop, value, receiver) {
      let path = target.__path
      path = typeof path === 'undefined' || path === null ? prop : [path, prop].join('.')

      if (typeof value === 'object' && !isDate(value) && !value.isProxy) {
        value = proxyMerge(Array.isArray(value) ? [] : {}, value, path)
      }

      const previousValue = Reflect.get(target, prop, store.state)
      const result = Reflect.set(target, prop, value)

      store.debug && console.debug('[Ibiza] %s proxy:set %o to %o', debugName, prop, value)

      if (!result) {
        throw new Error(`Failed to set property '${prop}'`)
      }

      const isChanged = !(prop in target) || !Object.is(previousValue, value)

      // Emit when value is changed.
      path &&
        isChanged &&
        result &&
        store.publishSet({ target, prop, path, previousValue, value, isChanged })

      return result
    },

    deleteProperty: function (target, prop) {
      let path = target.__path
      path = path === null ? prop : [path, prop].join('.')

      const result = Reflect.deleteProperty(target, prop)

      result && store.publishSet({ target, prop, path })

      return result
    }

    // apply: function () {
    //   console.warn('[Ibiza] Untrapped `apply`', ...arguments)

    //   return Reflect.apply(...arguments)
    // },

    // defineProperty: function (target, property, descriptor) {
    //   console.warn('[Ibiza] Untrapped defineProperty', { target, property, descriptor })

    //   return Reflect.defineProperty(target, property, descriptor)
    // }
  }
}

export const proxify = (obj, debugName = '') => {
  if (obj === null || obj.isProxy) return obj

  return new Proxy(obj, createHandler(debugName))
}
