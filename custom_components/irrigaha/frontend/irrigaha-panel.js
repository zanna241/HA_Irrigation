/**
 * IRRIGAZIONE SMART — pannello nativo Home Assistant.
 *
 * Nessun iframe: il custom element vive direttamente nel documento di Home
 * Assistant, esattamente come le card native e come floor3d-card (il
 * riferimento più diffuso per contenuti 3D in HA). Questo elimina alla radice
 * la classe di problemi di composizione/attivazione WebGL che affliggeva la
 * precedente architettura a iframe: qui il contenuto è sempre nello stesso
 * documento attivo che l'utente sta guardando, non un frame nascosto/mostrato
 * dal router dei pannelli.
 *
 * Dati e comandi passano direttamente dall'oggetto `hass` fornito da Home
 * Assistant (nessun bridge postMessage, nessun token, nessuna REST esterna).
 *
 * Basato su ReactiveElement (lo stesso strato base di LitElement, senza il
 * motore di template che qui non serve: l'interfaccia resta gestita in modo
 * imperativo come prima). Il motivo: `firstUpdated()` garantisce per
 * specifica che l'elemento sia già connesso al documento e abbia già
 * completato un primo ciclo di aggiornamento — esattamente la garanzia che
 * floor3d-card usa per costruire il renderer Three.js, confermata da log
 * console pubblici del progetto ("First updated start → Start Build
 * Renderer → ... → First updated end"). Prima, l'avvio partiva da un setter
 * scritto a mano su `hass`, senza questa garanzia: il layout del contenitore
 * poteva non essere ancora pronto, e la vista 3D restava vuota finché non
 * arrivava un'interazione qualsiasi a far ripartire tutto.
 */
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { ReactiveElement } from './vendor/reactive-element.js';

const TEMPLATE_HTML = `<style>

:host{
  display:block;
  --bg:#0e1815; --bg2:#0a1210;
  --panel:#132420; --panel2:#183028;
  --border:#25443a; --border-soft:#1c332b;
  --text:#eaf3ee; --text-dim:#8fa79c; --text-faint:#5d766c;
  --water:#3fa6cf; --water-soft:#3fa6cf33;
  --leaf:#6ec178; --leaf-soft:#6ec17833;
  --warn:#e0a83a; --warn-soft:#e0a83a2e;
  --danger:#e0645a; --danger-soft:#e0645a2e;
  --sand:#cbb27a; --gravel:#9aa39c; --soil:#7a5a3f;
  --radius:10px;
  --font-display: 'Segoe UI', 'Helvetica Neue', Arial, system-ui, sans-serif;
  --font-body: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
  --font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  margin:0;padding:0;
  background:radial-gradient(1200px 700px at 20% -10%, #143229 0%, var(--bg) 55%), var(--bg);
  color:var(--text);
  font-family:var(--font-body);
  min-height:100vh;
}
*{box-sizing:border-box;}
h1,h2,h3{font-family:var(--font-display);font-weight:700;margin:0 0 4px 0; letter-spacing:.2px;}
code,.mono,input,select,textarea,table{font-family:var(--font-mono);}
::-webkit-scrollbar{width:10px;height:10px;}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:8px;}
::-webkit-scrollbar-track{background:transparent;}

/* ---------- Shell ---------- */
.shell{max-width:1360px;margin:0 auto;padding:22px 22px 60px;}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.brand{display:flex;align-items:center;gap:12px;}
.brand-mark{width:38px;height:38px;border-radius:10px;background:linear-gradient(145deg,var(--leaf),var(--water));display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 6px 18px -6px #3fa6cf66;}
.brand h1{font-size:19px;color:var(--text);}
.brand p{margin:0;font-size:12px;color:var(--text-dim);}
.ha-status{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-dim);background:var(--panel);border:1px solid var(--border);padding:7px 12px;border-radius:999px;}
.dot{width:8px;height:8px;border-radius:50%;background:var(--text-faint);}
.dot.on{background:var(--leaf);box-shadow:0 0 8px 1px #6ec17888;}
.dot.off{background:var(--danger);}

.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;border-bottom:1px solid var(--border-soft);padding-bottom:0;}
.tab-btn{background:none;border:none;color:var(--text-dim);font-family:var(--font-display);font-size:13.5px;font-weight:600;padding:10px 15px;cursor:pointer;border-bottom:2px solid transparent;display:flex;align-items:center;gap:7px;transition:.15s;}
.tab-btn:hover{color:var(--text);}
.tab-btn.active{color:var(--leaf);border-bottom-color:var(--leaf);}
.view{display:none;animation:fade .2s ease;}
.view.active{display:block;}
@keyframes fade{from{opacity:0;transform:translateY(3px);}to{opacity:1;transform:translateY(0);}}

.card{background:var(--panel);border:1px solid var(--border-soft);border-radius:var(--radius);padding:16px;}
.grid{display:grid;gap:16px;}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
.spacer{flex:1;}
.small{font-size:12px;color:var(--text-dim);}
.muted{color:var(--text-dim);}
.pill{font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid var(--border);color:var(--text-dim);}
.pill.leaf{color:var(--leaf);border-color:#6ec17855;background:var(--leaf-soft);}
.pill.warn{color:var(--warn);border-color:#e0a83a55;background:var(--warn-soft);}
.pill.danger{color:var(--danger);border-color:#e0645a55;background:var(--danger-soft);}
.pill.water{color:var(--water);border-color:#3fa6cf55;background:var(--water-soft);}
#nativeSaveStatus{position:fixed;right:18px;bottom:18px;z-index:9999;padding:8px 12px;border-radius:999px;background:#132420;border:1px solid var(--border);color:var(--text-dim);font-size:12px;box-shadow:0 6px 20px #0008}
#nativeSaveStatus.ok{color:var(--leaf);border-color:#6ec17866}
#nativeSaveStatus.busy{color:var(--warn);border-color:#e0a83a66}
#nativeSaveStatus.err{color:#fff;background:#7b2727;border-color:var(--danger)}

label{font-size:11.5px;color:var(--text-dim);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;}
input[type=text],input[type=number],input[type=password],input[type=time],select,textarea{
  width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);
  padding:8px 10px;border-radius:7px;font-size:13px;outline:none;transition:.15s;
}
input:focus,select:focus,textarea:focus{border-color:var(--water);}
input[type=range]{accent-color:var(--leaf);width:100%;}
.field{margin-bottom:10px;}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.field-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}

button{cursor:pointer;font-family:var(--font-body);border-radius:8px;border:1px solid var(--border);background:var(--panel2);color:var(--text);padding:8px 14px;font-size:13px;font-weight:500;transition:.15s;}
button:hover{border-color:var(--water);}
button.primary{background:linear-gradient(145deg,#4fb85f,#3a9a68);border:none;color:#08150d;font-weight:700;}
button.primary:hover{filter:brightness(1.08);}
button.water{background:linear-gradient(145deg,#4bb4dd,#2f88ab);border:none;color:#04181e;font-weight:700;}
button.ghost{background:transparent;}
button.danger{background:var(--danger-soft);border-color:#e0645a55;color:#ffb3ac;}
button.sm{padding:5px 10px;font-size:12px;}
button:disabled{opacity:.4;cursor:not-allowed;}
button.icon{width:34px;height:34px;padding:0;display:flex;align-items:center;justify-content:center;font-size:15px;}

table{width:100%;border-collapse:collapse;font-size:12.5px;}
th{text-align:left;color:var(--text-dim);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--border);text-transform:uppercase;font-size:10.5px;letter-spacing:.4px;}
td{padding:8px 10px;border-bottom:1px solid var(--border-soft);vertical-align:middle;}
tr:hover td{background:#ffffff05;}

.toast-wrap{position:fixed;bottom:18px;right:18px;display:flex;flex-direction:column;gap:8px;z-index:999;}
.toast{background:var(--panel2);border:1px solid var(--border);padding:10px 14px;border-radius:8px;font-size:12.5px;max-width:340px;box-shadow:0 8px 24px -8px #000a;}
.toast.err{border-color:#e0645a66;color:#ffb3ac;}
.toast.ok{border-color:#6ec17866;color:#bdf0c4;}

/* ---------- Map view ---------- */
.map-layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start;}
.map-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
.map-toolbar button{display:flex;align-items:center;gap:6px;}
.map-toolbar button.active{border-color:var(--leaf);color:var(--leaf);background:var(--leaf-soft);}
.toggle3d{margin-bottom:10px;}
.toggle3d button.active{border-color:var(--water);color:var(--water);background:var(--water-soft);}
#canvas3dWrap{position:relative;height:420px;cursor:grab;}
#canvas3dWrap:active{cursor:grabbing;}
#canvas3dWrap canvas{width:100%!important;height:100%!important;display:block;}
.hint3d{position:absolute;top:10px;left:10px;background:#0009;border:1px solid #ffffff22;padding:6px 10px;border-radius:7px;font-size:11.5px;color:#d7e6df;pointer-events:none;}
.canvas-wrap{position:relative;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:
   linear-gradient(#132420,#0f1e19);}
canvas{display:block;width:100%;cursor:crosshair;touch-action:none;}
.map-hint{position:absolute;top:10px;left:10px;background:#0009;border:1px solid #ffffff22;padding:6px 10px;border-radius:7px;font-size:11.5px;color:#d7e6df;pointer-events:none;}
.side-panel h3{font-size:13.5px;margin-bottom:10px;}
.legend{display:flex;flex-direction:column;gap:6px;margin-top:8px;}
.legend-item{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-dim);}
.swatch{width:11px;height:11px;border-radius:3px;flex:none;}

/* misc */
.empty{padding:30px 10px;text-align:center;color:var(--text-faint);font-size:13px;}
.section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.help{font-size:12px;color:var(--text-faint);line-height:1.5;margin-top:6px;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.badge-count{background:var(--bg2);border:1px solid var(--border);border-radius:999px;padding:1px 8px;font-size:11px;color:var(--text-dim);}
hr.sep{border:none;border-top:1px solid var(--border-soft);margin:14px 0;}
a{color:var(--water);}
.zone-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11.5px;border:1px solid var(--border);}
.flow-bar{height:6px;border-radius:4px;background:var(--bg2);overflow:hidden;margin-top:6px;}
.flow-bar>div{height:100%;background:linear-gradient(90deg,var(--water),var(--leaf));}
.timer-list{display:flex;flex-direction:column;gap:8px;}
.timer-row{display:grid;grid-template-columns:22px minmax(130px,1fr) 80px 105px minmax(250px,1.5fr);gap:10px;align-items:center;background:var(--bg2);border:1px solid var(--border-soft);padding:10px;border-radius:8px;}
.timer-days{display:flex;gap:4px;flex-wrap:wrap}.timer-days label{display:flex;align-items:center;gap:2px;margin:0;font-size:10px;text-transform:capitalize}.timer-days input{width:auto}
.log-entry{border-left:3px solid var(--border);padding:6px 10px;font-size:12.5px;color:var(--text-dim);margin-bottom:6px;}
.log-entry.skip{border-color:var(--warn);}
.log-entry.run{border-color:var(--leaf);}
.log-entry.err{border-color:var(--danger);}
@media(max-width:920px){
  .map-layout{grid-template-columns:1fr;}
  .two-col{grid-template-columns:1fr;}
  .field-row,.field-row3{grid-template-columns:1fr;}
}

/* ---------- Home dashboard ---------- */
#screen-home{display:none;}
#screen-home.active{display:block;}
#screen-manage{display:none;}
#screen-manage.active{display:block;}
.home-topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px;}
.home-hero{position:relative;border:1px solid var(--border-soft);border-radius:16px;overflow:hidden;height:min(58vh,520px);min-height:340px;background:#0a1512;}
#homeScene3d{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none;}
#homeScene3d:active{cursor:grabbing;}
#homeScene3d canvas{width:100%!important;height:100%!important;display:block;}
#homeIsoCanvas{position:absolute;inset:0;z-index:0;pointer-events:none;transition:opacity .15s ease;}
#homeScene3d canvas:not(#homeIsoCanvas){z-index:1;cursor:grab!important;}
#homeScene3d canvas:not(#homeIsoCanvas):active{cursor:grabbing!important;}
.home-hero-overlay{position:absolute;left:16px;top:16px;right:16px;z-index:10;display:flex;justify-content:space-between;gap:12px;pointer-events:none;flex-wrap:wrap;}
.home-hero-overlay>*{pointer-events:auto;}
.home-empty-hint{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--text-faint);font-size:13px;padding:20px;pointer-events:none;}
.glass-card{background:#0d1c17cc;backdrop-filter:blur(6px);border:1px solid #ffffff1a;border-radius:12px;padding:12px 14px;}
.weather-card{display:flex;align-items:stretch;gap:8px;min-width:min(620px,70vw);padding:9px 10px;overflow-x:auto;}
.forecast-day{min-width:92px;padding:5px 9px;border-right:1px solid #ffffff18;text-align:center}.forecast-day:last-child{border-right:0}.forecast-day .weather-icon{font-size:23px}.forecast-day b{font-size:11px;display:block;text-transform:capitalize}.forecast-day .temps{font-size:13px;margin-top:2px}.forecast-day .rain{font-size:10px;color:var(--text-dim)}
.weather-icon{font-size:30px;line-height:1;}
.weather-temp{font-family:var(--font-display);font-size:22px;font-weight:700;}
.weather-meta{font-size:11.5px;color:var(--text-dim);}
.home-stop-btn{background:linear-gradient(145deg,#e0645a,#b8382e);border:none;color:#fff;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;box-shadow:0 8px 22px -8px #e0645a99;display:flex;align-items:center;gap:8px;}
.home-gear-btn{width:42px;height:42px;border-radius:999px;font-size:18px;display:flex;align-items:center;justify-content:center;padding:0;background:#0d1c17cc;border:1px solid #ffffff1a;}
.home-bottom{display:grid;grid-template-columns:1fr 1.35fr 2fr;gap:14px;margin-top:14px;align-items:start;}
.zone-quick{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
.zone-quick-btn{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px 12px;border-radius:10px;text-align:left;}
.zone-quick-btn.on{border-color:var(--leaf);background:var(--leaf-soft);}
.zone-quick-btn .zq-name{font-weight:600;font-size:12.5px;}
.zone-quick-btn .zq-state{font-size:10.5px;color:var(--text-dim);}
.stat-row{display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--border-soft);}
.stat-row:last-child{border-bottom:none;}
.back-home-btn{display:flex;align-items:center;gap:6px;}
.home-map-actions{display:flex;gap:8px;margin-left:auto;}
.home-tabs{display:flex;gap:8px;margin-top:14px}.home-tabs button.active{border-color:var(--leaf);color:var(--leaf);background:var(--leaf-soft)}
.home-log-panel{display:none;margin-top:14px}.home-log-panel.active{display:block}.log-table-wrap{max-height:520px;overflow:auto}.log-table-wrap table{min-width:760px}
.instruction-list{margin:0;padding-left:22px;color:var(--text-dim);font-size:13px;line-height:1.55;}
.instruction-list li{padding:7px 0;border-bottom:1px solid var(--border-soft);}
.instruction-list li:last-child{border-bottom:0;}
@media(max-width:1050px){.home-bottom{grid-template-columns:1fr 1fr}.home-bottom .home-zones-card{grid-column:1/-1}}
@media(max-width:680px){.home-bottom{grid-template-columns:1fr}.home-bottom .home-zones-card{grid-column:auto}}
@media(max-width:760px){.timer-row{grid-template-columns:18px 1fr 75px}.timer-row .timer-time,.timer-row .timer-days{grid-column:2/-1}.weather-card{min-width:calc(100vw - 80px)}}

/* ---------- Area type textures (2D legend swatches) ---------- */
.swatch.prato{background:linear-gradient(135deg,#4c8a52,#6ec178);}
.swatch.ghiaia{background:linear-gradient(135deg,#8b9088,#c7cac2);}
.swatch.terra{background:linear-gradient(135deg,#5c4229,#8a6440);}
.swatch.aiuola{background:linear-gradient(135deg,#7a5636,#a2c96b);}

/* ---------- Dripline / vegetation toolbar accents ---------- */
.map-toolbar button[data-tool="dripline"].active{border-color:var(--warn);color:var(--warn);background:var(--warn-soft);}
.map-toolbar button[data-tool="vegetazione"].active{border-color:#8fe0a0;color:#8fe0a0;background:#8fe0a022;}
.plot-setup{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr)) auto;gap:10px;align-items:end;margin-bottom:10px;padding:12px;background:var(--bg2);border:1px solid var(--border-soft);border-radius:10px;}.plot-setup .field{margin:0}.plot-setup button{height:38px}.plot-size-note{grid-column:1/-1;font-size:11.5px;color:var(--text-dim)}
@media(max-width:720px){.plot-setup{grid-template-columns:1fr 1fr}.plot-setup button{grid-column:1/-1}}

</style>

<div class="shell">

  <!-- ======================================================
       SCHERMATA HOME — dashboard con mappa 3D, meteo, stop
       ====================================================== -->
  <div id="screen-home" class="active">
    <div class="home-topbar">
      <div class="brand">
        <img class="brand-mark" src="/irrigaha_static/icon-192.png" alt="IRRIGAZIONE SMART" style="border-radius:10px;">
        <div>
          <h1>IRRIGAZIONE SMART <span class="small muted" id="versionBadgeHome" style="font-weight:400;"></span></h1>
          <p>Sistema di irrigazione domotico</p>
        </div>
      </div>
    </div>

    <div class="home-hero">
      <div id="homeScene3d" role="img" aria-label="Vista tridimensionale del giardino"><canvas id="homeIsoCanvas"></canvas></div>
      <div class="home-empty-hint" id="homeEmptyHint">Nessun elemento sulla mappa ancora.<br>Vai su ⚙️ Gestione per disegnare il tuo giardino.</div>
      <div class="home-hero-overlay">
        <div class="glass-card weather-card" id="homeWeatherCard" style="display:none;"></div>
        <div class="home-map-actions">
          <button class="home-gear-btn" id="btnHomeSettings" title="Gestione">⚙️</button>
        </div>
      </div>
      <div class="home-hero-overlay" style="top:auto;bottom:16px;">
        <div class="row"><span class="pill water glass-card" id="homeFlowPill" style="border:1px solid #ffffff1a;">Portata attiva: 0 l/min</span><span class="pill leaf glass-card" id="homeDailyLiters">Oggi: 0,0 L</span></div>
        <button class="home-stop-btn" id="btnHomeStop">⏻ Arresta tutto</button>
      </div>
    </div>

    <div class="home-tabs"><button class="active" data-home-view="dashboard">🏠 Dashboard</button><button data-home-view="logs">📋 Log ultime 24 ore</button></div>
    <div class="home-bottom" id="homeDashboardPanel">
      <div class="card">
        <h3>Stato impianto</h3>
        <div class="stat-row"><span class="muted">Pompa</span><span id="homeStatPump">spenta</span></div>
        <div class="stat-row"><span class="muted">Zone attive</span><span id="homeStatZones">0</span></div>
        <div class="stat-row"><span class="muted">Aree disegnate</span><span id="homeStatAreas">0</span></div>
        <div class="stat-row"><span class="muted">Irrigatori</span><span id="homeStatSprinklers">0</span></div>
        <div class="stat-row"><span class="muted">Linee gocciolanti</span><span id="homeStatDriplines">0</span></div>
        <div class="stat-row"><span class="muted">Automatico</span><span id="homeStatAuto">disattivo</span></div>
      </div>
      <div class="card">
        <h3>Programmazione</h3>
        <div id="homeScheduleSummary"><div class="empty">Caricamento programmazione…</div></div>
      </div>
      <div class="card home-zones-card">
        <div class="section-title"><h3>Zone</h3><span class="badge-count" id="homeZoneCount">0</span></div>
        <div class="zone-quick" id="homeZoneQuick"></div>
      </div>
    </div>
    <div class="home-log-panel" id="homeLogPanel"><div class="card"><div class="section-title"><h3>Operazioni ultime 24 ore</h3><span class="pill" id="homeLogCount">0</span></div><div class="log-table-wrap" id="homeOperationLog"></div></div></div>
  </div>

  <!-- ======================================================
       SCHERMATA GESTIONE — mappa 2D, zone, timer, DB, impostazioni
       ====================================================== -->
  <div id="screen-manage">

  <div class="topbar">
    <div class="brand">
      <img class="brand-mark" src="/irrigaha_static/icon-192.png" alt="IRRIGAZIONE SMART" style="border-radius:10px;">
      <div>
        <h1>IRRIGAZIONE SMART <span class="small muted" id="versionBadgeManage" style="font-weight:400;"></span></h1>
        <p>Sistema di irrigazione domotico</p>
      </div>
    </div>
    <button class="ghost back-home-btn" id="btnBackHome">🏠 Home</button>
  </div>

  <div class="tabs" id="tabs">
    <button class="tab-btn active" data-view="mappa">🗺️ Mappa</button>
    <button class="tab-btn" data-view="zone">🚿 Zone &amp; Pompa</button>
    <button class="tab-btn" data-view="controllo">🎛️ Controllo manuale</button>
    <button class="tab-btn" data-view="timer">📅 Prog. Manuale</button>
    <button class="tab-btn" data-view="auto">🌦️ Automatico</button>
    <button class="tab-btn" data-view="db">📘 Database irrigatori</button>
    <button class="tab-btn" data-view="log">📋 LOG</button>
    <button class="tab-btn" data-view="istruzioni">📖 Istruzioni</button>
  </div>

  <!-- ===================== MAPPA ===================== -->
  <div class="view active" id="view-mappa">
    <div class="map-layout">
      <div>
        <div class="row toggle3d">
          <button id="view2DBtn" class="active">🗺️ 2D — modifica</button>
          <button id="view3DBtn">🧊 3D — anteprima animata</button>
          <button id="btnCenter3D" style="display:none">◎ Centra vista</button>
          <button id="btnPreviewWater3D" class="active" style="display:none">💦 Anteprima acqua: ON</button>
        </div>

        <div id="canvas2dArea">
          <div class="plot-setup" id="plotSetup">
            <div class="field"><label>Larghezza appezzamento (m)</label><input type="number" id="plotWidthM" min="1" max="10000" step="0.5" value="50"></div>
            <div class="field"><label>Profondità appezzamento (m)</label><input type="number" id="plotHeightM" min="1" max="10000" step="0.5" value="31"></div>
            <div class="field"><label>Passo righelli (m)</label><input type="number" id="rulerStepM" min="0.5" max="1000" step="0.5" value="5"></div>
            <button class="primary" id="btnApplyPlotSize">Applica dimensioni</button>
            <div class="plot-size-note">Le dimensioni reali definiscono scala e proporzioni della tavola. Impostale prima di disegnare; i riferimenti metrici restano visibili a sinistra e in basso.</div>
          </div>
          <div class="map-toolbar">
            <button data-tool="select" class="active">↖ Seleziona / sposta</button>
            <button data-tool="pan">✋ Sposta vista</button>
            <button data-tool="area">▱ Disegna area</button>
            <button data-tool="sprinkler">🌀 Irrigatore</button>
            <button data-tool="dripline">〰️ Tubo gocciolante</button>
            <button data-tool="vegetazione">🌳 Albero/siepe/pianta</button>
            <button data-tool="sensor">📡 Sensore</button>
            <span class="spacer"></span>
            <button id="btnZoomOut2D" class="sm" title="Riduci zoom">−</button>
            <button id="btnZoomReset2D" class="sm" title="Ripristina vista">100%</button>
            <button id="btnZoomIn2D" class="sm" title="Aumenta zoom">＋</button>
            <button id="btnEditPlot" class="sm">📐 Modifica appezzamento</button>
            <button id="btnClearMap" class="danger sm">Svuota mappa</button>
          </div>
          <div class="canvas-wrap">
            <canvas id="mapCanvas" width="1000" height="620"></canvas>
            <div class="map-hint" id="mapHint">Scala: 1 px = — m · clicca "Calibra scala" per impostarla</div>
          </div>
          <p class="help" id="toolHelp">Modalità selezione: trascina un elemento per spostarlo, clicca per selezionarlo e modificarne i parametri nel pannello a destra.</p>
        </div>

        <div id="canvas3dWrap" class="canvas-wrap" style="display:none;">
          <div class="hint3d">🖱️ Trascina per ruotare · rotellina per zoom — le zone attive mostrano i getti animati</div>
        </div>
        <p class="help" id="help3d" style="display:none;">Anteprima 3D approssimativa del giardino: prato, aiuole e posizione degli irrigatori, con getti d'acqua animati sulle zone in funzione. Per modificare la disposizione torna alla vista 2D.</p>
      </div>

      <div class="side-panel">
        <div class="card" id="inspector">
          <h3>Proprietà</h3>
          <div class="empty" id="inspectorEmpty">Nessun elemento selezionato.<br>Scegli uno strumento e clicca sulla mappa.</div>
          <div id="inspectorBody"></div>
        </div>
        <div class="card" style="margin-top:14px;">
          <h3>Legenda</h3>
          <div class="legend" id="legendZones"></div>
          <hr class="sep">
          <div class="legend">
            <div class="legend-item"><span class="swatch" style="background:#3fa6cf"></span> Sensore</div>
            <div class="legend-item"><span class="swatch prato"></span> Prato</div>
            <div class="legend-item"><span class="swatch ghiaia"></span> Ghiaia</div>
            <div class="legend-item"><span class="swatch terra"></span> Terra</div>
            <div class="legend-item"><span class="swatch aiuola"></span> Aiuola</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== ZONE ===================== -->
  <div class="view" id="view-zone">
    <div class="grid" style="grid-template-columns:1fr;">
      <div class="card">
        <div class="section-title">
          <h3>Pompa</h3>
        </div>
        <div class="field-row3">
          <div class="field">
            <label>Entità relè pompa (HA)</label>
            <select id="pumpEntity"></select>
          </div>
          <div class="field">
            <label>Portata massima pompa (l/min)</label>
            <input type="number" id="pumpMaxFlow" value="60" min="1">
          </div>
          <div class="field">
            <label>Pressione massima (bar)</label>
            <input type="number" id="pumpMaxPressure" value="4" step="0.1" min="0.5">
          </div>
        </div>
          <div class="field">
            <label>Sensore portata reale (opzionale, l/min)</label>
            <select id="pumpFlowSensor"></select>
          </div>
          <div class="field" style="max-width:360px;"><label>Ritardo sicurezza valvola ↔ pompa (secondi)</label><input type="number" id="pumpValveDelay" value="2" min="0" max="120" step="0.5"><div class="help">Avvio: zona, attesa, pompa. Arresto: pompa, attesa, zona.</div></div>
      </div>

      <div class="card">
        <div class="section-title">
          <h3>Zone irrigazione <span class="badge-count" id="zoneCount">0</span></h3>
          <button class="primary sm" id="btnAddZone">+ Nuova zona</button>
        </div>
        <p class="help">Le zone sono l'impianto di irrigazione vero e proprio: un gruppo di irrigatori e/o tubi gocciolanti comandati insieme da un relè. Sono indipendenti dalle <b>aree</b> disegnate in Mappa (prato/ghiaia/terra/aiuola), che restano puramente grafiche — la riga "📍" qui sotto mostra solo, a titolo informativo, sopra quale area disegnata ricadono spazialmente i dispositivi di ogni zona.</p>
        <div id="zoneList"></div>
      </div>
    </div>
  </div>

  <!-- ===================== CONTROLLO MANUALE ===================== -->
  <div class="view" id="view-controllo">
    <div class="card" style="margin-bottom:16px;">
      <div class="row">
        <div>
          <h3>Pompa</h3>
          <p class="small" id="pumpStateLabel">Stato: sconosciuto</p>
        </div>
        <span class="spacer"></span>
        <span class="pill water" id="totalFlowPill">Portata attiva: 0 l/min</span>
        <button class="water" id="btnPumpToggle">Avvia pompa</button>
        <button class="danger" id="btnEmergencyStop">⏻ Stop tutto</button>
      </div>
    </div>
    <div class="grid" id="manualZoneGrid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));"></div>
  </div>

  <!-- ===================== TIMER ===================== -->
  <div class="view" id="view-timer">
    <div class="card">
      <div class="section-title">
        <h3>Prog. Manuale</h3>
        <div class="row">
          <span class="pill leaf">Sequenziale sicuro · 1 zona alla volta</span>
        </div>
      </div>
      <p class="help">Imposta durata, ora e giorni per ciascuna zona. Le programmazioni abilitate vengono eseguite dal backend Home Assistant anche con la pagina chiusa. “Avvia programma” resta disponibile per un avvio immediato.</p>
      <div class="timer-list" id="timerList"></div>
      <hr class="sep">
      <div class="row">
        <button class="primary" id="btnStartTimer">▶ Avvia programma</button>
        <button class="danger" id="btnStopTimer" disabled>■ Ferma programma</button>
        <span class="spacer"></span>
        <span class="pill" id="timerStatusPill">In attesa</span>
      </div>
    </div>
  </div>

  <!-- ===================== AUTOMATICO ===================== -->
  <div class="view" id="view-auto">
    <div class="two-col">
      <div class="card">
        <div class="section-title">
          <h3>Regole automatiche</h3>
          <label style="margin:0;"><input type="checkbox" id="autoEnabled" style="width:auto;"> Attivo</label>
        </div>
        <div class="field">
          <label>Entità meteo (weather.*)</label>
          <select id="autoWeatherEntity"></select>
        </div>
        <div class="field">
          <label>Sensore pioggia in corso (binary_sensor, opzionale — es. centralina Tuya)</label>
          <select id="autoRainSensor"></select>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Soglia probabilità pioggia per saltare (%)</label>
            <input type="number" id="autoRainThreshold" value="60" min="0" max="100">
          </div>
          <div class="field">
            <label>Orario di avvio programma</label>
            <input type="time" id="autoStartTime" value="06:00">
          </div>
        </div>
        <div class="field">
          <label>Giorni attivi</label>
          <div class="row" id="autoDays"></div>
        </div>
        <div class="field"><label>Orari controlli giornalieri (separati da virgola)</label><input type="text" id="autoCheckTimes" value="05:00, 14:00, 21:00"><div class="help">Il pacchetto HA salva i minuti di ogni zona a questi orari ed esegue un'ultima rivalutazione immediatamente prima dell'avvio.</div></div>
        <hr class="sep">
        <div class="row">
          <button class="primary" id="btnRunAutoCheck">🔍 Verifica adesso</button>
          <button id="btnExportYaml">⬇ Genera pacchetto HA persistente</button>
        </div>
        <p class="help">Installazione: salva il file come <code>/config/packages/irrigaha.yaml</code>; in <code>configuration.yaml</code>, sotto <code>homeassistant:</code>, aggiungi <code>packages: !include_dir_named packages</code>. Poi verifica la configurazione e riavvia HA.</p>
      </div>

      <div class="card">
        <h3>Aggiustamento durata per condizioni</h3>
        <p class="help">Regola in modo semplice la durata di irrigazione in base a temperatura/umidità stimate dal meteo e all'umidità del terreno rilevata dai sensori collegati a ciascuna zona.</p>
        <div class="field-row">
          <div class="field"><label>Riduci se temperatura &lt; (°C)</label><input type="number" id="autoTempLow" value="15"></div>
          <div class="field"><label>Aumenta se temperatura &gt; (°C)</label><input type="number" id="autoTempHigh" value="28"></div>
        </div>
        <div class="field">
          <label>Salta zona se umidità suolo &gt; (%)</label>
          <input type="number" id="autoSoilThreshold" value="55" min="0" max="100">
        </div>
        <div class="field-row"><div class="field"><label>ET₀ giornaliera di riserva (mm)</label><input type="number" id="autoEtoFallback" min="0" max="15" step="0.1" value="4"></div><div class="field"><label>Pioggia efficace ultime 24 h (mm)</label><input type="number" id="autoEffectiveRain" min="0" max="300" step="0.1" value="0"></div></div>
        <div id="waterPlan" style="margin-top:12px;"><div class="empty">Esegui una verifica per calcolare il bilancio idrico delle zone.</div></div>
        <hr class="sep">
        <h3>Log verifiche</h3>
        <div id="autoLog"><div class="empty">Nessuna verifica eseguita ancora.</div></div>
      </div>
    </div>
  </div>

  <!-- ===================== DATABASE ===================== -->
  <div class="view" id="view-db">
    <div class="card" style="margin-bottom:16px;">
      <div class="section-title">
        <h3>Database irrigatori (rotori / statici / a goccia puntuale)</h3>
        <button class="primary sm" id="btnAddModel">+ Aggiungi modello manualmente</button>
      </div>
      <p class="help">Valori di portata/gittata basati sulle schede tecniche ufficiali dove disponibili (Rain Bird, Hunter, Gardena); gli altri sono indicativi e vanno verificati sulla scheda del tuo modello — puoi modificarli o aggiungerne di nuovi con lo stesso modulo, incluso il link alla scheda tecnica. La portata è espressa "equivalente a 360°": per irrigatori statici/settoriali (spray) viene poi moltiplicata per l'arco impostato; per i rotori (getto singolo rotante) resta costante indipendentemente dall'arco, come nella realtà fisica di questi apparecchi.</p>
      <div style="overflow:auto;">
        <table id="modelTable">
          <thead><tr>
            <th>Marca</th><th>Modello</th><th>Tipo</th><th>Ugello / variante</th>
            <th>Pressione nom. (bar)</th><th>Portata nom.</th><th>Gittata nom. (m)</th><th>Scheda</th><th></th>
          </tr></thead>
          <tbody id="modelTableBody"></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="section-title">
        <h3>Database tubo gocciolante</h3>
        <button class="primary sm" id="btnAddDriplineModel">+ Aggiungi tubo manualmente</button>
      </div>
      <p class="help">Portata per metro (l/h·m) usata per calcolare la portata totale di un tubo gocciolante in base alla sua lunghezza reale disegnata sulla mappa.</p>
      <div style="overflow:auto;">
        <table id="driplineModelTable">
          <thead><tr>
            <th>Marca</th><th>Modello</th><th>Variante</th>
            <th>Spaziatura (cm)</th><th>Portata gocciolatore (l/h)</th><th>Portata (l/h·m)</th><th>Scheda</th><th></th>
          </tr></thead>
          <tbody id="driplineModelTableBody"></tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="section-title"><h3>Database vegetazione e fabbisogno idrico</h3><button class="primary sm" id="btnAddPlant">+ Profilo personalizzato</button></div>
      <p class="help">Profili FAO-56 per colture/tappeti erbosi e classi WUCOLS per ornamentali. 1 mm su 1 m² equivale a 1 litro. Ogni dato riporta fonte e affidabilità.</p>
      <div style="overflow:auto"><table><thead><tr><th>Categoria</th><th>Nome</th><th>Specie / varietà</th><th>Kc</th><th>Radici (m)</th><th>Umidità obiettivo</th><th>Fonte</th><th>Aff.</th><th></th></tr></thead><tbody id="plantTableBody"></tbody></table></div>
    </div>
  </div>

  <!-- ===================== LOG ===================== -->
  <div class="view" id="view-log">
    <div class="card">
      <div class="section-title"><div><h3>Registro operativo — ultimo mese</h3><p class="help">Storico permanente delle operazioni su zone e pompa. I record non vengono eliminati automaticamente.</p></div><button class="danger" id="btnClearOperationLog">Elimina manualmente tutto il registro</button></div>
      <div class="log-table-wrap" id="settingsOperationLog"></div>
    </div>
  </div>

  <!-- ===================== ISTRUZIONI ===================== -->
  <div class="view" id="view-istruzioni">
    <div class="two-col">
      <div class="card">
        <h3>Configurazione iniziale</h3>
        <ol class="instruction-list">
          <li><b>Crea l'appezzamento.</b> In <b>Mappa</b> indica larghezza, profondità e passo metrico, quindi applica le dimensioni prima di disegnare.</li>
          <li><b>Disegna le superfici.</b> Traccia prato, aiuole, terra o ghiaia. Le aree descrivono il giardino, ma non comandano direttamente le valvole.</li>
          <li><b>Configura pompa e zone.</b> In <b>Zone &amp; Pompa</b> seleziona il relè della pompa, il ritardo di sicurezza e crea almeno una zona associandola alla relativa valvola Home Assistant.</li>
          <li><b>Posiziona gli erogatori.</b> Torna in <b>Mappa</b>, aggiungi irrigatori o tubi gocciolanti e assegna ciascuno alla zona corretta.</li>
          <li><b>Regola la copertura.</b> Scegli modello, ugello, arco, rotazione e larghezza bagnata. La superficie automatica della zona si aggiorna durante le modifiche.</li>
          <li><b>Imposta la vegetazione.</b> Per ogni zona scegli prato, pianta o coltura: il profilo modifica il fabbisogno idrico calcolato.</li>
        </ol>
      </div>
      <div class="card">
        <h3>Automazione e utilizzo</h3>
        <ol class="instruction-list" start="7">
          <li><b>Collega meteo e sensori.</b> In <b>Automatico</b> scegli l'entità meteo e l'eventuale sensore pioggia; sulla mappa puoi associare sensori di umidità del terreno alle singole zone.</li>
          <li><b>Definisci il calendario.</b> Imposta giorni, ora di avvio e orari delle rivalutazioni giornaliere.</li>
          <li><b>Verifica il piano.</b> Usa <b>Verifica adesso</b> per controllare litri e minuti calcolati prima di attivare la modalità automatica.</li>
          <li><b>Attiva l'automatismo.</b> Il backend Home Assistant continuerà a eseguire controlli e irrigazioni anche con questa pagina chiusa.</li>
          <li><b>Controlla dalla Home.</b> La scheda Programmazione mostra lo stato automatico, l'ultima valutazione, il piano calcolato e la prossima irrigazione.</li>
          <li><b>Comandi alternativi.</b> Usa <b>Controllo manuale</b> per una zona singola oppure <b>Prog. Manuale</b> per una sequenza temporanea o settimanale.</li>
        </ol>
        <hr class="sep">
        <h3>Sicurezza e note</h3>
        <ul class="help">
          <li>Avvio: apertura valvola, attesa configurata, avvio pompa. Arresto: spegnimento pompa, attesa, chiusura valvola.</li>
          <li>Il calcolo della portata per irrigatore usa Q ∝ √P per stimare come varia la portata rispetto alla pressione nominale del modello scelto.</li>
          <li>Il tubo gocciolante calcola la portata come (l/h per metro) × lunghezza reale della polilinea disegnata, in base alla scala calibrata.</li>
          <li>Se la portata totale di una zona supera quella della pompa, viene mostrato un avviso: dividi gli irrigatori su più zone.</li>
        </ul>
        <hr class="sep">
        <div class="row"><span class="pill water" id="versionBadgeSettings" style="font-size:13px;padding:5px 12px;"></span><span class="small muted">L'integrazione usa direttamente la sessione Home Assistant: non servono URL o token da inserire.</span></div>
      </div>

      <div class="card">
        <h3>Backup della configurazione</h3>
        <p class="help">I dati (mappa, zone, irrigatori, tubi, programmazione) sono salvati nello storage interno di Home Assistant. Per avere anche una copia portabile — utile prima di modifiche importanti, per spostare la configurazione su un'altra istanza, o come rete di sicurezza indipendente dallo storage di HA — puoi esportarli in un file e reimportarli in qualsiasi momento.</p>
        <div class="row">
          <button id="btnExportBackup">⬇ Esporta backup (.json)</button>
          <button id="btnImportBackup">⬆ Importa backup (.json)</button>
          <input type="file" id="importBackupFile" accept="application/json" style="display:none;">
        </div>
        <p class="help">L'importazione <b>sostituisce interamente</b> la configurazione attuale con quella del file scelto, e la salva subito su Home Assistant.</p>
      </div>
    </div>
  </div>

  </div><!-- /screen-manage -->

</div>
<div class="toast-wrap" id="toastWrap"></div>


`;

