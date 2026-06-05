// sync.js — lecture des données aidant depuis localStorage partagé
// Phase test : même navigateur = même localStorage
// Phase Firebase : remplacer par des appels Firestore

const STORAGE_KEY_PATIENTS = 'medisafe_patients';
const MOMENTS = { fasting:'🌅', before:'⏱️', during:'🍽️', after:'✅', bedtime:'🌙' };

// ── Récupérer le profil du senior configuré ────────────────
// En phase test : on prend le premier patient de la liste
// En phase Firebase : on cherchera par ID de compte senior
function getSeniorProfile() {
  try {
    var data = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS)) || {};
    var patients = Object.values(data);
    if (patients.length === 0) return null;
    // Cherche si un patient est marqué comme "senior actif"
    var active = patients.find(function(p) { return p.isSeniorActive; });
    return active || patients[0];
  } catch(e) { return null; }
}

// ── Récupérer les médicaments du jour du senior ─────────────
function getTodayMeds(patientId) {
  try {
    var data     = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS)) || {};
    var patient  = data[patientId];
    if (!patient) return [];

    var meds    = Object.values(patient.medications || {}).filter(function(m) { return m.active !== false; });
    var today   = new Date().toISOString().slice(0,10);
    var intKey  = 'medisafe_intakes_' + patientId;
    var intakes = (() => { try { return JSON.parse(localStorage.getItem(intKey)) || {}; } catch { return {}; } })();
    var result  = [];

    meds.forEach(function(med) {
      // Vérifier durée traitement
      if (med.duration) {
        var start = new Date(med.duration.startDate); start.setHours(0,0,0,0);
        var now   = new Date(); now.setHours(0,0,0,0);
        var diff  = Math.floor((now - start) / 86400000) + 1;
        if (diff > med.duration.days) return;
      }

      (med.schedule || []).forEach(function(slot) {
        var dt = today + 'T' + slot.time + ':00';
        var ex = Object.values(intakes).find(function(i) {
          return i.medId === med.id && i.scheduledTime === dt;
        });
        var status = ex && ex.takenAt ? 'taken'
          : (new Date() - new Date(dt) > 3600000 ? 'missed' : 'pending');

        result.push({
          medId:             med.id,
          name:              med.name,
          dose:              med.dose,
          time:              slot.time,
          moment:            slot.moment || null,
          scheduledDatetime: dt,
          status:            status,
          photo:             med.photo || null,
        });
      });
    });

    return result.sort(function(a,b) {
      var [ah,am] = a.time.split(':').map(Number);
      var [bh,bm] = b.time.split(':').map(Number);
      return (ah*60+am) - (bh*60+bm);
    });
  } catch(e) { return []; }
}

// ── Confirmer une prise ─────────────────────────────────────
function confirmTaken(patientId, medId, scheduledDatetime) {
  try {
    var intKey  = 'medisafe_intakes_' + patientId;
    var intakes = (() => { try { return JSON.parse(localStorage.getItem(intKey)) || {}; } catch { return {}; } })();
    var id      = Date.now().toString(36) + Math.random().toString(36).slice(2,6);

    var existing = Object.values(intakes).find(function(i) {
      return i.medId === medId && i.scheduledTime === scheduledDatetime;
    });

    if (existing) {
      existing.takenAt = new Date().toISOString();
      existing.status  = 'taken';
    } else {
      intakes[id] = { id, medId, scheduledTime: scheduledDatetime, takenAt: new Date().toISOString(), status:'taken' };
    }

    localStorage.setItem(intKey, JSON.stringify(intakes));
    return true;
  } catch(e) { return false; }
}

// ── Vérifier si des données aidant existent ─────────────────
function hasData() {
  try {
    var data = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS)) || {};
    return Object.keys(data).length > 0;
  } catch(e) { return false; }
}

// ── Définir le senior actif (pour les tests multi-patients) ─
function setSeniorActive(patientId) {
  try {
    var data = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS)) || {};
    Object.keys(data).forEach(function(id) {
      data[id].isSeniorActive = (id === patientId);
    });
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(data));
    return true;
  } catch(e) { return false; }
}

window.SyncService = {
  getSeniorProfile, getTodayMeds, confirmTaken, hasData, setSeniorActive, MOMENTS
};
