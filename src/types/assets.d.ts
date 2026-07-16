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
