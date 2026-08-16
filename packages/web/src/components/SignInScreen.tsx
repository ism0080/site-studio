export default function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">✳</span>
          <span>
            site<span className="brand-dot">.</span>studio
          </span>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to build and publish your sites.</p>
        <button className="dark-button google-button" onClick={onSignIn}>
          <span className="google-mark">G</span> Continue with Google
        </button>
      </div>
    </div>
  );
}
