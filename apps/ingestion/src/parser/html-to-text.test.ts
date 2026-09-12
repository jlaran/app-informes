import { describe, it, expect } from 'vitest';
import { htmlToText } from './html-to-text.js';
import { segmentNotices } from './segment.js';

describe('htmlToText', () => {
  it('separa párrafos en bloques y decodifica entidades', () => {
    const html = `<html><head><style>x{}</style></head><body>
      <p>En este Despacho se sacar&aacute; a remate la casa en Escaz&uacute;.</p>
      <p>Se hace saber el proceso sucesorio de JUAN P&Eacute;REZ.</p>
    </body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('Escazú');
    expect(text).toContain('PÉREZ');
    expect(text).not.toContain('<p>');
    expect(text).not.toContain('x{}');
    // Cada <p> debe quedar como bloque separado (doble salto de línea).
    expect(segmentNotices(text).length).toBeGreaterThanOrEqual(2);
  });

  it('convierte <br> en salto de línea y quita etiquetas', () => {
    expect(htmlToText('a<br>b<span>c</span>')).toBe('a\nbc');
  });
});
