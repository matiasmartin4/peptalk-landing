/* peptalk — datos de la biblioteca.
   Es la única fuente de contenido: para sumar un péptido, verificar un estado
   o cargar evidencia se edita este archivo. Estados sin verificar = 'Pendiente'.
   Cada estado verificado debería llevar fuente y fecha (campo `verified`). */

window.PT = {
  // x/y: posición del punto en la silueta (viewBox 320×500)
  systems: [
    { id: 'cerebro',   name: 'Cerebro y sueño',        x: 160, y: 44,  desc: 'Péptidos que se estudian en sueño, ansiedad, memoria y neuroprotección.',            icon: 'M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z' },
    { id: 'hormonas',  name: 'Hormonas y metabolismo', x: 160, y: 96,  desc: 'Señales hormonales: hormona de crecimiento, oxitocina y el eje hipotálamo-hipófisis.', icon: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9' },
    { id: 'inmune',    name: 'Inmune y defensa',       x: 140, y: 128, desc: 'Moduladores de la respuesta inmune y péptidos antimicrobianos.',                     icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' },
    { id: 'corazon',   name: 'Corazón y sangre',       x: 176, y: 146, desc: 'Anticoagulantes, péptidos natriuréticos y otros con uso cardiovascular.',             icon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' },
    { id: 'digestivo', name: 'Digestivo y peso',       x: 160, y: 204, desc: 'Agonistas de GLP-1, péptidos gástricos y los que se estudian en peso corporal.',        icon: 'M4 18a8 8 0 1 1 16 0M12 18l3.5-4.5M4 18h16' },
    { id: 'sexual',    name: 'Sexual y reproductivo',  x: 160, y: 262, desc: 'Péptidos vinculados al deseo, la fertilidad y el eje reproductivo.',                  icon: 'M9.5 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14.5 19a5 5 0 1 0 0-10 5 5 0 0 0 0 10z' },
    { id: 'piel',      name: 'Piel y envejecimiento',  x: 92,  y: 196, desc: 'Péptidos cosméticos y los que se estudian en cicatrización y envejecimiento.',         icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z' },
    { id: 'huesos',    name: 'Huesos y músculo',       x: 140, y: 372, desc: 'Reparación de tendones, músculo y hueso, en su mayoría con evidencia preclínica.',     icon: 'M6.5 7v10M17.5 7v10M3.5 10v4M20.5 10v4M6.5 12h11' }
  ],

  peptides: [
    { slug: 'bpc-157', name: 'BPC-157', alias: 'Body Protection Compound-157 · PL 14736', sys: 'digestivo', type: 'Péptido' },
    { slug: 'semaglutida', name: 'Semaglutida', alias: 'Semaglutide', sys: 'digestivo', type: 'Análogo peptídico' },
    { slug: 'tb-500', name: 'TB-500', alias: 'Fragmento de timosina beta-4', sys: 'huesos', type: 'Péptido' },
    { slug: 'ghk-cu', name: 'GHK-Cu', alias: 'Tripéptido de cobre-1', sys: 'piel', type: 'Péptido' },
    { slug: 'tirzepatida', name: 'Tirzepatida', alias: 'Tirzepatide', sys: 'digestivo', type: 'Análogo peptídico' },
    { slug: 'epitalon', name: 'Epitalon', alias: 'Epithalon · AEDG', sys: 'piel', type: 'Péptido' },
    { slug: 'timosina-alfa-1', name: 'Timosina alfa-1', alias: 'Thymosin alpha-1 · Timalfasina', sys: 'inmune', type: 'Péptido' },
    { slug: 'oxitocina', name: 'Oxitocina', alias: 'Oxytocin', sys: 'hormonas', type: 'Péptido' },
    { slug: 'kpv', name: 'KPV', alias: 'Lys-Pro-Val', sys: 'digestivo', type: 'Péptido' },
    { slug: 'aod-9604', name: 'AOD-9604', alias: 'Fragmento modificado de hGH', sys: 'digestivo', type: 'Péptido' },
    { slug: 'fragmento-176-191', name: 'Fragmento 176-191', alias: 'HGH Fragment 176-191', sys: 'digestivo', type: 'Péptido' },
    { slug: 'selank', name: 'Selank', alias: 'TP-7', sys: 'cerebro', type: 'Péptido' },
    { slug: 'semax', name: 'Semax', alias: 'ACTH(4-7)-PGP', sys: 'cerebro', type: 'Péptido' },
    { slug: 'dsip', name: 'DSIP', alias: 'Delta sleep-inducing peptide', sys: 'cerebro', type: 'Péptido' },
    { slug: 'bremelanotida', name: 'Bremelanotida', alias: 'PT-141 · Bremelanotide', sys: 'sexual', type: 'Péptido' },
    { slug: 'kisspeptina', name: 'Kisspeptina', alias: 'Kisspeptin-10', sys: 'sexual', type: 'Péptido' },
    { slug: 'cjc-1295', name: 'CJC-1295', alias: 'Análogo de GHRH', sys: 'hormonas', type: 'Análogo peptídico' },
    { slug: 'ipamorelina', name: 'Ipamorelina', alias: 'Ipamorelin', sys: 'hormonas', type: 'Péptido' },
    { slug: 'll-37', name: 'LL-37', alias: 'Catelicidina', sys: 'inmune', type: 'Péptido' },
    { slug: 'palmitoil-pentapeptido-4', name: 'Palmitoil pentapéptido-4', alias: 'Matrixyl · Pal-KTTKS', sys: 'piel', type: 'Cosmético' },
    { slug: 'bivalirudina', name: 'Bivalirudina', alias: 'Bivalirudin', sys: 'corazon', type: 'Péptido' },
    { slug: 'nesiritida', name: 'Nesiritida', alias: 'Nesiritide · BNP recombinante', sys: 'corazon', type: 'Polipéptido' }
  ],

  agencies: ['ANMAT', 'FDA', 'EMA', 'WADA'],

  // label → clase del punto + explicación
  statuses: [
    { v: 'Aprobado',         cls: 'd-aprob',  desc: 'Autorizado para al menos una indicación.' },
    { v: 'En investigación', cls: 'd-inv',    desc: 'Hay ensayos en curso; no está autorizado.' },
    { v: 'No aprobado',      cls: 'd-noap',   desc: 'Sin autorización para uso en personas.' },
    { v: 'Prohibido',        cls: 'd-proh',   desc: 'En la lista de sustancias prohibidas (WADA).' },
    { v: 'Cosmético',        cls: 'd-cosm',   desc: 'Registrado como ingrediente cosmético.' },
    { v: 'No listado',       cls: 'd-nolist', desc: 'La agencia no tiene registro sobre él.' },
    { v: 'Pendiente',        cls: 'd-pend',   desc: 'Todavía no lo verificó peptalk lab.' }
  ],

  evidence: [
    { v: 'A', name: 'Ensayos controlados replicados' },
    { v: 'B', name: 'Al menos un ensayo controlado' },
    { v: 'C', name: 'Estudios humanos no controlados' },
    { v: 'D', name: 'Solo preclínico' },
    { v: 'E', name: 'Sin estudios publicados' },
    { v: '—', name: 'Evidencia pendiente de revisión' }
  ],

  provinces: ['Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'],

  // Endpoints de formularios (Formspree, Google Apps Script, etc.).
  // Vacío = el formulario valida pero avisa que todavía no recibe pedidos.
  endpoints: { newsletter: '', referral: '' }
};
