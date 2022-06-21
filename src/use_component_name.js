/* global process */

import { useRef, useId } from 'react'

export default () => {
  const id = useId()
  const ref = useRef()
  if (process.env.NODE_ENV !== 'production') {
    const name = new Error().stack.split('\n').find(ln => {
      return /^(?!Object)[A-Z]./.test(ln.trim().split(' ')[1])
    })

    ref.current = name?.trim().split(' ')[1]
  }

  return `${ref.current}(${id})`
}
