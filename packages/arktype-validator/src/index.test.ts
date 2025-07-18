import { type } from 'arktype'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect } from 'hono/utils/types'
import { arktypeValidator } from '.'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

describe('Basic', () => {
  const app = new Hono()

  const jsonSchema = type({
    name: 'string',
    age: 'number',
  })

  const querySchema = type({
    'name?': 'string',
  })

  const route = app.post(
    '/author',
    arktypeValidator('json', jsonSchema),
    arktypeValidator('query', querySchema),
    (c) => {
      const data = c.req.valid('json')
      const query = c.req.valid('query')

      return c.json({
        success: true,
        message: `${data.name} is ${data.age}`,
        queryName: query.name,
      })
    }
  )

  app.get(
    '/headers',
    arktypeValidator(
      'header',
      type({
        'User-Agent': 'string',
      })
    ),
    (c) => c.json({ success: true, userAgent: c.req.header('User-Agent') })
  )

  type Actual = ExtractSchema<typeof route>
  type Expected = {
    '/author': {
      $post: {
        input: {
          json: {
            name: string
            age: number
          }
        } & {
          query: {
            name?: string | undefined
          }
        }
        output: {
          success: boolean
          message: string
          queryName: string | undefined
        }
        outputFormat: 'json'
        status: ContentfulStatusCode
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/author?name=Metallo', {
      body: JSON.stringify({
        name: 'Superman',
        age: 20,
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      message: 'Superman is 20',
      queryName: 'Metallo',
    })
  })

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/author', {
      body: JSON.stringify({
        name: 'Superman',
        age: '20',
      }),
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    const data = (await res.json()) as { success: boolean }
    expect(data['success']).toBe(false)
  })

  it("doesn't return cookies after headers validation", async () => {
    const req = new Request('http://localhost/headers', {
      headers: {
        'User-Agent': 'invalid',
        Cookie: 'SECRET=123',
      },
    })

    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    const data = (await res.json()) as { succcess: false; errors: type.errors }
    expect(data.errors).toHaveLength(1)
    expect(data.errors[0].data).not.toHaveProperty('cookie')
  })
})

describe('With Hook', () => {
  const app = new Hono()

  const schema = type({
    id: 'number',
    title: 'string',
  })

  app.post(
    '/post',
    arktypeValidator('json', schema, (result, c) => {
      if (!result.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return c.text(`${(result.data as any).id} is invalid!`, 400)
      }
      const data = result.data
      return c.text(`${data.id} is valid!`)
    }),
    (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true,
        message: `${data.id} is ${data.title}`,
      })
    }
  )

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('123 is valid!')
  })

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: '123',
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('123 is invalid!')
  })
})
