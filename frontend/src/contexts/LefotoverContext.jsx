import { createContext, useState, useContext, useEffect } from "react";

const LeftoverContext = createContext();

export const useLeftoverContext = () => useContext(LeftoverContext);

export const LeftoverProvider = ({ children }) => {
    const [sortOrder, setSortOrder] = useState("date"); // default sort

    // Load saved sort order from localStorage
    useEffect(() => {
        const storedSort = localStorage.getItem("sortOrder");
        if (storedSort) setSortOrder(storedSort);
    }, []);

    // Save sort order to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem("sortOrder", sortOrder);
    }, [sortOrder]);

    const changeSortOrder = (order) => {
        setSortOrder(order);
    };

    const value = {
        sortOrder,
        changeSortOrder,
    };

    return (
        <LeftoverContext.Provider value={value}>
            {children}
        </LeftoverContext.Provider>
    );
};