let hass = null;
let root = null;
// Piccolo handle condiviso tra bootApp() (che vive nel proprio scope di funzione,
// con tutte le variabili interne dell'app) e il custom element sotto: evita di
// dover "risalire" a livello di modulo decine di variabili interne solo per
// permettere al ciclo di vita dell'elemento di richiedere un refresh del 3D.
const appHandle = {};

function bootApp(){

/* ============================================================
   STATE
   ============================================================ */
/* ============================================================
   VERSIONE APP — incrementata ad ogni release.
   Mostrata in Home, in Gestione e in Istruzioni, così è sempre
   chiaro quale build è effettivamente in esecuzione (utile per
   verificare che un aggiornamento dell'add-on sia andato a buon fine).
   ============================================================ */
const APP_VERSION = '3.4.0';

/* Bridge diretto con Home Assistant: il pannello è un elemento nativo nel
   DOM di HA (nessun iframe, nessun postMessage). `hass` è impostato dal
   custom element (vedi fondo file) e riassegnato ad ogni aggiornamento di
   stato — viene letto qui sempre "al volo" tramite binding di chiusura, mai
   catturato per valore, così è sempre aggiornato. */
let nativeLoadedRevision = 0;
async function nativeCall(action, payload={}){
  if(!hass) throw new Error('Home Assistant non ancora disponibile');
  try{
    switch(action){
      case 'get':
        return await hass.connection.sendMessagePromise({type:'irrigaha/legacy_get'});
      case 'automation':
        return await hass.connection.sendMessagePromise({type:'irrigaha/get'});
      case 'runtime':
        return await hass.connection.sendMessagePromise({type:'irrigaha/runtime'});
      case 'start_zone':
        return await hass.connection.sendMessagePromise({type:'irrigaha/start_zone',zone_id:payload.zone_id,minutes:payload.minutes||1440,source:payload.source||'manual_ui'});
      case 'stop_all':
        return await hass.connection.sendMessagePromise({type:'irrigaha/stop_all'});
      case 'recalculate':
        return await hass.connection.sendMessagePromise({type:'irrigaha/recalculate'});
      case 'clear_logs':
        return await hass.connection.sendMessagePromise({type:'irrigaha/clear_logs',log_type:payload.log_type});
      case 'forecast':
        return await hass.connection.sendMessagePromise({
          type:'call_service', domain:'weather', service:'get_forecasts',
          service_data:{type:'daily'}, target:{entity_id:payload.entity_id}, return_response:true
        });
      case 'save':
        return await hass.connection.sendMessagePromise({type:'irrigaha/legacy_save', payload});
      case 'states':
        return Object.values(hass.states);
      case 'state':
        return hass.states[payload.entity_id] || null;
      case 'service':
        return await hass.callService(payload.domain, payload.service, payload.data||{});
      default:
        throw new Error('Azione bridge sconosciuta: '+action);
    }
  }catch(err){
    const msg = err?.message || err?.body?.message || err?.error?.message || (typeof err==='string'?err:null) || 'Errore Home Assistant senza dettagli';
    throw new Error(msg);
  }
}

const uid = () => Math.random().toString(36).slice(2,10);

const DEFAULT_STATE = {
  metersPerPixel: 0.05, // scale calibration
  plot: {widthM:50, heightM:31, rulerStepM:5, configured:false},
  areas: [],       // {id,name,type('prato'|'ghiaia'|'terra'|'aiuola'),color,points:[[x,y]...]}
  sprinklers: [],  // {id,x,y,brand,model,nozzle,type,scaleWithArc,customFlow360,customRadius,radiusM,angleStart,angleEnd,rotation,zoneId,name,numEmitters,flowPerEmitterLh}
  driplines: [],   // {id,name,points:[[x,y]...],modelId,variantId,zoneId}
  decor: [],       // {id,x,y,kind('albero'|'siepe'|'cespuglio'|'pianta'),size,name}
  sensors: [],     // {id,x,y,kind,name,entityId}
  zones: [],       // include profilo vegetale e parametri agronomici
  pump: {relayEntity:'', maxFlowLmin:60, maxPressureBar:4, flowSensorEntity:'', valvePumpDelaySec:2},
  timers: {},      // zoneId -> minutes
  manualSchedules: {}, // zoneId -> {enabled,minutes,startTime,days}
  auto: {enabled:false, weatherEntity:'', rainSensor:'', rainThreshold:60, startTime:'06:00',
         days:{lun:true,mar:true,mer:true,gio:true,ven:true,sab:true,dom:true},
         tempLow:15, tempHigh:28, soilThreshold:55, etoFallback:4, effectiveRainMm:0, checkTimes:['05:00','14:00','21:00']},
  customModels: [], customPlants: [], waterLedger: []
};

let state = structuredClone(DEFAULT_STATE);
let haEntities = []; // list of {entity_id, state, attributes}
let haConnected = false;
let nativeAutomation = {plans:{},last_evaluation:'',last_irrigation:{},operation_log:[],evaluation_log:[],running:false,active_zone:null,active_started_at:null,active_flow_l_min:0,committed_today_liters:0};
let automationRefreshTimer=null, weatherRefreshTimer=null, dailyLitersTimer=null, runtimeRefreshTimer=null;

const ZONE_COLORS = ['#6ec178','#3fa6cf','#e0a83a','#c98fe0','#e0645a','#5ad1c0','#d1b25a','#8fa8e0'];

/* ---------- Preset sprinkler DB (seeded from schede tecniche ufficiali dove indicato) ---------- */
const PRESET_MODELS = [
  {id:'rb5000', brand:'Rain Bird', model:'5000 Series (Rain Curtain)', type:'rotor', scaleWithArc:false,
    source:'Pagina prodotto ufficiale Rain Bird', datasheetUrl:'https://www.rainbird.com/products/5000-series',
    nozzles:[
      {id:'1.5', pressureBar:3.1, flow360:5.98, radiusM:9.4},
      {id:'2.0', pressureBar:3.1, flow360:7.65, radiusM:9.75},
      {id:'3.0', pressureBar:3.1, flow360:11.6, radiusM:10.7},
      {id:'4.0', pressureBar:2.9, flow360:16.8, radiusM:12.8},
      {id:'5.0', pressureBar:3.1, flow360:21.4, radiusM:13.7},
      {id:'6.0', pressureBar:3.2, flow360:25.1, radiusM:14.3},
      {id:'8.0', pressureBar:3.4, flow360:33.5, radiusM:15.2},
    ]},
  {id:'rb1800', brand:'Rain Bird', model:'1800 Series (statico/spray)', type:'spray', scaleWithArc:true,
    source:'Pagina prodotto ufficiale Rain Bird', datasheetUrl:'https://www.rainbird.com/products/1800-series-spray-sprinkler-bodies',
    nozzles:[
      {id:'8 ft', pressureBar:2.1, flow360:15.2, radiusM:2.4},
      {id:'10 ft', pressureBar:2.1, flow360:22.8, radiusM:3.0},
      {id:'12 ft', pressureBar:2.1, flow360:30.4, radiusM:3.7},
      {id:'15 ft', pressureBar:2.1, flow360:38.0, radiusM:4.6},
    ]},
  {id:'rb3500', brand:'Rain Bird', model:'3500 Series', type:'rotor', scaleWithArc:false,
    source:'Pagina prodotto ufficiale Rain Bird', datasheetUrl:'https://www.rainbird.com/products/3500-series-rotor-sprinklers',
    nozzles:[
      {id:'1.5', pressureBar:2.8, flow360:5.2, radiusM:7.9},
      {id:'3.0', pressureBar:2.8, flow360:10.4, radiusM:9.1},
      {id:'5.0', pressureBar:3.1, flow360:17.8, radiusM:10.4},
    ]},
  {id:'hpgp', brand:'Hunter', model:'PGP Ultra / I-20', type:'rotor', scaleWithArc:false,
    source:'Scheda tecnica Hunter', datasheetUrl:'https://www.hunterirrigation.com/irrigation-product/rotors/pgpr-ultra',
    nozzles:[
      {id:'1.5 Blu', pressureBar:3.1, flow360:5.7, radiusM:9.4},
      {id:'2.0 Blu', pressureBar:3.1, flow360:7.6, radiusM:10.4},
      {id:'2.5 Blu', pressureBar:3.1, flow360:9.5, radiusM:10.7},
      {id:'3.0 Blu', pressureBar:3.1, flow360:11.4, radiusM:11.6},
    ]},
  {id:'hpros', brand:'Hunter', model:'PROS-00 (statico/spray)', type:'spray', scaleWithArc:true,
    source:'Pagina prodotto ufficiale Hunter', datasheetUrl:'https://www.hunterirrigation.com/irrigation-product/pro-sprayr/pros-00',
    nozzles:[
      {id:'8 ft', pressureBar:2.1, flow360:14.5, radiusM:2.4},
      {id:'10 ft', pressureBar:2.1, flow360:21.6, radiusM:3.0},
      {id:'12 ft', pressureBar:2.1, flow360:29.2, radiusM:3.7},
    ]},
  {id:'hmp', brand:'Hunter', model:'MP Rotator (rotante a getti multipli)', type:'rotor', scaleWithArc:false,
    source:'Pagina prodotto ufficiale Hunter', datasheetUrl:'https://www.hunterirrigation.com/irrigation-product/mp-rotator/standard-mp-rotatorr-nozzle',
    nozzles:[
      {id:'MP1000 (90-210°)', pressureBar:2.8, flow360:4.2, radiusM:5.5},
      {id:'MP2000 (90-210°)', pressureBar:2.8, flow360:5.8, radiusM:7.3},
      {id:'MP3000 (90-210°)', pressureBar:2.8, flow360:7.6, radiusM:9.1},
    ]},
  {id:'gardena', brand:'Gardena', model:'Pop-up Sprinklersystem (generico)', type:'spray', scaleWithArc:true,
    source:'Valori indicativi — nessuna scheda univoca verificata', datasheetUrl:'',
    nozzles:[
      {id:'Standard', pressureBar:3.0, flow360:14, radiusM:3.5},
      {id:'Extra', pressureBar:3.0, flow360:20, radiusM:4.5},
    ]},
  {id:'toro570', brand:'Toro', model:'570Z (statico/spray)', type:'spray', scaleWithArc:true,
    source:'Pagina prodotto ufficiale Toro', datasheetUrl:'https://www.toro.com/en/product/570Z-Series',
    nozzles:[
      {id:'8 ft', pressureBar:2.1, flow360:14.0, radiusM:2.4},
      {id:'12 ft', pressureBar:2.1, flow360:28.0, radiusM:3.7},
    ]},
  {id:'krain', brand:'K-Rain', model:'RPS75 (rotore)', type:'rotor', scaleWithArc:false,
    source:'Valori indicativi — nessuna scheda verificata', datasheetUrl:'',
    nozzles:[
      {id:'Standard', pressureBar:2.8, flow360:9.5, radiusM:9.4},
    ]},
  {id:'irritrol', brand:'Irritrol', model:'Rotore (generico)', type:'rotor', scaleWithArc:false,
    source:'Valori indicativi — nessuna scheda verificata', datasheetUrl:'',
    nozzles:[
      {id:'Standard', pressureBar:3.0, flow360:10, radiusM:9},
    ]},
  {id:'drip', brand:'Generico', model:'Gocciolatore puntuale', type:'drip', scaleWithArc:false,
    source:'Standard di settore', datasheetUrl:'',
    nozzles:[
      {id:'2 l/h', pressureBar:1.5, flow360:0, radiusM:0.3},
      {id:'4 l/h', pressureBar:1.5, flow360:0, radiusM:0.3},
      {id:'8 l/h', pressureBar:1.5, flow360:0, radiusM:0.4},
    ]},
];

/* ---------- Preset dripline DB (tubo forato gocciolante) ---------- */
const PRESET_DRIPLINES = [
  {id:'rb-xfd-09-12', brand:'Rain Bird', model:'XF Dripline XFD-09-12 (16 mm)',
    source:'Valori da catalogo — collegamento specifico non verificato', datasheetUrl:'',
    variants:[
      {id:'0.92 GPH @ 30 cm', spacingCm:30, flowPerDripperLh:3.48, flowPerMeterLh:11.6},
    ]},
  {id:'rb-xfd-06-18', brand:'Rain Bird', model:'XF Dripline XFD-06-18 (16 mm)',
    source:'Valori da catalogo — collegamento specifico non verificato', datasheetUrl:'',
    variants:[
      {id:'0.6 GPH @ 45 cm', spacingCm:45, flowPerDripperLh:2.27, flowPerMeterLh:5.0},
    ]},
  {id:'gardena-drip16', brand:'Gardena', model:'Micro-Drip-System — tubo gocciolante interrato 1,6 l/h',
    source:'Valori da catalogo — collegamento specifico non verificato', datasheetUrl:'',
    variants:[
      {id:'1,6 l/h @ 30 cm', spacingCm:30, flowPerDripperLh:1.6, flowPerMeterLh:5.3},
    ]},
  {id:'netafim-generic', brand:'Netafim', model:'Techline (generico, autocompensante)',
    source:'Catalogo ufficiale Netafim (modello generico)', datasheetUrl:'https://www.netafim.com/en/products-and-solutions/product-offering/drip-irrigation-products/',
    variants:[
      {id:'1,6 l/h @ 33 cm', spacingCm:33, flowPerDripperLh:1.6, flowPerMeterLh:4.85},
      {id:'2,3 l/h @ 33 cm', spacingCm:33, flowPerDripperLh:2.3, flowPerMeterLh:6.97},
    ]},
  {id:'claber-generic', brand:'Claber', model:'Tubo gocciolante (generico)',
    source:'Valori indicativi — nessuna scheda verificata', datasheetUrl:'',
    variants:[
      {id:'2 l/h @ 30 cm', spacingCm:30, flowPerDripperLh:2, flowPerMeterLh:6.7},
    ]},
];

/* Profili agronomici. Kc e radici sono valori iniziali da affinare con clima e sensori locali. */
const PLANT_PROFILES = [
 {id:'grass-cool',category:'Prato',name:'Prato microterme',scientific:'Lolium / Poa / Festuca',kc:.80,rootDepth:.20,targetMoisture:55,source:'FAO-56 / UC ANR',confidence:'A'},
 {id:'grass-festuca',category:'Prato',name:'Festuca arundinacea',scientific:'Festuca arundinacea',kc:.70,rootDepth:.30,targetMoisture:50,source:'FAO-56 / UC ANR',confidence:'B'},
 {id:'grass-rye',category:'Prato',name:'Loietto perenne',scientific:'Lolium perenne',kc:.80,rootDepth:.20,targetMoisture:58,source:'FAO-56',confidence:'B'},
 {id:'grass-poa',category:'Prato',name:'Poa pratensis',scientific:'Poa pratensis',kc:.80,rootDepth:.20,targetMoisture:58,source:'FAO-56',confidence:'B'},
 {id:'grass-bermuda',category:'Prato',name:'Gramigna / Bermuda',scientific:'Cynodon dactylon',kc:.60,rootDepth:.40,targetMoisture:45,source:'FAO-56 / UC ANR',confidence:'A'},
 {id:'grass-zoysia',category:'Prato',name:'Zoysia',scientific:'Zoysia spp.',kc:.55,rootDepth:.35,targetMoisture:45,source:'WUCOLS adattato',confidence:'B'},
 {id:'grass-dichondra',category:'Prato',name:'Dicondra',scientific:'Dichondra repens',kc:.65,rootDepth:.20,targetMoisture:55,source:'WUCOLS adattato',confidence:'C'},
 {id:'tomato',category:'Orto',name:'Pomodoro',scientific:'Solanum lycopersicum',kc:1.15,rootDepth:.70,targetMoisture:60,source:'FAO-56',confidence:'A'},
 {id:'pepper',category:'Orto',name:'Peperone',scientific:'Capsicum annuum',kc:1.05,rootDepth:.60,targetMoisture:62,source:'FAO-56',confidence:'A'},
 {id:'lettuce',category:'Orto',name:'Lattuga',scientific:'Lactuca sativa',kc:1.00,rootDepth:.30,targetMoisture:65,source:'FAO-56',confidence:'A'},
 {id:'potato',category:'Orto',name:'Patata',scientific:'Solanum tuberosum',kc:1.15,rootDepth:.60,targetMoisture:60,source:'FAO-56',confidence:'A'},
 {id:'zucchini',category:'Orto',name:'Zucchina',scientific:'Cucurbita pepo',kc:1.00,rootDepth:.60,targetMoisture:60,source:'FAO-56 gruppo cucurbitacee',confidence:'B'},
 {id:'basil',category:'Aromatica',name:'Basilico',scientific:'Ocimum basilicum',kc:.90,rootDepth:.30,targetMoisture:60,source:'Profilo orticolo derivato',confidence:'C'},
 {id:'rosemary',category:'Aromatica',name:'Rosmarino',scientific:'Salvia rosmarinus',kc:.30,rootDepth:.60,targetMoisture:35,source:'WUCOLS adattato',confidence:'B'},
 {id:'lavender',category:'Ornamentale',name:'Lavanda',scientific:'Lavandula spp.',kc:.30,rootDepth:.50,targetMoisture:35,source:'WUCOLS adattato',confidence:'B'},
 {id:'hydrangea',category:'Ornamentale',name:'Ortensia',scientific:'Hydrangea macrophylla',kc:.70,rootDepth:.45,targetMoisture:60,source:'WUCOLS adattato',confidence:'B'},
 {id:'rose',category:'Ornamentale',name:'Rosa',scientific:'Rosa spp.',kc:.60,rootDepth:.60,targetMoisture:50,source:'WUCOLS adattato',confidence:'B'},
 {id:'olive',category:'Albero',name:'Olivo',scientific:'Olea europaea',kc:.45,rootDepth:1.20,targetMoisture:35,source:'FAO-56',confidence:'A'},
 {id:'apple',category:'Frutteto',name:'Melo',scientific:'Malus domestica',kc:.90,rootDepth:1.00,targetMoisture:50,source:'FAO-56',confidence:'A'},
 {id:'citrus',category:'Frutteto',name:'Agrumi',scientific:'Citrus spp.',kc:.70,rootDepth:.90,targetMoisture:55,source:'FAO-56',confidence:'A'},
 {id:'grape',category:'Frutteto',name:'Vite',scientific:'Vitis vinifera',kc:.70,rootDepth:1.20,targetMoisture:45,source:'FAO-56',confidence:'A'},
 {id:'hedge-low',category:'Siepe',name:'Siepe mediterranea',scientific:'Specie miste xerofile',kc:.35,rootDepth:.70,targetMoisture:40,source:'WUCOLS classe bassa',confidence:'C'},
 {id:'ornamental-medium',category:'Ornamentale',name:'Aiuola mista media esigenza',scientific:'Specie miste',kc:.55,rootDepth:.40,targetMoisture:50,source:'WUCOLS classe media',confidence:'C'}
];
function allPlants(){return [...PLANT_PROFILES,...state.customPlants]}
function plantById(id){return allPlants().find(p=>p.id===id)||PLANT_PROFILES[0]}
function plantSourceUrl(p){if((p.source||'').includes('FAO'))return 'https://www.fao.org/4/x0490e/x0490e0b.htm';if((p.source||'').includes('WUCOLS'))return 'https://wucols.ucdavis.edu/plant-search-database';return ''}

function allModels(){ return [...PRESET_MODELS, ...state.customModels.filter(m=>m.type!=='dripline')]; }
function getModel(id){ return allModels().find(m=>m.id===id); }
function allDriplineModels(){ return [...PRESET_DRIPLINES, ...state.customModels.filter(m=>m.type==='dripline')]; }
function getDriplineModel(id){ return allDriplineModels().find(m=>m.id===id); }

/* ============================================================
   PERSISTENCE
   ============================================================ */
async function saveState(){
  state.zones.forEach(zone=>{if(zone.areaAuto===true)zone.areaM2=Math.max(.1,Math.round(zoneCoverageStats(zone.id).areaM2*10)/10)});
  const nativeState=structuredClone(state);
  nativeState.zones.forEach(zone=>{zone.calculatedFlowLmin=zoneTotalFlow(zone.id)});
  const expected={zones:nativeState.zones.length,areas:nativeState.areas.length,sprinklers:nativeState.sprinklers.length,driplines:nativeState.driplines.length,decor:nativeState.decor.length};
  setSaveStatus('Salvataggio…','busy');
  saveChain=saveChain.then(async()=>{
    const result=await nativeCall('save',{state:nativeState});
    for(const [key,value] of Object.entries(expected)){
      if(result?.counts?.[key]!==value)throw new Error('Verifica salvataggio non riuscita: '+key);
    }
    if(result.warning){
      setSaveStatus('Progetto salvato · rev. '+result.revision+' — '+result.warning,'busy');
      toast(result.warning,'err');
    }else setSaveStatus('Salvato · rev. '+result.revision,'ok');
    return result;
  }).catch(error=>{
    console.error('IRRIGAZIONE SMART save failed',error);
    setSaveStatus('NON SALVATO — '+error.message,'err');
    toast('Errore salvataggio: '+error.message,'err');
  });
  return saveChain;
}
async function loadState(){
  try{
    const parsed = await nativeCall('get');
    if(parsed && parsed.state){
      nativeAutomation = Object.assign(nativeAutomation, parsed.automation||{});
      nativeLoadedRevision=Number(parsed.revision)||0;
      state = Object.assign(structuredClone(DEFAULT_STATE), parsed.state);
      // deep-merge nested defaults in case of older saved shape
      state.pump = Object.assign(structuredClone(DEFAULT_STATE.pump), parsed.state.pump||{});
      state.plot = Object.assign(structuredClone(DEFAULT_STATE.plot), parsed.state.plot||{});
      if(!parsed.state.plot && (state.areas.length||state.sprinklers.length||state.driplines.length||state.decor.length||state.sensors.length)) state.plot.configured=true;
      state.auto = Object.assign(structuredClone(DEFAULT_STATE.auto), parsed.state.auto||{});
      state.customPlants = parsed.state.customPlants||[]; state.waterLedger=parsed.state.waterLedger||[];
      state.manualSchedules = parsed.state.manualSchedules||{};
    }
  }catch(e){ /* no saved state yet */ }
}
let saveTimer=null, saveChain=Promise.resolve(), dirty3DTimer=null;
function setSaveStatus(text,kind=''){
  let badge=root.getElementById('nativeSaveStatus');
  if(!badge){badge=document.createElement('div');badge.id='nativeSaveStatus';root.appendChild(badge);}
  badge.className=kind;badge.textContent=text;
}
function queueSave(){
  clearTimeout(saveTimer);
  setSaveStatus('Modifiche da salvare…','busy');
  saveTimer=setTimeout(()=>{saveTimer=null;saveState();},10000);
  clearTimeout(dirty3DTimer);
  dirty3DTimer=setTimeout(()=>{dirty3D=true;},220);
}
window.addEventListener('pagehide',()=>{if(saveTimer){clearTimeout(saveTimer);saveTimer=null;saveState();}});

/* ============================================================
   BACKUP: esportazione/importazione della configurazione (.json)
   ============================================================
   Lo storage interno di Home Assistant resta la fonte primaria dei dati, ma
   avere anche un file portabile — sul modello di come floor3d-card/ha-floorplan
   tengono il proprio modello come file su disco (.obj/.svg), non solo in uno
   storage opaco — dà una rete di sicurezza indipendente e la possibilità di
   spostare la configurazione su un'altra istanza. */
root.getElementById('btnExportBackup').onclick = ()=>{
  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'irrigazione-smart-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup esportato','ok');
};
root.getElementById('btnImportBackup').onclick = ()=>{
  root.getElementById('importBackupFile').click();
};
root.getElementById('importBackupFile').onchange = async (e)=>{
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  if(!confirm('Importare questo file sostituirà TUTTA la configurazione attuale (mappa, zone, irrigatori, programmazione). Continuare?')) return;
  try{
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedState = parsed.state || parsed; // tollerante anche a un export "nudo" dello state
    if(!importedState || typeof importedState !== 'object') throw new Error('File non valido: manca lo stato della configurazione');
    state = Object.assign(structuredClone(DEFAULT_STATE), importedState);
    state.pump = Object.assign(structuredClone(DEFAULT_STATE.pump), importedState.pump||{});
    state.plot = Object.assign(structuredClone(DEFAULT_STATE.plot), importedState.plot||{});
    state.auto = Object.assign(structuredClone(DEFAULT_STATE.auto), importedState.auto||{});
    state.customPlants = importedState.customPlants||[];
    state.waterLedger = importedState.waterLedger||[];
    state.manualSchedules = importedState.manualSchedules||{};
    await saveState();
    updateScaleHint(); renderAutoDays(); bindAutoFields(); renderZones(); renderLegend();
    resizeCanvasToDisplay(); drawMap(); renderHomeDashboard();
    dirty3D = true; if(current3DContainer){ camera3DFramed=false; attach3D(current3DContainer); }
    toast('Backup importato e salvato su Home Assistant','ok');
  }catch(err){
    console.error('Import backup fallito', err);
    toast('Import fallito: '+err.message,'err');
  }
};

