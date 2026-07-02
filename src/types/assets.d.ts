declare module '*.pdf?url' {
    const url: string;
    export default url;
}

declare module '*.pdf?inline' {
    const dataUrl: string;
    export default dataUrl;
}
