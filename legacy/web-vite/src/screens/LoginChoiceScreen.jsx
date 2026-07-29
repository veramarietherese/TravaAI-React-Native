export default function LoginChoiceScreen({ onUser, onAgency, onAdmin }) {
  return (
    <div className="scroll-area login-choice-screen">
      <header className="login-header">
        <h1>Welcome to TravaAI</h1>
        <p>Choose how you want to continue</p>
      </header>

      <section className="login-options">
        <button className="login-card lavender" type="button" onClick={onUser}>
          <strong>Regular user</strong>
          <small>Browse trips, save favorites</small>
        </button>

        <button className="login-card pink" type="button" onClick={onAgency}>
          <strong>Travel agency</strong>
          <small>Manage tour packages & AI drafts</small>
        </button>

        <button className="login-card softblue" type="button" onClick={onAdmin}>
          <strong>Admin</strong>
          <small>Site settings and reports</small>
        </button>
      </section>
    </div>
  )
}
