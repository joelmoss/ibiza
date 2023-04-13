import { get, isDate } from './utils.js'
import store, {
  isProxy,
  isStoreProxy,
  isHookProxy,
  propertyPath,
  accessorDef,
  isTrackedFn,
  unproxiedStateOf
} from './store'

export default proxify

// Creates and returns a Proxy that wraps the global Store Proxy, at the given objOrPath.
//
// - `objOrPath` (Object|String) - If an Object, it will be wrapped in a new Proxy and returned. If
//                                 a String, it will be treated as a property path. This path will
//                                 then be used to get a store state value, which is then wrapped in
//                                 a new Proxy.
//                                 If null, the entire store state is wrapped and returned.
//                                 If undefined, returns undefined.
// - `parentPath` (?String)      - The property path of the parent of the `objOrPath`.
// - `onGet` (?Function)         - If given, this function will be called with two arguments; the
//                                 path of the property, and the requested property name.
//
// Returns a new Hook Proxy, wrapping the Store Proxy at the requested path. The Hook Proxy only
// exists to track component usage of the state.
function proxify(objOrPath, parentPath, onGet) {
  if (typeof objOrPath === 'undefined') return undefined

  let obj
  if (typeof objOrPath === 'string') {
    obj = get(store.state, objOrPath) || {}
    parentPath = objOrPath
  } else {
    obj = objOrPath || store.state
  }

  if (obj === null || obj[isHookProxy]) return obj

  const proxy = new Proxy(obj, {
    // Should always return the value of the requested state path as a Store Proxy.
    get(target, prop) {
      if (prop === isStoreProxy) return false
      if (prop === isProxy || prop === isHookProxy) return true

      if (prop === '$unproxiedState') {
        return unproxiedStateOf(Reflect.get(...arguments))
      }

      // Even though the store state also responds to $root and $model, we reimplement them here to
      // avoid crawling through all the code in the rest of this function.
      if (prop === '$root') return parentPath === null ? undefined : proxify(null, null, onGet)
      if (prop === '$model') return proxify(parentPath?.split('.')[0], null, onGet)

      // If the target is frozen, return the unproxied, and frozen state.
      // TODO: Ensure the returned value is still frozen to prevent mutation!
      if (Object.isFrozen(target)) return unproxiedStateOf(Reflect.get(...arguments))

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
        return unproxiedStateOf(result)
      }

      // Forward calls to URL model $save().
      if (prop === propertyPath || (prop === '$save' && typeof result === 'function')) return result

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
