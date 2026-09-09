import type { PolicyDocument } from '../types';
import { POLICY_VERSIONS } from '../policyVersions';

export const privacyEs: PolicyDocument = {
  version: POLICY_VERSIONS.privacy,
  effectiveDate: '2026-09-09',
  title: 'Aviso de Privacidad',
  draftBanner:
    'BORRADOR PARA REVISIÓN LEGAL. Este documento está pendiente de validación por un profesional en derecho en Costa Rica y su texto puede cambiar.',
  intro: [
    'Este aviso explica qué datos personales recopila ArtiCalorias, para qué se usan, con quién se comparten y qué derechos tienes sobre ellos, conforme a la Ley 8968, Protección de la Persona frente al Tratamiento de sus Datos Personales, de Costa Rica.',
  ],
  sections: [
    {
      heading: 'Responsable del tratamiento',
      paragraphs: [
        'El responsable de la base de datos de ArtiCalorias es Arthuro Chaves Aguilar, con domicilio en [DIRECCIÓN PENDIENTE].',
        'Para cualquier consulta o solicitud sobre tus datos puedes escribir a r2chaves026@gmail.com.',
        'Tus datos se almacenan en una base de datos operada por el responsable y alojada en servidores de Microsoft Azure ubicados en Estados Unidos.',
      ],
    },
    {
      heading: 'Qué datos recopilamos',
      paragraphs: ['Datos de cuenta, obligatorios para crear la cuenta:'],
      bullets: [
        'Nombre de usuario y correo electrónico.',
        'Contraseña, guardada siempre cifrada con hash y salt, nunca en texto plano.',
      ],
    },
    {
      heading: 'Datos de salud y del cuerpo',
      paragraphs: [
        'Estos datos los proporcionas tú, de forma voluntaria, porque son la materia prima del servicio. La ley los considera datos sensibles, por eso te pedimos un consentimiento expreso y separado para tratarlos:',
      ],
      bullets: [
        'Peso, estatura, edad y sexo biológico.',
        'Porcentaje de grasa corporal y tasa metabólica basal.',
        'Metas de calorías, proteína, peso objetivo y fecha objetivo.',
        'Horas de sueño y de actividad diaria.',
        'Registro diario de comidas y bebidas, con calorías, proteína, grasas, carbohidratos, alcohol, azúcar y agua.',
        'Días de ayuno que marques.',
        'Actividades físicas registradas y su duración.',
        'Historial de mediciones corporales a lo largo del tiempo.',
        'Notas de texto libre que agregues a tus comidas.',
      ],
    },
    {
      heading: 'Datos técnicos y de uso',
      bullets: [
        'Zona horaria del dispositivo e idioma de la interfaz.',
        'País, si lo configuras.',
        'Fecha y hora de tu última actividad en la aplicación.',
        'Suscripción de notificaciones del navegador y horarios de recordatorios, si activas los recordatorios de comidas.',
        'Fotos de comidas que envíes para análisis. Las fotos se procesan al momento y no se guardan en nuestra base de datos.',
      ],
    },
    {
      heading: 'Para qué usamos tus datos',
      bullets: [
        'Calcular tu presupuesto de calorías y macronutrientes y mostrar tu progreso.',
        'Interpretar con inteligencia artificial las descripciones o fotos de comidas y actividades que envíes, para convertirlas en registros.',
        'Enviarte recordatorios de comidas, solo si los activas.',
        'Enviarte correos de recuperación de contraseña.',
        'Mantener la seguridad de tu cuenta.',
      ],
      paragraphs: [
        'No usamos tus datos para publicidad, no los vendemos y la aplicación no incluye rastreadores de analítica de terceros.',
      ],
    },
    {
      heading: 'Con quién se comparten tus datos',
      paragraphs: ['Para funcionar, ArtiCalorias envía ciertos datos a estos proveedores:'],
      bullets: [
        'OpenAI (Estados Unidos): recibe el texto y las fotos de comidas o actividades que envíes para análisis, junto con tu país si lo configuraste. Se usa únicamente para interpretar tu registro.',
        'Open Food Facts (Francia): recibe únicamente el código de barras que escanees, para buscar el producto.',
        'Servicios de notificaciones del navegador (Google, Mozilla o Apple, según tu navegador): reciben el identificador técnico necesario para entregar los recordatorios.',
        'Proveedor de correo electrónico: recibe tu dirección para enviarte los códigos de recuperación de contraseña.',
        'Microsoft Azure (Estados Unidos): aloja la aplicación y la base de datos.',
      ],
    },
    {
      heading: 'Transferencias internacionales',
      paragraphs: [
        'Los envíos anteriores implican transferir datos fuera de Costa Rica, principalmente a Estados Unidos. Al aceptar este aviso y dar tu consentimiento de datos de salud autorizas esas transferencias. No compartimos tus datos con nadie más, salvo obligación legal.',
      ],
    },
    {
      heading: 'Datos obligatorios, opcionales y consecuencias de no darlos',
      bullets: [
        'Obligatorios: nombre de usuario, correo y contraseña. Sin ellos no se puede crear la cuenta.',
        'Opcionales pero centrales: peso, estatura, edad, sexo y demás datos del cuerpo. Puedes omitir algunos, pero los cálculos serán menos precisos o algunas funciones no estarán disponibles. Por ejemplo, las metas automáticas de proteína necesitan tu peso.',
        'Si no consientes el tratamiento de tus datos de salud, la aplicación no puede prestarte el servicio, porque el servicio consiste precisamente en registrar y calcular con esos datos. Puedes negarte, pero en ese caso no es posible usar ArtiCalorias.',
      ],
    },
    {
      heading: 'Registro de tu consentimiento',
      paragraphs: [
        'Guardamos un registro de cada consentimiento que das o revocas: qué documento, en qué versión, en qué idioma y en qué momento. Esto nos permite demostrar tu consentimiento y respetar su revocación.',
      ],
    },
    {
      heading: 'Tus derechos y cómo ejercerlos',
      bullets: [
        'Acceso: puedes ver tus datos dentro de la aplicación y descargarlos completos desde Perfil, sección Legal, opción Descargar mis datos.',
        'Rectificación: puedes corregir tu perfil y tus registros directamente en la aplicación.',
        'Eliminación: puedes borrar tu historial o tu cuenta completa desde Perfil. La eliminación de la cuenta es inmediata y permanente.',
        'Revocación del consentimiento: desde Perfil, sección Legal. Si revocas el consentimiento de datos de salud, la aplicación deja de guardar datos nuevos y te ofrece eliminar tu cuenta.',
      ],
      paragraphs: [
        'También puedes ejercer cualquiera de estos derechos escribiendo a r2chaves026@gmail.com.',
      ],
    },
    {
      heading: 'Cuánto tiempo conservamos tus datos',
      paragraphs: [
        'Conservamos tus datos mientras tu cuenta exista. Si eliminas tu historial o tu cuenta, los datos se borran de la base de datos de forma inmediata y permanente. Las copias de seguridad del proveedor de alojamiento pueden tardar un tiempo adicional limitado en purgarse.',
      ],
    },
    {
      heading: 'Seguridad',
      paragraphs: [
        'Las comunicaciones viajan cifradas mediante HTTPS, las contraseñas se guardan con hash y salt, y el acceso a la base de datos está restringido. Ningún sistema es infalible, pero aplicamos medidas razonables y proporcionales a la sensibilidad de los datos.',
      ],
    },
    {
      heading: 'Menores de edad',
      paragraphs: [
        'ArtiCalorias es para personas mayores de 18 años. Al registrarte declaras que eres mayor de edad. Si detectamos la cuenta de una persona menor, la eliminaremos.',
      ],
    },
    {
      heading: 'Cambios a este aviso',
      paragraphs: [
        'Si cambiamos este aviso, te pediremos revisar y aceptar la nueva versión antes de seguir usando la aplicación. Cada versión se identifica por su fecha.',
      ],
    },
  ],
};
