import type { LinkSchema } from '@@/schemas/link'
import type { z } from 'zod'
import { parsePath, withQuery } from 'ufo'

function isBot(ua: string) {
  const botRegex = /bot|crawler|spider|facebook|whatsapp|discord|twitter|slack|telegram|preview|vkShare|skype|linkedin/i
  return botRegex.test(ua)
}

export default eventHandler(async (event) => {
  const { pathname: slug } = parsePath(event.path.replace(/^\/|\/$/g, ''))
  const { slugRegex, reserveSlug } = useAppConfig(event)
  const { homeURL, linkCacheTtl, redirectWithQuery, caseSensitive } = useRuntimeConfig(event)
  const { cloudflare } = event.context

  if (event.path === '/' && homeURL)
    return sendRedirect(event, homeURL)

  if (slug && !reserveSlug.includes(slug) && slugRegex.test(slug) && cloudflare) {
    const { KV } = cloudflare.env

    const getLink = async (key: string) =>
      await KV.get(`link:${key}`, { type: 'json', cacheTtl: linkCacheTtl })

    const lowerCaseSlug = slug.toLowerCase()
    let link: z.infer<typeof LinkSchema> | null = await getLink(caseSensitive ? slug : lowerCaseSlug)

    if (!caseSensitive && !link && lowerCaseSlug !== slug)
      link = await getLink(slug)

    if (link) {
      event.context.link = link

      try {
        await useAccessLog(event)
      }
      catch (error) {
        console.error('Failed write access log:', error)
      }

      const ua = getHeader(event, 'user-agent') || ''
      if (isBot(ua)) {
        // Generate OG HTML for bots
        const html = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${link.title || 'Link Preview'}</title>
            <meta property="og:title" content="${link.title || ''}" />
            <meta property="og:description" content="${link.description || ''}" />
            <meta property="og:image" content="${link.image || ''}" />
            <meta property="og:url" content="${getRequestURL(event)}" />
            <meta name="twitter:card" content="summary_large_image" />
          </head>
          <body>
            <h1>Redirecting...</h1>
          </body>
          </html>
        `
        return send(event, html, 'text/html')
      }

      const target = redirectWithQuery ? withQuery(link.url, getQuery(event)) : link.url
      return sendRedirect(event, target, +useRuntimeConfig(event).redirectStatusCode)
    }
  }
})
