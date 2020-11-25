export const getByPath = (obj, path) => {
  if (typeof path === 'number') {
    path = [path]
  }

  if (!path || path.length === 0) return obj
  if (obj == null) return null

  if (typeof path === 'string') return getByPath(obj, path.split('.'))

  var currentPath = getKey(path[0])
  var nextObj = getShallowProperty(obj, currentPath)

  if (nextObj === void 0 || path.length === 1) return nextObj

  return getByPath(obj[currentPath], path.slice(1))
}

function hasOwnProperty(obj, prop) {
  if (obj == null) return false

  // To handle objects with null prototypes (too edge case?)
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

function hasShallowProperty(obj, prop) {
  return (typeof prop === 'number' && Array.isArray(obj)) || hasOwnProperty(obj, prop)
}

function getShallowProperty(obj, prop) {
  if (hasShallowProperty(obj, prop)) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, prop)

    // TODO: in this case, don't use a proxy - just track the property ourselves.
    if (
      !descriptor.hasOwnProperty('get') &&
      !descriptor.hasOwnProperty('set') &&
      (!descriptor.hasOwnProperty('value') || typeof descriptor.value !== 'object')
    ) {
      throw (
        '[Ibiza] You requested a slice that is not an object, which Ibiza cannot track. ' +
        'Instead you should return the parent object that contains the wanted slice.'
      )
    }

    return obj[prop]
  }
}

function getKey(key) {
  var intKey = parseInt(key)
  return intKey.toString() === key ? intKey : key
}
