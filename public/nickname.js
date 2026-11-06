/* Keeps nickname claims attached to write requests and makes sure the selected
   audio file is sent even if the form's file input has no name attribute. */
(() => {
  const USER_KEY = 'lnsb-username';
  const CLAIMS_KEY = 'lnsb-nickname-keys';
  const $ = (selector) => document.querySelector(selector);
  const normalize = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

  function readClaims() {
    try {
      const value = JSON.parse(localStorage.getItem(CLAIMS_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  document.addEventListener('submit', async (event) => {
    if (event.target?.id !== 'nameForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const form = event.target;
    const input = $('#usernameInput');
    const error = $('#nicknameError');
    const submit = form.querySelector('[type=submit]');
    if (!input || !error || !submit) return;

    const nickname = input.value.trim().replace(/\s+/g, ' ').slice(0, 32);
    if (nickname.length < 2) {
      error.textContent = 'Nicknames must be at least 2 characters.';
      return;
    }

    submit.disabled = true;
    error.textContent = '';
    try {
      const claims = readClaims();
      const key = claims[normalize(nickname)];
      const response = await fetch('/api/nicknames/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'x-nickname': nickname, 'x-nickname-key': key } : {})
        },
        body: JSON.stringify({ username: nickname, ...(key ? { claimKey: key } : {}) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not claim that nickname.');
      claims[normalize(result.username)] = result.claimKey;
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
      localStorage.setItem(USER_KEY, result.username);
      location.reload();
    } catch (errorResult) {
      error.textContent = errorResult.message || 'Could not claim that nickname.';
    } finally {
      submit.disabled = false;
    }
  }, true);

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const isSoundUpload = url.startsWith('/api/sounds') && method === 'POST';
    const isFeedback = url === '/api/feedback' && method === 'POST';

    if (isSoundUpload || isFeedback) {
      const nickname = localStorage.getItem(USER_KEY) || '';
      const key = readClaims()[normalize(nickname)];
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      if (nickname) headers.set('x-nickname', nickname);
      if (key) headers.set('x-nickname-key', key);
      init = { ...init, headers };

      // FormData omits controls without a name. The current file input has an id
      // but may not have name="audio", while Multer expects that exact field.
      if (isSoundUpload && init.body instanceof FormData) {
        const fileInput = $('#file');
        const selectedFile = fileInput?.files?.[0];
        if (selectedFile && !init.body.has('audio')) init.body.append('audio', selectedFile, selectedFile.name);
      }
    }

    return realFetch(input, init);
  };

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('#changeName')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    localStorage.removeItem(USER_KEY);
    const input = $('#usernameInput');
    const error = $('#nicknameError');
    if (input) input.value = '';
    if (error) error.textContent = '';
    const accessGate = $('#accessGate');
    const nameGate = $('#nameGate');
    const app = $('#app');
    if (accessGate) accessGate.hidden = true;
    if (nameGate) nameGate.hidden = false;
    if (app) app.hidden = true;
    input?.focus();
  }, true);
})();
