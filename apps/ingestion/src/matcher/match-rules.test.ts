import { describe, it, expect } from 'vitest';
import { NoticeCategory, Currency, toMinorUnits } from '@informes/shared';
import { evaluate } from './match-rules.js';

describe('matchProperty', () => {
  const row = {
    provincia: 'San José',
    canton: 'Escazú',
    distrito: 'San Rafael',
    basePrice: BigInt(toMinorUnits(45_000_000)),
    currency: Currency.CRC,
    areaM2: 320,
  };

  it('coincide por ubicación y precio máximo', () => {
    const ok = evaluate(NoticeCategory.PROPERTY_AUCTION, {
      location: { provincia: 'San José' },
      price: { max: 50_000_000, currency: Currency.CRC },
    }, row);
    expect(ok).toBe(true);
  });

  it('no coincide si el precio supera el máximo', () => {
    const ok = evaluate(NoticeCategory.PROPERTY_AUCTION, {
      price: { max: 40_000_000, currency: Currency.CRC },
    }, row);
    expect(ok).toBe(false);
  });

  it('no coincide con otra provincia', () => {
    const ok = evaluate(NoticeCategory.PROPERTY_AUCTION, {
      location: { provincia: 'Cartago' },
    }, row);
    expect(ok).toBe(false);
  });
});

describe('matchDeceased', () => {
  const row = { fullNameNorm: 'juan perez mora', cedulaNorm: '112345678' };

  it('coincide por cédula normalizada', () => {
    expect(evaluate(NoticeCategory.DECEASED, { cedula: '1-1234-5678' }, row)).toBe(true);
  });

  it('coincide por nombre parcial', () => {
    expect(evaluate(NoticeCategory.DECEASED, { name: 'Pérez' }, row)).toBe(true);
  });

  it('no coincide con otra cédula', () => {
    expect(evaluate(NoticeCategory.DECEASED, { cedula: '9-9999-9999' }, row)).toBe(false);
  });
});

describe('matchVehicle', () => {
  const row = { brand: 'Toyota', year: 2019, basePrice: BigInt(toMinorUnits(8_000_000)), currency: Currency.CRC };

  it('coincide por marca y año mínimo', () => {
    expect(evaluate(NoticeCategory.VEHICLE_AUCTION, { brand: 'toyota', yearMin: 2015 }, row)).toBe(true);
  });

  it('no coincide si el año es menor al mínimo', () => {
    expect(evaluate(NoticeCategory.VEHICLE_AUCTION, { yearMin: 2020 }, row)).toBe(false);
  });
});
