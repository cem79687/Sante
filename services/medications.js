// medications.js — logique métier médicaments
// Migration Firebase : remplacer _loadMeds/_saveMeds/_loadIntakes/_saveIntakes

const STORAGE_KEY_MEDS    = 'medisafe_medications';
const STORAGE_KEY_INTAKES = 'medisafe_intakes';

function _loadMeds()        { try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MEDS))    || {}; } catch { return {}; } }
function _saveMeds(data)    { localStorage.setItem(STORAGE_KEY_MEDS,    JSON.stringify(data)); }
function _loadIntakes()     { try { return JSON.parse(localStorage.getItem(STORAGE_KEY_INTAKES)) || {}; } catch { return {}; } }
function _saveIntakes(data) { localStorage.setItem(STORAGE_KEY_INTAKES, JSON.stringify(data)); }

function _generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function _todayStr()   { return new Date().toISOString().slice(0, 10); }
function _timeToMinutes(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }

function _getStatus(scheduledDatetime, takenAt) {
  if (takenAt) return 'taken';
  if (new Date() - new Date(scheduledDatetime) > 60*60*1000) return 'missed';
  return 'pending';
}

// 1. getTodayMeds()
function getTodayMeds() {
  const meds    = _loadMeds();
  const intakes = _loadIntakes();
  const today   = _todayStr();
  const result  = [];

  Object.values(meds).forEach(med => {
    if (!med.active) return;

    // Support ancien format (times[]) ET nouveau format (schedule[])
    const slots = med.schedule
      ? med.schedule
      : med.times.map(t => ({ time: t, moment: med.moment || null }));

    slots.forEach(slot => {
      const scheduledDatetime = today + 'T' + slot.time + ':00';
      const existingIntake = Object.values(intakes).find(
        i => i.medId === med.id && i.scheduledTime === scheduledDatetime
      );
      const takenAt = existingIntake ? existingIntake.takenAt : null;
      const status  = _getStatus(scheduledDatetime, takenAt);

      result.push({
        intakeId:          existingIntake ? existingIntake.id : null,
        medId:             med.id,
        name:              med.name,
        dose:              med.dose,
        time:              slot.time,
        moment:            slot.moment || null,
        scheduledDatetime,
        takenAt,
        status,
        photo:             med.photo    || null,
        duration:          med.duration || null,
      });
    });
  });

  result.sort((a, b) => _timeToMinutes(a.time) - _timeToMinutes(b.time));
  return result;
}

// 2. confirmTaken()
function confirmTaken(medId, scheduledDatetime) {
  const intakes = _loadIntakes();
  let intake = Object.values(intakes).find(
    i => i.medId === medId && i.scheduledTime === scheduledDatetime
  );
  if (intake) {
    intake.takenAt = new Date().toISOString();
    intake.status  = 'taken';
  } else {
    const id = _generateId();
    intake = { id, medId, scheduledTime: scheduledDatetime, takenAt: new Date().toISOString(), status: 'taken' };
    intakes[id] = intake;
  }
  _saveIntakes(intakes);
  return intake;
}

// 3. addMedication() — accepte schedule[] avec { time, moment } par slot
function addMedication({ name, dose, schedule, photo = null, duration = null, times = null, moment = null }) {
  // Compatibilité ancien format (times[]) ET nouveau format (schedule[])
  const finalSchedule = schedule
    ? schedule
    : (times || []).map(t => ({ time: t, moment: moment || null }));

  if (!name || !dose || !finalSchedule.length) throw new Error('Champs obligatoires manquants : name, dose, times');

  const meds = _loadMeds();
  const id   = _generateId();
  const med  = {
    id,
    name:      name.trim(),
    dose:      dose.trim(),
    schedule:  finalSchedule.sort((a,b) => _timeToMinutes(a.time) - _timeToMinutes(b.time)),
    photo,
    duration,
    active:    true,
    createdAt: new Date().toISOString(),
  };
  meds[id] = med;
  _saveMeds(meds);
  return med;
}

// 4. updateMedication()
function updateMedication(medId, { name, dose, schedule, active }) {
  const meds = _loadMeds();
  if (!meds[medId]) throw new Error('Médicament introuvable : ' + medId);
  if (name     !== undefined) meds[medId].name     = name.trim();
  if (dose     !== undefined) meds[medId].dose     = dose.trim();
  if (schedule !== undefined) meds[medId].schedule = schedule;
  if (active   !== undefined) meds[medId].active   = active;
  meds[medId].updatedAt = new Date().toISOString();
  _saveMeds(meds);
  return meds[medId];
}

// 5. deleteMedication()
function deleteMedication(medId) { return updateMedication(medId, { active: false }); }

// 6. getMedHistory()
function getMedHistory(days = 7) {
  const intakes = _loadIntakes();
  const meds    = _loadMeds();
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const history = Object.values(intakes)
    .filter(i => new Date(i.scheduledTime) >= cutoff)
    .map(i => ({ ...i, medName: meds[i.medId] ? meds[i.medId].name : 'Supprimé', medDose: meds[i.medId] ? meds[i.medId].dose : '' }))
    .sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));

  const total  = history.length;
  const taken  = history.filter(i => i.status === 'taken').length;
  const missed = history.filter(i => i.status === 'missed').length;
  const rate   = total > 0 ? Math.round((taken / total) * 100) : 0;
  return { history, stats: { total, taken, missed, rate } };
}

window.MedicationService = { getTodayMeds, confirmTaken, addMedication, updateMedication, deleteMedication, getMedHistory };
