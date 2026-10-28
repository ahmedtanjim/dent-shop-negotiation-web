// Webflow handled these forms on its own hosting. Here a sign-up is POSTed to the API
// (POST /api/public/leads: stores the lead and starts the training email series), then the
// visitor goes to the page the form names (the training video) WHATEVER the result: a slow
// or failed call never blocks the video (3 s at most). "website" is a honeypot field.
// Same script as the apex site's form (dent_shop_home src/layouts/Webflow.astro); the API
// URL is written out because this static page has no build step.
;(function () {
  var leadsUrl = 'https://api.dentshopmanager.com/api/public/leads'
  function val(f, n) {
    var el = f.querySelector('[name="' + n + '"]')
    return el ? String(el.value || '').trim() : ''
  }
  document.querySelectorAll('form[data-webflow-form]').forEach(function (f) {
    var busy = false
    f.addEventListener('submit', function (e) {
      e.preventDefault()
      if (busy) return
      busy = true
      var next = f.getAttribute('data-redirect') || '/'
      var left = false
      var go = function () { if (!left) { left = true; location.href = next } }
      var btn = f.querySelector('[type="submit"]')
      if (btn && btn.getAttribute('data-wait')) btn.value = btn.getAttribute('data-wait')
      var email = val(f, 'Email')
      if (!email || !window.fetch) return go()
      var consent = f.querySelector('[data-consent]')
      var body = {
        name: val(f, 'Name'),
        email: email,
        shop: val(f, 'Shop'),
        phone: val(f, 'Phone'),
        source: f.getAttribute('data-source') || location.pathname.replace(/^\/+|\/+$|\.html$/g, '') || 'home',
        consent: consent ? consent.textContent.trim() : '',
        website: val(f, 'website'),
      }
      var ctrl = window.AbortController ? new AbortController() : null
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); go() }, 3000)
      try {
        fetch(leadsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl ? ctrl.signal : undefined,
        }).catch(function () {}).then(function () { clearTimeout(timer); go() })
      } catch (err) { clearTimeout(timer); go() }
    })
  })
})()
