import { Provider, useSelector } from 'react-redux'
import { createStore } from './reduxStore'
import { useActions } from './useActions'
import { useReduxContext } from './useReduxContext'

export { Provider, useSelector, createStore, useActions, useReduxContext }

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
