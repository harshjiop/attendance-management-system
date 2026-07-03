import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/db/mongodb";
import Attendance, { IPunch } from "@/models/attendance.model";
import UserModel from "@/models/user.model";

type SheetFile = {
    name: string;
    content: string;
};

function getToday() {
    return new Date().toISOString().split("T")[0];
}

function isDateString(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildDateRange(startDate: string, endDate: string) {
    const dates: string[] = [];
    const currentDate = new Date(`${startDate}T00:00:00.000Z`);
    const lastDate = new Date(`${endDate}T00:00:00.000Z`);

    while (currentDate <= lastDate) {
        dates.push(currentDate.toISOString().split("T")[0]);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return dates;
}

function formatColumnDate(date: string) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
}

function formatPunchTime(timestamp: Date) {
    return new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(timestamp);
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

function createZip(files: SheetFile[]) {
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
    const buffer = new ArrayBuffer(localSize + centralSize + 22);
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

    return new Uint8Array(buffer);
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

function buildWorkbook(sheetRows: string[][]) {
    return createZip([
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
            content: buildSheetXml(sheetRows),
        },
    ]);
}

async function requireAdmin() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return {
            error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    if (session.user.role !== "admin") {
        return {
            error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
    }

    return { session };
}

export async function GET(request: Request) {
    const { error } = await requireAdmin();

    if (error) {
        return error;
    }

    const { searchParams } = new URL(request.url);
    const today = getToday();
    const filter = searchParams.get("filter") || "today";
    const start = searchParams.get("startDate") || today;
    const end = searchParams.get("endDate") || today;
    const startDate = filter === "range" ? start : today;
    const endDate = filter === "range" ? end : today;

    if (!isDateString(startDate) || !isDateString(endDate)) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    if (startDate > endDate) {
        return NextResponse.json(
            { error: "Start date cannot be after end date" },
            { status: 400 }
        );
    }

    if (endDate > today) {
        return NextResponse.json(
            { error: "End date cannot be more than today" },
            { status: 400 }
        );
    }

    await connectDB();

    const dates = buildDateRange(startDate, endDate);
    const [users, attendanceRecords] = await Promise.all([
        UserModel.find({ role: "user" })
            .select("_id name email")
            .sort({ name: 1 })
            .lean(),
        Attendance.find({
            date: { $gte: startDate, $lte: endDate },
        })
            .select("userId date punches")
            .lean(),
    ]);
    const attendanceByUser = new Map<string, Map<string, string>>();

    attendanceRecords.forEach((record) => {
        const userId = record.userId.toString();
        const userAttendance = attendanceByUser.get(userId) || new Map<string, string>();
        const punches = record.punches
            .map((punch: IPunch) => `${punch.type.toLowerCase()}/${formatPunchTime(punch.timestamp)}`)
            .join(" | ");

        userAttendance.set(record.date, punches || "-");
        attendanceByUser.set(userId, userAttendance);
    });

    const sheetRows = [
        ["Name", "Email", ...dates.map(formatColumnDate)],
        ...users.map((user) => {
            const userAttendance = attendanceByUser.get(user._id.toString());

            return [
                user.name,
                user.email || "",
                ...dates.map((date) => userAttendance?.get(date) || "-"),
            ];
        }),
    ];
    const workbook = buildWorkbook(sheetRows);
    const filename = `attendance-${startDate}-to-${endDate}.xlsx`;

    return new Response(workbook, {
        headers: {
            "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        },
    });
}
