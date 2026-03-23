import {
  getZoneRange,
  USDA_ZONE_REGIONS,
  USDA_ZONES,
  type USDAZone
} from "../lib/zones";

type ZonePickerProps = {
  value: USDAZone;
  onChange: (zone: USDAZone) => void;
};

export function ZonePicker({ value, onChange }: ZonePickerProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">
        USDA Hardiness Zone
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as USDAZone)}
        className="field-shell"
        aria-label="Select USDA Hardiness Zone"
      >
        {USDA_ZONES.map((zone) => (
          <option key={zone} value={zone}>
            Zone {zone} - {USDA_ZONE_REGIONS[zone]}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
        Data bucket {getZoneRange(value)}
      </span>
    </label>
  );
}
