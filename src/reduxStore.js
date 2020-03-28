import { configureStore } from '@reduxjs/toolkit'
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

  const createReducer = (fn, { type, path }) => {
    actionReducers[type] = fn
    actionReducers[type].path = path
  }

  const createActionCreator = type => {
    set(actions, type, payload => {
      return refs.dispatch({ type, payload })
    })
  }

  const createThunkCreator = (fn, type) => {
    set(actions, type, payload => {
      const helpers = {
        getState: refs.getState
      }
      const result = refs.dispatch(() => fn(actions, payload, helpers))

      // if (result != null && typeof result === 'object' && typeof result.then === 'function') {
      // return result
      //   .then(resolved => {
      //     // dispatchSuccess(resolved)
      //     console.log({ resolved })
      //     return resolved
      //   })
      //   .catch(error => {
      //     console.log({ error })
      //     // dispatchError(err)
      //     // if (err.doNotThrow) return err
      //     throw error
      //   })
      // }

      return result
    })
  }

  const defaultState = model
  const actions = {}
  const actionReducers = {}

  // Add the built-in `set` action.
  createReducer(
    (state, payload) => {
      if (typeof payload === 'function') {
        payload(state)
      } else {
        forEach(payload, (val, key) => set(state, key, val))
      }
    },
    { type: 'set', path: [] }
  )
  createActionCreator('set')

  const recurseModelSlice = (slice, parentPath) => {
    Object.keys(slice).forEach(key => {
      const value = slice[key]
      const path = [...parentPath, key]
      const type = path.join('.')

      // console.log({ type, path, key, value })

      if (typeof value === 'function') {
        if (value.constructor.name === 'AsyncFunction') value.method = 'async'
        const method = value.method || 'action'

        switch (method) {
          case 'action':
            createActionCreator(type)
            break

          case 'thunk':
          case 'async':
            createThunkCreator(value, type)
            break

          default:
            break
        }

        createReducer(value, { type, path: parentPath })

        // Delete the value from the defaultState.
        unset(defaultState, path)
      } else if (isPlainObject(value)) {
        recurseModelSlice(value, path)
      }
    })
  }

  recurseModelSlice(model, [])

  const store = configureStore({ reducer: rootReducer, preloadedState: defaultState })
  refs.dispatch = store.dispatch
  refs.getState = store.getState

  return Object.assign(store, {
    actions
  })
}
