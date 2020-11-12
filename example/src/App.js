import './App.css'
import { useIbiza, initDevTools } from 'ibiza'

initDevTools()

const model = {
  count: 0,
  name: null
}

function App() {
  const state = useIbiza(model, { name: 'asdf' })

  return (
    <div className="App">
      <h4>Count is {state.count} and name is ?</h4>
      <button
        onClick={() => {
          state.count++
        }}
      >
        Increment
      </button>
      <button
        onClick={() => {
          state.count--
        }}
      >
        Decrement
      </button>
      <button
        onClick={() => {
          state.name = 'joel'
        }}
      >
        Set name
      </button>
    </div>
  )
}

export default App
