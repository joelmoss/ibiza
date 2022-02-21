/* eslint-disable testing-library/no-node-access */
/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import { Suspense, useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { render, act, fireEvent, screen } from '@testing-library/react'
import { renderHook, act as hookAct } from '@testing-library/react-hooks'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { ErrorBoundary } from 'react-error-boundary'

import useIbiza from './use_ibiza.js'
import { query } from './helpers.js'
import store, { rawStateOf } from './store.js'

const resolveAfter = (data, ms) => new Promise(resolve => setTimeout(() => resolve(data), ms))

const server = setupServer(
  rest.get('/post', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ title: 'Post#1', comment: { body: 'comment#1' } }))
  }),

  rest.get('/user', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Joel Moss' }))
  }),

  rest.get('/users/1', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Joel Moss' }))
  }),
  rest.get('/users/2', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Joel2 Moss2' }))
  }),

  rest.patch('/user', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Ash Moss' }))
  }),

  rest.get('/user_with_404_on_get', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.status(404))
  }),

  rest.get('/user_with_404_on_save', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Joel Moss' }))
  }),
  rest.patch('/user_with_404_on_save', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.status(404))
  }),

  rest.get('/user_will_change', async (req, res, ctx) => {
    return res.once(ctx.delay(100), ctx.json({ name: 'Joel Moss', age: 43 }))
  }),
  rest.get('/user_will_change', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Ash Moss', age: 23 }))
  })
)

beforeAll(() => server.listen())
afterEach(() => {
  store.reset()
  jest.clearAllMocks()
  server.resetHandlers()
})
afterAll(() => server.close())

describe('initial state', () => {
  it('can pass slice', () => {
    const { result } = renderHook(() => useIbiza('user.child', { name: 'Joel' }))

    expect(rawStateOf(result.current)).toEqual({ name: 'Joel' })
    expect(store.rawState).toMatchSnapshot()
  })

  it('merges', () => {
    const App = () => {
      return (
        <>
          <Child1 />
          <Child2 />
        </>
      )
    }
    const Child1 = () => {
      const state = useIbiza({
        count: 0,
        children: [{ name: { firstName: 'Ash', lastName: 'Moss' } }],
        name: { firstName: 'Joel', lastName: 'Moss' },
        get foo() {
          return 'bar'
        }
      })
      return <h1>Count is [{state.count}]</h1>
    }
    const Child2 = () => {
      const state = useIbiza({
        count1: 0,
        name: { firstName: 'Ash' },
        children: []
      })
      return <h1>Count1 is [{state.count1}]</h1>
    }

    render(<App />)

    expect(store.rawState).toMatchSnapshot()
  })

  it('merges only once', async () => {
    const App = props => {
      const state = useIbiza(props)
      return <h1>Count is [{state.count}]</h1>
    }

    const { rerender } = render(<App count={0} />)

    screen.getByText('Count is [0]')

    rerender(<App count={1} />)

    await screen.findByText('Count is [0]')
  })

  it('should rerender other components if used', async () => {
    store.state = { name: 'Joel Moss' }

    let renderCountApp = 0
    const App = () => {
      renderCountApp++
      const [showChild1, setShowChild1] = useState(false)
      return (
        <div>
          {showChild1 && <Child1 />}
          <Child2 />
          <Child3 />
          <button onClick={setShowChild1}>Show Child1</button>
        </div>
      )
    }
    let renderCountChild1 = 0
    const Child1 = () => {
      renderCountChild1++
      const state = useIbiza(s => {
        const [firstName, lastName] = s.name.split(' ')
        return { firstName, lastName }
      })

      return (
        <ul>
          <li>Child1.firstName=[{state.firstName}]</li>
          <li>Child1.lastName=[{state.lastName}]</li>
        </ul>
      )
    }
    let renderCountChild2 = 0
    const Child2 = () => {
      renderCountChild2++
      const state = useIbiza()

      return (
        <ul>
          <li>Child2.firstName=[{state.firstName}]</li>
          <li>Child2.lastName=[{state.lastName}]</li>
        </ul>
      )
    }
    let renderCountChild3 = 0
    const Child3 = () => {
      renderCountChild3++

      return <p>Child3</p>
    }

    render(<App />)

    screen.getByText('Child2.firstName=[]')
    screen.getByText('Child2.lastName=[]')
    expect(renderCountApp).toBe(1)
    expect(renderCountChild1).toBe(0)
    expect(renderCountChild2).toBe(1)
    expect(renderCountChild3).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Child1.firstName=[Joel]')
    await screen.findByText('Child1.lastName=[Moss]')
    await screen.findByText('Child2.firstName=[Joel]')
    await screen.findByText('Child2.lastName=[Moss]')
    expect(renderCountApp).toBe(2)
    expect(renderCountChild1).toBe(1)
    expect(renderCountChild2).toBe(2)
    expect(renderCountChild3).toBe(2)
  })

  it('should rerender only once on single mutation', async () => {
    let renderCount = 0
    const App = () => {
      const state = useIbiza({ count: 0 })
      renderCount++
      return (
        <>
          <h1>Count is [{state.count}]</h1>
        </>
      )
    }

    render(<App />)

    screen.getByText('Count is [0]')
    expect(renderCount).toBe(1)

    act(() => {
      store.state.count = 1
    })

    await screen.findByText('Count is [1]')
    expect(renderCount).toBe(2)
  })

  it('as a function', () => {
    store.state = { name: 'Joel Moss' }
    const iState = jest.fn(s => {
      const [firstName, lastName] = s.name.split(' ')
      return { firstName, lastName }
    })
    const { result } = renderHook(() => useIbiza(iState))

    expect(rawStateOf(result.current)).toEqual({
      name: 'Joel Moss',
      firstName: 'Joel',
      lastName: 'Moss'
    })
    expect(result.current.isProxy).toBe(true)
    expect(iState).toBeCalledTimes(1)
  })

  it('function called only once', async () => {
    const iStateFn = jest.fn(() => ({ count: 0 }))
    const App = props => {
      const state = useIbiza(iStateFn)
      return (
        <>
          <h1>Count is [{state.count}]</h1>
          <h2>{props.count}</h2>
        </>
      )
    }

    const { rerender } = render(<App count={0} />)

    screen.getByText('Count is [0]')

    rerender(<App count={1} />)

    await screen.findByText('Count is [0]')
    expect(iStateFn).toHaveBeenCalledTimes(1)
  })

  it('can pass slice, and function', () => {
    store.state = { user: { name: 'Joel Moss' } }
    const iState = jest.fn(s => {
      const [firstName, lastName] = s.name.split(' ')
      return { firstName, lastName }
    })
    const { result } = renderHook(() => useIbiza('user', iState))

    expect(rawStateOf(result.current)).toEqual({
      name: 'Joel Moss',
      firstName: 'Joel',
      lastName: 'Moss'
    })
    expect(result.current.isProxy).toBe(true)
    expect(iState).toBeCalledTimes(1)
  })
})

describe('returns empty object by default', () => {
  it('basic', () => {
    const { result } = renderHook(() => useIbiza())

    expect(rawStateOf(result.current)).toEqual({})
    expect(result.current.isProxy).toBe(true)
  })

  it('slice', () => {
    const { result } = renderHook(() => useIbiza('user'))

    expect(rawStateOf(result.current)).toEqual({})
    expect(result.current.isProxy).toBe(true)
  })
})

