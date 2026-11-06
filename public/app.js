const $ = (selector) => document.querySelector(selector);
const USER_KEY = 'lnsb-username';
const FAVORITES_KEY = 'lnsb-favorites';
const TOKEN_KEY = 'lnsb-admin-token';
let username = localStorage.getItem(USER_KEY) || '';
let adminToken = localStorage.getItem(TOKEN_KEY) || '';
let favorites;
try { favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')); } catch { favorites = new Set(); }
let sounds = [];
let view = 'all';

function showApp() {
  $('#nameGate').hidden = Boolean(username);
  $('#app').hidden = !username;
  $('#welcome').textContent = username ? `Hi, ${username}` : '';
  if (username) loadSounds();
}
function say(text, error = false) {
  const message = $('#message');
  message.textContent = text;
  message.className = error ? 'error' : 'success';
}
function saveFavorites() { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); }

async function loadSounds() {
  try {
    const response = await fetch('/api/sounds');
    if (!response.ok) throw new Error('Could not load sounds.');
    sounds = await response.json();
    render();
  } catch (error) { say(error.message, true); }
}
function render() {
  const favoriteSounds = sounds.filter((sound) => favorites.has(sound.id));
  $('#count').textContent = sounds.length;
  $('#allCount').textContent = sounds.length;
  $('#favCount').textContent = favoriteSounds.length;
  $('#boardTitle').firstChild.textContent = view === 'favorites' ? 'Favorites ' : 'Sound Buttons ';
  const query = $('#search').value.trim().toLocaleLowerCase();
  const visible = (view === 'favorites' ? favoriteSounds : sounds).filter((sound) => sound.name.toLocaleLowerCase().includes(query));
  const grid = $('#sounds');
  grid.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? 'No sounds match your search.' : view === 'favorites' ? 'Tap a heart to save favorites here.' : 'No sounds yet — add one above!';
    grid.append(empty);
    return;
  }
  visible.forEach((sound, index) => {
    const card = document.createElement('article');
    card.className = `sound-card color-${index % 8}`;
    const playButton = document.createElement('button');
    playButton.className = 'sound-pad'; playButton.type = 'button'; playButton.title = `Play ${sound.name}`;
    const disc = document.createElement('span'); disc.className = 'disc'; disc.textContent = '♫';
    const title = document.createElement('strong'); title.textContent = sound.name;
    playButton.append(disc, title);
    const audio = document.createElement('audio'); audio.src = sound.sourceUrl; audio.preload = 'none';
    audio.addEventListener('error', () => say(`Could not play “${sound.name}”. Check the audio URL.`, true), { once: true });
    playButton.addEventListener('click', async () => {
      document.querySelectorAll('audio').forEach((item) => { if (item !== audio) { item.pause(); item.currentTime = 0; } });
      try { await audio.play(); playButton.classList.add('playing'); audio.onended = () => playButton.classList.remove('playing'); }
      catch { say('This sound could not be played. Try another audio file or URL.', true); }
    });
    const actions = document.createElement('div'); actions.className = 'sound-actions';
    const favorite = document.createElement('button'); favorite.className = `action favorite${favorites.has(sound.id) ? ' active' : ''}`; favorite.type = 'button'; favorite.textContent = favorites.has(sound.id) ? '♥' : '♡';
    favorite.setAttribute('aria-label', favorites.has(sound.id) ? 'Remove from favorites' : 'Add to favorites'); favorite.setAttribute('aria-pressed', String(favorites.has(sound.id)));
    favorite.addEventListener('click', () => { favorites.has(sound.id) ? favorites.delete(sound.id) : favorites.add(sound.id); saveFavorites(); render(); });
    actions.append(favorite);
    if (adminToken) {
      const download = document.createElement('button'); download.className = 'action'; download.type = 'button'; download.textContent = '↓'; download.title = 'Download sound'; download.addEventListener('click', () => downloadSound(sound));
      const remove = document.createElement('button'); remove.className = 'action remove'; remove.type = 'button'; remove.textContent = '×'; remove.title = 'Remove sound'; remove.addEventListener('click', () => removeSound(sound.id));
      actions.append(download, remove);
    }
    const byline = document.createElement('small'); byline.className = 'byline'; byline.textContent = `added by ${sound.addedBy || 'a sound friend'}`;
    card.append(playButton, byline, actions, audio); grid.append(card);
  });
}

