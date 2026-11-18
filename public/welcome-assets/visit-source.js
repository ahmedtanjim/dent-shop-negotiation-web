// How a visit reached us, kept for the sign-up (growth plan 2026-11-19). First-party only:
// the tagged link's utm_* values (or which ad network's click id was on it), the outside
// website that sent the visitor and the first page they saw are kept in this browser
// (localStorage dsm_attr) for up to 30 days and added to the sign-up links on
// app.dentshopmanager.com, which saves them with the new shop. Nothing goes anywhere else.
// Skipped under Global Privacy Control or after "Turn off analytics". The same script runs on
// dentshopmanager.com, ai.dentshopmanager.com and app.dentshopmanager.com's landing — keep the
// copies in step (the app reads the same record: dent_shop_manager_web src/utils/signupSource.ts).
(function () {
  try {
    if (navigator.globalPrivacyControl === true || localStorage.getItem('dsm_analytics_optout') === '1') return
    var KEY = 'dsm_attr', TTL = 30 * 24 * 3600 * 1000, now = Date.now()
    var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
    var CLICK = { gclid: 'google-ads', fbclid: 'facebook', msclkid: 'microsoft-ads' }
    var q = new URLSearchParams(location.search), out = new URLSearchParams(), tagged = false
    UTM.forEach(function (k) { var v = (q.get(k) || '').trim(); if (v) { out.set(k, v.slice(0, 100)); tagged = true } })
    for (var c in CLICK) if (q.get(c)) { out.set('dsm_click', CLICK[c]); tagged = true; break }
    var ref = ''
    try { ref = document.referrer ? new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, '') : '' } catch (e) {}
    // Our own sites aren't "another website".
    if (ref && !/(^|\.)dentshopmanager\.com$/.test(ref) && ref !== location.hostname) out.set('dsm_ref', ref)
    var kept = null
    try { kept = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) {}
    if (kept && (typeof kept.q !== 'string' || typeof kept.at !== 'number' || now - kept.at > TTL || now < kept.at)) kept = null
    // A tagged visit always wins; one from another website only fills an empty slot.
    if (tagged || (out.get('dsm_ref') && !kept)) {
      out.set('dsm_landing', (location.hostname.replace(/^www\./, '') + location.pathname).slice(0, 200))
      kept = { q: out.toString(), at: now }
      localStorage.setItem(KEY, JSON.stringify(kept))
    }
    if (!kept) return
    var saved = new URLSearchParams(kept.q)
    // The sign-up page is on app.dentshopmanager.com, which can't read this site's storage:
    // its links carry the record (only what isn't already on the link).
    var carry = function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]')
      if (!a) return
      var u
      try { u = new URL(a.getAttribute('href'), location.href) } catch (err) { return }
      if (u.pathname !== '/signup' || (u.hostname !== 'app.dentshopmanager.com' && u.hostname !== location.hostname)) return
      saved.forEach(function (v, k) { if (!u.searchParams.has(k)) u.searchParams.set(k, v) })
      a.setAttribute('href', u.toString())
    }
    document.addEventListener('click', carry, true)
    document.addEventListener('auxclick', carry, true)
  } catch (e) {}
})()
