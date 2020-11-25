import { isPlainObject } from 'lodash'
import { useCallback, useMemo, useReducer, useRef } from 'react'

import { getByPath } from './path'
import store from './store'

// Accepts an initial state or slice, and returns a proxy of the state. Any initial state given
// (Object) is merged into the existing state. If a slice is given (String), then the returned state
// will be sliced by the given slice path.
//
// Initial state is the state used during the initial render. In subsequent renders, it is
// disregarded. So it should not be dynamic.
export default (initialStateOrSlice = {}, debugName) => {
  const debugRef = useRef(debugName || '')

  const [, forceRender] = useReducer(s => s + 1, 0)
  const usedPathsRef = useRef([])
  const slicePathRef = useRef()
  const initialStateOrSliceRef = useRef(initialStateOrSlice === null ? {} : initialStateOrSlice)

  const addUsedPath = useCallback((path, debugInfo) => {
    if (!usedPathsRef.current.includes(path)) {
      usedPathsRef.current.push(path)

      if (store.debug) {
        console.groupCollapsed('[Ibiza] %s Watching: %o', debugRef.current, path)
        console.info({
          usedPaths: usedPathsRef.current,
          ...debugInfo
        })
        console.groupEnd()
      }
    }
  }, [])

  // Proxy get trap
  const onGet = useCallback(
    ({ target, prop, receiver }) => {
      let path = target.__path
      path = typeof path === 'undefined' || path === null ? prop : [path, prop].join('.')
      addUsedPath(path, { target, receiver })
    },
    [addUsedPath]
  )

  // Proxy set trap
  const onSet = useCallback(({ prop, target, path, previousValue, value, isChanged }) => {
    if (usedPathsRef.current.length === 0) return

    const rerender = () => {
      if (store.debug) {
        console.groupCollapsed(
          '[Ibiza] %s Rerendering after mutation of %o to %o',
          debugRef.current,
          path || '.',
          value
        )
        console.log({
          prop,
          target,
          usedPaths: usedPathsRef.current,
          previousValue,
          value,
          isChanged
        })
        console.groupEnd()
      }

      forceRender()
    }

    if (usedPathsRef.current.includes(path)) {
      rerender()
    } else {
      const propPaths = path.split('.')

      // Check ancestors
      usedPathsRef.current.some(p => p.startsWith(path) || propPaths.includes(p)) && rerender()
    }
  }, [])

  // We need to return a hook specific version of the store state, so that when the proxy get
  // trap is called, it can record usage of the trapped property, but on the hook. If we don't make
  // it specific to the hook, then all hooks will be subscribed to the trapped property's changes.
  // Only components that actually read a state property should cause the hook to listen for changes
  // on that property.
  //
  // So we create a wrapper proxy that defines the 'get' trap. It then proxies the get call with the
  // onGet callback in the receiver.
  const proxy = useMemo(() => {
    let objToProxy

    if (isPlainObject(initialStateOrSliceRef.current)) {
      // Merge initial state into existing store.
      store.merge(initialStateOrSliceRef.current, debugRef.current)
    } else if (typeof initialStateOrSliceRef.current === 'string') {
      // We have a request for a slice of the state. Slices can be a dot seperated path to the
      // property you want (eg. 'my.slice.of.state'), or a relative URL (eg. '/users/1').
      slicePathRef.current = initialStateOrSliceRef.current
    }

    // Intercepts the 'get' of top level properties only, passing the `onGet` callback to the actual
    // store proxy. Javascript Proxies start from the top level down through the object's
    // descendents, so there is no need for this to intercept every level of the object. It would be
    // nice to optimise this so that only the prop requested is watched. But that is not possible,
    // so this means that mutations to descendant properties will cause a re-render. This can be
    // countered by slicing the state as further down as possible.
    const handler = {
      get: function (target, prop, receiver) {
        if (prop === 'isProxy') return true

        // Get the actual store state, and pass the `onGet` callback so we can intercept get
        // operations in this hook instance.
        return Reflect.get(target, prop, { receiver, onGet })
      }
    }

    // return new Proxy(objToProxy || store.state, handler)
    return new Proxy(store.state, handler)
  }, [onGet])

  // Listen for changes. Listeners are Set's, so they will always be unique - no need to de-dupe!
  store.listenOnSet(onSet)

  if (slicePathRef.current) {
    if (slicePathRef.current.indexOf('/') === 0) {
      return proxy[slicePathRef.current]
    } else {
      return getByPath(proxy, slicePathRef.current)
    }
  }

  return proxy
}
