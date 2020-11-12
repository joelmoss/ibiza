/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import React from 'react'
import ReactDOM from 'react-dom'
import { render, act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderHook, act as hookAct } from '@testing-library/react-hooks'
import { perf, wait } from 'react-performance-testing'

import { useIbiza, reset, unwrap, getState } from '../src'

let renderedItems = []
const resolveAfter = (data, ms) => new Promise(resolve => setTimeout(() => resolve(data), ms))

beforeEach(() => {
  reset()
  renderedItems = []
})

it('can get the store', () => {
  expect(getState()).toEqual({})
})

it.todo('can set the store')
// () => {
//   setState({ count: 1 })
//   expect(getState()).toEqual({ count: 1 })
//   setState({ count: 2 })
//   expect(getState()).toEqual({ count: 2 })
// }

it.todo('re-renders on setState')
// () => {
//   const App = () => {
//     const state = useIbiza({ count: 0 })
//     renderedItems.push(state.count)
//     return <div>{state.count}</div>
//   }

//   render(<App />)

//   expect(renderedItems).toEqual([0])

//   // fireEvent.click(screen.getByRole('button'))
//   act(() => setState({ count: 1 }))

//   expect(renderedItems).toEqual([0, 1])
// }

it('returns empty state proxy with no arguments', () => {
  const { result } = renderHook(() => useIbiza())

  expect(result.current).toEqual({})
  expect(result.current.isProxy).toBe(true)
})

it('uses non-string argument as initial state', () => {
  const { result } = renderHook(() => useIbiza({ count: 0 }))

  expect(result.current).toEqual({ count: 0 })
})

it('can use a slice of the state', () => {
  renderHook(() => useIbiza({ my: { count: 0 }, even: { more: { count: 1 } } }))

  const hook1 = renderHook(() => useIbiza('my'))
  expect(hook1.result.current).toEqual({ count: 0 })

  const hook2 = renderHook(() => useIbiza('even.more'))
  expect(hook2.result.current).toEqual({ count: 1 })
})

it('merges initial state recursively by key/path', () => {
  renderHook(() => useIbiza({ count1: 0, count2: 0 }))
  const { result } = renderHook(() => useIbiza({ count2: 1, 'user.name': 'Joel' }))

  expect(result.current).toEqual({ count1: 0, count2: 1, user: { name: 'Joel' } })
})

it('reads nested state', () => {
  const { result } = renderHook(() => useIbiza({ nested: { count: 0 } }))

  expect(result.current).toEqual({ nested: { count: 0 } })
})

it('reads null props', () => {
  const App = () => {
    const state = useIbiza({ prop: null })
    renderedItems.push(state.prop)
    return <div />
  }

  render(<App />)

  expect(renderedItems).toEqual([null])
})

it('sets state', () => {
  const { result } = renderHook(() => useIbiza({ count: 0 }))

  hookAct(() => {
    result.current.count += 1
    result.current.user = { name: 'Joel' }
  })

  expect(result.current).toEqual({ count: 1, user: { name: 'Joel' } })
})

it('can set nested state', () => {
  const { result } = renderHook(() => useIbiza())

  hookAct(() => {
    result.current.nested = { count: 1 }
  })

  expect(result.current).toEqual({ nested: { count: 1 } })
})

it('can change state in functions', () => {
  const { result } = renderHook(() =>
    useIbiza({
      count: 0,
      increment(state) {
        state.count++
      }
    })
  )

  hookAct(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(1)
})

it('functions accept a payload', () => {
  const { result } = renderHook(() =>
    useIbiza({
      count: 0,
      incrementBy(state, payload) {
        state.count = state.count + payload
      }
    })
  )

  hookAct(() => {
    result.current.incrementBy(3)
  })

  expect(result.current.count).toBe(3)
})

it('should not re-render when using state in a function', () => {
  const App = () => {
    const { increment } = useIbiza({
      count: 0,
      increment: state => {
        state.count++
      }
    })

    renderedItems.push(0)
    return <button onClick={() => increment()} />
  }

  render(<App />)

  expect(renderedItems).toEqual([0])

  fireEvent.click(screen.getByRole('button'))

  expect(renderedItems).toEqual([0])
})

it('functions can call other functions', () => {
  const { result } = renderHook(() =>
    useIbiza({
      count: 0,
      incrementBy(state, payload) {
        state.count = state.count + payload
      },
      increment(state) {
        state.incrementBy(3)
      }
    })
  )

  hookAct(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(3)
})

describe('async functions', () => {
  test('async functions can change state before and after the async call', async () => {
    const model = {
      count: 0,
      increment: async state => {
        state.count++
        await resolveAfter({}, 15)
        state.count++
      }
    }
    const App = () => {
      const { count, increment } = useIbiza(model)
      renderedItems.push(count)
      return <button onClick={increment} />
    }

    render(<App />)

    expect(renderedItems).toEqual([0])

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(renderedItems).toEqual([0, 1, 2]))
  })

  test('nested async function', async () => {
    const model = {
      count: 0,
      nested: {
        increment: async state => {
          state.count++
          await resolveAfter({}, 15)
          state.count++
        }
      }
    }
    const App = () => {
      const { count, nested } = useIbiza(model)
      renderedItems.push(count)
      return <button onClick={nested.increment} />
    }

    render(<App />)

    expect(renderedItems).toEqual([0])

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(renderedItems).toEqual([0, 1, 2]))
  })
})

