# Notificaciones por correo

Avisar automáticamente por correo cuando cambia el estado de una reserva, para que docentes y administradores no dependan de entrar al sistema.

## Qué se envía

- **Al administrador**: llega una nueva solicitud de reserva (fecha, bloques, curso, docente, objetivo). Para reservas recurrentes se envía un solo correo resumen.
- **Al docente**:
  - Reserva **aprobada** (con fecha, bloque y horario).
  - Reserva **rechazada** (incluye el motivo/nota del administrador si existe).
  - Reserva **liberada** por el administrador (incluye la razón de cancelación).

Todos los correos en español, con el nombre y logo del establecimiento tomados de la configuración actual.

## Control desde el panel

Nueva sección "Notificaciones" en la configuración del panel admin:
- Activar/desactivar cada tipo de aviso (nueva solicitud, aprobada, rechazada, liberada).
- Definir el correo o correos que reciben los avisos de nuevas solicitudes.

## Detalles técnicos

1. **Correo saliente**: función de backend `send-reservation-email` que envía vía Resend. Requiere configurar el dominio de envío del establecimiento y la clave del proveedor antes de que los correos salgan realmente; mientras tanto se puede probar con el dominio de pruebas.
2. **Base de datos**:
   - Tabla `notification_settings` (activación por tipo de evento + lista de correos admin), con RLS: lectura para autenticados, escritura solo admin.
   - Tabla `notification_log` (reserva, tipo, destinatario, estado, error) para auditoría y evitar envíos duplicados; solo admin puede leer.
3. **Disparo**: los envíos se llaman desde el cliente en los mismos puntos donde hoy cambia el estado (`useCreateReservation`, `useCreateRecurringReservations`, `useUpdateReservationStatus`, `useApproveRecurrenceGroup`, `useReleaseReservation`), invocando la función edge con el `id` de la reserva. La función valida el JWT, vuelve a leer la reserva y sus notas con permisos de servicio, y decide el destinatario — el cliente nunca define a quién ni qué se envía.
4. **Datos del docente**: la función obtiene nombre y correo desde `profiles` con permisos de servicio (no se exponen correos al cliente).
5. **Plantillas**: HTML simple y responsivo, con el color institucional y el logo del establecimiento.
6. **Errores**: si el correo falla, la reserva igual se guarda/actualiza; el fallo queda registrado en `notification_log` y se muestra un aviso discreto al admin.
