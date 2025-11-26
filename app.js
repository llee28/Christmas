// Simple client-side gift exchange
// Data storage keys
const STORAGE_KEY = 'cmas_users_v1';
const CUR_USER_KEY = 'cmas_current_v1';


const catalog = [
  { id: 'c1', name: 'Candy Cane', emoji: '🍬', cost: 5 },
  { id: 'c2', name: 'Gingerbread', emoji: '🧁', cost: 8 },
  { id: 'c3', name: 'Teddy Bear', emoji: '🧸', cost: 20 },
  { id: 'c4', name: 'Snow Globe', emoji: '❄️', cost: 15 },
  { id: 'c5', name: 'Stocking', emoji: '🧦', cost: 12 },
  { id: 'c6', name: 'Present Box', emoji: '🎁', cost: 25 },
];

let users = {}; // username -> {coins, inbox:[], collection:[]}
let currentUser = null;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  if (currentUser) localStorage.setItem(CUR_USER_KEY, currentUser);
  else localStorage.removeItem(CUR_USER_KEY);
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  users = raw ? JSON.parse(raw) : {};
  currentUser = localStorage.getItem(CUR_USER_KEY) || null;
}

function ensureUserExists(username) {
  const u = username.toLowerCase();
  if (!users[u]) {
    users[u] = { username: username, coins: 0, inbox: [], collection: [] };
    save();
  }
  return users[u];
}

function createUser(username, password) {
  username = username.trim();
  password = password.trim();
  if (!username) return { ok:false, msg:'Username required' };
  if (!password) return { ok:false, msg:'Password required' };
  const key = username.toLowerCase();
  if (users[key]) return { ok:false, msg:'Username already exists' };
  users[key] = { username, password, coins: 0, inbox: [], collection: [] };
  currentUser = key;
  save();
  updateUI();
  return { ok:true };
}

function loginUser(username, password) {
  username = username.trim();
  password = password.trim();
  const key = username.toLowerCase();
  const user = users[key];
  if (!user) return { ok:false, msg:'No such user' };
  if (user.password !== password) return { ok:false, msg:'Incorrect password' };
  currentUser = key;
  save();
  updateUI();
  return { ok:true };
}

function logout() {
  currentUser = null;
  save();
  updateUI();
}

function getNow() { return new Date(); }

function xmasOpenDateForYear(year) {
  // midnight local time
  return new Date(year, 11, 25, 0, 0, 0, 0);
}

function canOpen(gift) {
  const now = getNow();
  const openDate = new Date(gift.openDate);
  return now >= openDate;
}

function addCoinsToCurrent(n) {
  if (!currentUser) return;
  users[currentUser].coins += n;
  if (users[currentUser].coins < 0) users[currentUser].coins = 0;
  save();
  updateUI();
}

function sendGift({ giftId, toUsername, message = '' }) {
  if (!currentUser) return { ok:false, msg:'Login required' };
  const from = users[currentUser];
  const toKey = toUsername.trim().toLowerCase();
  if (!users[toKey]) return { ok:false, msg:'Recipient does not exist' };
  const gift = catalog.find(c => c.id === giftId);
  if (!gift) return { ok:false, msg:'Invalid gift' };
  if (from.coins < gift.cost) return { ok:false, msg:'Not enough coins' };

  from.coins -= gift.cost;
  const now = getNow();
  const openDate = xmasOpenDateForYear(now.getFullYear());
  // If today already past xmas this year, set to next year's xmas
  const finalOpenDate = now > openDate ? xmasOpenDateForYear(now.getFullYear() + 1) : openDate;

  const entry = {
    id: `${gift.id}_${Date.now()}`,
    giftId: gift.id,
    name: gift.name,
    emoji: gift.emoji,
    cost: gift.cost,
    sender: from.username,
    message,
    sentAt: now.toISOString(),
    openDate: finalOpenDate.toISOString(),
    opened: false,
  };
  users[toKey].inbox.push(entry);
  save();
  updateUI();
  return { ok:true, entry };
}

function openGift(giftId) {
  if (!currentUser) return { ok:false, msg:'Login required' };
  const u = users[currentUser];
  const idx = u.inbox.findIndex(g => g.id === giftId);
  if (idx === -1) return { ok:false, msg:'Gift not found' };
  const gift = u.inbox[idx];
  if (!canOpen(gift)) return { ok:false, msg:'Gift locked until ' + new Date(gift.openDate).toLocaleString() };
  gift.opened = true;
  u.collection.push(gift);
  u.inbox.splice(idx,1);
  save();
  updateUI();
  return { ok:true };
}

