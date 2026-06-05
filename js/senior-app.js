// app.js — MediSafe Senior — ultra-minimaliste

var _seniorProfile = null;

function initApp() {
  if (!window.SyncService) {
    document.getElementById('app').innerHTML =
      '<div style="padding:40px;text-align:center;color:red">Erreur chargement.</div>';
    return;
  }
  Router.register('splash',  renderSplash);
  Router.register('home',    renderHome);
  Router.go('splash');
}

// ============================================================
// SPLASH — 2 secondes puis accueil
// ============================================================
function renderSplash() {
  document.getElementById('app').innerHTML =
    '<div class="splash">' +
      '<div class="splash-logo">💊</div>' +
      '<div>' +
        '<div class="splash-title">MediSafe</div>' +
        '<div class="splash-sub" style="margin-top:8px">Vos médicaments du jour</div>' +
      '</div>' +
    '</div>';

  setTimeout(function() {
    Router.go('home');
  }, 1800);
}

// ============================================================
// ÉCRAN ACCUEIL — médicaments du jour
// ============================================================
function renderHome() {
  _seniorProfile = SyncService.getSeniorProfile();

  // Pas de données aidant
  if (!SyncService.hasData() || !_seniorProfile) {
    document.getElementById('app').innerHTML =
      '<div style="padding:calc(20px + env(safe-area-inset-top,0px)) 20px 20px">' +
        '<div class="header" style="background:#185FA5;border-radius:16px;padding:16px 18px;margin-bottom:20px">' +
          '<div class="header-title">Bonjour 👋</div>' +
        '</div>' +
        '<div class="empty-state">' +
          '<div class="empty-icon">⚙️</div>' +
          '<div class="empty-title">App non configurée</div>' +
          '<div class="empty-sub">Demandez à votre aidant de configurer vos médicaments depuis son téléphone.</div>' +
        '</div>' +
      '</div>';
    return;
  }

  var meds  = SyncService.getTodayMeds(_seniorProfile.id);
  var today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  var MOMENTS = SyncService.MOMENTS;

  // Regrouper par médicament
  var grouped = {};
  meds.forEach(function(m) {
    if (!grouped[m.medId]) {
      grouped[m.medId] = { medId:m.medId, name:m.name, dose:m.dose, photo:m.photo, intakes:[] };
    }
    grouped[m.medId].intakes.push(m);
  });
  var groups = Object.values(grouped);

  // Alerte si prises manquées
  var missed = meds.filter(function(m) { return m.status === 'missed'; });
  var alertHTML = missed.length > 0
    ? '<div class="alert-banner">' +
        '<span style="font-size:26px">⚠️</span>' +
        '<span>' + missed.length + ' prise' + (missed.length > 1 ? 's' : '') + ' non effectuée' + (missed.length > 1 ? 's' : '') + '</span>' +
      '</div>'
    : '';

  // Cartes médicaments
  var cardsHTML = '';
  if (groups.length === 0) {
    cardsHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">✅</div>' +
        '<div class="empty-title">Aucun médicament aujourd\'hui</div>' +
        '<div class="empty-sub">Votre aidant n\'a pas encore configuré de médicaments pour aujourd\'hui.</div>' +
      '</div>';
  } else {
    cardsHTML = groups.map(function(g) {
      var photoHTML = g.photo
        ? '<img src="'+g.photo+'" class="med-photo" alt="'+g.name+'">'
        : '<div class="med-photo-placeholder">💊</div>';

      var timesHTML = g.intakes.map(function(i) {
        var chipClass = i.status === 'taken'  ? 'chip-taken'
                      : i.status === 'missed' ? 'chip-missed' : 'chip-pending';
        var sIcon     = i.status === 'taken'  ? '✓'
                      : i.status === 'missed' ? '!' : '●';
        var sColor    = i.status === 'taken'  ? '#27500A'
                      : i.status === 'missed' ? '#791F1F' : '#5A5955';
        var mIcon     = i.moment && MOMENTS[i.moment] ? MOMENTS[i.moment] : '';

        return '<div class="time-chip '+chipClass+'" ' +
          'onclick="handleTap(\''+g.medId+'\',\''+i.scheduledDatetime+'\',\''+i.status+'\',\''+g.name+'\')">' +
          '<span class="time-chip-icon">'+mIcon+'</span>' +
          '<span class="time-chip-status" style="color:'+sColor+'">'+sIcon+'</span>' +
          '<span class="time-chip-time">'+i.time+'</span>' +
        '</div>';
      }).join('');

      // Statut global de la carte
      var allTaken  = g.intakes.every(function(i) { return i.status === 'taken'; });
      var anyMissed = g.intakes.some(function(i)  { return i.status === 'missed'; });
      var cardBorder = allTaken  ? '2px solid rgba(59,109,17,.3)'
                     : anyMissed ? '2px solid rgba(163,45,45,.3)'
                     : '1.5px solid rgba(0,0,0,.06)';

      return '<div class="med-card" style="border:'+cardBorder+'">' +
        '<div style="display:flex;align-items:center;gap:14px">' +
          photoHTML +
          '<div style="flex:1;min-width:0">' +
            '<div class="med-name">'+g.name+'</div>' +
            '<div class="med-dose">'+g.dose+'</div>' +
          '</div>' +
        '</div>' +
        '<div class="time-chips">'+timesHTML+'</div>' +
      '</div>';
    }).join('');
  }

  // Prochain rappel
  var pending = meds.filter(function(m) { return m.status === 'pending'; });
  var nextHTML = '';
  if (pending.length > 0) {
    nextHTML =
      '<div style="background:#E6F1FB;border-radius:16px;padding:14px 18px;display:flex;align-items:center;gap:12px">' +
        '<span style="font-size:24px">⏰</span>' +
        '<div>' +
          '<div style="font-size:14px;color:#185FA5;font-weight:500">Prochain rappel</div>' +
          '<div style="font-size:20px;font-weight:500;color:#0C447C">'+pending[0].time+' — '+pending[0].name+'</div>' +
        '</div>' +
      '</div>';
  } else if (groups.length > 0) {
    nextHTML =
      '<div style="background:#EAF3DE;border-radius:16px;padding:14px 18px;display:flex;align-items:center;gap:12px">' +
        '<span style="font-size:24px">🎉</span>' +
        '<div style="font-size:20px;font-weight:500;color:#27500A">Tous les médicaments sont pris !</div>' +
      '</div>';
  }

  document.getElementById('app').innerHTML =
    // Header
    '<div class="header">' +
      '<div>' +
        '<div class="header-title">Bonjour ' + _seniorProfile.prenom + ' 👋</div>' +
        '<div class="header-date">' + today + '</div>' +
      '</div>' +
    '</div>' +
    // Contenu
    '<div class="pad-lg stack-lg" style="padding-top:20px;padding-bottom:calc(32px + env(safe-area-inset-bottom,0px))">' +
      alertHTML +
      cardsHTML +
      nextHTML +
    '</div>';
}

// ============================================================
// CONFIRMATION DE PRISE
// ============================================================
function handleTap(medId, scheduledDatetime, currentStatus, medName) {
  if (currentStatus === 'taken') return;

  // Enregistrer la prise
  SyncService.confirmTaken(_seniorProfile.id, medId, scheduledDatetime);

  // Animation de confirmation
  showConfirmation(medName, function() {
    renderHome();
  });
}

function showConfirmation(medName, callback) {
  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML =
    '<div class="confirm-check">✅</div>' +
    '<div class="confirm-text">Pris !\n' + medName + '</div>';

  document.body.appendChild(overlay);

  setTimeout(function() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(function() {
      overlay.remove();
      if (callback) callback();
    }, 300);
  }, 1200);
}

// Démarrage
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else { initApp(); }
