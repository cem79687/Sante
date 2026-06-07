// patients.js — gestion des patients et leurs médicaments

const STORAGE_KEY = 'medisafe_patients';

function _load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function _save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function _id() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// ── PATIENTS ──────────────────────────────────────────────
function getPatients()  { return Object.values(_load()); }
function getPatient(id) { return _load()[id] || null; }

function addPatient({ nom, prenom, dateNaissance=null, photo=null, notes='' }) {
  if (!nom || !prenom) throw new Error('Nom et prénom obligatoires');
  const data = _load();
  const id   = _id();
  data[id]   = { id, nom, prenom, dateNaissance, photo, notes, medications:{}, contacts:{}, createdAt: new Date().toISOString() };
  _save(data);
  return data[id];
}

function updatePatient(id, fields) {
  const data = _load();
  if (!data[id]) throw new Error('Patient introuvable');
  Object.assign(data[id], fields, { updatedAt: new Date().toISOString() });
  _save(data);
  return data[id];
}

function deletePatient(id) {
  const data = _load();
  delete data[id];
  _save(data);
}

// ── MÉDICAMENTS ───────────────────────────────────────────
const MOMENTS = { fasting:'🌅', before:'⏱️', during:'🍽️', after:'✅', bedtime:'🌙' };

function getMedications(patientId) {
  const p = getPatient(patientId);
  return p ? Object.values(p.medications).filter(m => m.active !== false) : [];
}

function getMedication(patientId, medId) {
  const p = getPatient(patientId);
  return p ? p.medications[medId] || null : null;
}

function addMedication(patientId, { name, dose, schedule, photo=null, duration=null, stock=null }) {
  if (!name || !dose || !schedule || !schedule.length) throw new Error('Champs obligatoires manquants');
  const data = _load();
  if (!data[patientId]) throw new Error('Patient introuvable');
  const id  = _id();
  const med = { id, name:name.trim(), dose:dose.trim(), schedule, photo, duration, stock, active:true, createdAt:new Date().toISOString() };
  data[patientId].medications[id] = med;
  _save(data);
  return med;
}

function updateMedication(patientId, medId, fields) {
  const data = _load();
  if (!data[patientId]?.medications[medId]) throw new Error('Médicament introuvable');
  Object.assign(data[patientId].medications[medId], fields, { updatedAt: new Date().toISOString() });
  _save(data);
  return data[patientId].medications[medId];
}

function deleteMedication(patientId, medId) {
  // Soft delete — conserve l'historique des prises
  return updateMedication(patientId, medId, { active: false });
}

// ── PRISES DU JOUR ────────────────────────────────────────
function getTodayMeds(patientId) {
  const meds   = getMedications(patientId);
  const today  = new Date().toISOString().slice(0,10);
  const intKey = 'medisafe_intakes_' + patientId;
  const intakes = (() => { try { return JSON.parse(localStorage.getItem(intKey)) || {}; } catch { return {}; } })();
  const result  = [];

  meds.forEach(med => {
    const prog = _dayProgress(med.duration);
    if (prog && prog.done) return;
    med.schedule.forEach(slot => {
      const dt = today + 'T' + slot.time + ':00';
      const ex = Object.values(intakes).find(i => i.medId===med.id && i.scheduledTime===dt);
      const status = ex?.takenAt ? 'taken' : (new Date()-new Date(dt)>3600000 ? 'missed' : 'pending');
      result.push({ intakeId:ex?.id||null, medId:med.id, name:med.name, dose:med.dose, time:slot.time, moment:slot.moment||null, scheduledDatetime:dt, status, photo:med.photo||null, duration:med.duration||null });
    });
  });

  return result.sort((a,b) => {
    const [ah,am]=a.time.split(':').map(Number);
    const [bh,bm]=b.time.split(':').map(Number);
    return (ah*60+am)-(bh*60+bm);
  });
}

function confirmTaken(patientId, medId, scheduledDatetime) {
  const intKey  = 'medisafe_intakes_' + patientId;
  const intakes = (() => { try { return JSON.parse(localStorage.getItem(intKey)) || {}; } catch { return {}; } })();
  let intake = Object.values(intakes).find(i => i.medId===medId && i.scheduledTime===scheduledDatetime);
  if (intake) { intake.takenAt=new Date().toISOString(); intake.status='taken'; }
  else { const id=_id(); intake={id,medId,scheduledTime:scheduledDatetime,takenAt:new Date().toISOString(),status:'taken'}; intakes[id]=intake; }
  localStorage.setItem(intKey, JSON.stringify(intakes));
  return intake;
}

function _dayProgress(duration) {
  if (!duration) return null;
  const start=new Date(duration.startDate); const today=new Date();
  start.setHours(0,0,0,0); today.setHours(0,0,0,0);
  const diff=Math.floor((today-start)/86400000)+1;
  return { current:Math.min(diff,duration.days), total:duration.days, done:diff>duration.days };
}

function getPatientSummary(patientId) {
  const meds=getTodayMeds(patientId);
  return {
    missed:  meds.filter(m=>m.status==='missed').length,
    taken:   meds.filter(m=>m.status==='taken').length,
    pending: meds.filter(m=>m.status==='pending').length,
    total:   meds.length
  };
}