describe('returns store state', () => {
  it('basic', () => {
    store.state = { count: 0 }
    const { result } = renderHook(() => useIbiza())

    expect(rawStateOf(result.current)).toEqual({ count: 0 })
  })

  it('slice', () => {
    store.state = { user: { count: 0 } }
    const { result } = renderHook(() => useIbiza('user'))

    expect(rawStateOf(result.current)).toEqual({ count: 0 })
  })
})

describe('nested objects are proxies', () => {
  it('basic', () => {
    store.state = { one: { two: { three: [{ foo: 'bar' }] } } }
    const { result } = renderHook(() => useIbiza())

    expect(result.current.isProxy).toBe(true)
    expect(result.current.one.isProxy).toBe(true)
    expect(result.current.one.two.isProxy).toBe(true)
    expect(result.current.one.two.three.isProxy).toBe(true)
    expect(result.current.one.two.three[0].isProxy).toBe(true)
  })

  it('slice', () => {
    store.state = { one: { two: { three: { four: [{ foo: 'bar' }] } } } }
    const { result } = renderHook(() => useIbiza('one'))

    expect(result.current.isProxy).toBe(true)
    expect(result.current.two.isProxy).toBe(true)
    expect(result.current.two.three.isProxy).toBe(true)
    expect(result.current.two.three.four.isProxy).toBe(true)
    expect(result.current.two.three.four[0].isProxy).toBe(true)
  })
})

describe('store.state == hook state', () => {
  it('basic', () => {
    store.state = { count: 0 }
    const { result } = renderHook(() => useIbiza())

    hookAct(() => {
      ++result.current.count
    })

    expect(store.rawState).toEqual(rawStateOf(result.current))
  })

  it('slice', () => {
    store.state = { user: { count: 0 } }
    const { result } = renderHook(() => useIbiza('user'))

    hookAct(() => {
      ++result.current.count
    })

    expect(store.rawState).toEqual({ user: rawStateOf(result.current) })
  })
})

describe('can get null/undefined props', () => {
  it('basic', () => {
    store.state = { firstName: null }
    const App = () => {
      const state = useIbiza()
      return (
        <h1>
          Name is [firstName:{state.firstName}] [lastName:{state.lastName}]
        </h1>
      )
    }

    render(<App />)

    screen.getByText('Name is [firstName:] [lastName:]')
  })

  it('slice', () => {
    store.state = { user: { firstName: null } }
    const App = () => {
      const state = useIbiza('user')
      return (
        <h1>
          Name is [firstName:{state.firstName}] [lastName:{state.lastName}]
        </h1>
      )
    }

    render(<App />)

    screen.getByText('Name is [firstName:] [lastName:]')
  })
})