/* ============================================================
   TOASTS
   ============================================================ */
function toast(msg, kind=''){
  const wrap = root.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast '+kind;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.3s'; setTimeout(()=>el.remove(),300); }, 4200);
}

/* ============================================================
   HOME ASSISTANT API
   ============================================================ */
async function haTestAndLoad(){
  try{
    haEntities = await nativeCall('states');
    haConnected = true;
    pumpOn = !!(state.pump.relayEntity && ['on','open'].includes(haEntities.find(e=>e.entity_id===state.pump.relayEntity)?.state));
    activeZones.clear();
    state.zones.forEach(zone=>{
      if(zone.relayEntity && ['on','open'].includes(haEntities.find(e=>e.entity_id===zone.relayEntity)?.state))activeZones.add(zone.id);
    });
    updateHaStatus();
    populateEntityDropdowns();
    toast('Connesso a Home Assistant — '+haEntities.length+' entità caricate','ok');
  }catch(e){
    haConnected = false;
    updateHaStatus();
    toast('Connessione nativa HA fallita: '+e.message,'err');
  }
}
function updateHaStatus(){
  /* Il pannello è già autenticato da Home Assistant. Lo stato non viene
     mostrato come badge permanente: un errore del bridge resta visibile
     tramite toast e impedisce il caricamento delle entità. */
}
async function haCallService(domain, service, entity_id){
  return nativeCall('service',{domain,service,data:{entity_id}});
}
async function haGetState(entity_id){
  try{
    return await nativeCall('state',{entity_id});
  }catch(e){ return null; }
}
function entitiesByDomain(prefix){
  return haEntities.filter(e=>e.entity_id.startsWith(prefix+'.'));
}
function fillSelect(sel, list, current, placeholder){
  sel.innerHTML='';
  const optNone = document.createElement('option');
  optNone.value=''; optNone.textContent = placeholder || '— nessuna —';
  sel.appendChild(optNone);
  list.forEach(e=>{
    const o = document.createElement('option');
    o.value=e.entity_id;
    const name = (e.attributes && e.attributes.friendly_name) || e.entity_id;
    o.textContent = name+' ('+e.entity_id+')';
    sel.appendChild(o);
  });
  if(current) sel.value = current;
}
function populateEntityDropdowns(){
  const switches = [...entitiesByDomain('switch'), ...entitiesByDomain('input_boolean')];
  fillSelect(root.getElementById('pumpEntity'), switches, state.pump.relayEntity, '— seleziona relè pompa —');
  fillSelect(root.getElementById('pumpFlowSensor'), entitiesByDomain('sensor'), state.pump.flowSensorEntity, '— nessuno —');
  fillSelect(root.getElementById('autoWeatherEntity'), entitiesByDomain('weather'), state.auto.weatherEntity, '— seleziona entità meteo —');
  fillSelect(root.getElementById('autoRainSensor'), entitiesByDomain('binary_sensor'), state.auto.rainSensor, '— nessuno —');
  renderZones(); // zone relè dropdowns depend on entities too
}

/* ============================================================
   TABS
   ============================================================ */
root.getElementById('tabs').addEventListener('click', e=>{
  const btn = e.target.closest('.tab-btn');
  if(!btn) return;
  root.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  root.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  btn.classList.add('active');
  root.getElementById('view-'+btn.dataset.view).classList.add('active');
  if(btn.dataset.view==='controllo') renderManualControl();
  if(btn.dataset.view==='zone') renderZones();
  if(btn.dataset.view==='timer') renderTimer();
  if(btn.dataset.view==='db'){ renderModelTable(); renderDriplineModelTable(); renderPlantTable(); }
  if(btn.dataset.view==='log') renderPersistentLogs();
  if(btn.dataset.view==='mappa'){
    if(mode3D)requestAnimationFrame(()=>attach3D(root.getElementById('canvas3dWrap')));
    else requestAnimationFrame(resizeCanvasToDisplay);
  }
});

/* ============================================================
   MAP EDITOR
   ============================================================ */
const canvas = root.getElementById('mapCanvas');
const editorCtx2D = canvas.getContext('2d');
const ctx = editorCtx2D;
let tool = 'select';
let dragging = null; // {kind:'sprinkler'|'sensor'|'area'|'dripline'|'decor', id, idx}
let drawingArea = null; // {points:[[x,y]]}
let drawingLine = null; // {points:[[x,y]]} for dripline
let calibratePts = [];
let selected = null; // {kind,id}
let mapHoverPoint = null;
let view2D = {zoom:1,panX:0,panY:0};
const RULER_LEFT=42, RULER_BOTTOM=30;

function resizeCanvasToDisplay(){
  const wrap = canvas.parentElement;
  const w = wrap.clientWidth;
  // Home Assistant mantiene la schermata Gestione nel DOM con display:none.
  // Non ridimensionare mai il canvas con la larghezza fittizia 0 del pannello
  // nascosto: quella dimensione altererebbe la scala fisica del progetto.
  if(!wrap.getClientRects().length||w<RULER_LEFT+200)return false;
  canvas.width = w;
  const ratio=(state.plot&&state.plot.widthM>0)?state.plot.heightM/state.plot.widthM:0.62;
  canvas.height = Math.round((w-RULER_LEFT)*ratio+RULER_BOTTOM);
  drawMap();
  return true;
}
window.addEventListener('resize', resizeCanvasToDisplay);

root.querySelectorAll('.map-toolbar [data-tool]').forEach(b=>{
  b.addEventListener('click', ()=>{
    if(b.dataset.tool!=='select' && !state.plot.configured){ toast('Prima imposta le dimensioni reali dell’appezzamento e premi “Applica dimensioni”.','err'); root.getElementById('plotWidthM').focus(); return; }
    if(['sprinkler','dripline'].includes(b.dataset.tool) && state.zones.length===0){
      toast('Crea prima almeno una zona irrigazione.','err');
      root.querySelector('.tab-btn[data-view="zone"]').click();
      return;
    }
    root.querySelectorAll('.map-toolbar [data-tool]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    tool = b.dataset.tool;
    drawingArea = null; drawingLine = null; calibratePts=[];
    const help = {
      select:'Modalità selezione: trascina un elemento per spostarlo, clicca per selezionarlo e modificarne i parametri nel pannello a destra.',
      pan:'Sposta vista: trascina la tavola; usa la rotellina o i pulsanti −/＋ per lo zoom. Il disegno resta invariato.',
      area:'Disegna area: clicca per aggiungere vertici del perimetro, doppio click per chiudere. Poi scegli il tipo (prato, ghiaia, terra, aiuola) nel pannello a destra.',
      sprinkler:"Aggiungi irrigatore: clicca sulla mappa nel punto dove si trova (o si troverà) l'irrigatore.",
      dripline:'Tubo gocciolante: clicca per aggiungere i punti del percorso del tubo, doppio click per terminare la linea.',
      vegetazione:"Aggiungi albero/siepe/pianta: clicca sulla mappa, poi scegli il tipo nel pannello a destra (solo decorativo, non collegato a irrigazione).",
      sensor:"Aggiungi sensore: clicca sulla mappa dove è posizionata la centralina/sonda, poi collegala a un'entità HA.",
      calibrate:'Calibra scala: clicca due punti di cui conosci la distanza reale (es. lungo un muro), poi inserisci la lunghezza in metri.'
    };
    root.getElementById('toolHelp').textContent = help[tool];
    drawMap();
  });
});

function canvasPos(evt){
  const rect = canvas.getBoundingClientRect();
  const cx = (evt.touches? evt.touches[0].clientX : evt.clientX) - rect.left;
  const cy = (evt.touches? evt.touches[0].clientY : evt.clientY) - rect.top;
  const sx=cx*(canvas.width/rect.width),sy=cy*(canvas.height/rect.height);
  const x=RULER_LEFT+(sx-RULER_LEFT-view2D.panX)/view2D.zoom;
  const y=(sy-view2D.panY)/view2D.zoom;
  return [Math.max(RULER_LEFT,Math.min(canvas.width,x)), Math.max(0,Math.min(canvas.height-RULER_BOTTOM,y))];
}
function setZoom2D(nextZoom,screenX=(RULER_LEFT+canvas.width)/2,screenY=(canvas.height-RULER_BOTTOM)/2){
  const old=view2D.zoom,next=Math.max(.5,Math.min(5,nextZoom));
  const modelX=RULER_LEFT+(screenX-RULER_LEFT-view2D.panX)/old,modelY=(screenY-view2D.panY)/old;
  view2D.zoom=next;view2D.panX=screenX-RULER_LEFT-(modelX-RULER_LEFT)*next;view2D.panY=screenY-modelY*next;
  root.getElementById('btnZoomReset2D').textContent=Math.round(next*100)+'%';drawMap();
}
root.getElementById('btnZoomIn2D').onclick=()=>setZoom2D(view2D.zoom*1.25);
root.getElementById('btnZoomOut2D').onclick=()=>setZoom2D(view2D.zoom/1.25);
root.getElementById('btnZoomReset2D').onclick=()=>{view2D={zoom:1,panX:0,panY:0};root.getElementById('btnZoomReset2D').textContent='100%';drawMap()};
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),sx=(e.clientX-r.left)*canvas.width/r.width,sy=(e.clientY-r.top)*canvas.height/r.height;setZoom2D(view2D.zoom*(e.deltaY<0?1.15:1/1.15),sx,sy)},{passive:false});
function applyPlotSize(){
  const widthM=parseFloat(root.getElementById('plotWidthM').value), heightM=parseFloat(root.getElementById('plotHeightM').value), rulerStepM=parseFloat(root.getElementById('rulerStepM').value);
  if(!(widthM>0&&heightM>0&&rulerStepM>0)){ toast('Inserisci dimensioni e passo righello validi','err'); return; }
  const oldMpp=Number(state.metersPerPixel)||.05,contentWidth=Math.max(1,canvas.width-RULER_LEFT),newMpp=widthM/contentWidth;
  if(state.plot.configured&&Number.isFinite(newMpp)&&newMpp>0){
    const factor=oldMpp/newMpp,point=([x,y])=>[RULER_LEFT+(x-RULER_LEFT)*factor,y*factor];
    state.areas.forEach(area=>area.points=area.points.map(point));
    state.driplines.forEach(line=>line.points=line.points.map(point));
    [...state.sprinklers,...state.decor,...state.sensors].forEach(item=>{const p=point([item.x,item.y]);item.x=p[0];item.y=p[1];});
    state.metersPerPixel=newMpp;
  }
  state.plot={widthM,heightM,rulerStepM,configured:true};
  root.getElementById('plotSetup').style.display='none';
  resizeCanvasToDisplay(); updateScaleHint();dirty3D=true;camera3DFramed=false;queueSave();toast('Appezzamento aggiornato senza ridimensionare gli oggetti','ok');
}
root.getElementById('btnApplyPlotSize').onclick=applyPlotSize;
root.getElementById('btnEditPlot').onclick=()=>{
  const panel=root.getElementById('plotSetup');
  panel.style.display=panel.style.display==='none'?'grid':'none';
  if(panel.style.display!=='none')root.getElementById('plotWidthM').focus();
};

function hitTestSprinkler(x,y){
  for(let i=state.sprinklers.length-1;i>=0;i--){
    const s = state.sprinklers[i];
    if(Math.hypot(s.x-x,s.y-y) < 12) return s;
  }
  return null;
}
function hitTestSensor(x,y){
  for(let i=state.sensors.length-1;i>=0;i--){
    const s = state.sensors[i];
    if(Math.hypot(s.x-x,s.y-y) < 12) return s;
  }
  return null;
}
function hitTestArea(x,y){
  for(let i=state.areas.length-1;i>=0;i--){
    const a = state.areas[i];
    if(pointInPolygon([x,y], a.points)) return a;
  }
  return null;
}
function distToSegment(p,a,b){
  const A=p[0]-a[0], B=p[1]-a[1], C=b[0]-a[0], D=b[1]-a[1];
  const dot=A*C+B*D, lenSq=C*C+D*D;
  let t = lenSq!==0 ? dot/lenSq : -1;
  t = Math.max(0, Math.min(1, t));
  const xx=a[0]+t*C, yy=a[1]+t*D;
  return Math.hypot(p[0]-xx, p[1]-yy);
}
function hitTestDripline(x,y){
  for(let i=state.driplines.length-1;i>=0;i--){
    const dl = state.driplines[i];
    for(let j=1;j<dl.points.length;j++){
      if(distToSegment([x,y], dl.points[j-1], dl.points[j]) < 10) return dl;
    }
  }
  return null;
}
function hitTestDecor(x,y){
  for(let i=state.decor.length-1;i>=0;i--){
    const d = state.decor[i];
    if(Math.hypot(d.x-x,d.y-y) < 14) return d;
  }
  return null;
}
function pointInPolygon(pt, poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
    const intersect = ((yi>pt[1])!==(yj>pt[1])) && (pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi)+xi);
    if(intersect) inside=!inside;
  }
  return inside;
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
canvas.addEventListener('dblclick', onDblClick);

function onDown(evt){
  if(tool==='pan'){
    const r=canvas.getBoundingClientRect();dragging={kind:'viewpan',clientX:evt.clientX,clientY:evt.clientY,scaleX:canvas.width/r.width,scaleY:canvas.height/r.height};canvas.style.cursor='grabbing';return;
  }
  const [x,y] = canvasPos(evt);
  if(tool==='select'){
    const sp = hitTestSprinkler(x,y);
    if(sp){ dragging={kind:'sprinkler',id:sp.id}; selectItem('sprinkler', sp.id); return; }
    const se = hitTestSensor(x,y);
    if(se){ dragging={kind:'sensor',id:se.id}; selectItem('sensor', se.id); return; }
    const dc = hitTestDecor(x,y);
    if(dc){ dragging={kind:'decor',id:dc.id}; selectItem('decor', dc.id); return; }
    const dl = hitTestDripline(x,y);
    if(dl){ selectItem('dripline', dl.id); dragging={kind:'dripline',id:dl.id,startX:x,startY:y}; return; }
    const ar = hitTestArea(x,y);
    if(ar){ selectItem('area', ar.id); dragging={kind:'area',id:ar.id,startX:x,startY:y}; return; }
    selectItem(null,null);
  } else if(tool==='sprinkler'){
    if(state.zones.length===0){toast('Crea prima almeno una zona irrigazione.','err');return;}
    const s = {id:uid(), x,y, brand:'rb5000', modelId:'rb5000', nozzleId:'3.0', type:'rotor', scaleWithArc:false,
               radiusM:10.7, angleStart:0, angleEnd:360, rotation:0, zoneId: state.zones[0]?state.zones[0].id:'', name:'Irrigatore '+(state.sprinklers.length+1),
               numEmitters:1, flowPerEmitterLh:4};
    state.sprinklers.push(s);
    selectItem('sprinkler', s.id);
    queueSave(); drawMap(); renderZones();
  } else if(tool==='sensor'){
    const s = {id:uid(), x,y, kind:'meteo', name:'Sensore '+(state.sensors.length+1), entityId:'', affectsZoneId:''};
    state.sensors.push(s);
    selectItem('sensor', s.id);
    queueSave(); drawMap();
  } else if(tool==='vegetazione'){
    const d = {id:uid(), x,y, kind:'albero', size:1, name:'Albero '+(state.decor.length+1)};
    state.decor.push(d);
    selectItem('decor', d.id);
    queueSave(); drawMap();
  } else if(tool==='area'){
    if(!drawingArea) drawingArea = {points:[]};
    drawingArea.points.push([x,y]);
    drawMap();
  } else if(tool==='dripline'){
    if(state.zones.length===0){toast('Crea prima almeno una zona irrigazione.','err');return;}
    if(!drawingLine) drawingLine = {points:[]};
    drawingLine.points.push([x,y]);
    drawMap();
  } else if(tool==='calibrate'){
    calibratePts.push([x,y]);
    if(calibratePts.length===2){
      const pxDist = Math.hypot(calibratePts[1][0]-calibratePts[0][0], calibratePts[1][1]-calibratePts[0][1]);
      const real = prompt('Distanza reale tra i due punti (in metri):','10');
      const realM = parseFloat(real);
      if(realM && realM>0 && pxDist>2){
        state.metersPerPixel = realM/pxDist;
        updateScaleHint();
        toast('Scala impostata: 1 px ≈ '+state.metersPerPixel.toFixed(3)+' m','ok');
        queueSave();
      }
      calibratePts=[];
    }
    drawMap();
  }
}
function onMove(evt){
  if(dragging?.kind==='viewpan'){
    view2D.panX+=(evt.clientX-dragging.clientX)*dragging.scaleX;view2D.panY+=(evt.clientY-dragging.clientY)*dragging.scaleY;dragging.clientX=evt.clientX;dragging.clientY=evt.clientY;drawMap();return;
  }
  mapHoverPoint=canvasPos(evt);
  if(!dragging) {
    if(tool==='area'&&drawingArea){ drawMap(true, mapHoverPoint); }
    if(tool==='dripline'&&drawingLine){ drawMap(false, mapHoverPoint, true); }
    return;
  }
  const [x,y] = canvasPos(evt);
  if(dragging.kind==='sprinkler'){
    const s = state.sprinklers.find(s=>s.id===dragging.id); s.x=x; s.y=y;
  } else if(dragging.kind==='sensor'){
    const s = state.sensors.find(s=>s.id===dragging.id); s.x=x; s.y=y;
  } else if(dragging.kind==='decor'){
    const d = state.decor.find(d=>d.id===dragging.id); d.x=x; d.y=y;
  } else if(dragging.kind==='area'){
    const a = state.areas.find(a=>a.id===dragging.id);
    const dx = x-dragging.startX, dy = y-dragging.startY;
    a.points = a.points.map(p=>[p[0]+dx,p[1]+dy]);
    dragging.startX=x; dragging.startY=y;
  } else if(dragging.kind==='dripline'){
    const dl = state.driplines.find(d=>d.id===dragging.id);
    const dx = x-dragging.startX, dy = y-dragging.startY;
    dl.points = dl.points.map(p=>[p[0]+dx,p[1]+dy]);
    dragging.startX=x; dragging.startY=y;
  }
  drawMap();
  if(['sprinkler','dripline'].includes(dragging.kind))scheduleCoverageRefresh();
}
function onUp(){ if(dragging&&dragging.kind!=='viewpan'){ queueSave(); renderZones(); } dragging=null;canvas.style.cursor=tool==='pan'?'grab':'crosshair'; }
function onDblClick(){
  if(tool==='area' && drawingArea && drawingArea.points.length>=3){
    const points=drawingArea.points.filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>2);
    if(points.length<3) return;
    const a = {id:uid(), name:'Area '+(state.areas.length+1), type:'prato', color: '', points};
    state.areas.push(a);
    drawingArea=null;
    selectItem('area', a.id);
    queueSave(); drawMap();
  } else if(tool==='dripline' && drawingLine && drawingLine.points.length>=2){
    const points=drawingLine.points.filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>2);
    if(points.length<2) return;
    const dl = {id:uid(), name:'Tubo gocciolante '+(state.driplines.length+1),
      points, modelId:'gardena-drip16', variantId:'1,6 l/h @ 30 cm',
      zoneId: state.zones[0]?state.zones[0].id:'', wettedWidthM:0.6};
    state.driplines.push(dl);
    drawingLine=null;
    selectItem('dripline', dl.id);
    queueSave(); drawMap(); renderZones();
  }
}

