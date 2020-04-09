import { Provider } from 'react-redux'
import { createStore } from './reduxStore'
import { useIbiza } from './useIbiza'
import { useReduxContext } from './useReduxContext'

export { Provider, createStore, useIbiza, useReduxContext }

export const thunk = fn => {
  fn.method = 'thunk'
  return fn
}

export const action = fn => {
  fn.method = 'action'
  return fn
}

export const localAction = fn => {
  fn.method = 'localAction'
  return fn
}
