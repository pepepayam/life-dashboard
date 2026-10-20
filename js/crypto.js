/* رمزنگاری فایل داده: PBKDF2-SHA256 + AES-GCM-256 */
'use strict';
LD.crypto = (() => {
  const ITER = 250000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function deriveKey(password, salt, iter = ITER) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /* session: {key, salt, iter} — رمز عبور در حافظه نگه داشته نمی‌شود، فقط کلید مشتق‌شده */
  async function newSession(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { key: await deriveKey(password, salt), salt, iter: ITER };
  }

  /* فشرده‌سازی gzip پیش از رمزنگاری تا فایل کوچک‌تر و همگام‌سازی روی اینترنت ضعیف پایدارتر باشد */
  const canZip = typeof CompressionStream !== 'undefined';
  const pipe = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());

  async function encrypt(session, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    let pt = enc.encode(JSON.stringify(obj));
    if (canZip) pt = await pipe(pt, new CompressionStream('gzip'));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, session.key, pt);
    return JSON.stringify({
      format: 'LDB1', kdf: 'PBKDF2-SHA256', iter: session.iter, salt: b64(session.salt), iv: b64(iv), z: canZip ? 1 : 0,
      rev: obj.meta.rev, savedAt: obj.meta.savedAt, data: b64(ct),
    });
  }

  function header(text) {
    const f = JSON.parse(text);
    if (f.format !== 'LDB1') throw new Error('فرمت فایل ناشناخته است');
    return f;
  }

  /* اگر session با salt فایل سازگار باشد از آن استفاده می‌کند؛ وگرنه با password کلید جدید می‌سازد */
  async function decrypt(text, { session, password } = {}) {
    const f = header(text);
    const salt = unb64(f.salt);
    let s = session;
    if (!s || b64(s.salt) !== f.salt) {
      if (!password) { const e = new Error('NEED_PASSWORD'); e.code = 'NEED_PASSWORD'; throw e; }
      s = { key: await deriveKey(password, salt, f.iter), salt, iter: f.iter };
    }
    let pt;
    try { pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.iv) }, s.key, unb64(f.data))); }
    catch (e) { const err = new Error('رمز عبور اشتباه است یا فایل آسیب دیده'); err.code = 'BAD_PASSWORD'; throw err; }
    if (f.z) {
      if (!canZip) throw new Error('این مرورگر قدیمی است و فایل فشرده را باز نمی‌کند؛ مرورگر را به‌روز کنید');
      pt = await pipe(pt, new DecompressionStream('gzip'));
    }
    return { data: JSON.parse(dec.decode(pt)), session: s };
  }

  return { newSession, encrypt, decrypt, header, b64, unb64 };
})();
