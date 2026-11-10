import { useState } from "react";
import { normalizePartyName, PARTY_ROLES } from "../core/partyNames";
import type { PartyNames } from "../core/types";

const LABELS = { arrendador: "Arrendador", arrendatario: "Arrendatario" };

export function PartyReview({
  names,
  confirmed,
  onConfirm,
}: {
  names: PartyNames;
  confirmed: boolean;
  onConfirm: (names: PartyNames) => void;
}) {
  const [draft, setDraft] = useState(names);
  const [error, setError] = useState("");

  function submit() {
    const reviewed: PartyNames = {};
    for (const role of PARTY_ROLES) {
      const value = draft[role] ?? "";
      const name = normalizePartyName(value);
      if (value.trim() && !name) {
        setError(`${LABELS[role]} debe contener un nombre con letras y signos propios de un nombre.`);
        return;
      }
      reviewed[role] = name;
    }
    onConfirm(reviewed);
  }

  return (
    <form className="mt-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <fieldset className="space-y-2">
        <legend className="font-semibold">Nombres de las partes</legend>
        <p className="text-sm">Revise lo dictado o complete los nombres en las casillas.</p>
        {PARTY_ROLES.map((role) => (
          <label className="block text-sm" key={role}>
            {LABELS[role]}
            <input
              className="block w-full rounded border border-current/30 p-2"
              type="text"
              value={draft[role] ?? ""}
              onChange={(event) => {
                setDraft({ ...draft, [role]: event.target.value });
                setError("");
              }}
            />
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        {confirmed && <p className="text-sm">Nombres revisados. Las casillas vacías quedan pendientes.</p>}
        <button type="submit" className="btn-secondary">Confirmar nombres</button>
      </fieldset>
    </form>
  );
}
