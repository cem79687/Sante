// supabase.js — Client Supabase partagé aidant + senior
// ============================================================

const SUPABASE_URL = 'https://norrryycagaogwndnbcj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tUqQI-OwFkiHD2Um1gYeRA_Q7AyrYMk';

// Chargement dynamique du SDK Supabase
function _loadSupabaseSDK() {
  return new Promise(function(resolve, reject) {
    if (window.supabase) { resolve(window.supabase); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload  = function() { resolve(window.supabase); };
    s.onerror = function() { reject(new Error('Impossible de charger Supabase SDK')); };
    document.head.appendChild(s);
  });
}

let _client = null;

async function getClient() {
  if (_client) return _client;
  const sdk = await _loadSupabaseSDK();
  _client = sdk.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      storage:            window.localStorage
    }
  });
  return _client;
}

// Connexion anonyme — pour que le senior puisse utiliser le realtime
async function ensureSession() {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    // Pas de session — connexion anonyme automatique
    try {
      await sb.auth.signInAnonymously();
    } catch(e) {
      console.warn('[Supabase] signInAnonymously non disponible:', e.message);
    }
  }
  return sb;
}

// ── AUTH ───────────────────────────────────────────────────

async function signUp(email, password, nom, prenom) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;

  // Créer le profil aidant via fonction SECURITY DEFINER (contourne RLS)
  if (data.user) {
    const { error: e2 } = await sb.rpc('create_aidant_profile', {
      p_user_id: data.user.id,
      p_nom:     nom.trim(),
      p_prenom:  prenom.trim(),
      p_email:   email.trim()
    });
    if (e2) throw e2;
  }
  return data;
}

async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const sb = await getClient();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

async function getSession() {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  return data.session;
}

async function getCurrentUser() {
  const sb = await getClient();
  const { data } = await sb.auth.getUser();
  return data.user || null;
}

async function getAidantProfile() {
  const sb   = await getClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await sb.from('aidants')
    .select('*').eq('user_id', user.id).single();
  if (error) return null;
  return data;
}

// ── PATIENTS ───────────────────────────────────────────────

async function getPatients() {
  const sb      = await getClient();
  const aidant  = await getAidantProfile();
  if (!aidant) return [];
  const { data, error } = await sb.from('patients')
    .select('*').eq('aidant_id', aidant.id).order('created_at');
  if (error) throw error;
  return data || [];
}

