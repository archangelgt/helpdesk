/// <reference path="../pb_data/types.d.ts" />
// Remitente por defecto de los avisos. La contraseña SMTP no se guarda aquí: va en el .env del despliegue (SMTP_PASSWORD).

const FROM = "soporte@erpsys.pro";

migrate(
  (app) => {
    const senders = app.findCollectionByNameOrId("email_senders");
    const sender = new Record(senders);
    sender.set("name", "Soporte erpsys");
    sender.set("from_email", FROM);
    sender.set("reply_to", FROM);
    sender.set("provider", "smtp");
    sender.set("smtp_host", "smtp.zoho.com");
    sender.set("smtp_port", 465);
    sender.set("spf_ok", false);
    sender.set("dkim_ok", false);
    sender.set("is_default", true);
    sender.set("active", true);
    app.save(sender);

    const setting = (key) => {
      try {
        return app.findFirstRecordByData("settings", "key", key);
      } catch (_) {
        return null;
      }
    };
    const defaultSender = setting("email.default_sender");
    if (defaultSender) {
      defaultSender.set("value", sender.id);
      app.save(defaultSender);
    }
    const maxUpload = setting("files.max_upload_mb");
    if (maxUpload) {
      maxUpload.set("value", 25);
      app.save(maxUpload);
    }
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData("email_senders", "from_email", FROM));
    } catch (_) {}
  },
);
