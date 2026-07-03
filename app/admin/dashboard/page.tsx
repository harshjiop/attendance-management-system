"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type PunchView = {
    type: "IN" | "OUT";
    time: string;
};

type AttendanceView = {
    date: string;
    punches: PunchView[];
};

type StaffAttendanceRow = {
    _id: string;
    name: string;
    email: string;
    attendance: Record<string, AttendanceView | null>;
};

type FilterType = "today" | "range";

function getToday() {
    return new Date().toISOString().split("T")[0];
}

function formatColumnDate(date: string) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
}

function formatAttendance(attendance: AttendanceView | null) {
    if (!attendance || attendance.punches.length === 0) {
        return "-";
    }

    return attendance.punches
        .map((punch) => `${punch.type.toLowerCase()}/${punch.time}`)
        .join(" | ");
}

function escapeXml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;

    for (const byte of bytes) {
        crc ^= byte;

        for (let index = 0; index < 8; index += 1) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function writeString(view: DataView, offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
    }
}

function createZip(files: { name: string; content: string }[]) {
    const encoder = new TextEncoder();
    const encodedFiles = files.map((file) => ({
        ...file,
        nameBytes: encoder.encode(file.name),
        contentBytes: encoder.encode(file.content),
    }));
    const localSize = encodedFiles.reduce(
        (total, file) => total + 30 + file.nameBytes.length + file.contentBytes.length,
        0
    );
    const centralSize = encodedFiles.reduce(
        (total, file) => total + 46 + file.nameBytes.length,
        0
    );
    const endSize = 22;
    const buffer = new ArrayBuffer(localSize + centralSize + endSize);
    const view = new DataView(buffer);
    let offset = 0;
    const centralDirectory: {
        file: (typeof encodedFiles)[number];
        crc: number;
        localOffset: number;
    }[] = [];

    encodedFiles.forEach((file) => {
        const localOffset = offset;
        const crc = crc32(file.contentBytes);

        view.setUint32(offset, 0x04034b50, true);
        offset += 4;
        view.setUint16(offset, 20, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint32(offset, crc, true);
        offset += 4;
        view.setUint32(offset, file.contentBytes.length, true);
        offset += 4;
        view.setUint32(offset, file.contentBytes.length, true);
        offset += 4;
        view.setUint16(offset, file.nameBytes.length, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        new Uint8Array(buffer, offset, file.nameBytes.length).set(file.nameBytes);
        offset += file.nameBytes.length;
        new Uint8Array(buffer, offset, file.contentBytes.length).set(file.contentBytes);
        offset += file.contentBytes.length;
        centralDirectory.push({ file, crc, localOffset });
    });

    const centralOffset = offset;

    centralDirectory.forEach(({ file, crc, localOffset }) => {
        view.setUint32(offset, 0x02014b50, true);
        offset += 4;
        view.setUint16(offset, 20, true);
        offset += 2;
        view.setUint16(offset, 20, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint32(offset, crc, true);
        offset += 4;
        view.setUint32(offset, file.contentBytes.length, true);
        offset += 4;
        view.setUint32(offset, file.contentBytes.length, true);
        offset += 4;
        view.setUint16(offset, file.nameBytes.length, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint32(offset, 0, true);
        offset += 4;
        view.setUint32(offset, localOffset, true);
        offset += 4;
        new Uint8Array(buffer, offset, file.nameBytes.length).set(file.nameBytes);
        offset += file.nameBytes.length;
    });

    const centralDirectorySize = offset - centralOffset;

    view.setUint32(offset, 0x06054b50, true);
    offset += 4;
    view.setUint16(offset, 0, true);
    offset += 2;
    view.setUint16(offset, 0, true);
    offset += 2;
    view.setUint16(offset, files.length, true);
    offset += 2;
    view.setUint16(offset, files.length, true);
    offset += 2;
    view.setUint32(offset, centralDirectorySize, true);
    offset += 4;
    view.setUint32(offset, centralOffset, true);
    offset += 4;
    view.setUint16(offset, 0, true);
    writeString(view, offset, "");

    return buffer;
}

function cellReference(rowIndex: number, columnIndex: number) {
    let dividend = columnIndex + 1;
    let columnName = "";

    while (dividend > 0) {
        const modulo = (dividend - 1) % 26;
        columnName = String.fromCharCode(65 + modulo) + columnName;
        dividend = Math.floor((dividend - modulo) / 26);
    }

    return `${columnName}${rowIndex + 1}`;
}

function buildSheetXml(sheetRows: string[][]) {
    const rowsXml = sheetRows
        .map((row, rowIndex) => {
            const cellsXml = row
                .map((cell, columnIndex) => {
                    const reference = cellReference(rowIndex, columnIndex);

                    return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
                })
                .join("");

            return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
        })
        .join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

function downloadExcelFile(dates: string[], rows: StaffAttendanceRow[]) {
    const headerCells = ["Name", "Email", ...dates.map(formatColumnDate)];
    const bodyRows = rows.map((row) => [
        row.name,
        row.email,
        ...dates.map((date) => formatAttendance(row.attendance[date])),
    ]);
    const workbookFiles = [
        {
            name: "[Content_Types].xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
        },
        {
            name: "_rels/.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
        },
        {
            name: "xl/workbook.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>
        <sheet name="Attendance" sheetId="1" r:id="rId1"/>
    </sheets>
</workbook>`,
        },
        {
            name: "xl/_rels/workbook.xml.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
        },
        {
            name: "xl/worksheets/sheet1.xml",
            content: buildSheetXml([headerCells, ...bodyRows]),
        },
    ];
    const blob = new Blob([createZip(workbookFiles)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const start = dates[0] || getToday();
    const end = dates[dates.length - 1] || start;

    link.href = url;
    link.download = `attendance-${start}-to-${end}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const today = useMemo(() => getToday(), []);
    const [filterType, setFilterType] = useState<FilterType>("today");
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [dates, setDates] = useState<string[]>([]);
    const [rows, setRows] = useState<StaffAttendanceRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const isAdmin = session?.user?.role === "admin";

    async function loadAttendance() {
        setIsLoading(true);
        setError("");

        try {
            const params = new URLSearchParams({ filter: filterType });

            if (filterType === "range") {
                params.set("startDate", startDate);
                params.set("endDate", endDate);
            }

            const response = await fetch(`/api/admin/attendance?${params.toString()}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to load attendance");
            }

            setDates(result.data.dates || []);
            setRows(result.data.rows || []);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to load attendance");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        if (status !== "authenticated" || !isAdmin) {
            return;
        }

        const timeoutId = window.setTimeout(() => loadAttendance(), 0);

        return () => window.clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, status]);

    function applyFilter() {
        if (filterType === "range" && startDate > endDate) {
            setError("Start date cannot be after end date");
            return;
        }

        if (filterType === "range" && endDate > today) {
            setError("End date cannot be more than today");
            return;
        }

        loadAttendance();
    }

    function exportCurrentData() {
        if (dates.length === 0 || rows.length === 0) {
            setError("No attendance data available to export");
            return;
        }

        setError("");
        downloadExcelFile(dates, rows);
    }

    if (status === "loading") {
        return (
            <main className="flex min-h-[60vh] items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading dashboard...</p>
            </main>
        );
    }

    if (!isAdmin) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center">
                <div className="w-full max-w-sm border border-border bg-background p-5 text-center shadow-sm">
                    <h1 className="text-lg font-semibold">Admin only</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        You do not have permission to view attendance reports.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Attendance Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                    View every staff member&apos;s in and out time by date.
                </p>
            </div>

            {/* Filter Section */}
            <section className="rounded-md border border-border bg-background p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[auto_1fr_1fr_auto_auto] md:items-end">
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Filter
                        <select
                            value={filterType}
                            onChange={(event) => setFilterType(event.target.value as FilterType)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                            <option value="today">Today</option>
                            <option value="range">Custom date</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Start date
                        <input
                            type="date"
                            value={startDate}
                            max={today}
                            disabled={filterType === "today"}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                        End date
                        <input
                            type="date"
                            value={endDate}
                            max={today}
                            disabled={filterType === "today"}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </label>

                    <button
                        type="button"
                        onClick={applyFilter}
                        disabled={isLoading}
                        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isLoading ? "Loading..." : "Apply"}
                    </button>

                    <button
                        type="button"
                        onClick={exportCurrentData}
                        disabled={isLoading || rows.length === 0}
                        className="h-9 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Export Excel
                    </button>
                </div>
            </section>

            {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                    {error}
                </p>
            )}

            {/* Excel-like Table Section */}
            <section className="rounded-md border border-border bg-background shadow-sm">
                {/* Max height forces vertical scrolling, overflow-auto handles both axes */}
                <div className="relative max-h-[65vh] w-full overflow-auto">
                    <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-muted/80 backdrop-blur-sm">
                                {/* Top-Left Cell: Highest z-index to stay above scrolled rows and columns */}
                                <th className="sticky left-0 top-0 z-30 min-w-[160px] border-b border-r border-border bg-muted/95 px-3 py-2 font-semibold text-foreground shadow-[1px_1px_0_0_theme(colors.border)]">
                                    Name
                                </th>
                                {/* Top Header Cells: Sticky to top */}
                                <th className="sticky top-0 z-20 min-w-[200px] border-b border-r border-border bg-muted/95 px-3 py-2 font-semibold text-foreground shadow-[0_1px_0_0_theme(colors.border)]">
                                    Email
                                </th>
                                {dates.map((date) => (
                                    <th
                                        key={date}
                                        className="sticky top-0 z-20 min-w-[140px] border-b border-r border-border bg-muted/95 px-3 py-2 font-semibold text-foreground shadow-[0_1px_0_0_theme(colors.border)] text-center"
                                    >
                                        {formatColumnDate(date)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-background">
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={dates.length + 2}
                                        className="px-3 py-8 text-center text-muted-foreground"
                                    >
                                        {isLoading ? "Loading attendance data..." : "No staff found."}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr
                                        key={row._id}
                                        className="group transition-colors hover:bg-muted/50"
                                    >
                                        {/* Left Column: Sticky to left */}
                                        <td className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2 font-medium text-foreground group-hover:bg-muted/50 shadow-[1px_0_0_0_theme(colors.border)]">
                                            {row.name}
                                        </td>
                                        <td className="border-b border-r border-border px-3 py-2 text-muted-foreground">
                                            {row.email}
                                        </td>
                                        {dates.map((date) => {
                                            const attendance = formatAttendance(row.attendance[date]);
                                            return (
                                                <td
                                                    key={date}
                                                    className="border-b border-r border-border px-3 py-2 text-center"
                                                >
                                                    <span className={cn(
                                                        "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-medium",
                                                        attendance === "-"
                                                            ? "text-muted-foreground"
                                                            : "bg-primary/10 text-primary"
                                                    )}>
                                                        {attendance}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}

// Utility function for class merging (you likely already have this in your project)
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}
