/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import React, { useCallback } from 'react'
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

  it('reads state', () => {
    const App = () => {
      const { state } = useIbiza()
      return <div data-testid="count">{state.count}</div>
    }

    const { getByTestId } = rtl.render(
      <Provider store={store}>
        <App />
      </Provider>
    )

    expect(getByTestId('count')).toHaveTextContent(0)
  })

  it('re-renders on shallow state change from an action', () => {
    const App = () => {
      const { state, actions } = useIbiza()
      renderedItems.push(state.count)

      return (
        <>
          <div data-testid="count">{state.count}</div>
          <button onClick={actions.increment}>increment</button>
        </>
      )
    }

    const { getByTestId, getByRole } = rtl.render(
      <Provider store={store}>
        <App />
      </Provider>
    )

    expect(renderedItems).toEqual([0])

    rtl.fireEvent.click(getByRole('button'))

    expect(renderedItems).toEqual([0, 1])
    expect(getByTestId('count')).toHaveTextContent(1)
  })

  it('re-renders on nested state change from an action', () => {
    store = createStore({
      nested: {
        count: 0
      },
      increment: s => {
        s.nested.count = s.nested.count + 1
      }
    })

    const App = () => {
      const { state } = useIbiza()
      renderedItems.push(state.nested.count)
      return <div />
    }

    rtl.render(
      <Provider store={store}>
        <App />
      </Provider>
    )

    expect(renderedItems).toEqual([0])

    store.actions.increment()

    expect(renderedItems).toEqual([0, 1])
  })

  it('does not re-render on change of unused state in an action', () => {
    store = createStore({
      usedCount: 10,
      unusedCount: 20,
      nested: {
        count: 1
      },
      incrementUnusedCount: s => {
        s.unusedCount = s.unusedCount + 1
      }
    })

    const App = () => {
      const { state } = useIbiza()
      renderedItems.push(state.usedCount)

      return <div />
    }

    rtl.render(
      <Provider store={store}>
        <App />
      </Provider>
    )

    expect(renderedItems).toEqual([10])

    store.actions.incrementUnusedCount()

    expect(renderedItems).toEqual([10])
  })

  it('does not re-render on action with no state change', () => {
    const App = () => {
      const { state } = useIbiza()
      renderedItems.push(state.count)

      return <div />
    }

    rtl.render(
      <Provider store={store}>
        <App />
      </Provider>
    )

    expect(renderedItems).toEqual([0])

    store.actions.noop()

    expect(renderedItems).toEqual([0])
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

  it('only re-renders when used prop is changed', () => {
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

  test.skip('variable state setting', () => {
    const Count = () => {
      const { state } = useIbiza()
      renderedItems.push(state.count)
      const onClick = useCallback(() => {
        state.count = state.count + 1
      }, [state])

      return (
        <>
          <button onClick={onClick}>Increment</button>
        </>
      )
    }

    const App = () => {
      return (
        <Provider store={store}>
          <Count />
        </Provider>
      )
    }

    const { getByRole } = rtl.render(<App />)

    expect(renderedItems).toEqual([0])

    rtl.fireEvent.click(getByRole('button'))

    console.log(store.getState())

    expect(renderedItems).toEqual([0, 1])
  })
})
