import { createStore, thunk } from '../src'

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
