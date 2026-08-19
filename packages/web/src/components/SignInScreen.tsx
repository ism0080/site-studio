import "./SignInScreen.css";
import Brand from "./Brand.tsx";

export default function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div data-component="sign-in">
      <div data-slot="card">
        <Brand />
        <h1>Welcome back</h1>
        <p>Sign in to build and publish your sites.</p>
        <button className="dark-button" data-slot="google-button" onClick={onSignIn}>
          <span data-slot="google-mark">G</span> Continue with Google
        </button>
      </div>
    </div>
  );
}
