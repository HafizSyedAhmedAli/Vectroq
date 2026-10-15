"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import type {
  BOQResult,
  Geometry,
  Room,
  RoomType,
  Wall,
} from "@tmcc/shared-types";
import {
  BrickWall,
  Calculator,
  CircleCheck,
  DoorOpen,
  GripVertical,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import Link from "next/link";
import { BoqTable } from "./BoqTable";

interface CadReviewPanelProps {
  projectId: string;
  /** Whatever was already saved on this project, so a page refresh doesn't
   * throw away an earlier upload/correction/finalize. */
  initialGeometry?: Geometry | null;
  initialBoq?: BOQResult | null;
  /** Called after a successful upload so the parent (which owns the
   * render-availability check) knows a CAD file now exists. */
  onGeometryUploaded?: () => void;
  /** Called whenever the BOQ is calculated (BOQResult) or invalidated (null). */
  onBoqChange?: (boq: BOQResult | null) => void;
  /** Set false when the parent renders the BOQ itself (project page layout). */
  showBoq?: boolean;
  /** Called when a calculation starts/stops, so the parent can show a loader. */
  onCalculatingChange?: (calculating: boolean) => void;
  /** Element id to scroll to once the BOQ is ready. */
  boqAnchorId?: string;
  /** Called whenever the geometry changes (upload or manual correction). */
  onGeometryChange?: (g: Geometry | null) => void;
}

type Status = "idle" | "uploading" | "reviewing" | "saving" | "calculating";
type DragState = { kind: "room" | "wall"; from: number } | null;

function reorder<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// FR-8/9/10/11/12/13: upload a DXF, let office staff correct what the parser
// extracted, then price the corrected geometry. This talks to routes that
// read/write a Project's one CadFile — it has no concept of picking a
// project; the page embedding this decides which project's ID to pass in.
export function CadReviewPanel({
  projectId,
  initialGeometry = null,
  initialBoq = null,
  onGeometryUploaded,
  onBoqChange,
  showBoq = true,
  onCalculatingChange,
  boqAnchorId = "boq-section",
  onGeometryChange,
}: CadReviewPanelProps) {
  const [geometry, setGeometry] = useState<Geometry | null>(initialGeometry);
  const [boq, setBoq] = useState<BOQResult | null>(initialBoq);
  const [fileName, setFileName] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [status, setStatus] = useState<Status>(
    initialGeometry ? "reviewing" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    onGeometryChange?.(geometry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  const busy =
    status === "uploading" || status === "saving" || status === "calculating";

  // Live seconds counter so a long price search never looks frozen.
  useEffect(() => {
    if (status !== "calculating") {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setError(null);
    setNotice(null);
    setBoq(null);
    onBoqChange?.(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/projects/${projectId}/cad-upload`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      setGeometry(body.geometry as Geometry);
      setFileName(file.name);
      setDirty(false);
      setStatus("reviewing");
      onGeometryUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus("idle");
    } finally {
      e.target.value = ""; // allow re-uploading a corrected file of the same name
    }
  }

  function updateRoom(index: number, patch: Partial<Room>) {
    setDirty(true);
    setGeometry((g) =>
      g
        ? {
            ...g,
            rooms: g.rooms.map((r, i) =>
              i === index ? { ...r, ...patch } : r,
            ),
          }
        : g,
    );
  }

  function updateWall(index: number, patch: Partial<Wall>) {
    setDirty(true);
    setGeometry((g) =>
      g
        ? {
            ...g,
            walls: g.walls.map((w, i) =>
              i === index ? { ...w, ...patch } : w,
            ),
          }
        : g,
    );
  }

  function removeRoom(index: number) {
    setDirty(true);
    setGeometry((g) =>
      g ? { ...g, rooms: g.rooms.filter((_, i) => i !== index) } : g,
    );
  }

  function removeWall(index: number) {
    setDirty(true);
    setGeometry((g) =>
      g ? { ...g, walls: g.walls.filter((_, i) => i !== index) } : g,
    );
  }

  function dropOn(kind: "room" | "wall", to: number) {
    if (!drag || drag.kind !== kind || drag.from === to) {
      setDrag(null);
      return;
    }
    const from = drag.from;
    setDirty(true);
    setGeometry((g) => {
      if (!g) return g;
      return kind === "room"
        ? { ...g, rooms: reorder(g.rooms, from, to) }
        : { ...g, walls: reorder(g.walls, from, to) };
    });
    setDrag(null);
  }

  async function saveGeometry(current: Geometry) {
    const res = await fetch(`/api/projects/${projectId}/geometry`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Could not save corrections.");
  }

  async function handleSaveCorrections() {
    if (!geometry) return;
    setStatus("saving");
    setError(null);
    setNotice(null);

    try {
      await saveGeometry(geometry);
      const hadBoq = boq !== null;
      setDirty(false);
      setBoq(null); // a correction invalidates any BOQ already on screen
      onBoqChange?.(null);
      setNotice(
        hadBoq
          ? "Corrections saved. The previous BOQ was cleared — press “Calculate BOQ” to price the updated drawing."
          : "Corrections saved.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save corrections.",
      );
    } finally {
      setStatus("reviewing");
    }
  }

  async function handleCalculateBoq() {
    if (!geometry) return;
    setStatus("calculating");
    setError(null);
    setNotice(null);
    onCalculatingChange?.(true);

    try {
      // The server prices the SAVED drawing, so push unsaved edits first.
      if (dirty) {
        await saveGeometry(geometry);
        setDirty(false);
      }
      const res = await fetch(`/api/projects/${projectId}/finalize`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          body.error ??
            "Could not calculate the BOQ. The request may have timed out — please try again.",
        );
      setBoq(body.boq as BOQResult);
      onBoqChange?.(body.boq as BOQResult);
      setNotice(
        "BOQ calculated — scroll down to review the priced quantities.",
      );
      // Wait a tick so the BOQ card has rendered, then bring it into view.
      setTimeout(() => {
        document
          .getElementById(boqAnchorId)
          ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not calculate the BOQ.",
      );
    } finally {
      setStatus("reviewing");
      onCalculatingChange?.(false);
    }
  }

  const sectionTitle =
    "mb-3 flex items-center gap-2.5 text-sm font-semibold text-brand-black";
  const sectionIcon =
    "grid size-7 place-items-center rounded-md border border-stone-200 bg-white text-brand-black";
  const tableWrap =
    "overflow-x-auto rounded-xl border border-stone-200 bg-white";
  const th = "px-3 py-2.5 text-left font-semibold";
  const deleteBtn =
    "grid size-8 cursor-pointer place-items-center rounded-lg text-brand hover:bg-red-50";
  const grip =
    "grid cursor-grab place-items-center text-stone-300 hover:text-stone-500 active:cursor-grabbing";
  const fieldCls =
    "h-11 rounded-xl border-stone-200! bg-white! px-4 text-[15px] text-brand-black shadow-sm hover:border-stone-300! focus-visible:border-brand! focus-visible:ring-brand/20";

  const selectCls =
    "w-full cursor-pointer [&_select]:h-11 [&_select]:rounded-xl [&_select]:border-stone-200 [&_select]:bg-white [&_select]:px-4 [&_select]:text-[15px] [&_select]:text-brand-black [&_select]:shadow-sm [&_select:hover]:border-stone-300 [&_select:focus-visible]:border-brand [&_select:focus-visible]:ring-brand/20 [&_svg]:right-4";

  return (
    <div className="space-y-6">
      {/* Upload + summary tiles */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,200px)_1fr] lg:items-start">
        <div>
          <Label htmlFor="cad-file" className="text-[13px] font-semibold">
            Upload AutoCAD file (.dxf)
          </Label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="cad-file"
              type="file"
              accept=".dxf"
              onChange={handleFileChange}
              disabled={status === "uploading"}
              className="peer sr-only"
            />
            <label
              htmlFor="cad-file"
              className="inline-flex cursor-pointer items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark peer-disabled:opacity-50 peer-focus-visible:ring-3 peer-focus-visible:ring-brand/40"
            >
              Choose File
            </label>
            <span className="max-w-[9rem] truncate text-xs text-stone-500">
              {fileName ?? "No file chosen"}
            </span>
          </div>
          {status === "uploading" && (
            <p className="mt-1.5 text-xs text-stone-400">Parsing drawing…</p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
            Export the plan from AutoCAD as .dxf (.dwg conversion is not
            available yet). Units are detected automatically (mm, cm, m, ft).
          </p>
        </div>

        {geometry && (
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
            {[
              ["Rooms", geometry.rooms.length],
              [
                "Bathrooms",
                geometry.rooms.filter((r) => r.type === "bathroom").length,
              ],
              [
                "Covered area",
                `${Math.round(geometry.rooms.reduce((s, r) => s + r.area, 0)).toLocaleString("en-PK")} sq ft`,
              ],
              [
                "Wall length",
                `${Math.round(geometry.walls.reduce((s, w) => s + w.length, 0)).toLocaleString("en-PK")} ft`,
              ],
              [
                "Doors / windows",
                `${geometry.openings.filter((o) => o.type === "door").length} / ${geometry.openings.filter((o) => o.type === "window").length}`,
              ],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-xl border border-stone-200 bg-white px-2 py-3"
              >
                <p className="text-[10px] uppercase tracking-wide text-stone-400">
                  {label}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-brand-black">
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {status === "calculating" && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          <div>
            <p className="text-sm font-semibold">
              Pricing your BOQ… {elapsed}s
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              Applying approved rates for this city. Please keep this page open.
            </p>
          </div>
        </div>
      )}

      {notice && status !== "calculating" && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          {boq && (
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById(boqAnchorId)
                  ?.scrollIntoView?.({ behavior: "smooth", block: "start" })
              }
              className="cursor-pointer whitespace-nowrap font-semibold underline"
            >
              Jump to BOQ
            </button>
          )}
        </div>
      )}

      {error && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      {geometry && (
        <>
          {geometry.rooms.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No rooms were detected — this drawing may not follow the expected
              layer convention (see SRS §9.1/9.3). Nothing was lost;
              double-check the file, or correct the quantities manually below.
            </p>
          )}

          {/* Rooms */}
          {/* Rooms */}
          <section>
            <h3 className={sectionTitle}>
              <span className={sectionIcon}>
                <DoorOpen className="size-4" />
              </span>
              Rooms ({geometry.rooms.length})
            </h3>
            <div className={tableWrap}>
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="w-8" />
                    <th className={th}>Name</th>
                    <th className={th}>Type</th>
                    <th className={th}>Area (sq ft)</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {geometry.rooms.map((room, i) => (
                    <tr
                      key={room.id}
                      onDragOver={(e) => {
                        if (drag?.kind === "room") e.preventDefault();
                      }}
                      onDrop={() => dropOn("room", i)}
                      className={`border-t border-stone-100 ${
                        drag?.kind === "room" && drag.from === i
                          ? "opacity-40"
                          : ""
                      }`}
                    >
                      <td className="pl-2 pr-0">
                        <span
                          draggable
                          onDragStart={() => setDrag({ kind: "room", from: i })}
                          onDragEnd={() => setDrag(null)}
                          title="Drag to reorder"
                          className={grip}
                        >
                          <GripVertical className="size-4" />
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Room ${i + 1} name`}
                          className={fieldCls}
                          value={room.name}
                          onChange={(e) =>
                            updateRoom(i, { name: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NativeSelect
                          aria-label={`Room ${i + 1} type`}
                          className={selectCls}
                          value={room.type}
                          onChange={(e) =>
                            updateRoom(i, { type: e.target.value as RoomType })
                          }
                        >
                          <NativeSelectOption value="general">
                            General
                          </NativeSelectOption>
                          <NativeSelectOption value="kitchen">
                            Kitchen
                          </NativeSelectOption>
                          <NativeSelectOption value="bathroom">
                            Bathroom
                          </NativeSelectOption>
                        </NativeSelect>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Room ${i + 1} area`}
                          type="number"
                          className={fieldCls}
                          value={room.area}
                          onChange={(e) =>
                            updateRoom(i, { area: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          aria-label={`Remove room ${i + 1}`}
                          onClick={() => removeRoom(i)}
                          className={deleteBtn}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Walls */}
          <section>
            <h3 className={sectionTitle}>
              <span className={sectionIcon}>
                <BrickWall className="size-4" />
              </span>
              Walls ({geometry.walls.length})
            </h3>
            <div className={`${tableWrap} max-h-96 overflow-y-auto`}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="w-8" />
                    <th className={th}>Wall</th>
                    <th className={th}>Length (ft)</th>
                    <th className={th}>Height (ft)</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {geometry.walls.map((wall, i) => (
                    <tr
                      key={wall.id}
                      onDragOver={(e) => {
                        if (drag?.kind === "wall") e.preventDefault();
                      }}
                      onDrop={() => dropOn("wall", i)}
                      className={`border-t border-stone-100 ${
                        drag?.kind === "wall" && drag.from === i
                          ? "opacity-40"
                          : ""
                      }`}
                    >
                      <td className="pl-2 pr-0">
                        <span
                          draggable
                          onDragStart={() => setDrag({ kind: "wall", from: i })}
                          onDragEnd={() => setDrag(null)}
                          title="Drag to reorder"
                          className={grip}
                        >
                          <GripVertical className="size-4" />
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex h-11 items-center rounded-xl border border-stone-200 bg-white px-4 text-[15px] text-brand-black shadow-sm">
                          Wall {i + 1}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Wall ${i + 1} length`}
                          type="number"
                          className={fieldCls}
                          value={wall.length}
                          onChange={(e) =>
                            updateWall(i, { length: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Wall ${i + 1} height`}
                          type="number"
                          className={fieldCls}
                          value={wall.height}
                          onChange={(e) =>
                            updateWall(i, { height: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          aria-label={`Remove wall ${i + 1}`}
                          onClick={() => removeWall(i)}
                          className={deleteBtn}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSaveCorrections}
              disabled={busy}
              className="h-10 cursor-pointer gap-2 bg-brand px-4 text-white hover:bg-brand-dark disabled:cursor-not-allowed"
            >
              {status === "saving" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {status === "saving" ? "Saving…" : "Save corrections"}
            </Button>
            <Button
              onClick={handleCalculateBoq}
              disabled={busy}
              variant="outline"
              className="h-10 cursor-pointer gap-2 px-4 disabled:cursor-not-allowed"
            >
              {status === "calculating" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Calculator className="size-4" />
              )}
              {status === "calculating" ? "Calculating…" : "Calculate BOQ"}
            </Button>
            {dirty && status === "reviewing" && (
              <span className="text-xs font-medium text-amber-700">
                Unsaved changes — they will be saved automatically when you
                calculate.
              </span>
            )}
          </div>
        </>
      )}

      {showBoq && boq && (
        <section className="border-t border-stone-200 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-brand-black">
              Bill of Quantities
            </h3>
            <div className="flex gap-2 text-sm">
              <Link
                href={`/office/${projectId}/boq`}
                target="_blank"
                className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-50"
              >
                Print / Save PDF
              </Link>
              <Link
                href={`/client/${projectId}`}
                target="_blank"
                className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark"
              >
                Client view
              </Link>
            </div>
          </div>
          <BoqTable boq={boq} />
        </section>
      )}
    </div>
  );
}
