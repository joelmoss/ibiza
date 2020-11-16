import { useRef, useEffect, useLayoutEffect, useReducer, useCallback, useDebugValue } from 'react'
import observable, { subscribers } from './observable'
import { devTool, devToolExtension, initDevTools } from './devtools'
import { store, fetchCache, unwrap, reset } from './store'
import { mergeWith, nth, forEach, isArray, set, get, has } from 'lodash'

initDevTools()

export const config = {}
export { unwrap, reset }

export const getState = () => store

// Returns the whole of the store state (default), or a slice of the state if a state path is given.
// Any mutations to the returned state will be observed and tracked, and will result in a re-render.
//
// Any time a state property is read, it is "observed" and added to an array of observed state
// paths. Then when any observed property is mutated, the component is re-rendered.
//
// - selectorPathOrInitialState(String | Object | Array)
// - options?(Object)
//   - name(String) - Name of the state slice. If set, will log debug output to the console.
//   - fetchFn(Function) - A custom fetch function to use instead of the native `fetch`.
//   - immutable(Boolean) - If true, will return immutable state only.
//
// If `selectorPathOrInitialState` is an object, the store will be populated with that object, and
// will return the entire store state.
//
// If `selectorPathOrInitialState` is a string, it will extract a slice of the store using the
// string as a path of keys (see Lodash.get), and return the value.
export const useIbiza = (selectorPathOrInitialState, options = {}) => {
  const isCustomFetch = !!(options.fetchFn || config.fetchFn)
  const fetchFn = options.fetchFn || config.fetchFn || fetch
  const name = useRef(options.name)

  useDebugValue(name.current ? name.current : '[unknown]')

  const debug = (...args) => {
    name.current && console.log('useIbiza', `[${name.current}]`, ...args)
  }

  debug('init', selectorPathOrInitialState)

  // Builds the selectedPath and initialState variables from the selectedPathOrInitialState.
  const initialState = useRef(getInitialState(selectorPathOrInitialState))
  const selectorPath = useRef(getSelectorPath(selectorPathOrInitialState))

  const [, forceRender] = useReducer(s => s + 1, 0)
  const observedPathsRef = useRef([])
  const observableRef = useRef()
  const proxyCache = useRef(new WeakMap()) // per-hook proxyCache

  const onSet = useCallback(
    ({ target, key, previous, value, path }) => {
      // If target is an array, find the parent path and use that to check if it's used.
      if (isArray(target)) {
        const parentPath = nth(path.split('.'), -2)
        if (parentPath) {
          path = parentPath
        }
      }

      debug('pre:onSet', {
        key,
        target,
        path,
        paths: observedPathsRef.current,
        immutable: options.immutable
      })

      // If the mutated `path` or its ancestors are being observed, rerender.
      if (isObservedPath(path)) {
        devTool && devTool.send({ type: 'SET', key, target, previous, value, path }, unwrap())
        debug('onSet', { key, target, previous, value, path })

        forceRender()
      }
    },
    [options.immutable]
  )

  // When property is get, we add it to the array of observed paths, and subscribe to any changes.
  const onGet = useCallback(
    ({ target, key, path }) => {
      if (observedPathsRef.current.includes(path)) return

      // Add the used path to the observed paths.
      observedPathsRef.current.push(path)

      devTool &&
        devTool.send({ type: 'GET', key, target, path, immutable: options.immutable }, unwrap())
      debug('onGet', { key, target, path, immutable: options.immutable })

      // Subscribe to changes if its not immutable.
      subscribers.add(onSet)
    },
    [options.immutable, onSet]
  )

  const isObservedPath = path => {
    if (observedPathsRef.current.includes(path)) return true

    // Check ancestors
    const paths = path.split('.')
    return observedPathsRef.current.some(p => paths.includes(p))
  }

  const onApply = useCallback(
    ({ target, thisArg, argumentsList, path }) => {
      devTool && devTool.send({ type: 'APPLY', target, path }, unwrap())
      debug('onApply', { target, path, thisArg })

      // Functions should be able to read state without fear of the get being trapped by the proxy.
      // So we return a new un-cached observable here without the onGet callback.
      const state = observable(store, '', false, { onApply }, { immutable: options.immutable })

      return Reflect.apply(target, state, [state, ...argumentsList])
    },
    [options.immutable]
  )

  // Merge any initialState using an assign function that copies full descriptors, then delete it so
  // we don't use it again.
  if (initialState.current) {
    completeAssign(store, initialState.current)
    initialState.current = null
  }

  if (!observableRef.current) {
    let state

    if (selectorPath.current) {
      // Handle URL requests
      if (selectorPath.current.indexOf('/') === 0) {
        // console.log(1, store, selectorPath.current)
        // Find any existing state
        if (Object.keys(store).includes(selectorPath.current)) {
          // console.log(2)
          state = store[selectorPath.current]
        } else {
          // console.log(3)
          // Otherwise fetch the given URL using suspense.
          state = suspendedState(isCustomFetch, fetchFn, selectorPath.current)
          // console.log(state)
        }
      } else {
        state = get(store, selectorPath.current)
      }
    } else {
      state = store
    }

    if (selectorPath.current && typeof state !== 'object') {
      if (options.immutable) {
        state = store
      } else {
        throw new TypeError(
          'Cannot useIbiza with a non-object. If you called useIbiza with slice, make sure that ' +
            'slice returns an object and not a property value. Or pass the `immutable` option to ' +
            'return an immutable value.'
        )
      }
    }

    observableRef.current = observable(
      state,
      selectorPath.current,
      proxyCache.current,
      {
        onGet,
        onApply
      },
      { immutable: options.immutable }
    )
  }

  useIsomorphicLayoutEffect(() => {
    return () => {
      subscribers.delete(onSet)
      devToolExtension && devToolExtension.disconnect()
    }
  }, [devToolExtension, subscribers, onSet])

  debug('returns', { selectorPath: selectorPath.current, observableRef: observableRef.current })

  // As we can request an immutable slice of the state, here we ensure the correct value is
  // returned.
  if (
    options.immutable &&
    selectorPath.current &&
    has(observableRef.current, selectorPath.current)
  ) {
    return get(observableRef.current, selectorPath.current)
  }

  return observableRef.current
}

const suspendedState = (isCustomFetch, fetchFn, key) => {
  if (!fetchCache[key]) {
    // It's a new request.
    fetchCache[key] = {
      fetch: fetchFn(key)
        .then(response => {
          fetchCache[key].response = response
        })
        .catch(error => {
          fetchCache[key].error = error
        })
    }
  } else {
    if (fetchCache[key].error) {
      // const { error } = fetchCache[key]
      // delete fetchCache[key]
      throw fetchCache[key].error
      throw error
    } else if (fetchCache[key].response) {
      // const { response } = fetchCache[key]
      // delete fetchCache[key]
      return fetchCache[key].response
      return response
    }
  }

  throw fetchCache[key].fetch
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

const completeAssign = (target, ...sources) => {
  sources.forEach(source => {
    let descriptors = Object.keys(source).reduce((descriptors, key) => {
      descriptors[key] = Object.getOwnPropertyDescriptor(source, key)
      return descriptors
    }, {})

    // By default, Object.assign copies enumerable Symbols, too
    Object.getOwnPropertySymbols(source).forEach(sym => {
      let descriptor = Object.getOwnPropertyDescriptor(source, sym)
      if (descriptor.enumerable) {
        descriptors[sym] = descriptor
      }
    })
    Object.defineProperties(target, descriptors)
  })
}
