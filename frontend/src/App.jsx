import { useEffect, useState } from "react"
import Home from './pages/Home.jsx'
import {Navigate, Routes, Route} from "react-router-dom"
import './css/App.css'
import AppShell from "./components/AppShell.jsx";
import Navbar from './components/Navbar.jsx'
import Presets from "./pages/Presets.jsx";
import Settings from "./pages/Settings.jsx";
import LeftRail from "./components/LeftRail.jsx";
import ColorSettings from "./pages/ColorSettings.jsx";
import DevTools from "./pages/DevTools.jsx";
import BarcodeScannerDev from "./pages/BarcodeScannerDev.jsx";
import { applyUiColors, DEFAULT_THEME_COLORS, loadUiColors } from "./services/uiColors.js";

const THEME_STORAGE_KEY = "fridgevoid:theme";

function loadSavedTheme() {
    if (typeof window === "undefined") {
        return "light";
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" ? "dark" : "light";
}

function App() {
    const [theme, setTheme] = useState(loadSavedTheme);
    const [uiColors, setUiColors] = useState(DEFAULT_THEME_COLORS);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        applyUiColors(uiColors, theme);
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme, uiColors]);

    useEffect(() => {
        const handleUiColorsChanged = (event) => {
            if (event.detail?.colors) {
                setUiColors(event.detail.colors);
            }
        };

        window.addEventListener("fridgevoid:ui-colors-changed", handleUiColorsChanged);
        return () => window.removeEventListener("fridgevoid:ui-colors-changed", handleUiColorsChanged);
    }, []);

    useEffect(() => {
        let cancelled = false;

        loadUiColors()
            .then((colors) => {
                if (!cancelled) {
                    setUiColors(colors);
                }
            })
            .catch((error) => {
                console.warn("Theme colors could not be loaded from the backend. Using temporary defaults.", error);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const toggleTheme = () => {
        setTheme((currentTheme) => currentTheme === "light" ? "dark" : "light");
    };

    const notifyInventoryChanged = () => {
        window.dispatchEvent(new Event("fridgevoid:inventory-changed"));
    };

    return (
        <AppShell
            topBar={<Navbar theme={theme} onToggleTheme={toggleTheme} />}
            leftRail={<LeftRail onInventoryChanged={notifyInventoryChanged} />}
        >
            <div className="main-content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/presets" element={<Presets />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/colors" element={<ColorSettings activeTheme={theme} />} />
                    <Route path="/dev-tools" element={<DevTools />} />
                    <Route path="/dev-tools/barcode-scanner" element={<BarcodeScannerDev />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </AppShell>
    );

}

export default App
