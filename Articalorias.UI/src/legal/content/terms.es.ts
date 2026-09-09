import type { PolicyDocument } from '../types';
import { POLICY_VERSIONS } from '../policyVersions';

export const termsEs: PolicyDocument = {
  version: POLICY_VERSIONS.terms,
  effectiveDate: '2026-09-09',
  title: 'Términos de Uso',
  draftBanner:
    'BORRADOR PARA REVISIÓN LEGAL. Este documento está pendiente de validación por un profesional en derecho en Costa Rica y su texto puede cambiar.',
  intro: [
    'Estos términos regulan el uso de ArtiCalorias. Al crear una cuenta aceptas estos términos y el Aviso de Privacidad.',
  ],
  sections: [
    {
      heading: 'Qué es ArtiCalorias',
      paragraphs: [
        'ArtiCalorias es una aplicación para registrar comidas y actividades, calcular presupuestos de calorías y macronutrientes, y seguir el progreso corporal a lo largo del tiempo. El servicio es operado por Arthuro Chaves Aguilar (r2chaves026@gmail.com).',
      ],
    },
    {
      heading: 'Requisito de edad',
      paragraphs: [
        'Debes tener al menos 18 años para usar ArtiCalorias. Al crear una cuenta declaras que eres mayor de 18 años. Las cuentas de personas menores de edad serán eliminadas.',
      ],
    },
    {
      heading: 'Tu cuenta',
      bullets: [
        'Eres responsable de mantener tu contraseña segura y de toda actividad realizada con tu cuenta.',
        'La información que registres debe ser tuya. No registres datos de salud de otras personas.',
        'Puedes eliminar tu cuenta en cualquier momento desde Perfil. La eliminación es inmediata y permanente.',
      ],
    },
    {
      heading: 'Uso aceptable',
      bullets: [
        'No intentes acceder a datos de otros usuarios ni interferir con el funcionamiento del servicio.',
        'No uses el servicio de formas no previstas, como automatizar solicitudes masivas o revender el acceso.',
        'Podemos suspender o eliminar cuentas que violen estos términos.',
      ],
    },
    {
      heading: 'No es consejo médico',
      paragraphs: [
        'ArtiCalorias ofrece estimaciones informativas basadas en fórmulas generales. No es un dispositivo médico y no sustituye el consejo de profesionales en medicina o nutrición.',
        'Consulta a un profesional antes de hacer cambios importantes en tu alimentación o ejercicio, en especial si tienes una condición de salud o un historial de trastornos de la conducta alimentaria. La aplicación aplica límites mínimos de seguridad en las metas de calorías, pero eso no convierte sus cálculos en recomendaciones médicas.',
      ],
    },
    {
      heading: 'Funciones con inteligencia artificial',
      paragraphs: [
        'El análisis de comidas y actividades por inteligencia artificial produce estimaciones que pueden ser imprecisas. Revisa y corrige los valores antes de guardarlos. Los datos que envías para análisis se comparten con OpenAI según se describe en el Aviso de Privacidad.',
      ],
    },
    {
      heading: 'Disponibilidad y cambios del servicio',
      paragraphs: [
        'El servicio puede cambiar, interrumpirse temporalmente o descontinuarse. Haremos lo razonable para avisar con anticipación de cambios importantes.',
      ],
    },
    {
      heading: 'Limitación de responsabilidad',
      paragraphs: [
        'En la máxima medida que permita la ley costarricense, el servicio se ofrece tal cual, sin garantías de exactitud de las estimaciones, y el responsable no asume responsabilidad por decisiones de salud tomadas con base en la aplicación.',
      ],
    },
    {
      heading: 'Ley aplicable',
      paragraphs: ['Estos términos se rigen por las leyes de la República de Costa Rica.'],
    },
    {
      heading: 'Cambios a estos términos',
      paragraphs: [
        'Si cambiamos estos términos, te pediremos revisar y aceptar la nueva versión antes de seguir usando la aplicación. Cada versión se identifica por su fecha.',
      ],
    },
    {
      heading: 'Contacto',
      paragraphs: ['Para cualquier consulta sobre estos términos escribe a r2chaves026@gmail.com.'],
    },
  ],
};
