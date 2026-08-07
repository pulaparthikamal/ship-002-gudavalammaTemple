export interface Parsed835Adjustment {
  groupCode: string;
  reasonCode: string;
  amount: number;
  quantity?: number;
}

export interface Parsed835ServiceLine {
  procedureCode?: string;
  serviceLineControlNumber?: string;
  billedAmount: number;
  paidAmount: number;
  allowedAmount?: number;
  serviceDate?: Date;
  adjustments: Parsed835Adjustment[];
  remarkCodes: string[];
}

export interface Parsed835Claim {
  patientControlNumber?: string;
  payerClaimNumber?: string;
  claimStatusCode?: string;
  billedAmount: number;
  paidAmount: number;
  patientRespAmount: number;
  claimDates: Record<string, Date>;
  serviceLines: Parsed835ServiceLine[];
  claimLevelAdjustments: Parsed835Adjustment[];
  remarkCodes: string[];
}

export interface Parsed835 {
  paymentMethod?: string;
  paymentDate?: Date;
  totalPaymentAmount: number;
  traceNumber?: string;
  payerName?: string;
  payeeName?: string;
  claims: Parsed835Claim[];
  providerAdjustments: Array<{
    providerIdentifier?: string;
    fiscalPeriod?: string;
    reasonCode?: string;
    reference?: string;
    amount: number;
  }>;
  parseErrors: string[];
}

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: unknown) {
  const text = String(value ?? '').trim();
  if (!/^\d{8}$/.test(text)) {
    return undefined;
  }

  const dateValue = new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00.000Z`);
  return Number.isNaN(dateValue.getTime()) ? undefined : dateValue;
}

function getProcedureCode(composite: string | undefined) {
  const parts = String(composite ?? '').split(':').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return undefined;
  }

  return parts[0] === 'HC' || parts[0] === 'AD' || parts[0] === 'NU' ? parts[1] : parts[0];
}

function parseCas(elements: string[]): Parsed835Adjustment[] {
  const groupCode = String(elements[1] ?? '').trim();
  const adjustments: Parsed835Adjustment[] = [];

  for (let index = 2; index < elements.length; index += 3) {
    const reasonCode = String(elements[index] ?? '').trim();
    if (!groupCode || !reasonCode) {
      continue;
    }

    adjustments.push({
      groupCode,
      reasonCode,
      amount: toNumber(elements[index + 1]),
      quantity: elements[index + 2] ? toNumber(elements[index + 2]) : undefined,
    });
  }

  return adjustments;
}

export function redact835Payload(raw835Text: string) {
  return raw835Text
    .replace(/(NM1\*QC\*1\*)[^~]*/gi, '$1[REDACTED PATIENT]~')
    .replace(/(NM1\*IL\*1\*)[^~]*/gi, '$1[REDACTED SUBSCRIBER]~')
    .replace(/(N3\*)[^~]*/gi, '$1[REDACTED ADDRESS]~')
    .replace(/(N4\*)[^~]*/gi, '$1[REDACTED LOCATION]~')
    .replace(/(REF\*(?:SY|EI|MI)\*)[^~]*/gi, '$1[REDACTED]~')
    .slice(0, 50000);
}

export function parse835(raw835Text: string): Parsed835 {
  const parseErrors: string[] = [];
  const parsed: Parsed835 = {
    totalPaymentAmount: 0,
    claims: [],
    providerAdjustments: [],
    parseErrors,
  };
  let currentClaim: Parsed835Claim | null = null;
  let currentLine: Parsed835ServiceLine | null = null;

  const normalizedText = raw835Text.replace(/\r?\n/g, '').trim();
  const segments = normalizedText
    .split('~')
    .map((segment) => segment.trim())
    .filter(Boolean);

  segments.forEach((segment) => {
    const elements = segment.split('*');
    const segmentId = elements[0];

    try {
      switch (segmentId) {
        case 'BPR':
          parsed.totalPaymentAmount = toNumber(elements[2]);
          parsed.paymentMethod = elements[4] || undefined;
          parsed.paymentDate = toDate(elements[16]);
          break;
        case 'TRN':
          parsed.traceNumber = elements[2] || parsed.traceNumber;
          break;
        case 'N1':
          if (elements[1] === 'PR') {
            parsed.payerName = elements[2] || parsed.payerName;
          } else if (elements[1] === 'PE') {
            parsed.payeeName = elements[2] || parsed.payeeName;
          }
          break;
        case 'CLP':
          currentClaim = {
            patientControlNumber: elements[1] || undefined,
            claimStatusCode: elements[2] || undefined,
            billedAmount: toNumber(elements[3]),
            paidAmount: toNumber(elements[4]),
            patientRespAmount: toNumber(elements[5]),
            payerClaimNumber: elements[7] || undefined,
            claimDates: {},
            serviceLines: [],
            claimLevelAdjustments: [],
            remarkCodes: [],
          };
          parsed.claims.push(currentClaim);
          currentLine = null;
          break;
        case 'SVC':
          if (!currentClaim) {
            parseErrors.push('SVC segment encountered before CLP segment.');
            break;
          }
          currentLine = {
            procedureCode: getProcedureCode(elements[1]),
            billedAmount: toNumber(elements[2]),
            paidAmount: toNumber(elements[3]),
            serviceLineControlNumber: undefined,
            adjustments: [],
            remarkCodes: [],
          };
          currentClaim.serviceLines.push(currentLine);
          break;
        case 'CAS': {
          const adjustments = parseCas(elements);
          if (currentLine) {
            currentLine.adjustments.push(...adjustments);
          } else if (currentClaim) {
            currentClaim.claimLevelAdjustments.push(...adjustments);
          } else {
            parseErrors.push('CAS segment encountered before CLP segment.');
          }
          break;
        }
        case 'LQ':
          if (elements[2]) {
            if (currentLine) {
              currentLine.remarkCodes.push(elements[2]);
            } else if (currentClaim) {
              currentClaim.remarkCodes.push(elements[2]);
            }
          }
          break;
        case 'REF':
          if (currentLine && elements[1] === '6R') {
            currentLine.serviceLineControlNumber = elements[2] || currentLine.serviceLineControlNumber;
          }
          break;
        case 'DTM': {
          const dateValue = toDate(elements[2]);
          if (!dateValue) {
            break;
          }
          if (currentLine && (elements[1] === '472' || elements[1] === '150' || elements[1] === '151')) {
            currentLine.serviceDate = dateValue;
          } else if (currentClaim) {
            currentClaim.claimDates[elements[1] || 'unknown'] = dateValue;
          }
          break;
        }
        case 'AMT':
          if (currentLine && (elements[1] === 'B6' || elements[1] === 'AU')) {
            currentLine.allowedAmount = toNumber(elements[2]);
          }
          break;
        case 'PLB':
          for (let index = 3; index < elements.length; index += 2) {
            const composite = String(elements[index] ?? '').split(':');
            const amount = toNumber(elements[index + 1]);
            if (!composite[0] && amount === 0) {
              continue;
            }
            parsed.providerAdjustments.push({
              providerIdentifier: elements[1] || undefined,
              fiscalPeriod: elements[2] || undefined,
              reasonCode: composite[0] || undefined,
              reference: composite.slice(1).join(':') || undefined,
              amount,
            });
          }
          break;
        default:
          break;
      }
    } catch (error) {
      parseErrors.push(`Unable to parse ${segmentId} segment: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  if (!parsed.claims.length) {
    parseErrors.push('No CLP claim payment segments were found.');
  }

  return parsed;
}
