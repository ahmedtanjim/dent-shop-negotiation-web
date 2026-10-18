;(function () {
          var b = document.getElementById('dsm-optout')
          if (!b) return
          var set = function () { b.textContent = 'Opted out of analytics'; b.style.cursor = 'default' }
          try { if (localStorage.getItem('dsm_analytics_optout') === '1' || navigator.globalPrivacyControl) set() } catch (e) {}
          b.setAttribute('href', '#')
          b.addEventListener('click', function (e) {
            e.preventDefault()
            try { localStorage.setItem('dsm_analytics_optout', '1') } catch (err) {}
            set()
          })
        })()
