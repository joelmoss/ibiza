import { useMemo, useRef, useReducer, useDebugValue } from 'react'
import Subscription from 'react-redux/es/utils/Subscription'
import { useIsomorphicLayoutEffect } from 'react-redux/es/utils/useIsomorphicLayoutEffect'

import { useReduxContext } from './useReduxContext'
import { createProxy, hasStateChanged } from './stateProxy'

const GET_ORIGINAL_SYMBOL = Symbol()
const ORIGINAL_OBJECT_PROPERTY = 'o'

const isBuiltinWithoutMutableMethods = value => value instanceof RegExp || value instanceof Number
const isPrimitive = value => {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}

export const useIbiza = () => {
  const { store, subscription: contextSub } = useReduxContext()
  const [, forceRender] = useReducer(s => s + 1, 0)

  const subscription = useMemo(() => new Subscription(store, contextSub), [store, contextSub])

  const state = store.getState()
  const latestTracked = useRef(null)

  const mutated = new WeakMap()
  const accessed = new WeakMap()

  useIsomorphicLayoutEffect(() => {
    latestTracked.current = {
      state,
      mutated,
      accessed
    }
  })

  useIsomorphicLayoutEffect(() => {
    function checkForUpdates(initial = false) {
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

    checkForUpdates(true)

    return () => subscription.tryUnsubscribe()
  }, [store, subscription])

  const proxyCache = useRef(new WeakMap()) // per-hook proxyCache
  const proxy = createProxy(state, accessed, proxyCache.current)

  return { state: proxy, actions: store.actions }
}
