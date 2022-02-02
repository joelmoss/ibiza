import { get, isDate } from './utils'
import store, { rawStateOf } from './store.js'

export default proxify

// Creates and returns a Proxy of the given objOrPath.
//
// - `objOrPath` (Object|String) - If an object, it will be proxified directly. If a string, then
//   the object to proxify will be `get` from the store state at the path given in `objOrPath`.
//
// The `store` maintains a global copy of the state. It can be read from at any time and anywhere,
// but cannot be written to.
function proxify(objOrPath, parentPath, onGet, proxyCache, debugRef) {
  let obj
  if (typeof objOrPath === 'string') {
    obj = get(store.state, objOrPath) || {}
    parentPath = objOrPath
  } else {
    obj = objOrPath || store.state
  }

  if (proxyCache.has(obj)) return proxyCache.get(obj)
  if (obj === null) return obj
  if (obj.isHookProxy) return obj

  const proxy = new Proxy(obj, {
    get(target, prop) {
      if (prop === 'isProxy') return true
      if (prop === 'isStoreProxy') return false
      if (prop === 'isHookProxy') return true

      // Return store state.
      if (prop === '$root') return proxify(null, null, onGet, proxyCache, debugRef)

      // Return model (top level ancestor).
      if (prop === '$model') {
        const [model] = buildPath(prop).split('.')
        return proxify(model, null, onGet, proxyCache, debugRef)
      }

      const hasOwnProperty = Object.prototype.hasOwnProperty.call(target, prop)
      let result = Reflect.get(...arguments)

      if (
        Object.isFrozen(target) ||
        (result !== null && typeof result === 'object' && Object.isFrozen(result))
      ) {
        return rawStateOf(result)
      }

      // Forward calls to URL model save().
      if (prop === '__path' || (prop === 'save' && typeof result === 'function')) return result

      // Forward any functions and non-own properties while allowing undefined properties, except
      // the `length` prop which needs to be tracked so we can respond to array changes.
      if (
        prop !== 'length' &&
        !hasOwnProperty &&
        (Object.getPrototypeOf(target)[prop] || typeof prop === 'symbol')
      ) {
        return result
      }

      // Functions are bound to the local state. And the global state is passed as the first
      // argument.
      if (typeof result === 'function' && hasOwnProperty) {
        return result.bind(
          proxify(target, parentPath, onGet, proxyCache, debugRef),
          proxify(null, null, onGet, proxyCache, debugRef)
        )
      }

      const path = buildPath(prop)

      // If result is an object, but not null, it must be a nested object, so proxify and return it.
      if (result !== null && typeof result === 'object' && !isDate(result)) {
        return proxify(result, path, onGet, proxyCache, debugRef)
      }

      onGet(path, 'get')

      return result
    },

    ownKeys() {
      onGet(buildPath(), 'ownKeys')
      return Reflect.ownKeys(...arguments)
    }
  })

  function buildPath(prop) {
    if (!prop) return parentPath
    if (prop.indexOf('/') === 0) return prop

    return parentPath ? [parentPath, prop].join('.') : prop
  }

  proxyCache.set(obj, proxy)

  return proxy
}
