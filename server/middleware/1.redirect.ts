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
            <title>${link.title | link.description || 'Link Preview'}</title>
            <meta name='viewport' content='width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no' />
            <meta name='format-detection' content='telephone=no' />
            <meta http-equiv='X-UA-Compatible' content='IE=edge' />
            <meta name='MobileOptimized' content='176' />
            <meta name='HandheldFriendly' content='True' />
            <meta name='robots' content='index, follow' /> 
            <meta property='og:type' content='website>           
            <meta property="og:title" content="${link.title | link.description || 'Link Preview'}" />
            <meta property="og:description" content="${link.description || ''}" />
            <meta property='og:site_name' content='Socionity'>
            <meta name='twitter:card' content='summary'>
            <meta name='twitter:title' content="${link.title | link.description || 'Link Preview'}">
            <meta name='twitter:description' content="${link.description || ''}">
            <meta name='twitter:image' content="${link.image || ''}">
            <link rel='canonical' href="${getRequestURL(event)}" />
            <link rel='shortcut icon' href='/favicon.ico' type='image/x-icon'>
            <base href="${getRequestURL(event)}"> 
            <meta name='keywords' content="article, website, shorturl">
            <meta property='fb:app_id' content="4108838539203518">
            <link href='https://socionity.uk/cdn-cgi/image/width=256/${link.image}' rel='shortcut icon'>
            <meta name="twitter:card" content="summary_large_image" />
          </head>
          <body style='background:url("${link.image || ''}"); background-attachment: fixed;'>
            <div class='container'>
              <div class='row'>
                <div class='col-md-6'>
                  <article id='links'>
                    <div class='row'>
                      <div class='col-12'>
                        <div class='d-flex flex-column align-items-center'>
                          <img src="${link.image || ''}" class='link-image' style='width: 125px; height: 125px; border-width: 4px; border-color: #000000; border-style: solid; object-fit: contain;' alt='Avatar loading='lazy'>
                        </div>
                      </div>
                      <div class='col-12'>
                        <h1 style='text-align: center;'>${link.title | link.description || 'Link Preview'}</h1>
                      </div>
                      <div class='col-12'>
                        <div href='#' class='link-btn' style='background: transparent; border-width: 0px; border-color: #000000; border-style: solid; box-shadow: 0px 0px 20px 0px #00000010; text-align: center;'>
                          <div>
                            <img src="${link.image || ''}" class='link-btn-image' loading='lazy' alt='" . $q[0]->custom_title . "' style='width:100%'>
                          </div>
                          <p>${link.description || ''}</p>
                        </div>
                      </div>
                      <div id='biolink_block_id_131825_2' class='col-12'>
                        <a href='#' class='btn btn-block btn-primary' style='background: transparent; color: transparent; border-width: 0px; border-color: #000000; border-style: solid; text-align: center;'>
                          <div>
                            <img src='https://socionity.uk/assets/img/wa.gif' class='link-btn-image' loading='lazy' alt='Private Content Image' style='width:1px;'>
                          </div>
                          <span style='color:#fff;'>${link.title | link.description || 'Link Preview'}</span>
                        </a>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </div>
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