it('re-renders on changed used state', () => {
  const App = () => {
    const state = useIbiza({ count: 0 })
    renderedItems.push(state.count)
    return <button onClick={() => (state.count += 1)} />
  }

  render(<App />)

  expect(renderedItems).toEqual([0])

  fireEvent.click(screen.getByRole('button'))

  expect(renderedItems).toEqual([0, 1])
})

it('re-renders on changed array state', async () => {
  const App = () => {
    const state = useIbiza({ items: [1] })
    renderedItems.push(unwrap(state.items).slice())
    return <button onClick={() => state.items.push(2)} />
  }

  render(<App />)

  expect(renderedItems).toEqual([[1]])

  fireEvent.click(screen.getByRole('button'))

  expect(renderedItems).toEqual([[1], [1, 2]])
})

it('does not re-render on changed un-used state', async () => {
  const App = () => {
    const state = useIbiza({ count: 0 })

    return (
      <>
        <p>Count is {state.count}</p>
        <button onClick={() => (state.name = 'Joel')} />
      </>
    )
  }

  const { renderCount } = perf(React)
  render(<App />)

  fireEvent.click(screen.getByRole('button'))

  await wait(() => expect(renderCount.current.App.value).toBe(1))
})

it('does not re-render on changed un-used state; multiple components', () => {
  const App = () => {
    useIbiza({ count1: 0, count2: 0 })

    return (
      <>
        <Child1 />
        <Child2 />
      </>
    )
  }

  const Child1 = () => {
    const state = useIbiza(null)
    return <button onClick={() => (state.count1 += 1)} />
  }

  const Child2 = () => {
    const state = useIbiza(null)
    renderedItems.push(state.count2)
    return <div />
  }

  render(<App />)

  expect(renderedItems).toEqual([0])

  fireEvent.click(screen.getByRole('button'))

  expect(renderedItems).toEqual([0])
})

it('re-renders used component from change in other', () => {
  const App = () => {
    useIbiza({ isValid: false })
    renderedItems.push(['app'])

    return (
      <>
        <Child1 />
        <Child2 />
      </>
    )
  }

  // State changed here
  const Child1 = () => {
    const state = useIbiza()
    renderedItems.push({ child1: unwrap(state).isValid })
    return <button onClick={() => (state.isValid = true)} />
  }

  // State used here
  const Child2 = () => {
    const state = useIbiza()
    renderedItems.push({ child2: state.isValid })
    return <div />
  }

  render(<App />)

  expect(renderedItems).toEqual([['app'], { child1: false }, { child2: false }])

  fireEvent.click(screen.getByRole('button'))

  expect(renderedItems).toEqual([['app'], { child1: false }, { child2: false }, { child2: true }])
})

it('can batch updates', async () => {
  function Counter() {
    const { count, inc } = useIbiza({
      count: 0,
      inc: state => void state.count++
    })
    React.useEffect(() => {
      ReactDOM.unstable_batchedUpdates(() => {
        inc()
        inc()
      })
    }, [inc])
    return <div>count: {count}</div>
  }

  render(<Counter />)

  await screen.findByText('count: 2')
})

it('ensures parent components subscribe before children', async () => {
  const Child = ({ id }) => {
    const children = useIbiza(`children`)
    return <div>{children[id].text}</div>
  }

  const Parent = () => {
    const state = useIbiza()
    const onClick = () => {
      state.children[3] = { text: 'child 3' }
    }

    return (
      <>
        <button onClick={onClick}>change state</button>
        {Object.keys(state.children).map(id => (
          <Child id={id} key={id} />
        ))}
      </>
    )
  }

  const App = () => {
    const state = useIbiza({
      children: {
        1: { text: 'child 1' },
        2: { text: 'child 2' }
      }
    })
    return <Parent />
  }

  render(<App />)

  fireEvent.click(screen.getByText('change state'))

  await screen.findByText('child 3')
})