$('#nameForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = $('#usernameInput').value.trim().replace(/\s+/g, ' ').slice(0, 32);
  if (!value) return;
  username = value; localStorage.setItem(USER_KEY, username); showApp();
});
$('#changeName').addEventListener('click', () => { localStorage.removeItem(USER_KEY); username = ''; $('#usernameInput').value = ''; showApp(); });
$('#file').addEventListener('change', () => { $('#fileLabel').textContent = $('#file').files[0]?.name || 'Up to 20 MB'; });
$('#addForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!username) return showApp();
  const data = new FormData(); data.append('name', $('#soundName').value.trim()); data.append('username', username); data.append('sourceUrl', $('#soundUrl').value.trim());
  if ($('#file').files[0]) data.append('audio', $('#file').files[0]);
  const submit = event.currentTarget.querySelector('[type=submit]'); submit.disabled = true;
  try {
    const response = await fetch('/api/sounds', { method: 'POST', body: data }); const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not add sound.');
    event.currentTarget.reset(); $('#fileLabel').textContent = 'Up to 20 MB'; view = 'all'; updateTabs(); say(`“${result.name}” added to the board.`); await loadSounds();
  } catch (error) { say(error.message, true); }
  finally { submit.disabled = false; }
});
$('#feedbackForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!username) return showApp();
  const button = event.currentTarget.querySelector('[type=submit]');
  button.disabled = true;
  $('#feedbackStatus').textContent = 'Sending privately…';
  $('#feedbackStatus').className = '';
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, type: $('#feedbackType').value, message: $('#feedbackMessage').value.trim() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not send your message.');
    event.currentTarget.reset();
    $('#feedbackStatus').textContent = result.message;
    $('#feedbackStatus').className = 'success';
  } catch (error) {
    $('#feedbackStatus').textContent = error.message;
    $('#feedbackStatus').className = 'error';
  } finally { button.disabled = false; }
});
$('#search').addEventListener('input', render);
$('#seeAll').addEventListener('click', () => { view = 'all'; $('#search').value = ''; updateTabs(); render(); });
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { view = tab.dataset.view; updateTabs(); render(); }));
function updateTabs() { document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('selected', tab.dataset.view === view)); }
$('#menu').addEventListener('click', () => { $('#menuPanel').hidden = !$('#menuPanel').hidden; });
$('#verify').addEventListener('click', async () => {
  const candidate = $('#token').value.trim(); if (!candidate) return say('Enter your private admin token first.', true);
  try {
    const response = await fetch('/api/admin/verify', { method: 'POST', headers: { 'x-admin-token': candidate } }); const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    adminToken = candidate; localStorage.setItem(TOKEN_KEY, candidate);
    $('#token').disabled = true; $('#verify').hidden = true; $('#logout').hidden = false; $('#share').hidden = false;
    $('#adminInbox').hidden = false; render(); await loadFeedback(); say('Owner verified. Admin controls and private feedback inbox are enabled.');
  } catch (error) { say(error.message, true); }
});
$('#logout').addEventListener('click', () => {
  adminToken = ''; localStorage.removeItem(TOKEN_KEY); $('#token').value = ''; $('#token').disabled = false;
  $('#verify').hidden = false; $('#logout').hidden = true; $('#share').hidden = true; $('#adminInbox').hidden = true; render();
});
async function loadFeedback() {
  if (!adminToken) return;
  const list = $('#feedbackList'); list.textContent = 'Loading private messages…';
  try {
    const response = await fetch('/api/admin/feedback', { headers: { 'x-admin-token': adminToken } });
    const items = await response.json();
    if (!response.ok) throw new Error(items.message || 'Could not load feedback.');
    list.replaceChildren();
    if (!items.length) { list.textContent = 'No messages yet.'; return; }
    items.forEach((item) => {
      const entry = document.createElement('article'); entry.className = 'feedback-entry';
      const heading = document.createElement('strong'); heading.textContent = `${item.type === 'issue' ? 'Issue report' : 'Feedback'} · ${item.username}`;
      const date = document.createElement('time'); date.dateTime = item.createdAt; date.textContent = new Date(item.createdAt).toLocaleString();
      const body = document.createElement('p'); body.textContent = item.message;
      entry.append(heading, date, body); list.append(entry);
    });
  } catch (error) { list.textContent = error.message; }
}
$('#refreshFeedback').addEventListener('click', loadFeedback);
async function removeSound(id) {
  if (!confirm('Remove this sound from the shared board?')) return;
  try {
    const response = await fetch(`/api/sounds/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } }); const result = await response.json();
    if (!response.ok) throw new Error(result.message); favorites.delete(id); saveFavorites(); say('Sound removed.'); await loadSounds();
  } catch (error) { say(error.message, true); }
}
async function downloadSound(sound) {
  try {
    const response = await fetch(`/api/sounds/${encodeURIComponent(sound.id)}/download`, { headers: { 'x-admin-token': adminToken } });
    if (!response.ok) { const result = await response.json(); throw new Error(result.message || 'Download failed.'); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = sound.name.replace(/[^a-z0-9 _-]/gi, '').trim() || 'sound';
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { say(error.message, true); }
}
$('#share').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); say('Share link copied!'); } catch { say('Copy unavailable — share the URL from your address bar.', true); } });
async function restoreAdmin() {
  if (!adminToken) return;
  $('#token').value = adminToken;
  try {
    const response = await fetch('/api/admin/verify', { method: 'POST', headers: { 'x-admin-token': adminToken } });
    if (!response.ok) throw new Error('Invalid token');
    $('#token').disabled = true; $('#verify').hidden = true; $('#logout').hidden = false; $('#share').hidden = false; $('#adminInbox').hidden = false;
    await loadFeedback();
  } catch { adminToken = ''; localStorage.removeItem(TOKEN_KEY); $('#token').value = ''; }
}
showApp();
restoreAdmin().then(render);
