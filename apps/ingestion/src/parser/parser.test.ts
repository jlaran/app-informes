import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { NoticeCategory, Currency, RemateNumber, fromMinorUnits } from '@informes/shared';
import { segmentNotices } from './segment.js';
import { classify } from './classifier.js';
import {
  extractProperty,
  extractVehicle,
  extractDeceased,
  extractDissolved,
  extractBasePrice,
  parseAmount,
} from './extractors.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, '__fixtures__', 'boletin-sample.txt'), 'utf8');

describe('segmentNotices', () => {
  it('separa cada edicto en un aviso (8 edictos en el fixture)', () => {
    const notices = segmentNotices(fixture);
    const classified = notices.filter((n) => classify(n.text) !== null);
    expect(classified).toHaveLength(8);
  });

  it('no fusiona la disolución sin expediente con la anterior', () => {
    const notices = segmentNotices(fixture);
    const acme = notices.find((n) => /ACME/.test(n.text));
    expect(acme?.text).not.toMatch(/TRANSPORTES DEL VALLE/);
  });
});

describe('parseAmount', () => {
  it('parsea formato es-CR y en', () => {
    expect(parseAmount('50.000.000,00')).toBe(50_000_000);
    expect(parseAmount('8,000.00')).toBe(8000);
    expect(parseAmount('6,000.00')).toBe(6000);
  });
});

describe('extractBasePrice', () => {
  it('lee cifra entre paréntesis con símbolo de colón', () => {
    const r = extractBasePrice('base de cincuenta millones de colones (¢50.000.000,00)');
    expect(r?.currency).toBe(Currency.CRC);
    expect(fromMinorUnits(Number(r?.basePrice))).toBe(50_000_000);
  });
  it('lee dólares', () => {
    const r = extractBasePrice('con una base de seis mil dólares exactos ($6,000.00)');
    expect(r?.currency).toBe(Currency.USD);
    expect(fromMinorUnits(Number(r?.basePrice))).toBe(6000);
  });
});

describe('clasificación', () => {
  it('clasifica cada edicto en su categoría', () => {
    const notices = segmentNotices(fixture);
    const cats = notices.map((n) => classify(n.text)).filter(Boolean);
    const count = (c: NoticeCategory) => cats.filter((x) => x === c).length;
    expect(count(NoticeCategory.PROPERTY_AUCTION)).toBe(2);
    expect(count(NoticeCategory.VEHICLE_AUCTION)).toBe(2);
    expect(count(NoticeCategory.DECEASED)).toBe(2);
    expect(count(NoticeCategory.DISSOLVED_COMPANY)).toBe(2);
  });
});

function noticeText(re: RegExp): string {
  const n = segmentNotices(fixture).find((x) => re.test(x.text));
  if (!n) throw new Error(`No se encontró aviso para ${re}`);
  return n.text;
}

describe('extractProperty', () => {
  it('extrae ubicación, matrícula, área y precio de la casa en Escazú', () => {
    const p = extractProperty(noticeText(/Escazú/));
    expect(p.provincia).toBe('San José');
    expect(p.canton).toBe('Escazú');
    expect(p.distrito).toBe('San Rafael');
    expect(p.matricula).toBe('234567-000');
    expect(p.areaM2).toBe(320.5);
    expect(fromMinorUnits(Number(p.basePrice))).toBe(50_000_000);
    expect(p.currency).toBe(Currency.CRC);
    expect(p.remateNumber).toBe(RemateNumber.FIRST);
    // El edicto lidera con "terreno para construir con una casa": leftmost gana.
    expect(p.propertyType).toBe('terreno');
  });

  it('detecta segundo remate en la finca de Cartago', () => {
    const p = extractProperty(noticeText(/Cartago/));
    expect(p.provincia).toBe('Cartago');
    expect(p.remateNumber).toBe(RemateNumber.SECOND);
  });
});

describe('extractVehicle', () => {
  it('extrae placa, marca, estilo, año y precio del Toyota', () => {
    const v = extractVehicle(noticeText(/Hilux/));
    expect(v.placa).toBe('CL-234567');
    expect(v.brand).toBe('Toyota');
    expect(v.model).toBe('Hilux');
    expect(v.year).toBe(2019);
    expect(fromMinorUnits(Number(v.basePrice))).toBe(8_000_000);
    expect(v.remateNumber).toBe(RemateNumber.FIRST);
  });

  it('extrae vehículo en dólares con tercer remate', () => {
    const v = extractVehicle(noticeText(/Frontier/));
    expect(v.brand).toBe('Nissan');
    expect(v.year).toBe(2016);
    expect(v.currency).toBe(Currency.USD);
    expect(v.remateNumber).toBe(RemateNumber.THIRD);
  });
});

describe('extractDeceased', () => {
  it('extrae nombre y cédula de Juan Pérez Mora', () => {
    const d = extractDeceased(noticeText(/PÉREZ MORA/));
    expect(d?.fullName).toBe('JUAN PÉREZ MORA');
    expect(d?.cedulaNorm).toBe('112345678');
  });

  it('extrae proceso testamentario', () => {
    const d = extractDeceased(noticeText(/CASTRO VARGAS/));
    expect(d?.fullName).toContain('CASTRO VARGAS');
    expect(d?.cedulaNorm).toBe('204560789');
    expect(d?.sucesorioTipo).toBe('sucesorio testamentario');
  });
});

describe('extractDissolved', () => {
  it('extrae sociedad anónima con cédula jurídica', () => {
    const c = extractDissolved(noticeText(/ACME/));
    expect(c?.companyName).toContain('INVERSIONES ACME');
    expect(c?.cedulaJuridicaNorm).toBe('3101123456');
    expect(c?.dissolutionType).toBe('disolución voluntaria');
  });

  it('extrae S.R.L. sin expediente', () => {
    const c = extractDissolved(noticeText(/TRANSPORTES DEL VALLE/));
    expect(c?.companyName).toContain('TRANSPORTES DEL VALLE');
    expect(c?.cedulaJuridicaNorm).toBe('3102987654');
  });
});
