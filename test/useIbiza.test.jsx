/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { renderHook, act as hookAct } from '@testing-library/react-hooks'

import { useIbiza, reset } from '../src'

describe('useIbiza', () => {
  let renderedItems = []

  beforeEach(() => {
    reset()
    renderedItems = []
  })

  it('returns empty state proxy with no arguments', () => {
    const { result } = renderHook(() => useIbiza())

    expect(result.current).toEqual({})
    expect(result.current.isProxy).toBe(true)
  })

  it('uses non-string argument as initial state', () => {
    const { result } = renderHook(() => useIbiza({ count: 0 }))

    expect(result.current).toEqual({ count: 0 })
  })

  it('can use a slice of the state', () => {
    renderHook(() => useIbiza({ my: { count: 0 }, even: { more: { count: 1 } } }))

    const hook1 = renderHook(() => useIbiza('my'))
    expect(hook1.result.current).toEqual({ count: 0 })

    const hook2 = renderHook(() => useIbiza('even.more'))
    expect(hook2.result.current).toEqual({ count: 1 })
  })

  it('merges initial state recursively by key/path', () => {
    renderHook(() => useIbiza({ count1: 0, count2: 0 }))
    const { result } = renderHook(() => useIbiza({ count2: 1, 'user.name': 'Joel' }))

    expect(result.current).toEqual({ count1: 0, count2: 1, user: { name: 'Joel' } })
  })

  it('sets state', () => {
    const { result } = renderHook(() => useIbiza({ count: 0 }))

    hookAct(() => {
      result.current.count += 1
      result.current.user = { name: 'Joel' }
    })

    expect(result.current).toEqual({ count: 1, user: { name: 'Joel' } })
  })

  it('re-renders on changed used state', () => {
    const App = () => {
      const state = useIbiza({ count: 0 })
      renderedItems.push(state.count)
      return <button onClick={() => (state.count += 1)} />
    }

    const { getByRole } = render(<App />)

    expect(renderedItems).toEqual([0])

    fireEvent.click(getByRole('button'))

    expect(renderedItems).toEqual([0, 1])
  })

  it('does not re-render on changed un-used state', () => {
    const App = () => {
      useIbiza({ count1: 0, count2: 0 })

      return (
        <>
          <Child1 />
          <Child2 />
        </>
      )
    }

    const Child1 = () => {
      const state = useIbiza(null)
      return <button onClick={() => (state.count1 += 1)} />
    }

    const Child2 = () => {
      const state = useIbiza(null)
      renderedItems.push(state.count2)
      return <div />
    }

    const { getByRole } = render(<App />)

    expect(renderedItems).toEqual([0])

    fireEvent.click(getByRole('button'))

    expect(renderedItems).toEqual([0])
  })
})
