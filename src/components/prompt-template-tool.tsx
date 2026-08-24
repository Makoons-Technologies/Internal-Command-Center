"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deletePromptTemplateAction,
  savePromptTemplateAction,
} from "@/lib/actions";
import {
  compactRows,
  extractParameters,
  fillTemplate,
  insertParameter,
  normalizeParamName,
  parseVariantList,
  removeParameter,
  variantLabel,
  type PromptTemplate,
} from "@/lib/prompt-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Phase = "edit" | "cycle";

function rowsToLists(
  rows: Record<string, string>[],
  parameters: string[],
): Record<string, string> {
  return Object.fromEntries(
    parameters.map((name) => [
      name,
      rows.map((row) => row[name] ?? "").join("\n"),
    ]),
  );
}

function listsToRows(
  lists: Record<string, string>,
  parameters: string[],
): Record<string, string>[] {
  const columns = parameters.map((name) => {
    const lines = (lists[name] ?? "").split(/\r?\n/);
    while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
      lines.pop();
    }
    return lines.map((line) => line.trim());
  });
  const height = Math.max(0, ...columns.map((column) => column.length));
  const rows: Record<string, string>[] = [];
  for (let index = 0; index < height; index += 1) {
    const row: Record<string, string> = {};
    parameters.forEach((name, columnIndex) => {
      row[name] = columns[columnIndex][index] ?? "";
    });
    rows.push(row);
  }
  return compactRows(rows);
}

function blankDraft(): {
  id?: string;
  name: string;
  body: string;
  lists: Record<string, string>;
} {
  return { name: "", body: "", lists: {} };
}

