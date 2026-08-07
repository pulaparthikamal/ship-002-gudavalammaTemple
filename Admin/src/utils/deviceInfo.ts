import type { DeviceInfo } from '@/types/auth'

function parseBrowserName(userAgent: string) {
  if (/Edg\//i.test(userAgent)) {
    return 'Edge'
  }

  if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) {
    return 'Opera'
  }

  if (/Firefox\//i.test(userAgent)) {
    return 'Firefox'
  }

  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent) && !/OPR\//i.test(userAgent)) {
    return 'Chrome'
  }

  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
    return 'Safari'
  }

  return 'Unknown'
}

function parseOsInfo(userAgent: string) {
  const macMatch = userAgent.match(/Mac OS X ([\d_]+)/i)

  if (macMatch) {
    return {
      osName: 'Mac OS',
      osVersion: macMatch[1].replaceAll('_', '.'),
    }
  }

  const windowsMatch = userAgent.match(/Windows NT ([\d.]+)/i)

  if (windowsMatch) {
    return {
      osName: 'Windows',
      osVersion: windowsMatch[1],
    }
  }

  const androidMatch = userAgent.match(/Android ([\d.]+)/i)

  if (androidMatch) {
    return {
      osName: 'Android',
      osVersion: androidMatch[1],
    }
  }

  const iosMatch = userAgent.match(/(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/i)

  if (iosMatch) {
    return {
      osName: 'iOS',
      osVersion: iosMatch[1].replaceAll('_', '.'),
    }
  }

  if (/Linux/i.test(userAgent)) {
    return {
      osName: 'Linux',
      osVersion: '',
    }
  }

  return {
    osName: 'Unknown',
    osVersion: '',
  }
}

export function getClientDeviceInfo(): DeviceInfo {
  if (typeof navigator === 'undefined') {
    return {
      ipAddress: '',
      browserName: 'Unknown',
      osName: 'Unknown',
      osVersion: '',
      deviceType: 'browser',
    }
  }

  const userAgent = navigator.userAgent
  const osInfo = parseOsInfo(userAgent)

  return {
    ipAddress: '',
    browserName: parseBrowserName(userAgent),
    osName: osInfo.osName,
    osVersion: osInfo.osVersion,
    deviceType: 'browser',
  }
}