async function getPatient(id) {
  const sb = await getClient();
  const { data, error } = await sb.from('patients')
    .select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function addPatient({ nom, prenom, dateNaissance=null, photo=null, notes='' }) {
  const sb     = await getClient();
  const aidant = await getAidantProfile();
  if (!aidant) throw new Error('Non authentifié');
  const { data, error } = await sb.from('patients').insert({
    aidant_id:       aidant.id,
    nom:             nom.trim(),
    prenom:          prenom.trim(),
    date_naissance:  dateNaissance || null,
    photo:           photo || null,
    notes:           notes || ''
  }).select().single();
  if (error) throw error;
  return _mapPatient(data);
}

async function updatePatient(id, fields) {
  const sb = await getClient();
  const mapped = {};
  if (fields.nom)           mapped.nom            = fields.nom;
  if (fields.prenom)        mapped.prenom          = fields.prenom;
  if (fields.dateNaissance !== undefined) mapped.date_naissance = fields.dateNaissance;
  if (fields.photo !== undefined)         mapped.photo          = fields.photo;
  if (fields.notes !== undefined)         mapped.notes          = fields.notes;
  const { data, error } = await sb.from('patients')
    .update(mapped).eq('id', id).select().single();
  if (error) throw error;
  return _mapPatient(data);
}

async function deletePatient(id) {
  const sb = await getClient();
  const { error } = await sb.from('patients').delete().eq('id', id);
  if (error) throw error;
}

// ── MEDICATIONS ────────────────────────────────────────────

async function getMedications(patientId) {
  const sb = await getClient();
  const { data, error } = await sb.from('medications')
    .select('*').eq('patient_id', patientId).eq('active', true).order('created_at');
  if (error) throw error;
  return (data || []).map(_mapMed);
}

async function getMedication(patientId, medId) {
  const sb = await getClient();
  const { data, error } = await sb.from('medications')
    .select('*').eq('id', medId).eq('patient_id', patientId).single();
  if (error) return null;
  return _mapMed(data);
}

async function addMedication(patientId, { name, dose, schedule, photo=null, duration=null, stock=null, stockPerDay=null }) {
  const sb = await getClient();
  if (!name || !dose || !schedule || !schedule.length) throw new Error('Champs obligatoires manquants');
  const { data, error } = await sb.from('medications').insert({
    patient_id:    patientId,
    name:          name.trim(),
    dose:          dose.trim(),
    schedule:      schedule,
    photo:         photo || null,
    duration:      duration || null,
    stock:         stock ? parseInt(stock) : null,
    stock_per_day: stockPerDay || schedule.length,
    active:        true
  }).select().single();
  if (error) throw error;
  return _mapMed(data);
}

async function updateMedication(patientId, medId, fields) {
  const sb = await getClient();
  const mapped = {};
  if (fields.name     !== undefined) mapped.name          = fields.name;
  if (fields.dose     !== undefined) mapped.dose          = fields.dose;
  if (fields.schedule !== undefined) mapped.schedule      = fields.schedule;
  if (fields.photo    !== undefined) mapped.photo         = fields.photo;
  if (fields.duration !== undefined) mapped.duration      = fields.duration;
  if (fields.stock    !== undefined) mapped.stock         = fields.stock;
  if (fields.active   !== undefined) mapped.active        = fields.active;
  const { data, error } = await sb.from('medications')
    .update(mapped).eq('id', medId).select().single();
  if (error) throw error;
  return _mapMed(data);
}

async function deleteMedication(patientId, medId) {
  return updateMedication(patientId, medId, { active: false });
}

// ── PRISES DU JOUR ─────────────────────────────────────────

async function getTodayMeds(patientId) {
  const sb    = await getClient();
  const meds  = await getMedications(patientId);
  const today = new Date().toISOString().slice(0, 10);

  const { data: intakesData } = await sb.from('intakes')
    .select('*')
    .eq('patient_id', patientId)
    .gte('scheduled_time', today + 'T00:00:00')
    .lte('scheduled_time', today + 'T23:59:59');

  const intakes = intakesData || [];
  const result  = [];

  meds.forEach(function(med) {
    const prog = _dayProgress(med.duration);
    if (prog && prog.done) return;
    (med.schedule || []).forEach(function(slot) {
      const dt  = today + 'T' + slot.time + ':00';
      const ex  = intakes.find(function(i) {
        return i.medication_id === med.id &&
               i.scheduled_time.slice(0, 16) === dt.slice(0, 16);
      });
      const status = ex && ex.taken_at ? 'taken'
        : (new Date() - new Date(dt) > 3600000 ? 'missed' : 'pending');
      result.push({
        intakeId:          ex ? ex.id : null,
        medId:             med.id,
        name:              med.name,
        dose:              med.dose,
        time:              slot.time,
        moment:            slot.moment || null,
        scheduledDatetime: dt,
        status:            status,
        photo:             med.photo || null,
        duration:          med.duration || null
      });
    });
  });

  return result.sort(function(a, b) {
    const [ah, am] = a.time.split(':').map(Number);
    const [bh, bm] = b.time.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });
}

async function confirmTaken(patientId, medId, scheduledDatetime) {
  const sb    = await getClient();
  const today = new Date().toISOString().slice(0, 10);

  // Chercher prise existante
  const { data: existing } = await sb.from('intakes')
    .select('*')
    .eq('patient_id',    patientId)
    .eq('medication_id', medId)
    .gte('scheduled_time', today + 'T00:00:00')
    .lte('scheduled_time', today + 'T23:59:59')
    .limit(1);

  const now = new Date().toISOString();

  if (existing && existing.length > 0) {
    const { data, error } = await sb.from('intakes')
      .update({ taken_at: now, status: 'taken' })
      .eq('id', existing[0].id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await sb.from('intakes').insert({
      patient_id:     patientId,
      medication_id:  medId,
      scheduled_time: scheduledDatetime,
      taken_at:       now,
      status:         'taken'
    }).select().single();
    if (error) throw error;
    return data;
  }
}

async function getPatientSummary(patientId) {
  const meds = await getTodayMeds(patientId);
  return {
    missed:  meds.filter(function(m) { return m.status === 'missed';  }).length,
    taken:   meds.filter(function(m) { return m.status === 'taken';   }).length,
    pending: meds.filter(function(m) { return m.status === 'pending'; }).length,
    total:   meds.length
  };
}

// ── HISTORIQUE 7 JOURS ─────────────────────────────────────

async function getMedHistory7Days(patientId) {
  const sb   = await getClient();
  const meds = await getMedications(patientId);
  const today = new Date(); today.setHours(0,0,0,0);
  const days  = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const start = days[0] + 'T00:00:00';
  const end   = days[6] + 'T23:59:59';
  const { data: intakesData } = await sb.from('intakes')
    .select('*').eq('patient_id', patientId)
    .gte('scheduled_time', start).lte('scheduled_time', end);
  const intakes = intakesData || [];

  const result = meds.map(function(med) {
    const dayStats = days.map(function(dateStr) {
      const slots  = med.schedule || [];
      const prises = slots.map(function(slot) {
        const dt = dateStr + 'T' + slot.time + ':00';
        const ex = intakes.find(function(i) {
          return i.medication_id === med.id &&
                 i.scheduled_time.slice(0, 16) === dt.slice(0, 16);
        });
        const isPast = new Date(dt) < new Date();
        if (ex && ex.taken_at) return 'taken';
        if (isPast) return 'missed';
        return 'future';
      });
      if (!prises.length)                                   return 'none';
      if (prises.every(function(s) { return s==='future'; })) return 'future';
      if (prises.every(function(s) { return s==='taken';  })) return 'taken';
      if (prises.some(function(s)  { return s==='missed'; })) return 'missed';
      if (prises.some(function(s)  { return s==='taken';  })) return 'partial';
      return 'none';
    });
    const pastDays  = dayStats.filter(function(s) { return s !== 'future' && s !== 'none'; });
    const takenDays = dayStats.filter(function(s) { return s === 'taken'; });
    const rate      = pastDays.length > 0 ? Math.round(takenDays.length / pastDays.length * 100) : null;
    return { medId: med.id, name: med.name, dose: med.dose, dayStats, rate };
  });

  const allPast  = result.reduce(function(a, m) { return a + m.dayStats.filter(function(s) { return s!=='future'&&s!=='none'; }).length; }, 0);
  const allTaken = result.reduce(function(a, m) { return a + m.dayStats.filter(function(s) { return s==='taken'; }).length; }, 0);
  return { days, meds: result, globalRate: allPast > 0 ? Math.round(allTaken / allPast * 100) : null };
}

// ── ORDONNANCES ────────────────────────────────────────────

async function getOrdonnances(patientId) {
  const sb = await getClient();
  const { data, error } = await sb.from('ordonnances')
    .select('*').eq('patient_id', patientId).order('date_expiration');
  if (error) throw error;
  return (data || []).map(_mapOrdo);
}

async function addOrdonnance(patientId, { medecin, dateExpiration, photo=null, notes='' }) {
  const sb = await getClient();
  if (!medecin || !dateExpiration) throw new Error('Champs obligatoires manquants');
  const { data, error } = await sb.from('ordonnances').insert({
    patient_id:      patientId,
    medecin:         medecin.trim(),
    date_expiration: dateExpiration,
    photo:           photo || null,
    notes:           notes || ''
  }).select().single();
  if (error) throw error;
  return _mapOrdo(data);
}

async function deleteOrdonnance(patientId, ordoId) {
  const sb = await getClient();
  const { error } = await sb.from('ordonnances').delete().eq('id', ordoId);
  if (error) throw error;
}

async function getExpiringOrdonnances() {
  const patients = await getPatients();
  const result   = [];
  for (const p of patients) {
    const ordos = await getOrdonnances(p.id);
    ordos.forEach(function(o) {
      const status = getOrdonnanceStatus(o.dateExpiration);
      if (status.urgency > 0) result.push(Object.assign({}, o, {
        patientId: p.id, patientName: p.prenom + ' ' + p.nom, status
      }));
    });
  }
  return result.sort(function(a, b) {
    return new Date(a.dateExpiration) - new Date(b.dateExpiration);
  });
}

// ── CONTACTS ───────────────────────────────────────────────

async function getContacts(patientId) {
  const sb = await getClient();
  const { data, error } = await sb.from('contacts')
    .select('*').eq('patient_id', patientId).order('created_at');
  if (error) throw error;
  return data || [];
}

async function addContact(patientId, { nom, relation, telephone, niveau='missed' }) {
  const sb = await getClient();
  if (!nom || !telephone) throw new Error('Nom et téléphone obligatoires');
  const { data, error } = await sb.from('contacts').insert({
    patient_id: patientId,
    nom:        nom.trim(),
    relation:   relation || '',
    telephone:  telephone.trim(),
    niveau
  }).select().single();
  if (error) throw error;
  return data;
}

async function updateContact(patientId, contactId, fields) {
  const sb = await getClient();
  const { data, error } = await sb.from('contacts')
    .update(fields).eq('id', contactId).select().single();
  if (error) throw error;
  return data;
}

async function deleteContact(patientId, contactId) {
  const sb = await getClient();
  const { error } = await sb.from('contacts').delete().eq('id', contactId);
  if (error) throw error;
}

// ── STOCKS FAIBLES ─────────────────────────────────────────

async function getLowStocks() {
  const patients = await getPatients();
  const result   = [];
  for (const p of patients) {
    const meds = await getMedications(p.id);
    meds.forEach(function(m) {
      if (m.stock === null || m.stock === undefined) return;
      const perDay   = m.stockPerDay || (m.schedule || []).length;
      const daysLeft = perDay > 0 ? Math.floor(m.stock / perDay) : 999;
      if (daysLeft <= 7) result.push({
        patientId: p.id, patientName: p.prenom + ' ' + p.nom,
        medId: m.id, medName: m.name, stock: m.stock, daysLeft
      });
    });
  }
  return result.sort(function(a, b) { return a.daysLeft - b.daysLeft; });
}

// ── REALTIME ───────────────────────────────────────────────

async function subscribeToPatient(patientId, callback) {
  const sb = await ensureSession(); // garantit une session valide
  return sb.channel('patient-' + patientId)
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'intakes',
      filter: 'patient_id=eq.' + patientId
    }, callback)
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'medications',
      filter: 'patient_id=eq.' + patientId
    }, callback)
    .subscribe();
}