function selectItem(kind,id){
  selected = kind? {kind,id} : null;
  renderInspector();
  drawMap();
}

function updateScaleHint(){
  // metersPerPixel è parte del progetto salvato. Può essere ricalcolato solo
  // mentre l'editor è realmente visibile e possiede una larghezza attendibile.
  const visible=canvas.getClientRects().length>0&&canvas.clientWidth>=RULER_LEFT+200&&canvas.width>=RULER_LEFT+200;
  if(visible)state.metersPerPixel=(state.plot.widthM||50)/(canvas.width-RULER_LEFT);
  if(!Number.isFinite(state.metersPerPixel)||state.metersPerPixel<=0)state.metersPerPixel=.05;
  root.getElementById('mapHint').textContent = 'Tavola: '+state.plot.widthM+' × '+state.plot.heightM+' m · 1 px ≈ '+state.metersPerPixel.toFixed(3)+' m';
}

/* ---------- flow physics helpers ---------- */
function sprinklerModelInfo(sp){
  const m = getModel(sp.modelId);
  const nz = m ? m.nozzles.find(n=>n.id===sp.nozzleId) : null;
  return {model:m, nozzle:nz};
}
function computeSprinklerFlowLmin(sp, zonePressureBar){
  if(sp.type==='drip'){
    return (sp.numEmitters||0) * (sp.flowPerEmitterLh||0) / 60;
  }
  const {model, nozzle} = sprinklerModelInfo(sp);
  if(!nozzle) return 0;
  const P = zonePressureBar || nozzle.pressureBar;
  let flow360 = nozzle.flow360 * Math.sqrt(Math.max(P,0.1)/nozzle.pressureBar);
  const arcSpan = Math.max(0, Math.min(360, sp.angleEnd - sp.angleStart));
  const scaleWithArc = model ? model.scaleWithArc : sp.scaleWithArc;
  return scaleWithArc ? flow360*(arcSpan/360) : flow360;
}
function computeSprinklerRadiusM(sp, zonePressureBar){
  const {nozzle} = sprinklerModelInfo(sp);
  if(!nozzle) return sp.radiusM||3;
  const P = zonePressureBar || nozzle.pressureBar;
  return nozzle.radiusM * Math.pow(Math.max(P,0.1)/nozzle.pressureBar, 0.25);
}
function polylineLengthPx(points){
  let len=0;
  for(let i=1;i<points.length;i++) len += Math.hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]);
  return len;
}
function driplineInfo(dl){
  const m = getDriplineModel(dl.modelId);
  const v = m ? m.variants.find(x=>x.id===dl.variantId) : null;
  return {model:m, variant:v};
}
function computeDriplineLengthM(dl){
  return polylineLengthPx(dl.points) * state.metersPerPixel;
}
function computeDriplineFlowLmin(dl){
  const {variant} = driplineInfo(dl);
  if(!variant) return 0;
  const lengthM = computeDriplineLengthM(dl);
  return (lengthM * variant.flowPerMeterLh) / 60;
}
function zoneById(id){ return state.zones.find(z=>z.id===id); }
function zoneTotalFlow(zoneId){
  const zone = zoneById(zoneId);
  const p = zone ? zone.pressureBar : 3;
  const sprinklerFlow = state.sprinklers.filter(s=>s.zoneId===zoneId)
    .reduce((sum,s)=>sum+computeSprinklerFlowLmin(s,p),0);
  const driplineFlow = state.driplines.filter(d=>d.zoneId===zoneId)
    .reduce((sum,d)=>sum+computeDriplineFlowLmin(d),0);
  return sprinklerFlow + driplineFlow;
}

/* Stima metrica della superficie realmente bagnata. Usa un campionamento
   dell'unione geometrica: le sovrapposizioni tra archi e fasce gocciolanti
   vengono contate una sola volta e la copertura resta dentro le aree irrigabili
   disegnate, quando presenti. */
function pointInSprinklerCoverage(x,y,sp,pressureBar){
  if(sp.type==='drip')return Math.hypot(x-sp.x,y-sp.y)*state.metersPerPixel<=0.35;
  const radiusPx=computeSprinklerRadiusM(sp,pressureBar)/state.metersPerPixel;
  if(Math.hypot(x-sp.x,y-sp.y)>radiusPx)return false;
  const span=Math.max(0,Math.min(360,(sp.angleEnd??360)-(sp.angleStart??0)));
  if(span>=359.9)return true;
  let local=(Math.atan2(y-sp.y,x-sp.x)*180/Math.PI+90-(sp.rotation||0)+720)%360;
  const start=((sp.angleStart||0)%360+360)%360;
  return local>=start && local<=start+span;
}
function pointInDripCoverage(x,y,dl){
  const halfWidth=Math.max(.05,Number(dl.wettedWidthM)||.6)/2/state.metersPerPixel;
  for(let i=1;i<dl.points.length;i++)if(distToSegment([x,y],dl.points[i-1],dl.points[i])<=halfWidth)return true;
  return false;
}
function zoneCoverageStats(zoneId){
  updateScaleHint();
  const zone=zoneById(zoneId), sprinklers=state.sprinklers.filter(s=>s.zoneId===zoneId), lines=state.driplines.filter(d=>d.zoneId===zoneId);
  const irrigable=state.areas.filter(a=>['prato','terra','aiuola'].includes(a.type)&&a.points.length>=3);
  const plotArea=Math.max(1,(state.plot.widthM||50)*(state.plot.heightM||31));
  const stepM=Math.max(.18,Math.sqrt(plotArea/50000));
  const stepPx=stepM/state.metersPerPixel;
  let cells=0;
  for(let y=stepPx/2;y<canvas.height-RULER_BOTTOM;y+=stepPx){
    for(let x=RULER_LEFT+stepPx/2;x<canvas.width;x+=stepPx){
      if(irrigable.length && !irrigable.some(a=>pointInPolygon([x,y],a.points)))continue;
      if(sprinklers.some(sp=>pointInSprinklerCoverage(x,y,sp,zone?.pressureBar)) || lines.some(dl=>pointInDripCoverage(x,y,dl)))cells++;
    }
  }
  const lineLengthM=lines.reduce((sum,line)=>sum+computeDriplineLengthM(line),0);
  const dripFlowLh=lines.reduce((sum,line)=>sum+computeDriplineFlowLmin(line)*60,0);
  return {areaM2:cells*stepM*stepM,lineLengthM,dripFlowLh,sprinklers:sprinklers.length,lines:lines.length};
}
let coverageRefreshTimer=null;
function refreshAutomaticZoneAreas(){
  state.zones.forEach(z=>{
    if(z.areaAuto===true)z.areaM2=Math.max(.1,Math.round(zoneCoverageStats(z.id).areaM2*10)/10);
  });
  renderZones();
  renderHomeDashboard();
}
function scheduleCoverageRefresh(){
  clearTimeout(coverageRefreshTimer);
  coverageRefreshTimer=setTimeout(refreshAutomaticZoneAreas,120);
}
/* Le aree (prato/ghiaia/terra/aiuola) sono puramente grafiche: non hanno una zona assegnata.
   Questa funzione è solo informativa — mostra in quali aree disegnate ricadono spazialmente
   gli irrigatori/tubi di una zona, calcolato in base alla posizione sulla mappa. */
function zoneContainingAreas(zoneId){
  const names = new Set();
  state.sprinklers.filter(s=>s.zoneId===zoneId).forEach(s=>{
    state.areas.forEach(a=>{ if(pointInPolygon([s.x,s.y], a.points)) names.add(a.name); });
  });
  state.driplines.filter(d=>d.zoneId===zoneId).forEach(dl=>{
    dl.points.forEach(p=>{
      state.areas.forEach(a=>{ if(pointInPolygon(p, a.points)) names.add(a.name); });
    });
  });
  return [...names];
}

/* ---------- drawing ---------- */
const AREA_TYPE_FILL = {
  prato:   {base:'#6ec178', line:'#4c8a52'},
  ghiaia:  {base:'#c7cac2', line:'#8b9088'},
  terra:   {base:'#8a6440', line:'#5c4229'},
  aiuola:  {base:'#a2c96b', line:'#7a5636'},
};
const DECOR_ICON = {albero:'🌳', siepe:'🌿', cespuglio:'🪴', pianta:'🌱'};
function drawElasticMeasure(a,b,color){
  const meters=Math.hypot(b[0]-a[0],b[1]-a[1])*state.metersPerPixel, label=meters.toFixed(meters<10?2:1)+' m', mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
  ctx.save();ctx.font='bold 12px Inter';const tw=ctx.measureText(label).width;ctx.fillStyle='#081510e8';ctx.strokeStyle=color;ctx.beginPath();ctx.roundRect(mx-tw/2-7,my-22,tw+14,20,6);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(label,mx,my-8);ctx.restore();
}
function drawMetricRulers(){
  const w=canvas.width,h=canvas.height,step=state.plot.rulerStepM||5;ctx.save();ctx.fillStyle='#0b1714e8';ctx.fillRect(0,0,RULER_LEFT,h);ctx.fillRect(0,h-RULER_BOTTOM,w,RULER_BOTTOM);ctx.strokeStyle='#668176';ctx.fillStyle='#b7c9c1';ctx.font='10px Inter';
  for(let m=0;m<=state.plot.widthM+.001;m+=step){const base=RULER_LEFT+(m/state.plot.widthM)*(w-RULER_LEFT),x=RULER_LEFT+view2D.panX+(base-RULER_LEFT)*view2D.zoom;if(x<RULER_LEFT||x>w)continue;ctx.beginPath();ctx.moveTo(x,h-RULER_BOTTOM);ctx.lineTo(x,h-RULER_BOTTOM+7);ctx.stroke();ctx.textAlign='center';ctx.fillText(m+' m',x,h-7)}
  for(let m=0;m<=state.plot.heightM+.001;m+=step){const base=(m/state.plot.heightM)*(h-RULER_BOTTOM),y=view2D.panY+base*view2D.zoom;if(y<0||y>h-RULER_BOTTOM)continue;ctx.beginPath();ctx.moveTo(RULER_LEFT-7,y);ctx.lineTo(RULER_LEFT,y);ctx.stroke();ctx.save();ctx.translate(12,y);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText(m+' m',0,3);ctx.restore()}ctx.strokeStyle='#8aa299';ctx.strokeRect(RULER_LEFT,0,w-RULER_LEFT,h-RULER_BOTTOM);ctx.restore();
}

function drawDecor2D(d,isSelected){
  const r=10+(d.size||1)*5;
  ctx.save();ctx.translate(d.x,d.y);ctx.shadowColor='#0008';ctx.shadowBlur=7;ctx.shadowOffsetY=3;
  if(d.kind==='albero'){
    const trunk=ctx.createLinearGradient(-4,0,4,0);trunk.addColorStop(0,'#4a2c19');trunk.addColorStop(.5,'#98633b');trunk.addColorStop(1,'#3a2417');ctx.fillStyle=trunk;ctx.beginPath();ctx.roundRect(-3,r*.05,6,r*.95,3);ctx.fill();
    const clusters=[[-.48,-.2,.58,'#235f35'],[.46,-.25,.62,'#2d7640'],[-.05,-.62,.72,'#3d9650'],[-.12,-.12,.65,'#347f45']];
    clusters.forEach(([x,y,s,c])=>{const g=ctx.createRadialGradient(x*r-r*.15,y*r-r*.18,1,x*r,y*r,s*r);g.addColorStop(0,'#8bd36e');g.addColorStop(.35,c);g.addColorStop(1,'#123f29');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x*r,y*r,s*r,0,Math.PI*2);ctx.fill()});
  }else if(d.kind==='siepe'){
    for(let i=-2;i<=2;i++){const x=i*r*.42,g=ctx.createRadialGradient(x-r*.1,-r*.15,1,x,0,r*.55);g.addColorStop(0,'#78c866');g.addColorStop(.45,i%2?'#347f43':'#286b39');g.addColorStop(1,'#164b2c');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,0,r*.58,0,Math.PI*2);ctx.fill()}
  }else if(d.kind==='cespuglio'){
    [[-.38,.05,.58],[.38,.08,.55],[0,-.28,.68]].forEach(([x,y,s],i)=>{const g=ctx.createRadialGradient(x*r-r*.1,y*r-r*.1,1,x*r,y*r,s*r);g.addColorStop(0,'#9adc78');g.addColorStop(.5,i?'#397f43':'#438f4b');g.addColorStop(1,'#194c2c');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x*r,y*r,s*r,0,7);ctx.fill()});
  }else{
    ctx.strokeStyle='#347845';ctx.lineWidth=2;for(let i=0;i<7;i++){const a=i/7*Math.PI*2-Math.PI/2;ctx.beginPath();ctx.moveTo(0,r*.3);ctx.quadraticCurveTo(Math.cos(a)*r*.35,Math.sin(a)*r*.25,Math.cos(a)*r*.7,Math.sin(a)*r*.7);ctx.stroke();ctx.fillStyle=i%2?'#74c65d':'#4ca252';ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.7,Math.sin(a)*r*.7,r*.28,r*.12,a,0,7);ctx.fill()}ctx.fillStyle='#e3b84d';ctx.beginPath();ctx.arc(0,-r*.1,r*.16,0,7);ctx.fill();
  }
  ctx.shadowColor='transparent';if(isSelected){ctx.beginPath();ctx.arc(0,0,r*1.35,0,7);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([])}ctx.restore();
}

function polygonAreaM2(points){
  if(!points||points.length<3)return 0;let sum=0;
  for(let i=0,j=points.length-1;i<points.length;j=i++)sum+=points[j][0]*points[i][1]-points[i][0]*points[j][1];
  return Math.abs(sum)/2*state.metersPerPixel*state.metersPerPixel;
}

function drawMap(previewArea, previewPt, previewLine){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  updateScaleHint();
  if(!previewPt&&(drawingArea||drawingLine))previewPt=mapHoverPoint;
  if(drawingLine)previewLine=true;
  ctx.save();
  ctx.beginPath();ctx.rect(RULER_LEFT,0,canvas.width-RULER_LEFT,canvas.height-RULER_BOTTOM);ctx.clip();
  ctx.translate(RULER_LEFT+view2D.panX,view2D.panY);ctx.scale(view2D.zoom,view2D.zoom);ctx.translate(-RULER_LEFT,0);
  // grid
  ctx.save();
  const gridPx = Math.max(10, (state.plot.rulerStepM||5)/state.metersPerPixel);
  ctx.strokeStyle = '#ffffff08';
  ctx.lineWidth=1;
  for(let x=0;x<canvas.width;x+=gridPx){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke(); }
  for(let y=0;y<canvas.height;y+=gridPx){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke(); }
  ctx.restore();

  // areas — texture in base al tipo (prato/ghiaia/terra/aiuola)
  state.areas.forEach(a=>{
    const style = AREA_TYPE_FILL[a.type] || AREA_TYPE_FILL.prato;
    const fillColor = a.color || style.base;
    ctx.beginPath();
    a.points.forEach(([x,y],i)=> i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = fillColor+'38';
    ctx.fill();
    // texture stipple/hatch per tipo
    const bx0=Math.min(...a.points.map(p=>p[0])), bx1=Math.max(...a.points.map(p=>p[0]));
    const by0=Math.min(...a.points.map(p=>p[1])), by1=Math.max(...a.points.map(p=>p[1]));
    if(a.type==='ghiaia'){
      ctx.fillStyle=fillColor+'55';
      for(let gx=bx0; gx<bx1; gx+=7) for(let gy=by0; gy<by1; gy+=7){
        if(((gx*13+gy*7)%17)<5) ctx.fillRect(gx+((gy/7)%2)*3, gy, 1.6, 1.6);
      }
    } else if(a.type==='terra'){
      ctx.strokeStyle=fillColor+'40'; ctx.lineWidth=1;
      for(let gy=by0; gy<by1; gy+=6){ ctx.beginPath(); ctx.moveTo(bx0,gy); ctx.lineTo(bx1,gy); ctx.stroke(); }
    } else if(a.type==='prato'){
      ctx.strokeStyle=fillColor+'38'; ctx.lineWidth=1;
      for(let gx=bx0;gx<bx1;gx+=9) for(let gy=by0;gy<by1;gy+=9){ctx.beginPath();ctx.moveTo(gx-2,gy+2);ctx.quadraticCurveTo(gx,gy-3,gx+2,gy+2);ctx.stroke();}
    } else if(a.type==='aiuola'){
      ctx.fillStyle='#e0a83a30';
      for(let gx=bx0; gx<bx1; gx+=16) for(let gy=by0; gy<by1; gy+=16){
        if(((gx*3+gy*5)%23)<4) ctx.beginPath(), ctx.arc(gx,gy,2,0,7), ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = selected&&selected.kind==='area'&&selected.id===a.id ? '#ffffff' : style.line;
    ctx.lineWidth = selected&&selected.kind==='area'&&selected.id===a.id ? 2.5 : 1.5;
    ctx.stroke();
    const cx = a.points.reduce((s,p)=>s+p[0],0)/a.points.length;
    const cy = a.points.reduce((s,p)=>s+p[1],0)/a.points.length;
    ctx.fillStyle='#e9f2eecc'; ctx.font='11px Inter'; ctx.textAlign='center';
    ctx.fillText(a.name, cx, cy-2);
    ctx.fillStyle='#b9d8c9';ctx.font='bold 10px Inter';ctx.fillText(polygonAreaM2(a.points).toFixed(1)+' m²',cx,cy+12);
  });

  // drawing-in-progress area
  if(drawingArea && drawingArea.points.length){
    ctx.beginPath();
    drawingArea.points.forEach(([x,y],i)=> i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
    if(previewPt) ctx.lineTo(previewPt[0],previewPt[1]);
    ctx.strokeStyle='#cbb27a'; ctx.setLineDash([5,4]); ctx.lineWidth=1.5; ctx.stroke(); ctx.setLineDash([]);
    drawingArea.points.forEach(([x,y])=>{ ctx.beginPath(); ctx.arc(x,y,3,0,7); ctx.fillStyle='#cbb27a'; ctx.fill(); });
    if(previewPt) drawElasticMeasure(drawingArea.points[drawingArea.points.length-1],previewPt,'#cbb27a');
  }

  // driplines (tubo gocciolante) — linea tratteggiata con tacche gocciolatore
  state.driplines.forEach(dl=>{
    const zone = zoneById(dl.zoneId);
    const color = zone ? zone.color : '#e0a83a';
    const isSel = selected&&selected.kind==='dripline'&&selected.id===dl.id;
    ctx.beginPath();
    dl.points.forEach(([x,y],i)=> i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
    ctx.strokeStyle = isSel? '#ffffff' : color;
    ctx.lineWidth = isSel? 4 : 3;
    ctx.setLineDash([2,5]); ctx.lineCap='round';
    ctx.stroke(); ctx.setLineDash([]);
    // tacche gocciolatore ortogonali lungo il percorso
    for(let i=1;i<dl.points.length;i++){
      const [x1,y1]=dl.points[i-1], [x2,y2]=dl.points[i];
      const segLen = Math.hypot(x2-x1,y2-y1);
      const nx=-(y2-y1)/segLen, ny=(x2-x1)/segLen;
      for(let d=6; d<segLen; d+=12){
        const t=d/segLen, px=x1+(x2-x1)*t, py=y1+(y2-y1)*t;
        ctx.beginPath(); ctx.moveTo(px-nx*3,py-ny*3); ctx.lineTo(px+nx*3,py+ny*3);
        ctx.strokeStyle=color+'99'; ctx.lineWidth=1; ctx.stroke();
      }
    }
    const mid = dl.points[Math.floor(dl.points.length/2)];
    ctx.fillStyle='#e9f2eecc'; ctx.font='10px Inter'; ctx.textAlign='center';
    ctx.fillText(dl.name, mid[0], mid[1]-8);
  });
  if(drawingLine && drawingLine.points.length){
    ctx.beginPath();
    drawingLine.points.forEach(([x,y],i)=> i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
    if(previewLine && previewPt) ctx.lineTo(previewPt[0],previewPt[1]);
    ctx.strokeStyle='#e0a83a'; ctx.setLineDash([2,5]); ctx.lineWidth=2.5; ctx.stroke(); ctx.setLineDash([]);
    drawingLine.points.forEach(([x,y])=>{ ctx.beginPath(); ctx.arc(x,y,3,0,7); ctx.fillStyle='#e0a83a'; ctx.fill(); });
    if(previewPt) drawElasticMeasure(drawingLine.points[drawingLine.points.length-1],previewPt,'#e0a83a');
  }

  // sprinklers (coverage arc + icon)
  state.sprinklers.forEach(sp=>{
    const zone = zoneById(sp.zoneId);
    const color = zone ? zone.color : '#8fa79c';
    const rM = computeSprinklerRadiusM(sp, zone?zone.pressureBar:null);
    const rPx = sp.type==='drip' ? 16 : Math.max(6, rM/state.metersPerPixel);
    if(sp.type!=='drip'){
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      const a0 = (sp.rotation+sp.angleStart-90)*Math.PI/180;
      const a1 = (sp.rotation+sp.angleEnd-90)*Math.PI/180;
      ctx.arc(sp.x, sp.y, rPx, a0, a1);
      ctx.closePath();
      ctx.fillStyle = color+'2e';
      ctx.fill();
      ctx.strokeStyle = color+'99';
      ctx.lineWidth=1;
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(sp.x,sp.y,rPx,0,7); ctx.fillStyle=color+'22'; ctx.fill(); ctx.strokeStyle=color+'88'; ctx.stroke();
    }
    // icon dot
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, selected&&selected.kind==='sprinkler'&&selected.id===sp.id?7:5, 0, 7);
    ctx.fillStyle = color;
    ctx.fill();
    if(selected&&selected.kind==='sprinkler'&&selected.id===sp.id){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); }
    ctx.fillStyle='#e9f2eecc'; ctx.font='10px Inter'; ctx.textAlign='center';
    ctx.fillText(sp.name, sp.x, sp.y-rPx-6 < 10 ? sp.y+16 : sp.y-rPx-6);
  });

  // decor (alberi, siepi, piante) — puramente visivo
  state.decor.forEach(d=>{
    const isSel = selected&&selected.kind==='decor'&&selected.id===d.id;
    drawDecor2D(d,isSel);
  });

  // sensors
  const sensorIcons = {meteo:'☁️',pioggia:'🌧️',umidita_suolo:'🌱',temperatura:'🌡️'};
  state.sensors.forEach(se=>{
    ctx.beginPath();
    ctx.arc(se.x, se.y, selected&&selected.kind==='sensor'&&selected.id===se.id?11:9, 0, 7);
    ctx.fillStyle = '#3fa6cf';
    ctx.fill();
    if(selected&&selected.kind==='sensor'&&selected.id===se.id){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); }
    ctx.font='11px Inter'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(sensorIcons[se.kind]||'📡', se.x, se.y);
    ctx.textBaseline='alphabetic';
    ctx.fillStyle='#e9f2eecc'; ctx.font='10px Inter';
    ctx.fillText(se.name, se.x, se.y+20);
  });

  // calibration points
  calibratePts.forEach(([x,y])=>{ ctx.beginPath(); ctx.arc(x,y,4,0,7); ctx.fillStyle='#e0a83a'; ctx.fill(); });
  if(calibratePts.length===1){
    ctx.fillStyle='#e0a83a'; ctx.font='11px Inter';
    ctx.fillText('Clicca il secondo punto…', calibratePts[0][0]+10, calibratePts[0][1]-10);
  }

  // animated water for active sprinklers & driplines
  if(activeZones.size>0){
    const tSec = performance.now()/1000;
    state.sprinklers.forEach(sp=>{
      if(activeZones.has(sp.zoneId)) drawSprinklerWaterFX(sp, tSec);
    });
    state.driplines.forEach(dl=>{
      if(activeZones.has(dl.zoneId)) drawDriplineWaterFX(dl, tSec);
    });
  }
  ctx.restore();
  drawMetricRulers();
}

function drawSprinklerWaterFX(sp, tSec){
  const zone = zoneById(sp.zoneId);
  const rM = computeSprinklerRadiusM(sp, zone?zone.pressureBar:null);
  const rPx = sp.type==='drip' ? 16 : Math.max(6, rM/state.metersPerPixel);
  const model = getModel(sp.modelId);
  const isRotor = model ? model.type==='rotor' : sp.type==='rotor';
  const arcSpan = Math.max(1, sp.angleEnd - sp.angleStart);
  let centerAngle = sp.angleStart + arcSpan/2;

  if(sp.type!=='drip' && isRotor){
    const period=2.5;
    let phase = (tSec % period)/period; if(phase>0.5) phase = 1-phase; phase*=2;
    centerAngle = sp.angleStart + phase*arcSpan;
    const a = (sp.rotation+centerAngle-90)*Math.PI/180;
    ctx.beginPath(); ctx.moveTo(sp.x,sp.y);
    ctx.lineTo(sp.x+Math.cos(a)*rPx, sp.y+Math.sin(a)*rPx);
    ctx.strokeStyle='rgba(223,246,255,0.75)'; ctx.lineWidth=2; ctx.stroke();
  }

  const n = sp.type==='drip' ? 4 : 10;
  for(let i=0;i<n;i++){
    const off = i/n;
    const u = (tSec*0.55 + off) % 1;
    let ang;
    if(sp.type!=='drip' && isRotor){ ang = centerAngle + (off-0.5)*16; }
    else { ang = sp.angleStart + off*arcSpan; }
    const a = (sp.rotation+ang-90)*Math.PI/180;
    const dist = u*rPx;
    const x = sp.x+Math.cos(a)*dist, y = sp.y+Math.sin(a)*dist;
    ctx.beginPath();
    ctx.arc(x,y, sp.type==='drip'?1.6:2.2, 0,7);
    ctx.fillStyle = `rgba(200,235,255,${(0.9*(1-u*0.6)).toFixed(2)})`;
    ctx.fill();
  }
  const pulse = 0.5+0.5*Math.sin(tSec*4);
  ctx.beginPath(); ctx.arc(sp.x, sp.y, 6+pulse*3, 0,7);
  ctx.strokeStyle='rgba(200,235,255,0.45)'; ctx.lineWidth=1.4; ctx.stroke();
}

function drawDriplineWaterFX(dl, tSec){
  const total = polylineLengthPx(dl.points);
  if(total<=0) return;
  const nDrops = Math.max(4, Math.round(total/40));
  for(let i=0;i<nDrops;i++){
    const u = ((tSec*0.12 + i/nDrops) % 1) * total;
    // trova il punto lungo la polilinea a distanza u
    let acc=0, px=dl.points[0][0], py=dl.points[0][1];
    for(let j=1;j<dl.points.length;j++){
      const [x1,y1]=dl.points[j-1], [x2,y2]=dl.points[j];
      const segLen = Math.hypot(x2-x1,y2-y1);
      if(u <= acc+segLen){
        const t = segLen>0 ? (u-acc)/segLen : 0;
        px = x1+(x2-x1)*t; py = y1+(y2-y1)*t;
        break;
      }
      acc += segLen;
    }
    const bob = Math.sin(tSec*6 + i)*2;
    ctx.beginPath();
    ctx.arc(px, py+2+Math.abs(bob), 1.8, 0, 7);
    ctx.fillStyle='rgba(200,235,255,0.85)';
    ctx.fill();
  }
}

/* ---------- loop di rendering unico e robusto ----------
   Ridisegna continuamente finché la Mappa 2D (Gestione o Home) è visibile.
   Nessuna logica di avvio/arresto legata alle zone: elimina i casi limite
   in cui l'animazione non partiva. Costo trascurabile per un canvas così semplice. */
function needsMapRedraw(){
  return root.getElementById('screen-manage').classList.contains('active')
      && root.getElementById('view-mappa').classList.contains('active')
      && !mode3D;
}
function mapRenderLoop(){
  if(needsMapRedraw()) drawMap();
  requestAnimationFrame(mapRenderLoop);
}
requestAnimationFrame(mapRenderLoop);

/* ---------- Home isometrica garantita ----------
   Questo livello usa il Canvas 2D, ma proietta il progetto in assonometria
   con spessore e ombre. Rimane sotto Three.js e garantisce una Home leggibile
   anche quando il browser non compone il canvas WebGL del pannello HA. */
const homeIsoCanvas=root.getElementById('homeIsoCanvas');
const homeIsoCtx=homeIsoCanvas.getContext('2d');
function shadeHex(hex,factor){
  const raw=String(hex||'#356b45').replace('#','');
  const n=parseInt(raw.length===3?raw.split('').map(c=>c+c).join(''):raw,16);
  if(!Number.isFinite(n))return '#244b35';
  const ch=s=>Math.max(0,Math.min(255,Math.round(((n>>s)&255)*factor))).toString(16).padStart(2,'0');
  return '#'+ch(16)+ch(8)+ch(0);
}
function drawHomeIso(){
  const wrap=homeIsoCanvas.parentElement;if(!wrap)return;
  const w=Math.max(1,wrap.clientWidth),h=Math.max(1,wrap.clientHeight),dpr=Math.min(devicePixelRatio||1,2);
  if(homeIsoCanvas.width!==Math.round(w*dpr)||homeIsoCanvas.height!==Math.round(h*dpr)){homeIsoCanvas.width=Math.round(w*dpr);homeIsoCanvas.height=Math.round(h*dpr);}
  const c=homeIsoCtx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const plotW=Math.max(2,Number(state.plot.widthM)||50),plotH=Math.max(2,Number(state.plot.heightM)||31);
  const iso=(x,z)=>[(x-z)*.866,(x+z)*.5];
  const corners=[[0,0],[plotW,0],[plotW,plotH],[0,plotH]].map(p=>iso(...p));
  const minX=Math.min(...corners.map(p=>p[0])),maxX=Math.max(...corners.map(p=>p[0]));
  const minY=Math.min(...corners.map(p=>p[1])),maxY=Math.max(...corners.map(p=>p[1]));
  const scale=Math.max(.1,Math.min((w-100)/(maxX-minX),(h-100)/(maxY-minY+3)));
  const ox=w/2-(minX+maxX)*scale/2,oy=h/2-(minY+maxY)*scale/2+12,depth=12;
  const project=(px,py)=>{const x=Math.max(0,(px-RULER_LEFT)*(state.metersPerPixel||.05)),z=Math.max(0,py*(state.metersPerPixel||.05));const p=iso(x,z);return[ox+p[0]*scale,oy+p[1]*scale]};
  const base=corners.map(([x,y])=>[ox+x*scale,oy+y*scale]);
  c.save();c.shadowColor='#0005';c.shadowBlur=20;c.shadowOffsetY=10;c.beginPath();base.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle='#0a1512';c.fill();c.restore();
  [[1,2],[2,3]].forEach(([a,b])=>{c.beginPath();c.moveTo(...base[a]);c.lineTo(...base[b]);c.lineTo(base[b][0],base[b][1]+depth);c.lineTo(base[a][0],base[a][1]+depth);c.closePath();c.fillStyle='#08110f';c.fill()});
  c.beginPath();base.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle='#0a1512';c.fill();c.strokeStyle='#17362b';c.lineWidth=1;c.stroke();
  const areas=state.areas.filter(a=>Array.isArray(a.points)&&a.points.length>=3).map(a=>({a,pts:a.points.map(p=>project(p[0],p[1]))})).sort((a,b)=>a.pts.reduce((s,p)=>s+p[1],0)/a.pts.length-b.pts.reduce((s,p)=>s+p[1],0)/b.pts.length);
  areas.forEach(({a,pts})=>{
    const style=AREA_TYPE_FILL[a.type]||AREA_TYPE_FILL.prato,color=a.color||style.base,raise=8;
    for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];if(q[1]<p[1])continue;c.beginPath();c.moveTo(p[0],p[1]-raise);c.lineTo(q[0],q[1]-raise);c.lineTo(q[0],q[1]);c.lineTo(p[0],p[1]);c.closePath();c.fillStyle=shadeHex(color,.55);c.fill()}
    c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y-raise):c.moveTo(x,y-raise));c.closePath();c.fillStyle=color;c.fill();c.strokeStyle=style.line||'#9bd29f';c.lineWidth=2;c.stroke();
    const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cy=pts.reduce((s,p)=>s+p[1],0)/pts.length-raise;c.fillStyle='#f2fff6';c.font='600 12px system-ui';c.textAlign='center';c.shadowColor='#000';c.shadowBlur=4;c.fillText(a.name||'Area',cx,cy);c.shadowBlur=0;
  });
}
function webglFrameCompleted(){
  if(current3DContainer===root.getElementById('homeScene3d')&&renderer3D?.info?.render?.calls>0){
    homeIsoCanvas.style.opacity='0';
  }
}
window.addEventListener('resize',drawHomeIso);

