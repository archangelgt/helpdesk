import { useTranslation } from "react-i18next";
import type { ClientDto, RoleOption } from "../../types/api";

export interface UserFormValue {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  clientId: string;
  language: "" | "es" | "en" | "pt";
  receivesNotifications: boolean;
}

export const EMPTY_USER: UserFormValue = { name: "", email: "", phone: "", roleId: "", clientId: "", language: "", receivesNotifications: false };

interface Props {
  value: UserFormValue;
  onChange: (value: UserFormValue) => void;
  roles: RoleOption[];
  clients: ClientDto[];
  /** El usuario se edita a sí mismo: no puede cambiar su rol. */
  lockRole?: boolean;
}

/** Datos del usuario, rol y empresa. Los roles de cliente piden empresa; el personal no la lleva. */
export function UserFields({ value, onChange, roles, clients, lockRole = false }: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<UserFormValue>) => onChange({ ...value, ...patch });
  const role = roles.find((r) => r.id === value.roleId);
  const isClientRole = role?.scope === "client";
  const staffRoles = roles.filter((r) => r.scope === "staff");
  const clientRoles = roles.filter((r) => r.scope === "client");

  return (
    <div className="form-grid">
      <label className="field">
        {t("users.fields.name")}
        <input value={value.name} onChange={(e) => set({ name: e.target.value })} required maxLength={120} />
      </label>
      <label className="field">
        {t("users.fields.email")}
        <input type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} required maxLength={200} />
      </label>
      <label className="field">
        {t("users.fields.role")}
        <select
          value={value.roleId}
          disabled={lockRole}
          onChange={(e) => {
            const next = roles.find((r) => r.id === e.target.value);
            set({ roleId: e.target.value, ...(next?.scope === "staff" && { clientId: "", receivesNotifications: false }) });
          }}
          required
        >
          <option value="">{t("users.choose")}</option>
          <optgroup label={t("users.scope.staff")}>
            {staffRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {t(`role.${r.code}`, { defaultValue: r.name })}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("users.scope.client")}>
            {clientRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {t(`role.${r.code}`, { defaultValue: r.name })}
              </option>
            ))}
          </optgroup>
        </select>
        {lockRole && <span className="hint">{t("users.ownRole")}</span>}
      </label>
      {isClientRole && (
        <label className="field">
          {t("users.fields.client")}
          <select value={value.clientId} onChange={(e) => set({ clientId: e.target.value })} required>
            <option value="">{t("users.choose")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        {t("users.fields.phone")}
        <input value={value.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={40} />
      </label>
      <label className="field">
        {t("users.fields.language")}
        <select value={value.language} onChange={(e) => set({ language: e.target.value as UserFormValue["language"] })}>
          <option value="">{t("users.languageDefault")}</option>
          <option value="es">Español</option>
          <option value="en">English</option>
          <option value="pt">Português</option>
        </select>
      </label>
      {isClientRole && (
        <label className="check full-row">
          <input type="checkbox" checked={value.receivesNotifications} onChange={(e) => set({ receivesNotifications: e.target.checked })} />
          <span>
            {t("users.fields.receivesNotifications")}
            <span className="hint block">{t("users.receivesHint")}</span>
          </span>
        </label>
      )}
    </div>
  );
}
