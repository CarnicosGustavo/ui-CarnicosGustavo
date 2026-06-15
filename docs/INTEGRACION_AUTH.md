# Integración Auth (Supabase) — para Claude Code

**Hecho (rama `feat/auth-supabase`):**
- `api/auth.js` — ops `auth.login` / `auth.verify` / `auth.logout` (Supabase Auth, ANON key).
- `cg-auth.jsx` — `window.CG.login(email,pw)`, `CG.logout()`, `CG.verifySession()`, `CG.session`, `CG.uid()`. Token en `localStorage` (`cg_auth`). Cableado en build + index.html.

**Setup (una vez):**
1. Env en Vercel: `SUPABASE_ANON_KEY` (además de los ya existentes).
2. Crear usuarios en Supabase → Authentication → Users (email+password).

**Cableado del gate (cg-app.jsx) — pendiente, toca el diseño:**
- El `LockScreen` actual usa PIN demo `0000`. Reemplazar su validación por `CG.login(email,password)`:
  - en `onUnlock`, llamar `CG.login(...)`; si `{ok}`, `setLocked(false)`.
  - mostrar error si `{error}`.
- Al arrancar la App, llamar `CG.verifySession()`; si no hay sesión válida, mantener `locked=true`.
- "Cerrar sesión" (perfil) → `CG.logout()` y `setLocked(true)`.
- Opcional: pasar `CG.uid()` como `user_uid` en escrituras (hoy `CG_USER_UID` fijo en el server).

> Nota: el `LockScreen` es diseño; decide si se mantiene como PIN (mapeando a un
> usuario fijo) o se añade un campo email+password. Probar en vivo con un usuario real.
