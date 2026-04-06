'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Star, Zap, Globe, BookOpen, CreditCard, Landmark, Upload } from 'lucide-react';
import { Plan } from '@/lib/subscription';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: Plan, method: 'stripe' | 'manual') => void;
  plans: Plan[];
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, onSelectPlan, plans }) => {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'manual' | null>(null);

  const features = [
    { name: 'Acesso ilimitado a léxicos', free: false, premium: true, icon: Zap },
    { name: 'Todas as versões da Bíblia', free: false, premium: true, icon: BookOpen },
    { name: 'Línguas originais (Hebraico/Grego)', free: false, premium: true, icon: Globe },
    { name: 'Ferramentas de estudo avançadas', free: false, premium: true, icon: Star },
    { name: 'Sem anúncios e limitações', free: false, premium: true, icon: Check },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-surface-container-high w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-primary/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col lg:flex-row h-full max-h-[90vh] overflow-y-auto">
            {/* Left Side: Features Comparison */}
            <div className="lg:w-1/2 p-8 bg-primary/5 border-r border-primary/10">
              <div className="mb-8">
                <h2 className="text-3xl font-headline font-bold text-primary mb-2">LEX BIBLE Premium</h2>
                <p className="text-on-surface/60">Eleve seu estudo bíblico a um novo patamar com ferramentas profissionais.</p>
              </div>

              <div className="space-y-6">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-primary">
                      <feature.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface">{feature.name}</p>
                      <div className="flex gap-4 mt-1">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface/40 flex items-center gap-1">
                          Grátis: <X size={12} className="text-error" />
                        </span>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-1">
                          Premium: <Check size={12} className="text-primary" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 p-6 bg-primary/10 rounded-3xl border border-primary/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center">
                    <Star size={16} fill="currentColor" />
                  </div>
                  <p className="font-bold text-primary">Teste Grátis de 4 Dias</p>
                </div>
                <p className="text-xs text-on-surface/70">Experimente todos os recursos premium por 4 dias sem compromisso. Cancele a qualquer momento.</p>
              </div>
            </div>

            {/* Right Side: Plans Selection */}
            <div className="lg:w-1/2 p-8 bg-surface">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-on-surface">Escolha seu plano</h3>
                <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {!selectedPlan ? (
                <div className="space-y-4">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className="w-full p-6 rounded-3xl border-2 border-primary/10 hover:border-primary bg-surface-container-low transition-all text-left group"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-headline font-bold text-lg text-on-surface group-hover:text-primary transition-colors">{plan.name}</span>
                        <span className="text-2xl font-bold text-primary">{plan.price} {plan.currency}</span>
                      </div>
                      <p className="text-sm text-on-surface/60">Acesso total por {plan.durationDays} dias</p>
                    </button>
                  ))}
                </div>
              ) : !paymentMethod ? (
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedPlan(null)}
                    className="text-primary font-bold text-sm flex items-center gap-2 mb-4"
                  >
                    ← Voltar para planos
                  </button>
                  
                  <h4 className="font-bold text-on-surface mb-4">Método de Pagamento</h4>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => setPaymentMethod('stripe')}
                      className="p-6 rounded-3xl border-2 border-primary/10 hover:border-primary bg-surface-container-low transition-all text-left flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                        <CreditCard size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">Cartão Visa / Mastercard</p>
                        <p className="text-xs text-on-surface/60">Pagamento internacional seguro via Stripe</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('manual')}
                      className="p-6 rounded-3xl border-2 border-primary/10 hover:border-primary bg-surface-container-low transition-all text-left flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                        <Landmark size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">Transferência Bancária / Multicaixa</p>
                        <p className="text-xs text-on-surface/60">Método local (Angola) com envio de comprovativo</p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                   <button 
                    onClick={() => setPaymentMethod(null)}
                    className="text-primary font-bold text-sm flex items-center gap-2 mb-4"
                  >
                    ← Voltar para métodos
                  </button>

                  {paymentMethod === 'stripe' ? (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
                        <CreditCard size={40} />
                      </div>
                      <h4 className="text-xl font-bold text-on-surface mb-2">Finalizar com Stripe</h4>
                      <p className="text-on-surface/60 mb-8">Você será redirecionado para o checkout seguro do Stripe.</p>
                      <button 
                        onClick={() => onSelectPlan(selectedPlan, 'stripe')}
                        className="w-full py-4 bg-primary text-on-primary rounded-full font-bold text-lg shadow-lg hover:scale-105 transition-transform"
                      >
                        Pagar {selectedPlan.price} {selectedPlan.currency}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
                        <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
                          <Landmark size={18} /> Dados para Transferência
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-on-surface/60">Banco:</span>
                            <span className="font-bold">BAI / BFA</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface/60">IBAN:</span>
                            <span className="font-bold">AO06 0000 0000 0000 0000 0</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface/60">Titular:</span>
                            <span className="font-bold">Augusto Gonçalves</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface/60">Valor:</span>
                            <span className="font-bold text-primary">{selectedPlan.price} {selectedPlan.currency}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 border-2 border-dashed border-primary/20 rounded-3xl text-center">
                        <Upload size={32} className="text-primary/40 mx-auto mb-4" />
                        <p className="font-bold text-on-surface mb-1">Upload do Comprovativo</p>
                        <p className="text-xs text-on-surface/60 mb-4">Envie uma foto ou PDF do talão Multicaixa</p>
                        <input type="file" className="hidden" id="proof-upload" />
                        <label 
                          htmlFor="proof-upload"
                          className="px-6 py-2 bg-primary/10 text-primary rounded-full font-bold text-sm cursor-pointer hover:bg-primary/20 transition-colors"
                        >
                          Selecionar Arquivo
                        </label>
                      </div>

                      <button 
                        onClick={() => onSelectPlan(selectedPlan, 'manual')}
                        className="w-full py-4 bg-primary text-on-primary rounded-full font-bold text-lg shadow-lg hover:scale-105 transition-transform"
                      >
                        Confirmar Envio
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
