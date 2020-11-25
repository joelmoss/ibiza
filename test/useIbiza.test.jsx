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
  store.debug = false
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
    const state = useIbiza(null)
    return <h1>Count is [{state.count}]</h1>
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Count is []')

  await wait(() => expect(renderCount.current.App.value).toBe(1))

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

describe('arrays', () => {
  it('add element', async () => {
    store.merge({ children: [{ name: 'Ash' }] })

    const App = () => {
      const state = useIbiza()
      return (
        <ul>
          {state.children.map((child, i) => (
            <li key={i}>Child[{child.name}]</li>
          ))}
        </ul>
      )
    }

    const { renderCount } = perf(React)
    render(<App />)
    screen.getByText('Child[Ash]')

    await wait(() => expect(renderCount.current.App.value).toBe(1))

    act(() => {
      store.state.children.push({ name: 'Elijah' })
    })

    await screen.findByText('Child[Ash]')
    await screen.findByText('Child[Elijah]')

    await wait(() => expect(renderCount.current.App.value).toBe(2))
  })

  it('remove element', async () => {
    store.merge({ children: [{ name: 'Ash' }, { name: 'Elijah' }] })

    const App = () => {
      const state = useIbiza()
      return (
        <ul>
          {state.children.map((child, i) => (
            <li key={i}>Child[{child.name}]</li>
          ))}
        </ul>
      )
    }

    const { renderCount } = perf(React)
    const { container } = render(<App />)

    screen.getByText('Child[Ash]')
    screen.getByText('Child[Elijah]')

    await wait(() => expect(renderCount.current.App.value).toBe(1))

    act(() => {
      delete store.state.children[1]
    })

    await screen.findByText('Child[Ash]')
    expect(container).not.toHaveTextContent('Child[Elijah]')

    await wait(() => expect(renderCount.current.App.value).toBe(2))
  })
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
      user: {
        firstName: 'Joel',
        get name() {
          return `${this.user.firstName} Moss`
        }
      }
    })

    return <h1>Name is {state.user.name}</h1>
  }

  const { renderCount } = perf(React)
  render(<App />)

  screen.getByText('Name is Joel Moss')

  act(() => {
    store.state.user.firstName = 'Ash'
  })

  await screen.findByText('Name is Ash Moss')
  await wait(() => expect(renderCount.current.App.value).toBe(2))
})

