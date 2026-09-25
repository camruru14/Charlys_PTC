import { IconSearch } from "../../lib/icons";

/* Buscador: 36px, radio 10px, fondo surface-2, lupa de 15px. */
function SearchInput({ value, onChange, placeholder = "Buscar…", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <IconSearch
        width={15}
        height={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-[10px] border border-line bg-surface-2 pl-[34px] pr-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:bg-surface"
      />
    </div>
  );
}

export default SearchInput;
