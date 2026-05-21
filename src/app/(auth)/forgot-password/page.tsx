'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Zap, Mail, AlertCircle, Check, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="auth-layout">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
            }}
          >
            <Check size={28} color="var(--success-400)" />
          </div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle" style={{ marginBottom: 'var(--space-6)' }}>
            We&apos;ve sent password reset instructions to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
          </p>
          <Link href="/login" className="btn btn-primary">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="sidebar-logo-icon">
            <Zap size={18} color="white" />
          </div>
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
            Content<span className="text-gradient">Flow</span>
          </span>
        </div>

        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">Enter your email and we&apos;ll send you reset instructions</p>

        {error && (
          <div className="auth-error animate-fade-in">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleReset}>
          <div className="input-group">
            <label className="input-label" htmlFor="email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                Sending...
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={14} />
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
