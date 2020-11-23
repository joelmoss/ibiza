import store from './store'

export default (fetchFn, key, debug) => {
  if (!store.fetches[key]) {
    debug && console.debug('%s Fetching %o ...', debug, key)

    store.fetches[key] = {
      fetch: (typeof fetchFn.then === 'function' ? fetchFn : fetchFn(key))
        .then(response => {
          store.fetches[key].response = response
        })
        .catch(error => {
          store.fetches[key].error = error
        })
    }
  } else {
    if (store.fetches[key].error) {
      throw store.fetches[key].error
    } else if (store.fetches[key].response) {
      return store.fetches[key].response
    }
  }

  throw store.fetches[key].fetch
}
