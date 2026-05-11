/**
 * Claves admitidas para el checkout público colombiano.
 * En producción, la mayoría pasan por un PSP (ej. Wompi) por contratos y seguridad PCI.
 */
export const COLOMBIA_CHECKOUT_PROVIDER_KEYS = [
  'SANDBOX',
  'NEQUI',
  'DAVIPLATA',
  'PSE_BANCOLOMBIA',
  'PSE_BBVA_COL',
  'PSE_BANCO_BOGOTA',
  'PSE_DAVIVIENDA',
  'CARD_TOKEN',
] as const;

export type ColombiaCheckoutProviderKey = (typeof COLOMBIA_CHECKOUT_PROVIDER_KEYS)[number];

export type ColombiaPaymentMethodVm = {
  key: ColombiaCheckoutProviderKey;
  label: string;
  description: string;
  category: 'PRUEBA' | 'BILLETERA' | 'PSE_BANCO' | 'TARJETA';
};

export const COLOMBIA_PAYMENT_METHOD_CATALOG: ColombiaPaymentMethodVm[] = [
  {
    key: 'SANDBOX',
    label: 'Modo prueba (sandbox interno)',
    description: 'Simula aprobación o rechazo sin cobro real.',
    category: 'PRUEBA',
  },
  {
    key: 'NEQUI',
    label: 'Nequi',
    description: 'Paga con tu billetera Nequi.',
    category: 'BILLETERA',
  },
  {
    key: 'DAVIPLATA',
    label: 'Daviplata',
    description: 'Paga desde Daviplata.',
    category: 'BILLETERA',
  },
  {
    key: 'PSE_BANCOLOMBIA',
    label: 'PSE — Bancolombia',
    description: 'Débito desde cuenta corriente/ahorro vía PSE.',
    category: 'PSE_BANCO',
  },
  {
    key: 'PSE_BBVA_COL',
    label: 'PSE — BBVA Colombia',
    description: 'Débito desde cuenta BBVA vía PSE.',
    category: 'PSE_BANCO',
  },
  {
    key: 'PSE_BANCO_BOGOTA',
    label: 'PSE — Banco de Bogotá',
    description: 'Débito desde Banco de Bogotá vía PSE.',
    category: 'PSE_BANCO',
  },
  {
    key: 'PSE_DAVIVIENDA',
    label: 'PSE — Davivienda',
    description: 'Débito desde Davivienda vía PSE.',
    category: 'PSE_BANCO',
  },
  {
    key: 'CARD_TOKEN',
    label: 'Tarjeta débito / crédito',
    description: 'Pago seguro mediante token emitido por el widget del PSP (no se envían PAN/CVC al backend).',
    category: 'TARJETA',
  },
];

/** Código de entidad para PSE (ajustables por entorno; validar contra el PSP). */
export const DEFAULT_WOMPI_PSE_INSTITUTION_CODE: Record<string, string> = {
  PSE_BANCOLOMBIA: process.env.WOMPI_PSE_BANCOLOMBIA ?? '007',
  PSE_BBVA_COL: process.env.WOMPI_PSE_BBVA ?? '013',
  PSE_BANCO_BOGOTA: process.env.WOMPI_PSE_BANCO_BOGOTA ?? '001',
  PSE_DAVIVIENDA: process.env.WOMPI_PSE_DAVIVIENDA ?? '051',
};