/* ---------- inspector panel ---------- */
function renderInspector(){
  const empty = root.getElementById('inspectorEmpty');
  const body = root.getElementById('inspectorBody');
  if(!selected){ empty.style.display='block'; body.innerHTML=''; return; }
  empty.style.display='none';

  if(selected.kind==='sprinkler'){
    const sp = state.sprinklers.find(s=>s.id===selected.id);
    if(!sp){ body.innerHTML=''; return; }
    const models = allModels();
    const model = getModel(sp.modelId);
    body.innerHTML = `
      <div class="field"><label>Nome</label><input type="text" id="fName" value="${escapeHtml(sp.name)}"></div>
      <div class="field"><label>Zona</label>
        <select id="fZone">${state.zones.map(z=>`<option value="${z.id}" ${z.id===sp.zoneId?'selected':''}>${escapeHtml(z.name)}</option>`).join('')}${state.zones.length===0?'<option value="">— crea una zona in "Zone" —</option>':''}</select>
      </div>
      <div class="field"><label>Modello irrigatore</label>
        <select id="fModel">${models.map(m=>`<option value="${m.id}" ${m.id===sp.modelId?'selected':''}>${escapeHtml(m.brand+' '+m.model)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Ugello / variante</label>
        <select id="fNozzle">${(model?model.nozzles:[]).map(n=>`<option value="${n.id}" ${n.id===sp.nozzleId?'selected':''}>${escapeHtml(n.id)}</option>`).join('')}</select>
      </div>
      ${model && model.datasheetUrl ? `<div class="small" style="margin:-4px 0 10px;"><a href="${model.datasheetUrl}" target="_blank" rel="noopener">📄 Vedi scheda tecnica ufficiale ↗</a></div>` : ''}
      ${sp.type==='drip' ? `
        <div class="field-row">
          <div class="field"><label>N. gocciolatori</label><input type="number" id="fEmitters" value="${sp.numEmitters||1}" min="1"></div>
          <div class="field"><label>Portata cad. (l/h)</label><input type="number" id="fEmitterFlow" value="${sp.flowPerEmitterLh||4}" min="0.5" step="0.5"></div>
        </div>
      ` : `
        <div class="field"><label>Arco inizio: <span id="fA0Value">${sp.angleStart}°</span></label><input type="range" id="fA0" value="${sp.angleStart}" min="0" max="359" step="1"></div>
        <div class="field"><label>Arco fine: <span id="fA1Value">${sp.angleEnd}°</span></label><input type="range" id="fA1" value="${sp.angleEnd}" min="1" max="360" step="1"></div>
        <div class="field"><label>Rotazione: <span id="fRotValue">${sp.rotation}°</span></label><input type="range" id="fRot" min="0" max="360" value="${sp.rotation}"></div>
      `}
      <div class="small muted" id="flowPreview" style="margin:10px 0;"></div>
      <div class="row"><button class="danger sm" id="fDelete">🗑 Elimina irrigatore</button></div>
    `;
    const refreshFlow = ()=>{
      const zone = zoneById(sp.zoneId);
      const f = computeSprinklerFlowLmin(sp, zone?zone.pressureBar:null).toFixed(2);
      const r = sp.type==='drip' ? '—' : computeSprinklerRadiusM(sp, zone?zone.pressureBar:null).toFixed(1);
      root.getElementById('flowPreview').textContent = `Portata stimata: ${f} l/min · Gittata stimata: ${r} m`;
    };
    refreshFlow();
    root.getElementById('fName').oninput = e=>{ sp.name=e.target.value; drawMap(); queueSave(); };
    root.getElementById('fZone').onchange = e=>{ sp.zoneId=e.target.value; refreshFlow(); drawMap(); queueSave(); renderZones(); };
    root.getElementById('fModel').onchange = e=>{
      sp.modelId = e.target.value;
      const m = getModel(sp.modelId);
      sp.type = m.type; sp.scaleWithArc = m.scaleWithArc;
      sp.nozzleId = m.nozzles[0].id;
      renderInspector(); drawMap(); queueSave(); scheduleCoverageRefresh();
    };
    if(root.getElementById('fNozzle')) root.getElementById('fNozzle').onchange = e=>{ sp.nozzleId=e.target.value; refreshFlow(); drawMap(); queueSave(); scheduleCoverageRefresh(); };
    if(sp.type==='drip'){
      root.getElementById('fEmitters').oninput = e=>{ sp.numEmitters=parseFloat(e.target.value)||0; refreshFlow(); queueSave(); };
      root.getElementById('fEmitterFlow').oninput = e=>{ sp.flowPerEmitterLh=parseFloat(e.target.value)||0; refreshFlow(); queueSave(); };
    } else {
      root.getElementById('fA0').oninput = e=>{ sp.angleStart=Math.min(parseFloat(e.target.value)||0,sp.angleEnd-1);e.target.value=sp.angleStart;root.getElementById('fA0Value').textContent=sp.angleStart+'°';refreshFlow();drawMap();queueSave();scheduleCoverageRefresh(); };
      root.getElementById('fA1').oninput = e=>{ sp.angleEnd=Math.max(parseFloat(e.target.value)||1,sp.angleStart+1);e.target.value=sp.angleEnd;root.getElementById('fA1Value').textContent=sp.angleEnd+'°';refreshFlow();drawMap();queueSave();scheduleCoverageRefresh(); };
      root.getElementById('fRot').oninput = e=>{ sp.rotation=parseFloat(e.target.value)||0;root.getElementById('fRotValue').textContent=sp.rotation+'°';drawMap();queueSave();scheduleCoverageRefresh(); };
    }
    root.getElementById('fDelete').onclick = ()=>{
      state.sprinklers = state.sprinklers.filter(s=>s.id!==sp.id);
      selectItem(null,null); renderZones(); queueSave();
    };
  }

  else if(selected.kind==='sensor'){
    const se = state.sensors.find(s=>s.id===selected.id);
    if(!se){ body.innerHTML=''; return; }
    const domainMap = {meteo:'weather', pioggia:'binary_sensor', umidita_suolo:'sensor', temperatura:'sensor'};
    const candidates = haConnected ? entitiesByDomain(domainMap[se.kind]) : [];
    body.innerHTML = `
      <div class="field"><label>Nome</label><input type="text" id="sName" value="${escapeHtml(se.name)}"></div>
      <div class="field"><label>Tipo sensore</label>
        <select id="sKind">
          <option value="meteo" ${se.kind==='meteo'?'selected':''}>Centralina meteo</option>
          <option value="pioggia" ${se.kind==='pioggia'?'selected':''}>Sensore pioggia</option>
          <option value="umidita_suolo" ${se.kind==='umidita_suolo'?'selected':''}>Umidità suolo</option>
          <option value="temperatura" ${se.kind==='temperatura'?'selected':''}>Temperatura</option>
        </select>
      </div>
      <div class="field"><label>Entità Home Assistant</label>
        <select id="sEntity">
          <option value="">${haConnected? '— seleziona entità —':'— entità HA non disponibili —'}</option>
          ${candidates.map(e=>`<option value="${e.entity_id}" ${e.entity_id===se.entityId?'selected':''}>${escapeHtml((e.attributes&&e.attributes.friendly_name)||e.entity_id)} (${e.entity_id})</option>`).join('')}
        </select>
      </div>
      ${se.kind==='umidita_suolo' ? `<div class="field"><label>Influenza zona</label>
        <select id="sZone"><option value="">— nessuna —</option>${state.zones.map(z=>`<option value="${z.id}" ${z.id===se.affectsZoneId?'selected':''}>${escapeHtml(z.name)}</option>`).join('')}</select></div>` : ''}
      <div class="row"><button class="danger sm" id="sDelete">🗑 Elimina sensore</button></div>
    `;
    root.getElementById('sName').oninput = e=>{ se.name=e.target.value; drawMap(); queueSave(); };
    root.getElementById('sKind').onchange = e=>{ se.kind=e.target.value; se.entityId=''; renderInspector(); drawMap(); queueSave(); };
    root.getElementById('sEntity').onchange = e=>{ se.entityId=e.target.value; queueSave(); };
    if(root.getElementById('sZone')) root.getElementById('sZone').onchange = e=>{ se.affectsZoneId=e.target.value; queueSave(); };
    root.getElementById('sDelete').onclick = ()=>{
      state.sensors = state.sensors.filter(s=>s.id!==se.id);
      selectItem(null,null); queueSave();
    };
  }

  else if(selected.kind==='area'){
    const a = state.areas.find(a=>a.id===selected.id);
    if(!a){ body.innerHTML=''; return; }
    body.innerHTML = `
      <div class="field"><label>Nome</label><input type="text" id="aName" value="${escapeHtml(a.name)}"></div>
      <div class="field"><label>Tipo di terreno / fondo</label>
        <select id="aType">
          <option value="prato" ${a.type==='prato'?'selected':''}>Prato</option>
          <option value="ghiaia" ${a.type==='ghiaia'?'selected':''}>Ghiaia</option>
          <option value="terra" ${a.type==='terra'?'selected':''}>Terra</option>
          <option value="aiuola" ${a.type==='aiuola'?'selected':''}>Aiuola</option>
        </select>
      </div>
      <div class="field"><label>Colore (opzionale, sovrascrive il colore tipo)</label><input type="text" id="aColor" value="${a.color||''}" placeholder="es. #6ec178"></div>
      <p class="help">Le aree sono solo rappresentazione grafica del terreno: non comandano nulla. Per irrigare, aggiungi irrigatori o tubi gocciolanti sopra quest'area (con lo strumento apposito) e assegnali a una zona nella scheda "Zone &amp; Pompa".</p>
      <div class="row"><button class="danger sm" id="aDelete">🗑 Elimina area</button></div>
    `;
    root.getElementById('aName').oninput = e=>{ a.name=e.target.value; drawMap(); queueSave(); };
    root.getElementById('aType').onchange = e=>{ a.type=e.target.value; drawMap(); queueSave(); };
    root.getElementById('aColor').oninput = e=>{ a.color=e.target.value; drawMap(); queueSave(); };
    root.getElementById('aDelete').onclick = ()=>{
      state.areas = state.areas.filter(x=>x.id!==a.id);
      selectItem(null,null); queueSave();
    };
  }

  else if(selected.kind==='dripline'){
    const dl = state.driplines.find(d=>d.id===selected.id);
    if(!dl){ body.innerHTML=''; return; }
    const models = allDriplineModels();
    const model = getDriplineModel(dl.modelId);
    const lengthM = computeDriplineLengthM(dl);
    body.innerHTML = `
      <div class="field"><label>Nome</label><input type="text" id="dName" value="${escapeHtml(dl.name)}"></div>
      <div class="field"><label>Zona</label>
        <select id="dZone">${state.zones.map(z=>`<option value="${z.id}" ${z.id===dl.zoneId?'selected':''}>${escapeHtml(z.name)}</option>`).join('')}${state.zones.length===0?'<option value="">— crea una zona in "Zone" —</option>':''}</select>
      </div>
      <div class="field"><label>Prodotto</label>
        <select id="dModel">${models.map(m=>`<option value="${m.id}" ${m.id===dl.modelId?'selected':''}>${escapeHtml(m.brand+' '+m.model)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Variante (spaziatura / portata gocciolatore)</label>
        <select id="dVariant">${(model?model.variants:[]).map(v=>`<option value="${v.id}" ${v.id===dl.variantId?'selected':''}>${escapeHtml(v.id)} — ${v.flowPerMeterLh} l/h·m</option>`).join('')}</select>
      </div>
      <div class="field"><label>Larghezza fascia bagnata: <span id="dWidthValue">${Number(dl.wettedWidthM||.6).toFixed(1)} m</span></label><input type="range" id="dWettedWidth" min="0.1" max="2.5" step="0.1" value="${dl.wettedWidthM||.6}"></div>
      ${model && model.datasheetUrl ? `<div class="small" style="margin:-4px 0 10px;"><a href="${model.datasheetUrl}" target="_blank" rel="noopener">📄 Vedi scheda tecnica ufficiale ↗</a></div>` : ''}
      <div class="small muted" id="dFlowPreview" style="margin:10px 0;"></div>
      <div class="row"><button class="danger sm" id="dDelete">🗑 Elimina tubo gocciolante</button></div>
    `;
    const refreshDFlow = ()=>{
      const f = computeDriplineFlowLmin(dl).toFixed(2);
      const len = computeDriplineLengthM(dl).toFixed(1);
      const area=len*Math.max(.1,Number(dl.wettedWidthM)||.6);
      root.getElementById('dFlowPreview').textContent = `Lunghezza: ${len} m · Portata: ${f} l/min · Fascia teorica: ${area.toFixed(1)} m²`;
    };
    refreshDFlow();
    root.getElementById('dName').oninput = e=>{ dl.name=e.target.value; drawMap(); queueSave(); };
    root.getElementById('dZone').onchange = e=>{ dl.zoneId=e.target.value; drawMap(); queueSave(); renderZones(); };
    root.getElementById('dModel').onchange = e=>{
      dl.modelId = e.target.value;
      const m = getDriplineModel(dl.modelId);
      dl.variantId = m.variants[0].id;
      renderInspector(); drawMap(); queueSave(); scheduleCoverageRefresh();
    };
    root.getElementById('dVariant').onchange = e=>{ dl.variantId=e.target.value; refreshDFlow(); queueSave(); scheduleCoverageRefresh(); };
    root.getElementById('dWettedWidth').oninput=e=>{dl.wettedWidthM=parseFloat(e.target.value)||.6;root.getElementById('dWidthValue').textContent=dl.wettedWidthM.toFixed(1)+' m';refreshDFlow();drawMap();queueSave();scheduleCoverageRefresh()};
    root.getElementById('dDelete').onclick = ()=>{
      state.driplines = state.driplines.filter(d=>d.id!==dl.id);
      selectItem(null,null); renderZones(); queueSave();
    };
  }

  else if(selected.kind==='decor'){
    const d = state.decor.find(x=>x.id===selected.id);
    if(!d){ body.innerHTML=''; return; }
    body.innerHTML = `
      <div class="field"><label>Nome</label><input type="text" id="vName" value="${escapeHtml(d.name)}"></div>
      <div class="field"><label>Tipo</label>
        <select id="vKind">
          <option value="albero" ${d.kind==='albero'?'selected':''}>🌳 Albero</option>
          <option value="siepe" ${d.kind==='siepe'?'selected':''}>🌿 Siepe</option>
          <option value="cespuglio" ${d.kind==='cespuglio'?'selected':''}>🪴 Cespuglio</option>
          <option value="pianta" ${d.kind==='pianta'?'selected':''}>🌱 Pianta</option>
        </select>
      </div>
      <div class="field"><label>Dimensione</label><input type="range" id="vSize" min="0.5" max="2.5" step="0.1" value="${d.size||1}"></div>
      <p class="help">Solo decorativo: non collegato a irrigazione o entità HA.</p>
      <div class="row"><button class="danger sm" id="vDelete">🗑 Elimina</button></div>
    `;
    root.getElementById('vName').oninput = e=>{ d.name=e.target.value; drawMap(); queueSave(); };
    root.getElementById('vKind').onchange = e=>{ d.kind=e.target.value; drawMap(); queueSave(); };
    root.getElementById('vSize').oninput = e=>{ d.size=parseFloat(e.target.value)||1; drawMap(); queueSave(); };
    root.getElementById('vDelete').onclick = ()=>{
      state.decor = state.decor.filter(x=>x.id!==d.id);
      selectItem(null,null); queueSave();
    };
  }
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

root.getElementById('btnClearMap').onclick = ()=>{
  if(!confirm('Svuotare completamente la mappa (aree, irrigatori, tubi gocciolanti, vegetazione, sensori)?')) return;
  state.areas=[]; state.sprinklers=[]; state.sensors=[]; state.driplines=[]; state.decor=[];
  selectItem(null,null); queueSave(); drawMap();
};

function renderLegend(){
  const el = root.getElementById('legendZones');
  el.innerHTML = state.zones.map(z=>`<div class="legend-item"><span class="swatch" style="background:${z.color}"></span>${escapeHtml(z.name)}</div>`).join('') || '<div class="small muted">Nessuna zona creata</div>';
}

/* ============================================================
   ZONE & PUMP VIEW
   ============================================================ */
root.getElementById('btnAddZone').onclick = ()=>{
  const color = ZONE_COLORS[state.zones.length % ZONE_COLORS.length];
  state.zones.push({id:uid(), name:'Zona '+(state.zones.length+1), color, relayEntity:'', pressureBar:3,plantProfileId:'grass-cool',areaM2:.1,areaAuto:true,irrigationEfficiency:.75,exposure:1,density:1,establishment:1});
  renderZones(); renderLegend(); queueSave();
};
function renderZones(){
  root.getElementById('zoneCount').textContent = state.zones.length;
  const wrap = root.getElementById('zoneList');
  if(state.zones.length===0){
    wrap.innerHTML = '<div class="empty">Nessuna zona. Aggiungine una per iniziare.</div>';
    renderLegend();
    if(typeof renderHomeDashboard==='function') renderHomeDashboard();
    return;
  }
  const switches = haConnected ? [...entitiesByDomain('switch'), ...entitiesByDomain('input_boolean')] : [];
  wrap.innerHTML = state.zones.map(z=>{
    const coverage=zoneCoverageStats(z.id);
    if(z.areaAuto===true)z.areaM2=Math.max(.1,Math.round(coverage.areaM2*10)/10);
    const flow = zoneTotalFlow(z.id);
    const pct = Math.min(100, (flow / (state.pump.maxFlowLmin||1))*100);
    const over = flow > (state.pump.maxFlowLmin||9999);
    const count = state.sprinklers.filter(s=>s.zoneId===z.id).length;
    const dripCount = state.driplines.filter(d=>d.zoneId===z.id).length;
    const inAreas = zoneContainingAreas(z.id);
    return `<div class="card" style="margin-bottom:10px;border-color:${z.color}33;">
      <div class="row">
        <span class="swatch" style="background:${z.color};width:14px;height:14px;border-radius:4px;"></span>
        <input type="text" data-zid="${z.id}" class="zName" value="${escapeHtml(z.name)}" style="max-width:220px;">
        <span class="pill">${count} irrigatori</span>
        ${dripCount?`<span class="pill">${dripCount} tubi gocciolanti</span>`:''}
        ${over?'<span class="pill danger">⚠ portata &gt; pompa</span>':''}
        <span class="spacer"></span>
        <button class="danger sm" data-zid="${z.id}" data-act="del">🗑</button>
      </div>
      <div class="field-row3" style="margin-top:10px;">
        <div class="field"><label>Entità relè valvola (HA)</label>
          <select data-zid="${z.id}" class="zEntity">
            <option value="">${haConnected?'— seleziona —':'entità HA non disponibili'}</option>
            ${switches.map(e=>`<option value="${e.entity_id}" ${e.entity_id===z.relayEntity?'selected':''}>${escapeHtml((e.attributes&&e.attributes.friendly_name)||e.entity_id)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Pressione di esercizio (bar)</label>
          <input type="number" step="0.1" min="0.5" data-zid="${z.id}" class="zPressure" value="${z.pressureBar}">
        </div>
        <div class="field"><label>Colore</label><input type="text" data-zid="${z.id}" class="zColor" value="${z.color}"></div>
      </div>
      <div class="field-row3">
        <div class="field"><label>Vegetazione / coltura</label><select data-zid="${z.id}" class="zPlant">${allPlants().map(p=>`<option value="${p.id}" ${p.id===(z.plantProfileId||'grass-cool')?'selected':''}>${escapeHtml(p.category+' — '+p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Superficie irrigata (m²)</label><input type="number" min="0.1" step="0.1" data-zid="${z.id}" class="zArea" value="${z.areaM2||.1}" ${z.areaAuto===true?'disabled':''}><label style="display:flex;gap:6px;align-items:center;margin-top:5px"><input type="checkbox" class="zAreaAuto" data-zid="${z.id}" ${z.areaAuto===true?'checked':''} style="width:auto"> Calcola dalla copertura in mappa</label></div>
        <div class="field"><label>Efficienza impianto (%)</label><input type="number" min="20" max="100" data-zid="${z.id}" class="zEfficiency" value="${Math.round((z.irrigationEfficiency||.75)*100)}"></div>
      </div>
      <div class="field-row3"><div class="field"><label>Esposizione</label><select data-zid="${z.id}" class="zExposure"><option value="0.8" ${(z.exposure||1)==.8?'selected':''}>Ombra</option><option value="0.9" ${(z.exposure||1)==.9?'selected':''}>Mezz'ombra</option><option value="1" ${(z.exposure||1)==1?'selected':''}>Sole</option><option value="1.15" ${(z.exposure||1)==1.15?'selected':''}>Sole/caldo intenso</option></select></div><div class="field"><label>Densità vegetazione</label><select data-zid="${z.id}" class="zDensity"><option value="0.8" ${(z.density||1)==.8?'selected':''}>Bassa</option><option value="1" ${(z.density||1)==1?'selected':''}>Normale</option><option value="1.15" ${(z.density||1)==1.15?'selected':''}>Alta</option></select></div><div class="field"><label>Stato impianto</label><select data-zid="${z.id}" class="zEst"><option value="1" ${(z.establishment||1)==1?'selected':''}>Stabilizzato</option><option value="1.25" ${(z.establishment||1)==1.25?'selected':''}>Nuovo impianto</option></select></div></div>
      <div class="small muted">Portata stimata zona: ${flow.toFixed(1)} l/min di ${state.pump.maxFlowLmin} l/min pompa</div>
      <div class="small muted" style="margin-top:5px">Copertura unificata: ${coverage.areaM2.toFixed(1)} m² · Tubo: ${coverage.lineLengthM.toFixed(1)} m · Portata gocciolante: ${coverage.dripFlowLh.toFixed(0)} l/h</div>
      <div class="flow-bar"><div style="width:${pct}%;background:${over?'linear-gradient(90deg,#e0a83a,#e0645a)':''}"></div></div>
      <div class="small muted" style="margin-top:6px;">📍 ${inAreas.length ? 'Si trova su: '+escapeHtml(inAreas.join(', ')) : "Nessun irrigatore/tubo di questa zona è posizionato sopra un'area disegnata"}</div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.zName').forEach(inp=> inp.oninput = e=>{ zoneById(e.target.dataset.zid).name=e.target.value; renderLegend(); drawMap(); queueSave(); });
  wrap.querySelectorAll('.zEntity').forEach(sel=> sel.onchange = e=>{ zoneById(e.target.dataset.zid).relayEntity=e.target.value; queueSave(); });
  wrap.querySelectorAll('.zPressure').forEach(inp=> inp.oninput = e=>{ zoneById(e.target.dataset.zid).pressureBar=parseFloat(e.target.value)||3; renderZones(); queueSave(); });
  wrap.querySelectorAll('.zColor').forEach(inp=> inp.oninput = e=>{ zoneById(e.target.dataset.zid).color=e.target.value; renderLegend(); drawMap(); queueSave(); });
  wrap.querySelectorAll('.zPlant').forEach(el=>el.onchange=e=>{zoneById(e.target.dataset.zid).plantProfileId=e.target.value;queueSave()});
  wrap.querySelectorAll('.zArea').forEach(el=>el.oninput=e=>{zoneById(e.target.dataset.zid).areaM2=Math.max(.1,parseFloat(e.target.value)||.1);queueSave()});
  wrap.querySelectorAll('.zAreaAuto').forEach(el=>el.onchange=e=>{const z=zoneById(e.target.dataset.zid);z.areaAuto=e.target.checked;if(z.areaAuto)z.areaM2=Math.max(.1,zoneCoverageStats(z.id).areaM2);renderZones();queueSave()});
  wrap.querySelectorAll('.zEfficiency').forEach(el=>el.oninput=e=>{zoneById(e.target.dataset.zid).irrigationEfficiency=Math.max(.2,Math.min(1,(parseFloat(e.target.value)||75)/100));queueSave()});
  wrap.querySelectorAll('.zExposure').forEach(el=>el.onchange=e=>{zoneById(e.target.dataset.zid).exposure=parseFloat(e.target.value);queueSave()});
  wrap.querySelectorAll('.zDensity').forEach(el=>el.onchange=e=>{zoneById(e.target.dataset.zid).density=parseFloat(e.target.value);queueSave()});
  wrap.querySelectorAll('.zEst').forEach(el=>el.onchange=e=>{zoneById(e.target.dataset.zid).establishment=parseFloat(e.target.value);queueSave()});
  wrap.querySelectorAll('[data-act=del]').forEach(btn=> btn.onclick = e=>{
    const zid = e.target.dataset.zid;
    if(!confirm('Eliminare questa zona? Gli irrigatori assegnati resteranno senza zona.')) return;
    state.zones = state.zones.filter(z=>z.id!==zid);
    state.sprinklers.forEach(s=>{ if(s.zoneId===zid) s.zoneId=''; });
    delete state.timers[zid];
    delete state.manualSchedules[zid];
    renderZones(); renderLegend(); drawMap(); queueSave();
  });
  renderLegend();
  if(typeof renderHomeDashboard==='function') renderHomeDashboard();
}
root.getElementById('pumpEntity').onchange = e=>{ state.pump.relayEntity=e.target.value; queueSave(); };
root.getElementById('pumpMaxFlow').oninput = e=>{ state.pump.maxFlowLmin=parseFloat(e.target.value)||60; renderZones(); queueSave(); };
root.getElementById('pumpMaxPressure').oninput = e=>{ state.pump.maxPressureBar=parseFloat(e.target.value)||4; queueSave(); };
root.getElementById('pumpFlowSensor').onchange = e=>{ state.pump.flowSensorEntity=e.target.value; queueSave(); };
root.getElementById('pumpValveDelay').oninput = e=>{ state.pump.valvePumpDelaySec=Math.max(0,parseFloat(e.target.value)||0); queueSave(); };

/* ============================================================
   MANUAL CONTROL
   ============================================================ */
let activeZones = new Set(); // zoneIds currently "on" per this app's own tracking
let pumpOn = false;
const activeZoneStartedAt=new Map();

async function setPump(on){
  if(state.pump.relayEntity && haConnected){
    try{ await haCallService(state.pump.relayEntity.split('.')[0], on?'turn_on':'turn_off', state.pump.relayEntity); }
    catch(e){ toast('Errore comando pompa: '+e.message,'err'); return false; }
  }
  pumpOn = on;
  root.getElementById('pumpStateLabel').textContent = 'Stato: '+(on?'ACCESA':'spenta');
  root.getElementById('btnPumpToggle').textContent = on?'Ferma pompa':'Avvia pompa';
  return true;
}
async function setZone(zoneId, on){
  const z = zoneById(zoneId);
  if(!z) return false;
  if(z.relayEntity && haConnected){
    try{ await haCallService(z.relayEntity.split('.')[0], on?'turn_on':'turn_off', z.relayEntity); }
    catch(e){ toast('Errore comando zona '+z.name+': '+e.message,'err'); return false; }
  }
  if(on) activeZones.add(zoneId); else activeZones.delete(zoneId);
  return true;
}
function hydraulicDelay(){ return sleep(Math.max(0,Number(state.pump.valvePumpDelaySec)||0)*1000); }
async function startZonesSafely(zoneIds){
  const ids=[...new Set(zoneIds)].filter(id=>zoneById(id)); if(!ids.length) return false;
  for(const id of ids) if(!await setZone(id,true)) return false;
  await hydraulicDelay();
  if(!await setPump(true)){ for(const id of ids) await setZone(id,false); return false; }
  return true;
}
async function stopZonesSafely(zoneIds){
  const ids=[...new Set(zoneIds)].filter(id=>zoneById(id));
  if(pumpOn) await setPump(false);
  await hydraulicDelay();
  for(const id of ids) await setZone(id,false);
  return true;
}
async function startZoneManual(zoneId){
  try{
    if(pumpOn||activeZones.size)await nativeCall('stop_all');
    await nativeCall('start_zone',{zone_id:zoneId,minutes:1440,source:'manual_ui'});
    activeZones.clear();activeZones.add(zoneId);pumpOn=true;activeZoneStartedAt.set(zoneId,Date.now());renderManualControl();setTimeout(refreshNativeAutomation,500);
  }catch(err){toast('Avvio zona fallito: '+err.message,'err');}
}
async function stopZoneManual(zoneId){
  try{await nativeCall('stop_all');activeZones.delete(zoneId);pumpOn=false;activeZoneStartedAt.delete(zoneId);renderManualControl();setTimeout(refreshNativeAutomation,500);}catch(err){toast('Arresto fallito: '+err.message,'err');}
}
root.getElementById('btnPumpToggle').onclick = async()=>{ if(pumpOn){await nativeCall('stop_all');activeZones.clear();pumpOn=false;setTimeout(refreshNativeAutomation,500);}else toast('Per sicurezza avvia la pompa dal comando di una zona.','err');renderManualControl(); };
function renderManualControl(){
  let totalFlow=0; activeZones.forEach(zid=> totalFlow+=zoneTotalFlow(zid));
  root.getElementById('totalFlowPill').textContent = 'Portata attiva: '+totalFlow.toFixed(1)+' l/min';
  const grid = root.getElementById('manualZoneGrid');
  if(state.zones.length===0){
    grid.innerHTML='<div class="empty">Crea prima una zona nella scheda "Zone &amp; Pompa".</div>';
    if(typeof renderHomeDashboard==='function') renderHomeDashboard();
    return;
  }
  grid.innerHTML = state.zones.map(z=>{
    const on = activeZones.has(z.id);
    const flow = zoneTotalFlow(z.id);
    return `<div class="card">
      <div class="row"><span class="swatch" style="background:${z.color};width:12px;height:12px;border-radius:3px;"></span>
        <b>${escapeHtml(z.name)}</b><span class="spacer"></span>
        <span class="pill ${on?'leaf':''}">${on?'ATTIVA':'ferma'}</span>
      </div>
      <div class="small muted" style="margin:6px 0;">${flow.toFixed(1)} l/min stimati</div>
      <button class="${on?'danger':'primary'}" style="width:100%;" data-zid="${z.id}" data-act="${on?'stop':'start'}">${on?'■ Ferma zona':'▶ Avvia zona'}</button>
    </div>`;
  }).join('');
  grid.querySelectorAll('button').forEach(btn=>{
    btn.onclick = ()=> btn.dataset.act==='start' ? startZoneManual(btn.dataset.zid) : stopZoneManual(btn.dataset.zid);
  });
  if(typeof renderHomeDashboard==='function') renderHomeDashboard();
}

/* ============================================================
   TIMER PROGRAM
   ============================================================ */
let timerRunning = false;
let timerAbort = false;
function renderTimer(){
  const wrap = root.getElementById('timerList');
  if(state.zones.length===0){ wrap.innerHTML='<div class="empty">Crea prima una zona.</div>'; return; }
  wrap.innerHTML = state.zones.map(z=>{
    const min = state.timers[z.id] ?? 10;
    const schedule=state.manualSchedules[z.id]||{enabled:false,minutes:min,startTime:'06:00',days:{lun:true,mar:true,mer:true,gio:true,ven:true,sab:true,dom:true}};
    return `<div class="timer-row">
      <span class="swatch" style="background:${z.color};width:12px;height:12px;border-radius:3px;"></span>
      <div><b>${escapeHtml(z.name)}</b><label style="margin-top:5px;display:flex;align-items:center;gap:5px"><input type="checkbox" class="tEnabled" data-zid="${z.id}" ${schedule.enabled?'checked':''} style="width:auto"> Programmazione attiva</label></div>
      <div class="field" style="margin:0"><label>Durata (minuti)</label><input type="number" min="1" max="180" value="${min}" data-zid="${z.id}" class="tMin"></div>
      <input class="tTime timer-time" type="time" value="${schedule.startTime||'06:00'}" data-zid="${z.id}">
      <div class="timer-days">${DAY_KEYS.map(d=>`<label><input type="checkbox" class="tDay" data-zid="${z.id}" data-day="${d}" ${schedule.days?.[d]!==false?'checked':''}>${d}</label>`).join('')}</div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.tMin').forEach(inp=> inp.oninput = e=>{
    const zid=e.target.dataset.zid,min=parseInt(e.target.value)||1;state.timers[zid]=min;ensureManualSchedule(zid).minutes=min;queueSave();
  });
  wrap.querySelectorAll('.tEnabled').forEach(el=>el.onchange=e=>{ensureManualSchedule(e.target.dataset.zid).enabled=e.target.checked;queueSave()});
  wrap.querySelectorAll('.tTime').forEach(el=>el.onchange=e=>{ensureManualSchedule(e.target.dataset.zid).startTime=e.target.value||'06:00';queueSave()});
  wrap.querySelectorAll('.tDay').forEach(el=>el.onchange=e=>{ensureManualSchedule(e.target.dataset.zid).days[e.target.dataset.day]=e.target.checked;queueSave()});
}
function ensureManualSchedule(zid){
  if(!state.manualSchedules[zid])state.manualSchedules[zid]={enabled:false,minutes:state.timers[zid]??10,startTime:'06:00',days:{lun:true,mar:true,mer:true,gio:true,ven:true,sab:true,dom:true}};
  return state.manualSchedules[zid];
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function runTimerProgram(){
  if(state.zones.length===0){ toast('Nessuna zona configurata','err'); return; }
  timerRunning=true; timerAbort=false;
  root.getElementById('btnStartTimer').disabled=true;
  root.getElementById('btnStopTimer').disabled=false;
  const targets = state.zones.filter(z=> (state.timers[z.id]??10) > 0);
  root.getElementById('timerStatusPill').textContent = 'In esecuzione…';
  for(const z of targets){
    if(timerAbort)break;
    const mins=state.timers[z.id]??10;root.getElementById('timerStatusPill').textContent='Zona attiva: '+z.name;
    try{await nativeCall('start_zone',{zone_id:z.id,minutes:mins,source:'immediate_program'});activeZones.clear();activeZones.add(z.id);pumpOn=true;renderManualControl();setTimeout(refreshNativeAutomation,500);}catch(err){toast('Avvio '+z.name+' fallito: '+err.message,'err');break;}
    for(let s=0;s<mins*60&&!timerAbort;s++)await sleep(1000);
    if(timerAbort)await nativeCall('stop_all');
    activeZones.delete(z.id);pumpOn=false;await refreshNativeAutomation();
  }
  if(timerAbort&&(pumpOn||activeZones.size))await nativeCall('stop_all');
  timerRunning=false;
  root.getElementById('btnStartTimer').disabled=false;
  root.getElementById('btnStopTimer').disabled=true;
  root.getElementById('timerStatusPill').textContent = timerAbort? 'Interrotto' : 'Completato';
  renderManualControl();
}
function stopTimerProgram(){
  if(timerRunning){ timerAbort=true; }
}
root.getElementById('btnStartTimer').onclick = runTimerProgram;
root.getElementById('btnStopTimer').onclick = async ()=>{
  stopTimerProgram();
  await nativeCall('stop_all');activeZones.clear();pumpOn=false;
  renderManualControl();
};

/* ============================================================
   AUTOMATIC MODE
   ============================================================ */
const DAY_KEYS = ['lun','mar','mer','gio','ven','sab','dom'];
function renderAutoDays(){
  const wrap = root.getElementById('autoDays');
  wrap.innerHTML = DAY_KEYS.map(d=>`<label style="margin:0;display:flex;gap:4px;align-items:center;text-transform:capitalize;">
    <input type="checkbox" data-day="${d}" ${state.auto.days[d]?'checked':''} style="width:auto;">${d}</label>`).join('');
  wrap.querySelectorAll('input').forEach(cb=> cb.onchange = e=>{ state.auto.days[e.target.dataset.day]=e.target.checked; renderHomeSchedule(); queueSave(); });
}
function bindAutoFields(){
  root.getElementById('autoEnabled').checked = state.auto.enabled;
  root.getElementById('autoRainThreshold').value = state.auto.rainThreshold;
  root.getElementById('autoStartTime').value = state.auto.startTime;
  root.getElementById('autoTempLow').value = state.auto.tempLow;
  root.getElementById('autoTempHigh').value = state.auto.tempHigh;
  root.getElementById('autoSoilThreshold').value = state.auto.soilThreshold;
  root.getElementById('autoEtoFallback').value=state.auto.etoFallback;
  root.getElementById('autoEffectiveRain').value=state.auto.effectiveRainMm;
  root.getElementById('autoCheckTimes').value=(state.auto.checkTimes||[]).join(', ');
  root.getElementById('autoEnabled').onchange = e=>{ state.auto.enabled=e.target.checked; renderHomeDashboard(); queueSave(); };
  root.getElementById('autoWeatherEntity').onchange = e=>{ state.auto.weatherEntity=e.target.value; queueSave(); };
  root.getElementById('autoRainSensor').onchange = e=>{ state.auto.rainSensor=e.target.value; queueSave(); };
  root.getElementById('autoRainThreshold').oninput = e=>{ state.auto.rainThreshold=parseFloat(e.target.value)||0; queueSave(); };
  root.getElementById('autoStartTime').oninput = e=>{ state.auto.startTime=e.target.value; renderHomeSchedule(); queueSave(); };
  root.getElementById('autoTempLow').oninput = e=>{ state.auto.tempLow=parseFloat(e.target.value)||0; queueSave(); };
  root.getElementById('autoTempHigh').oninput = e=>{ state.auto.tempHigh=parseFloat(e.target.value)||30; queueSave(); };
  root.getElementById('autoSoilThreshold').oninput = e=>{ state.auto.soilThreshold=parseFloat(e.target.value)||55; queueSave(); };
  root.getElementById('autoEtoFallback').oninput=e=>{state.auto.etoFallback=Math.max(0,parseFloat(e.target.value)||0);queueSave()};
  root.getElementById('autoEffectiveRain').oninput=e=>{state.auto.effectiveRainMm=Math.max(0,parseFloat(e.target.value)||0);queueSave()};
  root.getElementById('autoCheckTimes').onchange=e=>{state.auto.checkTimes=e.target.value.split(',').map(x=>x.trim()).filter(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x));e.target.value=state.auto.checkTimes.join(', ');queueSave()};
}
function logAuto(msg, kind){
  const wrap = root.getElementById('autoLog');
  if(wrap.querySelector('.empty')) wrap.innerHTML='';
  const el = document.createElement('div');
  el.className='log-entry '+(kind||'');
  el.textContent = new Date().toLocaleTimeString()+' — '+msg;
  wrap.prepend(el);
}
function zoneDeliveredLiters(zoneId,hours=24){
  const since=Date.now()-hours*3600000;return state.waterLedger.filter(x=>x.zoneId===zoneId&&x.ts>=since).reduce((s,x)=>s+x.liters,0);
}
function calculateZoneWater(z,etoMm,rainMm,soilValue=null){
  const p=plantById(z.plantProfileId),area=Math.max(.1,z.areaM2||50),eff=Math.max(.2,z.irrigationEfficiency||.75);
  const soilFactor=soilValue==null?1:Math.max(.65,Math.min(1.35,1+(p.targetMoisture-soilValue)/100));
  const landscape=(z.exposure||1)*(z.density||1)*(z.establishment||1),grossNeed=etoMm*p.kc*landscape*soilFactor;
  const netMm=Math.max(0,grossNeed-Math.max(0,rainMm||0)),liters=netMm*area/eff,flow=zoneTotalFlow(z.id),minutes=flow>0?liters/flow:0,delivered=zoneDeliveredLiters(z.id);
  const targetToday=liters,delta=targetToday>0?(delivered-targetToday)/targetToday*100:delivered>0?100:0;
  const feedback=delivered===0?'non ancora irrigata':delta>20?'troppo irrigata':delta< -20?'poco irrigata':'corretta';
  return {zone:z,plant:p,netMm,liters,minutes,flow,delivered,delta,feedback};
}
function renderWaterPlan(plans){
  const el=root.getElementById('waterPlan');
  el.innerHTML=plans.map(x=>x.skip?`<div class="log-entry skip"><b>${escapeHtml(x.zone.name)}</b>: saltata — ${escapeHtml(x.reason)}</div>`:`<div class="card" style="margin:8px 0;padding:10px"><div class="row"><b>${escapeHtml(x.zone.name)}</b><span class="pill">${escapeHtml(x.plant.name)}</span><span class="spacer"></span><span class="pill ${x.feedback==='corretta'?'leaf':x.feedback==='troppo irrigata'?'danger':''}">${x.feedback}</span></div><div class="small muted">Obiettivo ${x.netMm.toFixed(1)} mm · ${Math.round(x.liters)} litri · ${x.flow.toFixed(1)} l/min · ${x.minutes.toFixed(1)} minuti</div><div class="small muted">Erogati nelle ultime 24 h: ${Math.round(x.delivered)} litri${x.delivered?` · scostamento ${x.delta>0?'+':''}${x.delta.toFixed(0)}%`:''} · fonte ${escapeHtml(x.plant.source)} (${x.plant.confidence})</div></div>`).join('')||'<div class="empty">Nessuna zona configurata.</div>';
}
function recordWater(zoneId,minutes,source){
  const liters=Math.max(0,zoneTotalFlow(zoneId)*minutes);if(!liters)return;state.waterLedger.push({ts:Date.now(),zoneId,minutes,liters,source});const cutoff=Date.now()-90*86400000;state.waterLedger=state.waterLedger.filter(x=>x.ts>=cutoff);queueSave();
}
async function runAutoCheck(){
  try{
    await saveState();
    await nativeCall('recalculate');
    await refreshNativeAutomation();
    toast('Verifica registrata nello storico','ok');
  }catch(err){toast('Verifica automatica fallita: '+err.message,'err');}
}
root.getElementById('btnRunAutoCheck').onclick = runAutoCheck;

function buildAutomationYaml(){
  const safeDelay=Math.max(0,Number(state.pump.valvePumpDelaySec)||0);
  const weather=state.auto.weatherEntity||'weather.METEO_DA_CONFIGURARE', pump=state.pump.relayEntity||'switch.POMPA_DA_CONFIGURARE';
  const key=z=>'z_'+String(z.id).replace(/[^a-zA-Z0-9_]/g,'_').toLowerCase();
  const checks=[...new Set((state.auto.checkTimes||['05:00']).filter(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x)))];
  const planHelpers=state.zones.map(z=>`  irrigaha_piano_${key(z)}:\n    name: "IRRIGAZIONE SMART piano ${String(z.name).replace(/"/g,"'")}"\n    min: 0\n    max: 180\n    step: 1\n    unit_of_measurement: min\n    mode: box`).join('\n');
  const lastHelpers=state.zones.map(z=>`  irrigaha_ultima_${key(z)}:\n    name: "IRRIGAZIONE SMART ultima irrigazione ${String(z.name).replace(/"/g,"'")}"\n    has_date: true\n    has_time: true`).join('\n');
  const planActions=state.zones.map(z=>{const p=plantById(z.plantProfileId),flow=Math.max(.01,zoneTotalFlow(z.id)),soil=state.sensors.find(s=>s.kind==='umidita_suolo'&&s.affectsZoneId===z.id&&s.entityId),threshold=Math.max(state.auto.soilThreshold||55,p.targetMoisture||0);return `      - action: input_number.set_value
        target:
          entity_id: input_number.irrigaha_piano_${key(z)}
        data:
          value: >-
            {% set soil = ${soil?`states('${soil.entityId}') | float(0)`:'0'} %}
            {% set wet = ${soil?`soil >= ${threshold}`:'false'} %}
            {% set mm = [0, ((${Number(state.auto.etoFallback||4)} * temp_factor * ${p.kc} * ${z.exposure||1} * ${z.density||1} * ${z.establishment||1}) - ${Number(state.auto.effectiveRainMm||0)})] | max %}
            {% set liters = mm * ${Number(z.areaM2||50)} / ${Number(z.irrigationEfficiency||.75)} %}
            {{ 0 if wet or rain_probability >= ${Number(state.auto.rainThreshold||60)} else ([180, (liters / ${flow}) | round(0)] | min) }}`}).join('\n');
  const executeZones=state.zones.map(z=>`      - if:
          - condition: template
            value_template: >-
              {{ states('input_number.irrigaha_piano_${key(z)}') | int(0) > 0 and
                 states('input_datetime.irrigaha_ultima_${key(z)}')[:10] != now().strftime('%Y-%m-%d') }}
        then:
          - action: switch.turn_on
            target:
              entity_id: ${z.relayEntity||'switch.ZONA_DA_CONFIGURARE'}
          - delay:
              seconds: ${safeDelay}
          - action: switch.turn_on
            target:
              entity_id: ${pump}
          - delay:
              minutes: "{{ states('input_number.irrigaha_piano_${key(z)}') | int(0) }}"
          - action: switch.turn_off
            target:
              entity_id: ${pump}
          - delay:
              seconds: ${safeDelay}
          - action: switch.turn_off
            target:
              entity_id: ${z.relayEntity||'switch.ZONA_DA_CONFIGURARE'}
          - action: input_datetime.set_datetime
            target:
              entity_id: input_datetime.irrigaha_ultima_${key(z)}
            data:
              datetime: "{{ now().strftime('%Y-%m-%d %H:%M:%S') }}"`).join('\n');
  const weekdayNumbers=DAY_KEYS.map((d,i)=>state.auto.days[d]?i+1:null).filter(Boolean).join(', ');
  return `# Pacchetto Home Assistant generato da IRRIGAZIONE SMART ${APP_VERSION}
# Salvare come /config/packages/irrigaha.yaml e abilitare packages in configuration.yaml.
input_number:
${planHelpers||'  irrigaha_nessuna_zona:\n    min: 0\n    max: 1'}

input_datetime:
  irrigaha_ultimo_controllo:
    name: IRRIGAZIONE SMART ultimo controllo
    has_date: true
    has_time: true
${lastHelpers}

script:
  irrigaha_rivaluta:
    alias: IRRIGAZIONE SMART - rivaluta fabbisogno
    mode: restart
    sequence:
      - action: weather.get_forecasts
        target:
          entity_id: ${weather}
        data:
          type: daily
        response_variable: irrigaha_forecast
      - variables:
          rain_probability: "{{ irrigaha_forecast['${weather}'].forecast[0].precipitation_probability | default(0) | float(0) }}"
          current_temp: "{{ state_attr('${weather}', 'temperature') | float(20) }}"
          current_humidity: "{{ state_attr('${weather}', 'humidity') | float(50) }}"
          temp_factor: "{{ [1.6, [0.4, 1 + ((current_temp - 22) / 40) - ((current_humidity - 50) / 200)] | max] | min }}"
      - action: input_datetime.set_datetime
        target:
          entity_id: input_datetime.irrigaha_ultimo_controllo
        data:
          datetime: "{{ now().strftime('%Y-%m-%d %H:%M:%S') }}"
${planActions}

automation:
  - id: irrigaha_rivalutazioni_multiple
    alias: IRRIGAZIONE SMART - rivalutazioni multiple
    mode: restart
    triggers:
${checks.map(t=>`      - trigger: time\n        at: "${t}:00"`).join('\n')||'      - trigger: time\n        at: "05:00:00"'}
    actions:
      - action: script.irrigaha_rivaluta

  - id: irrigaha_esecuzione_giornaliera
    alias: IRRIGAZIONE SMART - esecuzione giornaliera
    mode: single
    triggers:
      - trigger: time
        at: "${state.auto.startTime}:00"
    conditions:
      - condition: template
        value_template: "{{ now().isoweekday() in [${weekdayNumbers||'1, 2, 3, 4, 5, 6, 7'}] }}"
${state.auto.rainSensor?`      - condition: state\n        entity_id: ${state.auto.rainSensor}\n        state: "off"`:''}
    actions:
      - action: script.irrigaha_rivaluta
      - wait_template: "{{ is_state('script.irrigaha_rivaluta', 'off') }}"
        timeout: "00:02:00"
        continue_on_timeout: false
${executeZones||'      - stop: Nessuna zona configurata'}

  - id: irrigaha_sicurezza_riavvio
    alias: IRRIGAZIONE SMART - sicurezza al riavvio
    triggers:
      - trigger: homeassistant
        event: start
    actions:
      - action: switch.turn_off
        target:
          entity_id: ${pump}
      - delay:
          seconds: ${safeDelay}
${state.zones.map(z=>`      - action: switch.turn_off\n        target:\n          entity_id: ${z.relayEntity||'switch.ZONA_DA_CONFIGURARE'}`).join('\n')}
`;
}
root.getElementById('btnExportYaml').onclick = ()=>{
  const yaml = buildAutomationYaml();
  const blob = new Blob([yaml], {type:'text/yaml'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='irrigaha_package.yaml'; a.click();
  URL.revokeObjectURL(url);
  toast('Pacchetto HA generato — salvalo in /config/packages/irrigaha.yaml e verifica gli entity_id.','ok');
};

/* ============================================================
   MODEL DATABASE VIEW
   ============================================================ */
function renderModelTable(){
  const body = root.getElementById('modelTableBody');
  const rows = [];
  allModels().forEach(m=>{
    m.nozzles.forEach((n,idx)=>{
      const isCustom = state.customModels.some(c=>c.id===m.id);
      const schedaCell = idx===0
        ? (m.datasheetUrl ? `<a href="${m.datasheetUrl}" target="_blank" rel="noopener">↗ scheda</a>` : `<span class="small muted">${escapeHtml(m.source||'—')}</span>`)
        : '';
      rows.push(`<tr>
        <td>${idx===0?escapeHtml(m.brand):''}</td>
        <td>${idx===0?escapeHtml(m.model):''}</td>
        <td>${idx===0?`<span class="pill">${m.type}</span>`:''}</td>
        <td>${escapeHtml(n.id)}</td>
        <td>${n.pressureBar}</td>
        <td>${n.flow360}</td>
        <td>${n.radiusM}</td>
        <td class="small">${schedaCell}</td>
        <td>${idx===0 && isCustom ? `<button class="danger sm" data-mid="${m.id}" data-act="delmodel">🗑</button>`:''}</td>
      </tr>`);
    });
  });
  body.innerHTML = rows.join('');
  body.querySelectorAll('[data-act=delmodel]').forEach(btn=> btn.onclick = ()=>{
    if(!confirm('Eliminare questo modello personalizzato?')) return;
    state.customModels = state.customModels.filter(m=>m.id!==btn.dataset.mid);
    renderModelTable(); queueSave();
  });
}
root.getElementById('btnAddModel').onclick = ()=>{
  const brand = prompt('Marca:'); if(!brand) return;
  const model = prompt('Modello:'); if(!model) return;
  const type = prompt('Tipo (rotor / spray / drip):','rotor');
  const pressureBar = parseFloat(prompt('Pressione nominale (bar):','3'))||3;
  const flow360 = parseFloat(prompt('Portata nominale equivalente 360° (l/min):','10'))||10;
  const radiusM = parseFloat(prompt('Gittata nominale (m):','9'))||9;
  const datasheetUrl = prompt('Link alla scheda tecnica (opzionale, lascia vuoto se non disponibile):','') || '';
  const m = {id:uid(), brand, model, type, scaleWithArc: type==='spray', source:'Personalizzato', datasheetUrl,
    nozzles:[{id:'Standard', pressureBar, flow360, radiusM}]};
  state.customModels.push(m);
  renderModelTable(); queueSave();
  toast('Modello aggiunto al database','ok');
};

function renderDriplineModelTable(){
  const body = root.getElementById('driplineModelTableBody');
  const rows = [];
  allDriplineModels().forEach(m=>{
    m.variants.forEach((v,idx)=>{
      const isCustom = state.customModels.some(c=>c.id===m.id);
      const schedaCell = idx===0
        ? (m.datasheetUrl ? `<a href="${m.datasheetUrl}" target="_blank" rel="noopener">↗ scheda</a>` : `<span class="small muted">${escapeHtml(m.source||'—')}</span>`)
        : '';
      rows.push(`<tr>
        <td>${idx===0?escapeHtml(m.brand):''}</td>
        <td>${idx===0?escapeHtml(m.model):''}</td>
        <td>${escapeHtml(v.id)}</td>
        <td>${v.spacingCm}</td>
        <td>${v.flowPerDripperLh}</td>
        <td>${v.flowPerMeterLh}</td>
        <td class="small">${schedaCell}</td>
        <td>${idx===0 && isCustom ? `<button class="danger sm" data-mid="${m.id}" data-act="deldripmodel">🗑</button>`:''}</td>
      </tr>`);
    });
  });
  body.innerHTML = rows.join('');
  body.querySelectorAll('[data-act=deldripmodel]').forEach(btn=> btn.onclick = ()=>{
    if(!confirm('Eliminare questo prodotto personalizzato?')) return;
    state.customModels = state.customModels.filter(m=>m.id!==btn.dataset.mid);
    renderDriplineModelTable(); queueSave();
  });
}
root.getElementById('btnAddDriplineModel').onclick = ()=>{
  const brand = prompt('Marca:'); if(!brand) return;
  const model = prompt('Modello / linea prodotto:'); if(!model) return;
  const spacingCm = parseFloat(prompt('Spaziatura tra i gocciolatori (cm):','30'))||30;
  const flowPerDripperLh = parseFloat(prompt('Portata per singolo gocciolatore (l/h):','2'))||2;
  const suggestedPerMeter = spacingCm>0 ? Math.round((100/spacingCm)*flowPerDripperLh*100)/100 : 0;
  const flowPerMeterLh = parseFloat(prompt('Portata per metro di tubo (l/h·m) — calcolata da spaziatura e portata gocciolatore, modificabile:', suggestedPerMeter)) || suggestedPerMeter;
  const datasheetUrl = prompt('Link alla scheda tecnica (opzionale, lascia vuoto se non disponibile):','') || '';
  const variantLabel = `${flowPerDripperLh} l/h @ ${spacingCm} cm`;
  const m = {id:uid(), brand, model, type:'dripline', source:'Personalizzato', datasheetUrl,
    variants:[{id:variantLabel, spacingCm, flowPerDripperLh, flowPerMeterLh}]};
  state.customModels.push(m);
  renderDriplineModelTable(); queueSave();
  toast('Tubo gocciolante aggiunto al database','ok');
};

function renderPlantTable(){
  const body=root.getElementById('plantTableBody'); if(!body)return;
  body.innerHTML=allPlants().map(p=>{const u=plantSourceUrl(p);return `<tr><td>${escapeHtml(p.category)}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.scientific||'—')}</td><td>${Number(p.kc).toFixed(2)}</td><td>${Number(p.rootDepth).toFixed(2)}</td><td>${p.targetMoisture}%</td><td>${u?`<a href="${u}" target="_blank" rel="noopener">${escapeHtml(p.source)} ↗</a>`:escapeHtml(p.source)}</td><td><span class="pill ${p.confidence==='A'?'leaf':''}">${p.confidence}</span></td><td>${state.customPlants.some(x=>x.id===p.id)?`<button class="danger sm" data-pid="${p.id}">🗑</button>`:''}</td></tr>`}).join('');
  body.querySelectorAll('[data-pid]').forEach(b=>b.onclick=()=>{state.customPlants=state.customPlants.filter(p=>p.id!==b.dataset.pid);state.zones.forEach(z=>{if(z.plantProfileId===b.dataset.pid)z.plantProfileId='grass-cool'});renderPlantTable();renderZones();queueSave()});
}
root.getElementById('btnAddPlant').onclick=()=>{
  const name=prompt('Nome comune:');if(!name)return;const scientific=prompt('Nome scientifico / varietà:','')||'';const category=prompt('Categoria (Prato, Orto, Aromatica, Ornamentale, Albero, Frutteto, Siepe):','Ornamentale')||'Personalizzata';
  const kc=Math.max(.05,parseFloat(prompt('Coefficiente idrico Kc/Ks:','0.55'))||.55),rootDepth=Math.max(.1,parseFloat(prompt('Profondità radicale (m):','0.5'))||.5),targetMoisture=Math.max(1,Math.min(100,parseFloat(prompt('Umidità obiettivo (%):','50'))||50));
  state.customPlants.push({id:'plant-'+uid(),category,name,scientific,kc,rootDepth,targetMoisture,source:'Personalizzato',confidence:'D'});renderPlantTable();renderZones();queueSave();
};

/* ============================================================
   3D ENGINE (Three.js) — condiviso tra Home dashboard e Gestione
   ============================================================ */
let mode3D = false, dirty3D = true, previewWater3D = false;
let renderer3D=null, scene3D=null, camera3D=null, controls3D=null, group3D=null;
let particleSystems3D = {};       // irrigatori
let driplineParticles3D = {};     // tubi gocciolanti
let current3DContainer = null;
let origin3D = {cx:0,cy:0};
let camera3DFramed=false, resizeObserver3D=null;
let animationFrame3D=null, scene3DRunning=false, panelConnected=true;

function toWorld3D(px,py){
  return [ (px-origin3D.cx)*state.metersPerPixel, (py-origin3D.cy)*state.metersPerPixel ];
}

function init3D(){
  renderer3D = new THREE.WebGLRenderer({antialias:true,alpha:true});
  Object.assign(renderer3D.domElement.style,{position:'absolute',inset:'0',display:'block',width:'100%',height:'100%'});
  renderer3D.setPixelRatio(Math.min(window.devicePixelRatio||1, window.innerWidth<700?1.5:2));
  renderer3D.shadowMap.enabled = true;
  renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;
  if(!renderer3D.getContext()) console.error('[IrrigaHA 3D] Contesto WebGL non creato — la GPU/browser potrebbe non supportarlo.');

  // Difesa generica (non più legata a un iframe): alcuni browser possono comunque
  // liberare il contesto WebGL per risparmio risorse (GPU sotto pressione, scheda in
  // background). Senza intercettare l'evento e richiamare preventDefault(), il contesto
  // non verrebbe mai ripristinato automaticamente.
  renderer3D.domElement.addEventListener('webglcontextlost', (e)=>{
    e.preventDefault();
    console.warn('[IrrigaHA 3D] Contesto WebGL perso (es. GPU sotto pressione). In attesa di ripristino…');
  }, false);
  renderer3D.domElement.addEventListener('webglcontextrestored', ()=>{
    console.warn('[IrrigaHA 3D] Contesto WebGL ripristinato — ricostruisco la scena.');
    dirty3D = true;
  }, false);

  scene3D = new THREE.Scene();
  scene3D.background = null;
  scene3D.fog = new THREE.Fog(0x10231d, 35, 150);

  camera3D = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera3D.position.set(16,15,16);

  controls3D = new OrbitControls(camera3D, renderer3D.domElement);
  controls3D.target.set(0,0,0);
  controls3D.maxPolarAngle = Math.PI*0.49;
  controls3D.minDistance = 3; controls3D.maxDistance = 140;
  controls3D.enableDamping = true; controls3D.dampingFactor = 0.08;

  const hemi = new THREE.HemisphereLight(0xbfe3d0, 0x16241f, 0.95);
  scene3D.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.05);
  sun.position.set(22,32,12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.bias=-0.0004;sun.shadow.normalBias=.025;
  sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;
  scene3D.add(sun);

  // Pavimento + griglia SEMPRE presenti, indipendenti da group3D/rebuildStaticMeshes3D:
  // così la scena non è mai completamente vuota — se il renderer funziona, si vede
  // sempre qualcosa (utile anche per capire a colpo d'occhio se il problema è "il
  // renderer non parte" oppure "i dati del giardino non sono ancora arrivati").
  // DIAGNOSTICA TEMPORANEA: colore acceso e inconfondibile (invece del verde scuro,
  // troppo simile allo sfondo per capire se il canvas dipinge davvero qualcosa).
  // Se anche questo piano magenta non si vede, il problema è di sicuro CSS/stacking,
  // non Three.js/WebGL — quando risolto va rimesso al colore originale 0x16241f.
  group3D = new THREE.Group();
  scene3D.add(group3D);

  resizeObserver3D=new ResizeObserver(()=>requestAnimationFrame(()=>{resize3D();if(root.getElementById('screen-home').classList.contains('active'))drawHomeIso();}));

  start3DLoop();
}

function start3DLoop(){
  if(scene3DRunning || !panelConnected || document.hidden)return;
  scene3DRunning=true;
  animationFrame3D=requestAnimationFrame(animate3D);
}
function pause3DLoop(){
  scene3DRunning=false;
  if(animationFrame3D!==null){cancelAnimationFrame(animationFrame3D);animationFrame3D=null;}
}
function handleDocumentVisibility(){if(document.hidden)pause3DLoop();else start3DLoop();}
document.addEventListener('visibilitychange',handleDocumentVisibility);

let meshRebuildFailedOnce = false;
function safeRebuildStaticMeshes3D(){
  try{
    rebuildStaticMeshes3D();
    return true;
  }catch(err){
    console.error('[IrrigaHA 3D] Errore nella ricostruzione della scena 3D:', err);
    if(!meshRebuildFailedOnce){
      meshRebuildFailedOnce = true;
      toast('Errore nel disegno 3D (vedi console del browser) — la vista mostra solo il terreno base finché non risolvi i dati sulla mappa.','err');
    }
    return false;
  }
}

/* FIX DEFINITIVO (3.0.2): invece di affidarsi a un singolo tentativo e sperare
   che il contenitore abbia già una dimensione reale in quel preciso istante
   (dipende da esattamente QUANDO Home Assistant collega l'elemento e imposta
   `hass` — un dettaglio del suo ciclo di vita interno che non possiamo
   controllare né prevedere con certezza), riprova per un breve numero di
   frame finché il contenitore non risulta davvero dimensionato. Elimina alla
   radice la classe di bug "funziona solo dopo un'interazione manuale": non
   serve più indovinare il momento giusto, lo si attende con certezza. */
function attach3D(container){
  if(!renderer3D) init3D();
  start3DLoop();
  if(current3DContainer!==container){
    container.appendChild(renderer3D.domElement);
    if(current3DContainer&&resizeObserver3D)resizeObserver3D.unobserve(current3DContainer);
    current3DContainer = container;
    if(resizeObserver3D)resizeObserver3D.observe(container);
    dirty3D = true;
  }
  let tries = 0;
  const tryRender = ()=>{
    const sized = resize3D();
    if(!sized && tries < 90){ tries++; requestAnimationFrame(tryRender); return; }
    if(dirty3D){dirty3D=!safeRebuildStaticMeshes3D();camera3DFramed=false;}
    center3DView();
    if(renderer3D&&container.getClientRects().length){renderer3D.render(scene3D,camera3D);webglFrameCompleted();}
  };
  requestAnimationFrame(tryRender);
}

let lastSize3D = {w:0,h:0};
function resize3D(){
  if(!renderer3D || !current3DContainer) return false;
  const w = current3DContainer.clientWidth;
  const h = current3DContainer.clientHeight;
  if(w<40||h<40) return false;
  if(w===lastSize3D.w && h===lastSize3D.h) return true; // già corretto, nessun lavoro da rifare
  lastSize3D = {w,h};
  renderer3D.setSize(w,h,false);
  camera3D.aspect = w/h;
  camera3D.updateProjectionMatrix();
  return true;
}
window.addEventListener('resize', ()=> resize3D());

function center3DView(){
  if(!camera3D||!controls3D)return;
  const box=group3D&&group3D.children.length?new THREE.Box3().setFromObject(group3D):null;
  const valid=box&&!box.isEmpty();
  const center=valid?box.getCenter(new THREE.Vector3()):new THREE.Vector3(0,0,0);
  const size=valid?box.getSize(new THREE.Vector3()):new THREE.Vector3(8,1,8);
  const span=Math.max(4,size.x,size.z,size.y*2);
  const fov=THREE.MathUtils.degToRad(camera3D.fov);
  const distance=Math.max(7,(span/2)/Math.tan(fov/2)*1.35);
  controls3D.minDistance=Math.max(1,distance*.12);
  controls3D.maxDistance=Math.max(140,distance*8);
  controls3D.target.copy(center);controls3D.target.y=Math.max(0,center.y*.35);
  camera3D.position.set(center.x+distance*.82,Math.max(5,distance*.72),center.z+distance*.82);
  camera3D.near=Math.max(.02,distance/1000);camera3D.far=Math.max(300,distance*20);
  camera3D.updateProjectionMatrix();controls3D.update();camera3DFramed=true;resize3D();
}
root.getElementById('btnCenter3D').onclick=center3DView;

function disposeObject3D(obj){
  obj.traverse?.(node=>{
    if(node.geometry)node.geometry.dispose();
    if(node.material){if(Array.isArray(node.material))node.material.forEach(m=>m.dispose());else node.material.dispose();}
  });
}

function cylinderBetween(p1x,p1z,p2x,p2z,y,radius,material){
  const dx=p2x-p1x, dz=p2z-p1z;
  const len = Math.max(0.01, Math.hypot(dx,dz));
  const geo = new THREE.CylinderGeometry(radius,radius,len,6);
  const mesh = new THREE.Mesh(geo, material);
  const dir = new THREE.Vector3(dx,0,dz).normalize();
  mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir));
  mesh.position.set((p1x+p2x)/2, y, (p1z+p2z)/2);
  return mesh;
}

function buildDecorMesh3D(d, x, z){
  const g = new THREE.Group();
  const s = d.size||1;
  const bark=new THREE.MeshStandardMaterial({color:0x6b4327,roughness:1});
  const greens=[0x245f35,0x337d43,0x4b9d51,0x68b85d].map(color=>new THREE.MeshStandardMaterial({color,roughness:.92}));
  const leaf=(px,py,pz,scale,mat=greens[1])=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(scale,1),mat);m.position.set(px,py,pz);m.scale.y=.8+((px+pz+2)%1)*.25;g.add(m);return m};
  if(d.kind==='albero'){
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.09*s,.14*s,1.15*s,10),bark);trunk.position.y=.575*s;g.add(trunk);
    [[0,.78,0,.10],[-.18,1.05,.04,.055],[.18,1.08,-.02,.055]].forEach(([bx,by,bz,r],i)=>{if(i){const branch=new THREE.Mesh(new THREE.CylinderGeometry(r*s,r*1.25*s,.65*s,7),bark);branch.position.set(bx*s,by*s,bz*s);branch.rotation.z=i===1?-.62:.62;g.add(branch)}});
    [[-.42,1.28,.06,.48,0],[.4,1.3,-.08,.5,1],[0,1.62,0,.58,2],[-.15,1.83,.2,.42,3],[.15,1.55,-.38,.4,1],[.02,1.35,.35,.42,2]].forEach(([px,py,pz,r,mi])=>leaf(px*s,py*s,pz*s,r*s,greens[mi]));
  } else if(d.kind==='siepe'){
    for(let i=-3;i<=3;i++){leaf(i*.25*s,.42*s,(i%2)*.06*s,.32*s,greens[(i+7)%greens.length]);leaf(i*.25*s,.68*s,-(i%2)*.05*s,.27*s,greens[(i+9)%greens.length])}
  } else if(d.kind==='cespuglio'){
    [[-.3,.3,0,.35],[.3,.32,.05,.34],[0,.55,-.08,.42],[-.08,.3,.3,.3]].forEach((v,i)=>leaf(v[0]*s,v[1]*s,v[2]*s,v[3]*s,greens[i]));
  } else {
    const stemMat=new THREE.MeshStandardMaterial({color:0x2f7f42,roughness:.85});
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2,stem=new THREE.Mesh(new THREE.CylinderGeometry(.012*s,.018*s,.45*s,5),stemMat);stem.position.set(Math.cos(a)*.12*s,.22*s,Math.sin(a)*.12*s);stem.rotation.z=Math.cos(a)*.45;stem.rotation.x=Math.sin(a)*.45;g.add(stem);const l=leaf(Math.cos(a)*.27*s,.4*s,Math.sin(a)*.27*s,.13*s,greens[i%4]);l.scale.set(1.6,.55,.8);l.rotation.y=-a}
    const flower=new THREE.Mesh(new THREE.SphereGeometry(.08*s,10,8),new THREE.MeshStandardMaterial({color:0xe5b94d,emissive:0x4a2d00,emissiveIntensity:.15}));flower.position.y=.52*s;g.add(flower);
  }
  g.position.set(x,0,z);
  return g;
}

function polylineWorldLength(worldPts){
  let len=0;
  for(let i=1;i<worldPts.length;i++){ const [x1,z1]=worldPts[i-1], [x2,z2]=worldPts[i]; len += Math.hypot(x2-x1,z2-z1); }
  return len;
}
function pointAtWorldDistance(worldPts, dist){
  let acc=0;
  for(let i=1;i<worldPts.length;i++){
    const [x1,z1]=worldPts[i-1], [x2,z2]=worldPts[i];
    const segLen = Math.hypot(x2-x1,z2-z1);
    if(dist<=acc+segLen || i===worldPts.length-1){
      const t = segLen>0 ? Math.max(0,Math.min(1,(dist-acc)/segLen)) : 0;
      return [x1+(x2-x1)*t, z1+(z2-z1)*t];
    }
    acc += segLen;
  }
  return worldPts[worldPts.length-1];
}

function rebuildStaticMeshes3D(){
  if(!group3D) return;
  while(group3D.children.length){const c=group3D.children[group3D.children.length-1];group3D.remove(c);disposeObject3D(c);}
  particleSystems3D = {};
  driplineParticles3D = {};

  let pts=[];
  state.areas.forEach(a=>a.points.forEach(p=>pts.push(p)));
  state.sprinklers.forEach(s=>pts.push([s.x,s.y]));
  state.sensors.forEach(s=>pts.push([s.x,s.y]));
  state.driplines.forEach(d=>d.points.forEach(p=>pts.push(p)));
  state.decor.forEach(d=>pts.push([d.x,d.y]));
  const plotW=Math.max(2,Number(state.plot.widthM)||50),plotH=Math.max(2,Number(state.plot.heightM)||31);
  if(pts.length===0) origin3D={cx:canvas.width/2,cy:canvas.height/2};
  else {
    origin3D.cx=pts.reduce((s,p)=>s+p[0],0)/pts.length;
    origin3D.cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  }

  // Il lotto deve esistere anche prima che l'utente disegni aree o collochi
  // dispositivi. Nelle versioni precedenti il return sul progetto senza punti
  // lasciava la scena composta dal solo colore di sfondo.
  const projectBase=new THREE.Mesh(
    new THREE.BoxGeometry(plotW,.18,plotH),
    new THREE.MeshStandardMaterial({color:0x0a1512,roughness:1,metalness:0})
  );
  projectBase.position.set(0,.05,0);projectBase.receiveShadow=true;projectBase.castShadow=false;projectBase.userData.flatSurface=true;group3D.add(projectBase);
  const border=new THREE.LineSegments(
    new THREE.EdgesGeometry(projectBase.geometry),
    new THREE.LineBasicMaterial({color:0x17362b,transparent:true,opacity:.35})
  );
  border.position.copy(projectBase.position);group3D.add(border);

  // Nessun altro oggetto da costruire: il lotto resta comunque visibile e la
  // camera lo inquadra attraverso la sua bounding box reale.
  if(pts.length===0)return;

  // Le aree usano la stessa sequenza di punti dell'editor 2D. ShapeGeometry è
  // intenzionalmente preferita all'estrusione: tollera meglio poligoni concavi
  // e non può far sparire l'intera area per un bevel non calcolabile.
  state.areas.forEach((a,areaIndex)=>{
    try{
      if(!Array.isArray(a.points)||a.points.length<3)return;
      const style = AREA_TYPE_FILL[a.type] || AREA_TYPE_FILL.prato;
      const colorHex = a.color || style.base;
      const shape = new THREE.Shape();
      const outline=[];
      a.points.forEach(([px,py],i)=>{
        const [x,z] = toWorld3D(px,py);
        i===0 ? shape.moveTo(x,-z) : shape.lineTo(x,-z);
        outline.push(new THREE.Vector3(x,.185+areaIndex*.004,z));
      });
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape);
      const rough = a.type==='ghiaia' ? 1 : a.type==='terra' ? 1 : 0.85;
      const mat = new THREE.MeshStandardMaterial({
        color:new THREE.Color(colorHex),side:THREE.DoubleSide,roughness:rough,metalness:0,
        polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,depthWrite:true
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI/2;
      mesh.position.y = .18+areaIndex*.004;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.userData.flatSurface=true;
      group3D.add(mesh);
      outline.push(outline[0].clone());
      const edge=new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(outline),
        new THREE.LineBasicMaterial({color:new THREE.Color(style.line||colorHex),transparent:true,opacity:.95})
      );
      group3D.add(edge);
    }catch(e){
      console.error('[IrrigaHA 3D] Area non costruita:',a?.id||a?.name,e);
    }
  });

  // sensors as small posts
  state.sensors.forEach(se=>{
    const [x,z] = toWorld3D(se.x, se.y);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.5,8), new THREE.MeshStandardMaterial({color:0x2c4a54}));
    post.position.set(x,0.25,z);
    group3D.add(post);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08,10,10), new THREE.MeshStandardMaterial({color:0x3fa6cf, emissive:0x1a5c74, emissiveIntensity:0.4}));
    head.position.set(x,0.52,z);
    group3D.add(head);
  });

  // decor: alberi, siepi, cespugli, piante (solo visivo)
  state.decor.forEach(d=>{
    const [x,z] = toWorld3D(d.x, d.y);
    group3D.add(buildDecorMesh3D(d, x, z));
  });

  // driplines: catena di piccoli cilindri lungo il percorso + sistema particelle a goccia
  state.driplines.forEach(dl=>{
    const zone = zoneById(dl.zoneId);
    const colorHex = zone ? zone.color : '#e0a83a';
    const mat = new THREE.MeshStandardMaterial({color:new THREE.Color(colorHex), roughness:0.8});
    const worldPts = dl.points.map(([px,py])=>toWorld3D(px,py));
    for(let i=1;i<worldPts.length;i++){
      const [x1,z1]=worldPts[i-1], [x2,z2]=worldPts[i];
      group3D.add(cylinderBetween(x1,z1,x2,z2,.205,.02,mat));
    }
    const totalLen = polylineWorldLength(worldPts);
    if(totalLen>0.05){
      const N = Math.max(16, Math.min(140, Math.round(totalLen*7)));
      const positions = new Float32Array(N*3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
      const pmat = new THREE.PointsMaterial({color:0xccefff, size:0.095, transparent:true, opacity:0.95, depthWrite:false});
      const points = new THREE.Points(geo, pmat);
      points.visible = false;
      points.userData = {dl, worldPts, totalLen, offsets: Array.from({length:N}, ()=>Math.random())};
      group3D.add(points);
      driplineParticles3D[dl.id] = points;
    }
  });

  // sprinklers: riser + head + particle system
  state.sprinklers.forEach(sp=>{
    const [x,z] = toWorld3D(sp.x, sp.y);
    const zone = zoneById(sp.zoneId);
    const color = new THREE.Color(zone ? zone.color : '#8fa79c');
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,0.35,10), new THREE.MeshStandardMaterial({color:0x33403a}));
    riser.position.set(x,0.175,z);
    group3D.add(riser);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09,10,10), new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:0.3}));
    head.position.set(x,0.38,z);
    group3D.add(head);

    const N = sp.type==='drip' ? 28 : 120;
    const positions = new Float32Array(N*3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    const mat = new THREE.PointsMaterial({color:0xd7f3ff, size:sp.type==='drip'?0.085:0.12, transparent:true, opacity:0.98, depthWrite:false});
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.userData = {sp, x, z, offsets: Array.from({length:N}, ()=>Math.random())};
    group3D.add(points);
    particleSystems3D[sp.id] = points;
  });
  group3D.traverse(node=>{
    if(node.isMesh){node.castShadow=!node.userData.flatSurface;node.receiveShadow=true;}
  });
}

