// Create a accessor descriptor on the given `obj` at `prop`. This defines a getter and setter
// with a internally scoped value.
//
// - obj (Object)
// - prop (String)
// - options (Object?)
// - options.initialValue (any?) - An initial value to assign to the property. If undefined, the
//   initialValue will be taken from property of the same name in the `obj` argument (if any).
// - options.onGet (function?) - A function to be called each time the property is "get". It will be
//   called with property value.
// - options.onSet (function?) - A function to be called each time the property is "set". It will be
//   called with the old and new property values. A function is passed as the third argument, which
//   can be used to manually set the value, allowing you to perform some validation logic.
export function createAccessor(obj, prop, options = {}) {
  let _manuallySet = false
  let _value = Object.prototype.hasOwnProperty.call(obj, prop) ? obj[prop] : options.initialValue

  const setValue = value => {
    _value = value
    _manuallySet = true
  }

  Object.defineProperty(obj, prop, {
    get() {
      return options.onGet ? options.onGet.call(this, _value) : _value
    },

    set(newValue) {
      options.onSet?.call(this, _value, newValue, setValue)

      if (_manuallySet) {
        _manuallySet = false
      } else {
        _value = newValue
      }
    }
  })
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