// Dev helper to open everything immediately for the current user
function devOpenAllInbox() {
  if (!currentUser) return;
  const u = users[currentUser];
  const now = new Date();
  u.inbox.forEach(g => g.openDate = new Date(now.getTime() - 1000).toISOString());
  save();
  updateUI();
}

/* UI glue */

const el = sel => document.querySelector(sel);
const els = sel => Array.from(document.querySelectorAll(sel));


function updateDate() {
  const now = getNow();
  el('#dateNow').textContent = now.toLocaleString();
}

function updateUI() {
  updateDate();
  load(); // refresh local copies
  // Auth area
  if (currentUser && users[currentUser]) {
    el('#notLogged').classList.add('hidden');
    el('#userArea').classList.remove('hidden');
    el('#curUser').textContent = users[currentUser].username;
    el('#coinCount').textContent = users[currentUser].coins;
  } else {
    el('#notLogged').classList.remove('hidden');
    el('#userArea').classList.add('hidden');
  }

  // Catalog
  const cat = el('#catalog');
  cat.innerHTML = '';
  catalog.forEach(item => {
    const card = document.createElement('div');
    card.className = 'catalog-item';
    card.innerHTML = `
      <div class="emoji">${item.emoji}</div>
      <strong>${item.name}</strong>
      <div class="info">Cost: ${item.cost} 🎁</div>
    `;
    const btn = document.createElement('button');
    btn.textContent = 'Send';
    btn.className = 'secondary';
    btn.addEventListener('click', () => openSendModal(item));
    card.appendChild(btn);
    cat.appendChild(card);
  });

  // Inbox
  const inboxEl = el('#inboxList');
  inboxEl.innerHTML = '';
  if (currentUser && users[currentUser]) {
    const inbox = users[currentUser].inbox.slice().reverse();
    if (inbox.length === 0) inboxEl.innerHTML = '<div class="info">No gifts in your inbox yet.</div>';
    inbox.forEach(g => {
      const card = document.createElement('div');
      card.className = 'gift-card';
      const left = document.createElement('div');
      left.innerHTML = `<div style="font-size:20px">${g.emoji} <strong>${g.name}</strong></div>
                        <div class="info">From: ${g.sender} · Sent: ${new Date(g.sentAt).toLocaleString()}</div>
                        <div class="info">Message: ${g.message || '(none)'}</div>
                        <div class="info">Opens: ${new Date(g.openDate).toLocaleString()}</div>`;
      const right = document.createElement('div');
      if (canOpen(g)) {
        const openBtn = document.createElement('button');
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => {
          const r = openGift(g.id);
          if (!r.ok) alert(r.msg);
        });
        right.appendChild(openBtn);
      } else {
        const span = document.createElement('div');
        span.className = 'info';
        span.textContent = 'Locked until Christmas 🎄';
        right.appendChild(span);
      }
      card.appendChild(left);
      card.appendChild(right);
      inboxEl.appendChild(card);
    });
  } else {
    inboxEl.innerHTML = '<div class="info">Login to see your inbox.</div>';
  }

  // Collection
  const collEl = el('#collectionList');
  collEl.innerHTML = '';
  if (currentUser && users[currentUser]) {
    const col = users[currentUser].collection.slice().reverse();
    if (col.length === 0) collEl.innerHTML = '<div class="info">Your collection is empty.</div>';
    col.forEach(g => {
      const card = document.createElement('div');
      card.className = 'gift-card';
      card.innerHTML = `<div style="font-size:20px">${g.emoji} <strong>${g.name}</strong></div>
                        <div class="info">From: ${g.sender} · Opened</div>
                        <div class="info">Message: ${g.message || '(none)'}</div>`;
      collEl.appendChild(card);
    });
  } else {
    collEl.innerHTML = '<div class="info">Login to see your collection.</div>';
  }
}

/* Modal helpers */
/* Modal helpers */
function showModal(html) {
  el('#modalBody').innerHTML = html;
  // Remove both the 'hidden' attribute and the 'hidden' class to make sure the modal becomes visible
  const modal = el('#modal');
  modal.classList.remove('hidden');
  modal.removeAttribute('hidden');
}
function closeModal() {
  const modal = el('#modal');
  modal.classList.add('hidden');
  // add the HTML5 hidden attribute as a fallback
  modal.setAttribute('hidden', 'true');
  el('#modalBody').innerHTML = '';
}

