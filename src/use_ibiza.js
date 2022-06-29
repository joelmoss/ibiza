import { useCallback, useRef, useMemo } from 'react'
import memoize from 'micro-memoize'
import { deepEqual } from 'fast-equals'

// import { useSyncExternalStore } from 'use-sync-external-store/shim'
// This doesn't work in ESM, because use-sync-external-store only exposes CJS.
// See: https://github.com/pmndrs/valtio/issues/452
// The following is a workaround until ESM is supported.
import useSyncExternalStoreExports from 'use-sync-external-store/shim/index.js'
const { useSyncExternalStore } = useSyncExternalStoreExports

import { isPlainObject, isDate, get, set } from './utils.js'
import useComponentName from './use_component_name.js'
import proxify from './proxify.js'
import store from './store.js'

// Accepts an initial slice as a keyed path string, and returns a proxy of the state. If a slice is
// given (String), then the returned state will be sliced by the given slice path.
//
// - initialStateOrSlice (Object|Function|String) - If a string, then a slice of the store state is
//    returned. Otherwise, the value given will be merged into the store state. If a function, then
//    that function will be called with the state, and the return value merged into the store.
// - initialState (?Object|Function) - The value given will be merged into the store state. If a
//    function, then that function will be called with the state, and the return value merged into
//    the store.
function useIbiza(initialStateOrSlice, initialState) {
  const id = useComponentName()

  const initialStateOrSliceRef = useRef(initialStateOrSlice)
  const initialStateRef = useRef(initialState)

  // Array of used state property paths.
  const usedPathsRef = useRef([])

  const slicePathRef = useRef()
  const snapshotVersionRef = useRef(0)

  // Called when a property is get, in order to track its usage. It appends the given `path` to the
  // property, to an array of property paths used by this component.
  const onGet = useCallback(
    path => {
      if (usedPathsRef.current.includes(path)) return

      store.debug && console.debug('[ibiza] <%s> tracking %o', id, path)

      usedPathsRef.current.push(path)
    },
    [id]
  )

  // Handle any initial state and/or slice given to the hook, but do so only on first call -
  // essentially memoizing them.
  if (typeof initialStateOrSliceRef.current !== 'undefined') {
    if (isPlainObject(initialStateOrSliceRef.current)) {
      // Hook argument is a plain object, so merge it into the existing store as initial state.
      store.merge(initialStateOrSliceRef.current)
      initialStateOrSliceRef.current = undefined
    } else if (typeof initialStateOrSliceRef.current === 'function') {
      store.merge(initialStateOrSliceRef.current(store.state))
      initialStateOrSliceRef.current = undefined
    } else if (typeof initialStateOrSliceRef.current === 'string') {
      // We have a request for a slice of the state. Slices can be a dot seperated path to the
      // property you want (eg. 'my.slice.of.state'), or a relative URL (eg. '/users/1').
      slicePathRef.current = initialStateOrSliceRef.current
      initialStateOrSliceRef.current = undefined

      if (initialStateRef.current) {
        let state
        if (slicePathRef.current.indexOf('/') === 0) {
          state = typeof initialStateRef.current === 'function' ? {} : initialStateRef.current
        } else {
          state =
            typeof initialStateRef.current === 'function'
              ? initialStateRef.current(get(store.state, slicePathRef.current) || {})
              : initialStateRef.current
        }

        store.merge(set({}, slicePathRef.current, state))
        initialStateRef.current = undefined
      }
    }
  }

  // If slicePathRef is defined, get and return its value from the store state.
  const [pathForProxy, directPropForProxy] = useMemo(() => {
    let path = null
    let directProp = null

    if (slicePathRef.current) {
      path = slicePathRef.current
      const state = get(store.state, path)

      // Any non-(null|object|function) slice state should proxify its parent, but return the value
      // of the requested property. This allows us to fetch a non-object slice. Note that the
      // returned value should not be mutated.
      if (
        state !== null &&
        typeof state !== 'undefined' &&
        typeof state !== 'object' &&
        typeof state !== 'function'
      ) {
        const [prop, ...parentPaths] = path.split('.').reverse()
        directProp = prop
        path = parentPaths.reverse().join('.') || null
      }
    }

    return [path, directProp]
  }, [])

  useSyncExternalStore(
    // subscriber() - This simply increments the snapshot version when a change is registered.
    useCallback(
      handleStoreChange => {
        return store.listenForChanges(({ path, previousValue, value }) => {
          const used = hasUsedPath(path, usedPathsRef.current)

          if (used) {
            // If the path is a parent of a used path, do an additional equality check on the used
            // children. This helps ensure that we only rerender when the used paths are actually
            // changed.
            if (used === 'parent') {
              const childPath = hasChangedChildren(path, usedPathsRef.current, value, previousValue)
              if (childPath) {
                snapshotVersionRef.current += 1
                store.debug &&
                  console.debug('[ibiza] <%s> rerendering on child %o of %o', id, childPath, path)
              }
            } else {
              snapshotVersionRef.current += 1
              store.debug && console.debug('[ibiza] <%s> rerendering on %o (%s)', id, path, used)
            }
          }

          handleStoreChange()
        })
      },
      [id]
    ),
    // getSnapshot() - Returns a snapshot version of the store state, that is incremented by out
    // subscribe function above.
    () => snapshotVersionRef.current
  )

  const proxy = proxify(pathForProxy || null, null, onGet)
  return directPropForProxy ? proxy[directPropForProxy] : proxy
}

export default useIbiza

// Returns false if `path` is not used. Otherwise, returns a string signifying the type of usage:
// - "exact" - Path is an exact match for a used path.
// - "parent" - Path is a parent (ancestor) of a used path.
// - "child" - Path is a child of a used path.
function hasUsedPath(path, usedPaths) {
  // Return true if `path` is an exact used path.
  if (usedPaths.includes(path)) return 'exact'

  let result = false
  for (const up of usedPaths) {
    // Return true if path is a descendent of any used path. For example, if `user.errors.name` has
    // changed, and `user.errors` or `user` is being tracked.
    if (path.startsWith(up)) {
      result = 'child'
      break
    }

    // Return true if path has any used ascendents. For example, if 'user.errors.name' is being
    // tracked, and 'user.errors` or 'user' is mutated, this will return true.
    if (up.startsWith(`${path}.`)) {
      result = 'parent'
      break
    }
  }

  return result
}

function hasChangedChildrenFn(path, usedPaths, value, previousValue) {
  return usedPaths.find(up => {
    if (!up.startsWith(`${path}.`)) return false

    const childPath = up.slice(path.length + 1)
    const isPath = childPath.includes('.')

    let nValue = undefined
    if (value != null) {
      nValue = isPath ? get(value, childPath) : value[childPath]
    }

    let pValue = undefined
    if (previousValue != null) {
      pValue = isPath ? get(previousValue, childPath) : previousValue[childPath]
    }

    if (isDate(nValue) && isDate(pValue)) return nValue.getTime() !== pValue.getTime()

    return typeof pValue === 'object' && typeof nValue === 'object'
      ? !deepEqual(nValue, pValue)
      : !Object.is(nValue, pValue)
  })
}

const hasChangedChildren = memoize(hasChangedChildrenFn, {
  isEqual: deepEqual,
  maxSize: Number.POSITIVE_INFINITY
})
