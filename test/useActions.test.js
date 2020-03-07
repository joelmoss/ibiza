/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */

import React from 'react'
import { renderHook } from '@testing-library/react-hooks'

import { createStore, Provider, useActions } from '../src'

describe('hooks', () => {
  describe('useActions', () => {
    it('selects the state on initial render', () => {
      const store = createStore({
        count: 0,
        inc: state => {
          state.count = state.count + 1
        }
      })

      const { result } = renderHook(() => useActions(), {
        wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
      })

      expect(Object.keys(result.current)).toEqual(['set', 'inc'])
    })
  })
})
