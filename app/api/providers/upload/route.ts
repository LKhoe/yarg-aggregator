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

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialiaze zip
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return NextResponse.json({ error: "Invalid zip file" }, { status: 400 });
    }

    const allSongs: ProviderMusic[] = [];

    for (const entry of zip.getEntries()) {
      if (
        entry.isDirectory ||
        !entry.name.endsWith(".json") ||
        entry.name.startsWith(".") ||
        entry.name.includes("__MACOSX")
      )
        continue;
      try {
        const fileContent = entry.getData().toString("utf8");
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
