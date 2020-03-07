import { createStore as createReduxStore } from 'redux'
import isPlainObject from 'lodash/isPlainObject'
import get from 'lodash/get'
import set from 'lodash/set'
import unset from 'lodash/unset'
import forEach from 'lodash/forEach'
import { createDraft, finishDraft } from 'immer'

export const createStore = model => {
  const refs = {}

  const rootReducer = (state, action) => {
    if (action.type in actionReducers) {
      const actionReducer = actionReducers[action.type]
      const draft = createDraft(state)

      if (actionReducer.path.length > 0) {
        actionReducer(get(draft, actionReducer.path), action.payload)
      } else {
        actionReducer(draft, action.payload)
      }

      return finishDraft(draft)
    }

    return state
  }

  const createActionReducer = (fn, { type, path }) => {
    actionReducers[type] = fn
    actionReducers[type].path = path

    set(actions, type, payload => {
      return refs.dispatch({ type, payload })
    })
  }

  const defaultState = model
  const actions = {}
  const actionReducers = {}

  // Add the built-in reduce action.
  createActionReducer(
    (state, payload) => {
      if (typeof payload === 'function') {
        payload(state)
      } else {
        forEach(payload, (val, key) => set(state, key, val))
      }
    },
    { type: 'set', path: [] }
  )

  const recurseModelSlice = (slice, parentPath) => {
    Object.keys(slice).forEach(key => {
      const value = slice[key]
      const path = [...parentPath, key]

      // console.log({ path, key, value })

      if (typeof value === 'function') {
        // value is an action, so add it to actionCreators.
        createActionReducer(value, { type: path.join('.'), path: parentPath })

        // Then delete the value from the defaultState
        unset(defaultState, path)
      } else if (isPlainObject(value)) {
        recurseModelSlice(value, path)
      }
    })
  }

  recurseModelSlice(model, [])

  const store = createReduxStore(rootReducer, defaultState)
  refs.dispatch = store.dispatch

  return Object.assign(store, {
    actions
  })
}
