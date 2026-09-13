
import React, { useState } from 'react';
import { User } from '../types';
import { useLanguage } from '../i18n';
import { supabase } from '../lib/supabase';
import { LanguageToggle } from './LanguageToggle';

interface AuthProps {
  onAuthSuccess: (user: User) => void;
  onBack: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onBack }) => {
  const { strings } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isResetMode) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setResetSent(true);
      } else if (isLogin) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .single();

        onAuthSuccess({
          id: data.user.id,
          username: profile?.username || email.split('@')[0],
          email: data.user.email,
        });
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
          },
        });

        if (authError) throw authError;

        if (data.user) {
          if (!data.session) {
            setError(strings.auth.accountCreatedVerify);
            setIsLogin(true);
            return;
          }

          await supabase.from('profiles').upsert([
            { id: data.user.id, username: username || email.split('@')[0] }
          ]);

          onAuthSuccess({
            id: data.user.id,
            username: username || email.split('@')[0],
            email: data.user.email,
          });
        }
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setError(strings.auth.connectionError);
      } else {
        setError(err.message || strings.auth.authErrorDefault);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f9fbfa]">
        <div className="max-w-md w-full">
          <button onClick={() => setIsResetMode(false)} className="mb-8 text-[#0f1a16]/40 hover:text-[#0f1a16] flex items-center font-bold text-xs uppercase tracking-widest transition-all">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            {strings.auth.backToLogin}
          </button>

          <div className="bg-white rounded-[3rem] p-10 shadow-[0_40px_80px_-15px_rgba(15,26,22,0.1)] border border-black/5">
            <h2 className="text-3xl font-black text-[#0f1a16] mb-2 tracking-tight uppercase">
              {strings.auth.resetTitle}
            </h2>
            <p className="text-[#0f1a16]/40 mb-10 font-medium text-sm">
              {resetSent ? strings.auth.resetSent : strings.auth.resetDesc}
            </p>

            {!resetSent ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-[#0f1a16]/30 mb-2 ml-1 uppercase tracking-[0.3em]">{strings.auth.email}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-6 py-4 bg-[#f9fbfa] border-0 rounded-2xl outline-none focus:ring-2 focus:ring-[#0f1a16]/5 text-[#0f1a16] font-bold placeholder:opacity-20 transition-all"
                    placeholder={strings.auth.emailPlaceholder}
                    required
                  />
                </div>
                {error && <p className="text-[#7c2d12] text-[10px] font-black uppercase tracking-widest text-center">{error}</p>}
                <button type="submit" disabled={isLoading} className="w-full py-5 btn-sleek btn-sleek-pine mt-4 disabled:opacity-50">
                  {isLoading ? strings.common.loading : strings.common.send}
                </button>
              </form>
            ) : (
              <button onClick={() => setIsResetMode(false)} className="w-full py-5 btn-sleek btn-sleek-pine mt-4">
                {strings.common.ok}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f9fbfa] relative">
      <div className="fixed top-5 right-5 sm:top-6 sm:right-6 z-50">
        <LanguageToggle />
      </div>
      <div className="max-w-md w-full">
        <button onClick={onBack} className="mb-8 text-[#0f1a16]/40 hover:text-[#0f1a16] flex items-center font-bold text-xs uppercase tracking-widest transition-all">
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          {strings.auth.backToStart}
        </button>

        <div className="bg-white rounded-[3rem] p-10 shadow-[0_40px_80px_-15px_rgba(15,26,22,0.1)] border border-black/5">
          <h2 className="text-3xl font-black text-[#0f1a16] mb-2 tracking-tight uppercase">
            {isLogin ? strings.auth.welcomeBack : strings.auth.getStarted}
          </h2>
          <p className="text-[#0f1a16]/40 mb-10 font-medium text-sm">
            {isLogin ? strings.auth.signinDesc : strings.auth.createDesc}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-[#0f1a16]/30 mb-2 ml-1 uppercase tracking-[0.3em]">{strings.auth.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 bg-[#f9fbfa] border-0 rounded-2xl outline-none focus:ring-2 focus:ring-[#0f1a16]/5 text-[#0f1a16] font-bold placeholder:opacity-20 transition-all"
                placeholder={strings.auth.emailPlaceholder}
                required
              />
            </div>
            {!isLogin && (
              <div>
                <label className="block text-[10px] font-bold text-[#0f1a16]/30 mb-2 ml-1 uppercase tracking-[0.3em]">{strings.auth.username}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-6 py-4 bg-[#f9fbfa] border-0 rounded-2xl outline-none focus:ring-2 focus:ring-[#0f1a16]/5 text-[#0f1a16] font-bold placeholder:opacity-20 transition-all"
                  placeholder={strings.auth.usernamePlaceholder}
                  required
                />
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-2 ml-1">
                <label className="block text-[10px] font-bold text-[#0f1a16]/30 uppercase tracking-[0.3em]">{strings.auth.password}</label>
                {isLogin && (
                  <button type="button" onClick={() => setIsResetMode(true)} className="text-[10px] font-bold text-[#8c6b4f] uppercase tracking-widest hover:underline transition-all">
                    {strings.auth.forgotPassword}
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 bg-[#f9fbfa] border-0 rounded-2xl outline-none focus:ring-2 focus:ring-[#0f1a16]/5 text-[#0f1a16] font-bold placeholder:opacity-20 transition-all"
                placeholder={strings.auth.passwordPlaceholder}
                required
              />
            </div>

            {error && (
              <p className="text-[#7c2d12] text-[10px] font-black uppercase tracking-widest text-center px-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 btn-sleek btn-sleek-pine mt-4 disabled:opacity-50"
            >
              {isLoading ? strings.common.loading : (isLogin ? strings.auth.signIn : strings.auth.createAccount)}
            </button>
          </form>

          <div className="mt-10 text-center">
            <button
              disabled={isLoading}
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#8c6b4f] font-bold text-sm hover:opacity-70 transition-opacity disabled:opacity-30"
            >
              {isLogin ? strings.auth.newHere : strings.auth.haveAccount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