async function unsubscribe(channel) {
  const sb = await getClient();
  sb.removeChannel(channel);
}

// ── UTILITAIRES ────────────────────────────────────────────

const MOMENTS = { fasting:'🌅', before:'⏱️', during:'🍽️', after:'✅', bedtime:'🌙' };

function _dayProgress(duration) {
  if (!duration) return null;
  const start = new Date(duration.startDate);
  const today = new Date();
  start.setHours(0,0,0,0); today.setHours(0,0,0,0);
  const diff = Math.floor((today - start) / 86400000) + 1;
  return { current: Math.min(diff, duration.days), total: duration.days, done: diff > duration.days };
}

function getOrdonnanceStatus(dateExpiration) {
  const exp = new Date(dateExpiration), now = new Date();
  exp.setHours(0,0,0,0); now.setHours(0,0,0,0);
  const diff = Math.ceil((exp - now) / 86400000);
  if (diff < 0)   return { label:'Expirée',               color:'#A32D2D', bg:'#FCEBEB', urgency:3 };
  if (diff === 0) return { label:'Expire aujourd\'hui',    color:'#A32D2D', bg:'#FCEBEB', urgency:3 };
  if (diff <= 7)  return { label:'Expire dans '+diff+'j', color:'#A32D2D', bg:'#FCEBEB', urgency:3 };
  if (diff <= 15) return { label:'Expire dans '+diff+'j', color:'#854F0B', bg:'#FAEEDA', urgency:2 };
  if (diff <= 30) return { label:'Expire dans '+diff+'j', color:'#854F0B', bg:'#FAEEDA', urgency:1 };
  return { label:'Valide — '+diff+'j restants', color:'#27500A', bg:'#EAF3DE', urgency:0 };
}

