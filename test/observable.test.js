import observable, { subscribers } from '../src/observable'

describe('observable', () => {
  beforeEach(() => {
    subscribers.clear()
  })

  it('returns a proxy when no argument is provided', () => {
    const obs = observable()

    expect(obs.isProxy).toBe(true)
  })

  it('returns a proxy of the argument', () => {
    const obj = { prop: 'value' }
    const obs = observable(obj)

    expect(obs).not.toBe(obj)
    expect(obs.isProxy).toBe(true)
  })

  it('returns the argument if it is already a proxy', () => {
    const obs1 = observable()
    const obs2 = observable(obs1)

    expect(obs1).toBe(obs2)
  })

  it('returns the same proxy when called repeatedly with the same argument', () => {
    const proxyCache = new WeakMap()
    const obj = { prop: 'value' }
    const obs1 = observable(obj, '', proxyCache)
    const obs2 = observable(obj, '', proxyCache)

    expect(obs1).toBe(obs2)
  })

  it('ignores non own properties', () => {
    const onGet = jest.fn()
    const obj = { prop: 'value', items: [1, 2], 5: 2 }
    const obs = observable(obj, '', null, { onGet })

    obs.toString
    obs.prop
    obs.items
    obs[5]

    expect(onGet).toBeCalledTimes(3)
  })

  it('accepts an onGet callback', () => {
    const onGet = jest.fn()
    const obj = { prop: 'value' }

    const obs = observable(obj, '', null, { onGet })

    expect(obs.prop).toBe('value')
    expect(onGet).toBeCalledTimes(1)
  })

  describe('subscription', () => {
    it('update existing prop', () => {
      const onSet = jest.fn()
      subscribers.add(onSet)
      const obj = { prop: 'value' }

      const obs = observable(obj)

      obs.prop = 'new value'
      expect(onSet).toBeCalledTimes(1)
    })

    it('set new prop', () => {
      const onSet = jest.fn()
      subscribers.add(onSet)
      const obj = { prop1: 'value1' }

      const obs = observable(obj)

      obs.prop2 = 'value2'
      expect(onSet).toBeCalledTimes(1)
    })

    test('push to an array', () => {
      const onSet = jest.fn()
      subscribers.add(onSet)
      const obs = observable([])

      obs.push(1)

      expect(onSet).toBeCalledTimes(1)
    })
  })

  describe('nested object', () => {
    it('returns a proxy', () => {
      const obj = { prop1: 'value1', nested: { prop2: 'value2' } }
      const obs = observable(obj)

      expect(obs.nested.isProxy).toBe(true)
      expect(obs.nested).not.toBe(obj.nested)
    })

    it('returns the argument if it is already a proxy', () => {
      const obs1 = observable()
      const obs2 = observable(obs1)

      expect(obs1.nested).toBe(obs2.nested)
    })

    it('returns the same proxy when called repeatedly with the same argument', () => {
      const proxyCache = new WeakMap()
      const obj = { prop1: 'value1', nested: { prop2: 'value2' } }
      const obs1 = observable(obj, '', proxyCache)
      const obs2 = observable(obj, '', proxyCache)

      expect(obs1.nested).toBe(obs2.nested)
    })

    describe('subscriptions', () => {
      test('define a new prop', () => {
        const obj = { prop1: 'value1', nested: { prop2: 'value2' } }
        const onSet = jest.fn()
        subscribers.add(onSet)
        const obs = observable(obj)

        obs.nested.prop3 = 'value3'

        expect(onSet).toBeCalledTimes(1)
      })

      test('push to an array', () => {
        const obj = { nested: { prop: [] } }
        const onSet = jest.fn()
        subscribers.add(onSet)
        const obs = observable(obj)

        obs.nested.prop.push(1)

        expect(onSet).toBeCalledTimes(1)
      })
    })
  })
})