describe('mutating', () => {
  describe('single prop', () => {
    it('basic', () => {
      store.state = { count: 0 }
      const { result } = renderHook(() => useIbiza())

      hookAct(() => {
        ++result.current.count
      })

      expect(store.rawState).toEqual({ count: 1 })
    })

    it('slice', () => {
      store.state = { user: { count: 0 } }
      const { result } = renderHook(() => useIbiza('user'))

      hookAct(() => {
        ++result.current.count
      })

      expect(store.rawState).toEqual({ user: { count: 1 } })
    })
  })

  describe('single nested prop', () => {
    it('basic', () => {
      store.state = { count: 0, nested: {} }
      const { result } = renderHook(() => useIbiza())

      hookAct(() => {
        result.current.nested.count = 1
      })

      expect(store.rawState).toEqual({ count: 0, nested: { count: 1 } })
    })

    it('slice', () => {
      store.state = { user: { count: 0, nested: {} } }
      const { result } = renderHook(() => useIbiza('user'))

      hookAct(() => {
        result.current.nested.count = 1
      })

      expect(store.rawState).toEqual({
        user: { count: 0, nested: { count: 1 } }
      })
    })
  })

  describe('can set null or undefined', () => {
    it('basic', () => {
      store.state = { name: 'Joel', age: 43 }
      const { result } = renderHook(() => useIbiza())

      hookAct(() => {
        result.current.name = null
        result.current.age = undefined
      })

      expect(store.rawState).toEqual({ name: null, age: undefined })
    })

    it('slice', () => {
      store.state = { user: { name: 'Joel', age: 43 } }
      const { result } = renderHook(() => useIbiza('user'))

      hookAct(() => {
        result.current.name = null
        result.current.age = undefined
      })

      expect(store.rawState).toEqual({ user: { name: null, age: undefined } })
    })
  })

  it('can redefine object', async () => {
    store.state = { user: { name: 'Joel Moss' } }
    function App() {
      const state = useIbiza()
      return <>{state.user.name}</>
    }

    render(<App />)

    screen.getByText('Joel Moss')

    act(() => {
      store.state.user = { name: 'Ash Moss' }
    })

    await screen.findByText('Ash Moss')
  })

  it.skip('should rerender when function reads state', async () => {
    store.state = {
      count: 1,
      add() {
        this.count++
      }
    }

    let renderCountApp = 0
    let renderCountCount = 0
    let renderCountButton = 0

    function App() {
      renderCountApp++
      return (
        <>
          <Count />
          <Button />
        </>
      )
    }
    function Count() {
      renderCountCount++
      const state = useIbiza()
      return <div>count[{state.count}]</div>
    }
    function Button() {
      renderCountButton++
      const state = useIbiza()
      return <button onClick={state.add}>click</button>
    }

    render(<App />)

    // screen.getByText('count[1]')
    expect(renderCountApp).toBe(1)
    expect(renderCountCount).toBe(1)
    expect(renderCountButton).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    // await screen.findByText('count[2]')
    expect(renderCountApp).toBe(1)
    expect(renderCountCount).toBe(2)
    expect(renderCountButton).toBe(1)
  })

  it('can redefine object with slice', async () => {
    store.state = { user: { name: 'Joel Moss' } }
    function App() {
      const user = useIbiza('user')
      return <>{user.name}</>
    }

    render(<App />)

    screen.getByText('Joel Moss')

    act(() => {
      store.state.user = { name: 'Ash Moss' }
    })

    await screen.findByText('Ash Moss')
  })

  // Figure out a way to test that `proxify()` is only called once per object.
  describe('re-uses proxy between renders', () => {
    it.skip('basic', async () => {
      store.state = { nested: { count: 0 } }

      let renderCount = 0
      const App = () => {
        const state = useIbiza()
        renderCount++
        return (
          <>
            <h1>Count is [{state.nested.count}]</h1>
            <button onClick={() => (state.nested.count = 1)} />
          </>
        )
      }

      render(<App />)

      screen.getByText('Count is [0]')
      expect(renderCount).toBe(1)

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('Count is [1]')
      expect(renderCount).toBe(2)
    })

    it.skip('slice', async () => {
      store.state = { user: { nested: { count: 0 } } }

      let renderCount = 0
      const App = () => {
        const state = useIbiza('user')
        renderCount++
        return (
          <>
            <h1>Count is [{state.nested.count}]</h1>
            <button onClick={() => (state.nested.count = 1)} />
          </>
        )
      }

      render(<App />)

      screen.getByText('Count is [0]')
      expect(renderCount).toBe(1)

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('Count is [1]')
      expect(renderCount).toBe(2)
    })
  })

  describe('re-renders on used state', () => {
    describe('single component', () => {
      test('basic', async () => {
        let renderCount = 0
        store.state = { count: 0 }
        const App = () => {
          const state = useIbiza()
          renderCount++
          return (
            <>
              <h1>Count is [{state.count}]</h1>
              <button onClick={() => (state.count = 1)} />
            </>
          )
        }

        render(<App />)

        screen.getByText('Count is [0]')
        expect(renderCount).toBe(1)

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Count is [1]')
        expect(renderCount).toBe(2)
      })

      test('slice', async () => {
        let renderCount = 0
        store.state = { user: { count: 0 } }
        const App = () => {
          const state = useIbiza('user')
          renderCount++
          return (
            <>
              <h1>Count is [{state.count}]</h1>
              <button onClick={() => (state.count = 1)} />
            </>
          )
        }

        render(<App />)

        screen.getByText('Count is [0]')
        expect(renderCount).toBe(1)

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Count is [1]')
        expect(renderCount).toBe(2)
      })
    })

    describe('multiple components', () => {
      test('basic', async () => {
        let renderCountApp = 0
        store.state = { count1: 0, count2: 0 }
        const App = () => {
          const state = useIbiza()
          renderCountApp++
          return (
            <>
              <Child1 />
              <Child2 />
              <button onClick={() => (state.count2 = 1)} />
            </>
          )
        }

        let renderCountChild1 = 0
        const Child1 = () => {
          const state = useIbiza()
          renderCountChild1++
          return <h2>Child1.count1 is [{state.count1}]</h2>
        }

        let renderCountChild2 = 0
        const Child2 = () => {
          const state = useIbiza()
          renderCountChild2++
          return <h2>Child2.count2 is [{state.count2}]</h2>
        }

        render(<App />)

        screen.getByText('Child1.count1 is [0]')
        screen.getByText('Child2.count2 is [0]')

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Child1.count1 is [0]')
        await screen.findByText('Child2.count2 is [1]')
        expect(renderCountApp).toBe(1)
        expect(renderCountChild1).toBe(1)
        expect(renderCountChild2).toBe(2)
      })

      test('slice', async () => {
        let renderCountApp = 0
        store.state = { user: { count1: 0, count2: 0 } }
        const App = () => {
          const state = useIbiza('user')
          renderCountApp++
          return (
            <>
              <Child1 />
              <Child2 />
              <button onClick={() => (state.count2 = 1)} />
            </>
          )
        }

        let renderCountChild1 = 0
        const Child1 = () => {
          const state = useIbiza('user')
          renderCountChild1++
          return <h2>Child1.count1 is [{state.count1}]</h2>
        }

        let renderCountChild2 = 0
        const Child2 = () => {
          const state = useIbiza('user')
          renderCountChild2++
          return <h2>Child2.count2 is [{state.count2}]</h2>
        }

        render(<App />)

        screen.getByText('Child1.count1 is [0]')
        screen.getByText('Child2.count2 is [0]')

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Child1.count1 is [0]')
        await screen.findByText('Child2.count2 is [1]')
        expect(renderCountApp).toBe(1)
        expect(renderCountChild1).toBe(1)
        expect(renderCountChild2).toBe(2)
      })

      test('different slices', async () => {
        let renderCountApp = 0
        store.state = { user1: { count: 0 }, user2: { count: 0 } }
        const App = () => {
          const state = useIbiza()
          renderCountApp++
          return (
            <>
              <Child1 />
              <Child2 />
              <button onClick={() => (state.user2.count = 1)} />
            </>
          )
        }

        let renderCountChild1 = 0
        const Child1 = () => {
          const state = useIbiza('user1')
          renderCountChild1++
          return <h2>Child1.count1 is [{state.count}]</h2>
        }

        let renderCountChild2 = 0
        const Child2 = () => {
          const state = useIbiza('user2')
          renderCountChild2++
          return <h2>Child2.count2 is [{state.count}]</h2>
        }

        render(<App />)

        screen.getByText('Child1.count1 is [0]')
        screen.getByText('Child2.count2 is [0]')

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Child1.count1 is [0]')
        await screen.findByText('Child2.count2 is [1]')
        expect(renderCountApp).toBe(1)
        expect(renderCountChild1).toBe(1)
        expect(renderCountChild2).toBe(2)
      })
    })

    describe('unmounted component', () => {
      test('basic', async () => {
        store.state = { count: 0 }

        let renderCountApp = 0
        const App = () => {
          const state = useIbiza()
          renderCountApp++
          return (
            <>
              <Child1 />
              {state.count < 1 && <Child2 />}
              <button onClick={() => void state.count++} />
            </>
          )
        }

        let renderCountChild1 = 0
        const Child1 = () => {
          const state = useIbiza()
          renderCountChild1++
          return <h2>Child1.count is [{state.count}]</h2>
        }

        let renderCountChild2 = 0
        const Child2 = () => {
          const state = useIbiza()
          renderCountChild2++
          return <h2>Child2.count is [{state.count}]</h2>
        }

        render(<App />)

        screen.getByText('Child1.count is [0]')
        screen.getByText('Child2.count is [0]')

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Child1.count is [1]')

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Child1.count is [2]')

        expect(renderCountApp).toBe(3)
        expect(renderCountChild1).toBe(3)
        expect(renderCountChild2).toBe(1)
      })

      test('slice', async () => {
        store.state = { user: { count: 0 } }

        let renderCountApp = 0
        const App = () => {
          const state = useIbiza('user')
          renderCountApp++
          return (
            <>
              <Child1 />
              {state.count < 1 && <Child2 />}
              <button onClick={() => void state.count++} />
            </>
          )
        }

        let renderCountChild1 = 0
        const Child1 = () => {
          const state = useIbiza('user')
          renderCountChild1++
          return <h2>Child1.count is [{state.count}]</h2>
        }

        let renderCountChild2 = 0
        const Child2 = () => {
          const state = useIbiza('user')
          renderCountChild2++
          return <h2>Child2.count is [{state.count}]</h2>
        }

        render(<App />)

        screen.getByText('Child1.count is [0]')
        screen.getByText('Child2.count is [0]')

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Child1.count is [1]')

        fireEvent.click(screen.getByRole('button'))

        await screen.findByText('Child1.count is [2]')

        expect(renderCountApp).toBe(3)
        expect(renderCountChild1).toBe(3)
        expect(renderCountChild2).toBe(1)
      })
    })
  })

  describe('does not re-render on unused state', () => {
    it('basic', async () => {
      let renderCount = 0
      store.state = { count1: 0 }
      const App = () => {
        const state = useIbiza()
        renderCount++
        return (
          <>
            <h1>Count1 is [{state.count1}]</h1>
            <button onClick={() => (state.count2 = 1)} />
          </>
        )
      }

      render(<App />)

      screen.getByText('Count1 is [0]')
      expect(renderCount).toBe(1)

      fireEvent.click(screen.getByRole('button'))

      expect(store.state.count2).toEqual(1)

      await screen.findByText('Count1 is [0]')
      expect(renderCount).toBe(1)
    })

    it('slice', async () => {
      let renderCount = 0
      store.state = { user: { count1: 0 } }
      const App = () => {
        const state = useIbiza('user')
        renderCount++
        return (
          <>
            <h1>Count1 is [{state.count1}]</h1>
            <button onClick={() => (state.count2 = 1)} />
          </>
        )
      }

      render(<App />)

      screen.getByText('Count1 is [0]')
      expect(renderCount).toBe(1)

      fireEvent.click(screen.getByRole('button'))

      expect(store.state.user.count2).toEqual(1)

      await screen.findByText('Count1 is [0]')
      expect(renderCount).toBe(1)
    })
  })

  it('can batch DOM updates', async () => {
    store.state = { count: 0 }

    function Counter() {
      const state = useIbiza()
      useEffect(() => {
        ReactDOM.unstable_batchedUpdates(() => {
          state.count = 1
          state.count = 2
        })
      }, [state])
      return <div>count: {state.count}</div>
    }

    render(<Counter />)

    await screen.findByText('count: 2')
  })

  describe('does not rerender on unused nested state', () => {
    test('single component', async () => {
      store.state = { user: { firstName: 'Joel', lastName: 'Moss' } }

      let renderCount = 0
      const App = () => {
        const state = useIbiza()
        renderCount++
        return (
          <>
            <ul>
              <li>state.lastName[{state.user.lastName}]</li>
            </ul>
            <button onClick={() => void (state.user.firstName = 'Ash')} />
          </>
        )
      }

      render(<App />)

      screen.getByText('state.lastName[Moss]')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('state.lastName[Moss]')
      expect(renderCount).toBe(1)
    })

    test('multiple components', async () => {
      store.state = { nested: { foo: 'bah', count1: 0, count2: 0 } }

      let renderCountApp = 0
      const App = () => {
        const state = useIbiza()
        renderCountApp++
        return (
          <>
            <p>Foo: {state.nested.foo}</p>
            <Child1 />
            <Child2 />
            <button onClick={() => void (state.nested.count2 = 1)} />
          </>
        )
      }

      let renderCountChild1 = 0
      const Child1 = () => {
        const state = useIbiza()
        renderCountChild1++
        return <h2>Child1.count1 is [{state.nested.count1}]</h2>
      }

      let renderCountChild2 = 0
      const Child2 = () => {
        const state = useIbiza()
        renderCountChild2++
        return <h2>Child2.count2 is [{state.nested.count2}]</h2>
      }

      render(<App />)

      screen.getByText('Foo: bah')
      screen.getByText('Child1.count1 is [0]')
      screen.getByText('Child2.count2 is [0]')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('Child2.count2 is [1]')

      expect(renderCountApp).toBe(1)
      expect(renderCountChild1).toBe(1)
      expect(renderCountChild2).toBe(2)
    })
  })

  it('re-renders undefined props', async () => {
    let renderCount = 0
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <>
          <h1>Count is [{state.count}]</h1>
          <button onClick={() => (state.count = 1)} />
        </>
      )
    }

    render(<App />)

    screen.getByText('Count is []')
    expect(renderCount).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Count is [1]')
    expect(renderCount).toBe(2)
  })

  it('re-renders null props', async () => {
    let renderCount = 0
    store.state = { count: null }
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <>
          <h1>Count is [{state.count}]</h1>
          <button onClick={() => (state.count = 1)} />
        </>
      )
    }

    render(<App />)

    screen.getByText('Count is []')
    expect(renderCount).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Count is [1]')
    expect(renderCount).toBe(2)
  })

  test('destructured state', async () => {
    store.state = { posts: { count: 0 }, foo: 'bah' }

    let renderCountApp = 0
    const App = () => {
      let state = useIbiza()
      renderCountApp++
      return (
        <>
          <Child1 />
          <Child2 />
          <button onClick={() => void (state.posts.count = 1)}>Increment</button>
          <button onClick={() => void (state.foo = 'bah2')}>Foo</button>
        </>
      )
    }
    let renderCountChild1 = 0
    const Child1 = () => {
      const {
        posts: { count }
      } = useIbiza()
      renderCountChild1++
      return (
        <>
          <h1>posts.count is: {count}</h1>
        </>
      )
    }
    let renderCountChild2 = 0
    const Child2 = () => {
      const { foo } = useIbiza()
      renderCountChild2++
      return (
        <>
          <h1>foo is: {foo}</h1>
        </>
      )
    }

    render(<App />)

    screen.getByText('posts.count is: 0')
    screen.getByText('foo is: bah')
    expect(renderCountApp).toBe(1)
    expect(renderCountChild1).toBe(1)
    expect(renderCountChild2).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))

    await screen.findByText('posts.count is: 1')
    await screen.findByText('foo is: bah')
    expect(renderCountApp).toBe(1)
    expect(renderCountChild1).toBe(2)
    expect(renderCountChild2).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Foo' }))

    await screen.findByText('foo is: bah2')
    expect(renderCountApp).toBe(1)
    expect(renderCountChild1).toBe(2)
    expect(renderCountChild2).toBe(2)
  })

  it('nested state in parent that only child uses should not cause parent to watch parent state.', async () => {
    let renderCountParent = 0
    const Parent = () => {
      const state = useIbiza({ count: 0 })
      renderCountParent++
      return (
        <>
          <Child />
          <button onClick={() => void (state.count = 1)}>Increment</button>
        </>
      )
    }
    let renderCountChild = 0
    const Child = () => {
      const state = useIbiza()
      renderCountChild++
      return <h1>Count[{state.count}]</h1>
    }

    render(<Parent />)

    // screen.getByText('Count[0]')
    expect(renderCountParent).toBe(1)
    expect(renderCountChild).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Count[1]')
    expect(renderCountParent).toBe(1)
    expect(renderCountChild).toBe(2)
  })

  it.todo('Defining new object on state should cause re-render')
})

