import { get, isDate } from './utils.js'
import store, { accessorDef, isTrackedFn, rawStateOf } from './store.js'

export default proxify

// Creates and returns a Proxy of the given objOrPath.
//
// - `objOrPath` (Object|String) - If an object, it will be proxified directly. If a string, then
//   the object to proxify will be `get` from the store state at the path given in `objOrPath`.
//
// The `store` maintains a global copy of the state. It can be read from at any time and anywhere,
// but cannot be written to.
function proxify(objOrPath, parentPath, onGet) {
  let obj
  if (typeof objOrPath === 'string') {
    obj = get(store.state, objOrPath) || {}
    parentPath = objOrPath
  } else {
    obj = objOrPath || store.state
  }

  if (obj === null) return obj
  if (obj.isHookProxy) return obj

  const proxy = new Proxy(obj, {
    get(target, prop) {
      if (prop === 'isProxy') return true
      if (prop === 'isStoreProxy') return false
      if (prop === 'isHookProxy') return true

      // Return store state.
      if (prop === '$root') {
        return proxify(null, null, onGet)
      }

      // Return model (top level ancestor).
      if (prop === '$model') {
        const [model] = buildPath(prop, parentPath).split('.')
        return proxify(model, null, onGet)
      }

      if (Object.isFrozen(target)) return rawStateOf(Reflect.get(...arguments))

      const hasOwnProperty = Object.prototype.hasOwnProperty.call(target, prop)

      if (hasOwnProperty) {
        const descriptor = Object.getOwnPropertyDescriptor(target, prop)
        const isDataDesc = Object.prototype.hasOwnProperty.call(descriptor, 'value')
        if (isDataDesc && descriptor.value?.[accessorDef]) {
          onGet?.(buildPath(prop, parentPath), prop)

          return Reflect.get(...arguments)
        }
      }

      let result = Reflect.get(...arguments)

      if (result !== null && typeof result === 'object' && Object.isFrozen(result)) {
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

      const path = buildPath(prop, parentPath)

      // Functions are bound to the local state. And the global state is passed as the first
      // argument. Note that used state is not tracked within functions. This avoids component
      // re-rendering when state changes, that is used by a function. The function will always use
      // the latest state, so no need to track the state that it uses.
      //
      // If you want to track the state usage inside a function, use the trackFunction helper.
      if (typeof result === 'function' && hasOwnProperty) {
        if (result[isTrackedFn]) {
          return result.bind(proxify(target, parentPath, onGet), proxify(null, null, onGet))
        }

        return result.bind(proxify(target, parentPath), proxify(null, null))
      }

      // If result is an object, but not null, it must be a nested object, so proxify and return it.
      if (result !== null && typeof result === 'object' && !isDate(result)) {
        return proxify(result, path, onGet)
      }

      onGet?.(path, prop)

      return result
    },

    ownKeys() {
      onGet?.(parentPath)
      return Reflect.ownKeys(...arguments)
    }
  })

  return proxy
}

function buildPath(prop, parentPath) {
  if (!prop) return parentPath
  if (prop.indexOf('/') === 0) return prop

  return parentPath ? [parentPath, prop].join('.') : prop
}
