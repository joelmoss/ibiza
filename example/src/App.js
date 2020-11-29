// import { useCallback, useState } from 'react'
import { useIbiza, store } from 'ibiza'
import { useCallback } from 'react'
import './App.css'

const modell = data => {
  console.log(11)
  return {
    isPresent: true
  }
}

const resolveAfter = (data, ms) => new Promise(resolve => setTimeout(() => resolve(data), ms))

store.debug = true
store.fetchFn = path => {
  const url = new URL('/users/1', 'https://jsonplaceholder.typicode.com')
  const resource = new Request(url)
  return fetch(resource).then(response => {
    if (!response.ok) {
      throw new Error(`Error (${response.status})`)
    }

    const contentType = response.headers.get('Content-Type')
    const dataResponse = contentType?.includes('application/json')
      ? response.json()
      : response.text()

    // const result = model ? model.default(dataResponse) : dataResponse
    console.log(path)

    if (path === '/user/blah') {
      // make this take longer than the second
      return dataResponse.then(data => {
        return modell(data)
      })
    }

    return dataResponse

    return dataResponse.then(data => {
      return resolveAfter(data, 500)
    })
  })
}

// const model = {
//   userId: 1,
//   // users: [{ username: 'Joel' }, { username: 'Ash' }],

//   nested: {
//     get user() {
//       return this['/users/1']
//     },

//     setUser: async function (state) {
//       const response = await fetch('https://jsonplaceholder.typicode.com/users/1', {
//         method: 'PUT',
//         body: JSON.stringify({
//           username: 'joel'
//         }),
//         headers: {
//           'Content-type': 'application/json; charset=UTF-8'
//         }
//       }).then(response => {
//         if (!response.ok) {
//           throw new Error(`Error (${response.status})`)
//         }

//         return response.json()
//       })

//       state['/users/1'] = response
//     }
//   }
// }

// store.merge(model)

function App() {
  const { isPresent } = useIbiza('/user/blah', 'App')

  if (!isPresent) return null

  return <User />
}

const User = () => {
  useIbiza('/user', 'Child')
  return null

  // return (
  //   <>
  //     <div>User: {user.username}</div>
  //   </>
  // )
}

export default App
