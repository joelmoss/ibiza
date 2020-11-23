import { useCallback, useState } from 'react'
import { useIbiza, store } from 'ibiza'
import './App.css'

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
  get user() {
    const users = this['/users']
    console.log('this', this)
    return users && users.find(u => u.id === this.userId)
  }
}

store.merge(model)

function App() {
  const [count, setCount] = useState(0)
  // const users = useIbiza('/users', '/users')
  // console.log({ users })

  const incCount = useCallback(() => {
    // setCount(x => x + 1)
    ++store.count
  }, [])

  return (
    <>
      <h2>useState(Count) {count}</h2>
      <User />
      {/* <Section /> */}

      {/* <p>Hello {user.name}</p> */}

      {/* <ul>
        {users.map(user => (
          <li key={user.id}>
            #{user.id} {user.name} ({user.company.name})
          </li>
        ))}
      </ul> */}

      <button onClick={incCount}>Increment useState(count)</button>
    </>
  )
}

const User = () => {
  const { user } = useIbiza(null, 'User')
  console.log({ user })

  if (!user) return null

  return <>Section: {user.name}</>
}

const model2 = {
  get user() {
    console.log(this['/users'])
    return this['/users'].find(x => x.id === this.userId)
  }
}
const Users = () => {
  // const state = useIbiza(model2, 'Users(user)')
  const users = useIbiza('/users', 'Users')

  return (
    <>
      <h1>Users</h1>
      {/* <h4>Current userId #{state.userId}</h4> */}
      {/* <h4>Current user {state.user}</h4> */}

      <ul>
        {users.map(user => (
          <li key={user.id}>
            #{user.id} {user.name} ({user.company.name})
          </li>
        ))}
      </ul>
    </>
  )
}

export default App
