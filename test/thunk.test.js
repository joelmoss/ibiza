import { createStore, thunk } from '../src'

const resolveAfter = (data, ms) => new Promise(resolve => setTimeout(() => resolve(data), ms))

describe('thunk', () => {
  test('call other actions/thunks', () => {
    // arrange
    const store = createStore({
      todos: {
        items: { 1: { text: 'foo' } }
      },
      doSomething: thunk((actions, payload) => {
        actions.doSomethingElse(payload)
      }),
      doSomethingElse: thunk((actions, payload) => {
        actions.doSomethingMore(payload)
      }),
      doSomethingMore: (state, payload) => {
        state.todos.items[2] = { text: payload }
      }
    })

    // act
    store.actions.doSomething('bar')

    // assert
    const actual = store.getState().todos.items
    expect(actual).toMatchObject({
      1: { text: 'foo' },
      2: { text: 'bar' }
    })
  })

  test('access to state', () => {
    // arrange
    const store = createStore({
      todos: {
        items: { 1: { text: 'foo' } },
        count: 1
      },
      doSomething: thunk((actions, payload, { getState }) => {
        actions.doSomethingElse(`${payload}${getState().todos.count + 1}`)
      }),
      doSomethingElse: (state, payload) => {
        state.todos.items[2] = { text: payload }
      }
    })

    // act
    store.actions.doSomething('bar')

    // assert
    const actual = store.getState().todos.items
    expect(actual).toMatchObject({
      1: { text: 'foo' },
      2: { text: 'bar2' }
    })
  })

  test('async with thunk() method', async () => {
    // arrange
    const store = createStore({
      createUser: thunk(async (actions, payload, { getState }) => {
        actions.set({
          user: await resolveAfter({ id: 101, username: 'joelmoss' }, 15)
        })
      })
    })

    // act
    const result = await store.actions.createUser({ username: 'joelmoss' })

    // assert
    expect(store.getState().user).toEqual({
      id: 101,
      username: 'joelmoss'
    })
  })

  test('async without thunk() method', async () => {
    // arrange
    const store = createStore({
      createUser: async (actions, payload, { getState }) => {
        actions.set({
          user: await resolveAfter({ id: 101, username: 'joelmoss' }, 15)
        })
      }
    })

    // act
    const result = await store.actions.createUser({ username: 'joelmoss' })

    // assert
    expect(store.getState().user).toEqual({
      id: 101,
      username: 'joelmoss'
    })
  })

  test.only('async', async () => {
    // arrange
    const store = createStore({
      createUser: async (actions, payload, { getState }) => {
        expect(payload).toEqual({
          username: 'joelmoss'
        })

        actions.set({ isLoading: true })

        expect(getState().isLoading).toBe(true)

        actions.set({
          user: await resolveAfter({ id: 101, username: 'joelmoss' }, 15)
        })

        expect(getState().user).toEqual({
          id: 101,
          username: 'joelmoss'
        })

        return 'success'
      }
    })

    // act
    const result = await store.actions.createUser({ username: 'joelmoss' })

    // assert
    expect(result).toBe('success')
    expect(store.getState().isLoading).toBe(true)
    expect(store.getState().user).toEqual({
      id: 101,
      username: 'joelmoss'
    })
  })
})