// ── DONNÉES DE TEST ───────────────────────────────────────
function seedIfEmpty() {
  // Ne resemer que si jamais aucune donnée n'a existé (premier lancement absolu)
  if (localStorage.getItem('medisafe_seeded')) return;
  if (Object.keys(_load()).length > 0) { localStorage.setItem('medisafe_seeded','1'); return; }
  const p1 = addPatient({ nom:'Dupont', prenom:'Marcel', dateNaissance:'1945-03-12', notes:'Diabétique, allergie pénicilline' });
  const p2 = addPatient({ nom:'Martin', prenom:'Jeanne', dateNaissance:'1938-07-25', notes:'Hypertension' });
  const p3 = addPatient({ nom:'Leroy',  prenom:'Robert', dateNaissance:'1950-11-08', notes:'' });
  addMedication(p1.id, { name:'Metformine 850mg', dose:'1 comprimé', schedule:[{time:'08:00',moment:'during'},{time:'20:00',moment:'during'}] });
  addMedication(p1.id, { name:'Doliprane 500mg',  dose:'1 comprimé', schedule:[{time:'08:00',moment:'fasting'},{time:'14:00',moment:'after'},{time:'20:00',moment:'bedtime'}] });
  addMedication(p2.id, { name:'Amlodipine 5mg',   dose:'1 comprimé', schedule:[{time:'08:00',moment:'fasting'}] });
  addMedication(p2.id, { name:'Amoxicilline 500mg',dose:'1 gélule',  schedule:[{time:'08:00',moment:'during'},{time:'14:00',moment:'during'},{time:'20:00',moment:'during'}], duration:{days:7,startDate:new Date().toISOString().slice(0,10)} });
  addMedication(p3.id, { name:'Kardégic 75mg',    dose:'1 sachet',   schedule:[{time:'08:00',moment:'after'}] });
  localStorage.setItem('medisafe_seeded','1');
}


// ── ORDONNANCES ───────────────────────────────────────────

function getOrdonnances(patientId) {
  const p = getPatient(patientId);
  return p ? Object.values(p.ordonnances || {}) : [];
}

function getOrdonnance(patientId, ordoId) {
  const p = getPatient(patientId);
  return p ? (p.ordonnances || {})[ordoId] || null : null;
}

function addOrdonnance(patientId, { medecin, dateExpiration, photo=null, notes='' }) {
  if (!medecin)         throw new Error('Nom du médecin obligatoire');
  if (!dateExpiration)  throw new Error('Date d\'expiration obligatoire');
  const data = _load();
  if (!data[patientId]) throw new Error('Patient introuvable');
  if (!data[patientId].ordonnances) data[patientId].ordonnances = {};
  const id   = _id();
  const ordo = { id, medecin:medecin.trim(), dateExpiration, photo:photo||null, notes:notes||'', createdAt:new Date().toISOString() };
  data[patientId].ordonnances[id] = ordo;
  _save(data);
  return ordo;
}

function deleteOrdonnance(patientId, ordoId) {
  const data = _load();
  if (!data[patientId]?.ordonnances?.[ordoId]) throw new Error('Ordonnance introuvable');
  delete data[patientId].ordonnances[ordoId];
  _save(data);
}

function getOrdonnanceStatus(dateExpiration) {
  const exp  = new Date(dateExpiration);
  const now  = new Date();
  exp.setHours(0,0,0,0); now.setHours(0,0,0,0);
  const diff = Math.ceil((exp - now) / 86400000);
  if (diff < 0)   return { label:'Expirée',          color:'#A32D2D', bg:'#FCEBEB', urgency:3 };
  if (diff === 0) return { label:'Expire aujourd\'hui', color:'#A32D2D', bg:'#FCEBEB', urgency:3 };
  if (diff <= 7)  return { label:'Expire dans '+diff+'j', color:'#A32D2D', bg:'#FCEBEB', urgency:3 };
  if (diff <= 15) return { label:'Expire dans '+diff+'j', color:'#854F0B', bg:'#FAEEDA', urgency:2 };
  if (diff <= 30) return { label:'Expire dans '+diff+'j', color:'#854F0B', bg:'#FAEEDA', urgency:1 };
  return { label:'Valide — '+diff+'j restants', color:'#27500A', bg:'#EAF3DE', urgency:0 };
}

function getExpiringOrdonnances(days=30) {
  const result = [];
  getPatients().forEach(function(p) {
    (Object.values(p.ordonnances || {})).forEach(function(o) {
      const status = getOrdonnanceStatus(o.dateExpiration);
      if (status.urgency > 0) {
        result.push({ ...o, patientId:p.id, patientName:p.prenom+' '+p.nom, status });
      }
    });
  });
  return result.sort((a,b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));
}


// ── HISTORIQUE 7 JOURS ────────────────────────────────────

