/* Helper de cliente para Validación de saldos (archivo nuevo, no toca el diseño).
   CG.validacion.list()  → Promise<[{ id, customerId, nombre, saldo, limite, dias,
                                       ndoc, validado, docs:[...] }]>  (mayores primero)
   CG.validacion.validate(customerId, usuario) → Promise<{ok}|{error}>  */
(function () {
  var CG = (window.CG = window.CG || {});
  CG.validacion = {
    list: function () {
      return fetch("/api/validacion", { headers: { accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return (d && Array.isArray(d.clientes)) ? d.clientes : []; })
        .catch(function () { return []; });
    },
    validate: function (customerId, usuario) {
      return fetch("/api/validacion", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "validate", customerId: customerId, usuario: usuario || null }),
      })
        .then(function (r) { return r.json(); })
        .catch(function () { return { error: "sin conexión" }; });
    },
  };
})();
