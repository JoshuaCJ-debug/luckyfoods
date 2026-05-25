// Environment detection helper
// Determines if we are in production, development, or local dev mode

export function isProduction() {
    // Explicit NODE_ENV=production, OR Atlas connection string indicates production intent
    return (
        process.env.NODE_ENV === 'production' ||
        (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb+srv://'))
    );
}

export function isLocalDev() {
    return !isProduction();
}

export function getEnvironmentLabel() {
    if (isProduction()) return '🚀 PRODUCTION';
    return '🖥️  LOCAL DEV';
}