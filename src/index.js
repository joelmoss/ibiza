import { Provider } from 'react-redux'
import { createStore } from './reduxStore'
import { useActions } from './useActions'
import { useIbiza } from './useIbiza'
import { useReduxContext } from './useReduxContext'

export { Provider, createStore, useActions, useIbiza, useReduxContext }

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
