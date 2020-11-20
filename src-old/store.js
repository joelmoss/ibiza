export let store = {}
export const fetchCache = new Map()
export const TARGET = Symbol('target')

export const unwrap = state =>
  state !== undefined ? state[TARGET] || state : store[TARGET] || store

export const reset = () => {
  store = {}
  fetchCache = new Map()
}
