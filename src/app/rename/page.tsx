"use client";

import * as React from "react";
import { FilePenLine, Play, Settings2, Wand2 } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBaseName, getExtension, sanitizeFileName } from "@/lib/utils";

type CaseMode = "keep" | "lower" | "upper";

interface RenameOptions {
  template: string;
  startAt: number;
  digits: number;
  caseMode: CaseMode;
  replaceOld: string;
  replaceNew: string;
  removeExt: boolean;
}

const DEFAULT_OPTIONS: RenameOptions = {
  template: "{name}_{index}",
  startAt: 1,
  digits: 3,
  caseMode: "keep",
  replaceOld: "",
  replaceNew: "",
  removeExt: false,
};

const TOKEN_HELP: { token: string; desc: string }[] = [
  { token: "{name}", desc: "原文件名（不含扩展名）" },
  { token: "{ext}", desc: "原扩展名" },
  { token: "{index}", desc: "序号（可加位数 {index:4}）" },
  { token: "{date}", desc: "当前日期 YYYY-MM-DD" },
  { token: "{time}", desc: "当前时间 HH-mm-ss" },
  { token: "{random}", desc: "随机字符串（可加长度 {random:8}）" },
];

function formatToken(
  token: string,
  index: number,
  opts: RenameOptions & { _baseName: string }
): string {
  const pad = (n: number) => String(n).padStart(opts.digits, "0");
  if (token === "index") return pad(index);
  if (token === "date") {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (token === "time") {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}-${String(d.getSeconds()).padStart(2, "0")}`;
  }
  if (token.startsWith("random")) {
    const len = Number(token.split(":")[1]) || 6;
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++)
      s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  if (token.startsWith("name")) {
    // 支持 {name:N} 截取前 N 字符
    const n = Number(token.split(":")[1]);
    return n > 0 ? opts._baseName.slice(0, n) : opts._baseName;
  }
  return "";
}

function renderTemplate(
  template: string,
  index: number,
  opts: RenameOptions & { _baseName: string }
): string {
  return template.replace(/\{([a-z]+)(?::(\d+))?\}/g, (_, name, len) => {
    let token = name;
    if (len) token = `${name}:${len}`;
    return formatToken(token, index, opts);
  });
}

function buildNewName(
  original: string,
  index: number,
  opts: RenameOptions
): string {
  let base = getBaseName(original);
  const ext = getExtension(original);

  if (opts.replaceOld) {
    base = base.split(opts.replaceOld).join(opts.replaceNew);
  }
  switch (opts.caseMode) {
    case "lower":
      base = base.toLowerCase();
      break;
    case "upper":
      base = base.toUpperCase();
      break;
  }

  const ctx = { ...opts, _baseName: base };
  const rendered = renderTemplate(opts.template, index, ctx);
  const finalExt = opts.removeExt ? "" : ext;
  return sanitizeFileName(finalExt ? `${rendered}.${finalExt}` : rendered);
}

export default function RenamePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const clearAll = useBatchStore((s) => s.clearAll);

  const [opts, setOpts] = React.useState<RenameOptions>(DEFAULT_OPTIONS);
  const [newNames, setNewNames] = React.useState<string[]>([]);

  const patch = (p: Partial<RenameOptions>) =>
    setOpts((prev) => ({ ...prev, ...p }));

  // 生成新名字（含重名去重）
  React.useEffect(() => {
    const names: string[] = [];
    const used = new Set<string>();
    items.forEach((item, i) => {
      const name = buildNewName(item.name, opts.startAt + i, opts);
      let candidate = name;
      let n = 2;
      const lower = candidate.toLowerCase();
      while (used.has(lower)) {
        const dot = candidate.lastIndexOf(".");
        candidate =
          dot > 0
            ? `${candidate.slice(0, dot)}-${n++}${candidate.slice(dot)}`
            : `${candidate}-${n++}`;
      }
      used.add(candidate.toLowerCase());
      names.push(candidate);
    });
    setNewNames(names);
  }, [items, opts]);

  const renameCount = newNames.filter((n, i) => n !== items[i]?.name).length;

  const exportEntries: ZipEntry[] = items.map((item, i) => ({
    name: newNames[i] ?? item.name,
    blob: item.file,
  }));

  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={FilePenLine}
            title="批量重命名"
            description="通过模板批量重命名任意文件，实时预览，重命名后打包下载"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">命名规则</h2>
            </div>

            <div className="space-y-2">
              <Label>
                命名模板
                <span className="text-muted-foreground ml-2 text-[11px] font-normal">
                  例：IMG_{"{date}"}_{"{index:4}"} → IMG_2026-08-16_0001.jpg
                </span>
              </Label>
              <div className="relative">
                <Input
                  value={opts.template}
                  onChange={(e) => patch({ template: e.target.value })}
                  className="pr-8 font-mono text-sm"
                  placeholder="{name}_{index}"
                />
                <Wand2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                {TOKEN_HELP.map((t) => (
                  <button
                    key={t.token}
                    title={t.desc}
                    onClick={() => {
                      const tpl = opts.template || "{name}";
                      patch({ template: `${tpl}${t.token}` });
                    }}
                    className="text-muted-foreground hover:text-primary font-mono text-[11px] transition-colors"
                  >
                    {t.token}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>起始序号</Label>
                <Input
                  type="number"
                  min={0}
                  value={opts.startAt}
                  onChange={(e) =>
                    patch({ startAt: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>序号位数</Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={opts.digits}
                  onChange={(e) =>
                    patch({
                      digits: Math.max(
                        1,
                        Math.min(8, Number(e.target.value) || 1)
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>大小写</Label>
                <Select
                  value={opts.caseMode}
                  onValueChange={(v) => patch({ caseMode: v as CaseMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">保持不变</SelectItem>
                    <SelectItem value="lower">全部小写</SelectItem>
                    <SelectItem value="upper">全部大写</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>扩展名</Label>
                <Select
                  value={opts.removeExt ? "remove" : "keep"}
                  onValueChange={(v) => patch({ removeExt: v === "remove" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">保留扩展名</SelectItem>
                    <SelectItem value="remove">移除扩展名</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>查找替换（文件名部分）</Label>
                <Input
                  value={opts.replaceOld}
                  onChange={(e) => patch({ replaceOld: e.target.value })}
                  placeholder="要替换的文本"
                />
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Input
                  value={opts.replaceNew}
                  onChange={(e) => patch({ replaceNew: e.target.value })}
                  placeholder="替换为（留空删除）"
                />
              </div>
            </div>
          </div>

          {/* 文件区 */}
          {items.length === 0 ? (
            <div
              className="border-input hover:bg-accent/50 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) addFiles(files);
                  e.target.value = "";
                }}
              />
              <Play className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground text-sm">
                点击选择要重命名的文件（任意类型，可多选）
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-card rounded-lg border">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                      <tr className="text-left text-xs">
                        <th className="px-4 py-2 font-medium">原名</th>
                        <th className="px-2 py-2 text-center font-medium">→</th>
                        <th className="px-4 py-2 font-medium">新名</th>
                        <th className="px-2 py-2 font-medium">大小</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item, i) => {
                        const renamed = newNames[i] !== item.name;
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-accent/40 transition-colors"
                          >
                            <td className="px-4 py-2 font-mono text-xs break-all">
                              {item.name}
                            </td>
                            <td className="text-muted-foreground px-2 py-2 text-center">
                              →
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={
                                  renamed
                                    ? "text-primary font-mono text-xs break-all"
                                    : "text-muted-foreground font-mono text-xs break-all"
                                }
                              >
                                {newNames[i]}
                              </span>
                            </td>
                            <td className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap">
                              {(item.size / 1024).toFixed(1)} KB
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-card flex items-center gap-3 rounded-lg border p-4">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors"
                >
                  添加文件
                </button>
                <button
                  onClick={clearAll}
                  className="border-input bg-background hover:bg-destructive hover:text-destructive-foreground inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors"
                >
                  清空
                </button>
                <span className="text-muted-foreground text-xs">
                  {renameCount} 个文件将被重命名
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <ZipExportButton
                    entries={exportEntries}
                    zipName="renamed-files.zip"
                  />
                  <DownloadAllButton entries={exportEntries} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
