"use client";

import { useFormStatus } from "react-dom";

export function ReflectionSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Posting & unlocking..." : "Post Comment & Unlock Next"}
    </button>
  );
}
