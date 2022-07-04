import { render, act, fireEvent, screen } from '@testing-library/react'
import React, { Fragment, Suspense, useState } from 'react'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { ErrorBoundary } from 'react-error-boundary'
import { useIbiza, query, accessor, createModel, store } from 'ibiza'
import { isProxy } from '../src/store'

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

  rest.get('/users/page=1', async (req, res, ctx) => {
    return res(
      ctx.delay(100),
      ctx.json([
        { id: 1, name: 'Joel1 Moss1' },
        { id: 2, name: 'Joel2 Moss2' }
      ])
    )
  }),
  rest.get('/users/page=2', async (req, res, ctx) => {
    return res(
      ctx.delay(100),
      ctx.json([
        { id: 3, name: 'Joel3 Moss3' },
        { id: 4, name: 'Joel4 Moss4' }
      ])
    )
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

it('suspends on fetch', async () => {
  const fetchSpy = jest.spyOn(store, 'fetchFn')

  function User() {
    const user = useIbiza('/user')
    return <div>{user.name}</div>
  }

  render(
    <Suspense fallback={<div>fallback</div>}>
      <User />
    </Suspense>
  )

  screen.getByText('fallback')
  await screen.findByText('Joel Moss')
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})

it('nested url prop', async () => {
  const fetchSpy = jest.spyOn(store, 'fetchFn')
  store.state = { users: {} }

  function User() {
    const user = useIbiza('users./user')
    return <div>{user.name}</div>
  }

  render(
    <Suspense fallback={<div>fallback</div>}>
      <User />
    </Suspense>
  )

  screen.getByText('fallback')
  await screen.findByText('Joel Moss')
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})

it('merges initial state', async () => {
  function User({ age }) {
    const user = useIbiza('/user', { age })
    return (
      <ul>
        <li>user.name=[{user.name}]</li>
        <li>user.age=[{user.age}]</li>
      </ul>
    )
  }
  const App = ({ age = 1 }) => {
    return (
      <Suspense fallback={<div>fallback</div>}>
        <User age={age} />
      </Suspense>
    )
  }

  render(<App />)

  await screen.findByText('user.name=[Joel Moss]')
  screen.getByText('user.age=[1]')
})

it('arguments are memoized and ignored on subsequent calls', async () => {
  function User({ age }) {
    const user = useIbiza('/user', { age })
    return (
      <ul>
        <li>user.name=[{user.name}]</li>
        <li>user.age=[{user.age}]</li>
      </ul>
    )
  }
  const App = ({ age = 1 }) => {
    return (
      <Suspense fallback={<div>fallback</div>}>
        <User age={age} />
      </Suspense>
    )
  }

  const { rerender } = render(<App />)

  await act(() => new Promise(res => setTimeout(res, 150)))

  screen.getByText('user.name=[Joel Moss]')
  screen.getByText('user.age=[1]')

  rerender(<App age={2} />)

  await screen.findByText('user.name=[Joel Moss]')
  await screen.findByText('user.age=[1]')
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
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const fetchSpy = jest.spyOn(store, 'fetchFn')

  function User() {
    const user = useIbiza('/user_with_404_on_get')
    return <div>{user.name}</div>
  }

  render(
    <ErrorBoundary fallback={<div>error!</div>}>
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    </ErrorBoundary>
  )

  screen.getByText('fallback')
  await screen.findByText('error!')
  expect(console.error).toHaveBeenCalledTimes(3)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})

it('rerenders on used and changed prop', async () => {
  function User() {
    const user = useIbiza('/user')
    return <div>/user.name=[{user.name}]</div>
  }

  render(
    <Suspense fallback={<div>fallback</div>}>
      <User />
    </Suspense>
  )

  await screen.findByText('/user.name=[Joel Moss]')

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

  screen.getByText('fallback')
  await act(() => new Promise(res => setTimeout(res, 150)))
  expect(container.textContent).toMatchInlineSnapshot('"Joel MossA comment by Joel Moss"')
  expect(fetchSpy).toHaveBeenCalledTimes(1)
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

  render(
    <Suspense fallback={<div>fallback</div>}>
      <Comment />
    </Suspense>
  )

  screen.getByText('fallback')
  await screen.findByText('A comment by Joel Moss')
  expect(fetchSpy).toHaveBeenCalledTimes(1)
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
  expect(fetchSpy).toHaveBeenCalledTimes(1)
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

  const { rerender } = render(<App />)

  screen.getByText('fallback')
  await screen.findByText('Joel Moss')
  expect(fetchSpy).toHaveBeenCalledTimes(1)

  act(() => {
    delete store.fetches['/user']
  })

  rerender(<App />)

  await screen.findByText('fallback')

  await act(() => new Promise(res => setTimeout(res, 150)))

  await screen.findByText('Joel Moss')
  expect(fetchSpy).toHaveBeenCalledTimes(2)
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

  render(
    <Suspense fallback={<div>fallback</div>}>
      <User />
    </Suspense>
  )

  screen.getByText('fallback')
  await screen.findByText('Joel Moss')
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})

describe('.refetch', () => {
  test('with URL prop', async () => {
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
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'click' }))

    await screen.findByText('Ash Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'refetch' }))

    await screen.findByText('Joel Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  test.skip('with query() helper', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')
    store.state = {
      user: query(() => '/user')
    }

    function User() {
      const { user } = useIbiza()
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
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'click' }))

    await screen.findByText('Ash Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'refetch' }))

    await screen.findByText('Joel Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('.save', () => {
  it.skip('with query() helper', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')
    // store.debug = true
    store.state = {
      user: query(() => '/user')
    }

    function User() {
      const { user } = useIbiza()
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
    await screen.findByText('user.name=[Joel Moss]')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('user.name=[Ash Moss]')
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button'))
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it.todo('sends patch request with current prop value')

  it('updates state from response', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

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
    await screen.findByText('user.name=[Joel Moss]')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button'))
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    await screen.findByText('user.name=[Ash Moss]')

    fireEvent.click(screen.getByRole('button'))

    await act(() => new Promise(res => setTimeout(res, 150)))

    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it.skip('accepts a fetch `init` argument', async () => {
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
    await screen.findByText('user.name=[Joel Moss]')

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

it('slicing', async () => {
  const Comment = () => {
    const comment = useIbiza('/post.comment')
    return <h1>{comment.body}</h1>
  }

  render(
    <Suspense fallback={<div>fallback</div>}>
      <Comment />
    </Suspense>
  )

  screen.getByText('fallback')
  await screen.findByText('comment#1')

  act(() => {
    store.state['/post'].comment.body = 'new comment'
  })

  await screen.findByText('new comment')
})

describe('createModel()', () => {
  it('fetches from the server', async () => {
    const useUser = createModel('/user')
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function User1() {
      const user = useUser()
      return <div>User1=[{user.name}]</div>
    }
    function User2() {
      const user = useUser()
      return <div>User2=[{user.name}]</div>
    }

    const { container } = render(
      <Suspense fallback={<div>fallback</div>}>
        <User1 />
        <User2 />
      </Suspense>
    )

    screen.getByText('fallback')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"User1=[Joel Moss]User2=[Joel Moss]"')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('accepts a custom fetch function option', async () => {
    const customFetch = jest.fn(store.fetchFn)
    const useUser = createModel('/user', {}, { fetcher: customFetch })

    function User1() {
      const user = useUser()
      return <div>User1=[{user.name}]</div>
    }
    function User2() {
      const user = useUser()
      return <div>User2=[{user.name}]</div>
    }

    const { container } = render(
      <Suspense fallback={<div>fallback</div>}>
        <User1 />
        <User2 />
      </Suspense>
    )

    expect(container.textContent).toMatchInlineSnapshot('"fallback"')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"User1=[Joel Moss]User2=[Joel Moss]"')
    expect(customFetch).toHaveBeenCalledTimes(1)
  })

  it('model definition accepts server response', async () => {
    const useUser = createModel('/user', data => {
      const [firstName, lastName] = data.name.split(' ')

      return {
        firstName,
        lastName
      }
    })
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    function User() {
      const user = useUser()
      return (
        <div>
          {user.firstName} {user.lastName}
        </div>
      )
    }

    render(
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    )

    screen.getByText('fallback')

    await act(() => new Promise(res => setTimeout(res, 150)))

    await screen.findByText('Joel Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('query()', () => {
  it('suspends on fetch', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      user: query(function () {
        return '/users/1'
      })
    }

    function User() {
      const { user } = useIbiza()
      return <div>{user.name}</div>
    }

    render(
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    )

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('throws on failed fetch', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      user: query(function () {
        return '/user_with_404_on_get'
      })
    }

    function User() {
      const { user } = useIbiza()
      return <div>{user.name}</div>
    }

    render(
      <ErrorBoundary fallback={<div>error!</div>}>
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      </ErrorBoundary>
    )

    screen.getByText('fallback')
    await screen.findByText('error!')
    expect(console.error).toHaveBeenCalledTimes(3)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('caches', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      page: 1,
      users: query(function () {
        return `/users/page=${this.page}`
      })
    }

    function Users() {
      const { users } = useIbiza()
      return (
        <div>
          {users.map((user, i) => (
            <div key={i}>
              {user.id}[{user.name}]
            </div>
          ))}
        </div>
      )
    }

    render(
      <Suspense fallback={<div>fallback</div>}>
        <Users />
      </Suspense>
    )

    screen.getByText('fallback')
    await screen.findByText('1[Joel1 Moss1]')
    await screen.findByText('2[Joel2 Moss2]')

    act(() => void (store.state.page = 2))

    await screen.findByText('3[Joel3 Moss3]')
    await screen.findByText('4[Joel4 Moss4]')

    act(() => void (store.state.page = 1))

    await screen.findByText('1[Joel1 Moss1]')
    await screen.findByText('2[Joel2 Moss2]')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

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

    render(
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    )

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')

    act(() => void (store.state.id = 2))

    await screen.findByText('Joel2 Moss2')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('does not fetch on returning non-string', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      id: null,
      user: query(function () {
        return this.id ? `/users/${this.id}` : false
      })
    }

    function User() {
      const { user } = useIbiza()
      return <div>{user.name || 'not loaded'}</div>
    }

    render(
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    )

    // screen.getByText('fallback')
    await screen.findByText('not loaded')

    act(() => void (store.state.id = 1))

    await screen.findByText('Joel Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
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
      const [, setCount] = useState(0)
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
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('is proxied', async () => {
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

    render(
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    )

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')
    expect(store.state.user[isProxy]).toBe(true)
  })

  it('allows mutating', async () => {
    store.state = {
      user: query(function () {
        return '/users/1'
      })
    }

    function User() {
      const { user } = useIbiza()
      return <div>/user.name=[{user.name}]</div>
    }

    render(
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    )

    await screen.findByText('/user.name=[Joel Moss]')

    act(() => {
      store.state.user.name = 'Ash Moss'
    })

    await screen.findByText('/user.name=[Ash Moss]')
  })

  it('can access from outside before/while fetching', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      userId: 1,
      user: query(function () {
        return `/users/${this.userId}`
      })
    }

    function User() {
      const { user } = useIbiza()
      return <h1>{user.name}</h1>
    }
    function Comment() {
      const state = useIbiza({
        comment: {
          body: 'A comment',
          get read() {
            return `${this.body} by ${this.$root.user.name}`
          }
        }
      })
      return <h2>{state.comment.read}</h2>
    }

    render(
      <Suspense fallback={<div>fallback</div>}>
        <User />
        <Comment />
      </Suspense>
    )

    screen.getByText('fallback')
    await screen.findByText('Joel Moss', { selector: 'h1' })
    await screen.findByText('A comment by Joel Moss', { selector: 'h2' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    act(() => {
      store.state.userId = 2
    })

    await screen.findByText('Joel2 Moss2', { selector: 'h1' })
    await screen.findByText('A comment by Joel2 Moss2', { selector: 'h2' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    act(() => {
      store.state.user.name = 'Bob Bones'
    })

    await screen.findByText('Bob Bones', { selector: 'h1' })
    await screen.findByText('A comment by Bob Bones', { selector: 'h2' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('will refetch if store.fetches entry does not exist', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.state = {
      user: query(function () {
        return '/users/1'
      })
    }

    function User() {
      const { user } = useIbiza()
      return <>{user.name}</>
    }
    function App() {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    const { rerender } = render(<App />)

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    act(() => {
      delete store.fetches['/users/1']
    })

    rerender(<App />)

    await screen.findByText('fallback')
    await screen.findByText('Joel Moss')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('query and accessor', () => {
  it('should call query on changed accessor dependency', async () => {
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    // store.debug = true
    store.state = {
      parents: [{ id: 1 }, { id: 2 }],
      parent: accessor({
        initialValue: 1,
        onGet(value) {
          return this.parents.find(x => x.id === value)
        }
      }),
      user: query(function () {
        return `/users/${this.parent.id}`
      })
    }

    function User() {
      const model = useIbiza()
      return <div>{model.user.name}</div>
    }

    render(
      <Suspense fallback={<div>fallback</div>}>
        <User />
      </Suspense>
    )

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')

    act(() => void (store.state.parent = 2))

    await screen.findByText('Joel2 Moss2')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
