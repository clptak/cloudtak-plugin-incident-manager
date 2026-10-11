interface ImportMeta {
    glob<M>(pattern: string, options: { eager: true }): Record<string, M>;
    glob<M>(
        pattern: string,
        options: { eager: true; query: string; import: string },
    ): Record<string, M>;
}

declare module '*.pdf?url' {
    const url: string;
    export default url;
}

declare module '*.md?raw' {
    const content: string;
    export default content;
}

declare module '*.md' {
    const content: string;
    export default content;
}