describe('slicing', () => {
  describe('read', () => {
    it('throws on get of single property', () => {
      store.merge({ firstName: 'Joel' })

      const App = () => {
        const firstName = useIbiza('firstName')
        return <h1>{firstName}</h1>
      }

      expect(() => {
        render(<App />)
      }).toThrow()
    })

    it('throws on get of nested single property', () => {
      store.merge({ nested: { firstName: 'Joel' } })

      const App = () => {
        const firstName = useIbiza('nested.firstName')
        return <h1>{firstName}</h1>
      }

      expect(() => {
        render(<App />)
      }).toThrow()
    })

    it('throws on get of function', () => {
      store.merge({ nested: { eatTheWorld: () => {} } })

      const App = () => {
        const eatTheWorld = useIbiza('nested.eatTheWorld')
        return <h1>Hello</h1>
      }

      expect(() => {
        render(<App />)
      }).toThrow()
    })

    it('object', () => {
      store.merge({ firstName: 'Joel', children: [{ firstName: 'Ash' }, { firstName: 'Elijah' }] })

      const { result } = renderHook(() => useIbiza('children.1'))

      expect(result.current).toEqual({ firstName: 'Elijah' })
      expect(result.current.isProxy).toBe(true)
    })

    it('function', () => {
      const mockFn = jest.fn()
      store.merge({ nested: { eatTheWorld: mockFn } })

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
      store.merge(model)

      const App = () => {
        const state = useIbiza('nested')
        return <>Hello {state.eatTheWorld}</>
      }

      render(<App />)

      screen.getByText('Hello World')
      expect(spy).toBeCalledTimes(1)
    })

    it('getter direct access', () => {
      const model = {
        nested: {
          get eatTheWorld() {
            return 'World'
          }
        }
      }
      const spy = jest.spyOn(model.nested, 'eatTheWorld', 'get')
      store.merge(model)

      const App = () => {
        const eatTheWorld = useIbiza('nested.eatTheWorld')
        return <>Hello {eatTheWorld}</>
      }

      render(<App />)

      screen.getByText('Hello World')
      expect(spy).toBeCalledTimes(1)
    })

    it('array', () => {
      store.merge({ name: 'Joel', nested: { children: [{ name: 'Ash' }, { name: 'Elijah' }] } })

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
    it.skip('single property from outside component', async () => {
      store.merge({ firstName: 'Joel' })

      const App = () => {
        const firstName = useIbiza('firstName')
        return <h1>Hello {firstName}</h1>
      }

      render(<App />)

      screen.getByText('Hello Joel')

      act(() => {
        store.state.firstName = 'Ash'
      })

      await screen.findByText('Hello Ash')
    })

    it.skip('single property from inside component', async () => {
      store.merge({ firstName: 'Joel' })

      const App = () => {
        let firstName = useIbiza('firstName')
        const changeName = useCallback(() => {
          // Must use `store`.
          store.state.firstName = 'Ash'
        }, [])
        return (
          <>
            <h1>Hello {firstName}</h1>
            <button onClick={changeName}>Change name</button>
          </>
        )
      }

      render(<App />)

      screen.getByText('Hello Joel')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('Hello Ash')
    })

    it('nested property should rerender', async () => {
      store.merge({ nested: { name: 'Joel' } })

      const App = () => {
        let state = useIbiza('nested')
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

      const { renderCount } = perf(React)
      render(<App />)

      screen.getByText('App[Joel]')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('App[Ash]')
      await wait(() => expect(renderCount.current.App.value).toBe(2))
    })

    it.skip('should rerender only component use', async () => {
      store.merge({ nested: { count: 0 } })

      const Sibling1 = () => {
        const count = useIbiza('nested.count')
        return <h2>Sibling1[{count}]</h2>
      }
      const Sibling2 = () => {
        const count = useIbiza('nested.count')
        return <h2>Sibling2[{count}]</h2>
      }
      const App = () => {
        let state = useIbiza('nested')
        console.log(state)
        const increment = useCallback(() => {
          state.count = 1
        }, [state])
        return (
          <>
            <h1>App[]</h1>
            {/* <Sibling1 /> */}
            {/* <Sibling2 /> */}
            <button onClick={increment}>Increment</button>
          </>
        )
      }

      const { renderCount } = perf(React)
      render(<App />)

      screen.getByText('App[]')
      // screen.getByText('Sibling1[0]')
      // screen.getByText('Sibling2[0]')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('App[]')
      // await screen.findByText('Sibling1[1]')
      // await screen.findByText('Sibling2[1]')
      await wait(() => expect(renderCount.current.App.value).toBe(1))
      await wait(() => expect(renderCount.current.Sibling1.value).toBe(2))
      // await wait(() => expect(renderCount.current.Sibling2.value).toBe(2))
    })

    it('nested', async () => {
      store.merge({ name: 'Joel', child: { name: 'Ash' } })

      const App = () => {
        let child = useIbiza('child')
        const changeName = useCallback(() => {
          child.name = 'Eve'
        }, [child])
        return (
          <>
            <h1>Hello {child.name}</h1>
            <button onClick={changeName}>Change name</button>
          </>
        )
      }

      render(<App />)

      screen.getByText('Hello Ash')

      fireEvent.click(screen.getByRole('button'))

      await screen.findByText('Hello Eve')
    })

    it.skip('array', async () => {
      store.merge({ name: 'Joel', children: [{ name: 'Ash' }, { name: 'Elijah' }] })

      const App = () => {
        let name = useIbiza('children.0.name')
        const changeName = useCallback(() => {
          // Must use `store`.
          store.state.children[0].name = 'Eve'
        }, [])
        return (
          <>
            <h1>Hello {name}</h1>
            <button onClick={changeName}>Change name</button>
          </>
        )
      }

      render(<App />)

      screen.getByText('Hello Ash')

      fireEvent.click(screen.getByRole('button'))

      console.log(store.state)

      await screen.findByText('Hello Eve')
    })

    it.skip('getter dependency', async () => {
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
      store.merge(model)

      const App = () => {
        const fullName = useIbiza('user.fullName')
        return <h1>fullName[{fullName}]</h1>
      }

      render(<App />)

      screen.getByText('fullName[Joel Moss]')
      expect(spy).toHaveBeenCalledTimes(1)

      act(() => {
        store.state.user.firstName = 'Ash'
      })

      await screen.findByText('fullName[Ash Moss]')
    })

    it.todo('Mutating nested state should not re-render sibling comp')
  })
})

it.todo(
  'Mutating nested state in parent comp that only child uses should not cause parent comp to watch parent state.'
)

it.todo('Defining new object on state should cause re-render')

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

describe('URL backed state', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = jest.fn()

    store.fetchFn = path => {
      fetchSpy()

      const url = new URL(path, location.origin)
      const resource = new Request(url)

      return fetch(resource).then(response => {
        if (!response.ok) {
          throw new Error(`Error (${response.status})`)
        }

        return response.json()
      })
    }
  })

  afterEach(() => {
    fetchSpy = null
  })

  it('fetches from the server', async () => {
    function Section() {
      const user = useIbiza('/user')
      return <div>{user.name}</div>
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
    expect(fetchSpy).toBeCalledTimes(1)
  })

  it('can get URL prop from a getter', async () => {
    store.merge({
      get user() {
        return this['/user']
      }
    })

    function User() {
      const user = useIbiza('user')
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

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot(`"Joel Moss"`)
    expect(fetchSpy).toBeCalledTimes(1)
  })

  it('can set URL prop from a function', async () => {
    store.merge({
      setUser: (state, name) => {
        state['/user'] = { name }
      }
    })

    function User() {
      const user = useIbiza('/user', 'User')
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

    expect(container.textContent).toMatchInlineSnapshot(`"fallback"`)
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot(`"Joel Moss"`)

    act(() => {
      store.state.setUser('new Joel')
    })

    expect(container.textContent).toMatchInlineSnapshot(`"new Joel"`)
  })
})
