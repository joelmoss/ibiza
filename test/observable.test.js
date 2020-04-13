import observable from '../src/observable'

describe('observable', () => {
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
    const obj = { prop: 'value' }
    const obs1 = observable(obj)
    const obs2 = observable(obj)

    expect(obs1).toBe(obs2)
  })

  it('ignores non own properties', () => {
    const onGet = jest.fn()
    const obj = { prop: 'value', items: [1, 2], 5: 2 }
    const obs = observable(obj, '', null, { onGet })

    obs.toJSON
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

  it('accepts an onSet callback', () => {
    const onSet = jest.fn()
    const obj = { prop: 'value' }

    const obs = observable(obj, '', null, { onSet })

    obs.prop = 'new value'
    expect(onSet).toBeCalledTimes(1)
  })

  describe('nested object', () => {
    const obj = { prop1: 'value1', nested: { prop2: 'value2' } }

    it('returns a proxy', () => {
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
      const obs1 = observable(obj)
      const obs2 = observable(obj)

      expect(obs1.nested).toBe(obs2.nested)
    })
  })
})
