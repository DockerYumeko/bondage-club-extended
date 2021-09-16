
const encoder = new TextEncoder();

/* eslint-disable no-bitwise */
export function crc32(str: string): string {
	let crc = 0 ^ -1;
	for (const b of encoder.encode(str)) {
		let c = (crc ^ b) & 0xff;
		for (let j = 0; j < 8; j++) {
			c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
		}
		crc = (crc >>> 8) ^ c;
	}

	return ((crc ^ -1) >>> 0).toString(16).padStart(8, "0").toUpperCase();
}
/* eslint-enable no-bitwise */

/** Utility function to add CSS */
export function addStyle(styleString: string): void {
	const style = document.createElement("style");
	style.textContent = styleString;
	document.head.append(style);
}

/**
 * Waits for set amount of time, returning promes
 * @param ms The time in ms to wait for
 */
export function wait(ms: number): Promise<void> {
	return new Promise(r => setTimeout(r, ms));
}

/** Checks if the `obj` is an object (not null, not array) */
export function isObject(obj: unknown): obj is Record<string, any> {
	return !!obj && typeof obj === "object" && !Array.isArray(obj);
}

export function longestCommonPrefix(strings: string[]): string {
	if (strings.length === 0) return "";

	strings = strings.slice().sort();
	let i = 0;
	while (i < strings[0].length && strings[0][i] === strings[strings.length - 1][i]) {
		i++;
	}
	return strings[0].substring(0, i);
}

export function arrayUnique<T>(arr: T[]): T[] {
	const seen = new Set<T>();
	return arr.filter(i => !seen.has(i) && seen.add(i));
}

export function capitalizeFirstLetter(str: string): string {
	return str.charAt(0).toLocaleUpperCase() + str.slice(1);
}

/* eslint-disable no-bitwise */
export function uuidv4() {
	return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
		(c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
	);
}
/* eslint-enable no-bitwise */

export const clipboardAvailable = Boolean(navigator.clipboard);

/** Clamp number between two values */
export function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Formats time in ms into days, hours minutes and seconds - also has a short mode that only shows the largest unit, e.g. 17h */
export function formatTimeInterval(time: number, mode: "full" | "short" = "full") {
	let res = "";
	if (time < 0) {
		res = "-";
		time *= -1;
	}
	const seconds = Math.floor(time / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (mode === "full" || mode === undefined) {
		if (days > 0) {
			res += `${days} days, `;
		}
		if (hours > 0) {
			res += `${hours % 24} hours, `;
		}
		if (minutes > 0) {
			res += `${minutes % 60} minutes, `;
		}
		if (seconds > 0) {
			res += `${seconds % 60} seconds`;
		}
	} else if (mode === "short") {
		if (days > 1) {
			res += `${days}d`;
		} else if (hours > 1) {
			res += `${hours}h`;
		} else if (minutes > 1) {
			res += `${minutes}m`;
		} else if (seconds > 0) {
			res += `${seconds}s`;
		}
	}
	return res;
}