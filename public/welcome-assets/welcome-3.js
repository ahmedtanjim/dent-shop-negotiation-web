(function(){const api = "https://api.dentshopmanager.com";

  ;(function () {
    fetch(api + '/api/app/contact')
      .then(function (r) { return r.ok ? r.json() : null })
      .then(function (d) {
        var email = d && d.supportEmail
        if (!email || email.indexOf('@') < 0) return
        document.querySelectorAll('[data-support-email]').forEach(function (a) {
          a.setAttribute('href', 'mailto:' + email)
          if (a.getAttribute('data-support-email') === 'text') a.textContent = email
        })
      })
      .catch(function () {})
  })()
})();
