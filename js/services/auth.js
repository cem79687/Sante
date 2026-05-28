// auth.js — gestion du code PIN

const AUTH_KEY    = 'medisafe_pin';
const SESSION_KEY = 'medisafe_session';
const DEFAULT_PIN = '12345678';

function getPin()         { return localStorage.getItem(AUTH_KEY) || DEFAULT_PIN; }
function setPin(pin)      { localStorage.setItem(AUTH_KEY, pin); }
function isAuthenticated(){ return localStorage.getItem(SESSION_KEY) === 'true'; }
function login()          { localStorage.setItem(SESSION_KEY, 'true'); }
function logout()         { localStorage.removeItem(SESSION_KEY); }
function checkPin(input)  { return input === getPin(); }

window.AuthService = { getPin, setPin, isAuthenticated, login, logout, checkPin };
