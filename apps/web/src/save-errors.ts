type Issue = { path: (string | number)[]; message: string };
type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    issues?: Issue[];
    details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
  };
  conflicts?: { severity?: string; message: string }[];
};

const labels: Record<string, string> = {
  name: 'Horse name',
  riderId: 'Rider',
  horseId: 'Horse',
  coachId: 'Coach',
  partBoardAgreementId: 'Part-board agreement',
  maximumDailyRideUnits: 'Maximum daily ride units',
};

function fieldLabel(field: string | number) {
  if (typeof field === 'number') return `item ${field + 1}`;
  return labels[field] ?? field.replace(/([A-Z])/g, ' $1').replace(/^./, (first) => first.toUpperCase());
}

export function validationMessage(issues: Issue[]) {
  return [...new Set(issues.map(({ path, message }) => {
    const field = path.filter((part) => part !== 'lesson').map(fieldLabel).join(' / ');
    const reason = message === 'String must contain at least 1 character(s)' ? 'Required.' : message;
    return field ? `${field}: ${reason}` : reason;
  }))].join('\n');
}

export function errorMessage(response: unknown, fallback = 'Unable to save. Review the fields and try again.') {
  const { error, conflicts } = (response ?? {}) as ErrorResponse;
  const blockers = conflicts?.filter(({ severity }) => severity !== 'WARNING').map(({ message }) => message).filter(Boolean);
  if (blockers?.length) return [...new Set(blockers)].join('\n');
  if (error?.issues?.length) return validationMessage(error.issues);
  const fields = Object.entries(error?.details?.fieldErrors ?? {}).flatMap(([field, messages]) =>
    messages.map((message) => ({ path: [field], message })));
  const forms = (error?.details?.formErrors ?? []).map((message) => ({ path: [], message }));
  if (fields.length || forms.length) return validationMessage([...fields, ...forms]);
  if (error?.code === 'NOT_FOUND' && !error.message) return 'The record could not be found. Refresh the page and try again.';
  if (error?.code === 'INTERNAL_ERROR') return 'Unable to save because the server encountered an error. Try again.';
  return error?.message || fallback;
}
