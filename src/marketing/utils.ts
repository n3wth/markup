export function goToLogin(mode: 'signin' | 'signup' = 'signin') {
  const target = mode === 'signup' ? '/?login=1&mode=signup' : '/?login=1'
  window.location.href = target
}
