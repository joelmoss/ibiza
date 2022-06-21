import { render, fireEvent, act, screen } from '@testing-library/react'
import React, { Suspense } from 'react'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { store, freeze, createModel, createContextModel, IbizaProvider } from 'ibiza'

const server = setupServer(
  rest.get('/post', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ title: 'My First Post' }))
  }),
  rest.get('/user', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Joel Moss' }))
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

it('merges initial state', () => {
  const usePost = createModel('post', (_, props) => ({
    title: 'Post#1',
    ...props
  }))

  const App = () => {
    const state = usePost({ title: 'Post#2' })
    return <h1>state.title=[{state.title}]</h1>
  }

  render(<App />)

  screen.getByText('state.title=[Post#2]')
})

it('merges initial state only once', async () => {
  const usePost = createModel('post', (state, props) => ({
    title: 'Post#1',
    ...props
  }))

  const App = props => {
    const state = usePost(props)
    return <h1>Title is [{state.title}]</h1>
  }

  const { rerender } = render(<App title="Post#2" />)

  screen.getByText('Title is [Post#2]')

  rerender(<App title="Post#3" />)

  await screen.findByText('Title is [Post#2]')
})

it('gets attribute', () => {
  const usePost = createModel('post', {
    title: 'Post#1'
  })

  const App = () => {
    const state = usePost()
    return <h1>state.title=[{state.title}]</h1>
  }

  render(<App />)

  screen.getByText('state.title=[Post#1]')
})

it('sets attribute', () => {
  const usePost = createModel('post', {
    title: 'Post#1'
  })

  const App = () => {
    const state = usePost()
    return <h1>state.title=[{state.title}]</h1>
  }

  render(<App />)

  screen.getByText('state.title=[Post#1]')

  act(() => {
    store.state.post.title = 'Post#2'
  })

  screen.getByText('state.title=[Post#2]')
})

it('can pass slice', async () => {
  const usePost = createModel('post', {
    comment: {
      body: 'a comment'
    }
  })

  const App = () => {
    const comment = usePost('comment')
    return <h1>{comment.body}</h1>
  }

  render(<App />)

  screen.getByText('a comment')

  act(() => {
    store.state.post.comment.body = 'a new comment'
  })

  await screen.findByText('a new comment')
})

test('initial state function should be called once', async () => {
  const meFn = jest.fn(() => ({ me: 'Joel' }))
  const useMe = createModel('me', meFn)

  const Child1 = () => {
    const state = useMe()
    return <h2>Child1.me is [{state.me}]</h2>
  }
  const Child2 = () => {
    const state = useMe()
    return <h2>Child2.me is [{state.me}]</h2>
  }

  render(
    <>
      <Child1 />
      <Child2 />
    </>
  )

  expect(meFn).toBeCalledTimes(1)
  screen.getByText('Child1.me is [Joel]')
  screen.getByText('Child2.me is [Joel]')
})

describe('re-renders on used state', () => {
  test('single component', async () => {
    const useCounter = createModel('counter', {
      count: 0
    })

    let renderCount = 0
    const App = () => {
      const state = useCounter({ foo: 'bah' })
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

  test('multiple components', async () => {
    const meFn = jest.fn(() => ({ me: 'Joel' }))
    const useMe = createModel('me', meFn)

    let renderCountApp = 0
    const App = () => {
      const state = useMe()
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
      const state = useMe()
      renderCountChild1++
      return <h2>Child1.count1 is [{state.count1}]</h2>
    }

    let renderCountChild2 = 0
    const Child2 = () => {
      const state = useMe()
      renderCountChild2++
      return <h2>Child2.count2 is [{state.count2}]</h2>
    }

    render(<App />)

    expect(meFn).toBeCalledTimes(1)
    screen.getByText('Child1.count1 is []')
    screen.getByText('Child2.count2 is []')

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText('Child1.count1 is []')
    await screen.findByText('Child2.count2 is [1]')
    expect(renderCountApp).toBe(1)
    expect(renderCountChild1).toBe(1)
    expect(renderCountChild2).toBe(2)
  })
})

describe('URL backed state', () => {
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

    expect(container.textContent).toMatchInlineSnapshot('"fallback"')
    await act(() => new Promise(res => setTimeout(res, 150)))
    expect(container.textContent).toMatchInlineSnapshot('"User1=[Joel Moss]User2=[Joel Moss]"')
    expect(fetchSpy).toBeCalledTimes(1)
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
    expect(customFetch).toBeCalledTimes(1)
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
    expect(fetchSpy).toBeCalledTimes(1)
  })
})

describe('freezing', () => {
  it('can read', () => {
    const usePost = createModel('post', {
      title: 'Post#1',
      user: freeze({ firstName: 'Joel' })
    })

    const App = () => {
      const state = usePost()
      return <h1>state.user.firstName=[{state.user.firstName}]</h1>
    }

    render(<App />)

    screen.getByText('state.user.firstName=[Joel]')
  })

  it('throws on write', () => {
    const usePost = createModel('post', {
      title: 'Post#1',
      user: freeze({ firstName: 'Joel' })
    })

    const App = () => {
      const state = usePost()
      return <h1>state.user.firstName=[{state.user.firstName}]</h1>
    }

    render(<App />)

    screen.getByText('state.user.firstName=[Joel]')

    act(() => {
      expect(() => {
        store.state.post.user.firstName = 'Ash'
      }).toThrow()
    })

    screen.getByText('state.user.firstName=[Joel]')
  })

  it('throws on deep write', () => {
    const usePost = createModel('post', {
      title: 'Post#1',
      user: freeze({ deep: { name: { firstName: 'Joel' } } })
    })

    const App = () => {
      const state = usePost()
      return <h1>state.user.deep.name.firstName=[{state.user.deep.name.firstName}]</h1>
    }

    render(<App />)

    screen.getByText('state.user.deep.name.firstName=[Joel]')

    expect(Object.isFrozen(store.state.post.user)).toBeTruthy()
    expect(Object.isFrozen(store.state.post.user.deep)).toBeTruthy()
    expect(Object.isFrozen(store.state.post.user.deep.name)).toBeTruthy()
    expect(Object.isFrozen(store.state.post.user.deep.name.firstName)).toBeTruthy()

    act(() => {
      expect(() => {
        result.current.user.deep.name.firstName = 'Ash'
      }).toThrow()
    })

    screen.getByText('state.user.deep.name.firstName=[Joel]')
  })
})

describe('createContextModel', () => {
  it('multiple instances', () => {
    const usePost = createContextModel((_, props) => ({
      title: 'Post#?',
      ...props
    }))

    const Post = ({ title }) => {
      const post = usePost({ title })
      return <h1>{post.title}</h1>
    }

    render(
      <>
        <IbizaProvider>
          <Post title="Post#1" />
        </IbizaProvider>
        <IbizaProvider>
          <Post title="Post#2" />
        </IbizaProvider>
      </>
    )

    screen.getByText('Post#1')
    screen.getByText('Post#2')
  })

  test('basic', () => {
    const usePost = createContextModel((_, props) => ({
      title: 'Post#1',
      ...props
    }))

    const Post = () => {
      const post = usePost({ title: 'Post#2' })
      return <h1>{post.title}</h1>
    }

    render(
      <IbizaProvider>
        <Post />
      </IbizaProvider>
    )

    screen.getByText('Post#2')
  })
})
