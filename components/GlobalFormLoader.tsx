"use client";

import { useEffect } from "react";

function isUploadForm(form: HTMLFormElement) {
  const fileInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]'));
  return fileInputs.some((input) => Boolean(input.files?.length));
}

function getSubmitButton(event: SubmitEvent, form: HTMLFormElement) {
  const submitter = event.submitter;

  if (submitter instanceof HTMLButtonElement) {
    return submitter;
  }

  if (submitter instanceof HTMLInputElement && submitter.type === "submit") {
    return submitter;
  }

  return form.querySelector<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"]');
}

function resetUploadButtons() {
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(".upload-button-loading").forEach((button) => {
    const originalLabel = button.dataset.originalLabel;

    button.classList.remove("upload-button-loading");
    button.removeAttribute("aria-busy");
    button.disabled = false;

    if (originalLabel) {
      if (button instanceof HTMLInputElement) {
        button.value = originalLabel;
      } else {
        button.textContent = originalLabel;
      }
    }
  });
}

export function GlobalFormLoader() {
  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target;

      if (!(form instanceof HTMLFormElement) || !isUploadForm(form)) {
        return;
      }

      const button = getSubmitButton(event, form);

      if (!button) {
        return;
      }

      const originalLabel = button instanceof HTMLInputElement ? button.value : button.textContent?.trim();
      button.dataset.originalLabel = originalLabel || "Upload";
      button.classList.add("upload-button-loading");
      button.setAttribute("aria-busy", "true");
      button.disabled = true;

      if (button instanceof HTMLInputElement) {
        button.value = "Uploading...";
      } else {
        button.textContent = "Uploading...";
      }

      window.setTimeout(() => {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = button instanceof HTMLButtonElement ? "Still uploading..." : button.textContent;
        }
      }, 45000);
    }

    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", resetUploadButtons);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", resetUploadButtons);
    };
  }, []);

  return (
    <style>{`
      .upload-button-loading {
        position: relative;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        gap: 8px;
        opacity: .82;
        cursor: progress !important;
      }

      .upload-button-loading::before {
        content: "";
        width: 14px;
        height: 14px;
        flex: 0 0 auto;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 999px;
        animation: upload-button-spin .72s linear infinite;
      }

      @keyframes upload-button-spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  );
}
