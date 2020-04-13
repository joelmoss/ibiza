import { useRef, useEffect, useLayoutEffect, useReducer, useCallback } from 'react'
import observable from './observable'
import { forEach, set, get } from 'lodash'

let store = {}
export const observers = new Set()

// Returns the whole of the store state (default), or a slice of the state if a state path is given.
// Any mutations to the returned state will be observed and tracked, and will result in a re-render.
//
// Any time a state property is read, it is "observed" added to the an array of observed state
// paths. Then when any observed property is mutated, the component is re-rendered.
export const useIbiza = (selectorPathOrInitialState, options = {}) => {
  const name = useRef(options.name)

  const debug = useCallback((...args) => {
    name.current && console.debug('useIbiza', `[${name.current}]`, ...args)
  }, [])

  debug(selectorPathOrInitialState)

  // Builds the selectedPath and initialState variables from the selectedPathOrInitialState.
  const initialState = useRef(getInitialState(selectorPathOrInitialState))
  const selectorPath = useRef(getSelectorPath(selectorPathOrInitialState))

  const [, forceRender] = useReducer(s => s + 1, 0)
  const observedPathsRef = useRef([])
  const observableRef = useRef()

  const onGet = useCallback(({ target, key, path }) => {
    if (observedPathsRef.current.includes(path)) return

    debug('onGet', { target, key, path })

    observedPathsRef.current.push(path)
  }, [])

  const onSet = useCallback(({ target, key, value, path }) => {
    if (observedPathsRef.current.includes(path)) {
      debug('onSet', { target, key, value, path })

      target[key] !== value && forceRender()
    }
  }, [])

  // Merge any initialState by path, then delete it so we don't use it again.
  if (initialState.current) {
    forEach(initialState.current, (v, k) => {
      set(store, k, v)
    })

    initialState.current = null
  }

  const proxyCache = useRef(new WeakMap()) // per-hook proxyCache
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
      onSet
    })
  }

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
