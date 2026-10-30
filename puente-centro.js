/**
 * Puente para GitHub Pages (Centro de mando).
 * Imita google.script.run usando fetch (POST) hacia el web app de Apps Script,
 * asi index.html funciona sin cambiar nada de su logica ni de su diseño.
 * El PIN viaja en el cuerpo del POST, nunca en la direccion.
 *
 * Tambien carga editor-cuadre.js (la pantalla para llenar el cuadre del dia) cuando la
 * pagina termina de abrir. Por eso index.html no necesita ningun cambio.
 */
(function () {
  'use strict';

  var API_URL = 'https://script.google.com/macros/s/AKfycbxkLZ2ofclY2BGIMSRPJ8rlykd2qkAfF_Ig9jU-cl_j33NzVs8jRaQ21__yzhBXOcDKFQ/exec';

  // Sube este numero cuando cambies editor-cuadre.js, para que los telefonos bajen la version nueva.
  var VERSION_EDITOR = '2';

  // Si la pagina corre dentro de Apps Script, no hace falta el puente.
  if (window.google && window.google.script && window.google.script.run) return;

  var FUNCIONES = ['getUsuarios', 'iniciarSesion', 'cerrarSesion', 'getMeses', 'getDatosMes',
    'getCuadreEdicion', 'guardarCuadre'];

  function runner(ok, fail) {
    var r = {
      withSuccessHandler: function (f) { return runner(f, fail); },
      withFailureHandler: function (f) { return runner(ok, f); }
    };
    FUNCIONES.forEach(function (fn) {
      r[fn] = function () {
        var args = Array.prototype.slice.call(arguments);
        fetch(API_URL, {
          method: 'POST',
          redirect: 'follow',
          credentials: 'omit',
          cache: 'no-store',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ fn: fn, args: args })
        })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          }, function () {
            throw new Error('No pude conectar con el servidor. Revisa tu conexion.');
          })
          .then(function (p) {
            if (!p || p.ok !== true) throw new Error((p && p.error) || 'Respuesta invalida del servidor.');
            return p.data;
          })
          .then(
            function (d) { if (ok) ok(d); },
            function (err) { if (fail) fail(err); }
          );
      };
    });
    return r;
  }

  window.google = { script: { run: runner() } };

  // Carga la pantalla de llenado del cuadre, que vive junto a este archivo.
  var propio = document.currentScript && document.currentScript.src;
  var base = propio ? propio.replace(/[^\/]*$/, '') : '';
  function cargarEditor() {
    var s = document.createElement('script');
    s.src = base + 'editor-cuadre.js?v=' + VERSION_EDITOR;
    s.async = true;
    document.body.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cargarEditor);
  else cargarEditor();
})();
