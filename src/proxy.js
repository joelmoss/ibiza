// Recursively merge `src` into `target`, while proxifying any objects. Arrays are replaced, and

import { compact, isArray, isPlainObject } from 'lodash'
import { store } from './index'

// getters/setters copied.
export function proxyMerge(target, src, parentPath = null) {
  const props = Object.keys(src)

  // Save the target's path.
  Object.defineProperty(target, '__path', { value: parentPath })

  for (const prop of props) {
    const desc = Object.getOwnPropertyDescriptor(src, prop)
    const isDataDesc = desc.hasOwnProperty('value')
    const path = compact([parentPath, prop]).join('.')

    // console.group(prop, isDataDesc ? '[data]' : '[accessor]', path)

    // If the prop doesn't exist on the target, define it.
    if (!target.hasOwnProperty(prop)) {
      Object.defineProperty(target, prop, desc)

      // If have prop, but type is not object => Overwrite by redefining property
    } else if (isDataDesc && typeof desc.value !== 'object') {
      Object.defineProperty(target, prop, desc)

      // If prop is Array => Replace.
    } else if (isArray(desc.value)) {
      Object.defineProperty(target, prop, desc)
    }

    // prop is a data descriptor
    if (isDataDesc) {
      // Get the value without triggering the proxy.
      const value = Reflect.get(target, prop, { bypassProxy: true })

      if (isPlainObject(desc.value)) {
        target[prop] = proxyMerge(value, desc.value, path)
      } else if (isArray(desc.value)) {
        const arr = desc.value.map(x => {
          if (isPlainObject(x)) {
            // Save the path.
            Object.defineProperty(x, '__path', { value: path })

            return proxify(x)
          } else {
            return x
          }
        })

        Object.defineProperty(arr, '__path', { value: path })
        target[prop] = proxify(arr)
      }
    }

    // console.groupEnd()
  }

  // Finally - Proxify the object!
  return proxify(target)
}

const proxify = obj => {
  // If obj is already a proxy, return it.
  if (obj === null || obj.isProxy) return obj

  const proxy = new Proxy(obj, {
    get: function (target, prop, receiver) {
      if (prop === 'isProxy') return true

      const receiverProps = Object.getOwnPropertyNames(receiver)
      let onGet = undefined
      if (receiverProps.includes('receiver') && receiverProps.includes('onGet')) {
        onGet = receiver.onGet
        receiver = receiver.receiver
      }

      const result = Reflect.get(target, prop, receiver)

      if (typeof prop === 'symbol') return result

      // Ignore if bypassProxy is given in the receiver.
      if (!receiver.isProxy && receiver.bypassProxy) return result

      // Ignore any non-own properties.
      // if (!target.hasOwnProperty(prop)) return result

      // Functions should be bound to the global store state - the root. And the same should be
      // passed as the first argument.
      if (typeof result === 'function' && target.hasOwnProperty(prop)) {
        return result.bind(store.state, store.state)
      }

      // Track this property's usage, but on a per-hook basis.
      onGet && onGet({ target, prop })

      return result
    },

    set: function (target, prop, value, receiver) {
      const previousValue = Reflect.get(target, prop, receiver)
      const result = Reflect.set(target, prop, value)

      if (!result) {
        throw new Error(`Failed to set property '${prop}'`)
      }

      const isChanged = !(prop in target) || !Object.is(previousValue, value)
      let path = target.__path
      path = path === null ? prop : [path, prop].join('.')

      // Emit when value is changed.
      path &&
        isChanged &&
        result &&
        store.publishSet({ target, prop, path, previousValue, value, isChanged })

      return result
    }

    // apply: function () {
    //   console.warn('[Ibiza] Untrapped `apply`', ...arguments)

    //   return Reflect.apply(...arguments)
    // },

    // defineProperty: function () {
    //   console.warn('[Ibiza] Untrapped defineProperty', ...arguments)

    //   return Reflect.defineProperty(...arguments)
    // }
  })

  return proxy
}
