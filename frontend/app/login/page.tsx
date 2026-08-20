// app/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/auth';

interface LoginResponse {
  success?: boolean;
  data?: { accessToken: string };
  message?: string | string[];
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: LoginResponse = await response.json();

      if (!response.ok || !data.success || !data.data) {
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(message || 'Invalid email or password');
        return;
      }

      setToken(data.data.accessToken);
      router.push('/video');
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to reach the server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center" style={{ color: '#35b3c9' }}>
          Log in
        </h1>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#35b3c9]"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#35b3c9]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#35b3c9' }}
        >
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
