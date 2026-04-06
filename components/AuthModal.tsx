'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User, LogIn, UserPlus, Chrome } from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      }
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-surface-container-high w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-primary/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-headline font-bold text-primary">
              {isLogin ? 'Bem-vindo de volta' : 'Criar conta'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-4 px-6 bg-white border border-primary/10 rounded-2xl flex items-center justify-center gap-3 font-bold text-on-surface hover:bg-primary/5 transition-all mb-6"
          >
            <Chrome size={20} className="text-primary" />
            <span>Entrar com Google</span>
          </button>

          <div className="relative flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-primary/10"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface/40">ou com email</span>
            <div className="flex-1 h-px bg-primary/10"></div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full py-4 pl-12 pr-6 bg-surface-container-low border border-primary/10 rounded-2xl focus:border-primary outline-none transition-all"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
              <input
                type="email"
                placeholder="Seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full py-4 pl-12 pr-6 bg-surface-container-low border border-primary/10 rounded-2xl focus:border-primary outline-none transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
              <input
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full py-4 pl-12 pr-6 bg-surface-container-low border border-primary/10 rounded-2xl focus:border-primary outline-none transition-all"
              />
            </div>

            {error && <p className="text-xs text-error text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-on-primary rounded-2xl font-bold text-lg shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></div>
              ) : isLogin ? (
                <>
                  <LogIn size={20} /> Entrar
                </>
              ) : (
                <>
                  <UserPlus size={20} /> Criar Conta
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary font-bold hover:underline"
            >
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre aqui'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
