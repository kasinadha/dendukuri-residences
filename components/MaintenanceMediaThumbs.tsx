import { isVideoSrc } from "@/lib/storage-uploads";

export default function MaintenanceMediaThumbs({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((url) =>
        isVideoSrc(url) ? (
          <video
            key={url}
            src={url}
            controls
            preload="metadata"
            className="h-24 w-36 rounded-lg border border-slate-200 bg-black object-cover"
          />
        ) : (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            {/* Signed storage URL; not a configured next/image host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
            />
          </a>
        )
      )}
    </div>
  );
}
