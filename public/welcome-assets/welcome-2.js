// Webflow handled these forms on its own hosting. Here the sign-up goes straight to
      // the page the form names (the training video); nothing is stored.
      document.querySelectorAll('form[data-webflow-form]').forEach(function (f) {
        f.addEventListener('submit', function (e) {
          e.preventDefault()
          location.href = f.getAttribute('data-redirect') || '/'
        })
      })
