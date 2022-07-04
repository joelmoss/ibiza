/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import { render, act, screen } from '@testing-library/react'
import React from 'react'
import { useIbiza, store } from 'ibiza'

afterEach(() => store.reset())

test('subscribe to changes', () => {
  const callback = jest.fn()
  store.state = { name: 'Joel' }
  store.listenForChanges(callback)

  store.state.name = 'Ash'

  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith(
    expect.objectContaining({
      prop: 'name',
      path: 'name',
      previousValue: 'Joel',
      value: 'Ash'
    })
  )
})

test('subscribe to deep changes', () => {
  const callback = jest.fn()
  store.state = { user: { name: 'Joel' } }
  store.listenForChanges(callback)

  store.state.user.name = 'Ash'

  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith(
    expect.objectContaining({
      prop: 'name',
      path: 'user.name',
      previousValue: 'Joel',
      value: 'Ash'
    })
  )
})

test('unsubscribe from changes', () => {
  const callback = jest.fn()
  store.state = { name: 'Joel' }
  const unlisten = store.listenForChanges(callback)

  store.state.name = 'Ash'
  unlisten()
  store.state.name = 'Joel'

  expect(store.rawState).toEqual({ name: 'Joel' })
  expect(callback).toHaveBeenCalledTimes(1)
})

test('.$unproxied returns raw state', () => {
  store.state = { user: { name: 'Joel' } }

  expect(store.state.user.$unproxied).toEqual({ name: 'Joel' })
  expect(store.state.user.$unproxied.isProxy).toBeUndefined()
})

describe('state mutation', () => {
  it('assign new state', () => {
    const cb = jest.fn()

    store.listenForChanges(cb)
    store.state = { name: 'Joel' }

    expect(store.rawState).toEqual({ name: 'Joel' })
    expect(cb).not.toHaveBeenCalled()
  })

  it('overwrite existing property', () => {
    store.state = { name: 'Joel' }
    const cb = jest.fn()

    store.listenForChanges(cb)
    store.state.name = 'Ash'

    expect(store.rawState).toEqual({ name: 'Ash' })
    expect(cb.mock.calls).toEqual([[expect.objectContaining({ path: 'name' })]])
  })

  it('overwrite existing nested property', () => {
    store.state = { user: { name: 'Joel' } }
    const cb = jest.fn()

    store.listenForChanges(cb)
    store.state.user.name = 'Ash'

    expect(store.rawState).toEqual({ user: { name: 'Ash' } })
    expect(cb.mock.calls).toEqual([[expect.objectContaining({ path: 'user.name' })]])
  })

  it('sets undefined property', () => {
    store.state = { name: 'Joel' }
    const cb = jest.fn()

    store.listenForChanges(cb)
    store.state.age = 44

    expect(store.rawState).toEqual({ name: 'Joel', age: 44 })
    expect(cb.mock.calls).toEqual([[expect.objectContaining({ path: 'age' })]])
  })

  it('overwrites existing object with empty object', () => {
    store.state = { user: { name: 'Joel' } }
    const callback = jest.fn()

    store.listenForChanges(callback)
    store.state.user = {}

    expect(store.rawState).toEqual({ user: {} })
    expect(callback.mock.calls).toEqual([[expect.objectContaining({ path: 'user' })]])
  })

  it.skip('listeners called on each property change', () => {
    store.state = { user: { name: 'Joel', age: 44 } }
    const callback = jest.fn()

    store.listenForChanges(callback)
    store.state.user = { name: 'Ash', age: 23 }

    expect(store.rawState).toEqual({ user: { name: 'Ash', age: 23 } })
    expect(callback.mock.calls).toEqual([
      [expect.objectContaining({ path: 'user.name' })],
      [expect.objectContaining({ path: 'user.age' })]
    ])
  })
})

describe.skip('.update', () => {
  it('merges state', async () => {
    let renderCount = 0
    store.merge({ lastName: 'Moss' })
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <ul>
          <li>state.firstName[{state.firstName}]</li>
          <li>state.lastName[{state.lastName}]</li>
          <li>state.age[{state.age}]</li>
        </ul>
      )
    }

    render(<App />)

    screen.getByText('state.firstName[]')
    screen.getByText('state.lastName[Moss]')
    screen.getByText('state.age[]')
    expect(renderCount).toBe(1)

    act(() => {
      store.update({ firstName: 'Joel', age: 43 })
    })

    await screen.findByText('state.firstName[Joel]')
    await screen.findByText('state.lastName[Moss]')
    await screen.findByText('state.age[43]')
    expect(renderCount).toBe(2)
  })

  it('deep merge', async () => {
    let renderCount = 0
    store.merge({ user: { lastName: 'Moss' } })
    const App = () => {
      const state = useIbiza('user')
      renderCount++
      return (
        <ul>
          <li>state.firstName[{state.firstName}]</li>
          <li>state.lastName[{state.lastName}]</li>
          <li>state.age[{state.age}]</li>
        </ul>
      )
    }

    render(<App />)

    screen.getByText('state.firstName[]')
    screen.getByText('state.lastName[Moss]')
    screen.getByText('state.age[]')
    expect(renderCount).toBe(1)

    act(() => {
      store.update({ user: { firstName: 'Joel', age: 43 } })
    })

    await screen.findByText('state.firstName[Joel]')
    await screen.findByText('state.lastName[Moss]')
    await screen.findByText('state.age[43]')
    expect(renderCount).toBe(2)
  })

  it('accepts a key as the first argument, with data as second', async () => {
    store.merge({ nested: { user: { lastName: 'Moss' } } })

    store.update('nested.user', { firstName: 'Joel' })

    expect(store.unwrappedState).toEqual({
      nested: { user: { firstName: 'Joel', lastName: 'Moss' } }
    })
  })

  it('does not rerender on unused state change', async () => {
    let renderCount = 0
    store.merge({ lastName: 'Moss' })
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <ul>
          <li>state.lastName[{state.lastName}]</li>
        </ul>
      )
    }

    render(<App />)

    screen.getByText('state.lastName[Moss]')

    act(() => {
      store.update({ firstName: 'Joel' })
    })

    await screen.findByText('state.lastName[Moss]')
    expect(renderCount).toBe(1)
  })

  it.skip('does not rerender on unused deep state change', async () => {
    let renderCount = 0
    store.merge({ user: { firstName: 'Joel', lastName: 'Moss' } })
    const App = () => {
      const state = useIbiza()
      renderCount++
      return (
        <ul>
          <li>state.firstName[{state.user.firstName}]</li>
          <li>state.middleName[{state.user.middleName}]</li>
          <li>state.lastName[{state.user.lastName}]</li>
        </ul>
      )
    }

    render(<App />)

    screen.getByText('state.firstName[Joel]')
    screen.getByText('state.lastName[Moss]')

    act(() => {
      // store.update({ user: { firstName: 'Ash' } })
      store.state.user.firstName = 'Ash'
      store.state.user.middleName = 'Joel'
    })

    await screen.findByText('state.firstName[Ash]')
    await screen.findByText('state.lastName[Moss]')
    expect(renderCount).toBe(1)
    expect(store.unwrappedState).toEqual({ user: { firstName: 'Ash', lastName: 'Moss' } })
  })
})
