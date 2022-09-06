import { rest } from 'msw'

const handlers = [
  rest.get('/users/1', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Joel Moss' }))
  }),

  rest.get('/users/2', async (req, res, ctx) => {
    return res(ctx.delay(100), ctx.json({ name: 'Joel2 Moss2' }))
  }),

  rest.get('/users/page=1', async (req, res, ctx) => {
    return res(
      ctx.delay(200),
      ctx.json([
        { id: 1, name: 'Joel1 Moss1' },
        { id: 2, name: 'Joel2 Moss2' }
      ])
    )
  }),

  rest.get('/users/page=2', async (req, res, ctx) => {
    return res(
      ctx.delay(200),
      ctx.json([
        { id: 3, name: 'Joel3 Moss3' },
        { id: 4, name: 'Joel4 Moss4' }
      ])
    )
  })
]

export default handlers
