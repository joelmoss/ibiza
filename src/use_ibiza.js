import { isPlainObject, get, set, isDate } from 'lodash'
import { useCallback, useReducer, useRef, useEffect, useMemo } from 'react'
import memoize from 'micro-memoize'
import { deepEqual } from 'fast-equals'

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
  const cnameRef = useComponentName()
  const [, forceRender] = useReducer(s => s + 1, 0)
  const usedPathsRef = useRef([])
  const proxyCacheRef = useRef(new WeakMap())
  const initialStateOrSliceRef = useRef(initialStateOrSlice)
  const slicePathRef = useRef()

  // Force a rerender when a used state property has been changed.
  const onSet = useCallback(({ path, previousValue, value }) => {
    const used = hasUsedPath(path, usedPathsRef.current)

    if (used) {
      // If the path is a parent of a used path, do an additional equality check on the used
      // children. This helps ensure that we only rerender when the used paths are actually
      // changed.
      if (used === 'parent') {
        const childPath = hasChangedChildren(path, usedPathsRef.current, value, previousValue)
        if (childPath) {
          if (store.debug) {
            console.debug(
              '[ibiza] <%s> rerendering on child %o of %o',
              cnameRef.current,
              childPath,
              path
            )
          }

          forceRender()
        }
      } else {
        store.debug &&
          console.debug('[ibiza] <%s> rerendering on %o (%s)', cnameRef.current, path, used)

        forceRender()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onGet = useCallback(
    path => {
      if (usedPathsRef.current.includes(path)) return

      store.debug && console.debug('[ibiza] <%s> tracking %o', cnameRef.current, path)

      usedPathsRef.current.push(path)
      store.listenForChanges(onSet)
    },
    [cnameRef, onSet]
  )

  if (typeof initialStateOrSliceRef.current !== undefined) {
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

      if (initialState) {
        let state
        if (slicePathRef.current.indexOf('/') === 0) {
          state = typeof initialState === 'function' ? {} : initialState
        } else {
          state =
            typeof initialState === 'function'
              ? initialState(get(store.state, slicePathRef.current) || {})
              : initialState
        }

        store.merge(set({}, slicePathRef.current, state))
      }
    }
  }

  // Delete set listener on component unmount.
  useEffect(() => {
    return () => store.unlistenForChanges(onSet)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [pathForProxy, directPropForProxy] = useMemo(() => {
    let path = null
    let directProp = null

    // If slicePath is defined, get and return its value from the store state.
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

  const proxy = proxify(pathForProxy || null, null, onGet, proxyCacheRef.current, cnameRef)
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
  const regex = new RegExp(`^${path}\\.`)

  return usedPaths.find(up => {
    if (!up.startsWith(`${path}.`)) return false

    const childPath = up.replace(regex, '')
    const isPath = childPath.includes('.')
    const nValue = isPath ? get(value, childPath) : value[childPath]
    const pValue = isPath ? get(previousValue, childPath) : previousValue[childPath]

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
