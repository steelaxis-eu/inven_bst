import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

// Can be imported from a shared config
const locales = ['en', 'lv'];

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    // Validate that the incoming `locale` parameter is valid
    if (!locale || !locales.includes(locale as any)) {
        // Fallback or 404
        // If undefined, maybe use default? 
        // But middleware should ensure it.
        // Let's assume passed.
        locale = 'en'; // Safe fallback for now to prevent 404 loop
    }

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default
    };
});
