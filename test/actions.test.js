import { createStore, action, localAction } from '../src'

const resolveAfter = (data, ms) => new Promise(resolve => setTimeout(() => resolve(data), ms))
const rejectAfter = (data, ms) =>
  new Promise((resolve, reject) => setTimeout(() => reject(data), ms))

describe('actions', () => {
  test('action as plain function', () => {
    // arrange
    const model = {
      user: undefined,
      login: (state, payload) => {
        state.user = payload
      }
    }

    // act
    const store = createStore(model)

    // assert
    expect(store.getState()).toEqual({
      user: undefined
    })

    // act
    store.actions.login({ name: 'joel' })

    // assert
    expect(store.getState()).toEqual({
      user: {
        name: 'joel'
      }
    })
  })

  test.only('action can call other actions (thunk)', () => {
    const store = createStore({
      createUser: (state, payload, actions) => {
        return () => {
          actions.set({
            user: { id: 101, ...payload }
          })
        }
      }
    })

    store.actions.createUser({ username: 'joelmoss' })

    expect(store.getState().user).toEqual({
      id: 101,
      username: 'joelmoss'
    })
  })

  test.skip('action as async function', async () => {
    const store = createStore({
      createUser: async (actions, payload) => {
        actions.set({
          user: await resolveAfter({ id: 101, username: 'joelmoss' }, 15)
        })
      }
    })

    await store.actions.createUser({ username: 'joelmoss' })

    expect(store.getState().user).toEqual({
      id: 101,
      username: 'joelmoss'
    })
  })

  test('action with method wrapper', () => {
    // arrange
    const model = {
      user: undefined,
      login: action((state, payload) => {
        state.user = payload
      })
    }

    // act
    const store = createStore(model)

    // assert
    expect(store.getState()).toEqual({
      user: undefined
    })

    // act
    store.actions.login({ name: 'joel' })

    // assert
    expect(store.getState()).toEqual({
      user: {
        name: 'joel'
      }
    })
  })

  test('nested action', () => {
    // arrange
    const model = {
      session: {
        user: undefined,
        login: (state, payload) => {
          state.session.user = payload
        }
      }
    }

    // act
    const store = createStore(model)

    // assert
    expect(store.getState()).toEqual({
      session: {
        user: undefined
      }
    })

    // act
    store.actions.session.login({ name: 'joel' })

    // assert
    expect(store.getState()).toEqual({
      session: {
        user: {
          name: 'joel'
        }
      }
    })
  })

  test('nested localAction', () => {
    // arrange
    const model = {
      session: {
        user: undefined,
        login: localAction((state, payload) => {
          state.user = payload
        })
      }
    }

    // act
    const store = createStore(model)

    // assert
    expect(store.getState()).toEqual({
      session: {
        user: undefined
      }
    })

    // act
    store.actions.session.login({ name: 'joel' })

    // assert
    expect(store.getState()).toEqual({
      session: {
        user: {
          name: 'joel'
        }
      }
    })
  })

  test('built-in set action', () => {
    // arrange
    const store = createStore({
      todos: {
        items: { 1: { text: 'foo' } }
      },
      doSomething: state => {
        state.todos.items[2] = { text: 'bar' }
      }
    })

    // assert
    expect(Object.keys(store.actions)).toEqual(['set', 'doSomething'])

    // act
    store.actions.set({ 'todos.count': 1 })

    // assert
    expect(store.getState().todos.count).toEqual(1)
  })
})
