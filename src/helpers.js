import { isQuery, queryUrl, queryFn, accessorDef } from './store.js'

// Create a accessor descriptor. This defines a getter and setter with a internally scoped value.
//
// - options (Object?)
// - options.initialValue (any?) - An initial value to assign to the property. If undefined, the
//   initialValue will be taken from property of the same name in the `obj` argument (if any).
// - options.onGet (function?) - A function to be called each time the property is "get". It will be
//   called with property value.
// - options.onSet (function?) - A function to be called each time the property is "set". It will be
//   called with the old and new property values. A function is passed as the third argument, which
//   can be used to manually set the value, allowing you to perform some validation logic.
export function accessor(options = {}) {
  const def = {}

  options.value = options.initialValue
  delete options.initialValue

  Object.defineProperty(def, accessorDef, { value: options })

  return def
}

export function query(fn) {
  const def = {}

  Object.defineProperty(def, isQuery, { value: true })
  Object.defineProperty(def, queryFn, { value: fn })

  return def
}

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

  // At this point we know that we're dealing with either an array or plain object, so
  // just freeze it and recurse on its values.
  Object.freeze(object)
  Object.keys(object).forEach(key => {
    freeze(object[key])
  })

  return object
}
