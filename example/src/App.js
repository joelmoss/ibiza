import './App.css'
import { store, useIbiza, initDevTools } from 'ibiza'

initDevTools()

const model = {
  count: 0,
  name: null
}

function Name() {
  const state = useIbiza()
  return <div>{state.name}</div>
}

function App() {
  const state = useIbiza(model, { name: 'asdf'})
  console.log(state, store)

  return (
    <div className="App">
      <h4>Count is {state.count} and name is ?</h4>
      <button onClick={() => { state.count ++}}>Increment</button>
      <button onClick={() => { state.count --}}>Decrement</button>
      <button onClick={() => { state.name = 'joel'}}>Set name</button>
    </div>
  )
}

export default App
