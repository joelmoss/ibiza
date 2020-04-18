import { useRef, useEffect, useLayoutEffect, useReducer, useCallback, useDebugValue } from 'react'
import observable, { TARGET, subscribers } from './observable'
import { nth, forEach, isArray, set, get } from 'lodash'

let store = {}
export const unwrap = proxy => proxy[TARGET] || proxy

// Returns the whole of the store state (default), or a slice of the state if a state path is given.
// Any mutations to the returned state will be observed and tracked, and will result in a re-render.
//
// Any time a state property is read, it is "observed" added to the an array of observed state
// paths. Then when any observed property is mutated, the component is re-rendered.
export const useIbiza = (selectorPathOrInitialState, options = {}) => {
  const name = useRef(options.name)

  useDebugValue(name.current ? name.current : '[unknown]')

  const debug = useCallback((...args) => {
    name.current && console.log('useIbiza', `[${name.current}]`, ...args)
  }, [])

  debug(selectorPathOrInitialState)

  // Builds the selectedPath and initialState variables from the selectedPathOrInitialState.
  const initialState = useRef(getInitialState(selectorPathOrInitialState))
  const selectorPath = useRef(getSelectorPath(selectorPathOrInitialState))

  const [, forceRender] = useReducer(s => s + 1, 0)
  const observedPathsRef = useRef([])
  const observableRef = useRef()
  const proxyCache = useRef(new WeakMap()) // per-hook proxyCache

  const onGet = useCallback(({ target, key, path }) => {
    if (observedPathsRef.current.includes(path)) return

    debug('onGet', { key, target, path })

    // Add the used path to the observed paths.
    observedPathsRef.current.push(path)

    // Subscribe to changes.
    subscribers.add(onSet)
  }, [])

  const onSet = useCallback(({ target, key, previous, value, path }) => {
    // If target is an array, find the parent path and use that to check if it's used.
    if (isArray(target)) {
      const parentPath = nth(path.split('.'), -2)
      if (parentPath) {
        path = parentPath
      }
    }

    // debug('pre:onSet', key, target, path, observedPathsRef.current)
    if (observedPathsRef.current.includes(path)) {
      debug('onSet', { key, target, previous, value, path })

      forceRender()
    }
  }, [])

  const onApply = useCallback(({ target, argumentsList, path }) => {
    debug('onApply', { target, argumentsList, path })

    // Functions should be able to read state without fear of the get being trapped by the proxy. So
    // we return a new un-cached observable here without the onGet callback.
    const state = observable(store, path, false, { onApply })
    return target(state, ...argumentsList)
  }, [])

  // Merge any initialState by path, then delete it so we don't use it again.
  if (initialState.current) {
    forEach(initialState.current, (v, k) => set(store, k, v))

    initialState.current = null
  }

  if (!observableRef.current) {
    const state = selectorPath.current ? get(store, selectorPath.current) : store

    if (selectorPath.current && typeof state !== 'object') {
      throw new TypeError(
        'Cannot useIbiza with a non-object. If you called useIbiza with slice, make sure that ' +
          'slice returns an object and not a property value'
      )
    }

    observableRef.current = observable(state, selectorPath.current, proxyCache.current, {
      onGet,
      onSet,
      onApply
    })
  }

  useIsomorphicLayoutEffect(() => {
    return () => subscribers.delete(onSet)
  }, [])

  return observableRef.current
}

export const reset = () => {
  store = {}
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement !== 'undefined'
    ? useLayoutEffect
    : useEffect

const getSelectorPath = selectorPathOrInitialState => {
  return typeof selectorPathOrInitialState === 'string' ? selectorPathOrInitialState : undefined
}

const getInitialState = selectorPathOrInitialState => {
  if (typeof selectorPathOrInitialState === 'string') return undefined
  if (typeof selectorPathOrInitialState === 'function') return selectorPathOrInitialState()
  return selectorPathOrInitialState
}
