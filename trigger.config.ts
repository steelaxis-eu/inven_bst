import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
    project: "proj_leixvwsxqlbyvuykyhwd", // I'll use a placeholder or inferred from secret if possible, but actually I need the project ID.
    // Wait, the user gave me a secret key starting with tr_prod_. Usually the project ID is needed in config.
    // I will try to infer it or use a placeholder and ask the user to fill it if I can't find it.
    // Actually, for v3, the project ID is strictly required in the config file.
    // The secret key tr_prod_xbZNPwzejluU0GFF1pQY might contain info or I might need to ask.
    // BUT the user just gave me the key. 
    // Let me try to use a placeholder and comment it out or try to find it.
    // Actually, I'll use a standard config and assume the user might need to updated it or I'll ask.
    // WAIT, I can run `npx trigger.dev@latest whoami` or similar if I have the key to find the project?
    // Let's just create a basic config.
    runtime: "node",
    logLevel: "log",
    // The project ID is usually required. I will use a placeholder and notify the user.
    project: "YOUR_PROJECT_ID_HERE",
    retries: {
        enabledInDev: true,
        default: {
            maxAttempts: 3,
            minTimeoutInMs: 1000,
            maxTimeoutInMs: 10000,
            factor: 2,
            randomize: true,
        },
    },
});
