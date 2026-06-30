"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  name: string;
  label: string;
};

export function PasswordField({ id, name, label, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input {...inputProps} id={id} name={name} type={visible ? "text" : "password"} />
        <button
          aria-controls={id}
          aria-label={visible ? "Hide password" : "Show password"}
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