function updateParticles3D(tSec){
  Object.values(particleSystems3D).forEach(points=>{
    const sp = points.userData.sp;
    const active = previewWater3D || activeZones.has(sp.zoneId);
    points.visible = active;
    if(!active) return;
    const zone = zoneById(sp.zoneId);
    const rM = Math.max(0.4, computeSprinklerRadiusM(sp, zone?zone.pressureBar:null));
    const model = getModel(sp.modelId);
    const isRotor = model ? model.type==='rotor' : sp.type==='rotor';
    const arcSpan = Math.max(1, sp.angleEnd - sp.angleStart);
    let centerAngle = sp.angleStart + arcSpan/2;
    if(sp.type!=='drip' && isRotor){
      const period=7.5; let phase=(tSec%period)/period; if(phase>0.5) phase=1-phase; phase*=2;
      centerAngle = sp.angleStart + phase*arcSpan;
    }
    const arr = points.geometry.attributes.position.array;
    const offsets = points.userData.offsets;
    const heightScale = sp.type==='drip' ? 0.12 : Math.min(2.2, 0.65+rM*0.09);
    for(let i=0;i<offsets.length;i++){
      const u = (tSec*(sp.type==='drip'?0.12:0.22) + offsets[i]) % 1;
      let ang;
      if(sp.type!=='drip' && isRotor){ ang = centerAngle + (offsets[i]-0.5)*16; }
      else { ang = sp.angleStart + offsets[i]*arcSpan; }
      const angRad = (sp.rotation+ang-90)*Math.PI/180;
      const dist = u*rM;
      const height = 0.38 + Math.sin(u*Math.PI)*heightScale;
      arr[i*3]   = points.userData.x + Math.cos(angRad)*dist;
      arr[i*3+1] = height;
      arr[i*3+2] = points.userData.z + Math.sin(angRad)*dist;
    }
    points.geometry.attributes.position.needsUpdate = true;
  });

  Object.values(driplineParticles3D).forEach(points=>{
    const dl = points.userData.dl;
    const active = previewWater3D || activeZones.has(dl.zoneId);
    points.visible = active;
    if(!active) return;
    const {worldPts, totalLen, offsets} = points.userData;
    const arr = points.geometry.attributes.position.array;
    for(let i=0;i<offsets.length;i++){
      const u = (tSec*0.035 + offsets[i]) % 1;
      const [x,z] = pointAtWorldDistance(worldPts, u*totalLen);
      const drip = (tSec*1.2 + offsets[i]*10) % 1;
      arr[i*3]=x; arr[i*3+1]=0.18 - drip*0.17; arr[i*3+2]=z;
    }
    points.geometry.attributes.position.needsUpdate = true;
  });
}

