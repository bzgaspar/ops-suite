// Turns Supabase / Postgres / network errors into short messages a cashier can act on.

type ErrLike = { message?: string; code?: string; status?: number; details?: string; name?: string };

const asErr = (e: unknown): ErrLike =>
  typeof e === 'string' ? { message: e } : e && typeof e === 'object' ? (e as ErrLike) : {};

export function isNetworkError(e: unknown): boolean {
  const m = asErr(e).message ?? '';
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected/i.test(m);
}

export function isAuthError(e: unknown): boolean {
  const err = asErr(e);
  return err.status === 401 || err.code === 'PGRST301' || err.code === 'PGRST303'
    || /jwt expired|invalid jwt|refresh token|auth session missing/i.test(err.message ?? '');
}

// Unique-constraint names / key columns → what the user should hear.
const DUPLICATES: [RegExp, string][] = [
  [/isp_invoices_one_monthly|\(customer_id, period_month\)/, 'This customer already has a bill for that month.'],
  [/\(period_id, employee_id\)/, 'This employee is already in this payroll.'],
  [/\(username\)/, 'That username is already taken.'],
  [/\(name\)/, 'That name already exists.'],
  [/\(ref_no\)|\(invoice_no\)|\(receipt_no\)|\(account_no\)/, 'That reference number is already used. Please try again.'],
];

export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e == null) return fallback;
  const err = asErr(e);
  const msg = err.message ?? '';
  const where = `${msg} ${err.details ?? ''}`;

  if (isNetworkError(e) || (typeof navigator !== 'undefined' && navigator.onLine === false))
    return "Can't reach the server. Check your internet connection and try again.";
  if (isAuthError(e)) return 'Your session has expired. Please sign in again.';
  if (err.name === 'ChunkLoadError' || /loading chunk|dynamically imported module/i.test(msg))
    return 'A new version of the app is available. Please reload the page.';

  switch (err.code) {
    case '23505':
      return DUPLICATES.find(([re]) => re.test(where))?.[1] ?? 'This record already exists.';
    case '23503':
      return /^update or delete/i.test(msg)
        ? "This record is used by other records, so it can't be deleted. Mark it inactive instead."
        : 'A linked record no longer exists. Refresh the page and try again.';
    case '23514': return 'One of the values is not allowed. Check amounts, weights and dates.';
    case '23502': return 'A required field is missing.';
    case '22P02': case '22007': case '22008': return 'One of the values has the wrong format.';
    case '22003': return 'A number is too large.';
    case '42501': return "You don't have permission to do that.";
    case 'PGRST116': return 'Record not found. It may have been deleted. Refresh the page.';
    case '57014': return 'The request took too long. Try a shorter date range.';
  }
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  return msg || fallback;
}
