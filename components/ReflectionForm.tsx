import { submitReflection } from "@/app/actions/reflections";

type ReflectionFormProps = {
  episodeId: string;
  returnPath: string;
};

const reactions = [
  {
    value: "moved",
    label: "Moved",
    description: "It landed emotionally.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10Z" />
      </svg>
    )
  },
  {
    value: "curious",
    label: "Curious",
    description: "It made you wonder.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.5 9a2.8 2.8 0 1 1 4.8 2c-1.4 1.1-2.3 1.8-2.3 3.5" />
        <path d="M12 18h.01" />
      </svg>
    )
  },
  {
    value: "disturbed",
    label: "Disturbed",
    description: "It unsettled you.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 3 20h18L12 3Z" />
        <path d="M12 8v5" />
        <path d="M12 17h.01" />
      </svg>
    )
  },
  {
    value: "confused",
    label: "Confused",
    description: "It needs clarity.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8c2-3 5-3 7 0s5 3 7 0" />
        <path d="M5 16c2-3 5-3 7 0s5 3 7 0" />
      </svg>
    )
  },
  {
    value: "inspired",
    label: "Inspired",
    description: "It pushed you forward.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v5" />
        <path d="M12 16v5" />
        <path d="M4 12h5" />
        <path d="M15 12h5" />
        <path d="M7.5 7.5 10 10" />
        <path d="M14 14l2.5 2.5" />
        <path d="M16.5 7.5 14 10" />
        <path d="M10 14l-2.5 2.5" />
      </svg>
    )
  },
  {
    value: "other",
    label: "Other",
    description: "Something else happened.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    )
  }
];

export function ReflectionForm({ episodeId, returnPath }: ReflectionFormProps) {
  return (
    <form className="form-card reflection-card" action={submitReflection}>
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <div className="eyebrow">Reflection Unlock</div>
      <h3>Tell us what stayed with you.</h3>
      <p className="hint">
        The next episode unlocks only after a reaction and a meaningful reflection.
      </p>
      <fieldset className="reaction-picker">
        <legend>Choose your reaction</legend>
        <div className="reaction-grid">
          {reactions.map((reaction, index) => (
            <label className="reaction-option" key={reaction.value}>
              <input name="reaction" type="radio" value={reaction.value} required defaultChecked={index === 0} />
              <span className="reaction-icon">{reaction.icon}</span>
              <strong>{reaction.label}</strong>
              <small>{reaction.description}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="body">What moment stayed with you most, and why?</label>
        <textarea
          id="body"
          name="body"
          required
          minLength={40}
          placeholder="Write at least 40 characters. Empty praise will not be enough."
        />
      </div>
      <div className="actions">
        <button className="button" type="submit">
          Submit Reflection & Unlock Next
        </button>
      </div>
      <style>{`
        .reflection-card {
          display: grid;
          gap: 14px;
        }

        .reaction-picker {
          border: 0;
          padding: 0;
          margin: 6px 0 0;
        }

        .reaction-picker legend {
          margin-bottom: 10px;
          color: var(--muted);
          font-size: 13px;
          font-weight: 850;
        }

        .reaction-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .reaction-option {
          position: relative;
          display: grid;
          gap: 7px;
          min-height: 132px;
          padding: 14px;
          border: 1.5px solid rgba(9, 9, 9, .14);
          border-radius: 22px;
          background: rgba(255, 254, 248, .76);
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
        }

        .reaction-option:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 26px rgba(0, 0, 0, .10);
        }

        .reaction-option input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .reaction-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1.3px solid rgba(9, 9, 9, .48);
          border-radius: 14px;
          background: var(--yellow-soft);
        }

        .reaction-icon svg {
          width: 23px;
          height: 23px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .reaction-option strong {
          line-height: 1;
        }

        .reaction-option small {
          color: var(--muted);
          line-height: 1.35;
        }

        .reaction-option:has(input:checked) {
          border-color: rgba(9, 9, 9, .72);
          background: linear-gradient(135deg, rgba(255, 210, 26, .48), rgba(255, 254, 248, .86));
          box-shadow: 0 0 0 4px rgba(255, 210, 26, .22), 0 14px 26px rgba(0, 0, 0, .10);
        }

        .reaction-option:has(input:focus-visible) {
          outline: 3px solid rgba(255, 210, 26, .44);
          outline-offset: 3px;
        }

        @media (max-width: 820px) {
          .reaction-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .reaction-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
}
