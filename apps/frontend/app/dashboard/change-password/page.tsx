"use client";
import React, { useState } from 'react';

export default function ChangePasswordPage() {
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const API = process.env.NEXT_PUBLIC_API_URL || '/api';

  async function requestOtp() {
    setMsg("");
    const token = localStorage.getItem('token');
    if (!token) return (window.location.href = '/login');
    // We need the user's phone to send OTP; backend rate-limit and send regardless of login.
    // Ask backend for /auth/me to get phone then call /auth/send-otp
    const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    if (!me?.phone) { setMsg('شماره موبایل ثبت نشده است.'); return; }
    const res = await fetch(`${API}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: me.phone, purpose: 'change' })
    });
    if (res.ok) setMsg('کد ارسال شد.'); else setMsg('ارسال کد ناموفق بود');
  }

  async function submit() {
    const token = localStorage.getItem('token');
    if (!token) return (window.location.href = '/login');
    const res = await fetch(`${API}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ otp, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setMsg('رمز عبور تغییر کرد.'); else setMsg(data.message || 'خطا در تغییر رمز');
  }

  return (
    <div className="space-y-3 mx-auto p-6 max-w-md">
      <h1 className="mb-4 font-semibold text-2xl">تغییر رمز عبور</h1>
      <div className="space-x-2">
        <button className="bg-blue-600 px-3 py-2 rounded text-white" onClick={requestOtp}>ارسال کد</button>
      </div>
      <input className="p-2 border rounded w-full" placeholder="کد ۶ رقمی" value={otp} onChange={(e) => setOtp(e.target.value)} />
      <input className="p-2 border rounded w-full" placeholder="رمز جدید" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <button className="bg-green-600 px-4 py-2 rounded text-white" onClick={submit}>ثبت</button>
      {msg && <p className="mt-3 text-red-600 text-sm">{msg}</p>}
    </div>
  );
}
