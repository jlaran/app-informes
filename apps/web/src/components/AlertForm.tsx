'use client';

import { useState } from 'react';
import {
  NoticeCategory,
  AlertChannel,
  Currency,
  criteriaSchemaFor,
} from '@informes/shared';
import type { AlertCriteria, CreateAlertInput } from '@/lib/types';
import { CATEGORY_LABELS, CHANNEL_LABELS, CURRENCY_LABELS } from '@/lib/labels';

/** Estado plano de todos los posibles campos de criterio (uno por categoría). */
interface CriteriaState {
  // Propiedades
  provincia: string;
  canton: string;
  distrito: string;
  areaMin: string;
  areaMax: string;
  // Propiedades + vehículos (precio)
  priceMin: string;
  priceMax: string;
  currency: Currency;
  // Vehículos
  brand: string;
  yearMin: string;
  // Fallecidos / sociedades
  cedula: string;
  cedulaJuridica: string;
  name: string;
}

const EMPTY_CRITERIA: CriteriaState = {
  provincia: '',
  canton: '',
  distrito: '',
  areaMin: '',
  areaMax: '',
  priceMin: '',
  priceMax: '',
  currency: Currency.CRC,
  brand: '',
  yearMin: '',
  cedula: '',
  cedulaJuridica: '',
  name: '',
};

