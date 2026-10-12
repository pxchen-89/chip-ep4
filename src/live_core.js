/* ================= 即時房間核心（學生頁與老師頁共用） =================
   正式：Firebase（匿名登入＋Firestore）。FIREBASE_CONFIG 由 build.py 填入。
   測試：網址加 ?mock=1，只在同一個瀏覽器的分頁之間同步（localStorage＋BroadcastChannel）。 */
const FIREBASE_CONFIG = {{FIREBASE_CONFIG}};
const FB_VER = '11.10.0';
const LIVE_MOCK = /[?&]mock=1(&|$)/.test(location.search);
const LIVE_ENABLED = LIVE_MOCK || !!FIREBASE_CONFIG;
const ROOM_TTL = 12 * 3600 * 1000;   // 房間 12 小時後可以被新的一場重複使用

function liveBackend(){
  if (!liveBackend.p) liveBackend.p = LIVE_MOCK ? mockBackend() : firebaseBackend();
  return liveBackend.p;
}

async function firebaseBackend(){
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const [App, Au, F] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
  const app = App.initializeApp(FIREBASE_CONFIG);
  const auth = Au.getAuth(app);
  // 強制長輪詢：避免學校網路的代理伺服器或防毒軟體把即時推送暫存起來，造成延遲
  const db = F.initializeFirestore(app, { experimentalForceLongPolling: true, experimentalLongPollingOptions: { timeoutSeconds: 10 } });
  await new Promise(res => { const off = Au.onAuthStateChanged(auth, () => { off(); res(); }); });
  const roomRef = pin => F.doc(db, 'rooms', pin);
  const playerRef = (pin, uid) => F.doc(db, 'rooms', pin, 'players', uid);
  return {
    kind: 'firebase',
    async uid(){ if (!auth.currentUser) await Au.signInAnonymously(auth); return auth.currentUser.uid; },
    async newIdentity(){ await Au.signOut(auth); await Au.signInAnonymously(auth); return auth.currentUser.uid; },
    async roomGet(pin){ const s = await F.getDoc(roomRef(pin)); return s.exists() ? s.data() : null; },
    async roomCreate(pin, data){
      try {
        await F.runTransaction(db, async tx => {
          const s = await tx.get(roomRef(pin));
          if (s.exists() && s.data().createdAt > Date.now() - ROOM_TTL) throw new Error('taken');
          tx.set(roomRef(pin), data);
        });
        return true;
      } catch(e){ return false; }
    },
    roomUpdate(pin, patch){ return F.updateDoc(roomRef(pin), patch); },
    roomWatch(pin, cb){ return F.onSnapshot(roomRef(pin), s => cb(s.exists() ? s.data() : null), e => cb(undefined, e)); },
    playerSet(pin, uid, data){ return F.setDoc(playerRef(pin, uid), data, { merge:true }); },
    playerWatch(pin, uid, cb){ return F.onSnapshot(playerRef(pin, uid), s => cb(s.exists() ? s.data() : null), e => cb(undefined, e)); },
    playersWatch(pin, cb){ return F.onSnapshot(F.collection(db, 'rooms', pin, 'players'), qs => cb(qs.docs.map(d => Object.assign({ id:d.id }, d.data()))), e => cb(undefined, e)); },
    playerDelete(pin, uid){ return F.deleteDoc(playerRef(pin, uid)); },
    roomDelete(pin){ return F.deleteDoc(roomRef(pin)); },
    // 每位學生每一題第一次的作答（只有開房老師讀得到）
    answerSet(pin, uid, data){ return F.setDoc(F.doc(db, 'rooms', pin, 'answers', uid), data); },
    answersWatch(pin, cb){ return F.onSnapshot(F.collection(db, 'rooms', pin, 'answers'), qs => cb(qs.docs.map(d => Object.assign({ id:d.id }, d.data()))), e => cb(undefined, e)); },
    answerDelete(pin, uid){ return F.deleteDoc(F.doc(db, 'rooms', pin, 'answers', uid)); },
  };
}

async function mockBackend(){
  const KEY = 'wm-mockdb', chan = ('BroadcastChannel' in window) ? new BroadcastChannel(KEY) : null;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { rooms:{} }; } catch(e){ return { rooms:{} }; } };
  const subs = new Set();
  const fire = () => subs.forEach(f => f());
  const write = fn => { const d = load(); fn(d); localStorage.setItem(KEY, JSON.stringify(d)); if (chan) chan.postMessage(1); setTimeout(fire, 0); };
  if (chan) chan.onmessage = fire;
  window.addEventListener('storage', e => { if (e.key === KEY) fire(); });
  const watch = fn => { subs.add(fn); setTimeout(fn, 0); return () => subs.delete(fn); };
  const newId = () => { const id = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('wm-mock-uid', id); return id; };
  return {
    kind: 'mock',
    async uid(){ return sessionStorage.getItem('wm-mock-uid') || newId(); },
    async newIdentity(){ return newId(); },
    async roomGet(pin){ const r = load().rooms[pin]; return r ? r.data : null; },
    async roomCreate(pin, data){
      const r = load().rooms[pin];
      if (r && r.data.createdAt > Date.now() - ROOM_TTL) return false;
      write(d => { d.rooms[pin] = { data, players:{} }; });
      return true;
    },
    async roomUpdate(pin, patch){ write(d => { Object.assign(d.rooms[pin].data, patch); }); },
    roomWatch(pin, cb){ let last; return watch(() => { const r = load().rooms[pin]; const j = JSON.stringify(r ? r.data : null); if (j !== last){ last = j; cb(r ? r.data : null); } }); },
    async playerSet(pin, uid, data){ write(d => { const r = d.rooms[pin]; r.players[uid] = Object.assign(r.players[uid] || {}, data); }); },
    playerWatch(pin, uid, cb){ let last; return watch(() => { const r = load().rooms[pin]; const p = r ? r.players[uid] || null : null; const j = JSON.stringify(p); if (j !== last){ last = j; cb(p); } }); },
    playersWatch(pin, cb){ let last; return watch(() => { const r = load().rooms[pin]; const list = r ? Object.entries(r.players).map(([id, v]) => Object.assign({ id }, v)) : []; const j = JSON.stringify(list); if (j !== last){ last = j; cb(list); } }); },
    async playerDelete(pin, uid){ write(d => { delete d.rooms[pin].players[uid]; }); },
    async roomDelete(pin){ write(d => { delete d.rooms[pin]; }); },
    async answerSet(pin, uid, data){ write(d => { const r = d.rooms[pin]; r.answers = r.answers || {}; r.answers[uid] = data; }); },
    answersWatch(pin, cb){ let last; return watch(() => { const r = load().rooms[pin]; const list = r && r.answers ? Object.entries(r.answers).map(([id, v]) => Object.assign({ id }, v)) : []; const j = JSON.stringify(list); if (j !== last){ last = j; cb(list); } }); },
    async answerDelete(pin, uid){ write(d => { const r = d.rooms[pin]; if (r && r.answers) delete r.answers[uid]; }); },
  };
}