describe('arrays', () => {
  it('map', async () => {
    store.state = { children: [{ name: { first: 'Ash' } }] }

    let renderCount = 0
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <>
          <ul>
            {state.children.map((child, i) => (
              <li key={i}>Child[{child.name.first}]</li>
            ))}
          </ul>
          <button onClick={() => void (state.children[0].name.first = 'Elijah')}>Click</button>
        </>
      )
    }

    render(<App />)

    screen.getByText('Child[Ash]')
    expect(renderCount).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Child[Elijah]')
    expect(renderCount).toBe(2)
  })

  it('forEach', async () => {
    store.state = ['Ash']

    let renderCount = 0
    const App = () => {
      const state = useIbiza()
      renderCount++

      let children = []
      state.forEach(child => {
        children.push(child)
      })

      return (
        <>
          <ul>
            {children.map((child, i) => (
              <li key={i}>Child[{child}]</li>
            ))}
          </ul>
          <button onClick={() => state.push('Elijah')}>Add</button>
        </>
      )
    }

    render(<App />)

    screen.getByText('Child[Ash]')
    expect(renderCount).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Child[Elijah]')
    expect(renderCount).toBe(2)
  })

  it('for..of', async () => {
    store.state = ['Ash']

    let renderCount = 0
    const App = () => {
      const state = useIbiza()
      renderCount++

      let children = []
      for (const child of state) {
        children.push(child)
      }

      return (
        <>
          <ul>
            {children.map((child, i) => (
              <li key={i}>Child[{child}]</li>
            ))}
          </ul>
          <button onClick={() => state.push('Elijah')}>Add</button>
        </>
      )
    }

    render(<App />)

    screen.getByText('Child[Ash]')
    expect(renderCount).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Child[Elijah]')
    expect(renderCount).toBe(2)
  })

  it('add element', async () => {
    store.state = [{ name: 'Ash' }]

    let renderCount = 0
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <>
          <ul>
            {state.map((child, i) => (
              <li key={i}>Child[{child.name}]</li>
            ))}
          </ul>
          <button onClick={() => state.push({ name: 'Elijah' })}>Add</button>
        </>
      )
    }

    render(<App />)

    screen.getByText('Child[Ash]')
    expect(renderCount).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Child[Ash]')
    await screen.findByText('Child[Elijah]')
    expect(renderCount).toBe(2)
  })

  it('remove element', async () => {
    store.state = ['Ash', 'Elijah']

    let renderCount = 0
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <>
          <ul>
            {state.map((child, i) => (
              <li key={i}>Child[{child}]</li>
            ))}
          </ul>
          <button onClick={() => void delete state[1]}>Click</button>
        </>
      )
    }

    const { container } = render(<App />)

    screen.getByText('Child[Ash]')
    screen.getByText('Child[Elijah]')
    expect(renderCount).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Child[Ash]')
    expect(container).not.toHaveTextContent('Child[Elijah]')
    expect(renderCount).toBe(2)
  })

  it('array of objects', async () => {
    store.state = [{ name: 'Ash' }, { name: 'Elijah' }]

    let renderCount = 0
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <>
          <ul>
            {state.map((child, i) => (
              <li key={i}>Child[{child.name}]</li>
            ))}
          </ul>
          <button onClick={() => void delete state[1]}>Click</button>
        </>
      )
    }

    const { container } = render(<App />)

    screen.getByText('Child[Ash]')
    screen.getByText('Child[Elijah]')
    expect(renderCount).toBe(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Child[Ash]')
    expect(container).not.toHaveTextContent('Child[Elijah]')
    expect(renderCount).toBe(2)
  })
})

