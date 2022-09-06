import { renderHook } from '@testing-library/react'
import { useIbiza, store } from 'ibiza'

afterEach(() => store.reset())

describe('Array.prototype.includes', () => {
  test('store', () => {
    store.state.numbers = [0]

    expect(store.state.numbers.includes(0)).toBeTruthy()
  })

  test('useIbiza', () => {
    store.state.numbers = [0]
    const { result } = renderHook(() => useIbiza())

    expect(result.current.numbers.includes(0)).toBeTruthy()
  })

  test('getter', () => {
    store.state = {
      numbers: [0, 1],
      get number() {
        return this.numbers.includes(1)
      }
    }

    expect(store.state.number).toBeTruthy()
  })
})
