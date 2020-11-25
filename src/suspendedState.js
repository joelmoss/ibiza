import store from './store'

export default (fetchFn, key) => {
  if (!store.fetches[key]) {
    store.debug && console.log('[Ibiza] Fetching %o ...', key)

    store.fetches[key] = {
      fetch: (typeof fetchFn.then === 'function' ? fetchFn : fetchFn(key))
        .then(response => {
          store.debug && console.log('[Ibiza] Fetched %o successfully', key)

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
