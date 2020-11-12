export let store = {}
export const TARGET = Symbol('target')

export const unwrap = state =>
  state !== undefined ? state[TARGET] || state : store[TARGET] || store

export const reset = () => {
  store = {}
}
