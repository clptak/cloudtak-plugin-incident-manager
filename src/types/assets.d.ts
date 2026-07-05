declare module '*.pdf?url' {
    const url: string;
    export default url;
}

declare module '@tak-ps/vue-hasty-team' {
    import type { Component } from 'vue';
    export const HastyTeam: Component;
}
