/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import React from 'react'
import * as rtl from '@testing-library/react'
import { renderHook, act } from '@testing-library/react-hooks'

import { useReduxContext, createStore, Provider, useIbiza } from '../src'

describe('useIbiza', () => {
  let store
  let renderedItems = []

  beforeEach(() => {
    store = createStore({
      count: 0,
      noop: () => {},
      increment: state => {
        state.count = state.count + 1
      }
    })
    renderedItems = []
  })

  test('read state', () => {
    const { result } = renderHook(() => useIbiza(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    })

    expect(result.current.state).toEqual({ count: 0 })
  })

  test('call action', () => {
    const { result } = renderHook(() => useIbiza(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    })

    expect(result.current.state).toEqual({ count: 0 })

    act(() => {
      store.actions.increment()
    })

    expect(result.current.state).toEqual({ count: 1 })
  })

  test('call action without state change or re-render', () => {
    const Comp = () => {
      const value = useIbiza().state.count + 1
      renderedItems.push(value)
      return <div />
    }

    rtl.render(
      <Provider store={store}>
        <Comp />
      </Provider>
    )

    expect(renderedItems).toEqual([1])

    store.actions.noop()

    expect(renderedItems).toEqual([1])
  })

  describe('lifeycle interactions', () => {
    it('always uses the latest state', () => {
      const Comp = () => {
        const value = useIbiza().state.count + 1
        renderedItems.push(value)
        return <div />
      }

      rtl.render(
        <Provider store={store}>
          <Comp />
        </Provider>
      )

      expect(renderedItems).toEqual([1])

      store.actions.increment()

      expect(renderedItems).toEqual([1, 2])
    })

    it('subscribes to the store synchronously', () => {
      let rootSubscription

      const Parent = () => {
        const { subscription } = useReduxContext()
        rootSubscription = subscription
        const count = useIbiza().state.count
        return count === 1 ? <Child /> : null
      }

      const Child = () => {
        const count = useIbiza().state.count
        return <div>{count}</div>
      }

      rtl.render(
        <Provider store={store}>
          <Parent />
        </Provider>
      )

      expect(rootSubscription.listeners.get().length).toBe(1)

      store.actions.increment()

      expect(rootSubscription.listeners.get().length).toBe(2)
    })

    it('unsubscribes when the component is unmounted', () => {
      let rootSubscription

      const Parent = () => {
        const { subscription } = useReduxContext()
        rootSubscription = subscription
        const count = useIbiza().state.count
        return count === 0 ? <Child /> : null
      }

      const Child = () => {
        const count = useIbiza().state.count
        return <div>{count}</div>
      }

      rtl.render(
        <Provider store={store}>
          <Parent />
        </Provider>
      )

      expect(rootSubscription.listeners.get().length).toBe(2)

      store.actions.increment()

      expect(rootSubscription.listeners.get().length).toBe(1)
    })

    it('notices store updates between render and store subscription effect', () => {
      const Comp = () => {
        const {
          state: { count },
          actions
        } = useIbiza()
        renderedItems.push(count)

        // I don't know a better way to trigger a store update before the
        // store subscription effect happens
        count === 0 && actions.increment()

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

  it('defaults to ref-equality to prevent unnecessary updates', () => {
    const state = {}
    store = createStore({ obj: state })

    const Comp = () => {
      const value = useIbiza().state
      renderedItems.push(value)
      return <div />
    }

    rtl.render(
      <Provider store={store}>
        <Comp />
      </Provider>
    )

    expect(renderedItems.length).toBe(1)

    store.dispatch({ type: '' })

    expect(renderedItems.length).toBe(1)
  })

  it('only re-render used prop is changed', () => {
    store = createStore({
      count1: 0,
      count2: 9,
      increment: s => {
        s.count1 = s.count1 + 1
      }
    })

    const Comp1 = () => {
      const value = useIbiza().state.count1
      renderedItems.push(value)
      return <div />
    }

    const Comp2 = () => {
      const value = useIbiza().state.count2
      renderedItems.push(value)
      return <div />
    }

    rtl.render(
      <Provider store={store}>
        <Comp1 />
        <Comp2 />
      </Provider>
    )

    expect(renderedItems).toEqual([0, 9])

    store.actions.increment()

    expect(renderedItems).toEqual([0, 9, 1])
  })

  test.skip('update?', () => {
    const Count = () => {
      const { count } = useIbiza()

      return <div data-testid="count">Count: {count}</div>
    }

    const App = () => {
      return (
        <Provider store={store}>
          <Count />
        </Provider>
      )
    }

    const { getByTestId } = render(<App />)

    expect(getByTestId('count')).toHaveTextContent('Count: 0')
  })
})
