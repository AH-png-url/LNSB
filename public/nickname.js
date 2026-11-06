/* Ensures nicknames are claimed on the server and bound to a browser-held secret. */
(() => {
  const USER_KEY = 'lnsb-username';
  const CLAIMS_KEY = 'lnsb-nickname-keys';
  const ACCESS_KEY = 'lnsb-board-access-code';
  const OWNER_BYPASS_KEY = 'lnsb-owner-bypass';
  const $ = (selector) => document.querySelector(selector);

  function normalize(value) {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  }
  function readClaims() {
    try {
      const claims = JSON.parse(localStorage.getItem(CLAIMS_KEY) || '{}');
      return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : {};
    } catch { return {}; }
  }
  function boardHeaders() {
    const headers = {};
    const accessCode = localStorage.getItem(ACCESS_KEY) || '';
    if (accessCode) headers['x-access-code'] = accessCode;
    return headers;
  }

  document.addEventListener('submit', async (event) => {
    if (!event.target || event.target.id !== 'nameForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.target;
    const nickname = $('#usernameInput').value.trim().replace(/\s+/g, ' ').slice(0, 32);
    const error = $('#nicknameError');
    const submit = form.querySelector('[type=submit]');
    if (nickname.length < 2) {
      error.textContent = 'Nicknames must be at least 2 characters.';
      return;
    }
    submit.disabled = true;
    error.textContent = '';
    try {
      const claims = readClaims();
      const key = claims[normalize(nickname)];
      const headers = { 'Content-Type': 'application/json', ...boardHeaders() };
      const response = await fetch('/api/nicknames/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: nickname, ...(key ? { claimKey: key } : {}) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not claim that nickname.');
      claims[normalize(result.username)] = result.claimKey;
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
      localStorage.setItem(USER_KEY, result.username);
      location.reload();
    } catch (requestError) {
      error.textContent = requestError.message;
    } finally {
      submit.disabled = false;
    }
  }, true);

  // Add a claimed nickname proof to sound and feedback submissions.
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api/sounds') && init.method === 'POST' || url === '/api/feedback' && init.method === 'POST') {
      const username = localStorage.getItem(USER_KEY) || '';
      const claimKey = readClaims()[normalize(username)];
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      if (username) headers.set('x-nickname', username);
      if (claimKey) headers.set('x-nickname-key', claimKey);
      init = { ...init, headers };
    }
    return originalFetch(input, init);
  };

  document.addEventListener('click', (event) => {
    if (!event.target.closest || !event.target.closest('#changeName')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    localStorage.removeItem(USER_KEY);
    $('#usernameInput').value = '';
    $('#nicknameError').textContent = '';
    $('#accessGate').hidden = true;
    $('#nameGate').hidden = false;
    $('#app').hidden = true;
    $('#usernameInput').focus();
  }, true);
})();
