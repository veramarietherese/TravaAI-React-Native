import { useState } from "react";
import { supabase } from "./supabaseClient";
import onboarding1 from "../assets/onboarding-1.gif";
import onboarding2 from "../assets/onboarding-2.gif";
import "./AuthScreen.css";

export default function AuthScreen() {
  const [screen, setScreen] = useState(0);
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [userType, setUserType] = useState("Traveler");
  const [errorMessage, setErrorMessage] = useState("");

  const nextScreen = () => {
    if (screen < 2) setScreen((current) => current + 1);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: userType, // Saving 'Traveler' or 'Agency' in metadata as a backup flag
        },
      },
    });

    if (authError) {
      setErrorMessage(authError.message);
      return;
    }

    if (authData?.user) {
      const userId = authData.user.id;

      // 2. ALWAYS insert into public.users so they can create trips!
      const { error: dbError } = await supabase.from("users").insert([
        {
          user_id: userId, // Ensure this matches your column name (user_id vs id)
          email,
          full_name: name || "New User",
          user_type: userType, // Saves "Traveler" or "Agency"
        },
      ]);

      if (dbError) {
        setErrorMessage(
          "Account created, but baseline profile failed: " + dbError.message,
        );
        return;
      }

      // 3. EXTRA STEP: If they are an agency, create their row in her table too
      if (userType === "Agency") {
        // ⚠️ Replace 'travel_agencies' and column names with her exact schema
        const { error: agencyError } = await supabase
          .from("travel_agencies")
          .insert([
            {
              owner_user_id: userId, // Her foreign key linked to auth.users.id
              name: name || "New Agency",
              contact_email: email,
              rating: 0,
              // Add any other default required columns she created
            },
          ]);

        if (agencyError) {
          setErrorMessage(
            "Account created, but agency feature setup failed: " +
              agencyError.message,
          );
        }
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setErrorMessage("Error: " + error.message);
  };

  const handleAnonymousTest = async () => {
    setErrorMessage("");

    const { error } = await supabase.auth.signInAnonymously();

    if (error) setErrorMessage(error.message);
  };

  if (screen === 0) {
    return (
      <OnboardingScreen
        image={onboarding1}
        activeIndex={0}
        onNext={nextScreen}
      />
    );
  }

  if (screen === 1) {
    return (
      <OnboardingScreen
        image={onboarding2}
        activeIndex={1}
        onNext={nextScreen}
      />
    );
  }

  return (
    <main className="auth-shell login-shell">
      <section className="login-card premium-login">
        <div className="login-brand">
          <p className="eyebrow">TRAVA AI</p>
          <h1>Welcome back</h1>
          <p className="login-caption">
            Continue planning your trips with your personal AI travel workspace.
          </p>
        </div>

        <form
          className="premium-form"
          onSubmit={mode === "login" ? handleLogin : handleSignUp}
        >
          {mode === "signup" && (
            <>
              <div className="role-picker clean-role-picker">
                <button
                  type="button"
                  className={userType === "Traveler" ? "selected" : ""}
                  onClick={() => setUserType("Traveler")}
                >
                  Traveler
                </button>

                <button
                  type="button"
                  className={userType === "Agency" ? "selected" : ""}
                  onClick={() => setUserType("Agency")}
                >
                  Travel Agency
                </button>
              </div>

              <label className="clean-field">
                <span>
                  {userType === "Traveler"
                    ? "Full Name"
                    : "Agency Business Name"}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
            </>
          )}

          <label className="clean-field">
            <span>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="clean-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {mode === "login" && (
            <div className="clean-options">
              <label>
                <input type="checkbox" />
                Remember me
              </label>

              <button type="button">Forgot password?</button>
            </div>
          )}

          <button type="submit" className="premium-auth-btn">
            {mode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            className="quiet-test-btn"
            onClick={handleAnonymousTest}
          >
            Continue as test user
          </button>

          <p className="switch-mode clean-switch">
            {mode === "login" ? "New to TRAVA AI?" : "Already have an account?"}

            <button
              type="button"
              onClick={() => {
                setErrorMessage("");
                setMode(mode === "login" ? "signup" : "login");
              }}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>

          {errorMessage && <p className="auth-error">{errorMessage}</p>}
        </form>
      </section>
    </main>
  );
}

function OnboardingScreen({ image, activeIndex, onNext }) {
  return (
    <main className="auth-shell onboarding-shell" onClick={onNext}>
      <section className="onboard-card gif-card">
        <img className="onboard-gif" src={image} alt="TRAVA AI onboarding" />

        <div className="onboard-bottom">
          <div className="pager">
            {[0, 1, 2].map((item) => (
              <span
                key={item}
                className={item === activeIndex ? "active" : ""}
              />
            ))}
          </div>

          <p className="tap-copy">Tap anywhere to continue</p>
        </div>
      </section>
    </main>
  );
}