export function PromptTemplateTool({
  templates,
}: {
  templates: PromptTemplate[];
}) {
  const [phase, setPhase] = useState<Phase>("edit");
  const [draft, setDraft] = useState(blankDraft);
  const [paramName, setParamName] = useState("");
  const [combinedPaste, setCombinedPaste] = useState("");
  const [cycleIndex, setCycleIndex] = useState(0);
  const [variants, setVariants] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const parameters = useMemo(() => extractParameters(draft.body), [draft.body]);
  const selectedId = draft.id ?? "";
  const filled = fillTemplate(draft.body, variants[cycleIndex] ?? {});

  function loadTemplate(template: PromptTemplate) {
    setDraft({
      id: template.id,
      name: template.name,
      body: template.body,
      lists: rowsToLists(template.rows, template.parameters),
    });
    setCombinedPaste("");
    setPhase("edit");
    setError("");
    setCopied(false);
  }

  function resetNew() {
    setDraft(blankDraft());
    setCombinedPaste("");
    setPhase("edit");
    setError("");
    setCopied(false);
    setVariants([]);
    setCycleIndex(0);
  }

  function addParameter() {
    const name = normalizeParamName(paramName);
    if (!name) {
      setError("Parameter names need letters, numbers, or underscores.");
      return;
    }
    setDraft((current) => ({
      ...current,
      body: insertParameter(current.body, name),
      lists: { ...current.lists, [name]: current.lists[name] ?? "" },
    }));
    setParamName("");
    setError("");
  }

  function dropParameter(name: string) {
    setDraft((current) => {
      const nextLists = { ...current.lists };
      delete nextLists[name];
      return {
        ...current,
        body: removeParameter(current.body, name),
        lists: nextLists,
      };
    });
  }

  function applyCombinedPaste() {
    if (!combinedPaste.trim() || parameters.length === 0) return;
    const rows = parseVariantList(combinedPaste, parameters);
    setDraft((current) => ({
      ...current,
      lists: { ...current.lists, ...rowsToLists(rows, parameters) },
    }));
  }

  function collectRows(): Record<string, string>[] {
    const fromLists = listsToRows(draft.lists, parameters);
    if (fromLists.length > 0) return fromLists;
    if (combinedPaste.trim() && parameters.length > 0) {
      return parseVariantList(combinedPaste, parameters);
    }
    return [];
  }

  function finishBatch() {
    const rows = collectRows();
    if (parameters.length > 0 && rows.length === 0) {
      setError("Add a list that matches the parameters, then click Done.");
      return;
    }
    if (rows.length > 0) {
      setDraft((current) => ({
        ...current,
        lists: { ...current.lists, ...rowsToLists(rows, parameters) },
      }));
    }
    setVariants(parameters.length === 0 ? [{}] : rows);
    setCycleIndex(0);
    setPhase("cycle");
    setError("");
    setCopied(false);
  }

  function saveTemplate(rows = collectRows()) {
    if (!draft.name.trim()) {
      setError("Name the template before saving.");
      return;
    }
    if (!draft.body.trim()) {
      setError("Write a prompt before saving.");
      return;
    }
    setError("");
    startTransition(async () => {
      const saved = await savePromptTemplateAction({
        id: draft.id,
        name: draft.name,
        body: draft.body,
        parameters,
        rows,
      });
      setDraft((current) => ({ ...current, id: saved.id, name: saved.name }));
    });
  }

  function removeTemplate() {
    if (!draft.id) {
      resetNew();
      return;
    }
    if (!window.confirm(`Delete template “${draft.name || "untitled"}”?`)) {
      return;
    }
    startTransition(async () => {
      await deletePromptTemplateAction(draft.id as string);
      resetNew();
    });
  }

  async function copyFilled() {
    await navigator.clipboard.writeText(filled);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function step(delta: number) {
    if (variants.length === 0) return;
    setCycleIndex(
      (current) => (current + delta + variants.length) % variants.length,
    );
    setCopied(false);
  }

  return (
    <Card size="sm" className="ring-foreground/8">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-sm tracking-wide uppercase">
              Prompt templates
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Save a prompt, add text parameters, paste matching lists, then
              cycle through each filled copy.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Saved templates"
              className={cn(
                "h-8 min-w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
              )}
              value={selectedId}
              onChange={(event) => {
                const next = templates.find(
                  (template) => template.id === event.target.value,
                );
                if (next) loadTemplate(next);
                else resetNew();
              }}
            >
              <option value="">New template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={resetNew}>
              New
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {phase === "edit" ? (
          <>
            <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_1fr]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prompt-template-name">Template name</Label>
                <Input
                  id="prompt-template-name"
                  value={draft.name}
                  placeholder="Saturday Canva posts"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prompt-param-name">Add parameter</Label>
                <div className="flex gap-2">
                  <Input
                    id="prompt-param-name"
                    value={paramName}
                    placeholder="city"
                    onChange={(event) => setParamName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addParameter();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addParameter}>
                    <Plus data-icon="inline-start" />
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-template-body">Prompt</Label>
              <Textarea
                id="prompt-template-body"
                value={draft.body}
                placeholder="Write a {{platform}} post about {{offer}} for {{city}}."
                className="min-h-32"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Parameters
              </span>
              {parameters.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  Add one, or type {"{{name}}"} in the prompt.
                </span>
              ) : (
                parameters.map((name) => (
                  <Badge key={name} variant="secondary" className="gap-1 pr-1">
                    {`{{${name}}}`}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-foreground/10"
                      aria-label={`Remove ${name}`}
                      onClick={() => dropParameter(name)}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {parameters.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Matching lists
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    One value per line. Line 1 of each list fills the first
                    copy, line 2 the next, and so on.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {parameters.map((name) => (
                    <div key={name} className="flex flex-col gap-1.5">
                      <Label htmlFor={`prompt-list-${name}`}>{`{{${name}}}`}</Label>
                      <Textarea
                        id={`prompt-list-${name}`}
                        value={draft.lists[name] ?? ""}
                        placeholder={`Values for ${name}`}
                        className="min-h-28 font-mono text-sm"
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            lists: {
                              ...current.lists,
                              [name]: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="prompt-combined-paste">
                    Or paste rows (comma, tab, or pipe)
                  </Label>
                  <Textarea
                    id="prompt-combined-paste"
                    value={combinedPaste}
                    placeholder={parameters.join(", ")}
                    className="min-h-20 font-mono text-sm"
                    onChange={(event) => setCombinedPaste(event.target.value)}
                  />
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyCombinedPaste}
                      disabled={!combinedPaste.trim()}
                    >
                      Load paste into lists
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={finishBatch} disabled={pending}>
                Done
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => saveTemplate()}
                disabled={pending}
              >
                Save template
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={removeTemplate}
                disabled={pending}
              >
                {draft.id ? "Delete" : "Clear"}
              </Button>
            </div>
          </>
        ) : (
          <CycleView
            name={draft.name}
            variants={variants}
            cycleIndex={cycleIndex}
            filled={filled}
            copied={copied}
            onSelect={setCycleIndex}
            onStep={step}
            onCopy={copyFilled}
            onEdit={() => {
              setPhase("edit");
              setCopied(false);
            }}
            onSave={() => saveTemplate(variants)}
            pending={pending}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CycleView({
  name,
  variants,
  cycleIndex,
  filled,
  copied,
  onSelect,
  onStep,
  onCopy,
  onEdit,
  onSave,
  pending,
}: {
  name: string;
  variants: Record<string, string>[];
  cycleIndex: number;
  filled: string;
  copied: boolean;
  onSelect: (index: number) => void;
  onStep: (delta: number) => void;
  onCopy: () => void;
  onEdit: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  const total = variants.length;
  const current = variants[cycleIndex];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Filled prompt"
          className={cn(
            "h-8 min-w-56 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
          )}
          value={String(cycleIndex)}
          onChange={(event) => onSelect(Number(event.target.value))}
        >
          {variants.map((row, index) => (
            <option key={`${index}-${variantLabel(row, index)}`} value={index}>
              {variantLabel(row, index)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={() => onStep(-1)}
          disabled={total <= 1}
        >
          <ChevronLeft data-icon="inline-start" />
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onStep(1)}
          disabled={total <= 1}
        >
          Next
          <ChevronRight data-icon="inline-end" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {cycleIndex + 1} of {total}
        </span>
      </div>

      {current && Object.keys(current).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(current).map(([key, value]) => (
            <Badge key={key} variant="outline">
              {key}: {value || "—"}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border bg-muted/30 px-3 py-3">
        <pre className="font-sans text-sm leading-6 wrap-break-word whitespace-pre-wrap">
          {filled || "This prompt is empty."}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onCopy}>
          {copied ? (
            <Check data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSave}
          disabled={pending || !name.trim()}
        >
          Save template
        </Button>
      </div>
    </div>
  );
}
