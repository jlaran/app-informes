export function ErrorState({
  message = 'No se pudo conectar con la API. Verifica que el servicio esté disponible e inténtalo de nuevo.',
}: {
  message?: string;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <span className="mb-2 block text-3xl" aria-hidden>
        ⚠️
      </span>
      <h3 className="text-base font-semibold text-red-700">
        Error al cargar los datos
      </h3>
      <p className="mt-1 text-sm text-red-600">{message}</p>
    </div>
  );
}
