import { renderHook } from '@testing-library/react'
import { useIbiza, store } from 'ibiza'

afterEach(() => {
  store.reset()
  jest.clearAllMocks()
})

describe('$root', () => {
  beforeEach(() => {
    store.state = {
      users: {
        user: {
          name: 'Joel'
        }
      }
    }
  })

  describe('from store.state', () => {
    test('called on root of state', () => {
      expect(store.state.$root).toBeUndefined()
    })

    test('returns the state root', () => {
      expect(store.state.users.$root).toEqual(store.state)
      expect(store.state.users.$root.isProxy).toBe(true)
      expect(store.state.users.$root.isStoreProxy).toBe(true)
      expect(store.state.users.$root.isHookProxy).toBe(false)
    })

    it('cannot assign to $root', () => {
      expect(() => {
        store.state.users.$root = 'foo'
      }).toThrow()
    })
  })

  describe('from useIbiza', () => {
    test('without slicing', () => {
      const { result } = renderHook(() => useIbiza().$root)

      expect(result.current).toBeUndefined()
    })

    test('with slice', () => {
      const { result } = renderHook(() => useIbiza('users').$root)

      expect(result.current).toEqual(store.state)
      expect(result.current.isProxy).toBe(true)
      expect(result.current.isHookProxy).toBe(true)
      expect(result.current.isStoreProxy).toBe(false)
    })

    test('with deep slice', () => {
      const { result } = renderHook(() => useIbiza('users.user').$root)

      expect(result.current).toEqual(store.state)
      expect(result.current.isProxy).toBe(true)
      expect(result.current.isHookProxy).toBe(true)
      expect(result.current.isStoreProxy).toBe(false)
    })

    it('cannot assign to $model', () => {
      expect(() => {
        store.state.users.$model = 'foo'
      }).toThrow()
    })
  })
})

describe('$model', () => {
  beforeEach(() => {
    store.state = {
      users: {
        user: {
          name: 'Joel'
        }
      }
    }
  })

  describe('from store.state', () => {
    test('called on root of state', () => {
      expect(store.state.$model).toBeUndefined()
    })

    test('returns the state root', () => {
      expect(store.state.users.$model).toEqual(store.state.users)
      expect(store.state.users.$root.isProxy).toBe(true)
      expect(store.state.users.$root.isStoreProxy).toBe(true)
      expect(store.state.users.$root.isHookProxy).toBe(false)
    })
  })

  describe('from useIbiza', () => {
    test('without slicing', () => {
      const { result } = renderHook(() => useIbiza().$model)

      expect(result.current).toBeUndefined()
    })

    test('with slice', () => {
      const { result } = renderHook(() => useIbiza('users').$model)

      expect(result.current).toEqual(store.state.users)
      expect(result.current.isProxy).toBe(true)
      expect(result.current.isHookProxy).toBe(true)
      expect(result.current.isStoreProxy).toBe(false)
    })

    test('with deep slice', () => {
      const { result } = renderHook(() => useIbiza('users.user').$model)

      expect(result.current).toEqual(store.state.users)
      expect(result.current.isProxy).toBe(true)
      expect(result.current.isHookProxy).toBe(true)
      expect(result.current.isStoreProxy).toBe(false)
    })
  })
})
