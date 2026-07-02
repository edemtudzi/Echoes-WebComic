"use client";

import { useEffect, useState } from "react";

type LoaderState = {
  active: boolean;
  message: string;
};

export function GlobalFormLoader() {
  const [state, setState] = useState<LoaderState>({ active: false, message: "Uploading..." });

  useEffect(() => {
    function stopLoader() {
      setState((current) => ({ ...current, active: false }));
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const fileInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]'));

      if (!fileInputs.length) {
        return;
      }

      const hasSelectedFile = fileInputs.some((input) => Boolean(input.files?.length));

      if (!hasSelectedFile) {
        return;
      }

      setState({
        active: true,
        message: form.dataset.uploadMessage || "Uploading image to Cloudinary..."
      });
    }

    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", stopLoader);
    window.addEventListener("focus", stopLoader);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", stopLoader);
      window.removeEventListener("focus", stopLoader);
    };
  }, []);

  if (!state.active) {
    return null;
  }

  return (
    <div className="global-upload-loader" role="status" aria-live="assertive" aria-label="Upload in progress">
      <div className="global-upload-loader-card">
        <span className="global-upload-spinner" aria-hidden="true" />
        <strong>{state.message}</strong>
        <p>Keep this tab open. Large PNG files can take a moment.</p>
      </div>
      <style>{`
        .global-upload-loader {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(0, 0, 0, .64);
          backdrop-filter: blur(10px);
        }

        .global-upload-loader-card {
          width: min(420px, 100%);
          display: grid;
          justify-items: center;
          gap: 12px;
          padding: 28px;
          border: 1.5px solid rgba(255, 212, 71, .62);
          border-radius: 28px;
          color: #fffdf7;
          background: rgba(9, 9, 9, .92);
          box-shadow: 0 28px 80px rgba(0, 0, 0, .42);
          text-align: center;
        }

        .global-upload-loader-card strong {
          font-size: 18px;
          line-height: 1.2;
        }

        .global-upload-loader-card p {
          margin: 0;
          color: rgba(255, 253, 247, .78);
        }

        .global-upload-spinner {
          width: 46px;
          height: 46px;
          border: 4px solid rgba(255, 255, 255, .22);
          border-top-color: #ffd447;
          border-radius: 999px;
          animation: global-upload-spin .72s linear infinite;
        }

        @keyframes global-upload-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
