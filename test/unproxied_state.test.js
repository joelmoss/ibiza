import { unproxiedStateOf, store } from 'ibiza'

afterEach(() => {
  store.reset()
  jest.clearAllMocks()
})

describe('$unproxiedState', () => {
  it('returns raw state', () => {
    store.state = { user: { name: 'Joel' } }

    expect(store.state.user.$unproxiedState).toEqual({ name: 'Joel' })
    expect(store.state.user.$unproxiedState.isProxy).toBeUndefined()
  })
})

describe('unproxiedStateOf()', () => {
  it('returns raw state', () => {
    store.state = { user: { name: 'Joel' } }

    expect(unproxiedStateOf(store.state.user)).toEqual({ name: 'Joel' })
    expect(unproxiedStateOf(store.state.user).isProxy).toBeUndefined()
  })
})