function intOrUndef(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function numOrUndef(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Construye el objeto `criteria` con la forma esperada por la categoría. */
function buildCriteria(
  category: NoticeCategory,
  s: CriteriaState,
): Record<string, unknown> {
  const priceMin = intOrUndef(s.priceMin);
  const priceMax = intOrUndef(s.priceMax);
  const price =
    priceMin !== undefined || priceMax !== undefined
      ? { min: priceMin, max: priceMax, currency: s.currency }
      : undefined;

  switch (category) {
    case NoticeCategory.PROPERTY_AUCTION: {
      const location: Record<string, string> = {};
      if (s.provincia.trim()) location.provincia = s.provincia.trim();
      if (s.canton.trim()) location.canton = s.canton.trim();
      if (s.distrito.trim()) location.distrito = s.distrito.trim();

      const areaMin = numOrUndef(s.areaMin);
      const areaMax = numOrUndef(s.areaMax);
      const area =
        areaMin !== undefined || areaMax !== undefined
          ? { min: areaMin, max: areaMax }
          : undefined;

      const criteria: Record<string, unknown> = {};
      if (Object.keys(location).length) criteria.location = location;
      if (price) criteria.price = price;
      if (area) criteria.area = area;
      return criteria;
    }
    case NoticeCategory.VEHICLE_AUCTION: {
      const criteria: Record<string, unknown> = {};
      if (price) criteria.price = price;
      if (s.brand.trim()) criteria.brand = s.brand.trim();
      const yearMin = intOrUndef(s.yearMin);
      if (yearMin !== undefined) criteria.yearMin = yearMin;
      return criteria;
    }
    case NoticeCategory.DECEASED: {
      const criteria: Record<string, unknown> = {};
      if (s.cedula.trim()) criteria.cedula = s.cedula.trim();
      if (s.name.trim()) criteria.name = s.name.trim();
      return criteria;
    }
    case NoticeCategory.DISSOLVED_COMPANY: {
      const criteria: Record<string, unknown> = {};
      if (s.cedulaJuridica.trim())
        criteria.cedulaJuridica = s.cedulaJuridica.trim();
      if (s.name.trim()) criteria.name = s.name.trim();
      return criteria;
    }
    default:
      return {};
  }
}

const inputClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

interface AlertFormProps {
  onCreate: (input: CreateAlertInput) => Promise<void>;
}

export function AlertForm({ onCreate }: AlertFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<NoticeCategory>(
    NoticeCategory.PROPERTY_AUCTION,
  );
  const [channel, setChannel] = useState<AlertChannel>(AlertChannel.EMAIL);
  const [criteria, setCriteria] = useState<CriteriaState>(EMPTY_CRITERIA);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof CriteriaState>(key: K, value: CriteriaState[K]) {
    setCriteria((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Asigna un nombre a la alerta.');
      return;
    }

    // Validación con el MISMO esquema Zod compartido que usa la API.
    const raw = buildCriteria(category, criteria);
    const parsed = criteriaSchemaFor(category).safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Criterios inválidos.');
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        category,
        channel,
        criteria: parsed.data as AlertCriteria,
      });
      // Reset tras crear.
      setName('');
      setCriteria(EMPTY_CRITERIA);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la alerta. Inténtalo de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2 className="text-base font-semibold text-slate-800">Nueva alerta</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Recibe una notificación cuando un aviso nuevo coincida con tus criterios.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Nombre de la alerta">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Propiedades en Escazú"
          />
        </Field>
        <Field label="Categoría">
          <select
            className={inputClass}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as NoticeCategory);
              setError(null);
            }}
          >
            {Object.values(NoticeCategory).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Canal de notificación">
          <select
            className={inputClass}
            value={channel}
            onChange={(e) => setChannel(e.target.value as AlertChannel)}
          >
            {Object.values(AlertChannel).map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="mt-4 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Criterios
        </legend>

        {category === NoticeCategory.PROPERTY_AUCTION && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Provincia">
              <input
                className={inputClass}
                value={criteria.provincia}
                onChange={(e) => set('provincia', e.target.value)}
                placeholder="San José"
              />
            </Field>
            <Field label="Cantón">
              <input
                className={inputClass}
                value={criteria.canton}
                onChange={(e) => set('canton', e.target.value)}
                placeholder="Escazú"
              />
            </Field>
            <Field label="Distrito">
              <input
                className={inputClass}
                value={criteria.distrito}
                onChange={(e) => set('distrito', e.target.value)}
                placeholder="San Rafael"
              />
            </Field>
            <Field label="Precio mínimo">
              <input
                type="number"
                className={inputClass}
                value={criteria.priceMin}
                onChange={(e) => set('priceMin', e.target.value)}
              />
            </Field>
            <Field label="Precio máximo">
              <input
                type="number"
                className={inputClass}
                value={criteria.priceMax}
                onChange={(e) => set('priceMax', e.target.value)}
              />
            </Field>
            <Field label="Moneda">
              <select
                className={inputClass}
                value={criteria.currency}
                onChange={(e) => set('currency', e.target.value as Currency)}
              >
                {Object.values(Currency).map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Área mínima (m²)">
              <input
                type="number"
                className={inputClass}
                value={criteria.areaMin}
                onChange={(e) => set('areaMin', e.target.value)}
              />
            </Field>
            <Field label="Área máxima (m²)">
              <input
                type="number"
                className={inputClass}
                value={criteria.areaMax}
                onChange={(e) => set('areaMax', e.target.value)}
              />
            </Field>
          </div>
        )}

        {category === NoticeCategory.VEHICLE_AUCTION && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Marca">
              <input
                className={inputClass}
                value={criteria.brand}
                onChange={(e) => set('brand', e.target.value)}
                placeholder="Toyota"
              />
            </Field>
            <Field label="Año mínimo">
              <input
                type="number"
                className={inputClass}
                value={criteria.yearMin}
                onChange={(e) => set('yearMin', e.target.value)}
                placeholder="2015"
              />
            </Field>
            <Field label="Moneda">
              <select
                className={inputClass}
                value={criteria.currency}
                onChange={(e) => set('currency', e.target.value as Currency)}
              >
                {Object.values(Currency).map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Precio mínimo">
              <input
                type="number"
                className={inputClass}
                value={criteria.priceMin}
                onChange={(e) => set('priceMin', e.target.value)}
              />
            </Field>
            <Field label="Precio máximo">
              <input
                type="number"
                className={inputClass}
                value={criteria.priceMax}
                onChange={(e) => set('priceMax', e.target.value)}
              />
            </Field>
          </div>
        )}

        {category === NoticeCategory.DECEASED && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cédula">
              <input
                className={inputClass}
                value={criteria.cedula}
                onChange={(e) => set('cedula', e.target.value)}
                placeholder="1-1234-5678"
              />
            </Field>
            <Field label="Nombre">
              <input
                className={inputClass}
                value={criteria.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Juan Pérez"
              />
            </Field>
          </div>
        )}

        {category === NoticeCategory.DISSOLVED_COMPANY && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cédula jurídica">
              <input
                className={inputClass}
                value={criteria.cedulaJuridica}
                onChange={(e) => set('cedulaJuridica', e.target.value)}
                placeholder="3-101-123456"
              />
            </Field>
            <Field label="Nombre">
              <input
                className={inputClass}
                value={criteria.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Inversiones ACME S.A."
              />
            </Field>
          </div>
        )}
      </fieldset>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creando…' : 'Crear alerta'}
        </button>
      </div>
    </form>
  );
}
