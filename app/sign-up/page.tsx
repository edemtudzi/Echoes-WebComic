import Link from "next/link";
import { signUp } from "@/app/actions/auth";

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="view">
      <section className="hero">
        <div>
          <div className="eyebrow">Reader Access</div>
          <h1>Create your account.</h1>
          <p className="lead">
            Account access lets the platform save your reading progress, reflections, and unlocked episodes.
          </p>
        </div>
        <form className="form-card" action={signUp}>
          <h3>Create account</h3>
          {error ? <p className="warning">{error}</p> : null}
          <div className="field">
            <label htmlFor="displayName">Reader name</label>
            <input id="displayName" name="displayName" required placeholder="Your name" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Enter Library
            </button>
            <Link className="button-secondary" href="/sign-in">
              I already have an account
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
