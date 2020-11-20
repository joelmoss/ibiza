import { unwrap } from './store'

export let devToolExtension
export let devTool

export const initDevTools = () => {
  if (devTool) return devTool

  if (!devToolExtension) {
    try {
      devToolExtension =
        window.__REDUX_DEVTOOLS_EXTENSION__ || window.top.__REDUX_DEVTOOLS_EXTENSION__
    } catch (error) {} /* eslint-disable-line no-empty */
  }

  if (devToolExtension) {
    devTool = devToolExtension.connect({ name: 'Ibiza' })
    devTool.init(unwrap())
  }
}
