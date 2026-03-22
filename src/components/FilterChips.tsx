import type { PlantCategoryFilter } from "../lib/searchPlants";

const CHIP_OPTIONS: Array<{ value: PlantCategoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "vegetable", label: "Vegetables" },
  { value: "herb", label: "Herbs" },
  { value: "flower", label: "Flowers" }
];

type FilterChipsProps = {
  value: PlantCategoryFilter;
  onChange: (value: PlantCategoryFilter) => void;
};

export function FilterChips({ value, onChange }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-3" aria-label="Filter plants by category">
      {CHIP_OPTIONS.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              active
                ? "action-button bg-clay text-white hover:bg-clay/90"
                : "action-button border border-slate-200 bg-white text-slate-700 hover:border-clay/40 hover:bg-clay/5"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
