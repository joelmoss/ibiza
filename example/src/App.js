import { Suspense, useRef, useEffect } from 'react'
import { useIbiza, config } from 'ibiza'
import useSWR from 'swr'
import './App.css'

const fetchFn = path =>
  new Promise((resolve, reject) =>
    setTimeout(function () {
      // reject({ errorMessage: 'FAILED!' })
      resolve({ name: 'Joel' })
    }, 2000)
  )

config.fetchFn = fetchFn

function UserOne() {
  const { data } = useSWR('/api/user', fetchFn, { suspense: true })
  console.log('SWR', data)

  return <>User name is {data.name} -</>
}

function UserTwo() {
  const data = useIbiza('/user')
  console.log('IBIZA', data)

  return <>User name is {data.name}</>
}

function App() {
  return (
    <Suspense fallback={<div>fallback...</div>}>
      <UserOne />
      <UserTwo />
    </Suspense>
  )

  // return (
  //   <div className="App">
  //     <h4>Count is {state.count} and name is ?</h4>
  //     <button
  //       onClick={() => {
  //         state.count++
  //       }}
  //     >
  //       Increment
  //     </button>
  //     <button
  //       onClick={() => {
  //         state.count--
  //       }}
  //     >
  //       Decrement
  //     </button>
  //     <button
  //       onClick={() => {
  //         state.name = 'joel'
  //       }}
  //     >
  //       Set name
  //     </button>
  //   </div>
  // )
}

export default App
