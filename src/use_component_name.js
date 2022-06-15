/* global process */

import { useRef } from 'react'

export default () => {
  const ref = useRef()
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line unicorn/error-message
    const name = new Error().stack.split('\n').find(ln => {
      return /^(?!Object)[A-Z]./.test(ln.trim().split(' ')[1])
    })

    ref.current = name?.trim().split(' ')[1]
  }

  return ref
}
