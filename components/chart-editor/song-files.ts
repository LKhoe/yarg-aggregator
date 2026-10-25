// Sort the files of a song folder (or a multi-file drop) into chart, stems and song.ini

const CHART_EXT = /\.(chart|mid|midi)$/i;
const AUDIO_EXT = /\.(ogg|mp3|wav|flac|opus)$/i;
// Preferred chart when a folder has several (YARG/Clone Hero read notes.chart first)
const CHART_PRIORITY = ["notes.chart", "notes.mid", "notes.midi"];
// The preview clip is a short excerpt, not a stem: playing it along would double the audio
const IGNORED_AUDIO = /^preview\./i;

export interface SongFiles {
  chart?: File;
  audio: File[];
  songIni?: File;
}

export function classifySongFiles(files: File[]): SongFiles {
  const charts = files.filter((f) => CHART_EXT.test(f.name));
  const rank = (f: File) => {
    const i = CHART_PRIORITY.indexOf(f.name.toLowerCase());
    return i === -1 ? CHART_PRIORITY.length : i;
  };
  charts.sort((a, b) => rank(a) - rank(b));
  return {
    chart: charts[0],
    audio: files.filter((f) => AUDIO_EXT.test(f.name) && !IGNORED_AUDIO.test(f.name)),
    songIni: files.find((f) => f.name.toLowerCase() === "song.ini"),
  };
}

// Files from a drop, including the top level of dropped folders
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((e): e is FileSystemEntry => e !== null);
  if (entries.length === 0) return Array.from(dataTransfer.files);

  const files: File[] = [];
  for (const entry of entries) {
    if (entry.isFile) {
      files.push(await entryFile(entry as FileSystemFileEntry));
    } else if (entry.isDirectory) {
      for (const child of await readDirectory(entry as FileSystemDirectoryEntry)) {
        if (child.isFile) files.push(await entryFile(child as FileSystemFileEntry));
      }
    }
  }
  return files;
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

// readEntries returns results in batches; keep reading until it returns none
async function readDirectory(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader();
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}
