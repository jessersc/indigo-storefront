'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSupportConfig,
  sendChat,
  escalateChat,
  sendContact,
  pollThread,
  type SupportConfig,
} from '../lib/support-api';
import Turnstile, { turnstileEnabled } from './Turnstile';

type View = 'menu' | 'chat' | 'email';
interface Msg { from: 'customer' | 'bot' | 'admin'; text: string }

const THREAD_KEY = 'indigo_support_thread';

export default function SupportWidget() {
  const { user, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('menu');
  const [config, setConfig] = useState<SupportConfig | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'bot' | 'human'>('bot');
  const scrollRef = useRef<HTMLDivElement>(null);
  // Timestamp of the newest message we have, so polling only asks for newer ones.
  const lastAt = useRef<string | undefined>(undefined);

  // Email form state
  const [contact, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  useEffect(() => {
    if (open && !config) getSupportConfig().then(setConfig).catch(() => setConfig({ whatsappNumber: '', supportEmail: '' }));
  }, [open, config]);

  useEffect(() => {
    setThreadId(localStorage.getItem(THREAD_KEY) || undefined);
  }, []);

  useEffect(() => {
    if (user) setContactForm((c) => ({ ...c, name: c.name || user.name || '', email: c.email || user.email }));
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Poll while the chat panel is open so an agent's reply shows up without a
  // refresh. Stops as soon as the panel closes.
  useEffect(() => {
    if (!open || view !== 'chat' || !threadId) return;

    let cancelled = false;
    const tick = async () => {
      const data = await pollThread(threadId, lastAt.current);
      if (cancelled || !data) return;
      setMode(data.mode);
      if (data.messages.length > 0) {
        lastAt.current = data.messages[data.messages.length - 1].created_at;
        setMessages((prev) => [
          ...prev,
          // The customer's own messages are already on screen optimistically.
          ...data.messages
            .filter((m) => m.sender !== 'customer')
            .map((m) => ({ from: m.sender as 'bot' | 'admin', text: m.body })),
        ]);
      }
    };

    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [open, view, threadId]);

  /**
   * Open the chat, restoring the conversation where it left off.
   *
   * Previously this always started from the greeting, so someone returning
   * after a refresh saw an empty panel and had to explain themselves again —
   * even though the thread and every message were still on the server. The
   * Worker returns the last 10 messages; a guest's thread is swept after a day,
   * a signed-in customer's is kept.
   */
  const openChat = async () => {
    setView('chat');
    if (messages.length > 0) return;

    if (threadId) {
      const history = await pollThread(threadId);
      if (history?.messages.length) {
        lastAt.current = history.messages[history.messages.length - 1].created_at;
        setMode(history.mode);
        setMessages(
          history.messages.map((m) => ({
            from: m.sender as 'customer' | 'bot' | 'admin',
            text: m.body,
          })),
        );
        return;
      }
    }

    setMessages([{ from: 'bot', text: 'Hola! Soy el asistente de Indigo. Preguntame sobre pedidos, envios, pagos, reembolsos o reemplazos.' }]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { from: 'customer', text }]);
    setSending(true);
    try {
      const res = await sendChat({ threadId, message: text, email: user?.email }, token);
      setThreadId(res.threadId);
      localStorage.setItem(THREAD_KEY, res.threadId);
      // A human has the thread: no bot reply comes back, the agent answers via polling.
      if (res.reply) {
        setMessages((m) => [...m, { from: 'bot', text: res.reply as string }]);
      }
      if (res.mode) setMode(res.mode);
      // Asking for a person hands the thread over; the agent answers by polling.
      if (res.escalated) setMode('human');
      // Skip whatever we just wrote when polling next.
      const seen = await pollThread(res.threadId);
      if (seen?.messages.length) lastAt.current = seen.messages[seen.messages.length - 1].created_at;
    } catch (err: any) {
      /*
        The per-conversation throttle no longer surfaces here at all — the
        Worker absorbs it and just answers a moment later, so a customer asking
        a quick follow-up sees the typing indicator rather than
        "Espera 21 segundos antes de enviar otro mensaje."

        What can still land here is a genuine failure: offline, or the per-IP
        limiter after real hammering. Neither is something to put a countdown
        on, so the message stays plain and points at a way through.
      */
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: 'No pudimos enviar tu mensaje. Revisa tu conexion e intenta de nuevo, o escribenos por WhatsApp.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleEscalate = async () => {
    if (!threadId) return;
    await escalateChat(threadId, user?.email, token).catch(() => {});
    setMessages((m) => [...m, { from: 'bot', text: 'Listo, un miembro de nuestro equipo continuara esta conversacion pronto.' }]);
  };

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');
    if (turnstileEnabled() && !turnstileToken) {
      setContactError('Completa la verificacion de seguridad.');
      return;
    }
    try {
      await sendContact({ ...contact, turnstileToken });
      setContactSent(true);
    } catch (err: any) {
      setContactError(err.message || 'No se pudo enviar.');
    }
  };

  const whatsappHref = config?.whatsappNumber
    ? `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent('Hola! Tengo una consulta.')}`
    : '#';

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Soporte"
        className="fixed bottom-6 right-6 z-[1100] w-14 h-14 rounded-full bg-kawaii-pink text-white flex items-center justify-center shadow-[0_8px_24px_rgba(255,107,157,0.45)] hover:scale-105 transition-transform cursor-pointer"
      >
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[1100] w-[92vw] max-w-sm bg-white rounded-3xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] border border-[#ffe0ef] overflow-hidden flex flex-col" style={{ height: '30rem' }}>
          {/* Header */}
          <div className="bg-kawaii-pink text-white px-4 py-3 flex items-center gap-2">
            {view !== 'menu' && (
              <button onClick={() => setView('menu')} className="hover:opacity-80"><ArrowLeft size={18} /></button>
            )}
            <span className="font-black tracking-wide">Soporte Indigo</span>
            {view === 'chat' && mode === 'human' && (
              <span className="ml-auto text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">
                AGENTE EN LINEA
              </span>
            )}
          </div>

          {/* Menu */}
          {view === 'menu' && (
            <div className="p-4 space-y-3 flex-1">
              <p className="text-sm text-slate-500 font-semibold">Como podemos ayudarte?</p>
              <button onClick={openChat} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-[#ffe0ef] hover:bg-[#fff6fa] text-left transition-colors">
                <MessageCircle size={20} className="text-kawaii-pink" />
                <div><p className="font-black text-slate-800 text-sm">Chat en vivo</p><p className="text-xs text-slate-400">Pedidos, envios, pagos, reembolsos</p></div>
              </button>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 p-3 rounded-2xl border border-[#ffe0ef] hover:bg-[#f0fdf4] text-left transition-colors">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" /></svg>
                <div><p className="font-black text-slate-800 text-sm">WhatsApp</p><p className="text-xs text-slate-400">Escribenos directamente</p></div>
              </a>
              <button onClick={() => { setView('email'); setContactSent(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-[#ffe0ef] hover:bg-[#fff6fa] text-left transition-colors">
                <Send size={18} className="text-kawaii-pink" />
                <div><p className="font-black text-slate-800 text-sm">Escribenos por correo</p><p className="text-xs text-slate-400">Te respondemos por email</p></div>
              </button>
            </div>
          )}

          {/* Chat */}
          {view === 'chat' && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafa]">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm font-medium whitespace-pre-wrap ${
                      m.from === 'customer'
                        ? 'bg-kawaii-pink text-white rounded-br-sm'
                        : m.from === 'admin'
                        ? 'bg-[#f0fdf4] border border-green-200 text-slate-700 rounded-bl-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                    }`}>
                      {m.from === 'admin' && (
                        <span className="block text-[10px] font-black text-green-700 mb-0.5">AGENTE</span>
                      )}
                      {m.text}
                    </div>
                  </div>
                ))}
                {sending && <div className="text-xs text-slate-400 font-bold">escribiendo...</div>}
              </div>
              <div className="border-t border-slate-100 p-2">
                {threadId && (
                  <button onClick={handleEscalate} className="text-[11px] text-kawaii-pink font-bold mb-1 px-1 hover:underline">Hablar con una persona</button>
                )}
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Escribe tu mensaje..."
                    className="flex-1 px-3 py-2 rounded-full border border-slate-200 outline-none focus:border-kawaii-pink text-sm"
                  />
                  <button onClick={handleSend} disabled={sending || !input.trim()} className="w-10 h-10 rounded-full bg-kawaii-pink text-white flex items-center justify-center disabled:opacity-50 flex-shrink-0">
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Email us */}
          {view === 'email' && (
            <div className="flex-1 overflow-y-auto p-4">
              {contactSent ? (
                <div className="text-center py-10 space-y-2">
                  <p className="font-black text-slate-800">Mensaje enviado!</p>
                  <p className="text-sm text-slate-500">Te responderemos por correo pronto.</p>
                </div>
              ) : (
                <form onSubmit={handleContact} className="space-y-3">
                  {contactError && <p className="text-red-500 text-xs font-bold">{contactError}</p>}
                  <input required placeholder="Nombre" className="w-full px-3 py-2 rounded-2xl border border-slate-200 outline-none focus:border-kawaii-pink text-sm" value={contact.name} onChange={(e) => setContactForm({ ...contact, name: e.target.value })} />
                  <input required type="email" placeholder="Correo" className="w-full px-3 py-2 rounded-2xl border border-slate-200 outline-none focus:border-kawaii-pink text-sm" value={contact.email} onChange={(e) => setContactForm({ ...contact, email: e.target.value })} />
                  <textarea required placeholder="Tu mensaje" rows={4} className="w-full px-3 py-2 rounded-2xl border border-slate-200 outline-none focus:border-kawaii-pink text-sm resize-none" value={contact.message} onChange={(e) => setContactForm({ ...contact, message: e.target.value })} />
                  <Turnstile onToken={setTurnstileToken} />
                  <button type="submit" className="w-full bg-kawaii-pink text-white py-2.5 rounded-full font-black text-sm tracking-widest hover:scale-[1.01] transition-transform">ENVIAR</button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
