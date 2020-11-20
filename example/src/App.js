import { Suspense, useCallback, useState } from 'react'
import { useIbiza } from 'ibiza'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const state = useIbiza(
    {
      firstName: 'Bob',
      lastName: 'Bones',
      age: 20,
      myFunc: function (state) {
        console.debug('state.myFunc()', { state })
        state.age = 22
      }
    },
    'App'
  )

  const incCount = useCallback(() => {
    setCount(x => x + 1)
  }, [])

  const setFirstName = useCallback(() => {
    state.firstName = 'Joel'
  }, [state])

  return (
    <Suspense fallback={<div>fallback...</div>}>
      <h2>Count {count}</h2>
      {/* <h2>myArray = {state.myArray.join('-')}</h2> */}
      {/* <h2>My firstName {state.firstName}</h2> */}
      {/* <h2>Partner age {state.partner.age}</h2> */}
      <h2>My age {state.age}</h2>
      {/* <h2>partner.foo2 {state.partner.foo2}</h2> */}
      <button onClick={incCount}>Increment count</button>
      <button onClick={setFirstName}>Set first name</button>
      <SectionOne />
    </Suspense>
  )
}

const SectionOne = () => {
  const state = useIbiza('/users', 'SectionOne')
  return <h2>SectionOne name {state.firstName}</h2>
}

export default App
