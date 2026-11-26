export function safeAuthRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return '/'

  const path = value.split(/[?#]/, 1)[0]
  if (path === '/login' || path?.startsWith('/login/')) return '/'
  return value
}
