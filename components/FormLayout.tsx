type FormPageHeaderProps = {
  eyebrow?: string;
  title: string;
  lead: React.ReactNode;
};

export function FormPageHeader({ eyebrow, title, lead }: FormPageHeaderProps) {
  return (
    <header className="form-page-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="page-title">{title}</h1>
      <div className="page-lead">{lead}</div>
    </header>
  );
}

export function FormPanel({ children }: { children: React.ReactNode }) {
  return <div className="form-panel">{children}</div>;
}

export function FormActions({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="form-actions">
      {children}
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
}
