export function getSession() {
  return {
    id: sessionStorage.getItem('juru-id') || '',
    code: (sessionStorage.getItem('juru-code') || '').toUpperCase(),
  };
}

export function saveSession(code: string, id: string) {
  sessionStorage.setItem('juru-id', id);
  sessionStorage.setItem('juru-code', code.toUpperCase());
}

export function clearSession() {
  sessionStorage.removeItem('juru-id');
  sessionStorage.removeItem('juru-code');
}

export function getSavedName() {
  return localStorage.getItem('juru-name') || '';
}

export function saveName(name: string) {
  localStorage.setItem('juru-name', name.trim());
}

export function getBalanceSession() {
  return {
    id: sessionStorage.getItem('juru-balance-id') || '',
    code: (sessionStorage.getItem('juru-balance-code') || '').toUpperCase(),
  };
}

export function saveBalanceSession(code: string, id: string) {
  sessionStorage.setItem('juru-balance-id', id);
  sessionStorage.setItem('juru-balance-code', code.toUpperCase());
}

export function clearBalanceSession() {
  sessionStorage.removeItem('juru-balance-id');
  sessionStorage.removeItem('juru-balance-code');
}
