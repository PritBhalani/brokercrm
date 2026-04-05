import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { LogIn, Mail, Lock, AlertCircle, User, Shield, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-slate-950 text-app-text bg-[radial-gradient(ellipse_100%_60%_at_50%_-15%,rgba(37,99,235,0.14),transparent)]">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/40 rotate-3 hover:rotate-0 transition-transform duration-300 ring-1 ring-blue-500/30">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-app-text-active tracking-tight drop-shadow-sm">BrokerCRM</h1>
          <p className="text-app-text-muted mt-2 font-medium">Real Estate Lead Management</p>
        </div>

        <div className="bg-app-surface rounded-3xl shadow-xl shadow-black/40 p-8 border border-app-border relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/15 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" aria-hidden />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-app-text-active">
                Welcome Back
              </h2>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm font-medium animate-shake">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-app-root border border-app-border rounded-2xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-app-surface outline-none transition-all font-medium text-app-text-active"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-app-root border border-app-border rounded-2xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-app-surface outline-none transition-all font-medium text-app-text-active"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm shadow-black/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-4"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-app-text-muted font-medium">
          Secure access powered by BrokerCRM Auth
        </p>
      </div>
    </div>
  );
};
