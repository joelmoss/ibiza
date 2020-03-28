import { Provider, useSelector } from 'react-redux'
import { createStore } from './reduxStore'
import { useActions } from './useActions'
import { useReduxContext } from './useReduxContext'

export { Provider, useSelector, createStore, useActions, useReduxContext }

export const thunk = fn => {
  fn.method = 'thunk'
  return fn
}
