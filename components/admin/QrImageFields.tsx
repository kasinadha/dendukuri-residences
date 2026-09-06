type Props = {
  defaultUrl?: string | null;
  urlName?: string;
  fileName?: string;
  urlPlaceholder?: string;
};

export default function QrImageFields({
  defaultUrl = "",
  urlName = "upi_qr_url",
  fileName = "upi_qr_file",
  urlPlaceholder = "/upi/building-qr.png",
}: Props) {
  return (
    <>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Upload QR image
        </span>
        <input
          name={fileName}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
        <span className="mt-1 block text-xs text-slate-500">
          JPEG, PNG, or WebP, up to 5 MB. Uploading replaces the saved QR.
        </span>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Or QR image URL
        </span>
        <input
          name={urlName}
          defaultValue={defaultUrl ?? ""}
          placeholder={urlPlaceholder}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
    </>
  );
}