function getMedHistory7Days(patientId) {
  const meds    = getMedications(patientId);
  const intKey  = 'medisafe_intakes_' + patientId;
  const intakes = (() => { try { return JSON.parse(localStorage.getItem(intKey)) || {}; } catch { return {}; } })();
  const today   = new Date(); today.setHours(0,0,0,0);

  // Construire les 7 derniers jours (du plus ancien au plus récent)
  const days = [];
  for (var i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0,10));
  }

  // Pour chaque médicament actif, calculer le statut par jour
  const result = meds.map(function(med) {
    const dayStats = days.map(function(dateStr) {
      // Trouver toutes les prises prévues ce jour
      const slots = med.schedule || [];
      const prises = slots.map(function(slot) {
        const dt = dateStr + 'T' + slot.time + ':00';
        const ex = Object.values(intakes).find(function(i) {
          return i.medId === med.id && i.scheduledTime === dt;
        });
        const isPast = new Date(dt) < new Date();
        if (ex && ex.takenAt) return 'taken';
        if (isPast) return 'missed';
        return 'future';
      });

      if (prises.length === 0) return 'none';
      if (prises.every(function(s) { return s === 'future'; })) return 'future';
      if (prises.every(function(s) { return s === 'taken'; })) return 'taken';
      if (prises.some(function(s) { return s === 'missed'; })) return 'missed';
      // Mix taken + future = partial
      if (prises.some(function(s) { return s === 'taken'; })) return 'partial';
      return 'none';
    });

    // Taux d'observance sur les jours passés
    const pastDays = dayStats.filter(function(s) { return s !== 'future' && s !== 'none'; });
    const takenDays = dayStats.filter(function(s) { return s === 'taken'; });
    const rate = pastDays.length > 0 ? Math.round((takenDays.length / pastDays.length) * 100) : null;

    return { medId: med.id, name: med.name, dose: med.dose, dayStats: dayStats, rate: rate };
  });

  // Taux global
  const allPast   = result.reduce(function(acc, m) { return acc + m.dayStats.filter(function(s) { return s !== 'future' && s !== 'none'; }).length; }, 0);
  const allTaken  = result.reduce(function(acc, m) { return acc + m.dayStats.filter(function(s) { return s === 'taken'; }).length; }, 0);
  const globalRate = allPast > 0 ? Math.round((allTaken / allPast) * 100) : null;

  return { days: days, meds: result, globalRate: globalRate };
}


// Stock — calcul jours restants
function getStockDays(med) {
  if (!med.stock || !med.schedule) return null;
  const prisesParJour = med.schedule.length;
  return prisesParJour > 0 ? Math.floor(med.stock / prisesParJour) : null;
}

function updateStock(patientId, medId, stock) {
  return updateMedication(patientId, medId, { stock: parseInt(stock) || null });
}


// ── CONTACTS D'ALERTE ─────────────────────────────────────

function getContacts(patientId) {
  const p = getPatient(patientId);
  return p ? Object.values(p.contacts || {}) : [];
}

function addContact(patientId, { nom, relation, telephone, niveau='missed' }) {
  if (!nom || !telephone) throw new Error('Nom et téléphone obligatoires');
  const data = _load();
  if (!data[patientId]) throw new Error('Patient introuvable');
  if (!data[patientId].contacts) data[patientId].contacts = {};
  const id = _id();
  const contact = { id, nom:nom.trim(), relation:relation||'', telephone:telephone.trim(), niveau, createdAt:new Date().toISOString() };
  data[patientId].contacts[id] = contact;
  _save(data);
  return contact;
}

function updateContact(patientId, contactId, fields) {
  const data = _load();
  if (!data[patientId]?.contacts?.[contactId]) throw new Error('Contact introuvable');
  Object.assign(data[patientId].contacts[contactId], fields);
  _save(data);
  return data[patientId].contacts[contactId];
}

function deleteContact(patientId, contactId) {
  const data = _load();
  if (!data[patientId]?.contacts) return;
  delete data[patientId].contacts[contactId];
  _save(data);
}

// Stocks faibles — tous patients
function getLowStocks() {
  const result = [];
  getPatients().forEach(function(p) {
    getMedications(p.id).forEach(function(m) {
      if (m.stock === null || m.stock === undefined) return;
      const perDay = m.stockPerDay || m.schedule.length;
      const daysLeft = perDay > 0 ? Math.floor(m.stock / perDay) : 999;
      if (daysLeft <= 7) {
        result.push({ patientId:p.id, patientName:p.prenom+' '+p.nom, medId:m.id, medName:m.name, stock:m.stock, daysLeft });
      }
    });
  });
  return result.sort((a,b) => a.daysLeft - b.daysLeft);
}

window.PatientService = {
  getPatients, getPatient, addPatient, updatePatient, deletePatient,
  getMedications, getMedication, addMedication, updateMedication, deleteMedication,
  getTodayMeds, confirmTaken, getPatientSummary, seedIfEmpty,
  _dayProgress, MOMENTS,
  getOrdonnances, getOrdonnance, addOrdonnance, deleteOrdonnance,
  getOrdonnanceStatus, getExpiringOrdonnances,
  getMedHistory7Days,
  getContacts, addContact, updateContact, deleteContact,
  getLowStocks
};
