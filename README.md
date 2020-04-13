# Ibiza - React State Management for Party Animals

## Usage

```javascript
// Store is global and defined in the ibiza module. Just import it and read from and write to it as
// you like.
import { useIbiza } from 'ibiza'

store.user = {
  name: 'joel',

  get fullName() {
    return this.name
  },

  set fullName(value) {
    const [firstName, lastName] = value.split(' ')
    this.firstName = firstName
    this.lastName = lastName
  },

  partner: {
    name: 'Sam',

    toSentence() {
      return `${parent.name}'s partner is ${this.name}` // or you can use `root` to access the state root
    }
  },

  // TBD...
  'dateOfBirth.toDate': function () {
    return new Date(this.dateOfBirth)
  }
}

// Read and write state with initial state
const MyComponent = () => {
  const state = useIbiza({ user: { name: 'Joel' } })
  return <div>{state.user.name}</div>
}

// Read and write state from all state (root)
const MyComponent = () => {
  const state = useIbiza()
  return <div>{state.user.name}</div>
}

// Read and write from a state slice
const MyComponent = () => {
  const state = useIbiza('user')
  return <div>{state.name}</div>
}

// Read and write from a state slice using context
const ParentComponent = () => {
  return (
    <IbizaProvider value="user">
      <ChildComponent />
    </IbizaProvider>
  )
}
const ChildComponent = () => {
  const state = useIbiza()
  return <>{state.name}</>
}
```

```javascript
const store = createStore({
  count: 0,

  // Action/Mutator - Just a function that accepts the current state;
  // allowing you to mutate said state.
  increment(state) {
    state.count = state.count + 1
  },

  // ... or wrap your action in a method wrapper if you want to be
  // explicit. This is exactly the same as simply defining a function.
  decrement: action(state => {
    state.count = state.count + 1
  }),

  // You can nest your state and methods as deep as you like.
  user: {
    firstName: 'Joel',
    lastName: 'Moss',

    // Actions receive the global state, but you can also create an action that receives the local
    // state relative to the action. Just wrap your action in the localAction method.
    setFirstName: localAction((state, payload) => {
      state.firstName = payload
    }),

    // Getter - Create derived state or computed properties.
    fullName: getter(({ user }) => {
      return `${user.firstName} ${user.lastName}`
    }),

    // Accessor - Wrap an existing property of the same name, and
    // read and write it.
    //
    // Get the property:
    //  state.dateOfBirth
    // Set the property:
    //  state.dateOfBirth = new Date()
    // Get the underlying "raw" property value:
    //  ?
    dateOfBirth: accessor(
      // Getter
      value => {
        return new Date(value)
      },
      // Setter
      () => {
        return newValue
      }
    )
  },

  // Async functions.
  submit: async state => {
    state.isLoading = true

    try {
      state.result = await fetch(...)
    } catch (error) {
      state.error = error
    } finally {
      state.isLoading = false
    }
  }
})

const MyComponent = () => {
  const state = useIbiza()

  return (
    <StoreProvider store={store}>
      <form onSubmit={() => state.submit()}>
        <div>Name: {state.user.fullName}</div>
        <div>Date of Birth: {state.user.dateOfBirth}</div>
        <div>Count: {state.count}</div>

        <button type="button" onClick={state.increment}>
          Increment
        </button>

        <input type="text" onChange={state.user.age.set} value={state.user.age} />

        <input
          type="text"
          onChange={({ target }) => (state.user.dateOfBirth = target.value)}
          value={state.user.dateOfBirth.raw}
        />
      </form>
    </StoreProvider>
  )
}
```

## Features

- Get state without needing selectors. Just use the state you need, and your components will re-render when that used state is mutated.

## Wishlist

- No need for a wrapping "Provider" component. Thanks to `useMutableSource()` 👏
- Set state using regular variable assignment: `state.name = value`.

## Differences to easy-peasy

- Only root context is exposed to actions.
  > Isolated contexts/domains creates more harm than good. Specifically when you develop your application, it is very difficult to know exactly how the domains of your application will look like and what state, actions and effects belong together. By only having a root context you can always point to any domain from any other domain allowing you to easily manage cross-domain logic, not having to refactor every time your domain model breaks. -- [Taken from overmind.](https://overmindjs.org/core/writing-application-logic)
- An action can be defined with just a function - no need to wrap it with `action()`.
- A thunk can change state just like an action.
- Listeners are inspectable, allowing you to see where they are defined, and what they are doing.

## Kudos 🙏

Huge thanks to the amazing people behind [Redux](https://redux.js.org/), and [easy-peasy](https://easy-peasy.now.sh/).
