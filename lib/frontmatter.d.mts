export function parse(md: string): { data: Record<string, unknown>; body: string };
export function stringify(data: Record<string, unknown>, body: string): string;
export function getSection(body: string, heading: string): string;
export function setSection(body: string, heading: string, text: string): string;
