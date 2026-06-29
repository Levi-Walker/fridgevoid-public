export const DEFAULT_LOCATION_NAMES = ["Fridge", "Freezer", "Pantry"];

export function getDefaultLocation() {
    return "Fridge";
}

export function getLocationNameList(locations = []) {
    return locations.map((location) => location.name);
}

export function getDefaultLocationNames() {
    return [...DEFAULT_LOCATION_NAMES];
}
