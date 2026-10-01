/* Estado vacío: ícono opcional, título, descripción y acción. */
function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon ? (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-[12px] bg-surface-2 text-faint">
          <Icon width={20} height={20} />
        </span>
      ) : null}
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      {description ? <p className="t-aux max-w-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