/* GAP STRUTTURALE VERIFICATO (rilettura completa del codice, non un'ipotesi):
   questo loop gira per sempre una volta avviato, ma prima d'ora non richiamava
   MAI resize3D() — si affidava solo al tentativo con limite di attach3D()
   (90 fotogrammi, poi si arrende per sempre) e al ResizeObserver. Se nessuno
   dei due riesce a catturare la dimensione reale entro quella finestra, il
   canvas resta bloccato alla dimensione sbagliata per sempre, anche se il
   loop di rendering continua a girare indefinitamente. Richiamando resize3D()
   qui, ad ogni fotogramma per tutta la vita del componente, qualunque cosa
   renda il contenitore correttamente dimensionato — prima o poi, per
   qualunque motivo — viene comunque intercettata al fotogramma successivo:
   nessuna finestra di tentativi che possa scadere. Costo trascurabile:
   resize3D() si ferma subito se le dimensioni non sono cambiate rispetto
   all'ultima volta.*/
function animate3D(t){
  if(!scene3DRunning)return;
  resize3D();
  if(dirty3D){dirty3D=!safeRebuildStaticMeshes3D();camera3DFramed=false;}
  if(!camera3DFramed)center3DView();
  updateParticles3D((t||0)/1000);
  if(controls3D) controls3D.update();
  if(renderer3D && current3DContainer && current3DContainer.getClientRects().length){renderer3D.render(scene3D,camera3D);webglFrameCompleted();}
  animationFrame3D=requestAnimationFrame(animate3D);
}

