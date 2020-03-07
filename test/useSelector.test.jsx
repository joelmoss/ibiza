/* eslint-disable react/display-name */
import React, { useCallback, useContext } from 'react'
import * as rtl from '@testing-library/react'
import { renderHook, act } from '@testing-library/react-hooks'

import { createStore, Provider, useSelector, useReduxContext } from '../src'

describe('React', () => {
  describe('hooks', () => {
    describe('useSelector', () => {
      let store
      let renderedItems = []

      beforeEach(() => {
        store = createStore({
          count: 0,
          inc: state => {
            state.count = state.count + 1
          }
        })
        renderedItems = []
      })

      afterEach(() => rtl.cleanup())

      describe('core subscription behavior', () => {
        it('selects the state on initial render', () => {
          const { result } = renderHook(() => useSelector(s => s.count), {
            wrapper: props => <Provider {...props} store={store} />
          })

          expect(result.current).toEqual(0)
        })

        it('selects the state and renders the component when the store updates', () => {
          const { result } = renderHook(() => useSelector(s => s.count), {
            wrapper: props => <Provider {...props} store={store} />
          })

          expect(result.current).toEqual(0)

          act(() => {
            store.actions.inc()
          })

          expect(result.current).toEqual(1)
        })
      })

      describe('lifeycle interactions', () => {
        it('always uses the latest state', () => {
          store = createStore({
            inc: state => {
              state.count = state.count + 1
            },
            count: 0
          })

          const Comp = () => {
            const selector = useCallback(x => x.count + 1, [])
            const value = useSelector(selector)
            renderedItems.push(value)
            return <div />
          }

          rtl.render(
            <Provider store={store}>
              <Comp />
            </Provider>
          )

          expect(renderedItems).toEqual([1])

          store.actions.inc()

          expect(renderedItems).toEqual([1, 2])
        })

        it('subscribes to the store synchronously', () => {
          let rootSubscription

          const Parent = () => {
            const { subscription } = useReduxContext()
            rootSubscription = subscription
            const count = useSelector(s => s.count)
            return count === 1 ? <Child /> : null
          }

          const Child = () => {
            const count = useSelector(s => s.count)
            return <div>{count}</div>
          }

          rtl.render(
            <Provider store={store}>
              <Parent />
            </Provider>
          )

          expect(rootSubscription.listeners.get().length).toBe(1)

          store.actions.inc()

          expect(rootSubscription.listeners.get().length).toBe(2)
        })

        it('unsubscribes when the component is unmounted', () => {
          let rootSubscription

          const Parent = () => {
            const { subscription } = useReduxContext()
            rootSubscription = subscription
            const count = useSelector(s => s.count)
            return count === 0 ? <Child /> : null
          }

          const Child = () => {
            const count = useSelector(s => s.count)
            return <div>{count}</div>
          }

          rtl.render(
            <Provider store={store}>
              <Parent />
            </Provider>
          )

          expect(rootSubscription.listeners.get().length).toBe(2)

          store.actions.inc()

          expect(rootSubscription.listeners.get().length).toBe(1)
        })

        it('notices store updates between render and store subscription effect', () => {
          const Comp = () => {
            const count = useSelector(s => s.count)
            renderedItems.push(count)

            // I don't know a better way to trigger a store update before the
            // store subscription effect happens
            if (count === 0) {
              store.actions.inc()
            }

            return <div>{count}</div>
          }

          rtl.render(
            <Provider store={store}>
              <Comp />
            </Provider>
          )

          expect(renderedItems).toEqual([0, 1])
        })
      })
    })
  })
})
