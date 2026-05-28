// app.js — MediSafe Aidant — Style B + Dashboard

var _currentPatientId = null;
var _pinBuffer        = '';
var _patientTab       = 'today'; // today | history | ordonnances | profil

function initApp() {
  if (!window.AuthService || !window.PatientService) {
    document.getElementById('app').innerHTML = '<div style="padding:20px;color:red">Erreur chargement services.</div>';
    return;
  }
  PatientService.seedIfEmpty();
  Router.register('splash',         renderSplash);
  Router.register('pin',            renderPin);
  Router.register('dashboard',      renderDashboard);
  Router.register('patients',       renderPatients);
  Router.register('patient-detail', renderPatientDetail);
  Router.register('add-patient',    renderAddPatient);
  Router.register('add-medication',  renderAddMedication);
  Router.register('edit-medication', renderEditMedication);
  Router.register('edit-patient',    renderEditPatient);
  Router.register('add-ordonnance',  renderAddOrdonnance);
  Router.register('planning',       renderPlanning);
  Router.register('stats',          renderStats);
  Router.register('settings',       renderSettings);
  Router.go('splash');
}

// ============================================================
// SPLASH
// ============================================================
function renderSplash() {
  document.getElementById('app').innerHTML =
    '<div class="splash-screen">' +
      '<div class="splash-ring"><div class="splash-inner">' +
        '<i class="ti ti-shield-heart" style="font-size:38px;color:#fff" aria-hidden="true"></i>' +
      '</div></div>' +
      '<div><div class="splash-title">MEDISAFE</div>' +
        '<div class="splash-divider" style="margin:10px auto"></div>' +
        '<div class="splash-sub">Espace aidant</div></div>' +
      '<div class="splash-dots">' +
        '<div class="splash-dot active" id="sd0"></div>' +
        '<div class="splash-dot" id="sd1"></div>' +
        '<div class="splash-dot" id="sd2"></div>' +
      '</div>' +
    '</div>';
  var step=0;
  var iv=setInterval(function(){
    step++;
    [0,1,2].forEach(function(i){
      var d=document.getElementById('sd'+i);
      if(d) d.classList.toggle('active',i===step%3);
    });
  },500);
  setTimeout(function(){
    clearInterval(iv);
    if(AuthService.isAuthenticated()) Router.go('dashboard');
    else Router.go('pin');
  },2200);
}

// ============================================================
// PIN
// ============================================================
function renderPin() {
  _pinBuffer='';
  document.getElementById('app').innerHTML =
    '<div class="pin-screen">' +
      '<div class="pin-logo"><i class="ti ti-shield-heart" style="font-size:30px;color:#fff" aria-hidden="true"></i></div>' +
      '<div class="pin-card">' +
        '<h2 style="font-size:20px;margin-bottom:4px">Code PIN</h2>' +
        '<p class="text-muted">Entrez votre code à 8 chiffres</p>' +
        '<div class="pin-dots" id="pin-dots">'+Array(8).fill('<div class="pin-dot"></div>').join('')+'</div>' +
        '<p id="pin-msg" style="font-size:13px;color:#A32D2D;min-height:18px;text-align:center"></p>' +
        '<div class="pin-keypad">' +
          [1,2,3,4,5,6,7,8,9,'','0','⌫'].map(function(k){
            if(k==='') return '<div></div>';
            if(k==='⌫') return '<button class="pin-key pin-key-del" onclick="pinPress(\'del\')" aria-label="Effacer"><i class="ti ti-backspace" style="font-size:22px"></i></button>';
            return '<button class="pin-key" onclick="pinPress(\''+k+'\')">'+k+'</button>';
          }).join('') +
        '</div>' +
        '<p style="margin-top:24px;font-size:12px;color:var(--color-text-hint);text-align:center">PIN par défaut : 12345678</p>' +
      '</div>' +
    '</div>';
}

function pinPress(key) {
  if(key==='del') _pinBuffer=_pinBuffer.slice(0,-1);
  else if(_pinBuffer.length<8) _pinBuffer+=key;
  _updateDots(false);
  if(_pinBuffer.length===8) setTimeout(_validatePin,150);
}

function _updateDots(error) {
  document.querySelectorAll('.pin-dot').forEach(function(d,i){
    d.classList.remove('filled','error');
    if(error) d.classList.add('error');
    else if(i<_pinBuffer.length) d.classList.add('filled');
  });
}

function _validatePin() {
  if(AuthService.checkPin(_pinBuffer)){ AuthService.login(); Router.go('dashboard'); }
  else {
    _updateDots(true);
    var m=document.getElementById('pin-msg');
    if(m) m.textContent='Code incorrect, réessayez.';
    setTimeout(function(){ _pinBuffer=''; _updateDots(false); if(m) m.textContent=''; },900);
  }
}

