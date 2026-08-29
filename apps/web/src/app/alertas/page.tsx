import { PageHeader } from '@/components/PageHeader';
import { AlertsManager } from '@/components/AlertsManager';

export const metadata = {
  title: 'Alertas — Informes CR',
};

export default function AlertasPage() {
  return (
    <div>
      <PageHeader
        title="Alertas"
        description="Crea reglas para recibir notificaciones cuando aparezcan avisos que coincidan con tus criterios."
      />
      {/*
        NOTA (auth/Cognito): esta sección es tenant-scoped. Mientras no exista
        autenticación real, el cliente API (src/lib/api.ts) envía un tenant y
        token de demostración mediante la cabecera `x-demo-tenant` y un Bearer
        placeholder. Al integrar Amazon Cognito se debe reemplazar por el JWT
        del usuario autenticado y eliminar dichos placeholders.
      */}
      <AlertsManager />
    </div>
  );
}
