import {
  FormControl,
  FormLabel,
  styled,
  type FormControlProps,
} from "@mui/material";

import { useEffect, useState } from "react";

const UPDATE_DELAY_MS = 100;

interface ColorInputBaseProps {
  value: string;
  onChange: (value: string) => void;
}

const SmallLabel = styled(FormLabel)({
  fontSize: "0.75rem",
  marginBottom: 4,
});

export const ColorInputBase: React.FC<ColorInputBaseProps> = ({
  value,
  onChange,
}) => {
  // value to display - updates as fast as the user moves their cursor
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Ughhhhhh
  // React breaks the dom 'onchange' event, which is the behavior I want.
  // React makes it behave the same as 'oninput', which fires constantly while the user is using the selector.
  // That breaks OBR since it creates too many API calls.
  // So work around that by debouncing the input, so it at least doesn't fire all the time
  useEffect(() => {
    const handler = setTimeout(() => {
      if (displayValue !== value) {
        onChange(displayValue);
      }
    }, UPDATE_DELAY_MS);

    return () => clearTimeout(handler); // Clear timeout if color changes within the delay
  }, [value, displayValue, onChange]);

  return (
    <label className="color-label" style={{ background: displayValue }}>
      <input
        type="color"
        value={displayValue}
        onInput={(e) => {
          setDisplayValue(e.currentTarget.value);
        }}
      />
    </label>
  );
};

export function ColorInput({
  value,
  onChange,
  ...props
}: ColorInputBaseProps & Omit<FormControlProps, "onChange">) {
  return (
    <FormControl fullWidth {...props} sx={{ alignItems: "center" }}>
      <SmallLabel>Color</SmallLabel>
      <ColorInputBase value={value} onChange={onChange} />
    </FormControl>
  );
}
