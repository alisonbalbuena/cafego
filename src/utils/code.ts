export function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const ESCAPE_CODE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';

export function generateEscapeCode(length = 60): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ESCAPE_CODE_CHARS[Math.floor(Math.random() * ESCAPE_CODE_CHARS.length)];
  }
  return result;
}
