import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
    DEFAULT_PREFERENCES,
    PreferencesAPI,
    normalizePreferences,
    preparePreferencesForSave,
} from "../services/preferences";

const UserPreferencesContext = createContext(null);

export function UserPreferencesProvider({ children }) {
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const loadPreferences = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");

        try {
            setPreferences(await PreferencesAPI.get());
        } catch (error) {
            console.error("Failed to load user preferences", error);
            setPreferences(DEFAULT_PREFERENCES);
            setErrorMessage("Preferences could not be loaded. Defaults are being used.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    const savePreferences = useCallback(async (nextPreferences) => {
        const preparedPreferences = preparePreferencesForSave(nextPreferences);
        setErrorMessage("");

        try {
            const savedPreferences = await PreferencesAPI.update(preparedPreferences);
            setPreferences(savedPreferences);
            window.dispatchEvent(new Event("fridgevoid:preferences-changed"));
            return savedPreferences;
        } catch (error) {
            console.error("Failed to save user preferences", error);
            setErrorMessage("Preferences could not be saved.");
            throw error;
        }
    }, []);

    const value = useMemo(() => ({
        preferences,
        setLocalPreferences: (nextPreferences) => setPreferences(normalizePreferences(nextPreferences)),
        loading,
        errorMessage,
        reloadPreferences: loadPreferences,
        savePreferences,
    }), [errorMessage, loadPreferences, loading, preferences, savePreferences]);

    return (
        <UserPreferencesContext.Provider value={value}>
            {children}
        </UserPreferencesContext.Provider>
    );
}

export function useUserPreferences() {
    const context = useContext(UserPreferencesContext);

    if (!context) {
        return {
            preferences: DEFAULT_PREFERENCES,
            setLocalPreferences: () => {},
            loading: false,
            errorMessage: "",
            reloadPreferences: async () => {},
            savePreferences: async () => DEFAULT_PREFERENCES,
        };
    }

    return context;
}
