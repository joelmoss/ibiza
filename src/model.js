import { useDebugValue } from 'react'

import useIbiza from './use_ibiza.js'
import store from './store.js'

// Creates an Ibiza model, and returns a React hook wrapping useIbiza with the given `modelName` as
// the slice. The given `modelDef` is assigned as the initial state to the `modelName` state key. If
// `modelDef` is a function, it will be called with any passed initial state, and props that are
// passed to the returned hook.
//
// Note that modelDef is assigned only once - the first time the returned hook is called. But if
// the model is URL based, and modelDef is a function, then the modelDef will be called with the
// server response each time the model is fetched from the server.
//
// - modelName (String) - The name of the model, and the key to which the model's state will be
//   assigned.
// - modelDef (?Function|Object) - The initial model definition.
// - options (?Object) - Model options:
//   - fetch (Function) - A custom fetch function that this model will use. Only applies to URL
//     models.
//
// Examples:
//  const useUser = createModel('user', { name: 'Joel' })
//  const user = useUser({ age: 43 })
//  const child = useUser('child', { name: 'My child' })
//
export function createModel(modelName, modelDef = {}, options = {}) {
  function useIbizaModel(slice, props) {
    useDebugValue(modelName)

    if (typeof slice !== 'string') {
      props = slice
      slice = undefined
    }

    if (modelName in store.state === false) {
      if (typeof modelDef === 'function') {
        const initialState = (store.modelInitializers[modelName] = state => modelDef(state, props))

        if (modelName.indexOf('/') !== 0) {
          store.state[modelName] = initialState(store.state[modelName])
        }
      } else {
        store.state[modelName] = modelDef
      }
    }

    store.modelOptions[modelName] = options

    return useIbiza(slice ? [modelName, slice].join('.') : modelName)
  }

  return useIbizaModel
}
