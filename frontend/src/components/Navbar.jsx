import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from "react";
import "../css/Navbar.css";

function Navbar({ theme, onToggleTheme }) {
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();

    const handleSearchSubmit = (event) => {
        event.preventDefault();
    };

    const handleSearchChange = (event) => {
        const nextQuery = event.target.value;
        setSearchQuery(nextQuery);
        const trimmedQuery = nextQuery.trim();
        navigate(trimmedQuery ? `/?q=${encodeURIComponent(trimmedQuery)}` : "/", { replace: true });
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setSearchQuery(params.get("q") || "");
    }, [location.search]);

    return (
        <header className="navbar">
            <div className="navbar-brand">
                <Link to="/">
                    <img
                        src="/fridgevoid.png"
                        alt="FridgeVoid logo"
                        className="nav-logo"
                    />
                </Link>
                <div className="nav-brand-copy">
                    <Link to="/" className="nav-title">FridgeVoid</Link>
                    <span className="nav-tagline">What's in your fridge?</span>
                </div>
            </div>

            <form className="navbar-search" onSubmit={handleSearchSubmit}>
                <input
                    type="search"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search inventory"
                    aria-label="Search inventory"
                />
            </form>

            <div className="navbar-actions">
                <Link to="/" className="nav-home-link">Home</Link>
                <button
                    type="button"
                    className="theme-toggle"
                    onClick={onToggleTheme}
                    aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                    aria-pressed={theme === "dark"}
                >
                    <span className="toggle-track">
                        <span className="toggle-thumb">
                            <svg className="icon-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5"></circle>
                                <line x1="12" y1="1" x2="12" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="23"></line>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                <line x1="1" y1="12" x2="3" y2="12"></line>
                                <line x1="21" y1="12" x2="23" y2="12"></line>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                            </svg>
                            <svg className="icon-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                        </span>
                    </span>
                </button>
            </div>
        </header>
    );
}

export default Navbar;
