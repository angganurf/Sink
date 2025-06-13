import { customAlphabet } from 'nanoid'
import { z } from 'zod'

// Schema Token
export const TokenSchema = z.object({
  token: z.string().trim().max(64),

  username: z.string().trim().min(3).max(64),

  createdAt: z.number().int().default(() => Math.floor(Date.now() / 1000)),
})
