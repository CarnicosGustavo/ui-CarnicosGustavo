/* Capa de autenticación de cliente (Supabase Auth) — archivo nuevo, no toca el diseño.
   Expone window.CG.login/logout/session y persiste el token en localStorage.
   El gate visual (qué pantalla pide credenciales) lo decide cg-app; ver
   docs/INTEGRACION_AUTH.md para el cableado mínimo del LockScreen. */
(function () {
  var CG = (window.CG = window.CG || {});
  var KEY = "cg_auth";

  CG.session = (function () {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  })();
  CG.authReady = false;

  function save(s) {
    CG.session = s;
    try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) {}
    window.dispatchEvent(new Event("cg:auth"));
  }

  // Inicia sesión. Devuelve {ok} o {error}. Al ok, guarda token+usuario.
  CG.login = function (email, password) {
    return fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "auth.login", email: email, password: password }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) { save({ token: d.token, refresh: d.refresh, expiresAt: d.expiresAt, user: d.user }); return { ok: true, user: d.user }; }
        return { error: (d && d.error) || "credenciales inválidas" };
      })
      .catch(function () { return { error: "sin conexión" }; });
  };

  CG.logout = function () { save(null); };

  // Revalida el token guardado contra el servidor (opcional, al arrancar).
  CG.verifySession = function () {
    if (!CG.session || !CG.session.token) { CG.authReady = true; return Promise.resolve(false); }
    return fetch("/api/auth", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "auth.verify", token: CG.session.token }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { CG.authReady = true; if (!d || !d.ok) save(null); return !!(d && d.ok); })
      .catch(function () { CG.authReady = true; return true; /* sin red: no expulsar */ });
  };

  // user_uid efectivo de la sesión (para futuras escrituras por-usuario).
  CG.uid = function () { return (CG.session && CG.session.user && CG.session.user.id) || null; };
})();
