import { Suspense, useCallback, useState } from 'react'
import { useIbiza } from 'ibiza'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const state = useIbiza(null, true)
  // const state = useIbiza(
  //   {
  //     firstName: '1Bob',
  //     lastName: 'Bones',
  //     age: 20,
  //     get fullName() {
  //       return [this.firstName, this.lastName].join(' ')
  //     },
  //     myFunc: function (state) {
  //       console.debug('state.myFunc()', { state })
  //       state.age = 22
  //     },
  //     partner: {
  //       firstName: '2Bob'
  //     },
  //     nested: { children: [{ name: 'Ash' }, { name: 'Elijah' }] }
  //   },
  //   'App'
  // )

  const incCount = useCallback(() => {
    setCount(x => x + 1)
  }, [])

  const setNuffin = useCallback(() => {
    state.nuffin = 'something'
  }, [state])

  return (
    <Suspense fallback={<div>fallback...</div>}>
      <h2>Count {count}</h2>
      {/* <h2>myArray = {state.myArray.join('-')}</h2> */}
      <h2>Nuffin:[{state.nuffin}]</h2>
      {/* <h2>My firstName {state.firstName}</h2> */}
      {/* <h2>Partner age {state.partner.age}</h2> */}
      {/* <h2>My age {state.age}</h2> */}
      {/* <h2>partner.foo2 {state.partner.foo2}</h2> */}
      <button onClick={setNuffin}>Set nuffin</button>
      {/* <button onClick={state.myFunc}>Set age</button> */}
      {/* <Partner /> */}
      {/* <FirstName /> */}
      {/* <FullName /> */}
      {/* <Children /> */}
    </Suspense>
  )
}

const Children = () => {
  const state = useIbiza('nested', 'Children')
  const removeChild = useCallback(() => {
    delete state.children[1]
  }, [state])
  const addChild = useCallback(() => {
    state.children.push({ name: Math.random() })
  }, [state])
  return (
    <>
      <ul>
        {state.children.map((child, i) => (
          <li key={i}>Child {child.name}</li>
        ))}
      </ul>
      <button onClick={removeChild}>Remove child</button>
      <button onClick={addChild}>Add child</button>
    </>
  )
}

const Partner = () => {
  let partner = useIbiza('partner', 'Partner')

  const setPartnerFirstName = useCallback(() => {
    partner.firstName = 'Joel'
  }, [partner])

  return (
    <>
      <h4>state.partner.firstName: {partner.firstName}</h4>
      <button onClick={setPartnerFirstName}>Set partner first name</button>
    </>
  )
}

const FirstName = () => {
  const firstName = useIbiza('firstName', 'FirstName')
  return <h4>state.firstName: {firstName}</h4>
}

const FullName = () => {
  const fullName = useIbiza('fullName', 'FullName')
  return <h4>state.fullName: {fullName}</h4>
}

export default App
