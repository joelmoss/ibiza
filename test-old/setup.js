import '@testing-library/jest-dom/extend-expect'
import 'cross-fetch/polyfill'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const handlers = [
  rest.get('/user', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Joel Moss' }))
  }),

  rest.get('/users/1', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ id: 1, name: 'Joel Moss' }))
  }),

  rest.get('/posts/1', async (req, res, ctx) => {
    return res(
      ctx.delay(100),
      ctx.json({ id: 1, title: 'My Awesome Post', author: { name: 'Joel' } })
    )
  }),

  rest.get('/error', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.status(500), ctx.json({ errorMessage: 'ERROR!' }))
  })
]

const server = setupServer(...handlers)

beforeAll(() => server.listen())

// if you need to add a handler after calling setupServer for some specific test this will remove
// that handler for the rest of them (which is important for test isolation):
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