it('rerenders on changed child of used paths (dupe keys)', async () => {
  store.state = {
    children: {
      children: {
        1: { text: 'child 1' },
        2: { text: 'child 2' }
      }
    }
  }

  const Child = ({ id }) => {
    const { children } = useIbiza('children')
    return <div>{children[id].text}</div>
  }

  const Parent = () => {
    const state = useIbiza()
    const onClick = () => {
      state.children.children[3] = { text: 'child 3' }
    }

    return (
      <>
        <button onClick={onClick}>change state</button>
        {Object.keys(state.children.children).map(id => (
          <Child id={id} key={id} />
        ))}
      </>
    )
  }

  render(<Parent />)

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('child 3')
})

it('rerenders on changed child of used paths', async () => {
  store.state = {
    children: {
      1: { text: 'child 1' },
      2: { text: 'child 2' }
    }
  }

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

  render(<Parent />)

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('child 3')
})

it('rerenders on changed parent of used paths', async () => {
  store.state = {
    children: {
      1: { text: 'child 1' },
      2: { text: 'child 2' }
    }
  }

  const Child = ({ id }) => {
    const { children } = useIbiza()
    return <div>{children[id].text}</div>
  }

  const Parent = () => {
    const state = useIbiza()
    const onClick = () => {
      state.children = {
        1: { text: 'child 3' },
        2: { text: 'child 4' }
      }
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

  render(<Parent />)

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('child 3')
  await screen.findByText('child 4')
})

it('re-renders on change of Date objects', () => {
  let renderCount = 0
  const date = new Date()
  const App = () => {
    const state = useIbiza({ count: 0, date })
    renderCount++
    return (
      <>
        <p>date is {state.date.toString()}</p>
        <button onClick={() => (state.date = new Date())} />
      </>
    )
  }

  render(<App />)

  expect(renderCount).toBe(1)

  fireEvent.click(screen.getByRole('button'))

  expect(renderCount).toBe(2)
})

test('getter/setter', async () => {
  store.state = {
    user: {
      firstName: 'Joel',
      lastName: 'Moss',
      get name() {
        return `${this.firstName} ${this.lastName}`
      },
      set name(value) {
        const [firstName, lastName] = value.split(' ')
        this.firstName = firstName
        this.lastName = lastName
      }
    }
  }
  let renderCount = 0
  const App = () => {
    const state = useIbiza()
    renderCount++
    return (
      <>
        <h1>Name is {state.user.name}</h1>
        <button onClick={() => (state.user.name = 'Bob Bones')}>click</button>
      </>
    )
  }

  render(<App />)

  screen.getByText('Name is Joel Moss')

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('Name is Bob Bones')
  expect(renderCount).toBe(2)
})

test('getter prop dependency change', async () => {
  store.state = {
    user: {
      firstName: 'Joel',
      lastName: 'Moss',
      get name() {
        return `${this.firstName} ${this.lastName}`
      }
    }
  }
  let renderCount = 0
  const App = () => {
    const state = useIbiza()
    renderCount++
    return (
      <>
        <h1>Name is {state.user.name}</h1>
        <button onClick={() => (state.user.firstName = 'Bob')}>click</button>
      </>
    )
  }

  render(<App />)

  screen.getByText('Name is Joel Moss')

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('Name is Bob Moss')
  expect(renderCount).toBe(2)
})

test('getter/setter with internal var', async () => {
  let renderCount = 0
  let _name = 'Joel Moss'
  const App = () => {
    const state = useIbiza({
      get name() {
        return _name
      },
      set name(value) {
        _name = value
      }
    })
    renderCount++
    return (
      <>
        <h1>Name is {state.name}</h1>
        <button onClick={() => (state.name = 'Bob Bones')}>click</button>
      </>
    )
  }

  render(<App />)

  screen.getByText('Name is Joel Moss')

  fireEvent.click(screen.getByRole('button'))

  await screen.findByText('Name is Bob Bones')
  expect(renderCount).toBe(2)
})

test.skip('async getter', async () => {
  const fetchSpy = jest.spyOn(store, 'fetchFn')
  const User = () => {
    const state = useIbiza({
      get user() {
        return store.fetchFn('/user')
      }
    })

    return <h1>Name is {state.user.name}</h1>
  }

  const App = () => {
    return (
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    )
  }

  const { container } = render(<App />)
  expect(container.textContent).toMatchInlineSnapshot('"fallback"')
  await act(() => new Promise(res => setTimeout(res, 150)))
  expect(container.textContent).toMatchInlineSnapshot('"Name is Joel Moss"')
  expect(fetchSpy).toBeCalledTimes(1)
})

describe('slicing', () => {
  describe('read', () => {
    it('basic', () => {
      store.state = { user: { name: 'Joel' } }
      const App = () => {
        const state = useIbiza('user')
        return <h1>name[{state.name}]</h1>
      }

      render(<App />)

      screen.getByText('name[Joel]')
    })

    it('string', async () => {
      store.state = { user: { name: 'Joel' } }
      const App = () => {
        const name = useIbiza('user.name')
        return <h1>name[{name}]</h1>
      }

      render(<App />)

      screen.getByText('name[Joel]')

      act(() => {
        store.state.user.name = 'Ash'
      })

      await screen.findByText('name[Ash]')
    })

    it('array', async () => {
      store.state = { users: ['Joel'] }
      const App = () => {
        const users = useIbiza('users')
        return <h1>name[{users[0]}]</h1>
      }

      render(<App />)

      screen.getByText('name[Joel]')

      act(() => {
        store.state.users[0] = 'Ash'
      })

      await screen.findByText('name[Ash]')
    })

    it('array element', async () => {
      store.state = { users: ['Joel', 'Ash'] }
      const App = () => {
        const user = useIbiza('users.1')
        return <h1>name[{user}]</h1>
      }

      render(<App />)

      screen.getByText('name[Ash]')

      act(() => {
        store.state.users[1] = 'Eve'
      })

      await screen.findByText('name[Eve]')
    })

    it('function', async () => {
      const doFn = jest.fn()
      store.state = { doIt: doFn }
      const App = () => {
        const doIt = useIbiza('doIt')
        return (
          <>
            <button onClick={doIt}>Do</button>
          </>
        )
      }

      render(<App />)

      fireEvent.click(screen.getByRole('button'))

      expect(doFn).toHaveBeenCalledTimes(1)
    })

    it('slice of URL', async () => {
      const Comment = () => {
        const comment = useIbiza('/post.comment')
        return <h1>{comment.body}</h1>
      }
      const App = () => {
        return (
          <Suspense fallback={<div>fallback</div>}>
            <Comment />
          </Suspense>
        )
      }

      const { container } = render(<App />)

      expect(container.textContent).toMatchInlineSnapshot('"fallback"')
      await act(() => new Promise(res => setTimeout(res, 150)))
      expect(container.textContent).toMatchInlineSnapshot('"comment#1"')

      act(() => {
        store.state['/post'].comment.body = 'new comment'
      })

      await screen.findByText('new comment')
    })

    it('deep slice', async () => {
      store.state = { user: { child: { name: 'Joel' } } }
      const App = () => {
        const state = useIbiza('user.child')
        return <h1>name[{state.name}]</h1>
      }

      render(<App />)

      screen.getByText('name[Joel]')

      act(() => {
        store.state.user.child.name = 'Ash'
      })

      await screen.findByText('name[Ash]')
    })

    it('direct deep slice', async () => {
      store.state = { user: { child: { name: 'Joel' } } }
      const App = () => {
        const name = useIbiza('user.child.name')
        return <h1>name[{name}]</h1>
      }

      render(<App />)

      screen.getByText('name[Joel]')

      act(() => {
        store.state.user.child.name = 'Ash'
      })

      await screen.findByText('name[Ash]')
    })

    it('can get null/undefined slice', () => {
      const App = () => {
        const state = useIbiza('user')
        return <h1>Name is [{state.name}]</h1>
      }

      render(<App />)

      screen.getByText('Name is []')
    })

    it('array item', () => {
      store.state = {
        firstName: 'Joel',
        children: [{ firstName: 'Ash' }, { firstName: 'Elijah' }]
      }
      const { result } = renderHook(() => useIbiza('children.1'))

      expect(rawStateOf(result.current)).toEqual({ firstName: 'Elijah' })
      expect(result.current.isProxy).toBe(true)
    })

    it('function', () => {
      const mockFn = jest.fn()
      store.state = { nested: { eatTheWorld: mockFn } }
      const App = () => {
        const state = useIbiza('nested')
        return (
          <>
            <button onClick={state.eatTheWorld}>eatTheWorld</button>
          </>
        )
      }

      render(<App />)

      fireEvent.click(screen.getByRole('button'))

      expect(mockFn).toBeCalledTimes(1)
    })

    it('getter', () => {
      const model = {
        nested: {
          get eatTheWorld() {
            return 'World'
          }
        }
      }
      const spy = jest.spyOn(model.nested, 'eatTheWorld', 'get')
      store.state = model
      const App = () => {
        const state = useIbiza('nested')
        return <>Hello {state.eatTheWorld}</>
      }

      render(<App />)

      screen.getByText('Hello World')

      expect(spy).toBeCalledTimes(1)
    })

    // it.skip('iterator', () => {
    //   const model = {
    //     nested: {
    //       world: 'World',
    //       *[Symbol.iterator]() {
    //         for (let letter of this.nested.world) {
    //           yield letter
    //         }
    //       }
    //     }
    //   }
    //   store.merge(model)
    //   const App = () => {
    //     const state = useIbiza('nested')
    //     return (
    //       <>
    //         Hello
    //         {Array.from(state, (item, i) => (
    //           <Fragment key={i}>{item}</Fragment>
    //         ))}
    //       </>
    //     )
    //   }
    //   const { container } = render(<App />)
    //   expect(container).toMatchSnapshot()
    // })

    it('array', () => {
      store.state = {
        name: 'Joel',
        nested: { children: [{ name: 'Ash' }, { name: 'Elijah' }] }
      }
      const App = () => {
        const state = useIbiza('nested.children')
        return (
          <ul>
            {state.map((child, i) => (
              <li key={i}>Child {child.name}</li>
            ))}
          </ul>
        )
      }

      render(<App />)

      screen.getByText('Child Ash')
      screen.getByText('Child Elijah')
    })
  })

  describe('mutation', () => {
    it('used property', async () => {
      store.state = { nested: { name: 'Joel' } }

      let renderCount = 0
      const App = () => {
        let state = useIbiza('nested')
        renderCount++
        const changeName = useCallback(() => {
          state.name = 'Ash'
        }, [state])
        return (
          <>
            <h1>App[{state.name}]</h1>
            <button onClick={changeName}>Change name</button>
          </>
        )
      }

      render(<App />)

      screen.getByText('App[Joel]')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('App[Ash]')
      expect(renderCount).toBe(2)
    })

    it('unused property', async () => {
      store.state = { nested: { name: 'Joel', age: 43 } }

      let renderCount = 0
      const App = () => {
        let state = useIbiza('nested')
        renderCount++
        const changeName = useCallback(() => {
          state.age = 23
        }, [state])
        return (
          <>
            <h1>App[{state.name}]</h1>
            <button onClick={changeName}>Change name</button>
          </>
        )
      }

      render(<App />)

      screen.getByText('App[Joel]')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('App[Joel]')
      expect(renderCount).toBe(1)
    })

    it('getter dependency', async () => {
      const model = {
        firstName: 'Joel',
        lastName: 'Moss',
        get fullName() {
          return [this.firstName, this.lastName].join(' ')
        }
      }
      const spy = jest.spyOn(model, 'fullName', 'get')
      store.state = model

      const App = () => {
        const user = useIbiza()
        return (
          <>
            <h1>fullName[{user.fullName}]</h1>
            <button onClick={() => (user.firstName = 'Ash')}>click</button>
          </>
        )
      }

      render(<App />)

      screen.getByText('fullName[Joel Moss]')
      expect(spy).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('fullName[Ash Moss]')
      expect(spy).toHaveBeenCalledTimes(2)
    })

    it('nested getter dependency', async () => {
      const model = {
        user: {
          firstName: 'Joel',
          lastName: 'Moss',
          get fullName() {
            return [this.firstName, this.lastName].join(' ')
          }
        }
      }
      const spy = jest.spyOn(model.user, 'fullName', 'get')
      store.state = model

      const App = () => {
        const state = useIbiza()
        return (
          <>
            <h1>fullName[{state.user.fullName}]</h1>
            <button onClick={() => (state.user.firstName = 'Ash')}>click</button>
          </>
        )
      }

      render(<App />)

      screen.getByText('fullName[Joel Moss]')
      expect(spy).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('fullName[Ash Moss]')
      expect(spy).toHaveBeenCalledTimes(2)
    })

    it.todo('Mutating nested state should not re-render sibling comp')
  })
})

describe('functions (actions)', () => {
  test('functions can set state', async () => {
    let renderCount = 0
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
      renderCount++
      return (
        <>
          <h1>Count is [{state.count}]</h1>
          <button onClick={state.increment}>Increment</button>
          <button onClick={state.decrement}>Decrement</button>
        </>
      )
    }

    render(<App />)

    screen.getByText('Count is [1]')

    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))

    await screen.findByText('Count is [2]')

    fireEvent.click(screen.getByRole('button', { name: 'Decrement' }))

    await screen.findByText('Count is [1]')
    expect(renderCount).toBe(3)
  })

  test('nesting', async () => {
    let renderCount = 0
    const App = () => {
      const state = useIbiza({
        count: 1,
        nested: {
          increment: state => {
            ++state.count
          },
          decrement: function (state) {
            --state.count
          }
        }
      })
      renderCount++
      return (
        <>
          <h1>Count is [{state.count}]</h1>
          <button onClick={state.nested.increment}>Increment</button>
          <button onClick={state.nested.decrement}>Decrement</button>
        </>
      )
    }

    render(<App />)

    screen.getByText('Count is [1]')

    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))

    await screen.findByText('Count is [2]')

    fireEvent.click(screen.getByRole('button', { name: 'Decrement' }))

    await screen.findByText('Count is [1]')
    expect(renderCount).toBe(3)
  })

  it('should not re-render when using state in a function', async () => {
    let renderCount = 0
    const App = () => {
      const state = useIbiza({
        count: 0,
        increment: function (state) {
          return this.count + state.count
        }
      })
      renderCount++
      return (
        <>
          <h1>Hello</h1>
          <button onClick={state.increment}>Increment</button>
        </>
      )
    }

    render(<App />)

    fireEvent.click(screen.getByRole('button'))

    await expect(renderCount).toBe(1)
  })

  it('accept a payload', () => {
    store.state = {
      count: 0,
      incrementBy(state, payload) {
        state.count = state.count + payload
      },
      user: { name: 'Joel' },
      setName({ user }) {
        user.name = 'Joel Moss'
      }
    }

    const { result } = renderHook(() => useIbiza())

    hookAct(() => void result.current.incrementBy(3))
    hookAct(() => void result.current.setName())

    expect(result.current.user.name).toBe('Joel Moss')
    expect(result.current.count).toBe(3)
  })

  it('can call other functions', () => {
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

  it('can get outside state', () => {
    const { result } = renderHook(() =>
      useIbiza({
        username: 'Joel',
        counter: {
          count: 0,
          nameAndCount(state) {
            return `${state.username}+${this.count}`
          }
        }
      })
    )

    expect(result.current.counter.nameAndCount()).toBe('Joel+0')
  })

  it('can set outside state', async () => {
    store.state = {
      username: 'Joel',
      counter: {
        count: 0,
        setUsername(state) {
          state.username = 'Ash'
        }
      }
    }

    let renderCountApp = 0
    const App = () => {
      renderCountApp++
      return (
        <>
          <Username />
          <Counter />
        </>
      )
    }
    let renderCountUsername = 0
    const Username = () => {
      renderCountUsername++
      const state = useIbiza()
      return <div>username=[{state.username}]</div>
    }
    let renderCountCounter = 0
    const Counter = () => {
      renderCountCounter++
      const state = useIbiza('counter')
      return (
        <>
          <div>count=[{state.count}]</div>
          <button onClick={state.setUsername}>click</button>
        </>
      )
    }

    render(<App />)

    screen.getByText('username=[Joel]')

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('username=[Ash]')
    expect(renderCountApp).toBe(1)
    expect(renderCountUsername).toBe(2)
    expect(renderCountCounter).toBe(1)
  })

  test('async functions can change state before and after the async call', async () => {
    store.state = {
      count: 0,
      increment: async state => {
        ++state.count
        await resolveAfter({}, 100)
        ++state.count
      }
    }

    let renderCount = 0
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <>
          <h1>Hello{state.count}</h1>
          <button onClick={state.increment}>Increment</button>
        </>
      )
    }

    render(<App />)

    screen.getByText('Hello0')

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Hello1')
    expect(store.state.count).toBe(1)

    await act(() => new Promise(res => setTimeout(res, 200)))

    await screen.findByText('Hello2')
    expect(store.state.count).toBe(2)

    expect(renderCount).toEqual(3)
  })
})

