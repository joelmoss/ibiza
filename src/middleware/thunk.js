function createThunkMiddleware(extraArgument) {
  return ({ dispatch, getState }) => next => action => {
    console.log(action)

    if (typeof action === 'function') {
      return action(dispatch, getState, extraArgument)
    }

    const result = next(action)
    console.log({ result })

    return result
  }
}

const thunk = createThunkMiddleware()
thunk.withExtraArgument = createThunkMiddleware

export default thunk
