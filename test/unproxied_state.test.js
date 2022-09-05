import { renderHook } from '@testing-library/react'

import { useIbiza, unproxiedStateOf, store } from 'ibiza'
import { isProxy } from '../src/store'

afterEach(() => {
  store.reset()
  jest.clearAllMocks()
})

describe('$unproxiedState', () => {
  it('returns raw state', () => {
    store.state = { user: { name: 'Joel' } }

    expect(store.state.user.$unproxiedState).toEqual({ name: 'Joel' })
    expect(store.state.user.$unproxiedState[isProxy]).toBeUndefined()
  })

  test('with useIbiza', () => {
    store.state = { user: { name: 'Joel' } }

    const { result } = renderHook(() => useIbiza())

    expect(result.current.user.$unproxiedState).toEqual({ name: 'Joel' })
    expect(result.current.user.$unproxiedState[isProxy]).toBeUndefined()
  })
})

describe('unproxiedStateOf()', () => {
  it('returns raw state', () => {
    store.state = { user: { name: 'Joel' } }

    expect(unproxiedStateOf(store.state.user)).toEqual({ name: 'Joel' })
    expect(unproxiedStateOf(store.state.user)[isProxy]).toBeUndefined()
  })

  test('with useIbiza', () => {
    store.state = { user: { name: 'Joel' } }

    const { result } = renderHook(() => useIbiza())

    expect(unproxiedStateOf(result.current.user)).toEqual({ name: 'Joel' })
    expect(unproxiedStateOf(result.current.user)[isProxy]).toBeUndefined()
  })
})
