"use client";

import { useId, useMemo } from "react";
import Select, { type InputActionMeta, type SingleValue } from "react-select";

export type AppSelectOption = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

type AppSelectProps = {
  inputId?: string;
  ariaLabel?: string;
  value: string;
  onChange: (nextValue: string) => void;
  onInputChange?: (nextValue: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  emptyValue?: string;
  isSearchable?: boolean;
  isClearable?: boolean;
  isDisabled?: boolean;
  size?: "default" | "compact";
  className?: string;
};

function dedupeOptions(options: AppSelectOption[]) {
  const seen = new Set<string>();
  const unique: AppSelectOption[] = [];

  for (const option of options) {
    const key = option.label.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(option);
  }

  return unique;
}

export function AppSelect({
  inputId,
  ariaLabel,
  value,
  onChange,
  onInputChange,
  options,
  placeholder,
  emptyValue = "",
  isSearchable = true,
  isClearable = false,
  isDisabled = false,
  size = "default",
  className,
}: AppSelectProps) {
  const generatedId = useId().replace(/:/g, "");
  const selectId = inputId ?? `app-select-${generatedId}`;
  const uniqueOptions = useMemo(() => dedupeOptions(options), [options]);

  const selectedOption = useMemo(
    () => uniqueOptions.find((option) => option.value === value) ?? null,
    [uniqueOptions, value],
  );

  const compact = size === "compact";

  return (
    <Select<AppSelectOption, false>
      inputId={selectId}
      instanceId={selectId}
      aria-label={ariaLabel}
      className={className}
      classNamePrefix="app-select"
      options={uniqueOptions}
      value={selectedOption}
      onChange={(next: SingleValue<AppSelectOption>) => onChange(next?.value ?? emptyValue)}
      onInputChange={(nextValue: string, action: InputActionMeta) => {
        if (action.action === "input-change") onInputChange?.(nextValue);
        return nextValue;
      }}
      placeholder={placeholder}
      isSearchable={isSearchable}
      isClearable={isClearable}
      isDisabled={isDisabled}
      noOptionsMessage={() => "No options"}
      menuPlacement="auto"
      menuPosition="fixed"
      menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: compact ? 36 : 44,
          borderRadius: 10,
          borderColor: state.isFocused ? "var(--profit)" : "#d6d0c8",
          boxShadow: state.isFocused
            ? "0 0 0 3px color-mix(in srgb, var(--profit) 16%, transparent)"
            : "none",
          backgroundColor: "var(--white)",
          fontSize: compact ? 13 : 14,
          fontWeight: 600,
          color: "var(--ink-soft)",
          cursor: "pointer",
          ":hover": {
            borderColor: state.isFocused ? "var(--profit)" : "#d6d0c8",
          },
        }),
        valueContainer: (base) => ({
          ...base,
          padding: compact ? "0 8px" : "0 10px",
        }),
        input: (base) => ({
          ...base,
          margin: 0,
          padding: 0,
        }),
        placeholder: (base) => ({
          ...base,
          color: "var(--ink-faint)",
          fontWeight: 500,
        }),
        singleValue: (base) => ({
          ...base,
          color: "var(--ink-soft)",
        }),
        indicatorSeparator: () => ({
          display: "none",
        }),
        dropdownIndicator: (base, state) => ({
          ...base,
          color: state.isFocused ? "var(--profit)" : "var(--ink-faint)",
          padding: compact ? 6 : 8,
        }),
        clearIndicator: (base) => ({
          ...base,
          padding: compact ? 6 : 8,
        }),
        menuPortal: (base) => ({
          ...base,
          zIndex: 120,
        }),
        menu: (base) => ({
          ...base,
          marginTop: 6,
          borderRadius: 10,
          border: "1px solid #d6d0c8",
          boxShadow: "0 12px 32px color-mix(in srgb, var(--navy) 12%, transparent)",
          overflow: "hidden",
        }),
        menuList: (base) => ({
          ...base,
          padding: 0,
          maxHeight: 280,
        }),
        option: (base, state) => ({
          ...base,
          fontSize: compact ? 13 : 14,
          fontWeight: 500,
          backgroundColor: state.isSelected
            ? "color-mix(in srgb, var(--profit) 18%, var(--white))"
            : state.isFocused
              ? "color-mix(in srgb, var(--profit) 10%, var(--white))"
              : "var(--white)",
          color: "var(--ink)",
          cursor: "pointer",
        }),
      }}
    />
  );
}