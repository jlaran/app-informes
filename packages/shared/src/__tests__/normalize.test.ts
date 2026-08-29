import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeCedula, toMinorUnits, fromMinorUnits } from '../normalize.js';
import { parseCriteria } from '../criteria.js';
import { NoticeCategory } from '../enums.js';

describe('normalizeText', () => {
  it('quita acentos, baja a minúsculas y colapsa espacios', () => {
    expect(normalizeText('  Juan  PÉREZ  Móra ')).toBe('juan perez mora');
  });
});

describe('normalizeCedula', () => {
  it('deja solo dígitos', () => {
    expect(normalizeCedula('3-101-123456')).toBe('3101123456');
    expect(normalizeCedula('1 1234 5678')).toBe('112345678');
  });
});

describe('unidades monetarias', () => {
  it('convierte ida y vuelta', () => {
    expect(toMinorUnits(50_000_000)).toBe(5_000_000_000);
    expect(fromMinorUnits(5_000_000_000)).toBe(50_000_000);
  });
});

describe('parseCriteria', () => {
  it('valida criterios de propiedades', () => {
    const c = parseCriteria(NoticeCategory.PROPERTY_AUCTION, {
      location: { provincia: 'San José' },
      price: { max: 50_000_000 },
    });
    expect(c).toBeTruthy();
  });

  it('rechaza fallecidos sin cédula ni nombre', () => {
    expect(() => parseCriteria(NoticeCategory.DECEASED, {})).toThrow();
  });
});
