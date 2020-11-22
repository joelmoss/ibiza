import { get, isPlainObject } from 'lodash'
import { useCallback, useMemo, useReducer, useRef } from 'react'

import { getByPath } from './path'
import store from './store'

// Initial state is the state used during the initial render. In subsequent renders, it is
// disregarded. So it should not be dynamic.
export default (initialStateOrSlice = {}, debugName = false) => {
  const debugRef = useRef(debugName && (debugName === true ? '[Ibiza]' : `[Ibiza #${debugName}]`))

  // debugRef.current && console.log('%s Rendering', debugRef.current)

  const [, forceRender] = useReducer(s => s + 1, 0)
  const usedPathsRef = useRef([])
  const slicePathRef = useRef()
  const initialStateOrSliceRef = useRef(initialStateOrSlice === null ? {} : initialStateOrSlice)

  const addUsedPath = useCallback((path, debugInfo) => {
    if (!usedPathsRef.current.includes(path)) {
      debugRef.current && console.log('%s Watching: %o', debugRef.current, path)

      usedPathsRef.current.push(path)
    }
  }, [])

  // Proxy get trap
  const onGet = useCallback(
    ({ target, prop, receiver }) => {
      let path = target.__path
      path = path === null ? prop : [path, prop].join('.')
      addUsedPath(path, { target, receiver })
    },
    [addUsedPath]
  )

  // Proxy set trap
  const onSet = useCallback(({ prop, target, path, previousValue, value, isChanged }) => {
    const rerender = () => {
      if (debugRef.current) {
        console.groupCollapsed(
          '%s Rerendering after mutation of %o to %o',
          debugRef.current,
          path || '.',
          value
        )
        console.log({
          prop,
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
      // Check ancestors
      const paths = path.split('.')
      usedPathsRef.current.some(p => paths.includes(p)) && rerender()
    }
  }, [])

  // We need to return a hook specific version of the store state, so that when the proxy get
  // trap is called, it can record usage of the trapped property, but on the hook. If we don't make
  // it specific to the hook, then all hooks will be subscribed the the trapped property's changes.
  // Only components that actually read a state property should cause the hook to listen for changes
  // on that property.
  //
  // So we create a wrapper proxy that defines the 'get' trap. It then proxies the get call with the
  // onGet callback in the receiver.
  const proxy = useMemo(() => {
    let objToProxy

    if (initialStateOrSliceRef.current !== null) {
      if (isPlainObject(initialStateOrSliceRef.current)) {
        if (debugRef.current) {
          console.groupCollapsed('%s Merging initial state', debugRef.current)
          console.log(initialStateOrSliceRef.current)
          console.groupEnd()
        }

        // We have initial state, so merge it into existing store.
        store.merge(initialStateOrSliceRef.current)
      } else if (typeof initialStateOrSliceRef.current === 'string') {
        // We have a request for a slice of the state. Slices can be a dot seperated path to the
        // property you want (eg. 'my.slice.of.state'), or a relative URL (eg. '/users/1').
        if (initialStateOrSliceRef.current.indexOf('/') === 0) {
          // TODO: URL
        } else {
          // const slicePath = initialStateOrSliceRef.current.split('.')
          // const sliceProp = slicePath[slicePath.length - 1]
          // const sliceParentPath = slicePath.slice(0, -1)

          // Find the property at the given path. This does so without actually calling the
          // property, which needs to happen to avoid the get trap and getters being called until
          // actually needed.
          // slice = getByPath(store.state, initialStateOrSliceRef.current)

          debugRef.current &&
            console.log('%s Slice %o', debugRef.current, initialStateOrSliceRef.current)

          // Manually add the slice object path to `usedPaths`.
          addUsedPath(initialStateOrSliceRef.current)

          slicePathRef.current = initialStateOrSliceRef.current
          objToProxy = getByPath(store.state, initialStateOrSliceRef.current)
        }
      }
    }

    initialStateOrSliceRef.current = null

    const handler = {
      get: function (target, prop, receiver) {
        if (prop === 'isProxy') return true

        // Ignore any symbols.
        if (typeof prop === 'symbol') return Reflect.get(...arguments)

        // TODO: Ignore any non-own properties while allowing undefined properties. This will
        // currently ignore both :(
        // console.debug(prop, target.__proto__[prop])
        if (!target.hasOwnProperty(prop) && target.__proto__[prop]) {
          return Reflect.get(...arguments)
        }

        debugRef.current &&
          console.debug('%s preGet %o', debugRef.current, {
            prop,
            target,
            slice: slicePathRef.current
          })

        // Call `get` on the actual store state.
        return Reflect.get(target, prop, { receiver, onGet })
      }
    }

    return new Proxy(objToProxy || store.state, handler)
  }, [addUsedPath, onGet])

  // Listen for changes. Listeners are Set's, so they will always be unique - no need to de-dupe!
  store.listenOnSet(onSet)

  debugRef.current && console.debug('%s Store', debugRef.current, proxy)

  return proxy
}
