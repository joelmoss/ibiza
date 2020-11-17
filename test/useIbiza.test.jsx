/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import React, { Suspense, useCallback, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { render, act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderHook, act as hookAct } from '@testing-library/react-hooks'
import { perf, wait } from 'react-performance-testing'
import { merge, mergeWith } from 'lodash'

import { useIbiza, reset, unwrap, getState, config } from '../src'

let renderedItems = []
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

it.todo('using ++/-- operators on state should not re-render if unused')

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

it('merges initial with existing state', () => {
  renderHook(() =>
    useIbiza({
      count1: 0,
      count2: 0,
      get fullName() {
        return 'Joel Moss'
      }
    })
  )
  const { result } = renderHook(() => useIbiza({ count2: 1, user: { name: 'Joel' } }))

  expect(Object.getOwnPropertyDescriptor(result.current, 'fullName').get).toBeDefined()
  expect(result.current).toEqual({
    count1: 0,
    count2: 1,
    fullName: 'Joel Moss',
    user: { name: 'Joel' }
  })
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
    result.current.count++
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

  hookAct(() => void result.current.increment())

  expect(result.current.count).toBe(1)
})

it('can change state with `this` in functions', async () => {
  const App = () => {
    const state = useIbiza({
      count: 0,
      increment() {
        this.count++
      }
    })
    return (
      <>
        <h1>Count is: {state.count}</h1>
        <button onClick={state.increment}>Increment</button>
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

it('can return derived state from a function', async () => {
  const App = () => {
    const state = useIbiza({
      count1: 0,
      count2: 1,
      totalCount: state => {
        return state.count1 + state.count2
      }
    })

    const onClick = useCallback(() => {
      state.count1 = 1
    }, [])

    return (
      <>
        <h1>Total is {state.totalCount()}</h1>
        <button onClick={onClick} />
      </>
    )
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Total is 1')

  fireEvent.click(screen.getByRole('button'))

  // Because totalCount is a function, the component will not rerender.
  await screen.findByText('Total is 1')

  await wait(() => expect(renderCount.current.App.value).toBe(1))
})

it('getter', async () => {
  const App = () => {
    const state = useIbiza({
      firstName: 'Joel',
      get name() {
        return `${this.firstName} Moss`
      }
    })

    return (
      <>
        <h1>Name is {state.name}</h1>
        <button onClick={() => void (state.firstName = 'Bob')}>click</button>
      </>
    )
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Name is Joel Moss')

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('Name is Bob Moss')
  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

it.skip('useCache', async () => {
  const cache = {}
  const useCache = (key, value) => {
    if (!Object.keys(cache).includes(key)) {
      console.log(1)
      cache[key] = value
    }

    return cache[key]
  }

  const App = () => {
    const cache = useCache('users', { name: 'Joel' })
    console.log(cache)
    return <h1>Cache is {cache.name}</h1>
  }

  const { renderCount } = perf(React)
  const { rerender } = render(<App />)

  screen.getByText('Cache is Joel')

  cache.users.name = 'Bob'
  rerender(<App />)

  screen.getByText('Cache is Bob')

  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

it('should not re-render when using state in a function', async () => {
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

  const { renderCount } = perf(React)
  render(<App />)

  expect(renderedItems).toEqual([0])

  fireEvent.click(screen.getByRole('button'))

  expect(renderedItems).toEqual([0])

  await wait(() => expect(renderCount.current.App.value).toBe(1))
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
    return <button onClick={() => state.count++} />
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

describe('URL backed state', () => {
  config.fetchFn = path => {
    const url = new URL(path, 'http://localhost')
    const resource = new Request(url)
    return fetch(resource).then(response => {
      if (!response.ok) {
        throw `Error (${response.status})`
      }

      return response.json()
    })
  }

  it('fetches from the server', async () => {
    function Section() {
      const data = useIbiza('/user')
      return <div>{data.name}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <Section />
        </Suspense>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot(`"Joel Moss"`)
  })

  it('lazy fetches', async () => {
    const model = {
      get ['/user']() {
        return config.fetchFn(`/users/${this.userId}`)
      }
    }
    const spy = jest.spyOn(model, '/user', 'get')
    function Section() {
      const data = useIbiza('/user')
      return (
        <div>
          #{data.id}:{data.name}
        </div>
      )
    }
    const App = () => {
      useIbiza(Object.assign(model, { userId: 1 }))
      return (
        <Suspense fallback={<div>fallback</div>}>
          <Section />
        </Suspense>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot(`"#1:Joel Moss"`)

    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockRestore()
  })

  it.todo('can return a slice of a fetch') // useIbiza('/user.name')

  it('fetches are cached', async () => {
    const spy = jest.spyOn(config, 'fetchFn')

    function Section({ id }) {
      const data = useIbiza('/user')
      return <div>{data.name}</div>
    }
    function AnotherSection() {
      const data = useIbiza('/user')
      return <div>{data.name}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <Section id={1} />
          <Section id={2} />
          <AnotherSection />
        </Suspense>
      )
    }
    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot(`"Joel MossJoel MossJoel Moss"`)

    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockRestore()
  })

  it.todo('can lazy fetch within a getter')
  // get user() {
  //   return this['/user']
  // }

  it('lazy fetches are cached', async () => {
    const model = {
      userId: 1,
      get user() {
        return 'a user!!'
      },
      get ['/user']() {
        return config.fetchFn('/user')
      }
    }
    const spy = jest.spyOn(model, '/user', 'get')

    function Section() {
      const data = useIbiza('/user')
      return <div>{data.name}</div>
    }
    const App = () => {
      useIbiza(model)
      return (
        <Suspense fallback={<div>fallback</div>}>
          <Section />
          <Section />
        </Suspense>
      )
    }
    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot(`"Joel MossJoel Moss"`)

    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockRestore()
  })

  it('fetches only once even after rerenders', async () => {
    const spy = jest.spyOn(config, 'fetchFn')

    function Section() {
      const [count, setCount] = useState(0)
      const data = useIbiza('/user')
      return (
        <>
          <div>{data.name}</div>
          <div>Count is {count}</div>
          <button onClick={() => setCount(1)}>ClickMe</button>
        </>
      )
    }
    const { container } = render(
      <Suspense fallback={<div>fallback</div>}>
        <Section />
      </Suspense>
    )

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    await screen.findByText('Joel Moss')

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Count is 1')

    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockRestore()
  })

  it('handles render errors', async () => {
    function Section() {
      const data = useIbiza('/user')
      return (
        <div>
          {data.name} - {thisDoesNotExist}
        </div>
      )
    }
    const App = () => {
      return (
        <ErrorBoundary fallback={<div>error boundary</div>}>
          <Suspense fallback={<div>fallback</div>}>
            <Section />
          </Suspense>
        </ErrorBoundary>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot(`"error boundary"`)

    console.info('*The warning above can be ignored (caught by ErrorBoundary).')
  })

  it('should throw errors', async () => {
    function Section() {
      const data = useIbiza('/error')
      return <div>sdf</div>
    }
    const { container } = render(
      <ErrorBoundary fallback={<div>error boundary</div>}>
        <Suspense fallback={<div>fallback</div>}>
          <Section />
        </Suspense>
      </ErrorBoundary>
    )

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot(`"error boundary"`)

    console.info('*The warning above can be ignored (caught by ErrorBoundary).')
  })
})
