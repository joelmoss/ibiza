import createStore from '../src/store'

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

test('empty object in state', () => {
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

test('actions receive local state only', () => {
  // arrange
  const model = {
    session: {
      user: undefined,
      login: (state, payload) => {
        state.user = payload
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
  //
  // FIXME: Jest's `toEqual` throws error when comparing readonly properties.
  // See https://github.com/facebook/jest/pull/9575
  expect(store.getState().session.user).toEqual({
    name: 'joel'
  })
})

test('nested action', () => {
  // arrange
  const model = {
    session: {
      user: undefined,
      settings: {
        favouriteColor: 'red',
        setFavouriteColor: (state, color) => {
          state.favouriteColor = color
        }
      },
      login: () => undefined
    }
  }

  // act
  const store = createStore(model)

  // assert
  expect(store.getState()).toEqual({
    session: {
      user: undefined,
      settings: {
        favouriteColor: 'red'
      }
    }
  })

  // act
  store.actions.session.settings.setFavouriteColor('blue')

  // assert
  expect(store.getState().session).toEqual({
    user: undefined,
    settings: {
      favouriteColor: 'blue'
    }
  })
})

test('root action', () => {
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
  expect(Object.keys(store.actions)).toEqual(['doSomething'])

  // act
  store.actions.doSomething()

  // assert
  const actual = store.getState().todos.items
  expect(actual).toEqual({ 1: { text: 'foo' }, 2: { text: 'bar' } })
})
