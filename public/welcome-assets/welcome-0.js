// The landing page is the site root; a signed-in shop goes straight to its cases.
try {
  if (localStorage.getItem('dsm_neg_token')) location.replace('/cases' + location.hash)
} catch (e) {}
