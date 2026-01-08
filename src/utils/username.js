// utils/username.js
export function normalizeUsername(raw) {
    if (!raw) return null;
    // keep letters, numbers, dot, underscore, hyphen; lowercase; trim; max 50
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    return cleaned.slice(0, 50) || null;
}
