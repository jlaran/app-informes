/**
 * Seed de desarrollo: crea un tenant demo, un usuario y datos de ejemplo en
 * las cuatro secciones para poder probar la API y la web sin la ingesta real.
 *
 * Ejecutar: pnpm --filter @informes/db seed
 */
import { createHash } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { normalizeText, normalizeCedula, toMinorUnits } from '@informes/shared';

const prisma = new PrismaClient();

function hash(...parts: (string | undefined)[]): string {
  return createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex');
}

async function main() {
  console.log('Sembrando datos de demo…');

  // --- Plano de tenant ---
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Organización Demo', slug: 'demo', plan: 'PRO' },
  });

  await prisma.user.upsert({
    where: { cognitoSub: 'demo-cognito-sub' },
    update: {},
    create: {
      tenantId: tenant.id,
      cognitoSub: 'demo-cognito-sub',
      email: 'demo@informes.example.com',
      name: 'Usuario Demo',
      role: 'OWNER',
    },
  });

  // --- Plano público: un boletín con avisos de cada categoría ---
  const boletin = await prisma.boletin.upsert({
    where: { numero_publishedAt: { numero: '2026-165', publishedAt: new Date('2026-08-28') } },
    update: {},
    create: {
      numero: '2026-165',
      publishedAt: new Date('2026-08-28'),
      status: 'PARSED',
      pageCount: 42,
      parsedAt: new Date(),
    },
  });

  const seedNotice = async (
    category: Prisma.NoticeCreateInput['category'],
    rawText: string,
    detail: (noticeId: string) => Promise<unknown>,
    expediente?: string,
  ) => {
    const contentHash = hash(boletin.id, expediente, normalizeText(rawText));
    const notice = await prisma.notice.upsert({
      where: { contentHash },
      update: {},
      create: {
        boletinId: boletin.id,
        category,
        expediente,
        despacho: 'Juzgado Civil de San José',
        publishedAt: boletin.publishedAt,
        rawText,
        contentHash,
      },
    });
    await detail(notice.id);
  };

  await seedNotice(
    'PROPERTY_AUCTION',
    'Remate de casa en Escazú, San José. Base ₡50.000.000. Matrícula 1-234567-000.',
    (noticeId) =>
      prisma.propertyAuction.upsert({
        where: { noticeId },
        update: {},
        create: {
          noticeId,
          propertyType: 'casa',
          provincia: 'San José',
          canton: 'Escazú',
          distrito: 'San Rafael',
          locationNorm: normalizeText('San José Escazú San Rafael'),
          matricula: '1-234567-000',
          areaM2: new Prisma.Decimal(320.5),
          basePrice: BigInt(toMinorUnits(50_000_000)),
          currency: 'CRC',
          remateNumber: 'FIRST',
          remateDate: new Date('2026-09-20T09:00:00-06:00'),
        },
      }),
    'EXP-2026-001',
  );

  await seedNotice(
    'VEHICLE_AUCTION',
    'Remate de vehículo Toyota Hilux 2019, placa CL-123456. Base ₡8.000.000.',
    (noticeId) =>
      prisma.vehicleAuction.upsert({
        where: { noticeId },
        update: {},
        create: {
          noticeId,
          placa: 'CL-123456',
          brand: 'Toyota',
          brandNorm: normalizeText('Toyota'),
          model: 'Hilux',
          year: 2019,
          basePrice: BigInt(toMinorUnits(8_000_000)),
          currency: 'CRC',
          remateNumber: 'FIRST',
          remateDate: new Date('2026-09-22T10:00:00-06:00'),
        },
      }),
    'EXP-2026-002',
  );

  await seedNotice(
    'DECEASED',
    'Proceso sucesorio de Juan Pérez Mora, cédula 1-1234-5678.',
    (noticeId) =>
      prisma.deceasedPerson.upsert({
        where: { noticeId },
        update: {},
        create: {
          noticeId,
          fullName: 'Juan Pérez Mora',
          fullNameNorm: normalizeText('Juan Pérez Mora'),
          cedula: '1-1234-5678',
          cedulaNorm: normalizeCedula('1-1234-5678'),
          sucesorioTipo: 'sucesorio notarial',
        },
      }),
    'EXP-2026-003',
  );

  await seedNotice(
    'DISSOLVED_COMPANY',
    'Disolución de Inversiones ACME S.A., cédula jurídica 3-101-123456.',
    (noticeId) =>
      prisma.dissolvedCompany.upsert({
        where: { noticeId },
        update: {},
        create: {
          noticeId,
          companyName: 'Inversiones ACME S.A.',
          companyNameNorm: normalizeText('Inversiones ACME S.A.'),
          cedulaJuridica: '3-101-123456',
          cedulaJuridicaNorm: normalizeCedula('3-101-123456'),
          dissolutionType: 'disolución voluntaria',
        },
      }),
    'EXP-2026-004',
  );

  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
