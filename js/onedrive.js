/* همگام‌سازی با OneDrive از طریق Microsoft Graph — OAuth2 کد مجوز + PKCE (بدون کتابخانه) */
'use strict';
LD.onedrive = (() => {
  const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
  const SCOPE = 'Files.ReadWrite offline_access User.Read';
  const FOLDER = 'LifeDashboard';
  const redirectUri = () => location.origin + location.pathname;
  const cfg = () => { try { return JSON.parse(localStorage.getItem('ld.onedrive') || '{}'); } catch (e) { return {}; } };
  const setCfg = (p) => localStorage.setItem('ld.onedrive', JSON.stringify(Object.assign(cfg(), p)));
  let accessToken = null, expiresAt = 0;

  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const randomStr = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

  async function login() {
    const { clientId } = cfg();
    if (!clientId) throw new Error('ابتدا Client ID برنامه Azure را در تنظیمات وارد کنید');
    const verifier = randomStr(), state = randomStr();
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    sessionStorage.setItem('ld.pkce', JSON.stringify({ verifier, state }));
    const q = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri(), scope: SCOPE, state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
    location.href = AUTH + '/authorize?' + q;
  }

  async function tokenRequest(params) {
    const r = await fetch(AUTH + '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(Object.assign({ client_id: cfg().clientId, scope: SCOPE }, params)) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.error || 'خطای ورود');
    accessToken = j.access_token; expiresAt = Date.now() + (j.expires_in - 60) * 1000;
    if (j.refresh_token) await LD.idb.set('od.refresh', j.refresh_token);
    return accessToken;
  }

  /* بعد از بازگشت از صفحه ورود مایکروسافت فراخوانی می‌شود */
  async function handleRedirect() {
    const p = new URLSearchParams(location.search);
    if (!p.get('code')) return false;
    const saved = JSON.parse(sessionStorage.getItem('ld.pkce') || '{}');
    history.replaceState(null, '', redirectUri());
    if (p.get('state') !== saved.state) throw new Error('state نامعتبر');
    await tokenRequest({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(), code_verifier: saved.verifier });
    setCfg({ connected: true });
    return true;
  }

  async function token() {
    if (accessToken && Date.now() < expiresAt) return accessToken;
    const rt = await LD.idb.get('od.refresh');
    if (!rt) throw new Error('اتصال OneDrive برقرار نیست');
    return tokenRequest({ grant_type: 'refresh_token', refresh_token: rt });
  }

  const itemUrl = (path) => 'https://graph.microsoft.com/v1.0/me/drive/root:/' + FOLDER + '/' + path.split('/').map(encodeURIComponent).join('/') + ':/content';

  async function read(path) {
    const r = await fetch(itemUrl(path), { headers: { Authorization: 'Bearer ' + await token() } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('خواندن از OneDrive ناموفق (' + r.status + ')');
    return r.text();
  }
  async function write(path, text) {
    const r = await fetch(itemUrl(path), { method: 'PUT', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/octet-stream' }, body: text });
    if (!r.ok) throw new Error('نوشتن در OneDrive ناموفق (' + r.status + ')');
  }
  async function logout() { await LD.idb.del('od.refresh'); accessToken = null; setCfg({ connected: false }); }

  return { login, handleRedirect, read, write, logout, cfg, setCfg, redirectUri };
})();
