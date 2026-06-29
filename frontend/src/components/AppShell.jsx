import "../css/AppShell.css";

function AppShell({ topBar, children, leftRail }) {
    return (
        <div className="app-shell">
            <div className="app-shell-topbar">
                {topBar}
            </div>
            <div className="app-shell-body">
                <main className="app-shell-main">
                    {children}
                </main>
                <aside className="app-shell-left-rail" aria-label="Application sidebar">
                    {leftRail}
                </aside>
            </div>
        </div>
    );
}

export default AppShell;
