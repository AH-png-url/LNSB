const $ = (selector) => document.querySelector(selector);
const USER_KEY = 'lnsb-username', FAVORITES_KEY = 'lnsb-favorites', TOKEN_KEY = 'lnsb-admin-token';
const OWNER_BYPASS_KEY = 'lnsb-owner-bypass';
let username = localStorage.getItem(USER_KEY) || '';
let adminToken = localStorage.getItem(TOKEN_KEY) || '';
let accessGranted = false, favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')); } catch {}
let sounds = [], view = 'all';
function showAccessGate() {
  $('#accessGate').hidden = accessGranted;
  $('#nameGate').hidden = !accessGranted || Boolean(username);
  $('#app').hidden = !accessGranted || !username;
  if (accessGranted && username) { $('#welcome').textContent = `Hi, ${username}`; loadSounds(); }
}
function say(text, error = false) { const el = $('#message'); if (el) { el.textContent = text; el.className = error ? 'error' : 'success'; } }
function saveFavorites() { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); }
async function loadSounds() {
  try { const response = await fetch('/api/sounds'); if (response.status === 403) { expireAccess(); return; } if (!response.ok) throw new Error('Could not load sounds.'); sounds = await response.json(); render(); }
  catch (error) { say(error.message, true); }
}
function expireAccess() { accessGranted = false; localStorage.removeItem(OWNER_BYPASS_KEY); showAccessGate(); $('#accessError').textContent = 'All access sessions were reset. Enter the current board code.'; }
function render() {
  const favoritesList = sounds.filter((sound) => favorites.has(sound.id));
  $('#count').textContent = sounds.length; $('#allCount').textContent = sounds.length; $('#favCount').textContent = favoritesList.length;
  $('#boardTitle').firstChild.textContent = view === 'favorites' ? 'Favorites ' : 'Sound Buttons ';
  const query = $('#search').value.trim().toLocaleLowerCase();
  const visible = (view === 'favorites' ? favoritesList : sounds).filter((sound) => sound.name.toLocaleLowerCase().includes(query));
  const grid = $('#sounds'); grid.replaceChildren();
  if (!visible.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = query ? 'No sounds match your search.' : view === 'favorites' ? 'Tap a heart to save favorites here.' : 'No sounds yet — add one above!'; grid.append(empty); return; }
  visible.forEach((sound, index) => {
    const card = document.createElement('article'); card.className = `sound-card color-${index % 8}`;
    const play = document.createElement('button'); play.className = 'sound-pad'; play.type = 'button'; play.title = `Play ${sound.name}`;
    const disc = document.createElement('span'); disc.className = 'disc'; disc.textContent = '♫';
    const title = document.createElement('strong'); title.textContent = sound.name; play.append(disc, title);
    const audio = document.createElement('audio'); audio.src = sound.sourceUrl; audio.preload = 'none';
    play.addEventListener('click', async () => { document.querySelectorAll('audio').forEach((item) => { if (item !== audio) { item.pause(); item.currentTime = 0; } }); try { await audio.play(); play.classList.add('playing'); audio.onended = () => play.classList.remove('playing'); } catch { say('This sound could not be played.', true); } });
    const actions = document.createElement('div'); actions.className = 'sound-actions';
    const heart = document.createElement('button'); heart.className = `action favorite${favorites.has(sound.id) ? ' active' : ''}`; heart.type = 'button'; heart.textContent = favorites.has(sound.id) ? '♥' : '♡'; heart.onclick = () => { favorites.has(sound.id) ? favorites.delete(sound.id) : favorites.add(sound.id); saveFavorites(); render(); }; actions.append(heart);
    if (adminToken) { const download = document.createElement('button'); download.className = 'action'; download.type = 'button'; download.textContent = '↓'; download.title = 'Download sound'; download.onclick = () => downloadSound(sound); const remove = document.createElement('button'); remove.className = 'action remove'; remove.type = 'button'; remove.textContent = '×'; remove.title = 'Remove sound'; remove.onclick = () => removeSound(sound.id); actions.append(download, remove); }
    const byline = document.createElement('small'); byline.className = 'byline'; byline.textContent = `added by ${sound.addedBy || 'a sound friend'}`; card.append(play, byline, actions, audio); grid.append(card);
  });
}
$('#accessForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.currentTarget.querySelector('[type=submit]'); button.disabled = true; $('#accessError').textContent = '';
  try { const response = await fetch('/api/access/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: $('#accessCodeInput').value.trim() }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); accessGranted = true; $('#accessCodeInput').value = ''; showAccessGate(); }
  catch (error) { $('#accessError').textContent = error.message; } finally { button.disabled = false; }
});
$('#showOwnerRecovery').addEventListener('click', () => { $('#ownerRecovery').hidden = !$('#ownerRecovery').hidden; if (!$('#ownerRecovery').hidden) $('#recoveryAdminToken').focus(); });
$('#recoverAccess').addEventListener('click', async () => {
  const button = $('#recoverAccess'), passcode = $('#recoveryAdminToken').value.trim(); if (!passcode) { $('#recoveryError').textContent = 'Enter your admin passcode.'; return; }
  button.disabled = true; $('#recoveryError').textContent = '';
  try { const response = await fetch('/api/admin/access-bypass', { method: 'POST', headers: { 'x-admin-token': passcode } }); const result = await response.json(); if (!response.ok) throw new Error(result.message); adminToken = passcode; localStorage.setItem(TOKEN_KEY, passcode); localStorage.setItem(OWNER_BYPASS_KEY, 'true'); accessGranted = true; $('#recoveryAdminToken').value = ''; showAccessGate(); await restoreAdmin(); }
  catch (error) { $('#recoveryError').textContent = error.message; } finally { button.disabled = false; }
});
$('#nameForm').addEventListener('submit', (event) => { event.preventDefault(); username = $('#usernameInput').value.trim(); localStorage.setItem(USER_KEY, username); showAccessGate(); });
$('#changeName').addEventListener('click', () => { username = ''; localStorage.removeItem(USER_KEY); $('#usernameInput').value = ''; showAccessGate(); });
$('#file').addEventListener('change', () => { $('#fileLabel').textContent = $('#file').files[0]?.name || 'Up to 20 MB'; });
$('#addForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type=submit]'); if (!accessGranted || !username) return showAccessGate();
  const data = new FormData(form); data.set('name', $('#soundName').value.trim()); data.set('username', username); data.set('sourceUrl', $('#soundUrl').value.trim()); button.disabled = true;
  try { const response = await fetch('/api/sounds', { method: 'POST', body: data }); const result = await response.json(); if (response.status === 403) { expireAccess(); throw new Error(result.message); } if (!response.ok) throw new Error(result.message); form.reset(); $('#fileLabel').textContent = 'Up to 20 MB'; view = 'all'; updateTabs(); say(`“${result.name}” added to the board.`); await loadSounds(); }
  catch (error) { say(error.message, true); } finally { button.disabled = false; }
});
$('#feedbackForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type=submit]'); button.disabled = true; $('#feedbackStatus').textContent = 'Sending privately…';
  try { const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: $('#feedbackType').value, message: $('#feedbackMessage').value.trim() }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); form.reset(); $('#feedbackStatus').textContent = result.message; $('#feedbackStatus').className = 'success'; }
  catch (error) { $('#feedbackStatus').textContent = error.message; $('#feedbackStatus').className = 'error'; } finally { button.disabled = false; }
});
$('#search').addEventListener('input', render); $('#seeAll').addEventListener('click', () => { view = 'all'; $('#search').value = ''; updateTabs(); render(); });
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { view = tab.dataset.view; updateTabs(); render(); }));
function updateTabs() { document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('selected', tab.dataset.view === view)); }
$('#menu').addEventListener('click', () => { $('#menuPanel').hidden = !$('#menuPanel').hidden; });
$('#verify').addEventListener('click', async () => { const candidate = $('#token').value.trim(); if (!candidate) return say('Enter your private admin token first.', true); try { const response = await fetch('/api/admin/verify', { method: 'POST', headers: { 'x-admin-token': candidate } }); const result = await response.json(); if (!response.ok) throw new Error(result.message); adminToken = candidate; localStorage.setItem(TOKEN_KEY, candidate); showAdmin(); await loadFeedback(); say('Owner verified. Admin controls enabled.'); } catch (error) { say(error.message, true); } });
function showAdmin() { $('#token').value = adminToken; $('#token').disabled = true; $('#verify').hidden = true; $('#logout').hidden = false; $('#share').hidden = false; $('#adminInbox').hidden = false; $('#codeControls').hidden = false; render(); }
$('#changeCodeForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget, code = $('#newAccessCode').value.trim(), confirmCode = $('#confirmAccessCode').value.trim(), status = $('#codeStatus'); if (code.length < 6 || code.length > 128) { status.textContent = 'Code must be 6–128 characters.'; status.className = 'error'; return; } if (code !== confirmCode) { status.textContent = 'The codes do not match.'; status.className = 'error'; return; } const button = form.querySelector('[type=submit]'); button.disabled = true; try { const response = await fetch('/api/admin/access-code', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken }, body: JSON.stringify({ code }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); form.reset(); status.textContent = result.message; status.className = 'success'; } catch (error) { status.textContent = error.message; status.className = 'error'; } finally { button.disabled = false; } });
$('#resetAllAccess').addEventListener('click', async () => { if (!confirm('Reset access for everyone? All visitors, including you, must enter the current code again.')) return; const button = $('#resetAllAccess'); button.disabled = true; try { const response = await fetch('/api/admin/reset-access', { method: 'POST', headers: { 'x-admin-token': adminToken } }); const result = await response.json(); if (!response.ok) throw new Error(result.message); accessGranted = false; localStorage.removeItem(OWNER_BYPASS_KEY); $('#adminInbox').hidden = true; $('#codeControls').hidden = true; $('#menuPanel').hidden = true; showAccessGate(); $('#accessError').textContent = result.message; } catch (error) { $('#codeStatus').textContent = error.message; $('#codeStatus').className = 'error'; } finally { button.disabled = false; } });
$('#logout').addEventListener('click', () => { adminToken = ''; localStorage.removeItem(TOKEN_KEY); $('#token').value = ''; $('#token').disabled = false; $('#verify').hidden = false; $('#logout').hidden = true; $('#share').hidden = true; $('#adminInbox').hidden = true; $('#codeControls').hidden = true; render(); });
async function loadFeedback() { if (!adminToken) return; const list = $('#feedbackList'); list.textContent = 'Loading private messages…'; try { const response = await fetch('/api/admin/feedback', { headers: { 'x-admin-token': adminToken } }); const items = await response.json(); if (!response.ok) throw new Error(items.message); list.replaceChildren(); if (!items.length) { list.textContent = 'No messages yet.'; return; } items.forEach((item) => { const entry = document.createElement('article'); entry.className = 'feedback-entry'; const heading = document.createElement('strong'); heading.textContent = `${item.type === 'issue' ? 'Issue report' : 'Feedback'} · ${item.username}`; const date = document.createElement('time'); date.textContent = new Date(item.createdAt).toLocaleString(); const body = document.createElement('p'); body.textContent = item.message; entry.append(heading, date, body); list.append(entry); }); } catch (error) { list.textContent = error.message; } }
$('#refreshFeedback').addEventListener('click', loadFeedback);
async function removeSound(id) { if (!confirm('Remove this sound from the shared board?')) return; try { const response = await fetch(`/api/sounds/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } }); const result = await response.json(); if (!response.ok) throw new Error(result.message); favorites.delete(id); saveFavorites(); say('Sound removed.'); await loadSounds(); } catch (error) { say(error.message, true); } }
async function downloadSound(sound) { try { const response = await fetch(`/api/sounds/${encodeURIComponent(sound.id)}/download`, { headers: { 'x-admin-token': adminToken } }); if (!response.ok) throw new Error('Download failed.'); const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = sound.name.replace(/[^a-z0-9 _-]/gi, '').trim() || 'sound'; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url); } catch (error) { say(error.message, true); } }
$('#share').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); say('Share link copied!'); } catch { say('Copy the URL from your address bar.', true); } });
async function restoreAdmin() { if (!adminToken) return; try { const response = await fetch('/api/admin/verify', { method: 'POST', headers: { 'x-admin-token': adminToken } }); if (!response.ok) throw new Error(); showAdmin(); await loadFeedback(); } catch { adminToken = ''; localStorage.removeItem(TOKEN_KEY); } }
async function initialize() {
  try { const response = await fetch('/api/access/session'); accessGranted = response.ok; } catch { accessGranted = false; }
  if (accessGranted) showAccessGate(); else { $('#accessGate').hidden = false; $('#nameGate').hidden = true; $('#app').hidden = true; }
  await restoreAdmin();
  render();
}
initialize();
