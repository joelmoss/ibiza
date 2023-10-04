import { isQuery, queryFn, accessorDef, isTrackedFn } from './store.js'

/**
 * Create a accessor descriptor. This defines a getter and setter with a internally scoped value.
 *
 * @param {Object} options
 * @param {any} [options.initialValue] An initial value to assign to the property. If undefined, the
 *   initialValue will be taken from property of the same name in the `obj` argument (if any).
 * @param {Function} [options.onGet] A Function to be called each time the property is "get". It
 *   will be called with property value.
 * @param {Function} [options.onSet] A function to be called each time the property is "set". It
 *   will be called with the old and new property values. A function is passed as the third
 *   argument, which can be used to manually set the value, allowing you to perform some validation
 *   logic.
 * @param {Function} [options.afterSet] A function to be called after the property is "set". It will
 *   be called with the old and new property values arguments.
 */
export function accessor(options = {}) {
  const def = {}

  options.value = options.initialValue
  delete options.initialValue

  Object.defineProperty(def, accessorDef, { value: options })

  return def
}

// Creates a dynamic query property.
//
// - fn - A Function that should return a URL string.
//
// Usually, a query property is defined by using a URL for the name of the property:
//
//  store.state.user['/users/1'] = null
//
// But this means the URL used can never change. The `query` helper allows you to define a dynamic
// query property.
//
// Example:
//
//  store.state = {
//    userId: 1,
//    user: query(() => `/users/${this.id}`)
//  }
//
export function query(fn) {
  const def = {}

  Object.defineProperty(def, isQuery, { value: true })
  Object.defineProperty(def, queryFn, { value: fn })

  return def
}

// By default, functions do not cause the usage of state to be tracked. We recommend using an
// accessor instead. However, sometimes you do want to track state usage in your function.
//
// Example:
//
//  store.state = {
//    errors: { name: 'invalid' },
//    errorFor: trackFunction(function(_, name) {
//      return this.errors[name]
//    })
//  }
//
export function trackFunction(fn) {
  Object.defineProperty(fn, isTrackedFn, { value: true })
  return fn
}

// Freeze the given `object`. Values can be read from, but not written to (immutable).
export function freeze(object) {
  // When already frozen, we assume its children are frozen (for better performance).
  // This should be true if you always use `simpleDeepFreeze` to freeze objects,
  // which is why you should have a linter rule that prevents you from using
  // `Object.freeze` standalone.
  //
  // Note that Object.isFrozen will also return `true` for primitives (numbers,
  // strings, booleans, undefined, null), so there is no need to check for
  // those explicitly.
  if (Object.isFrozen(object)) return object

  if (!Array.isArray(object) && Object.getPrototypeOf(object) !== Object.getPrototypeOf({})) {
    throw new Error('Ibiza#freeze only supports plain objects, arrays, and primitives')
  }

  // At this point we know that we're dealing with either an array or plain object, so just freeze
  // it and recurse over its values.
  Object.freeze(object)
  Object.keys(object).forEach(key => {
    freeze(object[key])
  })

  return object
}
