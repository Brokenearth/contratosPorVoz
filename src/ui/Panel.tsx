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
    <section
      aria-labelledby={`${id}-titulo`}
      className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-titulo`} className="text-lg font-semibold">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
