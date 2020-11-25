// import { useCallback, useState } from 'react'
import { useIbiza, store } from 'ibiza'
import { useCallback } from 'react'
import './App.css'

store.debug = true
store.fetchFn = path => {
  const url = new URL(path, 'https://jsonplaceholder.typicode.com')
  const resource = new Request(url)
  return fetch(resource).then(response => {
    if (!response.ok) {
      throw new Error(`Error (${response.status})`)
    }

    return response.json()
  })
}

const model = {
  userId: 1,
  // users: [{ username: 'Joel' }, { username: 'Ash' }],

  nested: {
    get user() {
      return this['/users/1']
    },

    setUser: async function (state) {
      const response = await fetch('https://jsonplaceholder.typicode.com/users/1', {
        method: 'PUT',
        body: JSON.stringify({
          username: 'joel'
        }),
        headers: {
          'Content-type': 'application/json; charset=UTF-8'
        }
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Error (${response.status})`)
        }

        return response.json()
      })

      state['/users/1'] = response
    }
  }
}

store.merge(model)

function App() {
  useIbiza('/users/1')
  const state = useIbiza(null, '<App>')

  const createPartner = useCallback(() => {
    state.partner = { name: 'partner1' }
  }, [state])

  return (
    <>
      <User />
      <h2>Partner: {state.partner && state.partner.name}</h2>
      <button onClick={createPartner}>createPartner</button>
    </>
  )
}

const User = () => {
  const state = useIbiza('nested', '<User>')

  return (
    <>
      <div>User: {state.user.username}</div>
      <button onClick={state.setUser}>Set user</button>
    </>
  )
}

export default App