// ============================================================
// NAV — 5 onglets avec dashboard
// ============================================================
function _nav(active) {
  var patients=PatientService.getPatients();
  var alerts=patients.filter(function(p){ return PatientService.getPatientSummary(p.id).missed>0; }).length;
  var tabs=[
    {id:'dashboard', icon:'ti-layout-dashboard', label:'Accueil'},
    {id:'patients',  icon:'ti-users',            label:'Patients'},
    {id:'planning',  icon:'ti-calendar',         label:'Planning'},
    {id:'stats',     icon:'ti-chart-bar',        label:'Stats'},
    {id:'settings',  icon:'ti-settings',         label:'Réglages'},
  ];
  return '<nav class="bottom-nav">' +
    tabs.map(function(t){
      var badge=(t.id==='dashboard'&&alerts>0)?'<span class="nav-badge">'+alerts+'</span>':'';
      return '<button class="nav-item'+(t.id===active?' active':'')+'" onclick="Router.go(\''+t.id+'\')" aria-label="'+t.label+'">'+
        badge+'<i class="ti '+t.icon+'" aria-hidden="true"></i>'+t.label+
      '</button>';
    }).join('')+
  '</nav>';
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  var patients = PatientService.getPatients();
  var today    = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  var MOMENTS  = PatientService.MOMENTS;

  // Stats globales
  var totalMissed=0, totalTaken=0, totalPending=0, totalMeds=0;
  patients.forEach(function(p){
    var s=PatientService.getPatientSummary(p.id);
    totalMissed+=s.missed; totalTaken+=s.taken; totalPending+=s.pending; totalMeds+=s.total;
  });
  var globalRate = totalMeds>0 ? Math.round((totalTaken/totalMeds)*100) : 0;
  var rateColor  = globalRate>=80?'#3B6D11':globalRate>=50?'#854F0B':'#A32D2D';

  // Alertes — patients avec prises manquées
  var alertsHTML='';
  patients.forEach(function(p){
    var meds=PatientService.getTodayMeds(p.id).filter(function(m){return m.status==='missed';});
    meds.slice(0,2).forEach(function(m){
      alertsHTML+=
        '<div onclick="openPatient(\''+p.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#FCEBEB;border-radius:10px;margin-bottom:6px;border:0.5px solid rgba(163,45,45,.15);cursor:pointer">'+
          '<i class="ti ti-alert-triangle" style="font-size:16px;color:#A32D2D;flex-shrink:0" aria-hidden="true"></i>'+
          '<div style="flex:1">'+
            '<div style="font-size:13px;font-weight:500;color:#A32D2D">'+p.prenom+' '+p.nom+'</div>'+
            '<div style="font-size:11px;color:#791F1F">'+m.name+' '+m.time+' — non pris</div>'+
          '</div>'+
          '<i class="ti ti-chevron-right" style="font-size:14px;color:#A32D2D" aria-hidden="true"></i>'+
        '</div>';
    });
  });
  if(!alertsHTML) alertsHTML='<div style="text-align:center;padding:10px 0;font-size:13px;color:var(--color-text-secondary)">Aucune alerte — tout va bien ✓</div>';

  // Suivi du jour — barres de progression
  var suiviHTML=patients.map(function(p){
    var s=PatientService.getPatientSummary(p.id);
    var rate=s.total>0?Math.round((s.taken/s.total)*100):0;
    var color=rate>=80?'#3B6D11':rate>=50?'#854F0B':'#A32D2D';
    var bgBadge=rate>=80?'#EAF3DE':rate>=50?'#FAEEDA':'#FCEBEB';
    var colorBadge=rate>=80?'#27500A':rate>=50?'#633806':'#791F1F';
    var initials=p.prenom[0].toUpperCase()+p.nom[0].toUpperCase();
    return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
      '<div class="avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0">'+initials+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:12px;font-weight:500;color:var(--color-text-primary);margin-bottom:4px">'+p.prenom+' '+p.nom+'</div>'+
        '<div style="display:flex;align-items:center;gap:6px">'+
          '<div style="flex:1;height:5px;background:#F1EFE8;border-radius:99px;overflow:hidden">'+
            '<div style="height:5px;width:'+rate+'%;background:'+color+';border-radius:99px"></div>'+
          '</div>'+
          '<span style="font-size:11px;color:var(--color-text-secondary);min-width:28px">'+rate+'%</span>'+
        '</div>'+
      '</div>'+
      '<span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px;background:'+bgBadge+';color:'+colorBadge+'">'+s.taken+'/'+s.total+'</span>'+
    '</div>';
  }).join('');
  if(!suiviHTML) suiviHTML='<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;padding:8px 0">Aucun patient configuré.</p>';

  // Timeline prochaines prises — tous patients
  var now=new Date();
  var timeline=[];
  patients.forEach(function(p){
    PatientService.getTodayMeds(p.id).forEach(function(m){
      if(m.status==='pending'){
        var parts=m.time.split(':');
        var t=new Date(); t.setHours(parseInt(parts[0]),parseInt(parts[1]),0,0);
        if(t>now) timeline.push({time:m.time,ts:t,name:m.name,patient:p.prenom+' '+p.nom,moment:m.moment,patientId:p.id});
      }
    });
  });
  timeline.sort(function(a,b){return a.ts-b.ts;});

  var timelineHTML=timeline.slice(0,5).map(function(t){
    var mIcon=t.moment&&MOMENTS[t.moment]?MOMENTS[t.moment]:'💊';
    return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary)">'+
      '<div style="width:8px;height:8px;border-radius:50%;background:#185FA5;flex-shrink:0"></div>'+
      '<div style="font-size:13px;font-weight:500;color:var(--color-text-primary);min-width:38px">'+t.time+'</div>'+
      '<div style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+t.patient+' · '+t.name+'</div>'+
      '<span style="font-size:15px">'+mIcon+'</span>'+
    '</div>';
  }).join('');
  if(!timelineHTML) timelineHTML='<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;padding:8px 0">Toutes les prises du jour sont effectuées ✓</p>';

  // Ordonnances réelles depuis PatientService
  var expiringOrdos = PatientService.getExpiringOrdonnances();
  var ordoHTML = '';
  if (expiringOrdos.length === 0) {
    ordoHTML = '<div style="text-align:center;padding:10px 0;font-size:13px;color:var(--color-text-secondary)">Aucune ordonnance &agrave; renouveler ✓</div>';
  } else {
    ordoHTML = expiringOrdos.map(function(o) {
      var st = o.status;
      var exp = new Date(o.dateExpiration).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
      return '<div onclick="openPatient(\'' + o.patientId + '\')" style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:' + st.bg + ';border-radius:10px;margin-bottom:6px;border:0.5px solid rgba(0,0,0,.08);cursor:pointer">'+
        '<i class="ti ti-file-text" style="font-size:16px;color:'+st.color+';flex-shrink:0" aria-hidden="true"></i>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:12px;font-weight:500;color:'+st.color+'">'+o.patientName+' — Dr. '+o.medecin+'</div>'+
          '<div style="font-size:11px;color:'+st.color+';opacity:.8">'+st.label+'</div>'+
        '</div>'+
        '<span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.5);color:'+st.color+'">'+exp+'</span>'+
      '</div>';
    }).join('');
  }

  document.getElementById('app').innerHTML =
    '<div style="padding-bottom:80px">'+

      // Header bleu
      '<div style="background:#185FA5;padding:18px 20px 14px">'+
        '<div style="font-size:12px;color:rgba(255,255,255,.6);margin-bottom:2px">Bonjour 👋</div>'+
        '<div style="font-size:20px;font-weight:500;color:#fff">Tableau de bord</div>'+
        '<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:1px">'+today+'</div>'+
      '</div>'+

      '<div style="padding:12px;display:flex;flex-direction:column;gap:10px">'+

        // Stats 3 colonnes
        '<div style="display:flex;gap:8px">'+
          '<div class="stat-card"><div class="stat-num">'+patients.length+'</div><div class="stat-label">Patient'+(patients.length>1?'s':'')+'</div></div>'+
          '<div class="stat-card"><div class="stat-num" style="color:#A32D2D">'+totalMissed+'</div><div class="stat-label">Manqu&eacute;s</div></div>'+
          '<div class="stat-card"><div class="stat-num" style="color:'+rateColor+'">'+globalRate+'%</div><div class="stat-label">Suivi global</div></div>'+
        '</div>'+

        // Alertes
        '<div class="card">'+
          '<div class="section-title">Alertes prioritaires</div>'+
          alertsHTML+
        '</div>'+

        // Suivi du jour
        '<div class="card">'+
          '<div class="section-title">Suivi du jour</div>'+
          suiviHTML+
        '</div>'+

        // Timeline
        '<div class="card">'+
          '<div class="section-title">Prochaines prises</div>'+
          timelineHTML+
        '</div>'+

        // Ordonnances
        '<div class="card">'+
          '<div class="section-title">Ordonnances &agrave; renouveler</div>'+
          ordoHTML+
        '</div>'+

      '</div>'+
    '</div>'+
    _nav('dashboard');
}

function openPatient(id){ _currentPatientId=id; Router.go('patient-detail'); }
function _age(d){ return Math.floor((Date.now()-new Date(d))/(365.25*24*3600*1000)); }

// ============================================================
// LISTE PATIENTS
// ============================================================
function renderPatients() {
  var patients=PatientService.getPatients();
  var today=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  var totalMissed=0;
  patients.forEach(function(p){ totalMissed+=PatientService.getPatientSummary(p.id).missed; });

  var alertHTML=totalMissed>0
    ? '<div class="alert alert-danger" style="margin:0 12px 8px">'+
        '<i class="ti ti-alert-triangle" style="font-size:20px;flex-shrink:0" aria-hidden="true"></i>'+
        '<span>'+totalMissed+' prise'+(totalMissed>1?'s':'')+' manqu&eacute;e'+(totalMissed>1?'s':'')+' aujourd\'hui</span>'+
      '</div>'
    : '';

  var listHTML=patients.length===0
    ? '<div style="text-align:center;padding:40px 0"><p style="font-size:36px;margin-bottom:12px">👤</p><p class="text-muted">Aucun patient pour l\'instant</p></div>'
    : patients.map(function(p){
        var s=PatientService.getPatientSummary(p.id);
        var initials=p.prenom[0].toUpperCase()+p.nom[0].toUpperCase();
        var ava=p.photo
          ? '<img src="'+p.photo+'" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="'+p.prenom+'">'
          : '<div class="avatar" style="width:52px;height:52px;font-size:16px">'+initials+'</div>';
        var badge=s.missed>0
          ? '<span class="badge badge-danger">⚠ '+s.missed+' manqu&eacute;</span>'
          : s.pending>0 ? '<span class="badge badge-warning">💊 '+s.pending+' &agrave; venir</span>'
          : s.total>0  ? '<span class="badge badge-ok">✓ Tout pris</span>'
          : '<span class="badge" style="background:#F1EFE8;color:var(--color-text-muted)">Aucun m&eacute;d.</span>';
        var age=p.dateNaissance?_age(p.dateNaissance)+' ans · ':'';
        return '<div class="patient-card" onclick="openPatient(\''+p.id+'\')" role="button">'+
          ava+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:16px;font-weight:500;margin-bottom:3px">'+p.prenom+' '+p.nom+'</div>'+
            '<div class="text-muted" style="margin-bottom:7px">'+age+s.total+' m&eacute;dicament'+(s.total>1?'s':'')+'</div>'+
            badge+
          '</div>'+
          '<i class="ti ti-chevron-right" style="font-size:20px;color:var(--color-text-muted);flex-shrink:0" aria-hidden="true"></i>'+
        '</div>';
      }).join('');

  document.getElementById('app').innerHTML=
    '<div style="padding-bottom:80px">'+
      '<div class="page-header">'+
        '<div class="page-header-left"><h1>Mes patients</h1><div class="sub">'+today+'</div></div>'+
        '<button class="icon-btn" onclick="AuthService.logout();Router.go(\'pin\')" aria-label="Verrouiller">'+
          '<i class="ti ti-lock" style="font-size:18px" aria-hidden="true"></i>'+
        '</button>'+
      '</div>'+
      alertHTML+
      '<div style="padding:0 12px" class="stack-sm">'+listHTML+'</div>'+
    '</div>'+
    _nav('patients')+
    '<div class="bottom-fab" style="position:fixed;right:16px;z-index:200">'+
      '<button class="btn btn-primary" onclick="Router.go(\'add-patient\')" style="width:56px;height:56px;border-radius:50%;padding:0;font-size:28px" aria-label="Ajouter un patient">+</button>'+
    '</div>';
}

