'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import {
  updateProfile,
  changePassword,
  requestEmailChange,
  confirmEmailChange,
  getAddresses,
  saveAddress,
  deleteAddress,
  type Address,
} from '../../../lib/account-api';

/**
 * Account settings: profile, credentials and address book.
 *
 * Credential changes deliberately ask for the current password even though the
 * customer is already signed in -- a borrowed session should not be enough to
 * take the account over.
 */

const cardClass = 'bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-4';
const inputClass =
  'w-full px-4 py-3 rounded-2xl border-2 border-[#ffd2e9] focus:border-kawaii-pink outline-none font-medium text-slate-700 text-sm';
const primaryButton =
  'bg-kawaii-pink text-white py-3 px-6 rounded-full font-black text-sm tracking-widest disabled:opacity-60 hover:scale-[1.01] transition-transform';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p className={`text-xs font-bold ${notice.kind === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
      {notice.text}
    </p>
  );
}

const EMPTY_ADDRESS: Partial<Address> = {
  label: '',
  recipient_name: '',
  phone: '',
  delivery_method: 'delivery-home',
  address_line: '',
  city: '',
  state: '',
  courier_name: '',
  courier_state: '',
  courier_office: '',
  instructions: '',
};

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, token, loading, setSession, refresh } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.push('/account/login');
  }, [loading, user, router]);

  // ── Profile ──
  const [profile, setProfile] = useState({ name: '', phone: '', cedula: '' });
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name ?? '', phone: user.phone ?? '', cedula: user.cedula ?? '' });
    }
  }, [user]);

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      await updateProfile(profile, token);
      await refresh();
      setProfileNotice({ kind: 'ok', text: 'Datos actualizados.' });
    } catch (err: any) {
      setProfileNotice({ kind: 'error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Password ──
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwNotice, setPwNotice] = useState<Notice>(null);
  const [savingPw, setSavingPw] = useState(false);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (pw.newPassword !== pw.confirm) {
      setPwNotice({ kind: 'error', text: 'Las contrasenas nuevas no coinciden.' });
      return;
    }
    setSavingPw(true);
    setPwNotice(null);
    try {
      await changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }, token);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setPwNotice({ kind: 'ok', text: 'Contrasena actualizada.' });
    } catch (err: any) {
      setPwNotice({ kind: 'error', text: err.message });
    } finally {
      setSavingPw(false);
    }
  };

  // ── Email (two-step) ──
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '', code: '' });
  const [emailStage, setEmailStage] = useState<'request' | 'confirm'>('request');
  const [emailNotice, setEmailNotice] = useState<Notice>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  const submitEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingEmail(true);
    setEmailNotice(null);
    try {
      await requestEmailChange(
        { newEmail: emailForm.newEmail, currentPassword: emailForm.currentPassword },
        token,
      );
      setEmailStage('confirm');
      setEmailNotice({ kind: 'ok', text: `Enviamos un codigo a ${emailForm.newEmail}.` });
    } catch (err: any) {
      setEmailNotice({ kind: 'error', text: err.message });
    } finally {
      setSavingEmail(false);
    }
  };

  const submitEmailConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingEmail(true);
    setEmailNotice(null);
    try {
      const result = await confirmEmailChange(
        { newEmail: emailForm.newEmail, code: emailForm.code },
        token,
      );
      // The old token still claims the previous email, so swap it in.
      setSession({ token: result.token, user: result.user as any });
      setEmailForm({ newEmail: '', currentPassword: '', code: '' });
      setEmailStage('request');
      setEmailNotice({ kind: 'ok', text: 'Correo actualizado.' });
    } catch (err: any) {
      setEmailNotice({ kind: 'error', text: err.message });
    } finally {
      setSavingEmail(false);
    }
  };

  // ── Addresses ──
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<(Partial<Address> & { id?: string }) | null>(null);
  const [addrNotice, setAddrNotice] = useState<Notice>(null);

  const loadAddresses = useCallback(() => {
    if (token) getAddresses(token).then(setAddresses).catch(() => setAddresses([]));
  }, [token]);

  useEffect(loadAddresses, [loadAddresses]);

  const submitAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing) return;
    setAddrNotice(null);
    try {
      await saveAddress(editing, token);
      setEditing(null);
      loadAddresses();
      setAddrNotice({ kind: 'ok', text: 'Direccion guardada.' });
    } catch (err: any) {
      setAddrNotice({ kind: 'error', text: err.message });
    }
  };

  const removeAddress = async (id: string) => {
    if (!token) return;
    try {
      await deleteAddress(id, token);
      loadAddresses();
    } catch (err: any) {
      setAddrNotice({ kind: 'error', text: err.message });
    }
  };

  if (loading || !user) {
    return <div className="py-24 text-center font-bold text-kawaii-pink">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-slate-800">Configuracion</h1>
        <Link
          href="/account"
          className="text-sm font-bold text-slate-500 hover:text-kawaii-pink border border-slate-200 hover:border-kawaii-pink rounded-full px-4 py-2 transition-colors"
        >
          Volver a mi cuenta
        </Link>
      </div>

      {/* Profile */}
      <form onSubmit={submitProfile} className={cardClass}>
        <h2 className="font-black text-slate-700">Datos personales</h2>
        <NoticeLine notice={profileNotice} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className={inputClass}
            placeholder="Nombre"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Telefono"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Cedula (solo numeros)"
            inputMode="numeric"
            value={profile.cedula}
            onChange={(e) => setProfile({ ...profile, cedula: e.target.value.replace(/\D/g, '') })}
          />
        </div>
        <button type="submit" disabled={savingProfile} className={primaryButton}>
          {savingProfile ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {/* Password */}
      <form onSubmit={submitPassword} className={cardClass}>
        <h2 className="font-black text-slate-700">Contrasena</h2>
        <NoticeLine notice={pwNotice} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="password"
            className={inputClass}
            placeholder="Contrasena actual"
            value={pw.currentPassword}
            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
          />
          <div />
          <input
            type="password"
            required
            className={inputClass}
            placeholder="Nueva contrasena (8+)"
            value={pw.newPassword}
            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
          />
          <input
            type="password"
            required
            className={inputClass}
            placeholder="Repetir nueva contrasena"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
        </div>
        <button type="submit" disabled={savingPw} className={primaryButton}>
          {savingPw ? 'Guardando...' : 'Cambiar contrasena'}
        </button>
      </form>

      {/* Email */}
      <div className={cardClass}>
        <h2 className="font-black text-slate-700">Correo electronico</h2>
        <p className="text-xs font-semibold text-slate-400">
          Actual: <span className="text-slate-600">{user.email}</span>
        </p>
        <NoticeLine notice={emailNotice} />

        {emailStage === 'request' ? (
          <form onSubmit={submitEmailRequest} className="space-y-3">
            <p className="text-xs font-semibold text-slate-400">
              Te enviaremos un codigo al correo nuevo para confirmar que es tuyo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                required
                className={inputClass}
                placeholder="Nuevo correo"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
              />
              <input
                type="password"
                className={inputClass}
                placeholder="Contrasena actual"
                value={emailForm.currentPassword}
                onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
              />
            </div>
            <button type="submit" disabled={savingEmail} className={primaryButton}>
              {savingEmail ? 'Enviando...' : 'Enviar codigo'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitEmailConfirm} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              className={inputClass}
              placeholder="Codigo de 6 digitos"
              value={emailForm.code}
              onChange={(e) => setEmailForm({ ...emailForm, code: e.target.value.replace(/\D/g, '') })}
            />
            <div className="flex gap-3">
              <button type="submit" disabled={savingEmail} className={primaryButton}>
                {savingEmail ? 'Confirmando...' : 'Confirmar correo'}
              </button>
              <button
                type="button"
                onClick={() => { setEmailStage('request'); setEmailNotice(null); }}
                className="py-3 px-6 rounded-full border-2 border-slate-200 text-slate-500 font-bold text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Address book */}
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-black text-slate-700">Mis direcciones</h2>
          {!editing && (
            <button onClick={() => setEditing({ ...EMPTY_ADDRESS })} className="text-sm font-black text-kawaii-pink">
              + Agregar
            </button>
          )}
        </div>
        <NoticeLine notice={addrNotice} />

        {addresses.length === 0 && !editing && (
          <p className="text-sm text-slate-400 font-bold">Aun no tienes direcciones guardadas.</p>
        )}

        {addresses.map((a) => (
          <div key={a.id} className="border border-[#ffe0ef] rounded-2xl p-4 flex justify-between gap-3">
            <div className="min-w-0">
              <p className="font-black text-slate-800 text-sm">
                {a.label || 'Direccion'}{' '}
                {a.is_default === 1 && (
                  <span className="text-[10px] uppercase tracking-widest text-kawaii-pink">predeterminada</span>
                )}
              </p>
              <p className="text-xs text-slate-500 font-semibold">
                {a.delivery_method === 'delivery-national'
                  ? [a.courier_name, a.courier_state, a.courier_office].filter(Boolean).join(', ')
                  : [a.address_line, a.city, a.state].filter(Boolean).join(', ') || '-'}
              </p>
              {a.recipient_name && (
                <p className="text-xs text-slate-400 font-semibold">{a.recipient_name} {a.phone ? `- ${a.phone}` : ''}</p>
              )}
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0 text-xs font-bold">
              <button onClick={() => setEditing(a)} className="text-slate-500 hover:text-kawaii-pink">Editar</button>
              <button onClick={() => removeAddress(a.id)} className="text-slate-400 hover:text-red-500">Eliminar</button>
            </div>
          </div>
        ))}

        {editing && (
          <form onSubmit={submitAddress} className="border-2 border-[#ffd2e9] rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="Etiqueta (Casa, Oficina)"
                value={editing.label ?? ''}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
              <select
                className={inputClass}
                value={editing.delivery_method ?? 'delivery-home'}
                onChange={(e) => setEditing({ ...editing, delivery_method: e.target.value as Address['delivery_method'] })}
              >
                <option value="delivery-home">Entrega a domicilio</option>
                <option value="delivery-national">Envio nacional</option>
                <option value="pickup-store">Retiro en tienda</option>
              </select>
              <input
                className={inputClass}
                placeholder="Nombre de quien recibe"
                value={editing.recipient_name ?? ''}
                onChange={(e) => setEditing({ ...editing, recipient_name: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Telefono"
                value={editing.phone ?? ''}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              />
            </div>

            {editing.delivery_method === 'delivery-national' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  className={inputClass}
                  placeholder="Courier (MRW, Zoom...)"
                  value={editing.courier_name ?? ''}
                  onChange={(e) => setEditing({ ...editing, courier_name: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Estado"
                  value={editing.courier_state ?? ''}
                  onChange={(e) => setEditing({ ...editing, courier_state: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Oficina"
                  value={editing.courier_office ?? ''}
                  onChange={(e) => setEditing({ ...editing, courier_office: e.target.value })}
                />
              </div>
            ) : editing.delivery_method === 'delivery-home' ? (
              <div className="space-y-3">
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={2}
                  placeholder="Direccion completa"
                  value={editing.address_line ?? ''}
                  onChange={(e) => setEditing({ ...editing, address_line: e.target.value })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className={inputClass}
                    placeholder="Ciudad"
                    value={editing.city ?? ''}
                    onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Estado"
                    value={editing.state ?? ''}
                    onChange={(e) => setEditing({ ...editing, state: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <input
                type="checkbox"
                checked={editing.is_default === 1}
                onChange={(e) => setEditing({ ...editing, is_default: e.target.checked ? 1 : 0 })}
              />
              Usar como predeterminada
            </label>

            <div className="flex gap-3">
              <button type="submit" className={primaryButton}>Guardar direccion</button>
              <button
                type="button"
                onClick={() => { setEditing(null); setAddrNotice(null); }}
                className="py-3 px-6 rounded-full border-2 border-slate-200 text-slate-500 font-bold text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
