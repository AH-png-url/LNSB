/* Access code is now exchanged once for an HttpOnly server session cookie. */
(() => {
  const USER_KEY = 'lnsb-username';
  const CLAIMS_KEY = 'lnsb-nickname-keys';
  const $ = (selector) => document.querySelector(selector);
  const normalize = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  function readClaims() { try { const value = JSON.parse(localStorage.getItem(CLAIMS_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } }

  document.addEventListener('submit', async (event) => {
    if (event.target?.id !== 'nameForm') return;
    event.preventDefault(); event.stopImmediatePropagation();
    const form = event.target, nickname = $('#usernameInput').value.trim().replace(/\s+/g, ' ').slice(0, 32);
    const error = $('#nicknameError'), submit = form.querySelector('[type=submit]');
    if (nickname.length < 2) { error.textContent = 'Nicknames must be at least 2 characters.'; return; }
    submit.disabled = true; error.textContent = '';
    try {
      const claims = readClaims(), key = claims[normalize(nickname)];
      const response = await fetch('/api/nicknames/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'x-nickname': nickname, 'x-nickname-key': key } : {}) }, body: JSON.stringify({ username: nickname, ...(key ? { claimKey: key } : {}) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not claim that nickname.');
      claims[normalize(result.username)] = result.claimKey; localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims)); localStorage.setItem(USER_KEY, result.username); location.reload();
    } catch (errorResult) { error.textContent = errorResult.message; }
    finally { submit.disabled = false; }
  }, true);

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if ((url.startsWith('/api/sounds') && method === 'POST') || (url === '/api/feedback' && method === 'POST')) {
      const nickname = localStorage.getItem(USER_KEY) || '', key = readClaims()[normalize(nickname)];
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      if (nickname) headers.set('x-nickname', nickname);
      if (key) headers.set('x-nickname-key', key);
      init = { ...init, headers };
    }
    return realFetch(input, init);
  };

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('#changeName')) return;
    event.preventDefault(); event.stopImmediatePropagation(); localStorage.removeItem(USER_KEY);
    $('#usernameInput').value = ''; $('#nicknameError').textContent = ''; $('#accessGate').hidden = true; $('#nameGate').hidden = false; $('#app').hidden = true; $('#usernameInput').focus();
  }, true);
})();
