import { createStore, action, localAction } from '../src'

test('store.getState()', () => {
  // arrange
  const model = {
    todos: {
      items: {},
      foo: []
    },
    bar: null
  }

  // act
  const store = createStore(model)

  // assert
  expect(store.getState()).toEqual({
    todos: {
      items: {},
      foo: []
    },
    bar: null
  })
})

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
