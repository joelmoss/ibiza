import { createMutableSource, useMutableSource, useCallback } from 'react'
import { ProxyStateTree } from 'proxy-state-tree'

export const createStore = model => {
  const treeState = new ProxyStateTree(model)

  const mutableSource = createMutableSource(treeState, tree => {
    return tree.getTrackStateTree().state
  })

  const getSnapshot = tree => tree.getTrackStateTree()
  const subscribe = (tree, callback) => {
    return tree.onMutation((target, ...rest) => {
      return target.hasChangedValue && callback(target, ...rest)
    })
  }

  const mutate = fn => {
    fn(treeState.getMutationTree().state)
  }

  const useIbiza = () => {
    const source = useMutableSource(mutableSource, getSnapshot, subscribe)
    const state = treeState.rescope(source.state, treeState.getMutationTree())

    return {
      state,
      mutate
    }
  }

  return useIbiza
}
