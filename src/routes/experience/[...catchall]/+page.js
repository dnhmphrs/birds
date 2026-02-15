export const prerender = false;  // Disable prerendering for this route

export function load({ params }) {
    return {
        experience: params.catchall
    };
} 