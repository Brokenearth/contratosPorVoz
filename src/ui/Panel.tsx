import type { ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Card section with an accessible heading. */
export function Panel({ id, title, actions, children }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="panel">
      <div className="panel-heading">
        <h2 id={`${id}-titulo`}>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
