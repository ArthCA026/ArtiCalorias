import type { PolicyDocument } from '../types';
import { POLICY_VERSIONS } from '../policyVersions';

export const termsEs: PolicyDocument = {
  version: POLICY_VERSIONS.terms,
  effectiveDate: '2026-09-18',
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
      heading: 'Suscripción y pago',
      paragraphs: [
        'ArtiCalorias es un servicio de pago: usar la aplicación requiere una suscripción activa. Crear una cuenta, completar la configuración inicial, descargar tus datos y eliminar tu cuenta nunca requieren un pago.',
      ],
      bullets: [
        'Planes y precios: un plan mensual de USD 9,99 al mes y un plan anual de USD 29,99 al año. El plan y el precio que te aplican son los que muestra la aplicación cuando te suscribes, y el monto mostrado antes de pagar es el monto total que cobramos.',
        'Los precios están en dólares estadounidenses. Tu banco o el emisor de tu tarjeta puede aplicar conversión de moneda u otros cargos que no controlamos.',
        'Renovación automática: tu suscripción se renueva sola al final de cada periodo, mensual o anual, y se cobra el precio de tu plan al medio de pago que indicaste. Esto continúa hasta que canceles.',
        'Cancelación: puedes cancelar en cualquier momento dentro de la aplicación, en Perfil, Suscripción. Cancelar detiene todos los cobros futuros. Conservas el acceso hasta el final del periodo que ya pagaste, y puedes deshacer la cancelación antes de esa fecha.',
        'Pagos fallidos: si el pago de una renovación falla, el cobro puede reintentarse y conservas el acceso durante un periodo de gracia corto, actualmente de 3 días. Si el pago sigue sin poder cobrarse, el acceso se suspende hasta que te suscribas de nuevo. Tus datos se conservan.',
        'Reembolsos: no se reembolsan los pagos de periodos usados parcialmente, salvo cuando la ley que te aplica te otorgue un derecho de retracto o de reembolso. Nada en estos términos limita esos derechos. Para solicitar un reembolso escribe a r2chaves026@gmail.com.',
        'Cambios de precio: si el precio de tu plan cambia, te avisamos en la aplicación o por correo al menos 30 días antes de que te aplique, y solo aplica desde una renovación posterior a ese aviso. Si no estás de acuerdo puedes cancelar antes de esa renovación.',
        'Eliminar tu cuenta cancela tu suscripción de inmediato y termina tu acceso. El tiempo restante de la suscripción no se reembolsa, salvo cuando la ley lo exija.',
        'Acceso de cortesía: podemos permitir que algunas cuentas usen la aplicación sin suscripción, a nuestra discreción, y podemos terminar ese acceso en cualquier momento.',
      ],
    },
    {
      heading: 'Cómo se procesan los pagos',
      paragraphs: [
        'Los pagos los procesa ONVO Pay, un procesador de pagos con sede en Costa Rica. Escribes los datos de tu tarjeta directamente en el formulario de pago de ONVO Pay. ArtiCalorias nunca recibe ni guarda el número de tu tarjeta, su fecha de vencimiento ni su código de seguridad. El Aviso de Privacidad explica qué se comparte con ONVO Pay.',
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
        'Las metas y límites de nutrientes que muestra la aplicación, por ejemplo de proteína, cafeína o sodio, son valores de referencia generales de salud pública, no recomendaciones personalizadas. El embarazo, la medicación y las condiciones médicas cambian lo que es adecuado para ti.',
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
        'El servicio puede cambiar, interrumpirse temporalmente o descontinuarse. Haremos lo razonable para avisar con anticipación de cambios importantes. Si el servicio se descontinúa, las renovaciones se detienen y se reembolsa la parte no usada de cualquier periodo ya pagado.',
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
