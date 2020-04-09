import { createStore } from '../src'

test('getState()', () => {
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
