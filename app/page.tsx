export default function Home() {
  return (
    <main className="page">
      <header className="topbar">
        <nav className="topbar__links">
          <a href="#">Gmail</a>
          <a href="#">Images</a>
          <button className="apps" aria-label="Google apps">
            ▪︎▪︎▪︎
          </button>
          <button className="sign-in">Sign in</button>
        </nav>
      </header>

      <section className="hero">
        <div className="logo" aria-label="Google logo">
          <span className="logo__g">G</span>
          <span className="logo__o1">o</span>
          <span className="logo__o2">o</span>
          <span className="logo__g2">g</span>
          <span className="logo__l">l</span>
          <span className="logo__e">e</span>
        </div>

        <div className="search">
          <span className="search__icon" aria-hidden>
            🔍
          </span>
          <input
            className="search__input"
            type="text"
            aria-label="Search"
            placeholder="Search Google or type a URL"
          />
          <span className="search__mic" aria-hidden>
            🎤
          </span>
        </div>

        <div className="actions">
          <button className="btn">Google Search</button>
          <button className="btn">I&apos;m Feeling Lucky</button>
        </div>

        <div className="lang">
          Google offered in: <a href="#">Español</a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer__row">United States</div>
        <div className="footer__row footer__links">
          <div>
            <a href="#">About</a>
            <a href="#">Advertising</a>
            <a href="#">Business</a>
            <a href="#">How Search works</a>
          </div>
          <div>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Settings</a>
          </div>
        </div>
      </footer>
    </main>
  );
}