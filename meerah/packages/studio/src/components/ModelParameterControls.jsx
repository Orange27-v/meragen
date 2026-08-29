"use client";

import {
  PROMPT_CONTROL_LABEL_CLASS,
  PromptChevronIcon,
  PromptPopover,
  PromptPopoverHeader,
  promptControlClassName,
} from "./prompt/PromptComposer.jsx";
import { sanitiseHelp } from "./rail/sanitise";

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)]/[0.04] px-3 py-2 text-xs text-[var(--chalk)] outline-none transition-colors focus:border-[color-mix(in_srgb,var(--line-hi)_50%,transparent)]";

function createEmptyValue(schema = {}) {
  if (schema.default !== undefined) return schema.default;
  if (schema.type === "boolean") return false;
  if (schema.type === "array") return [];
  if (schema.type === "object") {
    return Object.fromEntries(
      Object.entries(schema.properties || {}).map(([key, property]) => [
        key,
        createEmptyValue(property),
      ]),
    );
  }
  if (["number", "integer", "int"].includes(schema.type)) return 0;
  return "";
}

function FieldLabel({ schema, inputKey }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-[color-mix(in_srgb,var(--chalk)_75%,transparent)]">
        {schema.title || inputKey.replaceAll("_", " ")}
      </div>
      {schema.description && (
        <div className="mt-0.5 text-[10px] leading-relaxed text-[color-mix(in_srgb,var(--chalk)_35%,transparent)]">
          {sanitiseHelp(schema.description)}
        </div>
      )}
    </div>
  );
}

function ScalarInput({ schema, value, onChange, label }) {
  if (schema.enum) {
    return (
      <select
        className={FIELD_CLASS}
        aria-label={label}
        value={value ?? ""}
        onChange={(event) => {
          const selected = schema.enum.find(
            (option) => String(option) === event.target.value,
          );
          onChange(selected);
        }}
      >
        {schema.enum.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    );
  }

  if (schema.type === "boolean") {
    return (
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={!!value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
          value
            ? "border-[color-mix(in_srgb,var(--line-hi)_50%,transparent)] bg-[color-mix(in_srgb,var(--action)_30%,transparent)]"
            : "border-[var(--line)] bg-[var(--surface)]/[0.06]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--surface)] transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    );
  }

  const numeric = ["number", "integer", "int"].includes(schema.type);
  return (
    <input
      className={FIELD_CLASS}
      aria-label={label}
      type={numeric ? "number" : "text"}
      value={value ?? ""}
      min={schema.minValue ?? schema.minimum}
      max={schema.maxValue ?? schema.maximum}
      step={schema.step || (schema.type === "number" ? "any" : 1)}
      placeholder={schema.examples?.[0] && typeof schema.examples[0] !== "object"
        ? String(schema.examples[0])
        : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ArrayInput({ schema, value, onChange, label }) {
  const items = Array.isArray(value) ? value : [];
  const itemSchema = schema.items || { type: "string" };
  const maxItems = schema.maxItems ?? schema.max_items ?? Infinity;

  const updateItem = (index, nextValue) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? nextValue : item)));
  };

  const removeItem = (index) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border border-[var(--line)] bg-[var(--sunk)] p-2.5"
        >
          {itemSchema.type === "object" ? (
            <div className="flex flex-col gap-2">
              {Object.entries(itemSchema.properties || {}).map(([key, property]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[color-mix(in_srgb,var(--chalk)_45%,transparent)]">
                    {property.title || key.replaceAll("_", " ")}
                  </span>
                  <ScalarInput
                    schema={property}
                    label={property.title || key.replaceAll("_", " ")}
                    value={item?.[key] ?? createEmptyValue(property)}
                    onChange={(nextValue) =>
                      updateItem(index, { ...item, [key]: nextValue })
                    }
                  />
                </label>
              ))}
            </div>
          ) : (
            <ScalarInput
              schema={itemSchema}
              label={`${label} ${index + 1}`}
              value={item}
              onChange={(nextValue) => updateItem(index, nextValue)}
            />
          )}
          <button
            type="button"
            onClick={() => removeItem(index)}
            aria-label={`Remove ${label} ${index + 1}`}
            className="mt-2 text-[10px] font-semibold text-red-300/70 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      ))}
      {items.length < maxItems && (
        <button
          type="button"
          onClick={() => onChange([...items, createEmptyValue(itemSchema)])}
          aria-label={`Add ${label}`}
          className="rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-xs font-semibold text-[color-mix(in_srgb,var(--chalk)_45%,transparent)] hover:border-[color-mix(in_srgb,var(--line-hi)_30%,transparent)] hover:text-[var(--chalk)]"
        >
          + Add
        </button>
      )}
    </div>
  );
}

export default function ModelParameterControls({
  inputs,
  values,
  onChange,
  open,
  onToggle,
}) {
  if (inputs.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={promptControlClassName({ active: open })}
      >
        <span className="text-[10px] font-black text-primary/80">PARAMS</span>
        <span className={PROMPT_CONTROL_LABEL_CLASS}>{inputs.length}</span>
        <PromptChevronIcon />
      </button>
      {open && (
        <PromptPopover
          onClick={(event) => event.stopPropagation()}
          className="w-[min(420px,calc(100vw-2rem))] max-h-[60vh]"
        >
          <PromptPopoverHeader>Model parameters</PromptPopoverHeader>
          <div className="flex flex-col gap-4">
            {inputs.map(({ key, schema }) => (
              <div key={key} className="flex flex-col gap-2">
                <div className={schema.type === "boolean" ? "flex items-center justify-between gap-4" : "flex flex-col gap-2"}>
                  <FieldLabel schema={schema} inputKey={key} />
                  {schema.type === "array" ? (
                    <ArrayInput
                      schema={schema}
                      label={schema.title || key.replaceAll("_", " ")}
                      value={values[key]}
                      onChange={(nextValue) => onChange(key, nextValue)}
                    />
                  ) : (
                    <ScalarInput
                      schema={schema}
                      label={schema.title || key.replaceAll("_", " ")}
                      value={values[key]}
                      onChange={(nextValue) => onChange(key, nextValue)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </PromptPopover>
      )}
    </div>
  );
}
