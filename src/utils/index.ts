export * as discord from "./discord";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