/* Send modal */
function openSendModal(item) {
  if (!currentUser) { alert('Please login to send gifts.'); return; }
  showModal(`
    <h3>Send ${item.emoji} ${item.name}</h3>
    <div class="info">Cost: ${item.cost} 🎁</div>
    <label>Recipient username</label>
    <input id="sendRecipient" placeholder="friendname" />
    <label>Short message (optional)</label>
    <input id="sendMsg" placeholder="Merry Christmas!" />
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button id="confirmSend">Send</button>
      <button id="cancelSend" class="secondary">Cancel</button>
    </div>
  `);
  el('#confirmSend').addEventListener('click', () => {
    const to = el('#sendRecipient').value.trim();
    const msg = el('#sendMsg').value.trim();
    if (!to) { alert('Please enter recipient username'); return; }
    const res = sendGift({ giftId: item.id, toUsername: to, message: msg });
    if (!res.ok) alert(res.msg);
    else {
      alert(`Sent ${item.name} to ${to}!`);
      closeModal();
    }
  });
  el('#cancelSend').addEventListener('click', closeModal);
}

/* Minigame: Snowflake Clicker */
function openClickerModal() {
  if (!currentUser) { alert('Login to earn coins'); return; }
  showModal(`
    <h3>Snowflake Clicker</h3>
    <p>Click the snowflake to earn 1 coin each. Try to get 10 clicks for a bonus.</p>
    <div style="font-size:48px;margin:10px" id="flake">❄️</div>
    <div>Clicks: <span id="clickCount">0</span></div>
    <div style="margin-top:10px;">
      <button id="doneClicker">Done</button>
    </div>
  `);
  let clicks = 0;
  const flake = el('#flake');
  flake.style.cursor = 'pointer';
  function clickFn() {
    clicks++;
    el('#clickCount').textContent = clicks;
    addCoinsToCurrent(1);
    // small animation
    flake.style.transform = 'scale(1.15)';
    setTimeout(()=>flake.style.transform='scale(1)', 120);
  }
  flake.addEventListener('click', clickFn);
  el('#doneClicker').addEventListener('click', () => {
    if (clicks >= 10) {
      alert('Nice! Bonus 5 coins for 10+ clicks');
      addCoinsToCurrent(5);
    }
    closeModal();
    flake.removeEventListener('click', clickFn);
  });
}

/* Minigame: Find Santa */
function openFindSantaModal() {
  if (!currentUser) { alert('Login to earn coins'); return; }
  showModal(`
    <h3>Find Santa</h3>
    <p>Pick one of three cards. Find Santa to earn 10 coins!</p>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:12px;">
      <button class="cardBtn">❓</button>
      <button class="cardBtn">❓</button>
      <button class="cardBtn">❓</button>
    </div>
    <div style="margin-top:10px;"><button id="closeFindSanta" class="secondary">Close</button></div>
  `);
  const buttons = Array.from(document.querySelectorAll('.cardBtn'));
  const santaIndex = Math.floor(Math.random()*3);
  let chosen = false;
  buttons.forEach((b,i)=>{
    b.style.fontSize='24px';
    b.addEventListener('click', ()=>{
      if (chosen) return;
      chosen = true;
      if (i === santaIndex) {
        b.textContent = '🎅';
        alert('You found Santa! +10 coins');
        addCoinsToCurrent(10);
      } else {
        b.textContent = '⛄';
        buttons[santaIndex].textContent = '🎅';
        alert('Not this one. Better luck next time!');
      }
    });
  });
  el('#closeFindSanta').addEventListener('click', () => closeModal());
}

/* Wiring UI */
function wire() {
  // auth
  el('#createBtn').addEventListener('click', () => {
    const v = el('#usernameInput').value.trim();
    if (!v) { alert('Enter a username'); return; }
    const r = createUser(v);
    if (!r.ok) alert(r.msg || 'Error creating user');
  });
  el('#loginBtn').addEventListener('click', () => {
    const v = el('#usernameInput').value.trim();
    if (!v) { alert('Enter username'); return; }
    const r = loginUser(v);
    if (!r.ok) alert(r.msg || 'Login failed');
  });
  el('#logoutBtn').addEventListener('click', logout);
  el('#devOpenNow').addEventListener('click', () => {
    if (!currentUser) { alert('Login first'); return; }
    if (!confirm('Force-open all inbox gifts for your account (dev)?')) return;
    devOpenAllInbox();
  });

  // modals
  el('#modalClose').addEventListener('click', closeModal);
  el('#modal').addEventListener('click', (e) => {
    if (e.target === el('#modal')) closeModal();
  });

  // games
  el('#playClicker').addEventListener('click', openClickerModal);
  el('#playFindSanta').addEventListener('click', openFindSantaModal);

  // update clock every second
  setInterval(()=> {
    updateDate();
    // periodic UI refresh so opening becomes available when date passes
    updateUI();
  }, 1000);
}

/* Init */
load();
wire();
updateUI();
