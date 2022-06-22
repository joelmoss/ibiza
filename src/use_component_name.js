/* global process */

import * as React from 'react'
const { useId, useRef } = React

const useIdShim = () => {
  const id = useId?.()
  return id ? ` (${id})` : ''
}

export default () => {
  const id = useIdShim()
  const ref = useRef()
  if (process.env.NODE_ENV !== 'production') {
    const name = new Error().stack.split('\n').find(ln => {
      return /^(?!Object)[A-Z]./.test(ln.trim().split(' ')[1])
    })

    ref.current = name?.trim().split(' ')[1]
  }

  return `${ref.current}${id}`
}
