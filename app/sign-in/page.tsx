import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { PasswordField } from "@/components/PasswordField";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="view">
      <section className="hero">
        <div>
          <div className="eyebrow">Welcome Back</div>
          <h1>Continue reading.</h1>
          <p className="lead">
            Sign in to resume your progress and continue unlocking the story through your reflections.
          </p>
        </div>
        <form className="form-card" action={signIn}>
          <h3>Sign in</h3>
          {error ? <p className="warning">{error}</p> : null}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <PasswordField
            id="password"
            name="password"
            label="Password"
            required
            autoComplete="current-password"
            placeholder="Your password"
          />
          <div className="actions">
            <button className="button" type="submit">
              Sign In
            </button>
            <Link className="button-secondary" href="/sign-up">
              Create account
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