// Mapping DB → app
function _mapPatient(r) {
  return {
    id:            r.id,
    nom:           r.nom,
    prenom:        r.prenom,
    dateNaissance: r.date_naissance || null,
    photo:         r.photo || null,
    notes:         r.notes || '',
    aidantId:      r.aidant_id,
    createdAt:     r.created_at
  };
}

function _mapMed(r) {
  return {
    id:          r.id,
    patientId:   r.patient_id,
    name:        r.name,
    dose:        r.dose,
    schedule:    r.schedule || [],
    photo:       r.photo || null,
    duration:    r.duration || null,
    stock:       r.stock !== undefined ? r.stock : null,
    stockPerDay: r.stock_per_day || null,
    active:      r.active,
    createdAt:   r.created_at
  };
}

function _mapOrdo(r) {
  return {
    id:             r.id,
    patientId:      r.patient_id,
    medecin:        r.medecin,
    dateExpiration: r.date_expiration,
    photo:          r.photo || null,
    notes:          r.notes || '',
    createdAt:      r.created_at
  };
}

window.SupabaseService = {
  // Auth
  signUp, signIn, signOut, getSession, getCurrentUser, getAidantProfile,
  ensureSession,
  // Patients
  getPatients, getPatient, addPatient, updatePatient, deletePatient,
  // Medications
  getMedications, getMedication, addMedication, updateMedication, deleteMedication,
  // Prises
  getTodayMeds, confirmTaken, getPatientSummary,
  // Historique
  getMedHistory7Days,
  // Ordonnances
  getOrdonnances, addOrdonnance, deleteOrdonnance, getExpiringOrdonnances,
  getOrdonnanceStatus,
  // Contacts
  getContacts, addContact, updateContact, deleteContact,
  // Stocks
  getLowStocks,
  // Realtime
  subscribeToPatient, unsubscribe,
  // Utils
  MOMENTS, _dayProgress, getClient
};
