export interface ParsedUA {
  browser: string;
  browserVersion: string;
  os: string;
  platform: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot';
  deviceModel: string;
}

export function parseUserAgent(ua: string | undefined | null): ParsedUA {
  const unknown: ParsedUA = { browser: 'Unknown', browserVersion: '', os: 'Unknown', platform: '', deviceType: 'desktop', deviceModel: '' };
  if (!ua) return unknown;

  if (/bot|crawler|spider|crawling|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|facebookexternalhit/i.test(ua)) {
    return { ...unknown, browser: 'Bot', deviceType: 'bot' };
  }

  const isTablet = /iPad|Android.*Tablet|Tablet.*Android/i.test(ua);
  const isMobile = !isTablet && /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(ua);
  const deviceType: ParsedUA['deviceType'] = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  // OS
  let os = 'Unknown';
  let platform = '';
  if (/Windows NT 10\.0/i.test(ua)) { os = 'Windows 10'; platform = 'Windows'; }
  else if (/Windows NT 11\.0/i.test(ua)) { os = 'Windows 11'; platform = 'Windows'; }
  else if (/Windows NT/i.test(ua)) { os = 'Windows'; platform = 'Windows'; }
  else if (/Mac OS X/i.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/i);
    os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
    platform = 'macOS';
  } else if (/Android/i.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/i);
    os = m ? `Android ${m[1]}` : 'Android';
    platform = 'Android';
  } else if (/iPhone OS|CPU OS/i.test(ua)) {
    const m = ua.match(/(?:iPhone OS|CPU OS) ([\d_]+)/i);
    os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
    platform = 'iOS';
  } else if (/Linux/i.test(ua)) { os = 'Linux'; platform = 'Linux'; }

  // Browser (order matters: Edge before Chrome, OPR before Chrome)
  let browser = 'Unknown';
  let browserVersion = '';
  const matchers: Array<[RegExp, string, RegExp]> = [
    [/Edg\//i, 'Edge', /Edg\/([\d.]+)/i],
    [/OPR\//i, 'Opera', /OPR\/([\d.]+)/i],
    [/SamsungBrowser/i, 'Samsung Browser', /SamsungBrowser\/([\d.]+)/i],
    [/Firefox\//i, 'Firefox', /Firefox\/([\d.]+)/i],
    [/Chrome\//i, 'Chrome', /Chrome\/([\d.]+)/i],
    [/Safari\//i, 'Safari', /Version\/([\d.]+)/i],
  ];
  for (const [detect, name, versionRx] of matchers) {
    if (detect.test(ua)) {
      browser = name;
      const vm = ua.match(versionRx);
      browserVersion = vm ? vm[1].split('.')[0] : '';
      break;
    }
  }

  // Device model (first parenthesis group, for mobile)
  let deviceModel = '';
  if (isMobile || isTablet) {
    const m = ua.match(/\(([^)]+)\)/);
    if (m) {
      deviceModel = m[1].split(';')[0].trim().replace(/^Linux /, '');
    }
  }

  return { browser, browserVersion, os, platform, deviceType, deviceModel };
}
