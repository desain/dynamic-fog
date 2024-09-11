import TextField, { TextFieldProps } from "@mui/material/TextField";
import { forwardRef, useLayoutEffect, useState } from "react";

type NumberFieldProps = Omit<TextFieldProps, "value" | "onChange"> & {
  value: number;
  onChange: (value: number) => void;
  textToNumber?: (value: string) => number;
  numberToText?: (value: number) => string;
  onInputChange?: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  min?: number;
  max?: number;
  step?: number;
  shiftMultiplier?: number;
};

const NumberField = forwardRef<HTMLDivElement, NumberFieldProps>(
  ({ value, onChange, min, max, onInputChange, ...props }, ref) => {
    const numberToText =
      props.numberToText ?? ((value) => `${value.toFixed(2)}`);
    const textToNumber = props.textToNumber ?? ((value) => parseFloat(value));
    const step = props.step ?? 1;
    const shiftMultiplier = props.shiftMultiplier ?? 10;

    const {
      numberToText: _,
      textToNumber: __,
      step: ___,
      shiftMultiplier: ____,
      ...rest
    } = props;

    const [localValue, setLocalValue] = useState(numberToText(value));
    const [prevValidValue, setPrevValidValue] = useState(value);

    useLayoutEffect(() => {
      setLocalValue(numberToText(value));
    }, [value]);

    function isValid(number: number) {
      return !isNaN(number);
    }

    function clamp(number: number) {
      number = Math.max(number, min ?? Number.MIN_SAFE_INTEGER);
      number = Math.min(number, max ?? Number.MAX_SAFE_INTEGER);
      return number;
    }

    function handleChange(
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) {
      const newValue = event.target.value;
      if (/^(-|\+)?([0-9])*(\.)?([0-9])*$/.test(newValue)) {
        setLocalValue(newValue);
      }
      onInputChange?.(event);
    }

    function commitChange() {
      const value = textToNumber(localValue);
      if (isValid(value)) {
        const number = clamp(value);
        setPrevValidValue(number);
        onChange(number);
        setLocalValue(numberToText(number));
      } else {
        setLocalValue(numberToText(prevValidValue));
      }
    }

    function handleBlur(
      event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>
    ) {
      commitChange();
      props.onBlur?.(event);
    }

    function handleKeyUp(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.key === "Enter") {
        commitChange();
      }
      props.onKeyUp?.(event);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.key === "Escape") {
        if (event.target instanceof HTMLElement) {
          event.target.blur();
        }
      }

      let addition = 0;
      const multiplier = event.shiftKey ? shiftMultiplier : 1;
      if (event.key === "ArrowUp") {
        addition = step * multiplier;
        event.preventDefault();
      } else if (event.key === "ArrowDown") {
        addition = step * multiplier * -1;
        event.preventDefault();
      }

      if (addition) {
        let number = textToNumber(localValue);
        if (!isNaN(number)) {
          number = clamp(number + addition);
          setPrevValidValue(number);
          onChange(number);
          setLocalValue(numberToText(number));
        }
      }

      props.onKeyDown?.(event);
    }
    return (
      <TextField
        inputMode="numeric"
        {...rest}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyUp={handleKeyUp}
        onKeyDown={handleKeyDown}
        ref={ref}
      />
    );
  }
);

export default NumberField;
