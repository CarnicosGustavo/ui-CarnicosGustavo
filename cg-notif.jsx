/* Helper de cliente para el centro de avisos de iAntonella (archivo nuevo).
   CG.notifications() → Promise<[{ id, tipo, titulo, desc, href, time }]>.
   Si la API falla, devuelve [] (la app nunca se rompe). El NotificationCenter
   puede llamarlo en su useEffect inicial; href es un id de módulo (__cgGo). */
(function () {
  var CG = (window.CG = window.CG || {});
  CG.notifications = function () {
    return fetch("/api/notifications", { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && Array.isArray(d.items)) ? d.items : []; })
      .catch(function () { return []; });
  };
})();
