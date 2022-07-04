import memoize from 'micro-memoize'

const INFINITY = 1 / 0
const MAX_SAFE_INTEGER = 9007199254740991

const reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/
const reIsPlainProp = /^\w*$/
const reLeadingDot = /^\./
const reIsUint = /^(?:0|[1-9]\d*)$/
const reEscapeChar = /\\(\\)?/g
const rePropName =
  /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g

export function isDate(date) {
  return Object.prototype.toString.call(date) === '[object Date]'
}

export function isPlainObject(value) {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

/**
 * Gets the value at `path` of `object`.
 *
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value, or undefined if given object is also undefined.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 */
export function get(object, path) {
  if (typeof path === 'undefined' || path === null) return undefined

  path = isKey(path, object) ? [path] : castPath(path)

  let index = 0
  const length = path.length

  while (object != null && index < length) {
    object = object[toKey(path[index++])]
  }

  return index && index == length ? object : undefined
}

/**
 * Sets the value at `path` of `object`. If a portion of `path` doesn't exist,
 * it's created. Arrays are created for missing index properties while objects
 * are created for all other missing properties.
 *
 * **Note:** This method mutates `object`.
 *
 * @param {Object} object The object to modify.
 * @param {Array|string} path The path of the property to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns `object`.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.set(object, 'a[0].b.c', 4);
 * console.log(object.a[0].b.c);
 * // => 4
 *
 * _.set(object, ['x', '0', 'y', 'z'], 5);
 * console.log(object.x[0].y.z);
 * // => 5
 */
export function set(object, path, value) {
  if (object == null) return object

  if (!isObject(object)) return object

  path = isKey(path, object) ? [path] : castPath(path)

  let index = -1
  let nested = object
  const length = path.length
  const lastIndex = length - 1

  while (nested != null && ++index < length) {
    const key = toKey(path[index])
    let newValue = value

    if (index != lastIndex) {
      const objValue = nested[key]
      newValue = isObject(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {}
    }

    assignValue(nested, key, newValue)
    nested = nested[key]
  }
  return object
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  const objValue = object[key]

  if (
    !(Object.prototype.hasOwnProperty.call(object, key) && eq(objValue, value)) ||
    (value === undefined && !(key in object))
  ) {
    object[key] = value
  }
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other)
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length

  return (
    !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    value > -1 &&
    value % 1 == 0 &&
    value < length
  )
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  const type = typeof value
  return !!value && (type == 'object' || type == 'function')
}

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) return value

  const result = value + ''
  return result == '0' && 1 / value == -INFINITY ? '-0' : result
}

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (Array.isArray(value)) return false

  const type = typeof value
  if (
    type == 'number' ||
    type == 'symbol' ||
    type == 'boolean' ||
    value == null ||
    isSymbol(value)
  ) {
    return true
  }

  return (
    reIsPlainProp.test(value) ||
    !reIsDeepProp.test(value) ||
    (object != null && value in Object(object))
  )
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return (
    typeof value == 'symbol' ||
    (!!value &&
      typeof value == 'object' &&
      Object.prototype.toString.call(value) == '[object Symbol]')
  )
}

/**
 * Casts `value` to a path array if it's not one.
 *
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value) {
  return Array.isArray(value) ? value : stringToPath(value)
}

/**
 * Converts `string` to a property path array.
 *
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
const stringToPath = memoize(function (string) {
  string = toString(string)

  let result = []
  if (reLeadingDot.test(string)) result.push('')

  string.replace(rePropName, function (match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : number || match)
  })

  return result
})

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  if (value == null) return ''

  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') return value

  if (isSymbol(value)) return Symbol.prototype.toString.call(value)

  const result = value + ''
  return result == '0' && 1 / value == -INFINITY ? '-0' : result
}
