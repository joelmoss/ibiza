import { render, act, screen, fireEvent } from '@testing-library/react'
import { Suspense, useState } from 'react'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { useIbiza, store, query, accessor, createAccessor } from 'ibiza'

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

describe('createAccessor()', () => {
  it('can be get and set', async () => {
    store.state = { id: 1 }
    createAccessor(store.state, 'user')

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
    store.state = { id: 1 }
    createAccessor(store.state, 'user', {
      initialValue: { name: 'Joel' }
    })

    function App() {
      const model = useIbiza()
      return <div>user.name=[{model.user.name}]</div>
    }

    render(<App />)

    screen.getByText('user.name=[Joel]')
  })

  test('onGet/onSet callbacks', async () => {
    store.state = { id: 1 }
    const accessorOptions = {
      initialValue: 'Joel',
      onGet(v) {
        return `${v}(${this.id})`
      },
      onSet(oldV, newV) {}
    }
    createAccessor(store.state, 'user', accessorOptions)

    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')
    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    function App() {
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[Joel(1)]')
    expect(onGetSpy).toBeCalledTimes(1)
    expect(onSetSpy).toBeCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ash(1)]')
    expect(onGetSpy).toBeCalledTimes(3)
    expect(onSetSpy).toBeCalledTimes(1)
  })

  test('onSet with setValue()', async () => {
    store.state = {}
    const accessorOptions = {
      initialValue: 'Joel',
      onSet(oldV, newV, setValue) {
        setValue(`${newV}ley`)
      }
    }
    createAccessor(store.state, 'user', accessorOptions)

    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    function App() {
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[Joel]')
    expect(onSetSpy).toBeCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ashley]')
    expect(onSetSpy).toBeCalledTimes(1)
  })
})

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
      onSet(oldV, newV) {}
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
    expect(onGetSpy).toBeCalledTimes(1)
    expect(onSetSpy).toBeCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ash(1)]')
    expect(onGetSpy).toBeCalledTimes(3)
    expect(onSetSpy).toBeCalledTimes(1)
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
    expect(onSetSpy).toBeCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ashley]')
    expect(onSetSpy).toBeCalledTimes(1)
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
      const model = useIbiza()
      return <div>Hello</div>
    }

    render(<App />)

    expect(onSetSpy).toBeCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    expect(store.state.user).toEqual('Ashley')
    expect(onSetSpy).toBeCalledTimes(1)
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

    expect(onSetSpy).toBeCalledTimes(0)
    expect(onGetSpy).toBeCalledTimes(1)
    screen.getByText('user.name=[Joel]')

    act(() => void (store.state.user = 2))

    expect(onSetSpy).toBeCalledTimes(1)
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

    expect(onSetSpy).toBeCalledTimes(0)
    expect(onGetSpy).toBeCalledTimes(1)
    screen.getByText('user.name=[Joel]')

    act(() => void (store.state.users[0].name = 'Joely'))

    expect(onSetSpy).toBeCalledTimes(0)
    await screen.findByText('user.name=[Joely]')
  })
})

describe('query()', () => {
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
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <Users />
        </Suspense>
      )
    }

    render(<App />)

    screen.getByText('fallback')
    await screen.findByText('1[Joel1 Moss1]')
    await screen.findByText('2[Joel2 Moss2]')

    act(() => void (store.state.page = 2))

    await screen.findByText('3[Joel3 Moss3]')
    await screen.findByText('4[Joel4 Moss4]')

    act(() => void (store.state.page = 1))

    await screen.findByText('1[Joel1 Moss1]')
    await screen.findByText('2[Joel2 Moss2]')

    expect(fetchSpy).toBeCalledTimes(2)
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
    const App = () => {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    render(<App />)

    // screen.getByText('fallback')
    await screen.findByText('not loaded')

    act(() => void (store.state.id = 1))

    await screen.findByText('Joel Moss')
    expect(fetchSpy).toBeCalledTimes(1)
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

describe('query and accessor', () => {
  // Not re-rendering after `parent` prop is mutated!
  xit('should call query on changed accessor dependency', async () => {
    const accessorOptions = {
      initialValue: 1,
      onGet(value) {
        console.log('parent.onGet()', value)
        // return value
        return this.parents.find(x => x.id === value)
      },
      onSet(old, value, setValue) {
        // console.log('parent.onSet()', value)
        // setValue(this.parents.find(x => x.id === value))
      }
    }
    const fetchSpy = jest.spyOn(store, 'fetchFn')

    store.debug = true
    store.state = {
      parents: [{ id: 1 }, { id: 2 }],
      parent: accessor(accessorOptions),
      user: query(function () {
        console.trace('query(user)', this.parent)
        return `/users/${this.parent.id}`
      })
    }

    function User() {
      const model = useIbiza()
      console.log('<User>')
      return <div>{model.user.name}</div>
    }
    function App() {
      return (
        <Suspense fallback={<div>fallback</div>}>
          <User />
        </Suspense>
      )
    }

    render(<App />)

    screen.getByText('fallback')
    await screen.findByText('Joel Moss')

    act(() => void (store.state.parent = 2))

    await screen.findByText('Joel2 Moss2')
    expect(fetchSpy).toBeCalledTimes(2)
  })
})
