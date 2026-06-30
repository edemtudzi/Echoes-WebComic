import { submitReflection } from "@/app/actions/reflections";

type ReflectionFormProps = {
  episodeId: string;
  returnPath: string;
};

export function ReflectionForm({ episodeId, returnPath }: ReflectionFormProps) {
  return (
    <form className="form-card" action={submitReflection}>
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <div className="eyebrow">Reflection Unlock</div>
      <h3>Tell us what stayed with you.</h3>
      <p className="hint">
        The next episode unlocks only after a reaction and a meaningful reflection.
      </p>
      <div className="field">
        <label htmlFor="reaction">Reaction</label>
        <select id="reaction" name="reaction" required defaultValue="moved">
          <option value="moved">Moved</option>
          <option value="curious">Curious</option>
          <option value="disturbed">Disturbed</option>
          <option value="confused">Confused</option>
          <option value="inspired">Inspired</option>
          <option value="other">Other</option>
        </select>
      </div>
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
    </form>
  );
}
