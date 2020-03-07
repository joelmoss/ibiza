import { useContext } from 'react'
import { ReactReduxContext } from 'react-redux'
import { useReduxContext as useDefaultReduxContext } from './useReduxContext'

/**
 * Hook factory, which creates a `useActions` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useActions` hook bound to the specified context.
 */
export function createActionsHook(context = ReactReduxContext) {
  const useReduxContext =
    context === ReactReduxContext ? useDefaultReduxContext : () => useContext(context)
  return function useActions() {
    const { store } = useReduxContext()
    return store.actions
  }
}

/**
 * A hook to access the redux store.
 *
 * @returns {any} the redux store
 *
 * @example
 *
 * import React from 'react'
 * import { useStore } from 'react-redux'
 *
 * export const ExampleComponent = () => {
 *   const { increment } = useActions()
 *   return <button onClick={increment}>Click me!</button>
 * }
 */
export const useActions = /*#__PURE__*/ createActionsHook()
