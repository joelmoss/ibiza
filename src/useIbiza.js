import { isPlainObject } from 'lodash'
import { useCallback, useMemo, useReducer, useRef } from 'react'

import store from './store'

// Initial state is the state used during the initial render. In subsequent renders, it is
// disregarded. So it should not be dynamic.
export default (initialStateOrSelector = {}, debugName = false) => {
  const debugRef = useRef(debugName && (debugName === true ? '[Ibiza]' : `[Ibiza #${debugName}]`))

  // debugRef.current && console.log('%s Rendering', debugRef.current)

  const [, forceRender] = useReducer(s => s + 1, 0)
  const initialStateOrSelectorRef = useRef(initialStateOrSelector)
  const usedPathsRef = useRef([])

  // get trap
  const onGet = useCallback(({ target, prop, receiver }) => {
    let path = target.__path
    path = path === null ? prop : [path, prop].join('.')

    let debugged = false
    if (!usedPathsRef.current.includes(path)) {
      if (debugRef.current) {
        debugged = true
        console.groupCollapsed('%s Watching: %o', debugRef.current, path)
      }

      usedPathsRef.current.push(path)
    }

    if (debugged) {
      console.log({ usedPaths: usedPathsRef.current, target, receiver })
      console.groupEnd()
    }
  }, [])

  // set trap
  const onSet = useCallback(({ prop, target, path, previousValue, value, isChanged }) => {
    if (debugRef.current) {
      console.groupCollapsed('%s set %o at %o to %o', debugRef.current, prop, path || '.', value)
      console.log({
        usedPaths: usedPathsRef.current,
        previousValue,
        value,
        isChanged
      })
      console.groupEnd()
    }

    if (usedPathsRef.current.includes(path)) {
      forceRender()
    } else {
      // Check ancestors
      const paths = path.split('.')
      usedPathsRef.current.some(p => paths.includes(p)) && forceRender()
    }
  }, [])

  // Listen for changes. Listeners are Set's, so they will always be unique - no need to de-dupe!
  store.listenOnSet(onSet)

  if (isPlainObject(initialStateOrSelectorRef.current)) {
    if (debugRef.current) {
      console.groupCollapsed('%s Merging initial state', debugRef.current)
      console.log(initialStateOrSelectorRef.current)
      console.groupEnd()
    }

    store.merge(initialStateOrSelectorRef.current)
    initialStateOrSelectorRef.current = null
  }

  // We need to return a hook specific version of the store state, so that when the proxy get
  // trap is called, it can record usage of the trapped property, but on the hook. If we don't make
  // it specific to the hook, then all hooks will be subscribed the the trapped property's changes.
  // Only components that actually read a state property should cause the hook to listen for changes
  // on that property.
  //
  // So we create a wrapper proxy that defines the 'get' trap. It then proxies the get call with the
  // onGet callback in the receiver.
  const proxy = useMemo(() => {
    const handler = {
      get: function (target, prop, receiver) {
        if (prop === 'isProxy') return true

        debugRef.current && console.debug('%s preGet %o', debugRef.current, prop)

        // Ignore any symbols and non-own properties.
        // if (typeof prop === 'symbol' || !target.hasOwnProperty(prop)) {
        if (typeof prop === 'symbol') return Reflect.get(...arguments)

        // Call `get` on the actual store state.
        const result = Reflect.get(target, prop, { receiver, onGet })

        // debugRef.current && console.log(prop, result)

        return typeof result !== 'undefined' && result !== null && result.isProxy
          ? new Proxy(result, handler)
          : result
      }
    }
    return new Proxy(store.state, handler)
  }, [onGet])

  debugRef.current && console.debug('%s Store', debugRef.current, proxy)

  return proxy
}
