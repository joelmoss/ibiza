import { useMemo, useRef, useReducer, useEffect, useDebugValue } from 'react'
import Subscription from 'react-redux/es/utils/Subscription'
import { useIsomorphicLayoutEffect } from 'react-redux/es/utils/useIsomorphicLayoutEffect'

import { useReduxContext } from './useReduxContext'
import { createProxy, hasStateChanged } from './stateProxy'

// convert "affected" (WeakMap) to serializable value (array of array of string)
const affectedToPathList = (state, affected) => {
  const list = []
  const walk = (obj, path) => {
    const used = affected.get(obj)
    if (used) {
      used.forEach(key => {
        walk(obj[key], path ? [...path, key] : [key])
      })
    } else if (path) {
      list.push(path)
    }
  }
  walk(state)
  return list
}

const useAffectedDebugValue = (state, affected) => {
  const pathList = useRef(null)
  useEffect(() => {
    pathList.current = affectedToPathList(state, affected)
  })
  useDebugValue(pathList)
}

export const useIbiza = () => {
  const { store, subscription: contextSub } = useReduxContext()
  const [, forceRender] = useReducer(s => s + 1, 0)

  const subscription = useMemo(() => new Subscription(store, contextSub), [store, contextSub])

  const state = store.getState()
  const latestTracked = useRef(null)
  const accessed = new WeakMap()

  useIsomorphicLayoutEffect(() => {
    latestTracked.current = { state, accessed }
  })

  useIsomorphicLayoutEffect(() => {
    function checkForUpdates() {
      const nextState = store.getState()

      if (
        latestTracked.current.state !== nextState &&
        hasStateChanged(
          latestTracked.current.state,
          nextState,
          latestTracked.current.accessed,
          latestTracked.current.cache
        )
      ) {
        forceRender()
      }
    }

    subscription.onStateChange = checkForUpdates
    subscription.trySubscribe()

    checkForUpdates()

    return () => subscription.tryUnsubscribe()
  }, [store, subscription])

  process.env.NODE_ENV !== 'production' && useAffectedDebugValue(state, accessed)

  const proxyCache = useRef(new WeakMap()) // per-hook proxyCache
  const proxy = createProxy(state, accessed, proxyCache.current)
  const { set } = store.actions

  return {
    state: proxy,
    actions: store.actions,
    set
  }
}
