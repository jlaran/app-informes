import { NoticeCategory } from '@informes/shared';
import { normalizeText } from '@informes/shared';

/**
 * Clasifica un aviso en una de las 4 categorías mediante palabras clave.
 * Devuelve null si no encaja en ninguna (se descarta del pipeline).
 *
 * Afinar con boletines reales (TODO(classify)). El orden importa: primero se
 * distingue remate vehículo vs. inmueble, luego sucesorio, luego disolución.
 */
export function classify(text: string): NoticeCategory | null {
  const t = normalizeText(text);

  const isRemate = /\bremat(e|ar|ase)\b|sacar? a remate|subasta/.test(t);
  if (isRemate) {
    if (isVehicle(t)) return NoticeCategory.VEHICLE_AUCTION;
    if (isProperty(t)) return NoticeCategory.PROPERTY_AUCTION;
    // Remate sin señales claras: por defecto propiedad (mayoría), marcar TODO.
    return NoticeCategory.PROPERTY_AUCTION;
  }

  if (/sucesori|mortual|proceso sucesorio|de cujus|fallecid|difunt/.test(t)) {
    return NoticeCategory.DECEASED;
  }

  if (/disoluci|disuelt|disuelve|liquidaci.n de la sociedad/.test(t)) {
    return NoticeCategory.DISSOLVED_COMPANY;
  }

  return null;
}

function isVehicle(t: string): boolean {
  return /veh.culo|autom.vil|placa|veh.culos|motocicleta|cami.n|furg.n|marca .* modelo|chasis|vin\b/.test(
    t,
  );
}

function isProperty(t: string): boolean {
  return /finca|matr.cula|folio real|inmueble|lote|casa|terreno|partido de|derecho \d|bien inmueble/.test(
    t,
  );
}
