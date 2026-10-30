/**
 * editor-cuadre.js · Centro de mando · Historias y un Café
 *
 * Agrega el botón "Llenar cuadre" y la pantalla para llenar la hoja de cuadre del día.
 * No hay que editar index.html: lo carga puente-centro.js cuando la página termina de abrir.
 *
 * Usa lo que ya existe en index.html: S (sesión), run() y cargarMes().
 * El formulario lo dibuja a partir de lo que manda Escritura.gs, así que agregar campos
 * en la fase 2 no requiere tocar este archivo.
 */
(function () {
  'use strict';

  var DIAS_ATRAS = 30;   // hoy y 30 días atrás = ESCRITURA.DIAS_EDITABLES (31) en Escritura.gs. El servidor es quien manda.
  var DIAS_EN_LISTA = 14; // días que se muestran en el selector; más atrás se llega con "Otra fecha…" o desde el día elegido en el tablero
  var GRUPOS = { billetes: 'Cantidad de billetes y monedas' };

  var E = { fecha: null, sel: null, estado: null, campos: {}, orig: {}, cur: {}, err: {}, avisos: [], req: 0,
            guardando: false, huboCambios: false, ultimoGuardado: null };
  var root = null;

  /* ───────── Utilidades ───────── */
  function q(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  function fm(n) {
    n = Number(n) || 0;
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function num(x) { return (x === '' || x == null) ? 0 : Number(x); }
  function clon(o) { return JSON.parse(JSON.stringify(o)); }
  function hoyPR() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function restarDias(iso, n) {
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] - n)).toISOString().slice(0, 10);
  }
  function larga(iso) { return typeof fechaLarga === 'function' ? fechaLarga(iso) : iso; }
  function msgDe(e) { return (e && e.message) ? e.message : String(e); }

  function parseNumero(t) {
    t = String(t).replace(/[\s$]/g, '');
    if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) t = t.replace(/,/g, '');
    else if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, ''); // 2,441 = dos mil cuatrocientos cuarenta y uno
    else t = t.replace(',', '.');
    if (!/^(\d+(\.\d+)?|\.\d+)$/.test(t)) return null;
    return parseFloat(t);
  }

  function igual(d, a, b) {
    if (d.tipo === 'dinero' || d.tipo === 'entero' || (d.tipo === 'lista' && d.numerica)) {
      if (a === '' || b === '' || a == null || b == null) return (a === '' || a == null) && (b === '' || b == null);
      return Math.abs(Number(a) - Number(b)) < 0.005;
    }
    return a === b;
  }
  function sucios() {
    return Object.keys(E.campos).filter(function (id) { return !igual(E.campos[id], E.cur[id], E.orig[id]); });
  }

  /* ───────── Estilos ───────── */
  var CSS = [
    '.cx{position:fixed;inset:0;z-index:150;display:flex;flex-direction:column;background:var(--bg);color:var(--texto);font:400 15px/1.45 var(--sans)}',
    '.cx-top{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--borde);background:var(--barra);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
    '.cx-top h2{margin:0 auto 0 0;font-size:17px;font-weight:600}',
    '.cx-top select{max-width:52vw}',
    '.cx-cerrar{width:40px;height:40px;padding:0;justify-content:center}',
    '.cx-otra{flex:1 1 100%;width:auto}',
    '.cx-body{flex:1 1 auto;overflow-y:auto;padding:16px 16px 28px;-webkit-overflow-scrolling:touch}',
    '.cx-col{max-width:620px;margin:0 auto;display:grid;gap:14px}',
    '.cx-card{background:var(--vidrio);border:1px solid var(--borde);border-radius:18px;padding:16px}',
    '.cx-card h3{margin:0 0 12px;font-size:15px;font-weight:600}',
    '.cx-f{display:grid;gap:6px;margin-bottom:14px}',
    '.cx-f label,.cx-gt{font-size:13.5px;color:var(--texto2)}',
    '.cx-in{width:100%;background-color:var(--vidrio2);border:1px solid var(--borde);border-radius:12px;padding:12px 14px;font-size:16px;color:var(--texto);min-height:46px}',
    'textarea.cx-in{min-height:96px;resize:vertical}',
    '.cx-pre{position:relative}.cx-pre>span{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--texto2);pointer-events:none}',
    '.cx-pre .cx-in{padding-left:28px}',
    '.cx-dirty .cx-in{border-color:var(--mar);box-shadow:0 0 0 1px var(--mar)}',
    '.cx-err .cx-in{border-color:var(--hibisco);box-shadow:0 0 0 1px var(--hibisco)}',
    '.cx-chk{display:flex;align-items:center;gap:14px;padding:6px 0;font-size:16px;cursor:pointer}',
    '.cx-chk input{width:28px;height:28px;accent-color:var(--mar);flex:0 0 auto}',
    '.cx-grupo{margin:4px 0 16px}',
    '.cx-gt{margin:0 0 8px}',
    '.cx-b{display:grid;grid-template-columns:56px 1fr 96px;align-items:center;gap:10px;margin-bottom:8px}',
    '.cx-b>label{font-weight:600;color:var(--texto);font-size:15px}',
    '.cx-bt{text-align:right;color:var(--texto2);font-variant-numeric:tabular-nums}',
    '.cx-res{margin-top:6px;padding:12px 14px;border-radius:14px;background:var(--vidrio2);border:1px solid var(--borde);display:grid;gap:4px;font-size:14px}',
    '.cx-res .l{display:flex;justify-content:space-between;gap:12px}',
    '.cx-res .l b{font-variant-numeric:tabular-nums}',
    '.cx-res .t{font-size:12.5px;color:var(--texto2)}',
    '.cx-res .ok{color:var(--ok);font-weight:600}.cx-res .mal{color:var(--mango);font-weight:600}',
    '.cx-aviso{padding:12px 14px;border-radius:14px;border:1px solid rgba(217,165,102,.45);background:rgba(217,165,102,.12);font-size:14px}',
    '.cx-aviso p{margin:0 0 4px}.cx-aviso p:last-child{margin:0}',
    '.cx-prueba{padding:10px 14px;border-radius:14px;background:var(--hibisco);color:#fff;font-weight:600;font-size:14px}',
    '.cx-arch{font-size:13px;color:var(--texto2);margin:0}',
    '.cx-centro{text-align:center;padding:48px 16px}',
    '.cx-bar{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--borde);background:var(--barra);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
    '.cx-st{flex:1;font-size:14px;color:var(--texto2)}.cx-st.mal{color:var(--hibisco)}.cx-st.bien{color:var(--ok);font-weight:600}',
    '.cx-bar .btn{min-height:46px;padding:0 22px;font-size:15px}.cx-bar .btn:disabled{opacity:.4;cursor:default}',
    '.cx-fab{position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:60;display:inline-flex;align-items:center;gap:8px;min-height:52px;padding:0 20px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--mar),var(--mar2));color:#04201E;font:600 15px var(--sans);box-shadow:0 14px 30px -10px rgba(0,0,0,.6);cursor:pointer}',
    '.cx-fab svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
    'body.sin-sesion .cx-fab{display:none}'
  ].join('\n');

  /* ───────── Pantalla ───────── */
  function estilos() {
    if (document.getElementById('cx-css')) return;
    var st = document.createElement('style'); st.id = 'cx-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function crear() {
    if (root) return;
    estilos();
    root = document.createElement('div');
    root.className = 'cx'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'cxTitulo');
    root.innerHTML =
      '<div class="cx-top"><h2 id="cxTitulo">Llenar cuadre</h2><select id="cxFecha" aria-label="Día del cuadre"></select>' +
      '<button class="ib cx-cerrar" id="cxCerrar" type="button" aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<input class="cx-in cx-otra" id="cxOtra" type="date" aria-label="Elegir otra fecha" hidden></div>' +
      '<div class="cx-body" id="cxCuerpo"></div>' +
      '<div class="cx-bar"><span class="cx-st" id="cxEstado" role="status" aria-live="polite"></span><button class="btn" id="cxGuardar" type="button">Guardar cambios</button></div>';
    document.body.appendChild(root);

    root.addEventListener('input', onEntrada);
    root.addEventListener('change', onEntrada);
    root.addEventListener('focusin', function (ev) {
      var el = ev.target;
      if (el && el.classList && el.classList.contains('cx-in') && el.tagName === 'INPUT') setTimeout(function () { try { el.select(); } catch (e) {} }, 0);
    });
    root.addEventListener('keydown', function (ev) {
      ev.stopPropagation(); // que no se activen los atajos del tablero (1, 2, T, flechas)
      if (ev.key === 'Escape') cerrar();
    });
    q('#cxCerrar').addEventListener('click', cerrar);
    q('#cxGuardar').addEventListener('click', guardar);
    q('#cxFecha').addEventListener('change', function (ev) {
      var v = ev.target.value, o = q('#cxOtra');
      if (!confirmarSalida('Cambiar de día')) { ev.target.value = E.sel; return; }
      E.sel = v;
      if (v === 'otra') {
        o.hidden = false;
        if (o.value) { E.fecha = o.value; cargar(); } else { sinFecha(); try { o.focus(); } catch (e) {} }
        return;
      }
      o.hidden = true; E.fecha = v; cargar();
    });
    q('#cxOtra').addEventListener('change', function (ev) {
      var v = ev.target.value;
      if (!v) return;
      if (!confirmarSalida('Cambiar de día')) { ev.target.value = E.fecha || ''; return; }
      E.fecha = v; cargar();
    });
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-cx="reintentar"]');
      if (b) cargar();
    });
  }

  /* Al abrir, usa el día que estás viendo en el tablero (si se puede editar); si no, hoy. */
  function fechaInicial() {
    var hoy = hoyPR(), d = (typeof S !== 'undefined' && S.dia) ? S.dia : hoy;
    return (d <= hoy && d >= restarDias(hoy, DIAS_ATRAS)) ? d : hoy;
  }

  function poblarFechas() {
    var hoy = hoyPR(), html = '', esta = false;
    for (var i = 0; i < DIAS_EN_LISTA; i++) {
      var f = restarDias(hoy, i), pre = i === 0 ? 'Hoy, ' : i === 1 ? 'Ayer, ' : '';
      if (f === E.sel) esta = true;
      html += '<option value="' + f + '">' + esc(pre + larga(f)) + '</option>';
    }
    if (!esta && E.sel !== 'otra') html += '<option value="' + E.sel + '">' + esc(larga(E.sel)) + '</option>';
    html += '<option value="otra">Otra fecha…</option>';
    q('#cxFecha').innerHTML = html;
    q('#cxFecha').value = E.sel;
  }

  function abrir() {
    crear();
    if (typeof S === 'undefined' || !S.token) return;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    E.fecha = fechaInicial(); E.sel = E.fecha;
    poblarFechas();
    var o = q('#cxOtra'); o.hidden = true; o.value = '';
    cargar();
    setTimeout(function () { try { q('#cxCerrar').focus(); } catch (e) {} }, 0);
  }

  function confirmarSalida(que) {
    return !sucios().length || window.confirm('Tienes cambios sin guardar. ¿' + que + ' sin guardarlos?');
  }
  function sinFecha() {
    E.req++; E.estado = null; E.campos = {}; E.orig = {}; E.cur = {}; E.err = {}; E.avisos = [];
    q('#cxCuerpo').innerHTML = '<div class="cx-centro"><p>Elige la fecha de la hoja que quieres llenar.</p></div>';
    barra('', '', true);
  }

  function cerrar() {
    if (!root || root.hidden || E.guardando) return;
    if (sucios().length && !window.confirm('Tienes cambios sin guardar. ¿Cerrar sin guardarlos?')) return;
    forzarCierre();
    if (E.huboCambios) {
      E.huboCambios = false;
      if (typeof cargarMes === 'function' && typeof S !== 'undefined' && S.meses) cargarMes(true);
    }
  }
  function forzarCierre() {
    if (root) root.hidden = true;
    document.body.style.overflow = '';
  }

  /* ───────── Carga y guardado ───────── */
  async function cargar() {
    var mia = ++E.req;
    E.estado = null; E.campos = {}; E.orig = {}; E.cur = {}; E.err = {}; E.avisos = []; E.ultimoGuardado = null;
    q('#cxCuerpo').innerHTML = '<div class="cx-centro"><div class="anillo-carga"></div><p>Abriendo la hoja de ' + esc(larga(E.fecha)) + '…</p></div>';
    barra('', '', true);
    try {
      var est = await run('getCuadreEdicion', S.token, E.fecha);
      if (mia !== E.req) return;
      aplicar(est);
    } catch (e) {
      if (mia !== E.req) return;
      falla(e);
    }
  }

  function falla(e) {
    var m = msgDe(e);
    if (/SESION_INVALIDA/.test(m)) { forzarCierre(); return; } // run() ya mostró la pantalla de PIN
    var pista = (e instanceof TypeError) ? '<p class="cx-arch">Parece que puente-centro.js todavía no conoce las funciones getCuadreEdicion y guardarCuadre.</p>' : '';
    q('#cxCuerpo').innerHTML = '<div class="cx-col"><div class="cx-card cx-centro"><strong>No pude abrir esta hoja.</strong><p>' + esc(m) + '</p>' + pista +
      '<button class="btn" type="button" data-cx="reintentar">Intentar de nuevo</button></div></div>';
    barra('', '', true);
  }

  function aplicar(est) {
    E.estado = est;
    E.campos = {};
    est.secciones.forEach(function (s) { s.campos.forEach(function (c) { E.campos[c.id] = c; }); });
    E.orig = clon(est.valores);
    E.cur = clon(est.valores);
    E.err = {};
    pintar();
  }

  async function guardar() {
    if (E.guardando) return;
    var ids = sucios();
    if (!ids.length || Object.keys(E.err).length) return;
    var cambios = {};
    ids.forEach(function (id) { cambios[id] = { nuevo: E.cur[id], antes: E.orig[id] }; });
    E.guardando = true; E.avisos = [];
    barra('Guardando…', '');
    try {
      var r = await run('guardarCuadre', S.token, E.fecha, cambios);
      if (r.guardados && r.guardados.length) E.huboCambios = true;
      var conf = (r.conflictos || []).map(function (c) {
        var d = E.campos[c.id], v = c.actual;
        var txt = d && d.tipo === 'dinero' && v !== '' ? fm(v) : (v === '' ? 'vacío' : (v === true ? 'sí' : v === false ? 'no' : v));
        return 'No se guardó "' + c.etq + '": alguien lo cambió mientras lo editabas y ahora dice ' + txt + '. Revisa y vuelve a escribirlo si hace falta.';
      });
      aplicar(r.estado);
      E.avisos = conf;
      E.ultimoGuardado = new Date();
      pintar();
      barra(conf.length ? 'Se guardó, con avisos' : 'Guardado a las ' + hora(E.ultimoGuardado), conf.length ? 'mal' : 'bien');
    } catch (e) {
      var m = msgDe(e);
      if (/SESION_INVALIDA/.test(m)) { E.guardando = false; forzarCierre(); return; }
      barra('No se guardó: ' + m, 'mal');
    } finally {
      E.guardando = false;
      var b = q('#cxGuardar'); if (b) { b.textContent = 'Guardar cambios'; }
      refrescarBoton();
    }
  }
  function hora(d) { return d.toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit' }); }

  /* ───────── Dibujo ───────── */
  function pintar() {
    var est = E.estado, h = '<div class="cx-col">';
    if (est.prueba) h += '<div class="cx-prueba">Día de prueba: lo que guardes cambia la hoja real de ese día. Lo que había antes queda en la bitácora.</div>';
    h += '<p class="cx-arch">Escribiendo en ' + esc(est.archivo.nombre) + '. <a href="' + esc(est.archivo.url) + '" target="_blank" rel="noopener">Abrir la hoja en Drive</a></p>';
    if (E.avisos.length) h += '<div class="cx-aviso" role="alert">' + E.avisos.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div>';
    h += est.secciones.map(seccion).join('');
    h += '</div>';
    q('#cxCuerpo').innerHTML = h;
    resumen();
    sucios().forEach(marcar);
    barra();
  }

  function seccion(sec) {
    var h = '<section class="cx-card" data-s="' + esc(sec.id) + '"><h3>' + esc(sec.titulo) + '</h3>', i = 0, c = sec.campos;
    if (sec.aviso) return h + '<p class="cx-arch">' + esc(sec.aviso) + '</p></section>';
    while (i < c.length) {
      if (c[i].grupo) {
        var g = c[i].grupo, filas = '';
        while (i < c.length && c[i].grupo === g) { filas += billete(c[i]); i++; }
        h += '<div class="cx-grupo"><p class="cx-gt">' + esc(GRUPOS[g] || g) + '</p>' + filas + '</div>';
      } else { h += campo(c[i]); i++; }
    }
    if (sec.id === 'cabecera') h += '<div class="cx-res" id="cxResMeta"></div>';
    if (sec.id === 'efectivo') h += '<div class="cx-res" id="cxResCaja"></div>';
    return h + '</section>';
  }

  function campo(d) {
    var v = E.cur[d.id], id = 'cx-' + d.id, a = 'id="' + id + '" data-id="' + esc(d.id) + '"', ctl = '';
    if (d.tipo === 'dinero') {
      ctl = '<div class="cx-pre"><span>$</span><input class="cx-in" ' + a + ' inputmode="decimal" autocomplete="off" value="' + esc(v === '' ? '' : v) + '"></div>';
    } else if (d.tipo === 'entero') {
      ctl = '<input class="cx-in" ' + a + ' inputmode="numeric" autocomplete="off" value="' + esc(v === '' ? '' : v) + '">';
    } else if (d.tipo === 'lista') {
      ctl = '<select class="cx-in" ' + a + '><option value="">Sin elegir</option>' + (d.opciones || []).map(function (o) {
        return '<option value="' + esc(o) + '"' + (String(o) === String(v) ? ' selected' : '') + '>' + esc(d.numerica ? fm(o).replace('.00', '') : o) + '</option>';
      }).join('') + '</select>';
    } else if (d.tipo === 'check') {
      return '<div class="cx-f" data-f="' + esc(d.id) + '"><label class="cx-chk" for="' + id + '"><input type="checkbox" ' + a + (v ? ' checked' : '') + '><span>' + esc(d.etq) + '</span></label></div>';
    } else if (d.tipo === 'largo') {
      ctl = '<textarea class="cx-in" ' + a + ' rows="3">' + esc(v) + '</textarea>';
    } else {
      ctl = '<input class="cx-in" ' + a + ' type="text" autocomplete="off" value="' + esc(v) + '">';
    }
    return '<div class="cx-f" data-f="' + esc(d.id) + '"><label for="' + id + '">' + esc(d.etq) + '</label>' + ctl + '</div>';
  }

  function billete(d) {
    var v = E.cur[d.id], id = 'cx-' + d.id;
    return '<div class="cx-b" data-f="' + esc(d.id) + '"><label for="' + id + '">' + esc(d.etq) + '</label>' +
      '<input class="cx-in" id="' + id + '" data-id="' + esc(d.id) + '" inputmode="numeric" autocomplete="off" value="' + esc(v === '' ? '' : v) + '" aria-label="Cantidad de ' + esc(d.etq) + '">' +
      '<span class="cx-bt" data-t="' + esc(d.id) + '">' + fm(num(d.den) * num(v)) + '</span></div>';
  }

  /* ───────── Entrada de datos ───────── */
  function leer(d, el) {
    if (d.tipo === 'check') return { ok: true, val: !!el.checked };
    if (d.tipo === 'lista') { var s = el.value; return { ok: true, val: d.numerica ? (s === '' ? '' : Number(s)) : s }; }
    if (d.tipo === 'texto' || d.tipo === 'largo') return { ok: true, val: el.value };
    var t = el.value.trim();
    if (t === '') return { ok: true, val: '' };
    var n = parseNumero(t);
    if (n == null) return { ok: false, msg: 'escribe solo números.' };
    if (n < 0) return { ok: false, msg: 'no puede ser negativo.' };
    if (d.tipo === 'entero' && n % 1 !== 0) return { ok: false, msg: 'escribe un número entero.' };
    return { ok: true, val: r2(n) };
  }

  function onEntrada(ev) {
    var el = ev.target, id = el && el.getAttribute && el.getAttribute('data-id');
    if (!id || !E.campos[id]) return;
    var d = E.campos[id], r = leer(d, el);
    if (r.ok) { E.cur[id] = r.val; delete E.err[id]; } else { E.err[id] = r.msg; }
    marcar(id);
    if (d.grupo === 'billetes') {
      var t = q('[data-t="' + id + '"]', root); if (t) t.textContent = fm(num(d.den) * num(E.cur[id]));
    }
    resumen();
    barra();
  }

  function marcar(id) {
    var box = q('[data-f="' + id + '"]', root); if (!box) return;
    box.classList.toggle('cx-dirty', !igual(E.campos[id], E.cur[id], E.orig[id]));
    box.classList.toggle('cx-err', !!E.err[id]);
  }

  /* ───────── Resumen: vista previa antes de guardar, valores de la hoja después ───────── */
  function calcVivo() {
    var sub = 0;
    Object.keys(E.campos).forEach(function (id) {
      var d = E.campos[id];
      if (d.grupo === 'billetes' && d.den) sub += d.den * num(E.cur[id]);
    });
    sub = r2(sub);
    var total = r2(sub - num(E.cur.petty));
    return { subtotal: sub, totalContado: total, difConteo: r2(total - num(E.cur.cash)),
             difMeta: (E.cur.meta === '' || E.cur.meta == null) ? '' : r2(num(E.cur.ventaNeta) - num(E.cur.meta)) };
  }
  function mostrar(x) { return (x === '' || x == null) ? '—' : fm(x); }

  function resumen() {
    if (!E.estado) return;
    var limpio = sucios().length === 0, c = limpio ? E.estado.calculados : calcVivo();
    var etiqueta = limpio ? 'Lo que dice la hoja' : 'Cálculo antes de guardar';
    var m = q('#cxResMeta', root), k = q('#cxResCaja', root);
    if (m) {
      var dm = c.difMeta, txt = typeof dm !== 'number' ? 'Elige la meta para ver la diferencia.' :
        (dm >= 0 ? 'Superó la meta por ' + fm(dm) : 'Faltan ' + fm(-dm) + ' para la meta');
      m.innerHTML = '<div class="l"><span>' + esc(txt) + '</span></div><div class="t">' + etiqueta + '</div>';
    }
    if (k) {
      var dc = c.difConteo, cuadra = typeof dc === 'number' && Math.abs(dc) < 0.005;
      k.innerHTML =
        '<div class="l"><span>Subtotal contado</span><b>' + mostrar(c.subtotal) + '</b></div>' +
        '<div class="l"><span>Total sin el petty</span><b>' + mostrar(c.totalContado) + '</b></div>' +
        '<div class="l"><span>Diferencia con el cash</span><b class="' + (cuadra ? 'ok' : 'mal') + '">' + mostrar(dc) + '</b></div>' +
        '<div class="' + (cuadra ? 'ok' : 'mal') + '">' + (cuadra ? '✓ El conteo cuadra.' : 'El conteo no cuadra: revisa la diferencia.') + '</div>' +
        '<div class="t">' + etiqueta + '</div>';
    }
  }

  /* ───────── Barra inferior ───────── */
  function refrescarBoton() {
    var b = q('#cxGuardar'); if (!b) return;
    b.disabled = E.guardando || !E.estado || !sucios().length || Object.keys(E.err).length > 0;
  }
  function barra(msg, tipo, sinEstado) {
    var st = q('#cxEstado'); if (!st) return;
    var n = E.estado ? sucios().length : 0, errs = Object.keys(E.err), texto = '', clase = '';
    if (msg) { texto = msg; clase = tipo || ''; }
    else if (sinEstado || !E.estado) { texto = ''; }
    else if (errs.length) { texto = 'Revisa "' + (E.campos[errs[0]].etq) + '": ' + E.err[errs[0]]; clase = 'mal'; }
    else if (n) { texto = n === 1 ? '1 cambio sin guardar' : n + ' cambios sin guardar'; }
    else { texto = E.ultimoGuardado ? 'Guardado a las ' + hora(E.ultimoGuardado) : 'Sin cambios'; clase = E.ultimoGuardado ? 'bien' : ''; }
    st.textContent = texto; st.className = 'cx-st ' + clase;
    var b = q('#cxGuardar'); if (b) b.textContent = E.guardando ? 'Guardando…' : 'Guardar cambios';
    refrescarBoton();
  }

  /* ───────── Botón en la barra superior ───────── */
  function montar() {
    var barraTop = q('.barra-in');
    if (!barraTop || document.getElementById('btnLlenar')) return;
    estilos();
    var icono = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
    // Botón de la barra superior (en el teléfono solo se ve el lápiz)
    var b = document.createElement('button');
    b.className = 'ib'; b.id = 'btnLlenar'; b.type = 'button';
    b.setAttribute('aria-label', 'Llenar el cuadre del día');
    b.innerHTML = icono + '<span class="tx">Llenar cuadre</span>';
    barraTop.insertBefore(b, document.getElementById('btnTema') || null);
    b.addEventListener('click', abrir);
    // Botón flotante con texto, siempre a la vista
    var f = document.createElement('button');
    f.className = 'cx-fab'; f.id = 'btnLlenarFab'; f.type = 'button';
    f.setAttribute('aria-label', 'Llenar el cuadre del día');
    f.innerHTML = icono + '<span>Llenar cuadre</span>';
    document.body.appendChild(f);
    f.addEventListener('click', abrir);
  }
  montar();
})();
