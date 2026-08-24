export interface PromptTemplate {
  id: string;
  name: string;
  body: string;
  parameters: string[];
  rows: Record<string, string>[];
  updatedAt: string;
  createdAt: string;
}

export type PromptTemplateInput = {
  id?: string;
  name: string;
  body: string;
  parameters: string[];
  rows?: Record<string, string>[];
};

const PARAM_TOKEN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export function normalizeParamName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const underscored = trimmed.replace(/\s+/g, "_");
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(underscored)) return underscored;
  const cleaned = underscored.replace(/[^A-Za-z0-9_]/g, "");
  if (!cleaned) return "";
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `p_${cleaned}`;
}

export function extractParameters(body: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(PARAM_TOKEN)) {
    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function parameterToken(name: string): string {
  return `{{${name}}}`;
}

export function insertParameter(body: string, name: string): string {
  const token = parameterToken(name);
  if (body.includes(token)) return body;
  if (!body.trim()) return token;
  return /\s$/.test(body) ? `${body}${token}` : `${body} ${token}`;
}

export function removeParameter(body: string, name: string): string {
  const token = parameterToken(name);
  return body
    .split(token)
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function fillTemplate(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(PARAM_TOKEN, (_, name: string) => values[name] ?? "");
}

export function emptyRow(parameters: string[]): Record<string, string> {
  return Object.fromEntries(parameters.map((name) => [name, ""]));
}

export function reshapeRows(
  rows: Record<string, string>[],
  parameters: string[],
): Record<string, string>[] {
  return rows.map((row) => {
    const next: Record<string, string> = {};
    for (const name of parameters) {
      const value = row[name];
      next[name] = typeof value === "string" ? value : value == null ? "" : String(value);
    }
    return next;
  });
}

export function isBlankRow(row: Record<string, string>): boolean {
  return Object.values(row).every((value) => !value.trim());
}

export function compactRows(
  rows: Record<string, string>[],
): Record<string, string>[] {
  return rows.filter((row) => !isBlankRow(row));
}

function splitCells(line: string, columnCount: number): string[] {
  if (columnCount <= 1) return [line];
  if (line.includes("\t")) return line.split("\t");
  if (line.includes("|")) return line.split("|");
  return line.split(",");
}

export function parseVariantList(
  text: string,
  parameters: string[],
): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0 || parameters.length === 0) return [];

  const firstCells = splitCells(lines[0], parameters.length).map((cell) =>
    normalizeParamName(cell),
  );
  const headerMatch =
    firstCells.length >= parameters.length &&
    parameters.every(
      (name, index) => firstCells[index]?.toLowerCase() === name.toLowerCase(),
    );
  const dataLines = headerMatch ? lines.slice(1) : lines;

  return compactRows(
    dataLines.map((line) => {
      const cells = splitCells(line, parameters.length);
      const row: Record<string, string> = {};
      parameters.forEach((name, index) => {
        row[name] = (cells[index] ?? "").trim();
      });
      return row;
    }),
  );
}

export function variantLabel(
  row: Record<string, string>,
  index: number,
): string {
  const bits = Object.values(row)
    .map((value) => value.trim())
    .filter(Boolean);
  const preview = bits.slice(0, 2).join(" · ");
  return preview ? `${index + 1}. ${preview}` : `Item ${index + 1}`;
}

export function parsePromptTemplate(value: unknown): PromptTemplate {
  if (!value || typeof value !== "object") {
    throw new Error("PromptTemplate must be an object");
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new Error("PromptTemplate.id is required");
  }
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    throw new Error("PromptTemplate.name is required");
  }
  if (typeof raw.body !== "string") {
    throw new Error("PromptTemplate.body is required");
  }
  if (typeof raw.updatedAt !== "string" || typeof raw.createdAt !== "string") {
    throw new Error("PromptTemplate timestamps are required");
  }

  const parameters = Array.isArray(raw.parameters)
    ? raw.parameters.filter((name): name is string => typeof name === "string")
    : extractParameters(raw.body);
  const rows = Array.isArray(raw.rows)
    ? raw.rows.filter(
        (row): row is Record<string, string> =>
          !!row && typeof row === "object" && !Array.isArray(row),
      )
    : [];

  return {
    id: raw.id,
    name: raw.name.trim(),
    body: raw.body,
    parameters,
    rows: reshapeRows(rows, parameters),
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
  };
}
