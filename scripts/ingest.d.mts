export function validateInput(
  input: unknown,
  existingIds: Set<string>,
): { ok: boolean; errors: string[] };