describe('URL backed state', () => {
  it('suspends on fetch', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function User() {
      const user = useIbiza('/user')
      return <div>{user.name}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot('"fallback"')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"Joel Moss"')
    expect(fetchSpy).toBeCalledTimes(1)
  })

  it('URL with search params', async () => {
    function User() {
      const user = useIbiza('/user?')
      return <div>/user.name=[{user.name}]</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    render(<App />)

    await act(() => new Promise(res => setTimeout(res, 150)))

    screen.getByText('/user.name=[Joel Moss]')

    act(() => {
      store.state['/user?'] = { name: 'Ash Moss' }
    })

    await screen.findByText('/user.name=[Ash Moss]')
  })

  it('throws on failed fetch', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function User() {
      const user = useIbiza('/user_with_404_on_get')
      return <div>{user.name}</div>
    }
    const App = () => {
      return (
        <ErrorBoundary fallback={<div>error!</div>}>
          <Suspense fallback={<div>fallback</div>}>
            <User />
          </Suspense>
        </ErrorBoundary>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot('"fallback"')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"error!"')
    expect(fetchSpy).toBeCalledTimes(1)
  })

  it('rerenders on used and changed prop', async () => {
    function User() {
      const user = useIbiza('/user')
      return <div>/user.name=[{user.name}]</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    render(<App />)

    await act(() => new Promise(res => setTimeout(res, 150)))

    screen.getByText('/user.name=[Joel Moss]')

    act(() => {
      store.state['/user'].name = 'Ash Moss'
    })

    await screen.findByText('/user.name=[Ash Moss]')
  })

  it('can access from outside before/while fetching', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function User() {
      const user = useIbiza('/user')
      return <div>{user.name}</div>
    }
    function Comment() {
      const state = useIbiza({
        comment: {
          body: 'A comment',
          read(state) {
            return `${this.body} by ${state['/user'].name}`
          }
        }
      })
      return <div>{state.comment.read()}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
          <Comment />
        </Suspense>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot('"fallback"')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"Joel MossA comment by Joel Moss"')
    expect(fetchSpy).toBeCalledTimes(1)
  })

  it('can access from deep state', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function Comment() {
      const state = useIbiza({
        comment: {
          body: 'A comment',
          read(state) {
            return `${this.body} by ${state['/user'].name}`
          }
        }
      })
      return <div>{state.comment.read()}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <Comment />
        </Suspense>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot('"fallback"')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"A comment by Joel Moss"')
    expect(fetchSpy).toBeCalledTimes(1)
  })

  it('fetches only once', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function User() {
      const user = useIbiza('/user')
      return <div>{user.name}</div>
    }
    const App = () => {
      const [count, setCount] = useState(0)
      return (
        <>
          <Suspense fallback={<div>fallback</div>}>
            <User />
          </Suspense>
          <p>Count[{count}]</p>
          <button onClick={() => setCount(1)}>count</button>
        </>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot('"fallbackCount[0]count"')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"Joel MossCount[0]count"')

    fireEvent.click(await screen.findByRole('button'))

    await screen.findByText('Count[1]')
    expect(fetchSpy).toBeCalledTimes(1)
  })

  it('will refetch if store.fetches entry does not exist', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function User() {
      const user = useIbiza('/user')
      return <>{user.name}</>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    const { rerender, container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot('"fallback"')

    await act(() => new Promise(res => setTimeout(res, 150)))

    expect(container.textContent).toMatchInlineSnapshot('"Joel Moss"')
    expect(fetchSpy).toBeCalledTimes(1)

    act(() => {
      delete store.fetches['/user']
    })

    rerender(<App />)

    await screen.findByText('fallback')

    await act(() => new Promise(res => setTimeout(res, 150)))

    await screen.findByText('Joel Moss')
    expect(fetchSpy).toBeCalledTimes(2)
  })

  test('.refetch', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function User() {
      const user = useIbiza('/user')
      return (
        <>
          <div>{user.name}</div>
          <button onClick={() => (user.name = 'Ash Moss')}>click</button>
          <button onClick={() => user.refetch()}>refetch</button>
        </>
      )
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    render(<App />)

    screen.getByText('fallback')

    await act(() => new Promise(res => setTimeout(res, 150)))

    screen.getByText('Joel Moss')
    expect(fetchSpy).toBeCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'click' }))

    await screen.findByText('Ash Moss')
    expect(fetchSpy).toBeCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'refetch' }))

    await screen.findByText('Joel Moss')
    expect(fetchSpy).toBeCalledTimes(2)
  })

  test('.__fetcher', async () => {
    function User() {
      const user = useIbiza('/user')
      return <div>{user.name}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    render(<App />)

    await act(() => new Promise(res => setTimeout(res, 150)))

    expect(store.state['/user'].__fetcher).toEqual({
      status: 'success',
      response: { name: 'Joel Moss' }
    })
  })

  it.skip('refetch should rerender only on changed props', async () => {
    let renderCountName = 0
    function Name() {
      const user = useIbiza('/user_will_change')
      renderCountName++
      return <div>name=[{user.name}]</div>
    }
    let renderCountAge = 0
    function Age() {
      const user = useIbiza('/user_will_change')
      renderCountAge++
      return <div>age=[{user.age}]</div>
    }
    let renderCountApp = 0
    const App = () => {
      renderCountApp++
      return (
        <Suspense fallback={<div>fallback</div>}>
          <Name />
          <Age />
        </Suspense>
      )
    }

    render(<App />)

    screen.getByText('fallback')

    await act(() => new Promise(res => setTimeout(res, 150)))

    await screen.findByText('name=[Joel Moss]')
    await screen.findByText('age=[43]')

    act(() => {
      store.state['/user_will_change'].age = 23
    })

    await screen.findByText('name=[Joel Moss]')
    await screen.findByText('age=[23]')
    expect(renderCountApp).toBe(1)
    expect(renderCountName).toBe(1)
    expect(renderCountAge).toBe(2)

    act(() => {
      store.state['/user_will_change'].refetch()
    })

    await screen.findByText('name=[Ash Moss]')
    await screen.findByText('age=[23]')
    expect(renderCountApp).toBe(1)
    expect(renderCountName).toBe(2)
    expect(renderCountAge).toBe(2)
  })

  it('can get URL prop from a getter', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      get user() {
        return this['/user']
      }
    }

    function User() {
      const state = useIbiza()
      return <div>{state.user.name}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    const { container } = render(<App />)

    expect(container.textContent).toMatchInlineSnapshot('"fallback"')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"Joel Moss"')
    expect(fetchSpy).toBeCalledTimes(1)
  })

  describe('.save', () => {
    it('updates state from response', async () => {
      function User() {
        const user = useIbiza('/user')
        return (
          <>
            <div>user.name=[{user.name}]</div>
            <button onClick={() => user.save()}>save</button>
          </>
        )
      }
      const App = () => {
        return (
          <Suspense fallback={<div>fallback</div>}>
            <User />
          </Suspense>
        )
      }

      render(<App />)

      screen.getByText('fallback')
      await act(() => new Promise(res => setTimeout(res, 150)))
      screen.getByText('user.name=[Joel Moss]')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('user.name=[Ash Moss]')
    })

    it('catches fetch error', async () => {
      function User() {
        const [error, setError] = useState()
        const user = useIbiza('/user_with_404_on_save')
        const save = async () => {
          try {
            await user.save()
          } catch (error) {
            setError(error.message)
          }
        }
        return (
          <>
            <div>user.name=[{user.name}]</div>
            <div>error=[{error}]</div>
            <button onClick={save}>save</button>
          </>
        )
      }
      const App = () => {
        return (
          <Suspense fallback={<div>fallback</div>}>
            <User />
          </Suspense>
        )
      }

      render(<App />)

      screen.getByText('fallback')
      await act(() => new Promise(res => setTimeout(res, 150)))

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('error=[Not Found]')
    })
  })

  //   it.todo('can pass params')
  //   // useIbiza(['/user', { foo: 'bar' }])
})

