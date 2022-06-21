import { render, act, screen, fireEvent } from '@testing-library/react'
import React, { Suspense, useState } from 'react'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { useIbiza, store, query, accessor } from 'ibiza'
import { ErrorBoundary } from 'react-error-boundary'

const server = setupServer(
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

  rest.get('/user_with_404_on_get', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.status(404))
  })
)

beforeAll(() => server.listen())
afterEach(() => {
  store.reset()
  store.debug = false

  jest.clearAllMocks()
  server.resetHandlers()
})
afterAll(() => server.close())

describe('accessor()', () => {
  it('can be get and set', async () => {
    store.state = { id: 1, user: accessor() }

    function App() {
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[]')

    act(() => void (store.state.user = 'Joel'))

    screen.getByText('user=[Joel]')
  })

  it('can define an initialValue', async () => {
    store.state = {
      id: 1,
      user: accessor({
        initialValue: { name: 'Joel' }
      })
    }

    function App() {
      const model = useIbiza()
      return <div>user.name=[{model.user.name}]</div>
    }

    render(<App />)

    screen.getByText('user.name=[Joel]')
  })

  test('onGet/onSet callbacks', async () => {
    const accessorOptions = {
      initialValue: 'Joel',
      onGet(v) {
        return `${v}(${this.id})`
      },
      onSet() {}
    }
    store.state = { id: 1, user: accessor(accessorOptions) }

    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')
    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    function App() {
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[Joel(1)]')
    expect(onGetSpy).toHaveBeenCalledTimes(1)
    expect(onSetSpy).toHaveBeenCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ash(1)]')
    expect(onGetSpy).toHaveBeenCalledTimes(2)
    expect(onSetSpy).toHaveBeenCalledTimes(1)
  })

  test('onSet with setValue()', async () => {
    const accessorOptions = {
      initialValue: 'Joel',
      onSet(oldV, newV, setValue) {
        setValue(`${newV}ley`)
      }
    }
    store.state = { user: accessor(accessorOptions) }

    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    function App() {
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[Joel]')
    expect(onSetSpy).toHaveBeenCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ashley]')
    expect(onSetSpy).toHaveBeenCalledTimes(1)
  })

  it('can access on store state', async () => {
    const accessorOptions = {
      initialValue: 'Joel',
      onGet(value) {
        return value
      },
      onSet() {}
    }
    store.state = { user: accessor(accessorOptions) }

    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')
    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    expect(store.state.user).toBe('Joel')
    expect(onGetSpy).toHaveBeenCalledTimes(1)
    expect(onSetSpy).toHaveBeenCalledTimes(0)

    act(() => void (store.state.user = 'Ashley'))

    expect(store.state.user).toBe('Ashley')
    expect(onGetSpy).toHaveBeenCalledTimes(2)
    expect(onSetSpy).toHaveBeenCalledTimes(1)

    act(() => void (store.state.user = 'Elijah'))

    expect(store.state.user).toBe('Elijah')
    expect(onGetSpy).toHaveBeenCalledTimes(3)
    expect(onSetSpy).toHaveBeenCalledTimes(2)
  })

  it('should set value even if not previously read', async () => {
    const accessorOptions = {
      initialValue: 'Joel',
      onSet(oldV, newV, setValue) {
        setValue(`${newV}ley`)
      }
    }
    store.state = { user: accessor(accessorOptions) }

    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    function App() {
      useIbiza()
      return <div>Hello</div>
    }

    render(<App />)

    expect(onSetSpy).toHaveBeenCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    expect(store.state.user).toBe('Ashley')
    expect(onSetSpy).toHaveBeenCalledTimes(1)
  })

  it('should rerender when setter is called with new value', async () => {
    const accessorOptions = {
      initialValue: 1,
      onGet(value) {
        return this.users.find(x => x.id === value)
      },
      onSet() {}
    }

    store.state = {
      user: accessor(accessorOptions),
      users: [
        { id: 1, name: 'Joel' },
        { id: 2, name: 'Ash' }
      ]
    }

    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')
    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')

    function App() {
      const model = useIbiza()
      return <div>user.name=[{model.user.name}]</div>
    }

    render(<App />)

    expect(onSetSpy).toHaveBeenCalledTimes(0)
    expect(onGetSpy).toHaveBeenCalledTimes(1)
    screen.getByText('user.name=[Joel]')

    act(() => void (store.state.user = 2))

    expect(onSetSpy).toHaveBeenCalledTimes(1)
    await screen.findByText('user.name=[Ash]')
  })

  it('should rerender when dependent prop changes', async () => {
    const accessorOptions = {
      initialValue: 1,
      onGet(value) {
        return this.users.find(x => x.id === value)
      },
      onSet() {}
    }

    store.state = {
      user: accessor(accessorOptions),
      users: [
        { id: 1, name: 'Joel' },
        { id: 2, name: 'Ash' }
      ]
    }

    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')
    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')

    function App() {
      const model = useIbiza()
      return <div>user.name=[{model.user.name}]</div>
    }

    render(<App />)

    expect(onSetSpy).toHaveBeenCalledTimes(0)
    expect(onGetSpy).toHaveBeenCalledTimes(1)
    screen.getByText('user.name=[Joel]')

    act(() => void (store.state.users[0].name = 'Joely'))

    expect(onSetSpy).toHaveBeenCalledTimes(0)
    await screen.findByText('user.name=[Joely]')
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
    expect(store.state.user.isProxy).toBe(true)
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
          read(state) {
            return `${this.body} by ${state.user.name}`
          }
        }
      })
      return <h2>{state.comment.read()}</h2>
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