// ============================================================
// FICHE PATIENT — avec chips navigation
// ============================================================
function renderPatientDetail(tab) {
  if (tab) _patientTab = tab;
  var p = PatientService.getPatient(_currentPatientId);
  if (!p) { Router.go('dashboard'); return; }
  var s        = PatientService.getPatientSummary(_currentPatientId);
  var initials = p.prenom[0].toUpperCase() + p.nom[0].toUpperCase();

  var avaHTML = p.photo
    ? '<img src="'+p.photo+'" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2.5px solid rgba(255,255,255,.4);flex-shrink:0" alt="'+p.prenom+'">'
    : '<div class="patient-hero-avatar">'+initials+'</div>';

  // Chips navigation
  var chips = [
    {id:'today',       icon:'\ud83d\udc8a', label:'Aujourd\'hui'},
    {id:'history',     icon:'\ud83d\udcc5', label:'Historique'},
    {id:'ordonnances', icon:'\ud83d\udcc4', label:'Ordonnances'},
    {id:'profil',      icon:'\ud83d\udc64', label:'Profil'},
  ];

  var chipsHTML = chips.map(function(c) {
    var active = _patientTab === c.id;
    return '<button onclick="_patientTab=\''+c.id+'\';renderPatientDetail()" '+
      'style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:99px;border:'+(active?'none':'1px solid var(--color-border-strong)')+';background:'+(active?'#185FA5':'#fff')+';color:'+(active?'#fff':'var(--color-text-muted)')+';font-size:13px;font-weight:'+(active?'500':'400')+';cursor:pointer;white-space:nowrap;font-family:inherit;flex-shrink:0">'+
      c.icon+' '+c.label+
    '</button>';
  }).join('');

  var tabContent = '';
  if      (_patientTab === 'today')       tabContent = _buildTodayTab(_currentPatientId);
  else if (_patientTab === 'history')     tabContent = _buildHistorySection(_currentPatientId);
  else if (_patientTab === 'ordonnances') tabContent = _buildOrdonnancesSection(_currentPatientId);
  else if (_patientTab === 'profil')      tabContent = _buildProfilTab(p);

  document.getElementById('app').innerHTML =
    '<div style="padding-bottom:80px">' +
      '<div class="patient-hero">' +
        '<button onclick="Router.go(\'patients\')" style="background:rgba(255,255,255,.15);border:none;border-radius:50%;width:38px;height:38px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:14px" aria-label="Retour">' +
          '<i class="ti ti-arrow-left" style="font-size:18px" aria-hidden="true"></i>' +
        '</button>' +
        '<div class="patient-hero-inner">' + avaHTML +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:20px;font-weight:500;color:#fff">'+p.prenom+' '+p.nom+'</div>' +
            (p.dateNaissance ? '<div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:2px">'+_age(p.dateNaissance)+' ans</div>' : '') +
            (p.notes ? '<div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:4px;font-style:italic">'+p.notes+'</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="stat-row">' +
        '<div class="stat-card"><div class="stat-num" style="color:#3B6D11">'+s.taken+'</div><div class="stat-label">Pris</div></div>' +
        '<div class="stat-card"><div class="stat-num" style="color:#185FA5">'+s.pending+'</div><div class="stat-label">&Agrave; venir</div></div>' +
        '<div class="stat-card"><div class="stat-num" style="color:#A32D2D">'+s.missed+'</div><div class="stat-label">Manqu&eacute;s</div></div>' +
      '</div>' +
      '<div style="padding:14px 16px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none">' +
        '<div style="display:flex;gap:8px">'+chipsHTML+'</div>' +
      '</div>' +
      '<div style="padding:16px">'+tabContent+'</div>' +
    '</div>' +
    _nav('patients');
}
function handleTap(medId,dt,status){
  if(status==='taken') return;
  PatientService.confirmTaken(_currentPatientId,medId,dt);
  renderPatientDetail(); // garde l'onglet actif
}

// ============================================================
// AJOUTER PATIENT
// ============================================================
function renderAddPatient() {
  document.getElementById('app').innerHTML=
    '<div style="padding:20px;padding-bottom:40px" class="stack">'+
      '<div class="row">'+
        '<button onclick="Router.go(\'patients\')" style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--color-text-muted)" aria-label="Retour"><i class="ti ti-arrow-left" style="font-size:18px" aria-hidden="true"></i></button>'+
        '<h2>Nouveau patient</h2>'+
      '</div>'+
      '<div class="stack-sm" style="align-items:center">'+
        '<p class="section-title" style="text-align:center">Photo du patient</p>'+
        '<div id="pat-photo" onclick="document.getElementById(\'pat-photo-in\').click()" style="width:90px;height:90px;border-radius:50%;border:2px dashed var(--color-border-strong);display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff;font-size:28px" role="button" aria-label="Ajouter une photo"><i class="ti ti-user" style="font-size:32px;color:var(--color-text-muted)" aria-hidden="true"></i></div>'+
        '<input type="file" id="pat-photo-in" accept="image/*" capture="user" style="display:none" onchange="handlePatPhoto(this)">'+
      '</div>'+
      '<div class="card stack-sm">'+
        '<div class="stack-sm"><p class="section-title">Pr&eacute;nom *</p><input type="text" id="p-prenom" placeholder="ex : Marcel"></div>'+
        '<div class="stack-sm"><p class="section-title">Nom *</p><input type="text" id="p-nom" placeholder="ex : Dupont"></div>'+
        '<div class="stack-sm"><p class="section-title">Date de naissance</p><input type="date" id="p-dob"></div>'+
      '</div>'+
      '<div class="card stack-sm">'+
        '<p class="section-title">Notes (allergies, pathologies...)</p>'+
        '<textarea id="p-notes" placeholder="ex : Diabétique, allergie pénicilline" style="min-height:90px;padding:12px;resize:none;border:1.5px solid var(--color-border-strong);border-radius:12px;font-family:inherit;font-size:15px;background:#fff;color:var(--color-text);line-height:1.5"></textarea>'+
      '</div>'+
      '<button class="btn btn-primary" onclick="savePatient()">Enregistrer le patient</button>'+
    '</div>';
}

function handlePatPhoto(input){
  var file=input.files[0]; if(!file) return;
  var r=new FileReader();
  r.onload=function(e){
    var el=document.getElementById('pat-photo');
    el.innerHTML='<img src="'+e.target.result+'" style="width:90px;height:90px;border-radius:50%;object-fit:cover" alt="Photo">';
    el.dataset.photo=e.target.result;
  };
  r.readAsDataURL(file);
}

function savePatient(){
  var prenom=document.getElementById('p-prenom').value.trim();
  var nom=document.getElementById('p-nom').value.trim();
  var dob=document.getElementById('p-dob').value;
  var notes=document.getElementById('p-notes').value.trim();
  var photo=document.getElementById('pat-photo').dataset.photo||null;
  if(!prenom){alert('Merci de saisir le prénom.');return;}
  if(!nom){alert('Merci de saisir le nom.');return;}
  try{
    var p=PatientService.addPatient({nom:nom,prenom:prenom,dateNaissance:dob||null,photo:photo,notes:notes});
    _currentPatientId=p.id; Router.go('patient-detail');
  }catch(e){alert('Erreur : '+e.message);}
}

// ============================================================
// AJOUTER MÉDICAMENT
// ============================================================
var ML={fasting:'🌅',before:'⏱️',during:'🍽️',after:'✅',bedtime:'🌙'};
var MLlabel={fasting:'À jeun',before:'Avant repas',during:'Avec repas',after:'Après repas',bedtime:'Au coucher'};

function renderAddMedication(){
  document.getElementById('app').innerHTML=
    '<div style="padding:20px;padding-bottom:40px" class="stack">'+
      '<div class="row">'+
        '<button onclick="Router.go(\'patient-detail\')" style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--color-text-muted)" aria-label="Retour"><i class="ti ti-arrow-left" style="font-size:18px" aria-hidden="true"></i></button>'+
        '<h2>Ajouter un m&eacute;dicament</h2>'+
      '</div>'+
      '<div id="photo-preview" onclick="document.getElementById(\'photo-in\').click()" style="width:100%;height:130px;border:2px dashed var(--color-border-strong);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;background:#fff" role="button" aria-label="Photo de la boîte">'+
        '<i class="ti ti-camera" style="font-size:32px;color:var(--color-text-muted)" aria-hidden="true"></i>'+
        '<span class="text-muted">Photo de la bo&icirc;te</span>'+
      '</div>'+
      '<input type="file" id="photo-in" accept="image/*" capture="environment" style="display:none" onchange="handleMedPhoto(this)">'+
      '<div class="card stack-sm">'+
        '<div class="stack-sm"><p class="section-title">Nom *</p><input type="text" id="m-name" placeholder="ex : Doliprane 500mg"></div>'+
        '<div class="stack-sm"><p class="section-title">Dose *</p><input type="text" id="m-dose" placeholder="ex : 1 comprim&eacute;"></div>'+
      '</div>'+
      '<div class="card stack-sm">'+
        '<p class="section-title">Horaires &amp; moment de prise *</p>'+
        '<div id="times-list" class="stack-sm"></div>'+
        '<button class="btn btn-ghost" onclick="addSlot()" style="margin-top:4px"><i class="ti ti-plus" aria-hidden="true"></i>&nbsp;Ajouter un horaire</button>'+
      '</div>'+
      '<div class="card stack-sm">'+
        '<p class="section-title">Dur&eacute;e</p>'+
        '<div class="row">'+
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-height:44px;font-size:15px"><input type="radio" name="dur" value="permanent" checked onchange="toggleDur(this.value)" style="width:18px;height:18px"> Permanent</label>'+
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-height:44px;font-size:15px"><input type="radio" name="dur" value="limited" onchange="toggleDur(this.value)" style="width:18px;height:18px"> Limit&eacute;</label>'+
        '</div>'+
        '<div id="dur-fields" style="display:none;flex-direction:column;gap:8px">'+
          '<input type="number" id="dur-days" placeholder="Nombre de jours (ex : 7)" min="1" max="365">'+
          '<input type="date" id="dur-start">'+
        '</div>'+
      '</div>'+
      '<button class="btn btn-primary" onclick="saveMed()">Enregistrer le m&eacute;dicament</button>'+
    '</div>';
  addSlot();
  document.getElementById('dur-start').value=new Date().toISOString().slice(0,10);
}

function addSlot(){
  var list=document.getElementById('times-list');
  var id='slot-'+Date.now();
  var div=document.createElement('div');
  div.id=id;
  div.style.cssText='border:1.5px solid var(--color-border-strong);border-radius:14px;padding:12px;background:var(--color-bg-surface)';
  var btns=Object.keys(ML).map(function(k){
    return '<button type="button" onclick="selMoment(\''+id+'\',\''+k+'\')" id="'+id+'-'+k+'" title="'+MLlabel[k]+'" aria-label="'+MLlabel[k]+'" style="background:none;border:1.5px solid var(--color-border-strong);border-radius:10px;width:42px;height:42px;font-size:20px;cursor:pointer;transition:all .15s">'+ML[k]+'</button>';
  }).join('');
  div.innerHTML=
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+
      '<input type="time" value="08:00" style="flex:1;min-height:48px;padding:0 14px;border:1.5px solid var(--color-border-strong);border-radius:12px;font-size:16px;background:#fff;color:var(--color-text)">'+
      '<button onclick="document.getElementById(\''+id+'\').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--color-text-muted);min-width:40px;min-height:44px" aria-label="Supprimer">✕</button>'+
    '</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap">'+btns+'</div>';
  list.appendChild(div);
  selMoment(id,'after');
}

function selMoment(slotId,key){
  Object.keys(ML).forEach(function(k){
    var btn=document.getElementById(slotId+'-'+k);
    if(!btn) return;
    btn.style.borderColor=k===key?'#185FA5':'var(--color-border-strong)';
    btn.style.background=k===key?'#E6F1FB':'none';
  });
  document.getElementById(slotId).dataset.moment=key;
}

function toggleDur(v){ document.getElementById('dur-fields').style.display=v==='limited'?'flex':'none'; }

function handleMedPhoto(input){
  var file=input.files[0]; if(!file) return;
  var r=new FileReader();
  r.onload=function(e){
    var el=document.getElementById('photo-preview');
    el.innerHTML='<img src="'+e.target.result+'" style="width:100%;height:130px;object-fit:cover;border-radius:14px" alt="Photo médicament">';
    el.dataset.photo=e.target.result;
  };
  r.readAsDataURL(file);
}

function saveMed(){
  var name=document.getElementById('m-name').value.trim();
  var dose=document.getElementById('m-dose').value.trim();
  var photo=document.getElementById('photo-preview').dataset.photo||null;
  var durType=document.querySelector('input[name="dur"]:checked').value;
  var slots=Array.from(document.getElementById('times-list').children).map(function(d){
    return{time:d.querySelector('input[type=time]').value,moment:d.dataset.moment||'after'};
  }).filter(function(s){return s.time;});
  var duration=null;
  if(durType==='limited'){
    var days=parseInt(document.getElementById('dur-days').value);
    var start=document.getElementById('dur-start').value;
    if(!days||days<1){alert('Merci de saisir le nombre de jours.');return;}
    if(!start){alert('Merci de saisir la date de début.');return;}
    duration={days:days,startDate:start};
  }
  if(!name){alert('Merci de saisir le nom.');return;}
  if(!dose){alert('Merci de saisir la dose.');return;}
  if(!slots.length){alert("Merci d'ajouter au moins un horaire.");return;}
  try{
    PatientService.addMedication(_currentPatientId,{name:name,dose:dose,schedule:slots,photo:photo,duration:duration});
    _patientTab = 'today';
    Router.go('patient-detail');
  }catch(e){alert('Erreur : '+e.message);}
}

// ============================================================
// PLANNING
// ============================================================
function renderPlanning(){
  var patients=PatientService.getPatients();
  var today=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  var MOMENTS=PatientService.MOMENTS;
  var rowsHTML=patients.map(function(p){
    var meds=PatientService.getTodayMeds(p.id);
    var initials=p.prenom[0].toUpperCase()+p.nom[0].toUpperCase();
    var timesHTML=meds.map(function(m){
      var bg=m.status==='taken'?'#EAF3DE':m.status==='missed'?'#FCEBEB':'#F1EFE8';
      var color=m.status==='taken'?'#27500A':m.status==='missed'?'#791F1F':'var(--color-text-muted)';
      var mIcon=m.moment&&MOMENTS[m.moment]?MOMENTS[m.moment]:'💊';
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:10px;background:'+bg+';min-width:50px">'+
        '<span style="font-size:13px">'+mIcon+'</span>'+
        '<span style="font-size:11px;color:'+color+'">'+m.time+'</span>'+
      '</div>';
    }).join('');
    if(!timesHTML) timesHTML='<span class="text-muted" style="font-size:12px">Aucun m&eacute;d.</span>';
    return '<div class="card" style="cursor:pointer" onclick="openPatient(\''+p.id+'\')">'+
      '<div class="row" style="margin-bottom:10px">'+
        '<div class="avatar" style="width:38px;height:38px;font-size:13px">'+initials+'</div>'+
        '<span style="font-weight:500;font-size:15px">'+p.prenom+' '+p.nom+'</span>'+
      '</div>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap">'+timesHTML+'</div>'+
    '</div>';
  }).join('');
  if(!rowsHTML) rowsHTML='<p class="text-muted" style="text-align:center;padding:40px 0">Aucun patient.</p>';
  document.getElementById('app').innerHTML=
    '<div style="padding-bottom:80px">'+
      '<div class="page-header"><div class="page-header-left"><h1>Planning</h1><div class="sub">'+today+'</div></div></div>'+
      '<div style="padding:0 12px" class="stack-sm">'+rowsHTML+'</div>'+
    '</div>'+_nav('planning');
}

// ============================================================
// STATS
// ============================================================
function renderStats(){
  var patients=PatientService.getPatients();
  var statsHTML=patients.map(function(p){
    var s=PatientService.getPatientSummary(p.id);
    var rate=s.total>0?Math.round((s.taken/s.total)*100):0;
    var initials=p.prenom[0].toUpperCase()+p.nom[0].toUpperCase();
    var color=rate>=80?'#3B6D11':rate>=50?'#854F0B':'#A32D2D';
    return '<div class="card">'+
      '<div class="row" style="margin-bottom:12px">'+
        '<div class="avatar" style="width:42px;height:42px;font-size:14px">'+initials+'</div>'+
        '<div style="flex:1"><div style="font-weight:500;font-size:15px">'+p.prenom+' '+p.nom+'</div>'+
        '<div class="text-muted">'+s.taken+'/'+s.total+' prises aujourd\'hui</div></div>'+
        '<div style="font-size:22px;font-weight:500;color:'+color+'">'+rate+'%</div>'+
      '</div>'+
      '<div class="progress-bar"><div class="progress-fill" style="width:'+rate+'%;background:'+color+'"></div></div>'+
    '</div>';
  }).join('');
  if(!statsHTML) statsHTML='<p class="text-muted" style="text-align:center;padding:40px 0">Aucun patient.</p>';
  document.getElementById('app').innerHTML=
    '<div style="padding-bottom:80px">'+
      '<div class="page-header"><div class="page-header-left"><h1>Statistiques</h1><div class="sub">Taux de suivi — aujourd\'hui</div></div></div>'+
      '<div style="padding:0 12px" class="stack-sm">'+statsHTML+'</div>'+
    '</div>'+_nav('stats');
}

// ============================================================
// RÉGLAGES
// ============================================================
function renderSettings(){
  document.getElementById('app').innerHTML=
    '<div style="padding-bottom:80px">'+
      '<div class="page-header"><div class="page-header-left"><h1>R&eacute;glages</h1></div></div>'+
      '<div style="padding:0 12px" class="stack">'+
        '<div class="card stack-sm">'+
          '<p class="section-title">S&eacute;curit&eacute;</p>'+
          '<div class="row" style="min-height:50px"><i class="ti ti-lock" style="font-size:22px;color:#185FA5" aria-hidden="true"></i><div style="flex:1"><div style="font-weight:500">Code PIN</div><div class="text-muted">Modifier votre code</div></div><button onclick="AuthService.logout();Router.go(\'pin\')" style="background:none;border:1.5px solid #185FA5;border-radius:99px;padding:5px 16px;font-size:13px;cursor:pointer;color:#185FA5;font-family:inherit;font-weight:500">Modifier</button></div>'+
          '<div style="height:0.5px;background:var(--color-border-tertiary)"></div>'+
          '<div class="row" style="min-height:50px"><i class="ti ti-logout" style="font-size:22px;color:#A32D2D" aria-hidden="true"></i><div style="flex:1"><div style="font-weight:500">Verrouiller</div><div class="text-muted">Retour à l\'écran PIN</div></div><button onclick="AuthService.logout();Router.go(\'pin\')" style="background:none;border:1.5px solid #A32D2D;border-radius:99px;padding:5px 16px;font-size:13px;cursor:pointer;color:#A32D2D;font-family:inherit;font-weight:500">Verrouiller</button></div>'+
        '</div>'+
        '<div class="card stack-sm">'+
          '<p class="section-title">Donn&eacute;es</p>'+
          '<div class="row" style="min-height:50px"><i class="ti ti-trash" style="font-size:22px;color:#A32D2D" aria-hidden="true"></i><div style="flex:1"><div style="font-weight:500">R&eacute;initialiser</div><div class="text-muted">Supprimer toutes les donn&eacute;es</div></div><button onclick="resetAll()" style="background:#FCEBEB;border:none;border-radius:99px;padding:5px 16px;font-size:13px;cursor:pointer;color:#A32D2D;font-family:inherit;font-weight:500">Reset</button></div>'+
        '</div>'+
        '<div class="card"><p class="section-title">Version</p><p class="text-muted">MediSafe Aidant v1.0 — Phase test</p></div>'+
      '</div>'+
    '</div>'+_nav('settings');
}

function resetAll(){
  if(confirm('Supprimer toutes les données ? Action irréversible.')){
    localStorage.clear(); Router.go('splash');
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initApp);
}else{initApp();}

// ============================================================
// MODIFIER PROFIL PATIENT
// ============================================================
function renderEditPatient() {
  var p = PatientService.getPatient(_currentPatientId);
  if (!p) { Router.go('patients'); return; }

  document.getElementById('app').innerHTML =
    '<div style="padding:20px;padding-bottom:40px" class="stack">' +
      '<div class="row">' +
        '<button onclick="Router.go(\'patient-detail\')" style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--color-text-muted)" aria-label="Retour">' +
          '<i class="ti ti-arrow-left" style="font-size:18px" aria-hidden="true"></i>' +
        '</button>' +
        '<h2>Modifier le patient</h2>' +
      '</div>' +

      // Photo
      '<div class="stack-sm" style="align-items:center">' +
        '<p class="section-title" style="text-align:center">Photo du patient</p>' +
        '<div id="pat-photo" onclick="document.getElementById(\'pat-photo-in\').click()"' +
          ' style="width:90px;height:90px;border-radius:50%;border:2px dashed var(--color-border-strong);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden" role="button" aria-label="Modifier la photo">' +
          (p.photo
            ? '<img src="'+p.photo+'" style="width:90px;height:90px;object-fit:cover" alt="Photo">'
            : '<i class="ti ti-user" style="font-size:32px;color:var(--color-text-muted)" aria-hidden="true"></i>') +
        '</div>' +
        '<input type="file" id="pat-photo-in" accept="image/*" capture="user" style="display:none" onchange="handlePatPhoto(this)">' +
      '</div>' +

      '<div class="card stack-sm">' +
        '<div class="stack-sm"><p class="section-title">Pr&eacute;nom *</p><input type="text" id="p-prenom" value="'+p.prenom+'" placeholder="ex : Marcel"></div>' +
        '<div class="stack-sm"><p class="section-title">Nom *</p><input type="text" id="p-nom" value="'+p.nom+'" placeholder="ex : Dupont"></div>' +
        '<div class="stack-sm"><p class="section-title">Date de naissance</p><input type="date" id="p-dob" value="'+(p.dateNaissance||'')+'"></div>' +
      '</div>' +

      '<div class="card stack-sm">' +
        '<p class="section-title">Notes</p>' +
        '<textarea id="p-notes" style="min-height:90px;padding:12px;resize:none;border:1.5px solid var(--color-border-strong);border-radius:12px;font-family:inherit;font-size:15px;background:#fff;color:var(--color-text);line-height:1.5">'+( p.notes||'')+'</textarea>' +
      '</div>' +

      '<button class="btn btn-primary" onclick="saveEditPatient()">Enregistrer les modifications</button>' +

      // Danger zone
      '<div class="card" style="border:1px solid rgba(163,45,45,.25)">' +
        '<p class="section-title" style="color:#A32D2D">Zone dangereuse</p>' +
        '<div class="row" style="margin-top:8px">' +
          '<div style="flex:1"><div style="font-weight:500;font-size:14px">Supprimer ce patient</div><div class="text-muted" style="font-size:12px">Cette action est irr&eacute;versible</div></div>' +
          '<button onclick="confirmDeletePatient()" style="background:#FCEBEB;border:none;border-radius:99px;padding:6px 16px;font-size:13px;cursor:pointer;color:#A32D2D;font-family:inherit;font-weight:500">Supprimer</button>' +
        '</div>' +
      '</div>' +

    '</div>';

  // Stocker la photo actuelle
  document.getElementById('pat-photo').dataset.photo = p.photo || '';
}

function saveEditPatient() {
  var prenom = document.getElementById('p-prenom').value.trim();
  var nom    = document.getElementById('p-nom').value.trim();
  var dob    = document.getElementById('p-dob').value;
  var notes  = document.getElementById('p-notes').value.trim();
  var photo  = document.getElementById('pat-photo').dataset.photo || null;

  if (!prenom) { alert('Merci de saisir le prénom.'); return; }
  if (!nom)    { alert('Merci de saisir le nom.'); return; }

  try {
    PatientService.updatePatient(_currentPatientId, {
      prenom: prenom, nom: nom,
      dateNaissance: dob || null,
      notes: notes,
      photo: photo || null
    });
    _patientTab = 'profil';
    Router.go('patient-detail');
  } catch(e) { alert('Erreur : ' + e.message); }
}

function confirmDeletePatient() {
  var p = PatientService.getPatient(_currentPatientId);
  if (!p) return;
  if (confirm('Supprimer ' + p.prenom + ' ' + p.nom + ' ? Toutes ses données seront perdues.')) {
    PatientService.deletePatient(_currentPatientId);
    _currentPatientId = null;
    Router.go('patients');
  }
}

// ============================================================
// MODIFIER MÉDICAMENT
// ============================================================
var _editMedId = null;

function editMedication(medId) {
  _editMedId = medId;
  Router.go('edit-medication');
}

function confirmDeleteMed(medId, medName) {
  if (confirm('Supprimer ' + medName + ' ? L\'historique des prises sera conservé.')) {
    PatientService.deleteMedication(_currentPatientId, medId);
    _patientTab = 'today';
    Router.go('patient-detail');
  }
}

function renderEditMedication() {
  var med = PatientService.getMedication(_currentPatientId, _editMedId);
  if (!med) { Router.go('patient-detail'); return; }

  var ML     = {fasting:'🌅',before:'⏱️',during:'🍽️',after:'✅',bedtime:'🌙'};
  var MLlabel = {fasting:'À jeun',before:'Avant repas',during:'Avec repas',after:'Après repas',bedtime:'Au coucher'};

  document.getElementById('app').innerHTML =
    '<div style="padding:20px;padding-bottom:40px" class="stack">' +
      '<div class="row">' +
        '<button onclick="Router.go(\'patient-detail\')" style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--color-text-muted)" aria-label="Retour">' +
          '<i class="ti ti-arrow-left" style="font-size:18px" aria-hidden="true"></i>' +
        '</button>' +
        '<h2>Modifier le m&eacute;dicament</h2>' +
      '</div>' +

      // Photo
      '<div id="photo-preview" onclick="document.getElementById(\'photo-in\').click()"' +
        ' style="width:100%;height:130px;border:2px dashed var(--color-border-strong);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;overflow:hidden;background:#fff" role="button" aria-label="Modifier la photo">' +
        (med.photo
          ? '<img src="'+med.photo+'" style="width:100%;height:130px;object-fit:cover;border-radius:14px" alt="Photo">'
          : '<i class="ti ti-camera" style="font-size:32px;color:var(--color-text-muted)" aria-hidden="true"></i><span class="text-muted">Photo de la bo&icirc;te</span>') +
      '</div>' +
      '<input type="file" id="photo-in" accept="image/*" capture="environment" style="display:none" onchange="handleMedPhoto(this)">' +

      // Nom + dose
      '<div class="card stack-sm">' +
        '<div class="stack-sm"><p class="section-title">Nom *</p><input type="text" id="m-name" value="'+med.name+'" placeholder="ex : Doliprane 500mg"></div>' +
        '<div class="stack-sm"><p class="section-title">Dose *</p><input type="text" id="m-dose" value="'+med.dose+'" placeholder="ex : 1 comprimé"></div>' +
      '</div>' +

      // Horaires
      '<div class="card stack-sm">' +
        '<p class="section-title">Horaires &amp; moment de prise *</p>' +
        '<div id="times-list" class="stack-sm"></div>' +
        '<button class="btn btn-ghost" onclick="addSlot()" style="margin-top:4px">' +
          '<i class="ti ti-plus" aria-hidden="true"></i>&nbsp;Ajouter un horaire' +
        '</button>' +
      '</div>' +

      // Durée
      '<div class="card stack-sm">' +
        '<p class="section-title">Dur&eacute;e du traitement</p>' +
        '<div class="row">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-height:44px;font-size:15px">' +
            '<input type="radio" name="dur" value="permanent" '+(med.duration?'':'checked')+' onchange="toggleDur(this.value)" style="width:18px;height:18px"> Permanent' +
          '</label>' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-height:44px;font-size:15px">' +
            '<input type="radio" name="dur" value="limited" '+(med.duration?'checked':'')+' onchange="toggleDur(this.value)" style="width:18px;height:18px"> Limit&eacute;' +
          '</label>' +
        '</div>' +
        '<div id="dur-fields" style="display:'+(med.duration?'flex':'none')+';flex-direction:column;gap:8px">' +
          '<input type="number" id="dur-days" placeholder="Nombre de jours" min="1" max="365" value="'+(med.duration?med.duration.days:'')+'">' +
          '<input type="date" id="dur-start" value="'+(med.duration?med.duration.startDate:new Date().toISOString().slice(0,10))+'">' +
        '</div>' +
      '</div>' +

      '<button class="btn btn-primary" onclick="saveEditMedication()">Enregistrer les modifications</button>' +
    '</div>';

  // Photo actuelle
  document.getElementById('photo-preview').dataset.photo = med.photo || '';

  // Pré-remplir les slots existants
  med.schedule.forEach(function(slot) {
    addSlotWithValue(slot.time, slot.moment);
  });
}

function addSlotWithValue(timeVal, momentVal) {
  var list = document.getElementById('times-list');
  var id   = 'slot-' + Date.now() + Math.random().toString(36).slice(2,5);
  var div  = document.createElement('div');
  div.id   = id;
  div.style.cssText = 'border:1.5px solid var(--color-border-strong);border-radius:14px;padding:12px;background:var(--color-bg-surface)';
  var ML     = {fasting:'🌅',before:'⏱️',during:'🍽️',after:'✅',bedtime:'🌙'};
  var MLlabel = {fasting:'À jeun',before:'Avant repas',during:'Avec repas',after:'Après repas',bedtime:'Au coucher'};
  var btns   = Object.keys(ML).map(function(k) {
    return '<button type="button" onclick="selMoment(\''+id+'\',\''+k+'\')" id="'+id+'-'+k+'" title="'+MLlabel[k]+'" aria-label="'+MLlabel[k]+'"' +
      ' style="background:none;border:1.5px solid var(--color-border-strong);border-radius:10px;width:42px;height:42px;font-size:20px;cursor:pointer;transition:all .15s">'+ML[k]+'</button>';
  }).join('');
  div.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
      '<input type="time" value="'+(timeVal||'08:00')+'" style="flex:1;min-height:48px;padding:0 14px;border:1.5px solid var(--color-border-strong);border-radius:12px;font-size:16px;background:#fff;color:var(--color-text)">' +
      '<button onclick="document.getElementById(\''+id+'\').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--color-text-muted);min-width:40px;min-height:44px" aria-label="Supprimer">✕</button>' +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' + btns + '</div>';
  list.appendChild(div);
  selMoment(id, momentVal || 'after');
}

function saveEditMedication() {
  var name  = document.getElementById('m-name').value.trim();
  var dose  = document.getElementById('m-dose').value.trim();
  var photo = document.getElementById('photo-preview').dataset.photo || null;
  var durType = document.querySelector('input[name="dur"]:checked').value;

  var slots = Array.from(document.getElementById('times-list').children).map(function(d) {
    return { time: d.querySelector('input[type=time]').value, moment: d.dataset.moment || 'after' };
  }).filter(function(s) { return s.time; });

  var duration = null;
  if (durType === 'limited') {
    var days  = parseInt(document.getElementById('dur-days').value);
    var start = document.getElementById('dur-start').value;
    if (!days || days < 1) { alert('Merci de saisir le nombre de jours.'); return; }
    if (!start)             { alert('Merci de saisir la date de début.'); return; }
    duration = { days: days, startDate: start };
  }

  if (!name)         { alert('Merci de saisir le nom.'); return; }
  if (!dose)         { alert('Merci de saisir la dose.'); return; }
  if (!slots.length) { alert("Merci d'ajouter au moins un horaire."); return; }

  try {
    PatientService.updateMedication(_currentPatientId, _editMedId, {
      name: name, dose: dose, schedule: slots,
      photo: photo || null, duration: duration
    });
    Router.go('patient-detail');
  } catch(e) { alert('Erreur : ' + e.message); }
}

// ============================================================
// SCAN ORDONNANCE — ajout
// ============================================================
function renderAddOrdonnance() {
  document.getElementById('app').innerHTML =
    '<div style="padding:20px;padding-bottom:40px" class="stack">' +
      '<div class="row">' +
        '<button onclick="Router.go(\'patient-detail\')" style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--color-text-muted)" aria-label="Retour">' +
          '<i class="ti ti-arrow-left" style="font-size:18px" aria-hidden="true"></i>' +
        '</button>' +
        '<h2>Nouvelle ordonnance</h2>' +
      '</div>' +

      // Photo ordonnance
      '<div class="stack-sm">' +
        '<p class="section-title">Photo de l\'ordonnance</p>' +
        '<div id="ordo-photo-preview" onclick="document.getElementById(\'ordo-photo-in\').click()"' +
          ' style="width:100%;height:180px;border:2px dashed var(--color-border-strong);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;background:#fff;position:relative" role="button" aria-label="Scanner l\'ordonnance">' +
          '<i class="ti ti-scan" style="font-size:36px;color:var(--color-text-muted)" aria-hidden="true"></i>' +
          '<span class="text-muted" style="font-size:13px;text-align:center">Prendre une photo de l\'ordonnance</span>' +
          '<span style="font-size:11px;color:var(--color-text-hint)">JPG, PNG accept&eacute;s</span>' +
        '</div>' +
        '<input type="file" id="ordo-photo-in" accept="image/*" capture="environment" style="display:none" onchange="handleOrdoPhoto(this)">' +
      '</div>' +

      '<div class="card stack-sm">' +

        // Médecin
        '<div class="stack-sm">' +
          '<p class="section-title">Nom du m&eacute;decin *</p>' +
          '<input type="text" id="ordo-medecin" placeholder="ex : Dr. Martin">' +
        '</div>' +

        // Date expiration
        '<div class="stack-sm">' +
          '<p class="section-title">Date d\'expiration *</p>' +
          '<input type="date" id="ordo-date">' +
          '<p style="font-size:12px;color:var(--color-text-hint);margin-top:4px">⚠ En France, une ordonnance est valable 3 mois</p>' +
        '</div>' +

        // Notes
        '<div class="stack-sm">' +
          '<p class="section-title">Notes (optionnel)</p>' +
          '<textarea id="ordo-notes" placeholder="ex : Renouvellement pour diabète type 2" style="min-height:80px;padding:12px;resize:none;border:1.5px solid var(--color-border-strong);border-radius:12px;font-family:inherit;font-size:15px;background:#fff;color:var(--color-text);line-height:1.5"></textarea>' +
        '</div>' +

      '</div>' +

      '<button class="btn btn-primary" onclick="saveOrdonnance()">Enregistrer l\'ordonnance</button>' +
    '</div>';

  // Date par défaut = aujourd'hui + 3 mois
  var d = new Date();
  d.setMonth(d.getMonth() + 3);
  document.getElementById('ordo-date').value = d.toISOString().slice(0,10);
}

function handleOrdoPhoto(input) {
  var file = input.files[0]; if (!file) return;
  var r = new FileReader();
  r.onload = function(e) {
    var el = document.getElementById('ordo-photo-preview');
    el.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:180px;object-fit:cover;border-radius:14px" alt="Ordonnance">';
    el.dataset.photo = e.target.result;
  };
  r.readAsDataURL(file);
}

function saveOrdonnance() {
  var medecin = document.getElementById('ordo-medecin').value.trim();
  var date    = document.getElementById('ordo-date').value;
  var notes   = document.getElementById('ordo-notes').value.trim();
  var photo   = document.getElementById('ordo-photo-preview').dataset.photo || null;

  if (!medecin) { alert('Merci de saisir le nom du médecin.'); return; }
  if (!date)    { alert('Merci de saisir la date d\'expiration.'); return; }

  try {
    PatientService.addOrdonnance(_currentPatientId, {
      medecin: medecin, dateExpiration: date, photo: photo, notes: notes
    });
    _patientTab = 'ordonnances';
    Router.go('patient-detail');
  } catch(e) { alert('Erreur : ' + e.message); }
}

// Supprimer une ordonnance
function confirmDeleteOrdo(ordoId, medecin) {
  if (confirm('Supprimer l\'ordonnance de ' + medecin + ' ?')) {
    PatientService.deleteOrdonnance(_currentPatientId, ordoId);
    Router.go('patient-detail');
  }
}

// ============================================================
// HELPER — section ordonnances (utilisé dans renderPatientDetail)
// ============================================================
function _buildOrdonnancesSection(patientId) {
  var ordos = PatientService.getOrdonnances(patientId);

  var ordosHTML = '';
  if (ordos.length === 0) {
    ordosHTML = '<p class="text-muted" style="text-align:center;padding:12px 0;font-size:13px">Aucune ordonnance enregistr&eacute;e.</p>';
  } else {
    ordosHTML = ordos
      .sort(function(a,b){ return new Date(a.dateExpiration)-new Date(b.dateExpiration); })
      .map(function(o) {
        var st  = PatientService.getOrdonnanceStatus(o.dateExpiration);
        var exp = new Date(o.dateExpiration).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
        var photoBtn = o.photo
          ? '<button onclick="viewOrdoPhoto(\''+o.id+'\')" style="background:none;border:1px solid var(--color-border-strong);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--color-text-muted);font-family:inherit;display:flex;align-items:center;gap:4px">'+
              '<i class="ti ti-photo" style="font-size:13px" aria-hidden="true"></i> Voir'+
            '</button>'
          : '';
        return '<div style="background:#fff;border-radius:14px;padding:12px 14px;border:1px solid var(--color-border-tertiary);margin-bottom:8px">' +
          '<div style="display:flex;align-items:flex-start;gap:10px">' +
            '<div style="width:38px;height:38px;border-radius:10px;background:'+st.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
              '<i class="ti ti-file-text" style="font-size:18px;color:'+st.color+'" aria-hidden="true"></i>' +
            '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:14px;font-weight:500;color:var(--color-text-primary)">Dr. '+o.medecin+'</div>' +
              '<div style="font-size:12px;color:var(--color-text-muted);margin-top:1px">Expire le '+exp+'</div>' +
              (o.notes ? '<div style="font-size:12px;color:var(--color-text-muted);margin-top:3px;font-style:italic">'+o.notes+'</div>' : '') +
            '</div>' +
            '<span style="font-size:11px;font-weight:500;padding:3px 9px;border-radius:99px;background:'+st.bg+';color:'+st.color+';white-space:nowrap;flex-shrink:0">'+st.label+'</span>' +
          '</div>' +
          (photoBtn
            ? '<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px;padding-top:8px;border-top:0.5px solid var(--color-border-tertiary)">'+
                photoBtn+
                '<button onclick="confirmDeleteOrdo(\''+o.id+'\',\''+o.medecin+'\')" style="background:none;border:1px solid rgba(163,45,45,.3);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;color:#A32D2D;font-family:inherit;display:flex;align-items:center;gap:4px">'+
                  '<i class="ti ti-trash" style="font-size:13px" aria-hidden="true"></i> Supprimer'+
                '</button>'+
              '</div>'
            : '<div style="display:flex;justify-content:flex-end;margin-top:8px;padding-top:8px;border-top:0.5px solid var(--color-border-tertiary)">'+
                '<button onclick="confirmDeleteOrdo(\''+o.id+'\',\''+o.medecin+'\')" style="background:none;border:1px solid rgba(163,45,45,.3);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;color:#A32D2D;font-family:inherit;display:flex;align-items:center;gap:4px">'+
                  '<i class="ti ti-trash" style="font-size:13px" aria-hidden="true"></i> Supprimer'+
                '</button>'+
              '</div>') +
        '</div>';
      }).join('');
  }

  return '<div>' +
    '<div class="row" style="margin-bottom:10px">' +
      '<p class="section-title" style="margin:0;flex:1">Ordonnances</p>' +
      '<button onclick="Router.go(\'add-ordonnance\')" style="background:none;border:1.5px solid #185FA5;border-radius:99px;padding:5px 14px;font-size:13px;cursor:pointer;color:#185FA5;font-family:inherit;font-weight:500">+ Ajouter</button>' +
    '</div>' +
    ordosHTML +
  '</div>';
}

// Voir la photo d'une ordonnance en plein écran
function viewOrdoPhoto(ordoId) {
  var o = PatientService.getOrdonnance(_currentPatientId, ordoId);
  if (!o || !o.photo) return;
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:16px';
  overlay.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;max-width:430px">' +
      '<span style="color:#fff;font-size:15px;font-weight:500">Ordonnance — Dr. '+o.medecin+'</span>' +
      '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:rgba(255,255,255,.15);border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;color:#fff;font-size:18px">✕</button>' +
    '</div>' +
    '<img src="'+o.photo+'" style="max-width:430px;width:100%;border-radius:12px;max-height:70vh;object-fit:contain" alt="Ordonnance">' +
    '<p style="color:rgba(255,255,255,.5);font-size:12px">Expire le '+new Date(o.dateExpiration).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'</p>';
  document.body.appendChild(overlay);
}

// ============================================================
// HELPER — section historique 7 jours (utilisé dans renderPatientDetail)
// ============================================================
function _buildHistorySection(patientId) {
  var data = PatientService.getMedHistory7Days(patientId);
  if (!data || data.meds.length === 0) {
    return '<div>' +
      '<p class="section-title">Historique 7 jours</p>' +
      '<p class="text-muted" style="text-align:center;padding:12px 0;font-size:13px">Aucun m&eacute;dicament configur&eacute;.</p>' +
    '</div>';
  }

  // En-têtes des jours — initiale + numéro
  var DAY_LABELS = ['D','L','M','M','J','V','S'];
  var today = new Date(); today.setHours(0,0,0,0);

  var headerCells = data.days.map(function(dateStr) {
    var d    = new Date(dateStr);
    var isToday = dateStr === today.toISOString().slice(0,10);
    var label = DAY_LABELS[d.getDay()] + '<br><span style="font-size:10px">' + d.getDate() + '</span>';
    return '<div style="width:32px;text-align:center;font-size:11px;font-weight:'+(isToday?'600':'400')+';color:'+(isToday?'#185FA5':'var(--color-text-muted)')+'">'+label+'</div>';
  }).join('');

  // Lignes médicaments
  var rowsHTML = data.meds.map(function(med) {
    var cells = med.dayStats.map(function(status, idx) {
      var dateStr = data.days[idx];
      var isToday = dateStr === today.toISOString().slice(0,10);
      var bg, icon, border;
      if (status === 'taken')   { bg='#EAF3DE'; icon='<span style="font-size:12px;color:#3B6D11">✓</span>'; border='none'; }
      else if (status === 'partial') { bg='#FEF3CC'; icon='<span style="font-size:12px;color:#854F0B">~</span>'; border='none'; }
      else if (status === 'missed')  { bg='#FCEBEB'; icon='<span style="font-size:12px;color:#A32D2D">✗</span>'; border='none'; }
      else if (status === 'future')  { bg='transparent'; icon='<span style="font-size:10px;color:var(--color-text-hint)">·</span>'; border='1px dashed var(--color-border-tertiary)'; }
      else { bg='var(--color-bg-surface)'; icon=''; border='none'; }

      return '<div style="width:32px;height:32px;border-radius:8px;background:'+bg+';border:'+border+';display:flex;align-items:center;justify-content:center;'+(isToday?'outline:2px solid rgba(24,95,165,.3);outline-offset:1px':'')+'">' + icon + '</div>';
    }).join('');

    var rateColor = med.rate === null ? 'var(--color-text-muted)' : med.rate >= 80 ? '#3B6D11' : med.rate >= 50 ? '#854F0B' : '#A32D2D';
    var rateLabel = med.rate === null ? '—' : med.rate + '%';

    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:12px;font-weight:500;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+med.name+'</div>' +
      '</div>' +
      '<div style="display:flex;gap:4px">'+cells+'</div>' +
      '<div style="min-width:32px;text-align:right;font-size:12px;font-weight:500;color:'+rateColor+'">'+rateLabel+'</div>' +
    '</div>';
  }).join('');

  // Taux global
  var globalColor  = data.globalRate === null ? 'var(--color-text-muted)' : data.globalRate >= 80 ? '#3B6D11' : data.globalRate >= 50 ? '#854F0B' : '#A32D2D';
  var globalLabel  = data.globalRate === null ? '—' : data.globalRate + '%';
  var globalBg     = data.globalRate === null ? 'var(--color-bg-surface)' : data.globalRate >= 80 ? '#EAF3DE' : data.globalRate >= 50 ? '#FAEEDA' : '#FCEBEB';

  // Légende
  var legendHTML =
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">' +
      '<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:14px;border-radius:4px;background:#EAF3DE"></div><span style="font-size:11px;color:var(--color-text-muted)">Tout pris</span></div>' +
      '<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:14px;border-radius:4px;background:#FEF3CC"></div><span style="font-size:11px;color:var(--color-text-muted)">Partiel</span></div>' +
      '<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:14px;border-radius:4px;background:#FCEBEB"></div><span style="font-size:11px;color:var(--color-text-muted)">Manqu&eacute;</span></div>' +
      '<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:14px;border-radius:4px;border:1px dashed var(--color-border-tertiary)"></div><span style="font-size:11px;color:var(--color-text-muted)">&Agrave; venir</span></div>' +
    '</div>';

  return '<div>' +
    '<div class="row" style="margin-bottom:12px">' +
      '<p class="section-title" style="margin:0;flex:1">Historique 7 jours</p>' +
      '<div style="font-size:13px;font-weight:500;padding:4px 12px;border-radius:99px;background:'+globalBg+';color:'+globalColor+'">'+globalLabel+'</div>' +
    '</div>' +

    '<div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--color-border-tertiary)">' +

      // En-tête des jours
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
        '<div style="flex:1"></div>' +
        '<div style="display:flex;gap:4px">'+headerCells+'</div>' +
        '<div style="min-width:32px"></div>' +
      '</div>' +

      // Lignes médicaments
      rowsHTML +

      // Légende
      legendHTML +
    '</div>' +
  '</div>';
}

// ============================================================
// ONGLET AUJOURD'HUI — médicaments du jour
// ============================================================
function _buildTodayTab(patientId) {
  var meds    = PatientService.getTodayMeds(patientId);
  var MOMENTS = PatientService.MOMENTS;

  var grouped = {};
  meds.forEach(function(m) {
    if (!grouped[m.medId]) grouped[m.medId] = { medId:m.medId, name:m.name, dose:m.dose, photo:m.photo, duration:m.duration, intakes:[] };
    grouped[m.medId].intakes.push(m);
  });

  var medsHTML = Object.values(grouped).map(function(g) {
    var prog = PatientService._dayProgress(g.duration);
    var durHTML = '';
    if (prog) {
      var pct = Math.round((prog.current/prog.total)*100);
      durHTML = '<div style="margin-top:6px">'+
        '<div style="display:flex;justify-content:space-between;margin-bottom:3px">'+
          '<span style="font-size:11px;color:var(--color-text-muted)">Jour '+prog.current+'/'+prog.total+'</span>'+
          '<span style="font-size:11px;color:var(--color-text-muted)">'+(prog.total-prog.current)+'j</span>'+
        '</div>'+
        '<div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%"></div></div>'+
      '</div>';
    }

    var photoHTML = g.photo
      ? '<img src="'+g.photo+'" style="width:46px;height:46px;border-radius:12px;object-fit:cover;flex-shrink:0" alt="'+g.name+'">'
      : '<div class="med-icon-box"><i class="ti ti-pill" style="font-size:22px;color:#185FA5" aria-hidden="true"></i></div>';

    var timesHTML = g.intakes.map(function(i) {
      var bg    = i.status==='taken'?'#EAF3DE':i.status==='missed'?'#FCEBEB':'#F1EFE8';
      var color = i.status==='taken'?'#27500A':i.status==='missed'?'#791F1F':'var(--color-text-muted)';
      var sIcon = i.status==='taken'?'✓':i.status==='missed'?'!':'●';
      var mIcon = i.moment&&MOMENTS[i.moment]?MOMENTS[i.moment]:'';
      return '<div class="time-chip" style="background:'+bg+'" onclick="handleTap(\''+i.medId+'\',\''+i.scheduledDatetime+'\',\''+i.status+'\')">'+
        '<span style="font-size:16px">'+mIcon+'</span>'+
        '<span style="font-size:14px;font-weight:600;color:'+color+'">'+sIcon+'</span>'+
        '<span style="font-size:12px;color:var(--color-text-muted)">'+i.time+'</span>'+
      '</div>';
    }).join('');

    var dot = g.intakes.some(function(i){return i.status==='missed';})?'#A32D2D':
              g.intakes.every(function(i){return i.status==='taken';})?'#3B6D11':'#854F0B';

    return '<div class="med-row">'+
      '<div class="med-row-top">'+photoHTML+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-weight:500;font-size:16px">'+g.name+'</div>'+
          '<div class="text-muted">'+g.dose+'</div>'+durHTML+
        '</div>'+
        '<div style="width:10px;height:10px;border-radius:50%;background:'+dot+';flex-shrink:0"></div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+timesHTML+'</div>'+
      // Boutons edit/delete discrets
      '<div style="display:flex;justify-content:flex-end;gap:6px;padding-top:8px;border-top:0.5px solid var(--color-border-tertiary)">'+
        '<button onclick="editMedication(\''+g.medId+'\')" style="display:flex;align-items:center;gap:4px;background:none;border:1px solid var(--color-border-strong);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--color-text-muted);font-family:inherit">'+
          '<i class="ti ti-edit" style="font-size:13px" aria-hidden="true"></i> Modifier'+
        '</button>'+
        '<button onclick="confirmDeleteMed(\''+g.medId+'\',\''+g.name+'\')" style="display:flex;align-items:center;gap:4px;background:none;border:1px solid rgba(163,45,45,.3);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;color:#A32D2D;font-family:inherit">'+
          '<i class="ti ti-trash" style="font-size:13px" aria-hidden="true"></i> Supprimer'+
        '</button>'+
      '</div>'+
    '</div>';
  }).join('');

  if (!medsHTML) medsHTML = '<p class="text-muted" style="text-align:center;padding:20px 0">Aucun m&eacute;dicament configur&eacute;.</p>';

  return '<div class="stack-sm">'+
    '<div class="row" style="margin-bottom:4px">'+
      '<p class="section-title" style="margin:0;flex:1">M&eacute;dicaments du jour</p>'+
      '<button onclick="Router.go(\'add-medication\')" style="background:none;border:1.5px solid #185FA5;border-radius:99px;padding:5px 14px;font-size:13px;cursor:pointer;color:#185FA5;font-family:inherit;font-weight:500">+ Ajouter</button>'+
    '</div>'+
    medsHTML+
  '</div>';
}

// ============================================================
// ONGLET PROFIL — infos + modifier + danger zone
// ============================================================
function _buildProfilTab(p) {
  return '<div class="stack">' +

    '<div class="card stack-sm">' +
      '<p class="section-title">Informations</p>' +
      '<div class="row" style="min-height:40px">' +
        '<i class="ti ti-user" style="font-size:18px;color:#185FA5;flex-shrink:0" aria-hidden="true"></i>' +
        '<div style="flex:1"><div style="font-size:13px;color:var(--color-text-muted)">Nom complet</div><div style="font-weight:500">'+p.prenom+' '+p.nom+'</div></div>' +
      '</div>' +
      (p.dateNaissance ?
        '<div class="row" style="min-height:40px">' +
          '<i class="ti ti-calendar" style="font-size:18px;color:#185FA5;flex-shrink:0" aria-hidden="true"></i>' +
          '<div style="flex:1"><div style="font-size:13px;color:var(--color-text-muted)">Date de naissance</div><div style="font-weight:500">'+new Date(p.dateNaissance).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+' ('+_age(p.dateNaissance)+' ans)</div></div>' +
        '</div>' : '') +
      (p.notes ?
        '<div class="row" style="min-height:40px;align-items:flex-start">' +
          '<i class="ti ti-notes" style="font-size:18px;color:#185FA5;flex-shrink:0;margin-top:2px" aria-hidden="true"></i>' +
          '<div style="flex:1"><div style="font-size:13px;color:var(--color-text-muted)">Notes</div><div style="font-weight:400;font-style:italic">'+p.notes+'</div></div>' +
        '</div>' : '') +
    '</div>' +

    '<button class="btn btn-primary" onclick="Router.go(\'edit-patient\')" style="display:flex;align-items:center;justify-content:center;gap:8px">'+
      '<i class="ti ti-edit" aria-hidden="true"></i> Modifier le profil'+
    '</button>' +

    '<div class="card" style="border:1px solid rgba(163,45,45,.25)">' +
      '<p class="section-title" style="color:#A32D2D">Zone dangereuse</p>' +
      '<div class="row" style="margin-top:8px">' +
        '<div style="flex:1"><div style="font-weight:500;font-size:14px">Supprimer ce patient</div><div class="text-muted" style="font-size:12px">Action irr&eacute;versible</div></div>' +
        '<button onclick="confirmDeletePatient()" style="background:#FCEBEB;border:none;border-radius:99px;padding:6px 16px;font-size:13px;cursor:pointer;color:#A32D2D;font-family:inherit;font-weight:500">Supprimer</button>' +
      '</div>' +
    '</div>' +

  '</div>';
}