root.getElementById('view3DBtn').onclick = ()=>{
  mode3D = true;
  previewWater3D = true;
  root.getElementById('view3DBtn').classList.add('active');
  root.getElementById('view2DBtn').classList.remove('active');
  root.getElementById('btnCenter3D').style.display='inline-flex';
  root.getElementById('btnPreviewWater3D').style.display='inline-flex';
  root.getElementById('btnPreviewWater3D').classList.add('active');
  root.getElementById('btnPreviewWater3D').textContent='💦 Anteprima acqua: ON';
  root.getElementById('canvas2dArea').style.display='none';
  root.getElementById('canvas3dWrap').style.display='block';
  root.getElementById('help3d').style.display='block';
  root.getElementById('toolHelp').style.display='none';
  attach3D(root.getElementById('canvas3dWrap'));
};
root.getElementById('view2DBtn').onclick = ()=>{
  mode3D = false;
  previewWater3D = false;
  root.getElementById('view2DBtn').classList.add('active');
  root.getElementById('view3DBtn').classList.remove('active');
  root.getElementById('btnCenter3D').style.display='none';
  root.getElementById('btnPreviewWater3D').style.display='none';
  root.getElementById('canvas2dArea').style.display='block';
  root.getElementById('canvas3dWrap').style.display='none';
  root.getElementById('help3d').style.display='none';
  root.getElementById('toolHelp').style.display='block';
  resizeCanvasToDisplay();
};
root.getElementById('btnPreviewWater3D').onclick=()=>{
  previewWater3D=!previewWater3D;
  const button=root.getElementById('btnPreviewWater3D');
  button.classList.toggle('active',previewWater3D);
  button.textContent='💦 Anteprima acqua: '+(previewWater3D?'ON':'OFF');
};

/* ============================================================
   HOME DASHBOARD
   ============================================================ */
const WEATHER_ICONS = {
  'clear-night':'🌙','cloudy':'☁️','exceptional':'⚠️','fog':'🌫️','hail':'🌨️',
  'lightning':'⛈️','lightning-rainy':'⛈️','partlycloudy':'⛅','pouring':'🌧️',
  'rainy':'🌧️','snowy':'❄️','snowy-rainy':'🌨️','sunny':'☀️','windy':'💨','windy-variant':'💨'
};
const OP_EVENT_LABELS={zone_start_requested:'Richiesta avvio zona',zone_valve_on:'Valvola zona aperta',pump_on:'Pompa avviata',pump_off:'Pompa arrestata',zone_valve_off:'Valvola zona chiusa',zone_cycle_complete:'Ciclo zona completato',pump_off_emergency:'Arresto pompa',zone_valve_off_emergency:'Chiusura valvola di sicurezza'};
function logTime(item){const d=new Date(item.timestamp||item.ts||0);return Number.isNaN(d.getTime())?null:d;}
function operationLogTable(items){
  if(!items.length)return '<div class="empty">Nessuna operazione nel periodo selezionato.</div>';
  return `<table><thead><tr><th>Data e ora</th><th>Operazione</th><th>Zona</th><th>Origine</th><th>Durata</th><th>Litri</th><th>Dettagli</th></tr></thead><tbody>${items.map(item=>{const d=logTime(item);return `<tr><td>${d?d.toLocaleString('it-IT'):'—'}</td><td>${escapeHtml(OP_EVENT_LABELS[item.event]||item.event||'Operazione')}</td><td>${escapeHtml(item.zone_name||item.zone_id||'—')}</td><td>${escapeHtml(item.source||'—')}</td><td>${item.minutes!=null?Number(item.minutes).toFixed(2)+' min':'—'}</td><td>${item.liters!=null?Number(item.liters).toFixed(1)+' L':'—'}</td><td>${escapeHtml(item.detail||'')}</td></tr>`}).join('')}</tbody></table>`;
}
function renderPersistentLogs(){
  const all=[...(nativeAutomation.operation_log||[])].sort((a,b)=>(logTime(b)?.getTime()||0)-(logTime(a)?.getTime()||0));
  const day=all.filter(item=>(logTime(item)?.getTime()||0)>=Date.now()-86400000),month=all.filter(item=>(logTime(item)?.getTime()||0)>=Date.now()-31*86400000);
  const home=root.getElementById('homeOperationLog'),settings=root.getElementById('settingsOperationLog');
  if(home)home.innerHTML=operationLogTable(day);if(settings)settings.innerHTML=operationLogTable(month);
  const count=root.getElementById('homeLogCount');if(count)count.textContent=day.length;
  renderEvaluationLog();
}
function renderEvaluationLog(){
  const el=root.getElementById('autoLog');if(!el)return;
  const logs=[...(nativeAutomation.evaluation_log||[])].sort((a,b)=>(logTime(b)?.getTime()||0)-(logTime(a)?.getTime()||0));
  el.innerHTML=logs.length?logs.map(item=>{const plans=Object.values(item.plans||{}),run=plans.filter(p=>Number(p.minutes)>0).length,blocked=plans.filter(p=>p.blocked_reason).length;return `<div class="log-entry ${blocked?'skip':'run'}"><b>${logTime(item)?.toLocaleString('it-IT')||'—'} · ${escapeHtml(item.source||'verifica')}</b><br>Meteo ${item.temperature??'—'} °C · umidità ${item.humidity??'—'}% · pioggia ${item.rain_probability??'—'}% · zone pianificate ${run}${blocked?' · bloccate '+blocked:''}</div>`}).join(''):'<div class="empty">Nessuna verifica registrata negli ultimi 90 giorni.</div>';
}
function renderDailyLiters(){
  let liters=Number(nativeAutomation.committed_today_liters);
  if(!Number.isFinite(liters)){const today=new Date().toLocaleDateString('sv-SE');liters=(nativeAutomation.water_ledger||[]).filter(item=>{const d=logTime(item);return d&&d.toLocaleDateString('sv-SE')===today}).reduce((sum,item)=>sum+Number(item.liters||0),0);}
  if(nativeAutomation.running&&nativeAutomation.active_started_at){const seconds=Math.max(0,(Date.now()-new Date(nativeAutomation.active_started_at).getTime())/1000);liters+=seconds/60*Number(nativeAutomation.active_flow_l_min||0);}
  const el=root.getElementById('homeDailyLiters');if(el)el.textContent='Oggi: '+liters.toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})+' L';
}
async function refreshRuntime(){
  try{const runtime=await nativeCall('runtime');Object.assign(nativeAutomation,{running:!!runtime.running,active_zone:runtime.active_zone||null,active_started_at:runtime.active_started_at||null,active_flow_l_min:Number(runtime.active_flow_l_min)||0,committed_today_liters:Number(runtime.committed_today_liters)||0});renderDailyLiters();}catch(_err){}
}
function nextAutomaticRun(){
  if(!state.auto.enabled)return null;
  const [hour,minute]=(state.auto.startTime||'06:00').split(':').map(Number);
  const enabled=DAY_KEYS.map((key,index)=>state.auto.days[key]===true?index:null).filter(v=>v!==null);
  if(!enabled.length)return null;
  const now=new Date();
  for(let offset=0;offset<8;offset++){
    const candidate=new Date(now);candidate.setDate(now.getDate()+offset);candidate.setHours(hour||0,minute||0,0,0);
    const mondayIndex=(candidate.getDay()+6)%7;
    if(enabled.includes(mondayIndex)&&candidate>now)return candidate;
  }
  return null;
}
function renderHomeSchedule(){
  const el=root.getElementById('homeScheduleSummary');if(!el)return;
  if(!state.auto.enabled){el.innerHTML='<div class="log-entry skip"><b>Modalità automatica disattivata</b></div><div class="small muted">Attivala nella scheda Automatico per abilitare controlli e irrigazioni pianificate.</div>';return;}
  const next=nextAutomaticRun(), plans=nativeAutomation.plans||{};
  const planned=state.zones.map(z=>({z,p:plans[z.id]})).filter(x=>Number(x.p?.minutes)>0);
  const last=nativeAutomation.last_evaluation?new Date(nativeAutomation.last_evaluation):null;
  el.innerHTML=`<div class="stat-row"><span class="muted">Stato</span><span class="pill leaf">Automatica attiva</span></div>
    <div class="stat-row"><span class="muted">Prossima irrigazione</span><b>${next?next.toLocaleString('it-IT',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'nessun giorno attivo'}</b></div>
    <div class="stat-row"><span class="muted">Ultima rivalutazione</span><span>${last&&!Number.isNaN(last.getTime())?last.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'non ancora eseguita'}</span></div>
    <div class="small muted" style="margin-top:9px">${planned.length?planned.map(x=>`${escapeHtml(x.z.name)}: ${Number(x.p.minutes).toFixed(1)} min · ${Math.round(Number(x.p.liters)||0)} l`).join('<br>'):'Nessuna zona richiede acqua nel piano corrente.'}</div>`;
}
async function refreshNativeAutomation(){
  try{
    const runtime=await nativeCall('automation');
    nativeAutomation={plans:runtime.config?.plans||{},last_evaluation:runtime.config?.last_evaluation||'',last_irrigation:runtime.config?.last_irrigation||{},operation_log:runtime.config?.operation_log||[],evaluation_log:runtime.config?.evaluation_log||[],water_ledger:runtime.config?.water_ledger||[],running:!!runtime.running,active_zone:runtime.active_zone||null,active_started_at:runtime.active_started_at||null,active_flow_l_min:Number(runtime.active_flow_l_min)||0,committed_today_liters:nativeAutomation.committed_today_liters};
    renderHomeSchedule();
    renderPersistentLogs();renderDailyLiters();
  }catch(_e){renderHomeSchedule();}
}
async function refreshHomeWeather(){
  const card = root.getElementById('homeWeatherCard');
  if(!state.auto.weatherEntity || !haConnected){ card.style.display='none'; return; }
  const st = await haGetState(state.auto.weatherEntity);
  if(!st){ card.style.display='none'; return; }
  let forecast=[];
  try{
    const result=await nativeCall('forecast',{entity_id:state.auto.weatherEntity});
    const response=result?.response||result;
    forecast=response?.[state.auto.weatherEntity]?.forecast||response?.forecast||[];
  }catch(_e){forecast=Array.isArray(st.attributes.forecast)?st.attributes.forecast:[];}
  forecast=forecast.slice(0,5);
  if(!forecast.length)forecast=[{datetime:new Date().toISOString(),condition:st.state,temperature:st.attributes.temperature,templow:st.attributes.temperature,precipitation_probability:st.attributes.precipitation_probability}];
  card.style.display='flex';
  card.innerHTML=forecast.map((day,index)=>{
    const date=day.datetime?new Date(day.datetime):new Date(Date.now()+index*86400000);
    const label=index===0?'oggi':date.toLocaleDateString('it-IT',{weekday:'short'});
    const high=day.temperature??day.native_temperature,low=day.templow??day.temperature_low,precip=day.precipitation_probability??day.precipitation;
    return `<div class="forecast-day"><b>${label}</b><div class="weather-icon">${WEATHER_ICONS[day.condition]||'🌤️'}</div><div class="temps">${high!=null?Math.round(high)+'°':'—'}${low!=null?' / '+Math.round(low)+'°':''}</div><div class="rain">${precip!=null?'Pioggia '+Math.round(precip)+'%':escapeHtml(day.condition||'')}</div></div>`;
  }).join('');
}
function renderHomeDashboard(){
  root.getElementById('homeZoneCount').textContent = state.zones.length;
  const quick = root.getElementById('homeZoneQuick');
  quick.innerHTML = state.zones.length===0
    ? '<div class="empty">Nessuna zona configurata ancora.</div>'
    : state.zones.map(z=>{
        const on = activeZones.has(z.id);
        return `<button class="zone-quick-btn ${on?'on':''}" data-zid="${z.id}" data-act="${on?'stop':'start'}">
          <span class="zq-name">${escapeHtml(z.name)}</span>
          <span class="zq-state">${on?'● attiva':'ferma'} · ${zoneTotalFlow(z.id).toFixed(1)} l/min</span>
        </button>`;
      }).join('');
  quick.querySelectorAll('button').forEach(btn=>{
    btn.onclick = ()=> btn.dataset.act==='start' ? startZoneManual(btn.dataset.zid) : stopZoneManual(btn.dataset.zid);
  });

  let totalFlow=0; activeZones.forEach(zid=> totalFlow+=zoneTotalFlow(zid));
  root.getElementById('homeFlowPill').textContent = 'Portata attiva: '+totalFlow.toFixed(1)+' l/min';

  root.getElementById('homeStatPump').textContent = pumpOn ? 'accesa' : 'spenta';
  root.getElementById('homeStatZones').textContent = activeZones.size;
  root.getElementById('homeStatAreas').textContent = state.areas.length;
  root.getElementById('homeStatSprinklers').textContent = state.sprinklers.length;
  root.getElementById('homeStatDriplines').textContent = state.driplines.length;
  root.getElementById('homeStatAuto').textContent = state.auto.enabled ? 'attivo' : 'disattivo';
  renderHomeSchedule();

  const hasContent = state.areas.length || state.sprinklers.length || state.driplines.length || state.decor.length;
  root.getElementById('homeEmptyHint').style.display = hasContent ? 'none' : 'flex';

  refreshHomeWeather();
}

async function stopEverything(){
  try{await nativeCall('stop_all');}catch(_err){await stopZonesSafely([...activeZones]);}
  activeZones.clear();pumpOn=false;
  stopTimerProgram();
  renderManualControl();
  renderHomeDashboard();
  toast('Tutte le zone e la pompa sono state fermate','ok');
  setTimeout(refreshNativeAutomation,500);
}
root.getElementById('btnEmergencyStop').onclick = stopEverything;
root.getElementById('btnHomeStop').onclick = stopEverything;
root.querySelectorAll('[data-home-view]').forEach(btn=>btn.onclick=()=>{
  root.querySelectorAll('[data-home-view]').forEach(item=>item.classList.toggle('active',item===btn));
  const logs=btn.dataset.homeView==='logs';root.getElementById('homeDashboardPanel').style.display=logs?'none':'grid';root.getElementById('homeLogPanel').classList.toggle('active',logs);if(logs)renderPersistentLogs();
});
root.getElementById('btnClearOperationLog').onclick=async()=>{
  if(!confirm('Eliminare definitivamente tutto il registro operativo? Questa operazione non è annullabile.'))return;
  try{const result=await nativeCall('clear_logs',{log_type:'operation'});toast('Eliminati '+(result.removed||0)+' record','ok');await refreshNativeAutomation();}catch(err){toast('Impossibile eliminare il registro: '+err.message,'err');}
};

function switchScreen(target){
  const home = root.getElementById('screen-home');
  const manage = root.getElementById('screen-manage');
  if(target==='home'){
    home.classList.add('active'); manage.classList.remove('active');
    previewWater3D=false;
    dirty3D=true;
    drawHomeIso();
    attach3D(root.getElementById('homeScene3d'));
    renderHomeDashboard();
  } else {
    manage.classList.add('active'); home.classList.remove('active');
    if(mode3D){ attach3D(root.getElementById('canvas3dWrap')); }
    else { resizeCanvasToDisplay(); } // fix: canvas 2D nascosto all'avvio finiva a larghezza 0
  }
}
root.getElementById('btnHomeSettings').onclick = ()=> switchScreen('manage');
root.getElementById('btnBackHome').onclick = ()=> switchScreen('home');

/* ============================================================
   PWA — installazione e service worker
   ============================================================ */
/* Il pannello è gestito e aggiornato da Home Assistant: nessun service worker
   separato, così gli aggiornamenti dell'integrazione non restano in cache. */

/* ============================================================
   INIT
   ============================================================ */
async function init(){
  await loadState();
  setSaveStatus('Caricato · rev. '+nativeLoadedRevision,'ok');
  root.getElementById('versionBadgeHome').textContent = 'v'+APP_VERSION;
  root.getElementById('versionBadgeManage').textContent = 'v'+APP_VERSION;
  root.getElementById('versionBadgeSettings').textContent = 'IRRIGAZIONE SMART v'+APP_VERSION;
  root.getElementById('btnExportYaml').style.display='none';
  root.getElementById('pumpMaxFlow').value = state.pump.maxFlowLmin;
  root.getElementById('pumpMaxPressure').value = state.pump.maxPressureBar;
  root.getElementById('pumpValveDelay').value = state.pump.valvePumpDelaySec;
  root.getElementById('plotWidthM').value = state.plot.widthM;
  root.getElementById('plotHeightM').value = state.plot.heightM;
  root.getElementById('rulerStepM').value = state.plot.rulerStepM;
  root.getElementById('plotSetup').style.display=state.plot.configured?'none':'grid';
  updateScaleHint();
  renderAutoDays();
  bindAutoFields();
  renderZones();
  renderLegend();
  resizeCanvasToDisplay();
  await haTestAndLoad();
  drawMap();
  dirty3D=true;camera3DFramed=false;
  switchScreen('home');
  refreshNativeAutomation();
  refreshRuntime();
  automationRefreshTimer=setInterval(refreshNativeAutomation,60000);
  weatherRefreshTimer=setInterval(refreshHomeWeather,5*60*1000);
  dailyLitersTimer=setInterval(renderDailyLiters,1000);
  runtimeRefreshTimer=setInterval(refreshRuntime,3000);
}
// FIX CRITICO: init() era definita ma non veniva mai invocata da nessun punto
// d'ingresso — l'app partiva quindi sempre con lo stato di default (vuoto),
// senza mai caricare i dati salvati dal backend. Chiamata qui, all'avvio vero
// e proprio del componente (una sola volta, vedi guardia this._booted più sotto).
init();

/* Se il custom element viene ricollegato al documento con la stessa istanza
   (Home Assistant può farlo tra una navigazione e l'altra), ricarica lo stato
   dal backend e ridisegna tutto: garantisce di vedere sempre l'ultimo dato
   salvato, anche se un'altra scheda del browser o un automatismo lo hanno nel
   frattempo modificato. Non ripete la registrazione degli intervalli (restano
   quelli creati da init() la prima volta) per evitare duplicati. */
  appHandle.onReconnect = async function(){
    await loadState();
    updateScaleHint();
    renderAutoDays();
    bindAutoFields();
    renderZones();
    renderLegend();
    resizeCanvasToDisplay();
    await haTestAndLoad();
    drawMap();
    renderHomeDashboard();
    drawHomeIso();
    dirty3D=true;camera3DFramed=false;
    if(root.getElementById('screen-home').classList.contains('active')) attach3D(root.getElementById('homeScene3d'));
    else if(mode3D) attach3D(root.getElementById('canvas3dWrap'));
  };
  appHandle.onDisconnect = function(){
    panelConnected=false;pause3DLoop();
    if(automationRefreshTimer){clearInterval(automationRefreshTimer);automationRefreshTimer=null;}
    if(weatherRefreshTimer){clearInterval(weatherRefreshTimer);weatherRefreshTimer=null;}
    if(dailyLitersTimer){clearInterval(dailyLitersTimer);dailyLitersTimer=null;}
    if(runtimeRefreshTimer){clearInterval(runtimeRefreshTimer);runtimeRefreshTimer=null;}
  };
  appHandle.onConnect = function(){
    panelConnected=true;start3DLoop();
    if(!automationRefreshTimer)automationRefreshTimer=setInterval(refreshNativeAutomation,60000);
    if(!weatherRefreshTimer)weatherRefreshTimer=setInterval(refreshHomeWeather,5*60*1000);
    if(!dailyLitersTimer)dailyLitersTimer=setInterval(renderDailyLiters,1000);
    if(!runtimeRefreshTimer)runtimeRefreshTimer=setInterval(refreshRuntime,3000);
  };
  appHandle.onPanelVisible = function(){
    panelConnected=true;lastSize3D={w:0,h:0};dirty3D=true;camera3DFramed=false;start3DLoop();
    homeIsoCanvas.style.opacity='1';
    const refresh=()=>{
      if(!root||!root.getElementById('screen-home').classList.contains('active'))return;
      drawHomeIso();attach3D(root.getElementById('homeScene3d'));resize3D();
      if(renderer3D&&scene3D&&camera3D){renderer3D.render(scene3D,camera3D);webglFrameCompleted();}
    };
    refresh();setTimeout(refresh,80);setTimeout(refresh,240);setTimeout(refresh,500);
  };
  appHandle.onPanelHidden = function(){pause3DLoop();};
  appHandle.onHassUpdated = function(){
    if(!hass||!haConnected)return;
    let changed=false;
    const nextPump=!!(state.pump.relayEntity&&['on','open'].includes(hass.states[state.pump.relayEntity]?.state));
    if(nextPump!==pumpOn){pumpOn=nextPump;changed=true;}
    state.zones.forEach(zone=>{
      const on=!!(zone.relayEntity&&['on','open'].includes(hass.states[zone.relayEntity]?.state));
      if(on!==activeZones.has(zone.id)){on?activeZones.add(zone.id):activeZones.delete(zone.id);changed=true;}
    });
    if(changed)renderHomeDashboard();
  };
}

class IrrigahaPanel extends ReactiveElement {
  static properties = {
    hass: { attribute: false },
    panel: { attribute: false },
    narrow: { attribute: false },
    route: { attribute: false },
  };

  /* Punto di avvio garantito: ReactiveElement invoca firstUpdated() una sola
     volta, dopo il primo ciclo di aggiornamento completato — che può partire
     SOLO a connessione avvenuta (il gate interno di ReactiveElement blocca
     ogni aggiornamento finché connectedCallback() non lo sblocca). Qui il
     layout del contenitore è quindi garantito reale, non un'ipotesi nostra
     sui tempi di Home Assistant. */
  firstUpdated(){
    this.renderRoot.innerHTML = TEMPLATE_HTML;
    root = this.renderRoot;
    this._maybeBoot();
  }

  /* Se `hass` arriva DOPO il primo aggiornamento (raro ma possibile),
     updated() se ne accorge e avvia comunque l'app qui. Se `hass` cambia di
     nuovo in seguito (HA lo fa spesso, ad ogni variazione di stato), tiene
     solo sincronizzata la variabile di modulo usata da nativeCall(): il
     resto della logica non ha bisogno di reagire a ogni singolo aggiornamento. */
  updated(changedProps){
    if(changedProps.has('hass')){
      hass = this.hass;
      this._maybeBoot();
      if(this._booted&&appHandle.onHassUpdated)appHandle.onHassUpdated();
    }
  }

  _maybeBoot(){
    if(!this._booted && root && this.hass){
      this._booted = true;
      hass = this.hass;
      bootApp();
    }
  }

  connectedCallback(){
    super.connectedCallback();
    if(!this._visibilityObserver){
      this._visibilityObserver=new IntersectionObserver(entries=>{
        const visible=entries.some(entry=>entry.isIntersecting&&entry.intersectionRect.width>1&&entry.intersectionRect.height>1);
        if(visible){if(appHandle.onPanelVisible)appHandle.onPanelVisible();}
        else if(appHandle.onPanelHidden)appHandle.onPanelHidden();
      },{threshold:[0,.01]});
    }
    this._visibilityObserver.observe(this);
    if(appHandle.onConnect)appHandle.onConnect();
    // Riconnessione di un'istanza GIÀ avviata in precedenza (Home Assistant
    // può riutilizzarla tra una navigazione e l'altra): ricarica e ridisegna
    // tutto. Alla primissima connessione (che porta a firstUpdated()/init())
    // _booted è ancora false a questo punto sincrono, quindi non scatta —
    // evita di duplicare il caricamento in corsa con quello iniziale.
    if(this._booted && appHandle.onReconnect) appHandle.onReconnect();
  }

  disconnectedCallback(){
    if(this._visibilityObserver)this._visibilityObserver.unobserve(this);
    if(appHandle.onDisconnect)appHandle.onDisconnect();
    super.disconnectedCallback();
  }
}

customElements.define('irrigaha-panel', IrrigahaPanel);
