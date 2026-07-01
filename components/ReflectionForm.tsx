import { submitReflection } from "@/app/actions/reflections";

type ReflectionFormProps = {
  episodeId: string;
  returnPath: string;
};

const reactions = [
  { value: "moved", label: "Moved", path: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10Z" },
  { value: "curious", label: "Curious", path: "M9.5 9a2.8 2.8 0 1 1 4.8 2c-1.4 1.1-2.3 1.8-2.3 3.5 M12 18h.01" },
  { value: "disturbed", label: "Disturbed", path: "M12 3 3 20h18L12 3Z M12 8v5 M12 17h.01" },
  { value: "confused", label: "Confused", path: "M5 8c2-3 5-3 7 0s5 3 7 0 M5 16c2-3 5-3 7 0s5 3 7 0" },
  { value: "inspired", label: "Inspired", path: "M12 3v5 M12 16v5 M4 12h5 M15 12h5 M7.5 7.5 10 10 M14 14l2.5 2.5 M16.5 7.5 14 10 M10 14l-2.5 2.5" },
  { value: "other", label: "Other", path: "M12 5v14 M5 12h14" }
];

const ratings = [
  { value: 5, label: "Excellent" },
  { value: 4, label: "Strong" },
  { value: 3, label: "Good" },
  { value: 2, label: "Okay" },
  { value: 1, label: "Weak" }
];

function ReactionIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {path.split(" M").map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}

export function ReflectionForm({ episodeId, returnPath }: ReflectionFormProps) {
  return (
    <form className="form-card reflection-card" action={submitReflection}>
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <div className="reflection-head">
        <div>
          <div className="eyebrow">Unlock the next episode</div>
          <h3>React, rate, then say what stayed with you.</h3>
        </div>
        <span>You get +40 pts</span>
      </div>
      <p className="hint">Quick reaction first. The reflection can be honest, short, and specific.</p>

      <fieldset className="reaction-picker compact-picker">
        <legend>How did this episode hit you?</legend>
        <div className="reaction-grid compact-reactions">
          {reactions.map((reaction, index) => (
            <label className="reaction-option" key={reaction.value} title={reaction.label}>
              <input name="reaction" type="radio" value={reaction.value} required defaultChecked={index === 0} />
              <span className="reaction-icon"><ReactionIcon path={reaction.path} /></span>
              <strong>{reaction.label}</strong>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rating-picker">
        <legend>Rate the episode</legend>
        <div className="rating-row">
          {ratings.map((rating) => (
            <label className="rating-option" key={rating.value}>
              <input name="rating" type="radio" value={rating.value} required defaultChecked={rating.value === 5} />
              <span>{rating.value}</span>
              <small>{rating.label}</small>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field reflection-field">
        <label htmlFor="body">What moment stayed with you most?</label>
        <textarea
          id="body"
          name="body"
          required
          minLength={40}
          placeholder="Example: The moment where Kael... because it made me think about..."
        />
        <span className="hint">Specific reflections unlock the story and help shape future episodes.</span>
      </div>
      <div className="actions reflection-actions">
        <button className="button" type="submit">
          Submit & Unlock Next
        </button>
      </div>
      <style>{`
        .reflection-card{display:grid;gap:14px}.reflection-head{display:flex;align-items:start;justify-content:space-between;gap:16px}.reflection-head h3{margin-bottom:0}.reflection-head span{white-space:nowrap;border:1px solid rgba(9,9,9,.58);border-radius:999px;background:var(--yellow);padding:8px 12px;font-size:12px;font-weight:950}.reaction-picker,.rating-picker{border:0;padding:0;margin:0}.reaction-picker legend,.rating-picker legend{margin-bottom:8px;color:var(--muted);font-size:13px;font-weight:850}.compact-reactions{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.reaction-option{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;min-height:48px;padding:9px 10px;border:1.5px solid rgba(9,9,9,.14);border-radius:999px;background:rgba(255,254,248,.78);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}.reaction-option:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(0,0,0,.09)}.reaction-option input,.rating-option input{position:absolute;opacity:0;pointer-events:none}.reaction-icon{width:25px;height:25px;display:grid;place-items:center;border:1.2px solid rgba(9,9,9,.42);border-radius:10px;background:var(--yellow-soft);flex:0 0 auto}.reaction-icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.reaction-option strong{font-size:13px;line-height:1}.reaction-option:has(input:checked),.rating-option:has(input:checked){border-color:rgba(9,9,9,.72);background:linear-gradient(135deg,rgba(255,210,26,.58),rgba(255,254,248,.9));box-shadow:0 0 0 3px rgba(255,210,26,.22)}.reaction-option:has(input:focus-visible),.rating-option:has(input:focus-visible){outline:3px solid rgba(255,210,26,.44);outline-offset:3px}.rating-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.rating-option{position:relative;display:grid;place-items:center;gap:3px;min-height:58px;padding:8px;border:1.5px solid rgba(9,9,9,.14);border-radius:18px;background:rgba(255,254,248,.78);cursor:pointer}.rating-option span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--yellow-soft);border:1px solid rgba(9,9,9,.42);font-weight:950}.rating-option small{color:var(--muted);font-size:11px;font-weight:850}.reflection-field textarea{min-height:98px}.reflection-actions{margin-top:4px}@media(max-width:980px){.compact-reactions{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:560px){.compact-reactions,.rating-row{grid-template-columns:repeat(2,minmax(0,1fr))}.reaction-option{justify-content:flex-start}.reflection-head{flex-direction:column}.reflection-head span{width:fit-content}}`}</style>
    </form>
  );
}
