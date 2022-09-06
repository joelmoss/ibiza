import { Suspense } from 'react'
import { store, useIbiza, query } from 'ibiza'

store.state = {
  page: 1,
  users: query(function () {
    return `/users/page=${this.page}`
  })
}

function App() {
  return (
    <>
      <Suspense fallback={<div>fallback</div>}>
        <Users />
      </Suspense>
      <Pagination />
    </>
  )
}

function Users() {
  const { users } = useIbiza()

  return (
    <>
      {users.map((user, i) => (
        <div key={i}>
          {user.id}[{user.name}]
        </div>
      ))}
    </>
  )
}

function Pagination() {
  const state = useIbiza()
  return <button onClick={() => void ++state.page}>Next &raquo;</button>
}

export default App
