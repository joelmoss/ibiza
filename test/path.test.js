import { getByPath } from '../src/path'

const obj = {
  firstName: 'Joel',
  get fullName() {
    return 'Joel Moss'
  },
  children: [
    {
      firstName: 'Ash'
    },
    {
      firstName: 'Elijah'
    }
  ],
  partner: {
    firstName: '?'
  },
  isUndefined: undefined,
  isNull: null,
  records: {
    101: {
      title: '#101'
    },
    102: {
      title: '#102'
    }
  }
}

it('returns getter with warning', () => {
  const spy = jest.spyOn(obj, 'fullName', 'get')

  const prop = getByPath(obj, 'fullName')

  expect(spy).toBeCalled()
  expect(prop).toEqual('Joel Moss')
})

it.skip('returns property', () => {
  expect(getByPath(obj, 'firstName')).toBe('Joel')
})

it('returns array', () => {
  expect(getByPath(obj, 'children')).toEqual([
    {
      firstName: 'Ash'
    },
    {
      firstName: 'Elijah'
    }
  ])
})

it('returns array element', () => {
  expect(getByPath(obj, 'children.1')).toEqual({
    firstName: 'Elijah'
  })
})

it('returns object', () => {
  expect(getByPath(obj, 'partner')).toEqual({
    firstName: '?'
  })
})

it.skip('returns object element', () => {
  expect(getByPath(obj, 'partner.firstName')).toEqual('?')
})

it.skip('returns object element by int', () => {
  expect(getByPath(obj, 'records.102')).toEqual({ title: '#102' })
  expect(getByPath(obj, 'records.102.title')).toBe('#102')
})

it('get undefined', () => {
  expect(getByPath(obj, 'non')).toBeUndefined()
})

it.skip('returns undefined', () => {
  expect(getByPath(obj, 'isUndefined')).toBeUndefined()
})

it('returns null', () => {
  expect(getByPath(obj, 'isNull')).toBeNull()
})
