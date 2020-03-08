# Ibiza - React State Management for Party Animals

## Usage

```javascript
const store = createStore({
  count: 0,
  increment: state => {
    state.count = state.count + 1
  }
})
```

## Differences to easy-peasy

- An action can be defined with just a function - no need to wrap it with `action()`.
- A thunk can change state just like an action.
- Listeners can update state anywhere in the store.
- Proxy support?

## Kudos 🙏

Huge thanks to the amazing people behind [Redux](https://redux.js.org/), and [easy-peasy](https://easy-peasy.now.sh/).
