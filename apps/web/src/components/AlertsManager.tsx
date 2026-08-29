'use client';

import { useCallback, useEffect, useState } from 'react';
import { NoticeCategory } from '@informes/shared';
import type { Alert, AlertCriteria, CreateAlertInput } from '@/lib/types';
import {
  listAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
} from '@/lib/api';
import { AlertForm } from './AlertForm';
import { CategoryBadge } from './CategoryBadge';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { CHANNEL_LABELS } from '@/lib/labels';

/** Resume los criterios de una alerta en frases legibles en español. */
function summarizeCriteria(
  category: NoticeCategory,
  criteria: AlertCriteria,
): string[] {
  const parts: string[] = [];
  const c = criteria as Record<string, any>;

  if (category === NoticeCategory.PROPERTY_AUCTION) {
    if (c.location) {
      const loc = [c.location.provincia, c.location.canton, c.location.distrito]
        .filter(Boolean)
        .join(', ');
      if (loc) parts.push(`Ubicación: ${loc}`);
    }
    if (c.price) {
      parts.push(
        `Precio: ${c.price.min ?? '—'} a ${c.price.max ?? '—'} ${c.price.currency ?? ''}`.trim(),
      );
    }
    if (c.area) {
      parts.push(`Área: ${c.area.min ?? '—'} a ${c.area.max ?? '—'} m²`);
    }
  } else if (category === NoticeCategory.VEHICLE_AUCTION) {
    if (c.brand) parts.push(`Marca: ${c.brand}`);
    if (c.yearMin) parts.push(`Año mínimo: ${c.yearMin}`);
    if (c.price) {
      parts.push(
        `Precio: ${c.price.min ?? '—'} a ${c.price.max ?? '—'} ${c.price.currency ?? ''}`.trim(),
      );
    }
  } else if (category === NoticeCategory.DECEASED) {
    if (c.cedula) parts.push(`Cédula: ${c.cedula}`);
    if (c.name) parts.push(`Nombre: ${c.name}`);
  } else if (category === NoticeCategory.DISSOLVED_COMPANY) {
    if (c.cedulaJuridica) parts.push(`Cédula jurídica: ${c.cedulaJuridica}`);
    if (c.name) parts.push(`Nombre: ${c.name}`);
  }

  return parts;
}

export function AlertsManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await listAlerts();
      setAlerts(data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(input: CreateAlertInput) {
    const created = await createAlert(input);
    setAlerts((prev) => [created, ...prev]);
  }

  async function handleToggle(alert: Alert) {
    setBusyId(alert.id);
    try {
      const updated = await updateAlert(alert.id, { isActive: !alert.isActive });
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      /* mantener estado previo si falla */
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      /* noop */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <AlertForm onCreate={handleCreate} />

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          Mis alertas
        </h2>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            Cargando alertas…
          </div>
        ) : failed ? (
          <ErrorState message="No se pudieron cargar las alertas. Verifica la conexión con la API." />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="Aún no tienes alertas"
            message="Crea tu primera alerta con el formulario de arriba."
          />
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert) => {
              const summary = summarizeCriteria(alert.category, alert.criteria);
              return (
                <li
                  key={alert.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-800">
                          {alert.name}
                        </h3>
                        <CategoryBadge category={alert.category} />
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            alert.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-500',
                          ].join(' ')}
                        >
                          {alert.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Canal: {CHANNEL_LABELS[alert.channel]}
                      </p>
                      {summary.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {summary.map((part, i) => (
                            <li
                              key={i}
                              className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                            >
                              {part}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(alert)}
                        disabled={busyId === alert.id}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {alert.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(alert.id)}
                        disabled={busyId === alert.id}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
