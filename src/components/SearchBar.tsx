type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">
        Search plants
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-shell"
        placeholder="Tomato, basil, carrot, dill..."
        autoComplete="off"
      />
    </label>
  );
}
