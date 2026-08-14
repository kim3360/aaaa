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
