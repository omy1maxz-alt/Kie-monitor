/**
 * Cookie Parser and Header Builder
 * Supports Netscape format (cookie.txt) and standard HTTP key=value cookie strings.
 */
export class CookieAuthManager {
  private static STORAGE_KEY_COOKIE = 'kie_saved_cookie_raw';
  private static STORAGE_KEY_INTERVAL = 'kie_saved_interval_sec';
  private static STORAGE_KEY_CUSTOM_MODELS = 'kie_saved_custom_models';

  private cookieString: string = '';
  private parsedCookieCount: number = 0;

  constructor() {
    this.loadFromStorage();
  }

  public parseAndSetCookies(rawText: string): number {
    const pairs: string[] = [];
    const distinctKeys = new Set<string>();

    const lines = rawText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        // Netscape format: domain, flag, path, secure, expiration, name, value
        const name = parts[5].trim();
        const value = parts[6].trim();
        if (name) {
          pairs.push(`${name}=${value}`);
          distinctKeys.add(name);
        }
      } else if (trimmed.includes('=')) {
        // Standard header format: key=value; key2=val2
        const subTokens = trimmed.split(';');
        for (const token of subTokens) {
          const subTrimmed = token.trim();
          if (subTrimmed && subTrimmed.includes('=')) {
            const key = subTrimmed.split('=')[0].trim();
            if (key) {
              pairs.push(subTrimmed);
              distinctKeys.add(key);
            }
          }
        }
      }
    }

    this.cookieString = pairs.join('; ');
    this.parsedCookieCount = distinctKeys.size;
    return this.parsedCookieCount;
  }

  public getCookieString(): string {
    return this.cookieString;
  }

  public getCookieCount(): number {
    return this.parsedCookieCount;
  }

  public clearCookies(): void {
    this.cookieString = '';
    this.parsedCookieCount = 0;
    try {
      localStorage.removeItem(CookieAuthManager.STORAGE_KEY_COOKIE);
    } catch {}
  }

  public saveToStorage(rawText: string): void {
    try {
      localStorage.setItem(CookieAuthManager.STORAGE_KEY_COOKIE, rawText);
    } catch {}
  }

  public loadSavedRaw(): string {
    try {
      return localStorage.getItem(CookieAuthManager.STORAGE_KEY_COOKIE) || '';
    } catch {
      return '';
    }
  }

  private loadFromStorage(): void {
    const raw = this.loadSavedRaw();
    if (raw) {
      this.parseAndSetCookies(raw);
    }
  }

  public static saveInterval(seconds: number): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_INTERVAL, seconds.toString());
    } catch {}
  }

  public static getInterval(): number {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_INTERVAL);
      return saved ? parseInt(saved, 10) : 45;
    } catch {
      return 45;
    }
  }

  public static saveCustomModels(models: string[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(models));
    } catch {}
  }

  public static getCustomModels(): string[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_CUSTOM_MODELS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }
}

export const cookieAuthManager = new CookieAuthManager();
