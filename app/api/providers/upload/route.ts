import { NextRequest, NextResponse } from "next/server";
import { parseEnchorData, EnchorResponse } from "@/services/providers/enchor";
import {
  parseRhythmverseData,
  RhythmVerseResponse,
} from "@/services/providers/rhythmverse";
import { ProviderMusic } from "@/types";
import { processSongs } from "@/services/songs";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { ProviderService } from "@/lib/services/provider";
import AdmZip from "adm-zip";

export async function POST(request: NextRequest) {
  // Check authentication and authorization
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(authUser.profile.role, "moderator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const source = formData.get("source") as string | null;

    if (!file || !source) {
      return NextResponse.json(
        { error: "File and source are required" },
        { status: 400 },
      );
    }

    if (!["enchor", "rhythmverse"].includes(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    // MIME type check
    const ALLOWED_MIME_TYPES = [
      "application/zip",
      "application/x-zip-compressed",
      "application/x-zip",
      "application/octet-stream",
    ];
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only ZIP files are allowed." },
        { status: 400 },
      );
    }

    // File size limit: 100MB
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB." },
        { status: 400 },
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize zip
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return NextResponse.json({ error: "Invalid zip file" }, { status: 400 });
    }

    const allSongs: ProviderMusic[] = [];

    // Zip bomb protection
    const MAX_ENTRIES = 700;
    const MAX_DECOMPRESSED_SIZE = 500 * 1024 * 1024; // 500MB total decompressed
    const MAX_ENTRY_SIZE = 50 * 1024 * 1024; // 50MB per individual entry
    const entries = zip.getEntries();
    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json(
        { error: `Too many entries in zip (max ${MAX_ENTRIES})` },
        { status: 400 },
      );
    }

    let totalDecompressedSize = 0;
    for (const entry of entries) {
      if (
        entry.isDirectory ||
        !entry.name.endsWith(".json") ||
        entry.name.startsWith(".") ||
        entry.name.includes("__MACOSX")
      )
        continue;

      const data = entry.getData();
      if (data.length > MAX_ENTRY_SIZE) {
        return NextResponse.json(
          { error: "Individual entry too large" },
          { status: 400 },
        );
      }
      totalDecompressedSize += data.length;
      if (totalDecompressedSize > MAX_DECOMPRESSED_SIZE) {
        return NextResponse.json(
          { error: "Decompressed content too large" },
          { status: 400 },
        );
      }

      try {
        const fileContent = data.toString("utf8");
        const json = JSON.parse(fileContent);

        if (source === "enchor") {
          const enchorData = json as EnchorResponse;
          if (enchorData.data && Array.isArray(enchorData.data)) {
            allSongs.push(...parseEnchorData(enchorData.data));
          }
        } else if (source === "rhythmverse") {
          const rvData = json as RhythmVerseResponse;
          if (
            rvData.data &&
            rvData.data.songs &&
            Array.isArray(rvData.data.songs)
          ) {
            allSongs.push(...parseRhythmverseData(rvData.data.songs));
          }
        }
      } catch (err) {
        console.error(`Failed to parse JSON for entry ${entry.name}:`, err);
      }
    }

    if (allSongs.length === 0) {
      return NextResponse.json(
        { error: "No valid songs found in zip" },
        { status: 400 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const stats = await processSongs(allSongs, source, (data) => {
            const message = JSON.stringify({ type: "progress", ...data });
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          });

          // Update lastSuccessfulFetch based on max sourceUpdatedAt
          const dates = allSongs
            .map((s) => s.sourceUpdatedAt)
            .filter((d): d is Date => d !== null);
          if (dates.length > 0) {
            const maxDate = new Date(
              Math.max(...dates.map((d) => d.getTime())),
            );
            await ProviderService.updateLastSuccessfulFetchIfNewer(
              source as "enchor" | "rhythmverse",
              maxDate,
            );
          }

          // Print the stats grouping the ignored songs by reason
          const ignoredByReason = stats.details.ignored.reduce(
            (acc, song) => {
              const reason = song.reason;
              if (!acc[reason]) {
                acc[reason] = [];
              }
              acc[reason].push(song);
              return acc;
            },
            {} as Record<string, { artist: string; title: string }[]>,
          );

          // Send full stats to client
          const completeMessage = JSON.stringify({
            type: "complete",
            stats: {
              ...stats,
              details: {
                ...stats.details,
                ignored: ignoredByReason,
              },
            },
          });
          controller.enqueue(encoder.encode(`data: ${completeMessage}\n\n`));
          controller.close();
        } catch (error: unknown) {
          console.error("Error processing upload:", error);
          const errorMessage = JSON.stringify({
            type: "error",
            message:
              error instanceof Error ? error.message : "Internal server error",
          });
          controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { error: "Internal server error processing upload" },
      { status: 500 },
    );
  }
}
