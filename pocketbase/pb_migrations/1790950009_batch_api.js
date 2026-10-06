/// <reference path="../pb_data/types.d.ts" />
// La API usa peticiones batch (transaccionales) para operaciones de varios registros:
// crear una implementación desde plantilla, completar una etapa y desbloquear la siguiente, etc.

migrate(
  (app) => {
    const settings = app.settings();
    settings.batch.enabled = true;
    settings.batch.maxRequests = 300;
    settings.batch.timeout = 15;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.batch.enabled = false;
    app.save(settings);
  },
);