describe('query()', () => {
  it('re-renders on changed dependencies', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      id: 1,
      user: query(function () {
        return `/users/${this.id}`
      })
    }

    function User() {
      const { user } = useIbiza()
      return <div>{user.name}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    render(<App />)

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')

    act(() => void (store.state.id = 2))

    await screen.findByText('Joel2 Moss2')
    expect(fetchSpy).toBeCalledTimes(2)
  })

  it('does not refetch on re-render', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      id: 1,
      user: query(function () {
        return `/users/${this.id}`
      })
    }

    function User() {
      const { user } = useIbiza()
      return <div>{user.name}</div>
    }
    const App = () => {
      const [count, setCount] = useState(0)
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
          <button onClick={() => setCount(2)}>click</button>
        </Suspense>
      )
    }

    render(<App />)

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Joel Moss')
    expect(fetchSpy).toBeCalledTimes(1)
  })

  test('is proxied', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      id: 1,
      user: query(function () {
        return `/users/${this.id}`
      })
    }

    function User() {
      const { user } = useIbiza()
      return <div>{user.name}</div>
    }
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    render(<App />)

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')
    expect(store.state.user.isProxy).toBe(true)
  })
})

it.skip('full proxy', () => {
  const obj = ['ash']
  const proxy = new Proxy(obj, {
    get() {
      console.log('get', ...arguments)
      return Reflect.get(...arguments)
    },
    set() {
      console.log('set', ...arguments)
      return Reflect.set(...arguments)
    },
    // defineProperty() {
    //   console.log('defineProperty', ...arguments)
    //   return Reflect.defineProperty(...arguments)
    // },
    has() {
      console.log('has', ...arguments)
      return Reflect.has(...arguments)
    },
    ownKeys() {
      console.log('ownKeys', ...arguments)
      return Reflect.ownKeys(...arguments)
    }
  })

  proxy.length
  // proxy.push('elijah')
  // console.log(proxy.length)
  // delete proxy[1]
  // console.log(proxy.length)
})
