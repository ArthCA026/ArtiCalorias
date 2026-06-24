import { useEffect, useRef, useState } from "react";

interface DecimalInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange" | "inputMode" | "pattern"
  > {
  value: number | "";
  onChange: (v: number | "") => void;
  /** "decimal" shows a decimal-capable keypad on iOS; "numeric" shows digits only. Defaults to "decimal". */
  inputMode?: "decimal" | "numeric";
}

/**
 * Drop-in replacement for `<input type="number">` that works correctly on iOS
 * Safari by using `type="text" inputMode="decimal"`.
 *
 * Manages an internal raw string so intermediate states like "1." are preserved
 * while the user is still typing. Normalises the value (comma → dot) and calls
 * `onChange` with a parsed number for every valid complete entry, and on blur.
 */
export function DecimalInput({
  value,
  onChange,
  inputMode = "decimal",
  ...rest
}: DecimalInputProps) {
  const [raw, setRaw] = useState(() =>
    value === "" ? "" : String(value)
  );

  // Track the last value we committed so we can distinguish external resets
  // from our own onChange-triggered re-renders.
  const committed = useRef<number | "">(value);

  useEffect(() => {
    // Only sync raw from the prop when the value changed from outside
    // (i.e. not triggered by our own onChange call).
    if (value !== committed.current) {
      committed.current = value;
      setRaw(value === "" ? "" : String(value));
    }
  }, [value]);

  const pattern =
    inputMode === "decimal" ? "[0-9]*[.,]?[0-9]*" : "[0-9]*";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;

    // Reject anything that doesn't look like a partial decimal / integer
    if (v !== "" && !new RegExp(`^${pattern}$`).test(v)) return;

    setRaw(v);

    if (v === "") {
      committed.current = "";
      onChange("");
      return;
    }

    // Normalise comma → dot for European locales
    const normalised = v.replace(",", ".");

    // Don't fire onChange for trailing separators ("1." / "1,") — wait for more
    if (normalised.endsWith(".")) return;

    const n = parseFloat(normalised);
    if (!isNaN(n)) {
      committed.current = n;
      onChange(n);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const normalised = raw.replace(",", ".");
    const n = parseFloat(normalised);

    if (raw === "" || raw === "." || raw === ",") {
      setRaw("");
      committed.current = "";
      onChange("");
    } else if (!isNaN(n)) {
      const clean = String(n);
      setRaw(clean);
      committed.current = n;
      onChange(n);
    } else {
      // Revert to last committed value
      setRaw(committed.current === "" ? "" : String(committed.current));
    }

    // Forward the event in case a parent supplied an onBlur
    rest.onBlur?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={inputMode}
      pattern={pattern}
      value={raw}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
