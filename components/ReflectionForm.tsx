import { submitReflection, submitReflectionReply } from "@/app/actions/reflections";
import { query } from "@/lib/db";
import { ensureReflectionRepliesTable } from "@/lib/reflection-replies";

type ReflectionFormProps = {
  episodeId: string;
  returnPath: string;
};

type CommentRow = {
  id: string;
  display_name: string | null;
  reaction: string;
  rating: string | null;
  body: string;
  created_at: string;
};

type ReplyRow = {
  id: string;
  reflection_id: string;
  display_name: string | null;
  body: string;
  created_at: string;
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

const reactionLabels = Object.fromEntries(reactions.map((reaction) => [reaction.value, reaction.label]));
const reactionPaths = Object.fromEntries(reactions.map((reaction) => [reaction.value, reaction.path]));

function ReactionIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {path.split(" M").map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}

function displayName(name: string | null) {
  return name?.trim() || "Reader";
}

function initials(name: string | null) {
  return displayName(name).slice(0, 1).toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function repliesFor(replies: ReplyRow[], reflectionId: string) {
  return replies.filter((reply) => reply.reflection_id === reflectionId);
}

async function getPublicThread(episodeId: string) {
  let comments: CommentRow[] = [];
  let replies: ReplyRow[] = [];

  try {
    await ensureReflectionRepliesTable();

    try {
      comments = await query<CommentRow>(
        `select r.id::text,
                u.display_name,
                r.reaction,
                r.rating::text as rating,
                r.body,
                r.created_at::text
         from public.reflections r
         join public.app_users u on u.id = r.user_id
         where r.episode_id = $1 and r.moderation_status = 'approved'
         order by r.created_at desc`,
        [episodeId]
      );
    } catch {
      comments = await query<CommentRow>(
        `select r.id::text,
                u.display_name,
                r.reaction,
                null::text as rating,
                r.body,
                r.created_at::text
         from public.reflections r
         join public.app_users u on u.id = r.user_id
         where r.episode_id = $1 and r.moderation_status = 'approved'
         order by r.created_at desc`,
        [episodeId]
      );
    }

    replies = await query<ReplyRow>(
      `select rr.id::text,
              rr.reflection_id::text,
              u.display_name,
              rr.body,
              rr.created_at::text
       from public.reflection_replies rr
       join public.reflections r on r.id = rr.reflection_id
       join public.app_users u on u.id = rr.user_id
       where r.episode_id = $1
         and r.moderation_status = 'approved'
         and rr.moderation_status = 'approved'
       order by rr.created_at asc`,
      [episodeId]
    );
  } catch {
    comments = [];
    replies = [];
  }

  return { comments, replies };
}

export async function ReflectionForm({ episodeId, returnPath }: ReflectionFormProps) {
  const { comments, replies } = await getPublicThread(episodeId);

  return (
    <section className="comment-module" id="comments">
      <form className="form-card reflection-card comment-composer" action={submitReflection}>
        <input type="hidden" name="episodeId" value={episodeId} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <div className="reflection-head">
          <div>
            <div className="eyebrow">Join the conversation</div>
            <h3>React, rate, and post your public comment.</h3>
          </div>
          <span>You get +40 pts</span>
        </div>
        <p className="hint">Your reflection appears below for other readers to see and reply to.</p>

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
            placeholder="Example: The moment where Kael... because it made me think about..."
          />
          <span className="hint">Specific comments unlock the story and help shape future episodes.</span>
        </div>
        <div className="actions reflection-actions">
          <button className="button" type="submit">
            Post Comment & Unlock Next
          </button>
        </div>
      </form>

      <div className="comment-feed" aria-label="Public reader comments">
        <div className="comment-feed-head">
          <div>
            <div className="eyebrow">Reader Comments</div>
            <h3>Public reactions and replies</h3>
          </div>
          <span>{comments.length} comment{comments.length === 1 ? "" : "s"}</span>
        </div>

        {comments.length ? (
          <div className="comment-list">
            {comments.map((comment) => {
              const commentReplies = repliesFor(replies, comment.id);
              const reactionPath = reactionPaths[comment.reaction] ?? reactionPaths.other;

              return (
                <article className="social-comment" key={comment.id}>
                  <div className="comment-avatar" aria-hidden="true">{initials(comment.display_name)}</div>
                  <div className="comment-bubble">
                    <div className="comment-topline">
                      <div>
                        <strong>{displayName(comment.display_name)}</strong>
                        <small>{formatDate(comment.created_at)}</small>
                      </div>
                      <span className="comment-reaction">
                        <ReactionIcon path={reactionPath} />
                        {reactionLabels[comment.reaction] ?? "Reaction"}
                        {comment.rating ? ` / ${comment.rating}/5` : ""}
                      </span>
                    </div>
                    <p>{comment.body}</p>

                    <div className="reply-thread">
                      {commentReplies.map((reply) => (
                        <div className="reply-comment" key={reply.id}>
                          <div className="comment-avatar small" aria-hidden="true">{initials(reply.display_name)}</div>
                          <div>
                            <strong>{displayName(reply.display_name)}</strong>
                            <small>{formatDate(reply.created_at)}</small>
                            <p>{reply.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <details className="reply-composer">
                      <summary>Reply{commentReplies.length ? ` (${commentReplies.length})` : ""}</summary>
                      <form action={submitReflectionReply}>
                        <input type="hidden" name="reflectionId" value={comment.id} />
                        <input type="hidden" name="episodeId" value={episodeId} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <textarea name="body" required placeholder={`Reply to ${displayName(comment.display_name)}...`} />
                        <button className="button-small" type="submit">Post Reply</button>
                      </form>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-comments">
            <div className="eyebrow">No comments yet</div>
            <p>Be the first reader to leave a public reflection for this episode.</p>
          </div>
        )}
      </div>

      <style>{`
        .comment-module{display:grid;gap:18px}.reflection-card{display:grid;gap:14px}.reflection-head{display:flex;align-items:start;justify-content:space-between;gap:16px}.reflection-head h3{margin-bottom:0}.reflection-head span,.comment-feed-head>span{white-space:nowrap;border:1px solid rgba(9,9,9,.58);border-radius:999px;background:var(--yellow);padding:8px 12px;font-size:12px;font-weight:950}.reaction-picker,.rating-picker{border:0;padding:0;margin:0}.reaction-picker legend,.rating-picker legend{margin-bottom:8px;color:var(--muted);font-size:13px;font-weight:850}.compact-reactions{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.reaction-option{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;min-height:48px;padding:9px 10px;border:1.5px solid rgba(9,9,9,.14);border-radius:999px;background:rgba(255,254,248,.78);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}.reaction-option:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(0,0,0,.09)}.reaction-option input,.rating-option input{position:absolute;opacity:0;pointer-events:none}.reaction-icon{width:25px;height:25px;display:grid;place-items:center;border:1.2px solid rgba(9,9,9,.42);border-radius:10px;background:var(--yellow-soft);flex:0 0 auto}.reaction-icon svg,.comment-reaction svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.reaction-option strong{font-size:13px;line-height:1}.reaction-option:has(input:checked),.rating-option:has(input:checked){border-color:rgba(9,9,9,.72);background:linear-gradient(135deg,rgba(255,210,26,.58),rgba(255,254,248,.9));box-shadow:0 0 0 3px rgba(255,210,26,.22)}.reaction-option:has(input:focus-visible),.rating-option:has(input:focus-visible){outline:3px solid rgba(255,210,26,.44);outline-offset:3px}.rating-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.rating-option{position:relative;display:grid;place-items:center;gap:3px;min-height:58px;padding:8px;border:1.5px solid rgba(9,9,9,.14);border-radius:18px;background:rgba(255,254,248,.78);cursor:pointer}.rating-option span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--yellow-soft);border:1px solid rgba(9,9,9,.42);font-weight:950}.rating-option small{color:var(--muted);font-size:11px;font-weight:850}.reflection-field textarea{min-height:98px}.reflection-actions{margin-top:4px}.comment-feed{display:grid;gap:14px;padding:clamp(16px,3vw,24px);border:1.5px solid rgba(9,9,9,.14);border-radius:var(--radius-xl);background:rgba(255,254,248,.82);box-shadow:var(--shadow-soft)}.comment-feed-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.comment-feed-head h3{margin:0}.comment-list{display:grid;gap:14px}.social-comment{display:grid;grid-template-columns:44px minmax(0,1fr);gap:11px}.comment-avatar{width:44px;height:44px;display:grid;place-items:center;border:1.5px solid rgba(9,9,9,.6);border-radius:50%;background:var(--yellow);box-shadow:var(--control-raised);font-weight:950}.comment-avatar.small{width:30px;height:30px;font-size:12px;box-shadow:none}.comment-bubble{display:grid;gap:10px;padding:13px 14px;border:1px solid rgba(9,9,9,.12);border-radius:24px;background:rgba(247,245,235,.76)}.comment-topline{display:flex;align-items:start;justify-content:space-between;gap:10px}.comment-topline strong,.reply-comment strong{display:block;line-height:1.1}.comment-topline small,.reply-comment small{display:block;margin-top:2px;color:var(--dim);font-size:11px;font-weight:800}.comment-reaction{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:1px solid rgba(9,9,9,.24);border-radius:999px;background:rgba(255,210,26,.24);padding:6px 9px;font-size:12px;font-weight:900}.comment-bubble p,.reply-comment p,.empty-comments p{margin:0;color:var(--muted);line-height:1.45}.reply-thread{display:grid;gap:8px}.reply-comment{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;padding:9px;border-left:3px solid var(--yellow);border-radius:16px;background:rgba(255,254,248,.72)}.reply-composer summary{width:max-content;list-style:none;cursor:pointer;color:var(--ink);font-size:12px;font-weight:950}.reply-composer summary::-webkit-details-marker{display:none}.reply-composer form{display:grid;gap:8px;margin-top:8px}.reply-composer textarea{min-height:70px;width:100%;resize:vertical;border:1.5px solid rgba(9,9,9,.18);border-radius:18px;background:rgba(255,254,248,.88);padding:10px 12px;outline:none}.reply-composer .button-small{justify-self:start}.empty-comments{padding:16px;border:1px dashed rgba(9,9,9,.22);border-radius:24px;background:rgba(247,245,235,.6)}@media(max-width:980px){.compact-reactions{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:560px){.compact-reactions,.rating-row{grid-template-columns:repeat(2,minmax(0,1fr))}.reaction-option{justify-content:flex-start}.reflection-head,.comment-feed-head,.comment-topline{align-items:start;flex-direction:column}.reflection-head span,.comment-feed-head>span{width:fit-content}.social-comment{grid-template-columns:36px minmax(0,1fr);gap:9px}.comment-avatar{width:36px;height:36px}.comment-bubble{border-radius:20px;padding:11px}.comment-reaction{white-space:normal}}`}</style>
    </section>
  );
}
