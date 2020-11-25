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
  users: [{ username: 'Joel' }, { username: 'Ash' }],

  get user() {
    const users = this['/users']

    users.find(u => {
      console.log({ user: u })

      return false
    })

    return {}
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

store.merge(model)

function App() {
  const state = useIbiza(null, '<App>')

  const createPartner = useCallback(() => {
    state.partner = { name: 'partner1' }
  }, [state])

  return (
    <>
      <User />
      <h2>Partner: {state.partner && state.partner.name}</h2>
      <button onClick={createPartner}>createPartner</button>
      <button onClick={state.setUser}>Set user</button>
    </>
  )
}

const User = () => {
  const user = useIbiza('user', '<User>')

  return <>User: {user.username}</>
}

export default App
