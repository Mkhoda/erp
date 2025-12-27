// Simple OTP tester: send OTP for the given purpose
// Usage: node scripts/test-otp.mjs [baseUrl] [phone] [purpose]
// Defaults: baseUrl=http://localhost:3001, phone=989120525614, purpose=login

const baseUrl = process.argv[2] || 'http://localhost:3001';
const phone = process.argv[3] || '989120525614';
const purpose = process.argv[4] || 'login';

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log(`[test-otp] Base URL: ${baseUrl}`);
  console.log(`[test-otp] Phone: ${phone}`);
  console.log(`[test-otp] Purpose: ${purpose}`);

  // Send OTP (backend validates whether the phone should exist or not based on purpose)
  const otpRes = await postJson('/auth/send-otp', { phone, purpose });
  console.log('[test-otp] send-otp:', otpRes.status, otpRes.data);
}

main().catch((err) => {
  console.error('[test-otp] ERROR', err);
  process.exitCode = 1;
});
