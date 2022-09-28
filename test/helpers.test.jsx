import { render, act, screen } from '@testing-library/react'
import React from 'react'
import { useIbiza, store, accessor, trackFunction } from 'ibiza'

afterEach(() => {
  store.reset()
  store.debug = false

  jest.clearAllMocks()
})

describe('track()', () => {
  it('tracks state usage within the function', async () => {
    store.state = {
      errors: {},
      errorFor: trackFunction(function (_, key) {
        return this.errors[key]
      })
    }

    function App() {
      const model = useIbiza()
      return <div>errors.name=[{model.errorFor('name')}]</div>
    }

    render(<App />)

    screen.getByText('errors.name=[]')

    act(() => void (store.state.errors.name = 'invalid'))

    screen.getByText('errors.name=[invalid]')
  })
})

describe('accessor()', () => {
  it('can be get and set', async () => {
    store.state = { id: 1, user: accessor() }

    function App() {
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[]')

    act(() => void (store.state.user = 'Joel'))

    screen.getByText('user=[Joel]')
  })

  it('can set to undefined', async () => {
    store.state = { id: 1, user: accessor({ initialValue: 'Joel' }) }

    function App() {
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[Joel]')

    act(() => void (store.state.user = undefined))

    screen.getByText('user=[]')
  })

  it('can define an initialValue', async () => {
    store.state = {
      id: 1,
      user: accessor({
        initialValue: { name: 'Joel' }
      })
    }

    function App() {
      const model = useIbiza()
      return <div>user.name=[{model.user.name}]</div>
    }

    render(<App />)

    screen.getByText('user.name=[Joel]')
  })

  test('onGet/onSet callbacks', async () => {
    const accessorOptions = {
      initialValue: 'Joel',
      onGet(v) {
        return `${v}(${this.id})`
      },
      onSet() {}
    }
    store.state = { id: 1, user: accessor(accessorOptions) }

    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')
    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    function App() {
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[Joel(1)]')
    expect(onGetSpy).toHaveBeenCalledTimes(1)
    expect(onSetSpy).toHaveBeenCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ash(1)]')
    expect(onGetSpy).toHaveBeenCalledTimes(2)
    expect(onSetSpy).toHaveBeenCalledTimes(1)
  })

  test('onSet with setValue()', async () => {
    const accessorOptions = {
      initialValue: 'Joel',
      onSet(oldV, newV, setValue) {
        setValue(`${newV}ley`)
      }
    }
    store.state = { user: accessor(accessorOptions) }

    let renderCount = 0
    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    function App() {
      renderCount++
      const model = useIbiza()
      return <div>user=[{model.user}]</div>
    }

    render(<App />)

    screen.getByText('user=[Joel]')
    expect(onSetSpy).toHaveBeenCalledTimes(0)
    expect(renderCount).toBe(1)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ashley]')
    expect(onSetSpy).toHaveBeenCalledTimes(1)
    expect(renderCount).toBe(2)

    act(() => void (store.state.user = 'Ash'))

    screen.getByText('user=[Ashley]')
    expect(onSetSpy).toHaveBeenCalledTimes(2)
    expect(renderCount).toBe(2)
  })

  it('can access on store state', async () => {
    const accessorOptions = {
      initialValue: 'Joel',
      onGet(value) {
        return value
      },
      onSet() {}
    }
    store.state = { user: accessor(accessorOptions) }

    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')
    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    expect(store.state.user).toBe('Joel')
    expect(onGetSpy).toHaveBeenCalledTimes(1)
    expect(onSetSpy).toHaveBeenCalledTimes(0)

    act(() => void (store.state.user = 'Ashley'))

    expect(store.state.user).toBe('Ashley')
    expect(onGetSpy).toHaveBeenCalledTimes(2)
    expect(onSetSpy).toHaveBeenCalledTimes(1)

    act(() => void (store.state.user = 'Elijah'))

    expect(store.state.user).toBe('Elijah')
    expect(onGetSpy).toHaveBeenCalledTimes(3)
    expect(onSetSpy).toHaveBeenCalledTimes(2)
  })

  it('should set value even if not previously read', async () => {
    const accessorOptions = {
      initialValue: 'Joel',
      onSet(oldV, newV, setValue) {
        setValue(`${newV}ley`)
      }
    }
    store.state = { user: accessor(accessorOptions) }

    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')

    function App() {
      useIbiza()
      return <div>Hello</div>
    }

    render(<App />)

    expect(onSetSpy).toHaveBeenCalledTimes(0)

    act(() => void (store.state.user = 'Ash'))

    expect(store.state.user).toBe('Ashley')
    expect(onSetSpy).toHaveBeenCalledTimes(1)
  })

  it('should rerender when setter is called with new value', async () => {
    const accessorOptions = {
      initialValue: 1,
      onGet(value) {
        return this.users.find(x => x.id === value)
      },
      onSet() {}
    }

    store.state = {
      user: accessor(accessorOptions),
      users: [
        { id: 1, name: 'Joel' },
        { id: 2, name: 'Ash' }
      ]
    }

    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')
    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')

    function App() {
      const model = useIbiza()
      return <div>user.name=[{model.user.name}]</div>
    }

    render(<App />)

    expect(onSetSpy).toHaveBeenCalledTimes(0)
    expect(onGetSpy).toHaveBeenCalledTimes(1)
    screen.getByText('user.name=[Joel]')

    act(() => void (store.state.user = 2))

    expect(onSetSpy).toHaveBeenCalledTimes(1)
    await screen.findByText('user.name=[Ash]')
  })

  it('should rerender when dependent prop changes', async () => {
    const accessorOptions = {
      initialValue: 1,
      onGet(value) {
        return this.users.find(x => x.id === value)
      },
      onSet() {}
    }

    store.state = {
      user: accessor(accessorOptions),
      users: [
        { id: 1, name: 'Joel' },
        { id: 2, name: 'Ash' }
      ]
    }

    const onSetSpy = jest.spyOn(accessorOptions, 'onSet')
    const onGetSpy = jest.spyOn(accessorOptions, 'onGet')

    function App() {
      const model = useIbiza()
      return <div>user.name=[{model.user.name}]</div>
    }

    render(<App />)

    expect(onSetSpy).toHaveBeenCalledTimes(0)
    expect(onGetSpy).toHaveBeenCalledTimes(1)
    screen.getByText('user.name=[Joel]')

    act(() => void (store.state.users[0].name = 'Joely'))

    expect(onSetSpy).toHaveBeenCalledTimes(0)
    await screen.findByText('user.name=[Joely]')
  })
})
