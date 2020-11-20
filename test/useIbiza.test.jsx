/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import React, { Suspense, useCallback, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { render, act, fireEvent, screen, waitFor, getByText } from '@testing-library/react'
import { renderHook, act as hookAct } from '@testing-library/react-hooks'
import { perf, wait } from 'react-performance-testing'
import { merge, mergeWith } from 'lodash'

import { useIbiza, store } from '../src'

const resolveAfter = (data, ms) => new Promise(resolve => setTimeout(() => resolve(data), ms))

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return {
      hasError: true
    }
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

afterEach(() => {
  store.reset()
})

it('returns empty state proxy with no arguments', () => {
  const { result } = renderHook(() => useIbiza())

  expect(result.current).toEqual({})
  expect(result.current.isProxy).toBe(true)
})

it('returns state proxy', () => {
  const { result } = renderHook(() => useIbiza({ count: 0 }))

  expect(result.current).toEqual({ count: 0 })
  expect(result.current.isProxy).toBe(true)
})

it('merges initial state', () => {
  const { result } = renderHook(() => {
    useIbiza({
      count: 0,
      children: [{ name: { firstName: 'Ash', lastName: 'Moss' } }],
      name: { firstName: 'Joel', lastName: 'Moss' },
      get foo() {
        return 'bar'
      }
    })
    return useIbiza({ count1: 0, name: { firstName: 'Ash' }, children: [] })
  })

  expect(result.current).toMatchSnapshot()
})

it('renders', () => {
  const App = () => {
    const state = useIbiza({ count: 0 })
    return <h1>Count is {state.count}</h1>
  }

  render(<App />)

  screen.getByText('Count is 0')
})

it('handles null/undefined props', () => {
  const App = () => {
    const state = useIbiza({ firstName: null })
    return (
      <h1>
        Name is [firstName:{state.firstName}] [lastName:{state.lastName}]
      </h1>
    )
  }

  render(<App />)

  screen.getByText('Name is [firstName:] [lastName:]')
})

it('null/undefined props should be watched, and mutations cause a re-render', async () => {
  const App = () => {
    const state = useIbiza()
    return <h1>Count is [{state.count}]</h1>
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Count is []')

  act(() => {
    store.state.count = 1
  })

  await screen.findByText('Count is [1]')
  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

it('sets state', () => {
  const { result } = renderHook(() => useIbiza({ count: 0 }))

  hookAct(() => {
    ++result.current.count
    result.current.user = { name: 'Joel' }
  })

  expect(result.current).toEqual({ count: 1, user: { name: 'Joel' } })
})

it('can set nested state', () => {
  const { result } = renderHook(() => useIbiza({ count: 0 }))

  hookAct(() => {
    result.current.nested = { count: 1 }
  })

  expect(result.current).toEqual({ count: 0, nested: { count: 1 } })
})

it('re-renders on changed used state', async () => {
  const App = () => {
    const state = useIbiza({ count: 0 })
    return <h1>Count is [{state.count}]</h1>
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Count is [0]')

  act(() => {
    store.state.count = 1
  })

  await screen.findByText('Count is [1]')
  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

it('re-renders on changed used array state', async () => {
  const App = () => {
    const state = useIbiza({ items: [1] })
    return (
      <ul>
        {state.items.map(item => (
          <li key={item}>Item#{item}</li>
        ))}
      </ul>
    )
  }

  const { renderCount } = perf(React)
  render(<App />)

  expect(store.state).toEqual({ items: [1] })
  screen.getByText('Item#1')

  act(() => {
    store.state.items.push(2)
  })

  expect(store.state).toEqual({ items: [1, 2] })
  screen.getByText('Item#1')
  screen.getByText('Item#2')

  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

it('does not re-render on changed unused state', async () => {
  const App = () => {
    const state = useIbiza({ count: 0 })
    return <button onClick={() => (state.count = 1)} />
  }

  const { renderCount } = perf(React)
  render(<App />)

  expect(renderCount.current.App.value).toBe(0)

  fireEvent.click(screen.getByRole('button'))

  expect(store.state).toEqual({ count: 1 })
  await wait(() => expect(renderCount.current.App.value).toBe(1))
})

it('does not re-render on changed unused state outside component', async () => {
  const App = () => {
    const state = useIbiza({ count: 0 })
    return <button onClick={() => (state.count = 1)} />
  }

  const { renderCount } = perf(React)
  render(<App />)

  expect(renderCount.current.App.value).toBe(0)

  act(() => {
    store.state.count = 1
  })

  expect(store.state).toEqual({ count: 1 })
  await wait(() => expect(renderCount.current.App.value).toBe(1))
})

it('does not re-render on changed un-used state; multiple components', async () => {
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
    const state = useIbiza()
    return <h2>Child1.count1 is [{state.count1}]</h2>
  }

  const Child2 = () => {
    const state = useIbiza()
    return <h2>Child2.count2 is [{state.count2}]</h2>
  }

  const { renderCount } = perf(React)
  render(<App />)

  act(() => {
    store.state.count2 = 1
  })

  await wait(() => {
    expect(renderCount.current.App.value).toBe(1)
    expect(renderCount.current.Child1.value).toBe(1)
    expect(renderCount.current.Child2.value).toBe(2)
  })
})

it.skip('can batch updates', async () => {
  function Counter() {
    const state = useIbiza({
      count: 0,
      inc: state => void (state.count = 1)
    })
    React.useEffect(() => {
      ReactDOM.unstable_batchedUpdates(() => {
        state.inc()
        state.inc()
      })
    }, [state])
    return <div>count: {state.count}</div>
  }

  render(<Counter />)

  await screen.findByText('count: 2')
})

it('ensures parent components subscribe before children', async () => {
  const Child = ({ id }) => {
    const { children } = useIbiza()
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

test('getter', async () => {
  const App = () => {
    const state = useIbiza({
      firstName: 'Joel',
      get name() {
        return `${this.firstName} Moss`
      }
    })

    return <h1>Name is {state.name}</h1>
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Name is Joel Moss')

  act(() => {
    store.state.firstName = 'Ash'
  })

  await screen.findByText('Name is Ash Moss')
  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

it('tracks changes in destructured state', async () => {
  const App = () => {
    const { posts } = useIbiza({
      posts: {
        count: 0
      }
    })
    return (
      <>
        <h1>Count is: {posts.count}</h1>
        <button onClick={() => void (posts.count = 1)}>Increment</button>
      </>
    )
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Count is: 0')

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('Count is: 1')
  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

it('tracks changes in value from destructured state', async () => {
  const App = () => {
    const { count, increment } = useIbiza({
      count: 0,
      increment: state => {
        ++state.count
      }
    })
    return (
      <>
        <h1>Count is: {count}</h1>
        <button onClick={() => increment()}>Increment</button>
      </>
    )
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Count is: 0')

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('Count is: 1')
  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

describe('functions (actions)', () => {
  test('functions can set state', async () => {
    const App = () => {
      const state = useIbiza({
        count: 1,
        increment: state => {
          ++state.count
        },
        decrement: function () {
          --this.count
        }
      })
      return <h1>Count is [{state.count}]</h1>
    }

    const { renderCount } = perf(React)
    render(<App />)

    screen.getByText('Count is [1]')

    act(() => {
      store.state.increment()
    })

    await screen.findByText('Count is [2]')

    act(() => {
      store.state.decrement()
    })

    await screen.findByText('Count is [1]')
    await wait(() => expect(renderCount.current.App.value).toBe(3))
  })

  test('nested functions set global state', async () => {
    const App = () => {
      const state = useIbiza({
        count: 1,
        nested: {
          increment: state => {
            ++state.count
          },
          decrement: function () {
            --this.count
          }
        }
      })
      return <h1>Count is [{state.count}]</h1>
    }

    const { renderCount } = perf(React)
    render(<App />)

    screen.getByText('Count is [1]')

    act(() => {
      store.state.nested.increment()
    })

    await screen.findByText('Count is [2]')

    act(() => {
      store.state.nested.decrement()
    })

    await screen.findByText('Count is [1]')
    await wait(() => expect(renderCount.current.App.value).toBe(3))
  })

  it('should not re-render when using state in a function', async () => {
    const App = () => {
      const { increment } = useIbiza({
        count: 0,
        increment: function (state) {
          return this.count + state.count
        }
      })

      return <h1>Hello</h1>
    }

    const { renderCount } = perf(React)
    render(<App />)

    act(() => {
      store.state.increment()
    })

    await wait(() => expect(renderCount.current.App.value).toBe(1))
  })

  it('functions accept a payload', () => {
    const { result } = renderHook(() =>
      useIbiza({
        count: 0,
        incrementBy(state, payload) {
          state.count = state.count + payload
        },
        user: { name: 'Joel' },
        setName({ user }) {
          user.name = 'Joel Moss'
        }
      })
    )

    hookAct(() => void result.current.incrementBy(3))
    hookAct(() => void result.current.setName())

    expect(result.current.user.name).toBe('Joel Moss')
    expect(result.current.count).toBe(3)
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

  test('async functions can change state before and after the async call', async () => {
    const model = {
      count: 0,
      increment: async state => {
        ++state.count
        await resolveAfter({}, 100)
        ++state.count
      }
    }
    const App = () => {
      const state = useIbiza(model)
      return <h1>Hello{state.count}</h1>
    }

    const { renderCount } = perf(React)
    render(<App />)

    screen.getByText('Hello0')

    act(() => {
      store.state.increment()
    })

    await screen.findByText('Hello1')
    expect(store.state.count).toBe(1)

    await act(() => new Promise(res => setTimeout(res, 200)))

    await screen.findByText('Hello2')
    expect(store.state.count).toBe(2)

    await waitFor(() => expect(renderCount.current.App.value).toEqual(3))
  })
})
